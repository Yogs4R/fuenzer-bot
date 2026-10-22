// Media & Document Converter Command Handler
const fs = require('fs/promises');
const path = require('path');
const {
    processLocalImage,
    removeBackground,
    htmlToImage,
    rotatePdf,
    extractPdf,
    mergePdfs,
    convertToPdf,
    convertFromPdf,
    compressPdf
} = require('../../services/converterService');
const { createSticker, isFfmpegMissingError } = require('../../services/stickerService');
const { pdfMergeSessionManager } = require('../../utils/sessionManager');

function escapeHtml(text) {
    return String(text || '')
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;');
}

async function handleImgCommand(args, inputPath, outputPath, platform = 'telegram') {
    try {
        const action = String(args[0] || '').toLowerCase().trim();
        const param = String(args[1] || '').toLowerCase().trim();

        if (!action) {
            const header = platform === 'telegram'
                ? '<b>❌ ERROR CONVERTER</b>'
                : '> *❌ ERROR CONVERTER*';
            const body = 'Format: /img <action> [parameter]\n\nContoh:\n• /img compress\n• /img resize 500x500\n• /img to png\n• /img rotate 90';
            return { success: false, message: `${header}\n\n${body}` };
        }

        const validActions = ['compress', 'resize', 'to', 'rotate'];
        if (!validActions.includes(action)) {
            const header = platform === 'telegram'
                ? '<b>❌ ACTION TIDAK DIKENAL</b>'
                : '> *❌ ACTION TIDAK DIKENAL*';
            const body = `Action "${action}" tidak tersedia.\n\nAction tersedia:\n• compress - Kompres gambar\n• resize - Ubah ukuran\n• to - Konversi format\n• rotate - Putar gambar`;
            return { success: false, message: `${header}\n\n${body}` };
        }

        if (action === 'resize' && !param) {
            const header = platform === 'telegram'
                ? '<b>❌ PARAMETER DIPERLUKAN</b>'
                : '> *❌ PARAMETER DIPERLUKAN*';
            const body = 'Resize memerlukan parameter ukuran.\n\nContoh: /img resize 500x500';
            return { success: false, message: `${header}\n\n${body}` };
        }

        if (action === 'to' && !param) {
            const header = platform === 'telegram'
                ? '<b>❌ PARAMETER DIPERLUKAN</b>'
                : '> *❌ PARAMETER DIPERLUKAN*';
            const body = 'Konversi memerlukan format tujuan.\n\nContoh: /img to png';
            return { success: false, message: `${header}\n\n${body}` };
        }

        await processLocalImage(inputPath, outputPath, { action, param });

        const actionNames = {
            compress: 'Kompresi',
            resize: 'Resize',
            to: 'Konversi',
            rotate: 'Rotasi'
        };

        const actionName = actionNames[action] || action;
        const actionDesc = action === 'resize'
            ? `${actionName} (${param})`
            : action === 'to'
                ? `${actionName} ke ${param.toUpperCase()}`
                : action === 'rotate'
                    ? `${actionName} ${param}°`
                    : actionName;

        const header = platform === 'telegram'
            ? '<b>✅ BERHASIL</b>'
            : '> *✅ BERHASIL*';
        const body = `Gambar berhasil diproses!\n\n📝 Aksi: ${actionDesc}`;
        return { success: true, action, message: `${header}\n\n${body}` };
    } catch (error) {
        console.error('Error in handleImgCommand:', error);
        const errorMsg = String(error?.message || 'Unknown error');
        const header = platform === 'telegram'
            ? '<b>❌ ERROR CONVERTER</b>'
            : '> *❌ ERROR CONVERTER*';
        const body = `Gagal memproses gambar.\n\nError: ${platform === 'telegram' ? escapeHtml(errorMsg) : errorMsg}`;
        return { success: false, message: `${header}\n\n${body}` };
    }
}

async function handleRemoveBgCommand(inputPath, outputPath, platform = 'telegram') {
    try {
        await removeBackground(inputPath, outputPath);
        const caption = platform === 'telegram'
            ? '<b>✅ Background Dihapus!</b>\n\n<i>Preview resolusi rendah. Untuk HD resolution, gunakan kredit berbayar di situs remove.bg.</i>'
            : '*✅ Background Dihapus!*\n\n_Preview resolusi rendah. Untuk HD resolution, gunakan kredit berbayar di situs remove.bg._';
        return { success: true, caption };
    } catch (error) {
        console.error('Error in handleRemoveBgCommand:', error);
        const rawMsg = error.message.includes('Kuota') ? error.message : `❌ Error: ${error.message}`;
        const header = platform === 'telegram' ? '<b>ERROR REMOVE BG</b>' : '> *ERROR REMOVE BG*';
        return { success: false, message: `${header}\n\n${platform === 'telegram' ? escapeHtml(rawMsg) : rawMsg}` };
    }
}

