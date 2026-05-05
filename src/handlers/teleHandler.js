// Telegram message/event handler
const os = require('os');
const fs = require('fs/promises');
const fsSync = require('fs');
const path = require('path');
const axios = require('axios');
const bot = require('../lib/telegramClient');
const { Markup } = require('telegraf');
const { askAiDetailed, translateText } = require('../lib/aiClient');
const handleFinanceCommand = require('../commands/finance/index');
const { handleAdminCommand } = require('../commands/admin/index');
const { getHistoryPage } = require('../services/financeService');
const { isAdmin } = require('../utils/auth');
const { checkWebsites, formatMonitorMessage, getMonitorWebsiteLinks } = require('../services/monitorService');
const { AI_MODELS, buildModelInfoMessage, setActiveModel } = require('../services/aiPreferenceService');
const { handleImgCommand } = require('../commands/converter/index');
const { handleReminderCommand } = require('../commands/reminder/index');
const { createSticker, isFfmpegMissingError } = require('../services/stickerService');
const { getQuotaStatus } = require('../services/quotaService');
const { updateStatusAnswered } = require('../services/csService');
const { logCommand } = require('../services/logService');
const { shortenUrl } = require('../services/shortenerService');
const { getDownloadUrl, getAudioUrl, getMediaBuffer, getAudioBuffer } = require('../services/downloaderService');
const { searchBooks, searchJournals, searchArticles } = require('../services/researchService');
const { buildDonateMessage, getDonateQrImagePaths } = require('../services/donateService');
const {
    MAX_FILE_SIZE,
    removeBackground,
    htmlToImage,
    rotatePdf,
    extractPdf,
    mergePdfs,
    convertToPdf,
    convertFromPdf,
    compressPdf
} = require('../services/converterService');
const HISTORY_PAGE_SIZE = 5;
const MAX_PDF_INPUT_SIZE = 10 * 1024 * 1024;
const MAX_PDF_LOCAL_INPUT_SIZE = 15 * 1024 * 1024;
const mergeSessions = {};

function escapeHtml(text) {
    return String(text || '')
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#39;');
}

function autoLink(text) {
    return String(text || '').replace(/(https?:\/\/[^\s<]+)/g, '<a href="$1">$1</a>');
}

function escapeRegex(value) {
    return String(value || '').replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function getExtensionFromFileName(fileName) {
    const ext = path.extname(String(fileName || '')).replace('.', '').toLowerCase();
    return ext || '';
}

function getExtensionFromMimeType(mimeType) {
    const mime = String(mimeType || '').toLowerCase();
    const map = {
        'application/pdf': 'pdf',
        'application/msword': 'doc',
        'application/vnd.openxmlformats-officedocument.wordprocessingml.document': 'docx',
        'application/vnd.ms-excel': 'xls',
        'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet': 'xlsx',
        'application/vnd.ms-powerpoint': 'ppt',
        'application/vnd.openxmlformats-officedocument.presentationml.presentation': 'pptx',
        'text/plain': 'txt',
        'image/jpeg': 'jpg',
        'image/png': 'png',
        'image/webp': 'webp',
        'video/mp4': 'mp4'
    };

    return map[mime] || '';
}

function isTelegramPdfDocument(document) {
    if (!document) {
        return false;
    }

    const extFromName = getExtensionFromFileName(document.file_name);
    const mimeType = String(document.mime_type || '').toLowerCase();
    return extFromName === 'pdf' || mimeType.includes('pdf');
}

function safeUnlinkSync(filePath) {
    try {
        if (filePath && fsSync.existsSync(filePath)) {
            fsSync.unlinkSync(filePath);
        }
    } catch (error) {
        console.error('Failed to delete temp file:', filePath, error);
    }
}

async function ensureTempDir() {
    const tempDir = path.join(process.cwd(), 'temp');
    await fs.mkdir(tempDir, { recursive: true });
    return tempDir;
}

function getTelegramPhotoSource(message) {
    const candidates = [message, message?.reply_to_message].filter(Boolean);

    for (const candidate of candidates) {
        if (Array.isArray(candidate.photo) && candidate.photo.length > 0) {
            const largestPhoto = candidate.photo[candidate.photo.length - 1];
            return {
                fileId: largestPhoto.file_id,
                fileSize: Number(largestPhoto.file_size || 0)
            };
        }
    }

    return null;
}

function stripWrappingQuotes(value) {
    const text = String(value || '').trim();
    if (!text) {
        return '';
    }

    const hasDoubleQuotes = text.startsWith('"') && text.endsWith('"');
    const hasSingleQuotes = text.startsWith("'") && text.endsWith("'");

    if (hasDoubleQuotes || hasSingleQuotes) {
        return text.slice(1, -1).trim();
    }

    return text;
}

function getTelegramBotUsername() {
    const fromBotInfo = bot.botInfo?.username;
    const fromEnv = process.env.TELEGRAM_BOT_USERNAME;
    const username = stripWrappingQuotes(fromBotInfo || fromEnv || '')
        .replace(/^@+/, '')
        .replace(/\s+/g, '')
        .trim();

    return username;
}

function sanitizeTelegramIncomingText(rawText) {
    let text = String(rawText || '').trim();
    const botUsername = getTelegramBotUsername();

    if (!botUsername) {
        return text;
    }

    const escapedBotUsername = escapeRegex(botUsername);

    text = text.replace(new RegExp(`^\/(\\w+)@${escapedBotUsername}(?=\\s|$)`, 'i'), '/$1');
    text = text.replace(new RegExp(`(^|\\s)@${escapedBotUsername}(?=\\s|$|[.,!?;:])`, 'gi'), '$1');

    return text.replace(/\s{2,}/g, ' ').trim();
}

function formatTelegramHtml(rawText) {
    let text = String(rawText || '').replace(/\r\n/g, '\n').trim();

    const preservedTags = [];
    const preserveTag = (tag) => {
        preservedTags.push(tag);
        return `__HTML_TAG_${preservedTags.length - 1}__`;
    };

    text = text
        .replace(/<b>/gi, (tag) => preserveTag(tag))
        .replace(/<\/b>/gi, (tag) => preserveTag(tag))
        .replace(/<code>/gi, (tag) => preserveTag(tag))
        .replace(/<\/code>/gi, (tag) => preserveTag(tag));

    text = escapeHtml(text);

    text = text.replace(/^&gt;\s*\*([^*]+)\*\s*(.*)$/gm, (_match, title, suffix) => {
        const cleanTitle = title.trim();
        const cleanSuffix = (suffix || '').trim();
        return cleanSuffix ? `<b>${cleanTitle}</b> ${cleanSuffix}` : `<b>${cleanTitle}</b>`;
    });

    // Remove code block formatting (```...```) and convert to plain text
    // First, handle multi-line code blocks
    text = text.replace(/```([\s\S]*?)```/g, (_match, codeBlock) => {
        // Remove any leading/trailing whitespace and convert to plain text
        return codeBlock.trim();
    });
    // Handle inline code (`...`) and convert to plain text
    text = text.replace(/`([^`\n]+)`/g, '$1');
    // Keep bold formatting
    text = text.replace(/\*([^*\n]+)\*/g, '<b>$1</b>');

    text = text.replace(/(^|\n)-\s+/g, '$1');
    text = autoLink(text);

    text = text.replace(/__HTML_TAG_(\d+)__/g, (_match, indexText) => {
        const index = parseInt(indexText, 10);
        return preservedTags[index] || '';
    });

    return text;
}

function formatDuration(seconds) {
    const totalSeconds = Math.max(0, Math.floor(seconds || 0));
    const days = Math.floor(totalSeconds / 86400);
    const hours = Math.floor((totalSeconds % 86400) / 3600);
    const minutes = Math.floor((totalSeconds % 3600) / 60);

    const parts = [];
    if (days > 0) parts.push(`${days}h`);
    parts.push(`${hours}j`);
    parts.push(`${minutes}m`);
    return parts.join(' ');
}

function getCpuUsagePercent() {
    const cpus = os.cpus() || [];
    if (cpus.length === 0) return 0;

    let idle = 0;
    let total = 0;
    for (const cpu of cpus) {
        const times = cpu.times || {};
        idle += times.idle || 0;
        total += (times.user || 0) + (times.nice || 0) + (times.sys || 0) + (times.idle || 0) + (times.irq || 0);
    }

    if (total <= 0) return 0;
    return Math.round((1 - (idle / total)) * 100);
}

function getRamUsageText() {
    const total = os.totalmem();
    const free = os.freemem();
    const used = Math.max(total - free, 0);
    const usedGb = (used / (1024 ** 3)).toFixed(1);
    const totalGb = (total / (1024 ** 3)).toFixed(1);
    return `${usedGb}/${totalGb} GB`;
}

function buildSystemStatsFooter() {
    return [
        '—'.repeat(19),
        `CPU: ${getCpuUsagePercent()}%`,
        `RAM: ${getRamUsageText()}`,
        `UPTIME: ${formatDuration(os.uptime())}`,
        `STATUS: ONLINE`
    ].join('\n');
}

function buildAiStatsFooter(aiMeta = {}) {
    const model = aiMeta.modelName || aiMeta.model || '-';
    const tokenIn = aiMeta.usage?.promptTokenCount ?? 0;
    const tokenOut = aiMeta.usage?.candidatesTokenCount ?? 0;
    const rpmLabel = aiMeta.rpm?.label || '-';

    return [
        '—'.repeat(19),
        `Model: ${model}`,
        `Token In: ${tokenIn} | Token Out: ${tokenOut}`,
        `RPM: ${rpmLabel}`
    ].join('\n');
}

function appendFooter(text, footer) {
    const base = String(text || '').trim();
    const foot = String(footer || '').trim();
    if (!base) return foot;
    if (!foot) return base;
    return `${base}\n\n${foot}`;
}

function buildMainMenuKeyboard() {
    return Markup.inlineKeyboard([
        [Markup.button.callback('☕ Donate', 'cmd:donate')],
        [Markup.button.callback('💰 Finance Info', 'cmd:finance_info'), Markup.button.callback('⚙️ Info', 'cmd:info')],
        [Markup.button.callback('👨‍💻 About Me', 'cmd:me'), Markup.button.callback('🏓 Ping', 'cmd:ping')],
        [Markup.button.callback('🖼️ Image Tools', 'cmd:img_info'), Markup.button.callback('📄 PDF Tools', 'cmd:pdf_info')],
        [Markup.button.callback('🤖 Model AI', 'cmd:model_info'), Markup.button.callback('🧩 Sticker Tools', 'cmd:sticker_info')],
        [Markup.button.callback('🔎 Research', 'cmd:research_info'), Markup.button.callback('⬇️ Downloader', 'cmd:downloader')],
        [Markup.button.callback('🌍 Translate Info', 'cmd:translate_info'), Markup.button.callback('⏰ Reminder Info', 'cmd:remind_info')],
        [Markup.button.callback('🆘 Help & CS', 'cmd:help')]
    ]);
}

function buildAdminMenuKeyboard() {
    return Markup.inlineKeyboard([
        [Markup.button.callback('📡 Monitor', 'admin:monitor'), Markup.button.callback('📣 Broadcast', 'admin:broadcast')],
        [Markup.button.callback('🧾 Cmd Usage', 'admin:cmd_usage'), Markup.button.callback('🤖 AI Usage', 'admin:ai_usage')],
    ]);
}

function buildMonitorLinksKeyboard() {
    const websiteLinks = getMonitorWebsiteLinks();
    const rows = websiteLinks
        .filter((item) => item.url)
        .map((item) => [Markup.button.url(item.label, item.url)]);

    if (rows.length === 0) {
        return null;
    }

    return Markup.inlineKeyboard(rows);
}

function buildHistoryKeyboard(page, hasPrev, hasNext) {
    const navButtons = [];

    if (hasPrev) {
        navButtons.push(Markup.button.callback('⬅️ Prev', `history:${page - 1}`));
    }

    if (hasNext) {
        navButtons.push(Markup.button.callback('Next ➡️', `history:${page + 1}`));
    }

    const rows = [];
    if (navButtons.length > 0) {
        rows.push(navButtons);
    }
    rows.push([Markup.button.callback('🔄 Refresh', `history:${page}`), Markup.button.callback('🏠 Menu', 'cmd:start')]);

    return Markup.inlineKeyboard(rows);
}

function buildDeleteConfirmKeyboard(transactionId) {
    return Markup.inlineKeyboard([
        [
            Markup.button.callback('✅ Ya, hapus', `delete_confirm:${transactionId}`),
            Markup.button.callback('❌ Batal', `delete_cancel:${transactionId}`)
        ]
    ]);
}

function formatQuotaLimit(limit) {
    const numericLimit = Number(limit);
    return Number.isFinite(numericLimit) && numericLimit > 0 ? String(numericLimit) : 'Unlimited';
}

function formatQuotaUsageText(status) {
    const usage = Number(status?.usage || 0);
    const limitText = formatQuotaLimit(status?.limit);
    return limitText === 'Unlimited' ? String(usage) : `${usage}/${limitText}`;
}

async function buildImageToolsQuotaFooter() {
    const [removeBgStatus, htmlToImageStatus] = await Promise.all([
        getQuotaStatus('removebg', 50, false),
        getQuotaStatus('html2img', 50, false)
    ]);

    return [
        '—'.repeat(19),
        `REMOVEBG: Usage: ${formatQuotaUsageText(removeBgStatus)} | Limit: ${formatQuotaLimit(removeBgStatus.limit)}`,
        `html2img: Usage: ${formatQuotaUsageText(htmlToImageStatus)} | Limit: ${formatQuotaLimit(htmlToImageStatus.limit)}`
    ].join('\n');
}

async function buildPdfToolsQuotaFooter() {
    const cloudConvertStatus = await getQuotaStatus('cloudconvert', 10, true);
    const cloudConvertLimit = formatQuotaLimit(cloudConvertStatus.limit);
    const cloudConvertUsage = formatQuotaUsageText(cloudConvertStatus);

    return [
        '—'.repeat(19),
        `CloudConvert: Usage: ${cloudConvertUsage} | Limit: ${cloudConvertLimit}`
    ].join('\n');
}

function buildImageToolsInfoTelegramBody() {
    return `Konversi, edit, hapus background, dan screenshot web.\n\n<b>MODE 1 - BALAS FOTO:</b>\n1. Balas pesan dengan gambar/foto\n2. Kirim salah satu command berikut\n\n<pre>/img compress\n/img resize WxH\n/img to format\n/img rotate deg\n/hapusbg</pre>\n\n<b>MODE 2 - SCREENSHOT WEB:</b>\n<pre>/ss https://example.com</pre>\n\n<b>KETERANGAN:</b>\n• /img compress : Kompres ukuran gambar\n• /img resize WxH : Ubah ukuran (contoh: 500x500)\n• /img to format : Format didukung jpg, png, jpeg, webp\n• /img rotate deg : Sudut didukung 90, 180, 270\n• /hapusbg : Hapus background (kuota 50/bulan)\n• /ss &lt;url&gt; : Screenshot website (kuota 50/bulan)\n\n<b>CATATAN REMOVE BG:</b>\nGratis hanya preview rendah (maks 0,25 MP).\n\n<b>BATASAN FILE FOTO:</b> Maks 5MB`;
}

