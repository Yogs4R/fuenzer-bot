const fs = require('fs/promises');
const fsSync = require('fs');
const path = require('path');
const https = require('https');
const axios = require('axios');

const {
    handleImgCommand,
    handleRemoveBgCommand,
    handleHtmlToImageCommand,
    handleStickerCommand,
    handlePdfCommand
} = require('../../commands/converter/index');
const {
    handleDownloadCommand,
    handleAudioCommand
} = require('../../commands/downloader/index');
const {
    buildDonateMessage,
    getDonateQrImagePaths
} = require('../../commands/info/index');
const { pdfMergeSessionManager } = require('../../utils/sessionManager');

const MAX_FILE_SIZE = 5 * 1024 * 1024; // 5MB
const MAX_PDF_INPUT_SIZE = 10 * 1024 * 1024; // 10MB
const MAX_PDF_LOCAL_INPUT_SIZE = 15 * 1024 * 1024; // 15MB

function escapeHtml(text) {
    if (!text) return '';
    return String(text)
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#039;');
}

async function ensureTempDir() {
    const tempDir = path.join(process.cwd(), 'temp');
    await fs.mkdir(tempDir, { recursive: true });
    return tempDir;
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
    if (!document) return false;
    const extFromName = getExtensionFromFileName(document.file_name);
    const mimeType = String(document.mime_type || '').toLowerCase();
    return extFromName === 'pdf' || mimeType.includes('pdf');
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

async function downloadTelegramFileBuffer(bot, fileId) {
    const file = await bot.telegram.getFile(fileId);
    const fileLink = `https://api.telegram.org/file/bot${bot.token}/${file.file_path}`;

    return new Promise((resolve, reject) => {
        https.get(fileLink, (response) => {
            const chunks = [];
            response.on('data', (chunk) => chunks.push(chunk));
            response.on('end', () => resolve(Buffer.concat(chunks)));
            response.on('error', reject);
        }).on('error', reject);
    });
}

async function handleTelegramImageConverter(ctx, args, bot) {
    let inputPath = null;
    let outputPath = null;

    try {
        const message = ctx.message;
        const photoSource = getTelegramPhotoSource(message);

        if (!photoSource) {
            await ctx.reply('<b>❌ Format Salah</b>\n\nKirim foto dengan caption command atau balas foto untuk menggunakan converter.', { parse_mode: 'HTML' });
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

        const fileData = await downloadTelegramFileBuffer(bot, fileId);
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

async function handleTelegramSticker(ctx) {
    try {
        if (ctx.message?.video || ctx.message?.animation) {
            await ctx.reply('❌ Maaf, stiker video saat ini hanya disupport di WhatsApp. Silakan kirim gambar biasa ya!');
            return;
        }

        const photoCandidates = [ctx.message?.photo, ctx.message?.reply_to_message?.photo]
            .filter((item) => Array.isArray(item) && item.length > 0);

        if (photoCandidates.length === 0) {
            await ctx.reply('<b>❌ Format Salah</b>\n\nKirim foto atau balas foto dengan command <code>/tosticker</code>.', { parse_mode: 'HTML' });
            return;
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
}

async function handleTelegramRemoveBg(ctx, bot) {
    let inputPath = null;
    let outputPath = null;

    try {
        const message = ctx.message;
        const photoSource = getTelegramPhotoSource(message);

        if (!photoSource) {
            await ctx.reply('<b>❌ ERROR REMOVE BG</b>\n\nKirim foto dengan caption command /hapusbg atau balas foto untuk menghapus background.', { parse_mode: 'HTML' });
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
        inputPath = path.join(tempDir, `input_bg_${timestamp}.jpg`);
        outputPath = path.join(tempDir, `output_bg_${timestamp}.png`);

        const fileData = await downloadTelegramFileBuffer(bot, fileId);
        await fs.writeFile(inputPath, fileData);

        const bgRes = await handleRemoveBgCommand(inputPath, outputPath, 'telegram');
        if (bgRes.success) {
            const fileBuffer = await fs.readFile(outputPath);
            await ctx.replyWithPhoto(
                { source: fileBuffer },
                { caption: bgRes.caption, parse_mode: 'HTML' }
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
}

async function handleTelegramScreenshot(ctx, args) {
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
                { caption: ssRes.caption, parse_mode: 'HTML' }
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
}

async function handleTelegramPdfTools(ctx, command, args, bot) {
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

        const fileData = await downloadTelegramFileBuffer(bot, source.fileId);
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
        console.error(`Error in ${command} handler for Telegram:`, error);
        await ctx.reply(`<b>ERROR PDF TOOLS</b> ❌\n\n${escapeHtml(error.message)}`, { parse_mode: 'HTML' });
    } finally {
        safeUnlinkSync(inputPath);
        safeUnlinkSync(outputPath);
    }
}

async function handleTelegramPdfMergeUpload(ctx, document, userId, bot) {
    let downloadPath = null;
    try {
        const fileSize = Number(document.file_size || 0);
        if (fileSize > MAX_PDF_LOCAL_INPUT_SIZE) {
            await ctx.reply('<b>❌ Gagal</b>\n\nUkuran file maksimal 15MB per PDF untuk merge.', { parse_mode: 'HTML' });
            return;
        }

        const timestamp = Date.now();
        const tempDir = await ensureTempDir();
        const nextIndex = pdfMergeSessionManager.getSessionFiles(userId).length + 1;
        downloadPath = path.join(tempDir, `input_merge_${timestamp}_${nextIndex}.pdf`);

        const fileData = await downloadTelegramFileBuffer(bot, document.file_id);
        await fs.writeFile(downloadPath, fileData);
        const totalFiles = pdfMergeSessionManager.addFileToSession(userId, downloadPath);

        await ctx.reply(`📄 File ke-${totalFiles} diterima! Kirim lagi atau ketik /pdf merge done.`);
    } catch (error) {
        safeUnlinkSync(downloadPath);
        console.error('Error saat menerima file merge PDF Telegram:', error);
        await ctx.reply(`<b>ERROR PDF MERGE</b> ❌\n\n${escapeHtml(error.message)}`, { parse_mode: 'HTML' });
    }
}

async function handleTelegramDownloader(ctx, command, args) {
    const targetUrl = String(args.join(' ') || '').trim();

    if (command === '/download') {
        if (!targetUrl) {
            await ctx.reply('❌ Masukkan link media! Contoh: /download https://www.instagram.com/reel/xxxx');
            return;
        }

        await ctx.reply('⏳ Sedang memproses media, mohon tunggu sebentar...');

        const result = await handleDownloadCommand(targetUrl, 'telegram');
        if (!result.success) {
            await ctx.reply(result.message);
            return;
        }

        for (const item of result.items) {
            if (item.type === 'video') {
                await ctx.replyWithVideo({ source: item.buffer });
            } else {
                await ctx.replyWithPhoto({ source: item.buffer });
            }
            await new Promise((resolve) => setTimeout(resolve, 1500));
        }
        return;
    }

    if (command === '/audio') {
        if (!targetUrl) {
            await ctx.reply('❌ Masukkan link media! Contoh: /audio https://www.youtube.com/watch?v=xxxx');
            return;
        }

        await ctx.reply('⏳ Sedang memproses audio, mohon tunggu sebentar...');

        const result = await handleAudioCommand(targetUrl, 'telegram');
        if (!result.success) {
            await ctx.reply(result.message, { parse_mode: 'HTML' });
            return;
        }

        await ctx.replyWithAudio({ source: result.buffer, filename: result.filename || 'audio.mp3' });
        return;
    }
}

async function sendTelegramDonation(ctx) {
    try {
        const donateText = buildDonateMessage('telegram');
        const { koFi, saweria } = getDonateQrImagePaths();

        await ctx.reply(donateText, { parse_mode: 'HTML' });
        await ctx.replyWithPhoto({ source: koFi }, { caption: '🌍 QR Donasi Ko-fi' });
        await ctx.replyWithPhoto({ source: saweria }, { caption: '🇮🇩 QR Donasi Saweria' });
    } catch (error) {
        console.error('Error in sendTelegramDonation:', error);
        await ctx.reply(`<b>ERROR DONATE</b> ❌\n\n${escapeHtml(error.message)}`, { parse_mode: 'HTML' });
    }
}

module.exports = {
    MAX_FILE_SIZE,
    MAX_PDF_INPUT_SIZE,
    MAX_PDF_LOCAL_INPUT_SIZE,
    ensureTempDir,
    safeUnlinkSync,
    isTelegramPdfDocument,
    getTelegramPhotoSource,
    getExtensionFromFileName,
    getExtensionFromMimeType,
    downloadTelegramFileBuffer,
    handleTelegramImageConverter,
    handleTelegramSticker,
    handleTelegramRemoveBg,
    handleTelegramScreenshot,
    handleTelegramPdfTools,
    handleTelegramPdfMergeUpload,
    handleTelegramDownloader,
    sendTelegramDonation
};