async function handleHtmlToImageCommand(url, outputPath, platform = 'telegram') {
    try {
        if (!url) {
            const msg = platform === 'telegram'
                ? '<b>❌ Format Salah</b>\n\nGunakan: <code>/ss &lt;URL&gt;</code>\n\nContoh: <code>/ss https://example.com</code>'
                : '> *❌ FORMAT SALAH*\n\nGunakan: `/ss <URL>`\n\nContoh: `/ss https://example.com`';
            return { success: false, message: msg };
        }

        try {
            new URL(url);
        } catch (_e) {
            const msg = platform === 'telegram'
                ? '<b>❌ URL Tidak Valid</b>\n\nTetapkan URL yang benar dimulai dengan http:// atau https://'
                : '> *❌ URL TIDAK VALID*\n\nTetapkan URL yang benar dimulai dengan http:// atau https://';
            return { success: false, message: msg };
        }

        await htmlToImage(url, outputPath);
        const caption = platform === 'telegram'
            ? '<b>✅ Screenshot Berhasil!</b>\n\n<i>Tangkapan halaman web diambil dengan resolusi standar.</i>'
            : '*✅ Screenshot Berhasil!*\n\n_Tangkapan halaman web diambil dengan resolusi standar._';
        return { success: true, caption };
    } catch (error) {
        console.error('Error in handleHtmlToImageCommand:', error);
        const rawMsg = error.message.includes('Kuota') ? error.message : `❌ Error: ${error.message}`;
        const header = platform === 'telegram' ? '<b>ERROR SCREENSHOT</b>' : '> *ERROR SCREENSHOT*';
        return { success: false, message: `${header}\n\n${platform === 'telegram' ? escapeHtml(rawMsg) : rawMsg}` };
    }
}

async function handleStickerCommand(buffer, isVideo = false, platform = 'telegram') {
    try {
        const stickerBuffer = await createSticker(buffer, isVideo ? 'video' : 'image');
        return { success: true, buffer: stickerBuffer };
    } catch (error) {
        console.error('Error in handleStickerCommand:', error);
        if (isFfmpegMissingError(error)) {
            const msg = platform === 'telegram'
                ? '<b>❌ ERROR STICKER</b>\n\nFFmpeg belum terpasang di server. Hubungi admin untuk install FFmpeg agar fitur stiker berjalan normal.'
                : '> *❌ ERROR STICKER*\n\nFFmpeg belum terpasang di server. Hubungi admin untuk install FFmpeg agar fitur stiker berjalan normal.';
            return { success: false, message: msg };
        }
        const errorMsg = String(error?.message || 'Unknown error');
        const msg = platform === 'telegram'
            ? `<b>❌ ERROR STICKER</b>\n\nGagal membuat stiker: ${escapeHtml(errorMsg)}`
            : `> *❌ ERROR STICKER*\n\nGagal membuat stiker: ${errorMsg}`;
        return { success: false, message: msg };
    }
}