function buildPdfToolsInfoTelegramBody() {
    return `Konversi, optimasi, rotasi, ekstrak, dan merge halaman PDF.\n\n<b>MODE 1 - KE PDF:</b>\n1. Balas/kirim dokumen atau media\n2. Kirim command:\n\n<pre>/topdf</pre>\n\n<b>MODE 2 - DARI PDF:</b>\nBalas/kirim file PDF, lalu gunakan:\n\n<pre>/pdf compress\n/pdf to format\n/pdf rotate deg\n/pdf extract 1-3,5</pre>\n\n<b>MODE 3 - MERGE BANYAK PDF:</b>\n<pre>/pdf merge start\n(kirim file PDF satu per satu)\n/pdf merge done\n/pdf merge cancel</pre>\n\n<b>KETERANGAN:</b>\n• /topdf : Konversi file ke PDF (CloudConvert)\n• /pdf compress : Kompres ukuran PDF (CloudConvert)\n• /pdf to format : Konversi PDF ke format lain (CloudConvert)\n• /pdf rotate deg : Rotasi semua halaman PDF (lokal)\n• /pdf extract pages : Ambil halaman tertentu (lokal)\n• /pdf merge start|done|cancel : Gabung banyak PDF (lokal)\n\n<b>CONTOH:</b>\n• <code>/pdf to docx</code>\n• <code>/pdf rotate 90</code>\n• <code>/pdf extract 1-3,5</code>\n• <code>/pdf merge start</code>\n\n<b>BATASAN:</b>\n• CloudConvert: max 10MB, kuota 10 request/hari\n• Proses lokal (rotate/extract/merge): max 15MB per file`;
}

async function handleUtilityCommand(command, args, userId, platform = 'telegram') {
    if (command === '/cuaca') {
        const { handleWeatherCommand } = require('../services/weatherService');
        return handleWeatherCommand(command, args, userId, platform);
    }

    if (command === '/sholat') {
        const { handleReligionCommand } = require('../services/religionService');
        return handleReligionCommand(command, args, userId, platform);
    }

    if (command === '/me') {
        const { handleAboutMeCommand } = require('../services/aboutService');
        return handleAboutMeCommand(command, args, userId, platform);
    }

    return 'Perintah tidak dikenali.';
}

async function sendUtilityCommandMessage(ctx, command, userId, args = []) {
    const replyText = await handleUtilityCommand(command, args, userId, 'telegram');
    const linksKeyboard = command === '/me' ? buildMonitorLinksKeyboard() : null;
    await sendTelegramReply(ctx, replyText, linksKeyboard || {});
}

function buildBookRecommendationMessage(keyword, books = []) {
    const safeKeyword = escapeHtml(String(keyword || '').trim());
    const lines = [`📚 REKOMENDASI BUKU: ${safeKeyword}`];

    books.slice(0, 5).forEach((book, index) => {
        lines.push('');
        lines.push(`${index + 1}. ${escapeHtml(String(book?.title || '-'))}`);
        lines.push(`   👤 Penulis: ${escapeHtml(String(book?.author || '-'))}`);
        lines.push(`   📅 Tahun: ${escapeHtml(String(book?.year || '-'))}`);
        lines.push(`   🔗 Link: ${escapeHtml(String(book?.url || 'https://openlibrary.org'))}`);
    });

    return lines.join('\n');
}

function buildJournalRecommendationMessage(keyword, journals = []) {
    const safeKeyword = escapeHtml(String(keyword || '').trim());
    const lines = [`🎓 REFERENSI JURNAL: ${safeKeyword}`];

    journals.slice(0, 5).forEach((item, index) => {
        lines.push('');
        lines.push(`${index + 1}. ${escapeHtml(String(item?.title || '-'))}`);
        lines.push(`   👤 Penulis: ${escapeHtml(String(item?.author || '-'))}`);
        lines.push(`   📚 Jurnal: ${escapeHtml(String(item?.journal || '-'))}`);
        lines.push(`   📅 Tahun: ${escapeHtml(String(item?.year || '-'))}`);
        lines.push(`   🔗 DOI: ${escapeHtml(String(item?.doiUrl || '-'))}`);
    });

    return lines.join('\n');
}

function buildArticleRecommendationMessage(keyword, articles = []) {
    const safeKeyword = escapeHtml(String(keyword || '').trim());
    const lines = [`📰 REFERENSI ARTIKEL: ${safeKeyword}`];

    articles.slice(0, 5).forEach((item, index) => {
        lines.push('');
        lines.push(`${index + 1}. ${escapeHtml(String(item?.title || '-'))}`);
        lines.push(`   👤 Penulis: ${escapeHtml(String(item?.author || '-'))}`);
        lines.push(`   📅 Tahun: ${escapeHtml(String(item?.year || '-'))}`);
        lines.push(`   🔗 Link: ${escapeHtml(String(item?.link || '-'))}`);
    });

    return lines.join('\n');
}

async function handleImageConverter(ctx, args) {
    let inputPath = null;
    let outputPath = null;

    try {
        const message = ctx.message;
        const photoSource = getTelegramPhotoSource(message);

        if (!photoSource) {
            await ctx.reply('<b>❌ ERROR CONVERTER</b>\n\nKirim foto dengan caption command /img atau balas foto untuk menggunakan converter.', { parse_mode: 'HTML' });
            return;
        }

        const fileId = photoSource.fileId;
        const fileSizeBytes = photoSource.fileSize;

        if (fileSizeBytes > MAX_FILE_SIZE) {
            await ctx.reply('<b>❌ Gagal</b>\n\nUkuran gambar maksimal 5MB!', { parse_mode: 'HTML' });
            return;
        }

        const timestamp = Date.now();
        const tempDir = await ensureTempDir();
        inputPath = path.join(tempDir, `input_${timestamp}.jpg`);
        outputPath = path.join(tempDir, `output_${timestamp}.jpg`);

        const file = await ctx.telegram.getFile(fileId);
        const fileLink = `https://api.telegram.org/file/bot${bot.token}/${file.file_path}`;

        const https = require('https');
        const fileData = await new Promise((resolve, reject) => {
            https.get(fileLink, (response) => {
                let data = Buffer.alloc(0);
                response.on('data', (chunk) => {
                    data = Buffer.concat([data, chunk]);
                });
                response.on('end', () => resolve(data));
                response.on('error', reject);
            }).on('error', reject);
        });

        await fs.writeFile(inputPath, fileData);

        const action = String(args[0] || '').toLowerCase().trim();
        if (action === 'to' && args[1]) {
            const format = String(args[1]).toLowerCase();
            const formatMap = { 'jpg': '.jpg', 'jpeg': '.jpg', 'png': '.png', 'webp': '.webp' };
            const newExt = formatMap[format] || '.jpg';
            outputPath = path.join(tempDir, `output_${timestamp}${newExt}`);
        }

        const resultMsg = await handleImgCommand(args, inputPath, outputPath, 'telegram');
        await ctx.reply(resultMsg, { parse_mode: 'HTML' });

        const outputExists = await fs.stat(outputPath).catch(() => null);
        if (outputExists) {
            const fileBuffer = await fs.readFile(outputPath);
            if (action === 'to') {
                await ctx.replyWithDocument(
                    { source: fileBuffer, filename: path.basename(outputPath) },
                    { caption: '✅ File hasil konversi siap!', parse_mode: 'HTML' }
                );
            } else {
                await ctx.replyWithPhoto({ source: fileBuffer }, { caption: '✅ Gambar siap!', parse_mode: 'HTML' });
            }
        }
    } catch (error) {
        console.error('Error in handleImageConverter:', error);
        await ctx.reply(`<b>❌ ERROR CONVERTER</b>\n\nGagal memproses gambar: ${escapeHtml(error.message)}`, { parse_mode: 'HTML' });
    } finally {
        if (inputPath) await fs.unlink(inputPath).catch(() => {});
        if (outputPath) await fs.unlink(outputPath).catch(() => {});
    }
}

