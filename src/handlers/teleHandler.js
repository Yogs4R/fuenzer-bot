// Telegram message/event handler
const os = require('os');
const fs = require('fs/promises');
const fsSync = require('fs');
const path = require('path');
const axios = require('axios');
const bot = require('../lib/telegramClient');
const { Markup } = require('telegraf');
const { dispatchCommand, updateStatusAnswered } = require('../commands/index');
const { getHistoryPage } = require('../services/financeService');
const { isAdmin } = require('../utils/auth');
const { getMonitorWebsiteLinks } = require('../services/monitorService');
const { processAiChat, buildAiStatsFooter } = require('../commands/ai/index');
const {
    handleImgCommand,
    handleRemoveBgCommand,
    handleHtmlToImageCommand,
    handleStickerCommand,
    handlePdfCommand
} = require('../commands/converter/index');
const { pdfMergeSessionManager } = require('../utils/sessionManager');
const { logCommand } = require('../services/logService');
const { getDownloadUrl, getAudioUrl, getMediaBuffer, getAudioBuffer } = require('../services/downloaderService');
const { buildDonateMessage, getDonateQrImagePaths } = require('../services/donateService');
const { MAX_FILE_SIZE } = require('../services/converterService');
const HISTORY_PAGE_SIZE = 5;
const MAX_PDF_INPUT_SIZE = 10 * 1024 * 1024;
const MAX_PDF_LOCAL_INPUT_SIZE = 15 * 1024 * 1024;

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



async function handleUtilityCommand(command, args, userId, platform = 'telegram') {
    if (command === '/cuaca') {
        return handleWeatherCommand(command, args, userId, platform);
    }

    if (command === '/sholat') {
        return handleReligionCommand(command, args, userId, platform);
    }

    if (command === '/me') {
        return handleDevopsCommand(command, args, userId, platform);
    }

    return 'Perintah tidak dikenali.';
}