async function handlePdfCommand({ command, args = [], inputPath = null, outputPath = null, inputExt = 'pdf', userId = '', platform = 'telegram' }) {
    const isToPdf = command === '/topdf';
    let mode = isToPdf ? 'topdf' : '';
    let outputFormat = 'pdf';
    let rotateAngle = 0;
    let extractPages = '';

    if (!isToPdf) {
        const action = String(args[0] || '').toLowerCase().trim();

        if (action === 'merge') {
            const mergeAction = String(args[1] || '').toLowerCase().trim();

            if (mergeAction === 'start') {
                pdfMergeSessionManager.startSession(userId);
                const msg = platform === 'telegram'
                    ? '✅ Mode Merge Aktif! Kirim file PDF satu per satu. Ketik /pdf merge done jika sudah semua, atau /pdf merge cancel untuk batal.'
                    : '✅ Mode Merge Aktif! Kirim file PDF satu per satu. Ketik `/pdf merge done` jika sudah semua, atau `/pdf merge cancel` untuk batal.';
                return { type: 'message', message: msg };
            }

            if (mergeAction === 'cancel') {
                pdfMergeSessionManager.clearSession(userId);
                return { type: 'message', message: '❌ Merge dibatalkan. Semua file sesi dihapus.' };
            }

            if (mergeAction === 'done') {
                const sessionFiles = pdfMergeSessionManager.getSessionFiles(userId);
                if (!Array.isArray(sessionFiles) || sessionFiles.length < 2) {
                    return { type: 'message', message: '❌ Minimal butuh 2 file PDF!' };
                }

                try {
                    await mergePdfs(sessionFiles, outputPath);
                    pdfMergeSessionManager.clearSession(userId);
                    const caption = platform === 'telegram'
                        ? '<b>✅ PDF MERGE BERHASIL</b>\n\nSemua file PDF berhasil digabung.'
                        : '*✅ PDF MERGE BERHASIL*\n\nSemua file PDF berhasil digabung.';
                    return { type: 'file', success: true, caption, outputPath, outputFormat: 'pdf' };
                } catch (err) {
                    pdfMergeSessionManager.clearSession(userId);
                    throw err;
                }
            }

            const formatError = platform === 'telegram'
                ? '<b>❌ Format Salah</b>\n\nGunakan:\n<code>/pdf merge start</code>\n<code>/pdf merge done</code>\n<code>/pdf merge cancel</code>'
                : '> *❌ FORMAT SALAH*\n\nGunakan:\n`/pdf merge start`\n`/pdf merge done`\n`/pdf merge cancel`';
            return { type: 'message', message: formatError };
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
                const msg = platform === 'telegram'
                    ? '<b>❌ Format Salah</b>\n\nContoh rotasi: <code>/pdf rotate 90</code>'
                    : '> *❌ FORMAT SALAH*\n\nContoh rotasi: `/pdf rotate 90`';
                return { type: 'message', message: msg };
            }
        } else if (action === 'extract' && args.length > 1) {
            mode = 'extract';
            outputFormat = 'pdf';
            extractPages = args.slice(1).join(' ').trim();
            if (!extractPages) {
                const msg = platform === 'telegram'
                    ? '<b>❌ Format Salah</b>\n\nContoh extract: <code>/pdf extract 1-3,5</code>'
                    : '> *❌ FORMAT SALAH*\n\nContoh extract: `/pdf extract 1-3,5`';
                return { type: 'message', message: msg };
            }
        } else {
            const msg = platform === 'telegram'
                ? '<b>❌ Format Salah</b>\n\nGunakan:\n<code>/pdf compress</code>\n<code>/pdf to &lt;format&gt;</code>\n<code>/pdf rotate &lt;deg&gt;</code>\n<code>/pdf extract &lt;halaman&gt;</code>\n<code>/pdf merge start|done|cancel</code>'
                : '> *❌ FORMAT SALAH*\n\nGunakan:\n`/pdf compress`\n`/pdf to <format>`\n`/pdf rotate <deg>`\n`/pdf extract <halaman>`\n`/pdf merge start|done|cancel`';
            return { type: 'message', message: msg };
        }
    }

    // Process single file
    if (!inputPath || !outputPath) {
        throw new Error('Input or output path is missing for PDF operation');
    }

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

    const caption = platform === 'telegram'
        ? (isToPdf
            ? '<b>✅ TOPDF BERHASIL</b>\n\nFile berhasil dikonversi ke PDF.'
            : mode === 'compress'
                ? '<b>✅ PDF COMPRESS BERHASIL</b>\n\nFile PDF berhasil dikompres.'
                : mode === 'rotate'
                    ? `<b>✅ PDF ROTATE BERHASIL</b>\n\nSemua halaman diputar <code>${escapeHtml(String(rotateAngle))}</code> derajat.`
                    : mode === 'extract'
                        ? `<b>✅ PDF EXTRACT BERHASIL</b>\n\nHalaman terpilih: <code>${escapeHtml(extractPages)}</code>.`
                        : `<b>✅ PDF CONVERT BERHASIL</b>\n\nFile PDF berhasil dikonversi ke <code>${escapeHtml(outputFormat)}</code>.`)
        : (isToPdf
            ? '*✅ TOPDF BERHASIL*\n\nFile berhasil dikonversi ke PDF.'
            : mode === 'compress'
                ? '*✅ PDF COMPRESS BERHASIL*\n\nFile PDF berhasil dikompres.'
                : mode === 'rotate'
                    ? `*✅ PDF ROTATE BERHASIL*\n\nSemua halaman diputar ${rotateAngle} derajat.`
                    : mode === 'extract'
                        ? `*✅ PDF EXTRACT BERHASIL*\n\nHalaman terpilih: ${extractPages}.`
                        : `*✅ PDF CONVERT BERHASIL*\n\nFile PDF berhasil dikonversi ke ${outputFormat}.`);

    return {
        type: 'file',
        success: true,
        caption,
        outputPath,
        outputFormat
    };
}

module.exports = {
    handleImgCommand,
    handleRemoveBgCommand,
    handleHtmlToImageCommand,
    handleStickerCommand,
    handlePdfCommand
};