async function handleTelegramPdfTools(ctx, command, args) {
    let inputPath = null;
    let outputPath = null;

    try {
        const isToPdf = command === '/topdf';
        const userId = ctx.from.id.toString();
        let mode = isToPdf ? 'topdf' : '';
        let outputFormat = 'pdf';
        let rotateAngle = 0;
        let extractPages = '';

        if (!isToPdf) {
            const action = String(args[0] || '').toLowerCase().trim();

            if (action === 'merge') {
                const mergeAction = String(args[1] || '').toLowerCase().trim();

                if (mergeAction === 'start') {
                    const previousFiles = mergeSessions[userId] || [];
                    for (const filePath of previousFiles) {
                        safeUnlinkSync(filePath);
                    }

                    mergeSessions[userId] = [];
                    await ctx.reply('✅ Mode Merge Aktif! Kirim file PDF satu per satu. Ketik /pdf merge done jika sudah semua, atau /pdf merge cancel untuk batal.');
                    return;
                }

                if (mergeAction === 'cancel') {
                    const sessionFiles = mergeSessions[userId] || [];
                    for (const filePath of sessionFiles) {
                        safeUnlinkSync(filePath);
                    }
                    delete mergeSessions[userId];
                    await ctx.reply('❌ Merge dibatalkan. Semua file sesi dihapus.');
                    return;
                }

                if (mergeAction === 'done') {
                    const sessionFiles = mergeSessions[userId];
                    if (!Array.isArray(sessionFiles) || sessionFiles.length < 2) {
                        await ctx.reply('❌ Minimal butuh 2 file PDF!');
                        return;
                    }

                    const filesToMerge = [...sessionFiles];
                    const tempDir = await ensureTempDir();
                    outputPath = path.join(tempDir, `merged_${Date.now()}.pdf`);

                    try {
                        await mergePdfs(filesToMerge, outputPath);
                        await ctx.replyWithDocument(
                            { source: outputPath, filename: path.basename(outputPath) },
                            { caption: '<b>✅ PDF MERGE BERHASIL</b>\n\nSemua file PDF berhasil digabung.', parse_mode: 'HTML' }
                        );
                    } finally {
                        for (const filePath of filesToMerge) {
                            safeUnlinkSync(filePath);
                        }
                        safeUnlinkSync(outputPath);
                        delete mergeSessions[userId];
                    }

                    return;
                }

                await ctx.reply(
                    '<b>❌ Format Salah</b>\n\nGunakan:\n<code>/pdf merge start</code>\n<code>/pdf merge done</code>\n<code>/pdf merge cancel</code>',
                    { parse_mode: 'HTML' }
                );
                return;
            }

            if (action === 'compress') {
                mode = 'compress';
                outputFormat = 'pdf';
            } else if (action === 'to' && args[1]) {
                mode = 'to';
                outputFormat = String(args[1] || '').replace(/^\./, '').toLowerCase();
            } else if (action === 'rotate' && args[1]) {
                mode = 'rotate';
                outputFormat = 'pdf';
                rotateAngle = parseInt(args[1], 10);
                if (!Number.isInteger(rotateAngle)) {
                    await ctx.reply('<b>❌ Format Salah</b>\n\nContoh rotasi: <code>/pdf rotate 90</code>', { parse_mode: 'HTML' });
                    return;
                }
            } else if (action === 'extract' && args.length > 1) {
                mode = 'extract';
                outputFormat = 'pdf';
                extractPages = args.slice(1).join(' ').trim();
                if (!extractPages) {
                    await ctx.reply('<b>❌ Format Salah</b>\n\nContoh extract: <code>/pdf extract 1-3,5</code>', { parse_mode: 'HTML' });
                    return;
                }
            } else {
                await ctx.reply(
                    '<b>❌ Format Salah</b>\n\nGunakan:\n<code>/pdf compress</code>\n<code>/pdf to &lt;format&gt;</code>\n<code>/pdf rotate &lt;deg&gt;</code>\n<code>/pdf extract &lt;halaman&gt;</code>\n<code>/pdf merge start|done|cancel</code>',
                    { parse_mode: 'HTML' }
                );
                return;
            }
        }

        const candidates = [ctx.message, ctx.message?.reply_to_message].filter(Boolean);
        let source = null;

        for (const candidate of candidates) {
            if (candidate.document) {
                const extFromName = getExtensionFromFileName(candidate.document.file_name);
                const extFromMime = getExtensionFromMimeType(candidate.document.mime_type);
                source = {
                    fileId: candidate.document.file_id,
                    fileSize: Number(candidate.document.file_size || 0),
                    inputExt: extFromName || extFromMime || 'bin',
                    mimeType: String(candidate.document.mime_type || '')
                };
                break;
            }

            if (isToPdf && Array.isArray(candidate.photo) && candidate.photo.length > 0) {
                const largestPhoto = candidate.photo[candidate.photo.length - 1];
                source = {
                    fileId: largestPhoto.file_id,
                    fileSize: Number(largestPhoto.file_size || 0),
                    inputExt: 'jpg',
                    mimeType: 'image/jpeg'
                };
                break;
            }

            if (isToPdf && candidate.video) {
                source = {
                    fileId: candidate.video.file_id,
                    fileSize: Number(candidate.video.file_size || 0),
                    inputExt: getExtensionFromMimeType(candidate.video.mime_type) || 'mp4',
                    mimeType: String(candidate.video.mime_type || '')
                };
                break;
            }
        }

        if (!source) {
            const usage = isToPdf
                ? 'Balas atau kirim dokumen/media lalu gunakan <code>/topdf</code>.'
                : 'Balas atau kirim file PDF lalu gunakan <code>/pdf compress</code> atau <code>/pdf to &lt;format&gt;</code>.';
            await ctx.reply(`<b>❌ File Tidak Ditemukan</b>\n\n${usage}`, { parse_mode: 'HTML' });
            return;
        }

        const isLocalPdfProcess = mode === 'rotate' || mode === 'extract';
        const maxPdfSize = isLocalPdfProcess ? MAX_PDF_LOCAL_INPUT_SIZE : MAX_PDF_INPUT_SIZE;
        if (source.fileSize > maxPdfSize) {
            const maxLabel = isLocalPdfProcess ? '15MB' : '10MB';
            await ctx.reply(`<b>❌ Gagal: Ukuran file maksimal ${maxLabel}!</b>`, { parse_mode: 'HTML' });
            return;
        }

        const inputExt = String(source.inputExt || '').toLowerCase();
        const isPdfInput = inputExt === 'pdf' || source.mimeType.toLowerCase().includes('pdf');

        if (!isToPdf && !isPdfInput) {
            await ctx.reply('<b>❌ Format Salah</b>\n\nCommand <code>/pdf</code> hanya untuk file PDF.', { parse_mode: 'HTML' });
            return;
        }

        const timestamp = Date.now();
        const tempDir = await ensureTempDir();
        inputPath = path.join(tempDir, `input_${timestamp}.${inputExt || 'bin'}`);
        outputPath = path.join(tempDir, `output_${timestamp}.${outputFormat}`);

        const file = await ctx.telegram.getFile(source.fileId);
        const fileLink = `https://api.telegram.org/file/bot${bot.token}/${file.file_path}`;

        const https = require('https');
        const fileData = await new Promise((resolve, reject) => {
            https.get(fileLink, (response) => {
                const chunks = [];
                response.on('data', (chunk) => chunks.push(chunk));
                response.on('end', () => resolve(Buffer.concat(chunks)));
                response.on('error', reject);
            }).on('error', reject);
        });

        await fs.writeFile(inputPath, fileData);

        if (isToPdf) {
            await convertToPdf(inputPath, outputPath, inputExt);
        } else if (mode === 'compress') {
            await compressPdf(inputPath, outputPath);
        } else if (mode === 'rotate') {
            await rotatePdf(inputPath, outputPath, rotateAngle);
        } else if (mode === 'extract') {
            await extractPdf(inputPath, outputPath, extractPages);
        } else {
            await convertFromPdf(inputPath, outputPath, outputFormat);
        }

        const caption = isToPdf
            ? '<b>✅ TOPDF BERHASIL</b>\n\nFile berhasil dikonversi ke PDF.'
            : mode === 'compress'
                ? '<b>✅ PDF COMPRESS BERHASIL</b>\n\nFile PDF berhasil dikompres.'
                : mode === 'rotate'
                    ? `<b>✅ PDF ROTATE BERHASIL</b>\n\nSemua halaman diputar <code>${escapeHtml(String(rotateAngle))}</code> derajat.`
                    : mode === 'extract'
                        ? `<b>✅ PDF EXTRACT BERHASIL</b>\n\nHalaman terpilih: <code>${escapeHtml(extractPages)}</code>.`
                : `<b>✅ PDF CONVERT BERHASIL</b>\n\nFile PDF berhasil dikonversi ke <code>${escapeHtml(outputFormat)}</code>.`;

        await ctx.replyWithDocument(
            { source: outputPath, filename: path.basename(outputPath) },
            { caption, parse_mode: 'HTML' }
        );
    } catch (error) {
        console.error('Error in PDF tools Telegram handler:', error);
        await ctx.reply(`<b>ERROR PDF TOOLS</b> ❌\n\n${escapeHtml(error.message)}`, { parse_mode: 'HTML' });
    } finally {
        safeUnlinkSync(inputPath);
        safeUnlinkSync(outputPath);
    }
}

function formatBodyBold(htmlText) {
    const lines = String(htmlText || '').split('\n');
    const firstContentLineIndex = lines.findIndex((line) => line.trim().length > 0);

    if (firstContentLineIndex === -1) {
        return '';
    }

    const isBoxLine = (line) => /^[┌├└]\s/.test(line.trim());
    const alreadyBold = (line) => {
        const trimmed = line.trim();
        return trimmed.startsWith('<b>') && trimmed.endsWith('</b>');
    };
    const makeBold = (line) => (alreadyBold(line) ? line : `<b>${line}</b>`);

    const bodyBoxIndexes = [];
    for (let i = firstContentLineIndex + 1; i < lines.length; i += 1) {
        if (isBoxLine(lines[i])) {
            bodyBoxIndexes.push(i);
        }
    }

    const hasBodyBox = bodyBoxIndexes.length > 0;
    const lastBodyBoxIndex = hasBodyBox ? bodyBoxIndexes[bodyBoxIndexes.length - 1] : -1;

    const firstFooterLineIndex = hasBodyBox
        ? lines.findIndex((line, index) => index > lastBodyBoxIndex && line.trim().length > 0)
        : -1;

    const formatted = [];
    for (let i = 0; i < lines.length; i += 1) {
        const line = lines[i];
        const trimmed = line.trim();

        if (!trimmed) {
            formatted.push(line);
            continue;
        }

        if (i === firstContentLineIndex) {
            formatted.push(makeBold(line));
            continue;
        }

        if (isBoxLine(line)) {
            formatted.push(makeBold(line));
            continue;
        }

        if (i === firstFooterLineIndex && hasBodyBox) {
            if (formatted.length > 0 && String(formatted[formatted.length - 1]).trim().length > 0) {
                formatted.push('');
            }
            formatted.push('—'.repeat(19));
        }

        formatted.push(line);
    }

    return formatted.join('\n');
}