async function sendUtilityCommandMessage(ctx, command, userId, args = []) {
    const replyText = await handleUtilityCommand(command, args, userId, 'telegram');
    const linksKeyboard = command === '/me' ? buildMonitorLinksKeyboard() : null;
    await sendTelegramReply(ctx, replyText, linksKeyboard || {});
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
                const timestamp = Date.now();
                const tempDir = await ensureTempDir();
                outputPath = path.join(tempDir, `merged_${timestamp}.pdf`);

                const pdfRes = await handlePdfCommand({
                    command,
                    args,
                    outputPath,
                    userId,
                    platform: 'telegram'
                });

                if (pdfRes.type === 'message') {
                    await ctx.reply(pdfRes.message, { parse_mode: 'HTML' });
                } else if (pdfRes.success) {
                    await ctx.replyWithDocument(
                        { source: outputPath, filename: path.basename(outputPath) },
                        { caption: pdfRes.caption, parse_mode: 'HTML' }
                    );
                }
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

        const pdfRes = await handlePdfCommand({
            command,
            args,
            inputPath,
            outputPath,
            inputExt,
            userId,
            platform: 'telegram'
        });

        if (pdfRes.type === 'message') {
            await ctx.reply(pdfRes.message, { parse_mode: 'HTML' });
        } else if (pdfRes.success) {
            await ctx.replyWithDocument(
                { source: outputPath, filename: path.basename(outputPath) },
                { caption: pdfRes.caption, parse_mode: 'HTML' }
            );
        }
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
            const message = await handleInfoCommand('/info', [], userId, 'telegram');
            await ctx.reply(message, {
                parse_mode: 'HTML',
                ...buildMainMenuKeyboard()
            });
            return;
        }

        case '/help': {
            const replyText = await handleGoogleCommand('/help', [], userId, 'telegram');
            await ctx.reply(replyText, { parse_mode: 'HTML' });
            return;
        }

        case '/translate_info':
        case '/research_info':
        case '/downloader':
        case '/remind_info':
        case '/finance_info':
        case '/img_info':
        case '/pdf_info':
        case '/sticker_info': {
            const replyText = await handleInfoCommand(command, [], userId, 'telegram');
            await ctx.reply(replyText, { parse_mode: 'HTML' });
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
        case '/ping': {
            const replyText = await handleDevopsCommand(command, [], userId, 'telegram');
            await ctx.reply(replyText);
            return;
        }
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
        case '/model_info':
        case '/switch': {
            const parts = ctx.message?.text?.trim()?.split(' ') || [command];
            const args = parts.slice(1);
            const replyText = await handleAiCommand(command, args, userId, 'telegram');
            await ctx.reply(replyText, { parse_mode: 'HTML' });
            return;
        }
        case '/riwayat':
            await sendHistoryPageMessage(ctx, userId, 1, false);
            return;

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
        const hasActiveMergeSession = pdfMergeSessionManager.hasSession(userId);
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
                const nextIndex = pdfMergeSessionManager.getSessionFiles(userId).length + 1;
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
                const totalFiles = pdfMergeSessionManager.addFileToSession(userId, downloadPath);

                await ctx.reply(`📄 File ke-${totalFiles} diterima! Kirim lagi atau ketik /pdf merge done.`);
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
            
            const dispatched = await dispatchCommand(command, args, userId, 'telegram', {
                quotedText: ctx.message?.reply_to_message?.text || ctx.message?.reply_to_message?.caption || '',
                notifyAdmin: async (textToAdmin) => {
                    await sendTelegramReply(ctx, String(textToAdmin || ''));
                },
                sendToUser: async (targetId, textToSend) => {
                    const chatId = Number(targetId);
                    if (!Number.isFinite(chatId)) throw new Error('Invalid Telegram target');
                    await ctx.telegram.sendMessage(chatId, String(textToSend || ''), { parse_mode: 'HTML' });
                }
            });

            if (dispatched !== null) {
                if (command === '/answer' && args[0]) {
                    await updateStatusAnswered(args[0]);
                }

                if (command === '/admin' && isAdmin(userId, 'telegram')) {
                    await sendTelegramReply(ctx, dispatched, buildAdminMenuKeyboard());
                } else if (command === '/monitor' && !dispatched.includes('AKSES DITOLAK')) {
                    const linksKeyboard = buildMonitorLinksKeyboard();
                    await sendTelegramReply(ctx, dispatched, linksKeyboard || {});
                } else if (command === '/me') {
                    const linksKeyboard = buildMonitorLinksKeyboard();
                    await sendTelegramReply(ctx, dispatched, linksKeyboard || {});
                } else {
                    await sendTelegramReply(ctx, dispatched);
                }
                return;
            }

            switch (command) {
                case '/riwayat':
                    try {
                        const requestedPage = args.length > 0 ? parseInt(args[0], 10) : 1;
                        await sendHistoryPageMessage(ctx, userId, Number.isInteger(requestedPage) && requestedPage > 0 ? requestedPage : 1, false);
                    } catch (error) {
                        console.error('Error handling riwayat command in Telegram:', error);
                        await ctx.reply('<b>ERROR RIWAYAT</b> ❌\n\nGagal menampilkan riwayat transaksi.', { parse_mode: 'HTML' });
                    }
                    break;

                case '/donate':
                    try {
                        await processMenuCommand(ctx, '/donate', userId);
                    } catch (error) {
                        console.error('Error handling /donate command in Telegram:', error);
                        await ctx.reply(`<b>ERROR DONATE</b> ❌\n\n${escapeHtml(error.message)}`, { parse_mode: 'HTML' });
                    }
                    break;

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

                        const stickerRes = await handleStickerCommand(buffer, false, 'telegram');
                        if (stickerRes.success) {
                            await ctx.replyWithSticker({ source: stickerRes.buffer });
                        } else {
                            await ctx.reply(stickerRes.message, { parse_mode: 'HTML' });
                        }
                    } catch (error) {
                        console.error('Error handling /tosticker command in Telegram:', error);
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

                        await fs.writeFile(inputPath, fileData);

                        const bgRes = await handleRemoveBgCommand(inputPath, outputPath, 'telegram');
                        if (bgRes.success) {
                            const fileBuffer = await fs.readFile(outputPath);
                            await ctx.replyWithPhoto(
                                { source: fileBuffer },
                                {
                                    caption: bgRes.caption,
                                    parse_mode: 'HTML'
                                }
                            );
                        } else {
                            await ctx.reply(bgRes.message, { parse_mode: 'HTML' });
                        }
                    } catch (error) {
                        console.error('Error in /hapusbg handler:', error);
                        await ctx.reply(`<b>ERROR REMOVE BG</b>\n\n❌ Error: ${escapeHtml(error.message)}`, { parse_mode: 'HTML' });
                    } finally {
                        if (inputPath) await fs.unlink(inputPath).catch(() => {});
                        if (outputPath) await fs.unlink(outputPath).catch(() => {});
                    }
                    break;
                }

                case '/ss': {
                    let outputPath = null;

                    try {
                        const url = args.join(' ').trim();
                        const timestamp = Date.now();
                        const tempDir = await ensureTempDir();
                        outputPath = path.join(tempDir, `output_ss_${timestamp}.jpg`);

                        const ssRes = await handleHtmlToImageCommand(url, outputPath, 'telegram');
                        if (ssRes.success) {
                            const fileBuffer = await fs.readFile(outputPath);
                            await ctx.replyWithPhoto(
                                { source: fileBuffer },
                                {
                                    caption: ssRes.caption,
                                    parse_mode: 'HTML'
                                }
                            );
                        } else {
                            await ctx.reply(ssRes.message, { parse_mode: 'HTML' });
                        }
                    } catch (error) {
                        console.error('Error in /ss handler:', error);
                        await ctx.reply(`<b>ERROR SCREENSHOT</b>\n\n❌ Error: ${escapeHtml(error.message)}`, { parse_mode: 'HTML' });
                    } finally {
                        if (outputPath) await fs.unlink(outputPath).catch(() => {});
                    }
                    break;
                }

                case '/topdf':
                case '/pdf': {
                    await handleTelegramPdfTools(ctx, command, args);
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
            
            const chatResult = await processAiChat(text, userId, 'telegram');
            const formattedReply = formatTelegramHtml(chatResult.fullText);
            const finalReply = formatBodyBold(formattedReply);
            await ctx.reply(finalReply, { parse_mode: 'HTML' });
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