async function sendTelegramReply(ctx, payload, extra = {}) {
    if (payload && typeof payload === 'object' && payload.type === 'image') {
        const caption = formatTelegramHtml(payload.caption || '');
        const processedCaption = caption ? formatBodyBold(caption) : '';
        await ctx.replyWithPhoto(payload.url, {
            caption: processedCaption,
            parse_mode: 'HTML',
            ...extra
        });
        return;
    }

    const rawText = typeof payload === 'string' ? payload : String(payload || '');
    const formattedText = formatTelegramHtml(rawText);
    const finalText = formatBodyBold(formattedText);
    await ctx.reply(finalText, { parse_mode: 'HTML', ...extra });
}

async function sendHistoryPageMessage(ctx, userId, page = 1, useEdit = false) {
    const result = await getHistoryPage(userId, page, HISTORY_PAGE_SIZE);
    const html = formatTelegramHtml(result.text);
    const finalHtml = formatBodyBold(html);
    const replyMarkup = buildHistoryKeyboard(result.page, result.hasPrev, result.hasNext).reply_markup;

    if (useEdit) {
        try {
            await ctx.editMessageText(finalHtml, { parse_mode: 'HTML', reply_markup: replyMarkup });
            return;
        } catch (error) {
            console.error('Error editing history message in Telegram:', error);
        }
    }

    await ctx.reply(finalHtml, { parse_mode: 'HTML', reply_markup: replyMarkup });
}

async function processMenuCommand(ctx, command, userId) {
    switch (command) {
        case '/start': {
            const welcomeHeader = '<b>SELAMAT DATANG DI FUENZER BOT</b> 🤖';
            const welcomeBody = `Halo <b>${escapeHtml(ctx.from.first_name || 'Pengguna')}</b>! Saya asisten virtual pribadi.\n\nGunakan tombol di bawah untuk akses cepat fitur keuangan.`;
            await ctx.reply(`${welcomeHeader}\n\n${welcomeBody}`, {
                parse_mode: 'HTML',
                ...buildMainMenuKeyboard()
            });
            return;
        }
        case '/info': {
            const header = '<b>INFORMASI FUENZER BOT</b> 🤖';
            const body = `Saya adalah asisten virtual pribadi milik <b>Ridwan Yoga Suryantara</b>.\n\n<b>LAYANAN CS & FEEDBACK</b> 🆘\n• /help : Pusat Bantuan & Feedback\n\n<b>DUKUNGAN BOT</b> ☕\n• /donate : Link dukungan + QR donasi\n\n<b>FITUR KEUANGAN</b> 💰\n• /finance_info : Panduan Lengkap command keuangan\n\n<b>FITUR SISTEM</b> ⚙️\n• /ping : Cek status bot\n• /info : Menampilkan pesan ini\n• /start : Memulai bot\n\n<b>FITUR AI</b> 🧠\nKirim pesan biasa (tanpa awalan /) untuk ngobrol, tanya coding, atau diskusi teknologi.\n<i>(Support deteksi file: Gambar / Audio VN / Dokumen Teks)</i>\n• /model_info : Daftar model AI yang tersedia\n• /switch : Ganti model AI aktif\n\n<b>FITUR TRANSLATE</b> 🌍\n• /translate_info : Panduan Lengkap terjemah kata/kalimat\n\n<b>FITUR UTILITAS</b> 🛠️\n• /short : Pendekkan URL dengan is.gd\n• /research_info : Panduan Lengkap Referensi (buku/jurnal/artikel)\n• /downloader : Panduan Lengkap download (/download & /audio)\n• /remind_info : Panduan Lengkap fitur Reminder pengingat\n• /cuaca : Info cuaca hari ini\n• /sholat : Jadwal sholat hari ini\n• /me : Tentang pembuat bot\n\n<b>FITUR CONVERTER</b> 🖼️\n• /img_info : Panduan Lengkap image tools\n• /pdf_info : Panduan Lengkap PDF tools\n\n<b>FITUR STICKER</b> 🧩\n• /sticker_info : Panduan Lengkap sticker tools\n\n<b>FITUR ADMIN</b> 🛡️\n• /admin : Menu command admin`;
            const message = `${header}\n\n${body}\n\n${buildSystemStatsFooter()}`;
            await ctx.reply(message, {
                parse_mode: 'HTML',
                ...buildMainMenuKeyboard()
            });
            return;
        }

        case '/help': {
            const header = '<b>Pusat Bantuan & Feedback</b> 🆘';
            const body = `Jika kamu menemukan bug atau punya pertanyaan seputar fitur bot, gunakan fitur CS ini:\n\n1. <code>/feedback [pesan]</code> : Berikan saran, kritik, atau laporan bug ke tim Fuenzer.\n2. <code>/ask [pesan]</code> : Tanyakan apa saja ke Admin terkait operasional bot.\n\nContoh:\n<code>/feedback Fitur translate error saat menerjemahkan ke bahasa Korea</code>\n<code>/ask Bagaimana cara upgrade kuota premium?</code>`;
            await ctx.reply(`${header}\n\n${body}`, { parse_mode: 'HTML' });
            return;
        }

        case '/translate_info': {
            const header = '<b>TRANSLATE TOOLS</b> 🌍';
            const body = `Panduan menggunakan fitur terjemahan AI.\n\n<b>COMMAND INTI:</b>\n• <code>/translate &lt;kode_bahasa&gt; &lt;teks&gt;</code>\n• Atau <b>reply</b> pesan yang ingin diterjemahkan dengan <code>/translate &lt;kode_bahasa&gt;</code>\n\n<b>DAFTAR KODE BAHASA (Ketikkan 2 huruf ini):</b>\n• <code>en</code> : English (Inggris)\n• <code>id</code> : Indonesia\n• <code>jv</code> : Javanese (Jawa)\n• <code>su</code> : Sundanese (Sunda)\n• <code>ms</code> : Malay (Melayu)\n• <code>ar</code> : Arabic (Arab)\n• <code>ja</code> : Japanese (Jepang)\n• <code>ko</code> : Korean (Korea)\n• <code>zh</code> : Chinese (Mandarin)\n• <code>hi</code> : Hindi (India)\n• <code>ru</code> : Russian (Rusia)\n• <code>es</code> : Spanish (Spanyol)\n• <code>fr</code> : French (Perancis)\n• <code>de</code> : German (Jerman)\n• <code>it</code> : Italian (Italia)\n• <code>nl</code> : Dutch (Belanda)\n• <code>pt</code> : Portuguese (Portugis)\n• <code>th</code> : Thai (Thailand)\n• <code>vi</code> : Vietnamese (Vietnam)\n\n<b>CONTOH CEPAT:</b>\n• <code>/translate en Halo dunia, apa kabar?</code>\n• <code>/translate ar Selamat pagi</code>\n\n<b>TIPS:</b>\n• AI otomatis mendeteksi bahasa asli dari teks yang Anda berikan, Anda hanya perlu menentukan bahasa tujuannya.`;
            await ctx.reply(`${header}\n\n${body}`, { parse_mode: 'HTML' });
            return;
        }

        case '/research_info': {
            const header = '<b>RESEARCH TOOLS</b> 📚';
            const body = `Panduan Lengkap fitur riset Referensi buku, jurnal, dan artikel ilmiah.\n\n<b>COMMAND INTI:</b>\n• /buku &lt;keyword&gt; : Cari rekomendasi buku dari Open Library\n• /jurnal &lt;keyword&gt; : Cari referensi jurnal/artikel ilmiah dari Crossref\n• /artikel &lt;keyword&gt; : Cari artikel ilmiah dari OpenAlex\n\n<b>CONTOH CEPAT:</b>\n• <code>/buku atomic habits</code>\n• <code>/jurnal machine learning</code>\n• <code>/artikel deep learning healthcare</code>\n\n<b>OUTPUT /buku:</b>\n• Judul buku\n• Nama penulis\n• Tahun terbit pertama\n• Link Open Library\n\n<b>OUTPUT /jurnal:</b>\n• Judul artikel/jurnal\n• Nama penulis\n• Nama jurnal\n• Tahun terbit\n• Link DOI\n\n<b>OUTPUT /artikel:</b>\n• Judul artikel\n• Penulis (maks. 3 nama)\n• Tahun\n• Link PDF open access (jika tersedia) atau halaman artikel\n\n<b>TIPS:</b>\n• /jurnal bisa dipakai juga untuk cari artikel ilmiah berbasis kata kunci\n• Pakai kata kunci spesifik agar hasil lebih relevan\n• Jika hasil kurang pas, coba variasi bahasa Inggris/Indonesia`;
            await ctx.reply(`${header}\n\n${body}`, { parse_mode: 'HTML' });
            return;
        }
        case '/downloader': {
            const header = '<b>DOWNLOADER TOOLS</b> ⬇️';
            const body = `Panduan Lengkap untuk download media dan audio.\n\n<b>COMMAND DOWNLOAD:</b>\n• /download &lt;url&gt; : Download media sosial (video/foto)\n• /audio &lt;url&gt; : Download audio dari YouTube/YouTube Music\n\n<b>CONTOH CEPAT:</b>\n• <code>/download https://www.instagram.com/reel/xxxx</code>\n• <code>/audio https://www.youtube.com/watch?v=xxxx</code>\n\n<b>SUPPORT PLATFORM:</b>\n• /download hanya support: Instagram, Twitter/X, YouTube, dan TikTok\n• /audio hanya support: YouTube dan YouTube Music\n\n<b>CATATAN:</b>\n• Jika media terlalu besar atau sumber menolak koneksi, coba ulang beberapa saat lagi`;
            await ctx.reply(`${header}\n\n${body}`, { parse_mode: 'HTML' });
            return;
        }
        case '/remind_info': {
            const header = '<b>REMINDER TOOLS</b> ⏰';
            const body = `Panduan lengkap fitur pengingat (Reminder) Fuenzer Bot.\n\n<b>COMMAND INTI:</b>\n• /remind add &lt;waktu&gt; &lt;pesan&gt; : Buat pengingat sekali jalan\n• /remind loop &lt;waktu&gt; &lt;pesan&gt; : Buat pengingat berulang\n• /remind list : Tampilkan semua pengingat yang aktif\n• /remind hapus &lt;id&gt; : Hapus pengingat berdasarkan ID\n• /remind edit &lt;id&gt; &lt;waktu&gt; &lt;pesan&gt; : Edit pengingat\n\n<b>FORMAT WAKTU (Support Ms):</b>\n• Detik: <code>5s</code>, <code>30s</code>, <code>60s</code>\n• Menit: <code>1m</code>, <code>15m</code>, <code>30m</code>\n• Jam: <code>1h</code>, <code>2h</code>, <code>12h</code>\n• Hari: <code>1d</code>, <code>2d</code>, <code>7d</code>\n\n<b>CONTOH CEPAT:</b>\n• <code>/remind add 15m angkat jemuran</code>\n• <code>/remind loop 1d minum vitamin pagi</code>\n• <code>/remind edit A1B2C 2h minum vitamin siang</code>\n• <code>/remind hapus A1B2C</code>\n\n<b>TIPS:</b>\n• Gunakan <code>/remind list</code> untuk melihat ID unik dari pengingat.\n• Pengingat berulang akan selalu berjalan dengan interval yang telah ditentukan kecuali dihapus.`;
            await ctx.reply(`${header}\n\n${body}`, { parse_mode: 'HTML' });
            return;
        }
        case '/donate': {
            const donateText = buildDonateMessage('telegram');
            const { koFi, saweria } = getDonateQrImagePaths();

            await ctx.reply(donateText, { parse_mode: 'HTML' });
            await ctx.replyWithPhoto({ source: koFi }, { caption: '🌍 QR Donasi Ko-fi' });
            await ctx.replyWithPhoto({ source: saweria }, { caption: '🇮🇩 QR Donasi Saweria' });
            return;
        }
        case '/finance_info': {
            const header = '<b>FINANCE TOOLS</b> 💰';
            const body = `Panduan lengkap fitur keuangan Fuenzer Bot.\n\n<b>COMMAND INTI:</b>\n• /saldo : Lihat ringkasan saldo terbaru\n• /catat &lt;nominal&gt; &lt;keterangan&gt; : Catat pengeluaran\n• /pemasukan &lt;nominal&gt; &lt;keterangan&gt; : Catat pemasukan\n• /laporan_chart : Tampilkan grafik laporan\n• /riwayat [halaman] : Riwayat transaksi (paging 5 data)\n• /edit &lt;id&gt; &lt;field&gt; &lt;nilai&gt; : Ubah transaksi\n• /hapus &lt;id&gt; : Hapus transaksi (dengan konfirmasi)\n\n<b>CONTOH CEPAT:</b>\n• <code>/catat 25000 makan siang</code>\n• <code>/pemasukan 150000 freelance logo</code>\n• <code>/riwayat 2</code>\n• <code>/edit 123e4567 nominal 30000</code>\n• <code>/hapus 123e4567</code>\n\n<b>TIPS:</b>\n• Gunakan /riwayat untuk ambil ID transaksi sebelum /edit atau /hapus\n• Tulisan nominal tanpa titik/koma agar lebih aman diproses`;
            await ctx.reply(`${header}\n\n${body}`, { parse_mode: 'HTML' });
            return;
        }
        case '/ping':
            await ctx.reply(`Pong! 🏓\n\n${buildSystemStatsFooter()}`);
            return;
        case '/saldo':
        case '/catat':
        case '/pemasukan':
        case '/laporan_chart':
        case '/edit': {
            const parts = ctx.message?.text?.trim()?.split(' ') || [command];
            const args = parts.slice(1);
            const replyPayload = await handleFinanceCommand(command, args, userId, 'telegram');
            await sendTelegramReply(ctx, replyPayload);
            return;
        }
        case '/cuaca':
        case '/sholat':
        case '/me': {
            const parts = ctx.message?.text?.trim()?.split(' ') || [command];
            const args = parts.slice(1);
            await sendUtilityCommandMessage(ctx, command, userId, args);
            return;
        }
        case '/model_info': {
            await ctx.reply(buildModelInfoMessage('telegram'), { parse_mode: 'HTML' });
            return;
        }
        case '/switch': {
            const alias = String(args[0] || '').trim().toLowerCase();

            if (!alias) {
                await ctx.reply('❌ Ketik alias modelnya! Contoh: /switch elephant. Cek /model_info.');
                return;
            }

            if (!AI_MODELS[alias]) {
                const knownAliases = Object.keys(AI_MODELS).join(', ');
                await ctx.reply(`❌ Alias model tidak ditemukan. Alias tersedia: ${knownAliases}. Cek /model_info.`);
                return;
            }

            await setActiveModel(userId, 'telegram', alias);
            await ctx.reply(`✅ Berhasil! Otak AI kamu sekarang menggunakan ${AI_MODELS[alias].name}.`);
            return;
        }
        case '/riwayat':
            await sendHistoryPageMessage(ctx, userId, 1, false);
            return;
        case '/img_info': {
            const header = '<b>IMAGE TOOLS</b> 🖼️';
            const body = buildImageToolsInfoTelegramBody();
            const footer = await buildImageToolsQuotaFooter();
            const message = appendFooter(`${header}\n\n${body}`, footer);
            await ctx.reply(message, { parse_mode: 'HTML' });
            return;
        }
        case '/pdf_info': {
            const header = '<b>PDF TOOLS</b> 📄';
            const body = buildPdfToolsInfoTelegramBody();
            const footer = await buildPdfToolsQuotaFooter();
            const message = appendFooter(`${header}\n\n${body}`, footer);
            await ctx.reply(message, { parse_mode: 'HTML' });
            return;
        }
        case '/sticker_info': {
            const header = '<b>STICKER TOOLS</b> 🧩';
            const body = 'Panduan Lengkap sticker tools.\n\n/tosticker : Ubah gambar/video (max 5 dtk) jadi stiker.';
            await ctx.reply(`${header}\n\n${body}`, { parse_mode: 'HTML' });
            return;
        }
        default:
            return;
    }
}

function setupTelegramBot() {
    // Event listener for text/caption messages
    bot.on('message', async (ctx) => {
        let text = ctx.message?.text || ctx.message?.caption || '';
        const userId = ctx.from.id.toString();
        const hasPdfDocument = isTelegramPdfDocument(ctx.message?.document);
        const hasActiveMergeSession = Array.isArray(mergeSessions[userId]);
        const isGroup = ctx.chat.type === 'group' || ctx.chat.type === 'supergroup';
        const botUsername = process.env.TELEGRAM_BOT_USERNAME;
        const isMentioned = botUsername && text.includes(`@${botUsername}`);

        // Di dalam grup, bot HANYA merespon jika di-mention (tag).
        // Abaikan semua pesan (termasuk command) jika tidak ada mention.
        if (isGroup && !isMentioned && !(hasActiveMergeSession && hasPdfDocument)) {
            return;
        }

        if (hasPdfDocument && hasActiveMergeSession) {
            let downloadPath = null;

            try {
                const document = ctx.message.document;
                const fileSize = Number(document.file_size || 0);
                if (fileSize > MAX_PDF_LOCAL_INPUT_SIZE) {
                    await ctx.reply('<b>❌ Gagal</b>\n\nUkuran file maksimal 15MB per PDF untuk merge.', { parse_mode: 'HTML' });
                    return;
                }

                const timestamp = Date.now();
                const tempDir = await ensureTempDir();
                const nextIndex = mergeSessions[userId].length + 1;
                downloadPath = path.join(tempDir, `input_merge_${timestamp}_${nextIndex}.pdf`);

                const file = await ctx.telegram.getFile(document.file_id);
                const fileLink = `https://api.telegram.org/file/bot${bot.token}/${file.file_path}`;

                const https = require('https');
                const fileData = await new Promise((resolve, reject) => {
                    https.get(fileLink, (response) => {
                        const chunks = [];
                        response.on('data', (chunk) => chunks.push(chunk));
                        response.on('end', () => resolve(Buffer.concat(chunks)));
                        response.on('error', reject);
                    }).on('error', reject);
                });

                await fs.writeFile(downloadPath, fileData);
                mergeSessions[userId].push(downloadPath);

                await ctx.reply(`📄 File ke-${mergeSessions[userId].length} diterima! Kirim lagi atau ketik /pdf merge done.`);
            } catch (error) {
                safeUnlinkSync(downloadPath);
                console.error('Error saat menerima file merge PDF Telegram:', error);
                await ctx.reply(`<b>ERROR PDF MERGE</b> ❌\n\n${escapeHtml(error.message)}`, { parse_mode: 'HTML' });
            }

            return;
        }

        text = sanitizeTelegramIncomingText(text);
        if (!text) {
            return;
        }
        
        // Handle commands
        if (text.startsWith('/')) {
            const parts = text.split(' ');
            const command = parts[0].toLowerCase();
            const args = parts.slice(1);

            await logCommand(userId, 'telegram', command);
            
            switch (command) {
                case '/start':
                    await processMenuCommand(ctx, '/start', userId);
                    break;
                    
                case '/ping':
                    await processMenuCommand(ctx, '/ping', userId);
                    break;
                    
                case '/info':
                    await processMenuCommand(ctx, '/info', userId);
                    break;

                case '/donate':
                    try {
                        await processMenuCommand(ctx, '/donate', userId);
                    } catch (error) {
                        console.error('Error handling /donate command in Telegram:', error);
                        await ctx.reply(`<b>ERROR DONATE</b> ❌\n\n${escapeHtml(error.message)}`, { parse_mode: 'HTML' });
                    }
                    break;

                case '/finance_info':
                    await processMenuCommand(ctx, '/finance_info', userId);
                    break;

                case '/research_info':
                    await processMenuCommand(ctx, '/research_info', userId);
                    break;

                case '/downloader':
                    await processMenuCommand(ctx, '/downloader', userId);
                    break;
                    
                case '/remind_info':
                    await processMenuCommand(ctx, '/remind_info', userId);
                    break;
                    
                case '/remind':
                    try {
                        const remindReply = await handleReminderCommand(args, userId, 'telegram');
                        await sendTelegramReply(ctx, remindReply);
                    } catch (error) {
                        await ctx.reply(`<b>ERROR</b> ❌\n\n${escapeHtml(error.message)}`, { parse_mode: 'HTML' });
                    }
                    break;
                    
                case '/translate':
                    const lang = args[0];
                    const optionalText = args.slice(1).join(' ');
                    let targetText = optionalText;

                    if (ctx.message.reply_to_message) {
                        const replyMsg = ctx.message.reply_to_message;
                        targetText = replyMsg.text || replyMsg.caption || targetText;
                    }

                    if (!lang || !targetText || !targetText.trim()) {
                        await ctx.reply(`<b>FORMAT SALAH</b> ❌\n\nGunakan: <code>/translate [kode_bahasa] [teks]</code>\nAtau reply pesan dengan <code>/translate [kode_bahasa]</code>.\n\nContoh: <code>/translate en Halo dunia</code>`, { parse_mode: 'HTML' });
                        break;
                    }

                    const translatingMsg = await ctx.reply('⏳ Sedang menerjemahkan, mohon tunggu...');

                    try {
                        const translatedText = await translateText(lang, targetText);
                        await ctx.telegram.editMessageText(
                            ctx.chat.id,
                            translatingMsg.message_id,
                            null,
                            `Terjemahan ke ${lang}:\n${translatedText}`
                        );
                    } catch (err) {
                        console.error('Error in /translate:', err);
                        await ctx.telegram.editMessageText(
                            ctx.chat.id,
                            translatingMsg.message_id,
                            null,
                            `<b>GAGAL MENERJEMAHKAN</b> ❌\n\nMaaf, terjadi kesalahan: ${escapeHtml(err.message)}`,
                            { parse_mode: 'HTML' }
                        );
                    }
                    break;

                case '/saldo':
                case '/catat':
                case '/pemasukan':
                case '/laporan_chart':
                case '/edit':
                    try {
                        const replyText = await handleFinanceCommand(command, args, userId, 'telegram');
                        await sendTelegramReply(ctx, replyText);
                    } catch (error) {
                        console.error('Error handling finance command in Telegram:', error);
                        const errorHeader = '<b>ERROR SISTEM</b> ❌';
                        const errorBody = `Terjadi kesalahan saat memproses perintah: ${escapeHtml(error.message)}`;
                        await ctx.reply(`${errorHeader}\n\n${errorBody}`, { parse_mode: 'HTML' });
                    }
                    break;

                case '/riwayat':
                    try {
                        const requestedPage = args.length > 0 ? parseInt(args[0], 10) : 1;
                        await sendHistoryPageMessage(ctx, userId, Number.isInteger(requestedPage) && requestedPage > 0 ? requestedPage : 1, false);
                    } catch (error) {
                        console.error('Error handling riwayat command in Telegram:', error);
                        await ctx.reply('<b>ERROR RIWAYAT</b> ❌\n\nGagal menampilkan riwayat transaksi.', { parse_mode: 'HTML' });
                    }
                    break;

                case '/cuaca':
                case '/sholat':
                case '/me': {
                    try {
                        await sendUtilityCommandMessage(ctx, command, userId, args);
                    } catch (error) {
                        console.error(`Error handling ${command} command in Telegram:`, error);
                        const errorHeader = '<b>ERROR SISTEM</b> ❌';
                        const errorBody = `Terjadi kesalahan saat memproses perintah: ${escapeHtml(error.message)}`;
                        await ctx.reply(`${errorHeader}\n\n${errorBody}`, { parse_mode: 'HTML' });
                    }
                    break;
                }

                case '/model_info': {
                    try {
                        await ctx.reply(buildModelInfoMessage('telegram'), { parse_mode: 'HTML' });
                    } catch (error) {
                        console.error('Error handling /model_info command in Telegram:', error);
                        const errorHeader = '<b>ERROR SISTEM</b> ❌';
                        const errorBody = `Terjadi kesalahan saat memproses perintah: ${escapeHtml(error.message)}`;
                        await ctx.reply(`${errorHeader}\n\n${errorBody}`, { parse_mode: 'HTML' });
                    }
                    break;
                }

                case '/switch': {
                    try {
                        const alias = String(args[0] || '').trim().toLowerCase();

                        if (!alias) {
                            await ctx.reply('❌ Ketik alias modelnya! Contoh: /switch elephant. Cek /model_info.');
                            break;
                        }

                        if (!AI_MODELS[alias]) {
                            const knownAliases = Object.keys(AI_MODELS).join(', ');
                            await ctx.reply(`❌ Alias model tidak ditemukan. Alias tersedia: ${knownAliases}. Cek /model_info.`);
                            break;
                        }

                        await setActiveModel(userId, 'telegram', alias);
                        await ctx.reply(`✅ Berhasil! Otak AI kamu sekarang menggunakan ${AI_MODELS[alias].name}.`);
                    } catch (error) {
                        console.error('Error handling /switch command in Telegram:', error);
                        const errorHeader = '<b>ERROR SISTEM</b> ❌';
                        const errorBody = `Terjadi kesalahan saat memproses perintah: ${escapeHtml(error.message)}`;
                        await ctx.reply(`${errorHeader}\n\n${errorBody}`, { parse_mode: 'HTML' });
                    }
                    break;
                }

                case '/admin': {
                    try {
                        if (!isAdmin(userId, 'telegram')) {
                            await ctx.reply('<b>AKSES DITOLAK</b> ❌\n\nCommand ini khusus admin.', { parse_mode: 'HTML' });
                            break;
                        }

                        const replyText = await handleAdminCommand('/admin', args, userId, 'telegram');
                        await sendTelegramReply(ctx, replyText, buildAdminMenuKeyboard());
                    } catch (error) {
                        console.error(`Error handling ${command} command in Telegram:`, error);
                        const errorHeader = '<b>ERROR SISTEM</b> ❌';
                        const errorBody = `Terjadi kesalahan saat memproses perintah: ${escapeHtml(error.message)}`;
                        await ctx.reply(`${errorHeader}\n\n${errorBody}`, { parse_mode: 'HTML' });
                    }
                    break;
                }

                case '/help':
                    await processMenuCommand(ctx, '/help', userId);
                    break;

                case '/feedback': {
                    const pesan = args.join(' ').trim();
                    if (!pesan) {
                        await ctx.reply('Silakan tuliskan pesan feedback setelah command.\nContoh: <code>/feedback bot ini sangat membantu!</code>', { parse_mode: 'HTML' });
                        break;
                    }
                    const { sendToSheet } = require('../services/csService');
                    await sendToSheet('FEEDBACK', userId, pesan);
                    await ctx.reply('✅ Terima kasih! Feedback kamu telah masuk ke sistem Fuenzer Studio.', { parse_mode: 'HTML' });
                    break;
                }

                case '/ask': {
                    const pesan = args.join(' ').trim();
                    if (!pesan) {
                        await ctx.reply('Silakan tuliskan pertanyaan setelah command.\nContoh: <code>/ask kapan fitur baru rilis?</code>', { parse_mode: 'HTML' });
                        break;
                    }
                    const { sendToSheet } = require('../services/csService');
                    await sendToSheet('ASK', userId, pesan);
                    await ctx.reply('✅ Pertanyaan kamu telah dikirim ke Admin. Harap tunggu balasannya ya!', { parse_mode: 'HTML' });
                    break;
                }

                case '/monitor': {
                    try {
                        if (!isAdmin(userId, 'telegram')) {
                            await ctx.reply('<b>AKSES DITOLAK</b> ❌\n\nCommand ini khusus admin.', { parse_mode: 'HTML' });
                            break;
                        }

                        const { results } = await checkWebsites();
                        const replyText = formatMonitorMessage(results, null, 'telegram');
                        const linksKeyboard = buildMonitorLinksKeyboard();
                        await sendTelegramReply(ctx, replyText, linksKeyboard || {});
                    } catch (error) {
                        console.error(`Error handling ${command} command in Telegram:`, error);
                        const errorHeader = '<b>ERROR SISTEM</b> ❌';
                        const errorBody = `Terjadi kesalahan saat memproses perintah: ${escapeHtml(error.message)}`;
                        await ctx.reply(`${errorHeader}\n\n${errorBody}`, { parse_mode: 'HTML' });
                    }
                    break;
                }

                case '/cmd_usage':
                case '/ai_usage': {
                    try {
                        if (!isAdmin(userId, 'telegram')) {
                            await ctx.reply('<b>AKSES DITOLAK</b> ❌\n\nCommand ini khusus admin.', { parse_mode: 'HTML' });
                            break;
                        }

                        const replyText = await handleAdminCommand(command, args, userId, 'telegram');
                        await sendTelegramReply(ctx, replyText);
                    } catch (error) {
                        console.error(`Error handling ${command} command in Telegram:`, error);
                        const errorHeader = '<b>ERROR SISTEM</b> ❌';
                        const errorBody = `Terjadi kesalahan saat memproses perintah: ${escapeHtml(error.message)}`;
                        await ctx.reply(`${errorHeader}\n\n${errorBody}`, { parse_mode: 'HTML' });
                    }
                    break;
                }

                case '/answer':
                case '/broadcast': {
                    try {
                        if (!isAdmin(userId, 'telegram')) {
                            await ctx.reply('<b>AKSES DITOLAK</b> ❌\n\nCommand ini khusus admin.', { parse_mode: 'HTML' });
                            break;
                        }

                        const replyText = await handleAdminCommand(command, args, userId, 'telegram', {
                            notifyAdmin: async (textToAdmin) => {
                                await sendTelegramReply(ctx, String(textToAdmin || ''));
                            },
                            sendToUser: async (targetId, textToSend) => {
                                const chatId = Number(targetId);
                                if (!Number.isFinite(chatId)) {
                                    throw new Error('Invalid Telegram target');
                                }

                                await ctx.telegram.sendMessage(chatId, String(textToSend || ''), {
                                    parse_mode: 'HTML'
                                });
                            }
                        });

                        if (command === '/answer' && args[0]) {
                            await updateStatusAnswered(args[0]);
                        }

                        if (replyText) {
                            await sendTelegramReply(ctx, replyText);
                        }
                    } catch (error) {
                        console.error(`Error handling ${command} command in Telegram:`, error);
                        const errorHeader = '<b>ERROR SISTEM</b> ❌';
                        const errorBody = `Terjadi kesalahan saat memproses perintah: ${escapeHtml(error.message)}`;
                        await ctx.reply(`${errorHeader}\n\n${errorBody}`, { parse_mode: 'HTML' });
                    }
                    break;
                }

                case '/img': {
                    try {
                        await handleImageConverter(ctx, args);
                    } catch (error) {
                        console.error('Error handling /img command in Telegram:', error);
                        const errorHeader = '<b>ERROR CONVERTER</b> ❌';
                        const errorBody = `Gagal memproses gambar: ${escapeHtml(error.message)}`;
                        await ctx.reply(`${errorHeader}\n\n${errorBody}`, { parse_mode: 'HTML' });
                    }
                    break;
                }

                case '/img_info': {
                    await processMenuCommand(ctx, '/img_info', userId);
                    break;
                }

                case '/pdf_info': {
                    await processMenuCommand(ctx, '/pdf_info', userId);
                    break;
                }

                case '/sticker_info': {
                    await processMenuCommand(ctx, '/sticker_info', userId);
                    break;
                }

                case '/tosticker': {
                    try {
                        if (ctx.message?.video || ctx.message?.animation) {
                            await ctx.reply('❌ Maaf, stiker video saat ini hanya disupport di WhatsApp. Silakan kirim gambar biasa ya!');
                            break;
                        }

                        const photoCandidates = [ctx.message?.photo, ctx.message?.reply_to_message?.photo]
                            .filter((item) => Array.isArray(item) && item.length > 0);

                        if (photoCandidates.length === 0) {
                            await ctx.reply('<b>❌ Format Salah</b>\n\nKirim foto atau balas foto dengan command <code>/tosticker</code>.', { parse_mode: 'HTML' });
                            break;
                        }

                        const selectedPhotoArray = photoCandidates[0];
                        const largestPhoto = selectedPhotoArray[selectedPhotoArray.length - 1];
                        const fileId = largestPhoto.file_id;

                        const fileLink = await ctx.telegram.getFileLink(fileId);
                        const response = await axios.get(String(fileLink), { responseType: 'arraybuffer' });
                        const buffer = Buffer.from(response.data);

                        await ctx.replyWithSticker({ source: buffer });
                    } catch (error) {
                        console.error('Error handling /tosticker command in Telegram:', error);
                        if (isFfmpegMissingError(error)) {
                            await ctx.reply('<b>❌ ERROR STICKER</b>\n\nFFmpeg belum terpasang di server. Hubungi admin untuk install FFmpeg agar fitur stiker berjalan normal.', { parse_mode: 'HTML' });
                            break;
                        }

                        await ctx.reply(`<b>❌ ERROR STICKER</b>\n\nGagal membuat stiker: ${escapeHtml(error.message)}`, { parse_mode: 'HTML' });
                    }
                    break;
                }

                case '/hapusbg': {
                    let inputPath = null;
                    let outputPath = null;

                    try {
                        const message = ctx.message;
                        const photoSource = getTelegramPhotoSource(message);

                        if (!photoSource) {
                            await ctx.reply('<b>❌ ERROR REMOVE BG</b>\n\nKirim foto dengan caption command /hapusbg atau balas foto untuk menghapus background.', { parse_mode: 'HTML' });
                            break;
                        }

                        const fileId = photoSource.fileId;
                        const fileSizeBytes = photoSource.fileSize;

                        if (fileSizeBytes > MAX_FILE_SIZE) {
                            await ctx.reply('<b>❌ Gagal</b>\n\nUkuran gambar maksimal 5MB!', { parse_mode: 'HTML' });
                            break;
                        }

                        const timestamp = Date.now();
                        const tempDir = await ensureTempDir();
                        inputPath = path.join(tempDir, `input_bg_${timestamp}.jpg`);
                        outputPath = path.join(tempDir, `output_bg_${timestamp}.png`);

                        const file = await ctx.telegram.getFile(fileId);
                        const fileLink = `https://api.telegram.org/file/bot${bot.token}/${file.file_path}`;

                        const https = require('https');
                        const fileData = await new Promise((resolve, reject) => {
                            https.get(fileLink, (response) => {
                                const chunks = [];
                                response.on('data', (chunk) => chunks.push(chunk));
                                response.on('end', () => resolve(Buffer.concat(chunks)));
                                response.on('error', reject);
                            }).on('error', reject);
                        });

                        await require('fs/promises').writeFile(inputPath, fileData);

                        await removeBackground(inputPath, outputPath);

                        const fileBuffer = await require('fs/promises').readFile(outputPath);
                        await ctx.replyWithPhoto(
                            { source: fileBuffer },
                            {
                                caption: '<b>✅ Background Dihapus!</b>\n\n<i>Preview resolusi rendah. Untuk HD resolution, gunakan kredit berbayar di situs remove.bg.</i>',
                                parse_mode: 'HTML'
                            }
                        );
                    } catch (error) {
                        console.error('Error in /hapusbg handler:', error);
                        const errorMsg = error.message.includes('Kuota') 
                            ? error.message 
                            : `❌ Error: ${escapeHtml(error.message)}`;
                        await ctx.reply(`<b>ERROR REMOVE BG</b>\n\n${errorMsg}`, { parse_mode: 'HTML' });
                    } finally {
                        if (inputPath) await require('fs/promises').unlink(inputPath).catch(() => {});
                        if (outputPath) await require('fs/promises').unlink(outputPath).catch(() => {});
                    }
                    break;
                }

                case '/ss': {
                    let outputPath = null;

                    try {
                        if (args.length === 0) {
                            await ctx.reply('<b>❌ Format Salah</b>\n\nGunakan: <code>/ss &lt;URL&gt;</code>\n\nContoh: <code>/ss https://example.com</code>', { parse_mode: 'HTML' });
                            break;
                        }

                        const url = args.join(' ').trim();

                        // Validate URL
                        try {
                            new URL(url);
                        } catch (e) {
                            await ctx.reply('<b>❌ URL Tidak Valid</b>\n\nTetapkan URL yang benar dimulai dengan http:// atau https://', { parse_mode: 'HTML' });
                            break;
                        }

                        const timestamp = Date.now();
                        const tempDir = await ensureTempDir();
                        outputPath = path.join(tempDir, `output_ss_${timestamp}.jpg`);

                        await htmlToImage(url, outputPath);

                        const fileBuffer = await require('fs/promises').readFile(outputPath);
                        await ctx.replyWithPhoto(
                            { source: fileBuffer },
                            {
                                caption: '<b>✅ Screenshot Berhasil!</b>\n\n<i>Tangkapan halaman web diambil dengan resolusi standar.</i>',
                                parse_mode: 'HTML'
                            }
                        );
                    } catch (error) {
                        console.error('Error in /ss handler:', error);
                        const errorMsg = error.message.includes('Kuota') 
                            ? error.message 
                            : `❌ Error: ${escapeHtml(error.message)}`;
                        await ctx.reply(`<b>ERROR SCREENSHOT</b>\n\n${errorMsg}`, { parse_mode: 'HTML' });
                    } finally {
                        if (outputPath) await require('fs/promises').unlink(outputPath).catch(() => {});
                    }
                    break;
                }

                case '/topdf':
                case '/pdf': {
                    await handleTelegramPdfTools(ctx, command, args);
                    break;
                }

                case '/short': {
                    try {
                        const originalUrl = String(args.join(' ') || '').trim();

                        if (!originalUrl) {
                            await ctx.reply('❌ Masukkan link yang ingin dipendekkan! Contoh: /short https://fuenzerstudio.com');
                            break;
                        }

                        if (!(originalUrl.startsWith('http://') || originalUrl.startsWith('https://'))) {
                            await ctx.reply('❌ URL tidak valid! URL harus diawali http:// atau https://');
                            break;
                        }

                        const shortUrl = await shortenUrl(originalUrl);
                        await ctx.reply(
                            `✅ Berhasil dipendekkan!\n🔗 URL Asli: ${escapeHtml(originalUrl)}\n✨ URL Pendek: ${escapeHtml(shortUrl)}`,
                            { parse_mode: 'HTML' }
                        );
                    } catch (error) {
                        console.error('Error handling /short command in Telegram:', error);
                        await ctx.reply(`❌ Gagal memendekkan URL: ${escapeHtml(error.message)}`, { parse_mode: 'HTML' });
                    }
                    break;
                }

                case '/buku': {
                    const keyword = String(args.join(' ') || '').trim();

                    if (!keyword) {
                        await ctx.reply('❌ Masukkan kata kunci buku! Contoh: /buku atomic habits');
                        break;
                    }

                    try {
                        await ctx.reply('⏳ Sedang mencari referensi buku...');

                        const books = await searchBooks(keyword);
                        if (!Array.isArray(books) || books.length === 0) {
                            await ctx.reply(`📚 REKOMENDASI BUKU: ${escapeHtml(keyword)}\n\nTidak ada hasil ditemukan. Coba keyword lain.`, { parse_mode: 'HTML' });
                            break;
                        }

                        const message = buildBookRecommendationMessage(keyword, books);
                        await ctx.reply(message, { parse_mode: 'HTML' });
                    } catch (error) {
                        console.error('Error handling /buku command in Telegram:', error);
                        const detailedMessage = String(error?.message || '').trim();
                        await ctx.reply(detailedMessage || '❌ Gagal mencari buku. Coba lagi beberapa saat.');
                    }
                    break;
                }

                case '/jurnal': {
                    const keyword = String(args.join(' ') || '').trim();

                    if (!keyword) {
                        await ctx.reply('❌ Masukkan kata kunci jurnal/artikel! Contoh: /jurnal machine learning');
                        break;
                    }

                    try {
                        await ctx.reply('⏳ Sedang mencari referensi jurnal/artikel...');

                        const journals = await searchJournals(keyword);
                        if (!Array.isArray(journals) || journals.length === 0) {
                            await ctx.reply(`🎓 REFERENSI JURNAL: ${escapeHtml(keyword)}\n\nTidak ada hasil ditemukan. Coba keyword lain.`, { parse_mode: 'HTML' });
                            break;
                        }

                        const message = buildJournalRecommendationMessage(keyword, journals);
                        await ctx.reply(message, { parse_mode: 'HTML' });
                    } catch (error) {
                        console.error('Error handling /jurnal command in Telegram:', error);
                        const detailedMessage = String(error?.message || '').trim();
                        await ctx.reply(detailedMessage || '❌ Gagal mencari jurnal. Coba lagi beberapa saat.');
                    }
                    break;
                }

                case '/artikel': {
                    const keyword = String(args.join(' ') || '').trim();

                    if (!keyword) {
                        await ctx.reply('❌ Masukkan kata kunci artikel! Contoh: /artikel machine learning');
                        break;
                    }

                    try {
                        await ctx.reply('⏳ Sedang mencari artikel ilmiah...');

                        const articles = await searchArticles(keyword);
                        if (!Array.isArray(articles) || articles.length === 0) {
                            await ctx.reply(`📰 REFERENSI ARTIKEL: ${escapeHtml(keyword)}\n\nTidak ada hasil ditemukan. Coba keyword lain.`, { parse_mode: 'HTML' });
                            break;
                        }

                        const message = buildArticleRecommendationMessage(keyword, articles);
                        await ctx.reply(message, { parse_mode: 'HTML' });
                    } catch (error) {
                        console.error('Error handling /artikel command in Telegram:', error);
                        const detailedMessage = String(error?.message || '').trim();
                        await ctx.reply(detailedMessage || '❌ Gagal mencari artikel ilmiah. Coba lagi beberapa saat.');
                    }
                    break;
                }

                case '/download': {
                    const targetUrl = String(args.join(' ') || '').trim();

                    if (!targetUrl) {
                        await ctx.reply('❌ Masukkan link media! Contoh: /download https://www.instagram.com/reel/xxxx');
                        break;
                    }

                    try {
                        await ctx.reply('⏳ Sedang memproses media, mohon tunggu sebentar...');

                        const mediaUrls = await getDownloadUrl(targetUrl);
                        if (!Array.isArray(mediaUrls) || mediaUrls.length === 0) {
                            throw new Error('DOWNLOAD_FAILED');
                        }

                        let successCount = 0;
                        let hasFileTooLarge = false;

                        for (const mediaUrl of mediaUrls) {
                            try {
                                const media = await getMediaBuffer(mediaUrl);
                                if (media.type === 'video') {
                                    await ctx.replyWithVideo({ source: media.buffer });
                                } else {
                                    await ctx.replyWithPhoto({ source: media.buffer });
                                }

                                successCount += 1;
                                await new Promise((resolve) => setTimeout(resolve, 1500));
                            } catch (itemErr) {
                                console.error('Failed to download one slide on Telegram:', itemErr.message);
                                if (itemErr.message === 'FILE_TOO_LARGE') {
                                    hasFileTooLarge = true;
                                }
                            }
                        }

                        if (successCount === 0) {
                            if (hasFileTooLarge) {
                                throw new Error('FILE_TOO_LARGE');
                            }
                            throw new Error('DOWNLOAD_FAILED');
                        }
                    } catch (err) {
                        if (err.message === 'FILE_TOO_LARGE') {
                            await ctx.reply('❌ Gagal: Ukuran file terlalu besar (Maksimal 25MB demi stabilitas bot).');
                        } else {
                            await ctx.reply('❌ Gagal mengunduh. Pastikan link valid dan akun tidak di-private!');
                        }
                    }
                    break;
                }

                case '/audio': {
                    const targetUrl = String(args.join(' ') || '').trim();

                    if (!targetUrl) {
                        await ctx.reply('❌ Masukkan link media! Contoh: /audio https://www.youtube.com/watch?v=xxxx');
                        break;
                    }

                    try {
                        await ctx.reply('⏳ Sedang memproses audio, mohon tunggu sebentar...');

                        const audioUrl = await getAudioUrl(targetUrl);
                        const audio = await getAudioBuffer(audioUrl);
                        await ctx.replyWithAudio({ source: audio.buffer, filename: 'audio.mp3' });
                    } catch (err) {
                        if (err.message === 'FILE_TOO_LARGE') {
                            await ctx.reply('❌ Gagal: Ukuran file audio terlalu besar (Maksimal 25MB demi stabilitas bot).');
                        } else if (err.message === 'AUDIO_PLATFORM_NOT_SUPPORTED') {
                            await ctx.reply('❌ Saat ini /audio hanya mendukung YouTube dan YouTube Music.');
                        } else if (err.message === 'DOWNLOAD_BUFFER_FAILED') {
                            await ctx.reply('❌ Audio ditemukan, tapi server sumber menolak koneksi (proxy/anti-hotlink). Coba ulang beberapa saat lagi.');
                        } else if (err.message === 'AUDIO_NOT_FOUND') {
                            await ctx.reply('❌ Audio tidak ditemukan dari link tersebut.');
                        } else {
                            await ctx.reply('❌ Gagal mengunduh audio. Pastikan link valid dan akun tidak di-private!');
                        }
                    }
                    break;
                }

                case '/hapus':
                    if (args.length < 1) {
                        await ctx.reply('Format: <code>/hapus &lt;id_transaksi&gt;</code>\nContoh: <code>/hapus 123e4567</code>\nGunakan /riwayat untuk melihat ID transaksi.', { parse_mode: 'HTML' });
                        break;
                    }

                    await ctx.reply(
                        `<b>KONFIRMASI HAPUS</b> ⚠️\n\nYakin ingin menghapus transaksi dengan ID <code>${escapeHtml(args[0])}</code>?`,
                        {
                            parse_mode: 'HTML',
                            ...buildDeleteConfirmKeyboard(args[0])
                        }
                    );
                    break;
                    
                default:
                    const defaultHeader = '<b>COMMAND TIDAK DIKENAL</b> ❌';
                    const defaultBody = `Perintah <code>${escapeHtml(command)}</code> tidak tersedia.\nGunakan /info untuk melihat daftar perintah yang tersedia.`;
                    await ctx.reply(`${defaultHeader}\n\n${defaultBody}`, { parse_mode: 'HTML' });
            }
        } else {
            // AI Path: Non-command messages
            if (text.length <= 2) {
                const shortHeader = '<b>PESAN TERLALU PENDEK</b> ❌';
                const shortBody = `Maaf, pesan terlalu pendek atau kurang jelas.\nKetik /info untuk melihat daftar kemampuan.`;
                await ctx.reply(`${shortHeader}\n\n${shortBody}`, { parse_mode: 'HTML' });
                return;
            }
            
            try {
                const aiResult = await askAiDetailed(text, userId, 'telegram');
                const withAiFooter = appendFooter(aiResult.text, buildAiStatsFooter(aiResult));
                const formattedReply = formatTelegramHtml(withAiFooter);
                const finalReply = formatBodyBold(formattedReply);
                await ctx.reply(finalReply, { parse_mode: 'HTML' });
            } catch (error) {
                console.error('Error from OpenRouter AI in Telegram:', error);
                
                let errorHeader, errorBody;
                const message = String(error?.message || '');
                if (message.includes('429 Rate Limit')) {
                    errorHeader = '<b>RATE LIMIT AI</b> ⏳';
                    errorBody = 'Maaf, request AI sedang padat (429 Rate Limit).\nSilakan coba lagi beberapa saat.';
                } else if (message.includes('401 Unauthorized') || message.includes('403 Forbidden')) {
                    errorHeader = '<b>AKSES AI DITOLAK</b> 🔒';
                    errorBody = 'Maaf, akses AI ditolak (401/403).\nAdmin perlu memeriksa API key OpenRouter.';
                } else if (message.includes('tidak ditemukan di OpenRouter')) {
                    errorHeader = '<b>MODEL AI TIDAK DITEMUKAN</b> 🔍';
                    errorBody = 'Maaf, model AI yang dipakai sedang tidak tersedia.\nCoba lagi nanti.';
                } else if (message.includes('API key OpenRouter')) {
                    errorHeader = '<b>API KEY AI TIDAK VALID</b> 🔑';
                    errorBody = 'Maaf, konfigurasi OpenRouter belum lengkap atau tidak valid.\nAdmin telah diberitahu.';
                } else if (message.includes('Server OpenRouter sedang gangguan')) {
                    errorHeader = '<b>SERVER AI GANGGUAN</b> 🛠️';
                    errorBody = 'Maaf, server AI sedang gangguan.\nSilakan coba lagi nanti.';
                } else {
                    errorHeader = '<b>ERROR AI</b> ❌';
                    errorBody = 'Maaf, otak AI sedang gangguan.\nCoba lagi nanti atau gunakan perintah sistem (/ping, /saldo).';
                }
                const errorText = appendFooter(`${errorHeader}\n\n${errorBody}`, buildAiStatsFooter({ model: '-', usage: { promptTokenCount: 0, candidatesTokenCount: 0 }, rpm: { label: '-' } }));
                const formattedError = formatTelegramHtml(errorText);
                const finalError = formatBodyBold(formattedError);
                await ctx.reply(finalError, { parse_mode: 'HTML' });
            }
        }
    });

    bot.on('callback_query', async (ctx) => {
        const data = ctx.callbackQuery?.data || '';
        const userId = ctx.from.id.toString();

        try {
            if (data.startsWith('cmd:')) {
                const key = data.split(':')[1];
                const commandMap = {
                    start: '/start',
                    info: '/info',
                    donate: '/donate',
                    ping: '/ping',
                    finance_info: '/finance_info',
                    research_info: '/research_info',
                    downloader: '/downloader',
                    remind_info: '/remind_info',
                    cuaca: '/cuaca',
                    sholat: '/sholat',
                    me: '/me',
                    img_info: '/img_info',
                    pdf_info: '/pdf_info',
                    model_info: '/model_info',
                    sticker_info: '/sticker_info',
                    translate_info: '/translate_info'
                };

                const mapped = commandMap[key];
                if (mapped) {
                    await ctx.answerCbQuery();

                    if (mapped === '/cuaca') {
                        await ctx.answerCbQuery();
                        await ctx.reply('Untuk melihat cuaca, ketik command beserta nama kota.\nContoh: <code>/cuaca semarang</code>', { parse_mode: 'HTML' });
                        return;
                    }
                    
                    if (mapped === '/sholat') {
                        await ctx.answerCbQuery();
                        await ctx.reply('Untuk melihat jadwal sholat, ketik command beserta nama kota.\nContoh: <code>/sholat jakarta</code>', { parse_mode: 'HTML' });
                        return;
                    }
                    
                    if (mapped === '/me') {
                        await ctx.answerCbQuery();
                        await sendUtilityCommandMessage(ctx, '/me', userId, []);
                        return;
                    }

                    await processMenuCommand(ctx, mapped, userId);
                } else {
                    await ctx.answerCbQuery('Aksi tidak dikenal.');
                }

                return;
            }

            if (data === 'admin:monitor') {
                await ctx.answerCbQuery();

                if (!isAdmin(userId, 'telegram')) {
                    await ctx.reply('<b>AKSES DITOLAK</b> ❌\n\nCommand ini khusus admin.', { parse_mode: 'HTML' });
                    return;
                }

                const { results } = await checkWebsites();
                const replyText = formatMonitorMessage(results, null, 'telegram');
                const linksKeyboard = buildMonitorLinksKeyboard();
                await sendTelegramReply(ctx, replyText, linksKeyboard || {});
                return;
            }

            if (data === 'admin:cmd_usage' || data === 'admin:ai_usage') {
                await ctx.answerCbQuery();

                if (!isAdmin(userId, 'telegram')) {
                    await ctx.reply('<b>AKSES DITOLAK</b> ❌\n\nCommand ini khusus admin.', { parse_mode: 'HTML' });
                    return;
                }

                const adminCommand = data === 'admin:ai_usage'
                    ? '/ai_usage'
                    : '/cmd_usage';
                await logCommand(userId, 'telegram', adminCommand);
                const replyText = await handleAdminCommand(adminCommand, [], userId, 'telegram');
                await sendTelegramReply(ctx, replyText);
                return;
            }

            if (data === 'admin:broadcast') {
                await ctx.answerCbQuery();

                if (!isAdmin(userId, 'telegram')) {
                    await ctx.reply('<b>AKSES DITOLAK</b> ❌\n\nCommand ini khusus admin.', { parse_mode: 'HTML' });
                    return;
                }

                await ctx.reply(
                    '<b>BROADCAST ADMIN</b> 📣\n\nGunakan format:\n<code>/broadcast &lt;pesan&gt;</code>\n\nContoh:\n<code>/broadcast Halo semua, bot sedang maintenance.</code>',
                    { parse_mode: 'HTML' }
                );
                return;
            }

            if (data.startsWith('history:')) {
                const page = parseInt(data.split(':')[1], 10);
                await ctx.answerCbQuery();
                await sendHistoryPageMessage(ctx, userId, Number.isInteger(page) && page > 0 ? page : 1, true);
                return;
            }

            if (data.startsWith('delete_confirm:')) {
                const transactionId = data.split(':')[1] || '';
                await ctx.answerCbQuery('Menghapus transaksi...');
                const result = await handleFinanceCommand('/hapus', [transactionId], userId, 'telegram');

                try {
                    await ctx.editMessageText(formatBodyBold(formatTelegramHtml(result)), {
                        parse_mode: 'HTML'
                    });
                } catch (error) {
                    console.error('Error editing delete confirmation message:', error);
                    await sendTelegramReply(ctx, result);
                }
                return;
            }

            if (data.startsWith('delete_cancel:')) {
                await ctx.answerCbQuery('Dibatalkan.');
                await ctx.editMessageText('<b>HAPUS DIBATALKAN</b> ✅\n\nTransaksi tidak jadi dihapus.', {
                    parse_mode: 'HTML'
                });
                return;
            }

            await ctx.answerCbQuery('Aksi tidak tersedia.');
        } catch (error) {
            console.error('Error handling Telegram callback query:', error);
            try {
                await ctx.answerCbQuery('Terjadi kesalahan. Coba lagi.');
            } catch (_ignored) {
                // no-op
            }
        }
    });
    
    // Error handling
    bot.catch((err, ctx) => {
        console.error(`Telegram Bot Error for ${ctx.updateType}:`, err);
        ctx.reply('<b>ERROR SISTEM</b> ❌\n\nTerjadi kesalahan internal. Silakan coba lagi nanti.', { parse_mode: 'HTML' });
    });
}

module.exports = { setupTelegramBot };
