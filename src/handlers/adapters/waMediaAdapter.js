const fs = require('fs/promises');
const fsSync = require('fs');
const path = require('path');
const { downloadMediaMessage } = require('@whiskeysockets/baileys');

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
const { pdfMergeSessionManager } = require('../../utils/sessionManager');

const MAX_FILE_SIZE = 5 * 1024 * 1024; // 5MB
const MAX_PDF_INPUT_SIZE = 10 * 1024 * 1024; // 10MB
const MAX_PDF_LOCAL_INPUT_SIZE = 15 * 1024 * 1024; // 15MB

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

function toFileSizeBytes(value) {
  if (value === null || value === undefined) {
    return 0;
  }
  if (typeof value === 'number') {
    return Number.isFinite(value) ? value : 0;
  }
  if (typeof value === 'bigint') {
    return Number(value);
  }
  if (typeof value === 'object') {
    if (typeof value.low === 'number') {
      return value.low;
    }
  }
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
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

function getMimeTypeFromExtension(ext) {
  const normalizedExt = String(ext || '').toLowerCase();
  const map = {
    pdf: 'application/pdf',
    doc: 'application/msword',
    docx: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    txt: 'text/plain',
    jpg: 'image/jpeg',
    jpeg: 'image/jpeg',
    png: 'image/png',
    webp: 'image/webp'
  };
  return map[normalizedExt] || 'application/octet-stream';
}

function isWhatsAppPdfDocument(documentMessage) {
  if (!documentMessage) return false;
  const extFromName = getExtensionFromFileName(documentMessage.fileName);
  const mimeType = String(documentMessage.mimetype || '').toLowerCase();
  return extFromName === 'pdf' || mimeType.includes('pdf');
}

function getMessageContextInfo(msg) {
  return msg.message?.extendedTextMessage?.contextInfo
    || msg.message?.buttonsResponseMessage?.contextInfo
    || msg.message?.templateButtonReplyMessage?.contextInfo
    || msg.message?.imageMessage?.contextInfo
    || msg.message?.videoMessage?.contextInfo
    || msg.message?.documentMessage?.contextInfo
    || null;
}

function unwrapMessageContent(message) {
  let current = message || {};
  while (true) {
    if (current?.ephemeralMessage?.message) {
      current = current.ephemeralMessage.message;
      continue;
    }
    if (current?.viewOnceMessage?.message) {
      current = current.viewOnceMessage.message;
      continue;
    }
    if (current?.viewOnceMessageV2?.message) {
      current = current.viewOnceMessageV2.message;
      continue;
    }
    if (current?.viewOnceMessageV2Extension?.message) {
      current = current.viewOnceMessageV2Extension.message;
      continue;
    }
    break;
  }
  return current;
}

function getStickerMediaSource(msg, contextInfo) {
  const directMessage = unwrapMessageContent(msg.message);
  const directImage = directMessage?.imageMessage;
  const directVideo = directMessage?.videoMessage;

  if (directImage) {
    return {
      mediaType: 'image',
      mediaMessage: msg,
      seconds: 0
    };
  }

  if (directVideo) {
    return {
      mediaType: 'video',
      mediaMessage: msg,
      seconds: Number(directVideo.seconds || 0)
    };
  }

  const quotedRaw = contextInfo?.quotedMessage;
  if (!quotedRaw) return null;

  const quotedMessage = unwrapMessageContent(quotedRaw);
  const quotedImage = quotedMessage?.imageMessage;
  const quotedVideo = quotedMessage?.videoMessage;

  if (!quotedImage && !quotedVideo) return null;

  return {
    mediaType: quotedVideo ? 'video' : 'image',
    mediaMessage: {
      key: {
        remoteJid: msg.key.remoteJid,
        id: contextInfo?.stanzaId || msg.key.id,
        participant: contextInfo?.participant || msg.key.participant,
        fromMe: false
      },
      message: quotedMessage
    },
    seconds: Number(quotedVideo?.seconds || 0)
  };
}

function formatWhatsAppReply(text) {
  return String(text || '').trim();
}

async function handleWhatsAppImageConverter(sock, msg, args) {
  let inputPath = null;
  let outputPath = null;

  try {
    const imageMsg = msg.message?.imageMessage;
    if (!imageMsg) {
      return '> *❌ ERROR CONVERTER*\n\nBalas pesan dengan gambar untuk menggunakan converter.';
    }

    const fileSizeBytes = imageMsg.fileLength || 0;
    if (fileSizeBytes > MAX_FILE_SIZE) {
      return '> *❌ Gagal*\n\nUkuran gambar maksimal 5MB!';
    }

    const timestamp = Date.now();
    const tempDir = await ensureTempDir();
    inputPath = path.join(tempDir, `input_${timestamp}.jpg`);
    outputPath = path.join(tempDir, `output_${timestamp}.jpg`);

    const buffer = await downloadMediaMessage(
      msg,
      'buffer',
      {},
      { reuploadRequest: sock.updateMediaMessage }
    );
    await fs.writeFile(inputPath, buffer);

    const action = String(args[0] || '').toLowerCase().trim();
    if (action === 'to' && args[1]) {
      const format = String(args[1]).toLowerCase();
      const formatMap = { jpg: '.jpg', jpeg: '.jpg', png: '.png', webp: '.webp' };
      const newExt = formatMap[format] || '.jpg';
      outputPath = path.join(tempDir, `output_${timestamp}${newExt}`);
    }

    const result = await handleImgCommand(args, inputPath, outputPath, 'whatsapp');

    const outputExists = await fs.stat(outputPath).catch(() => null);
    if (outputExists && result.success) {
      const fileBuffer = await fs.readFile(outputPath);
      const mediaType = outputPath.endsWith('.png') ? 'image/png' : outputPath.endsWith('.webp') ? 'image/webp' : 'image/jpeg';
      if (action === 'to') {
        await sock.sendMessage(msg.key.remoteJid, {
          document: fileBuffer,
          mimetype: mediaType,
          fileName: path.basename(outputPath),
          caption: '✅ File hasil konversi siap!'
        });
      } else {
        await sock.sendMessage(msg.key.remoteJid, {
          image: fileBuffer,
          mimetype: mediaType,
          caption: '✅ Gambar siap!'
        });
      }
    }

    return result.message;
  } catch (error) {
    console.error('Error in /img handler for WhatsApp:', error);
    return `> *❌ ERROR CONVERTER*\n\nGagal memproses gambar: ${error.message}`;
  } finally {
    if (inputPath) await fs.unlink(inputPath).catch(() => {});
    if (outputPath) await fs.unlink(outputPath).catch(() => {});
  }
}

async function handleWhatsAppSticker(sock, msg, contextInfo) {
  try {
    const mediaSource = getStickerMediaSource(msg, contextInfo);
    if (!mediaSource) {
      return '> *❌ FORMAT SALAH*\n\nKirim gambar/video atau balas gambar/video dengan command `/tosticker`.';
    }

    if (mediaSource.mediaType === 'video' && mediaSource.seconds > 5) {
      return '❌ Gagal: Durasi video maksimal 5 detik!';
    }

    const mediaBuffer = await downloadMediaMessage(
      mediaSource.mediaMessage,
      'buffer',
      {},
      { reuploadRequest: sock.updateMediaMessage }
    );

    const stickerRes = await handleStickerCommand(mediaBuffer, mediaSource.mediaType === 'video', 'whatsapp');
    if (stickerRes.success) {
      await sock.sendMessage(
        msg.key.remoteJid,
        { sticker: stickerRes.buffer },
        { quoted: msg }
      );
      return null;
    }
    return stickerRes.message;
  } catch (error) {
    console.error('Error in /tosticker handler for WhatsApp:', error);
    return `> *❌ ERROR STICKER*\n\nGagal membuat stiker: ${error.message}`;
  }
}

async function handleWhatsAppRemoveBg(sock, msg) {
  let inputPath = null;
  let outputPath = null;

  try {
    const imageMsg = msg.message?.imageMessage;
    if (!imageMsg) {
      return '> *❌ ERROR REMOVE BG*\n\nBalas pesan dengan gambar untuk menghapus background.';
    }

    const fileSizeBytes = imageMsg.fileLength || 0;
    if (fileSizeBytes > MAX_FILE_SIZE) {
      return '> *❌ Gagal*\n\nUkuran gambar maksimal 5MB!';
    }

    const timestamp = Date.now();
    const tempDir = await ensureTempDir();
    inputPath = path.join(tempDir, `input_bg_${timestamp}.jpg`);
    outputPath = path.join(tempDir, `output_bg_${timestamp}.png`);

    const buffer = await downloadMediaMessage(
      msg,
      'buffer',
      {},
      { reuploadRequest: sock.updateMediaMessage }
    );
    await fs.writeFile(inputPath, buffer);

    const bgRes = await handleRemoveBgCommand(inputPath, outputPath, 'whatsapp');
    if (bgRes.success) {
      const fileBuffer = await fs.readFile(outputPath);
      await sock.sendMessage(
        msg.key.remoteJid,
        {
          image: fileBuffer,
          mimetype: 'image/png',
          caption: bgRes.caption
        },
        { quoted: msg }
      );
      return null;
    }
    return bgRes.message;
  } catch (error) {
    console.error('Error in /hapusbg handler for WhatsApp:', error);
    return `> *ERROR REMOVE BG*\n\n❌ Error: ${error.message}`;
  } finally {
    if (inputPath) await fs.unlink(inputPath).catch(() => {});
    if (outputPath) await fs.unlink(outputPath).catch(() => {});
  }
}

async function handleWhatsAppScreenshot(sock, msg, args) {
  let outputPath = null;

  try {
    const url = args.join(' ').trim();
    const timestamp = Date.now();
    const tempDir = await ensureTempDir();
    outputPath = path.join(tempDir, `output_ss_${timestamp}.jpg`);

    const ssRes = await handleHtmlToImageCommand(url, outputPath, 'whatsapp');
    if (ssRes.success) {
      const fileBuffer = await fs.readFile(outputPath);
      await sock.sendMessage(
        msg.key.remoteJid,
        {
          image: fileBuffer,
          mimetype: 'image/jpeg',
          caption: ssRes.caption
        },
        { quoted: msg }
      );
      return null;
    }
    return ssRes.message;
  } catch (error) {
    console.error('Error in /ss handler for WhatsApp:', error);
    return `> *ERROR SCREENSHOT*\n\n❌ Error: ${error.message}`;
  } finally {
    if (outputPath) await fs.unlink(outputPath).catch(() => {});
  }
}

async function handleWhatsAppPdf(sock, msg, command, args, userId) {
  let inputPath = null;
  let outputPath = null;

  try {
    const action = String(args[0] || '').toLowerCase().trim();
    if (command === '/pdf' && action === 'merge') {
      const timestamp = Date.now();
      const tempDir = await ensureTempDir();
      outputPath = path.join(tempDir, `merged_${timestamp}.pdf`);

      const pdfRes = await handlePdfCommand({
        command,
        args,
        outputPath,
        userId,
        platform: 'whatsapp'
      });

      if (pdfRes.type === 'message') {
        return pdfRes.message;
      }
      if (pdfRes.success) {
        const fileBuffer = await fs.readFile(outputPath);
        await sock.sendMessage(
          msg.key.remoteJid,
          {
            document: fileBuffer,
            mimetype: 'application/pdf',
            fileName: path.basename(outputPath),
            caption: pdfRes.caption
          },
          { quoted: msg }
        );
        return null;
      }
      return null;
    }

    const documentMsg = msg.message?.documentMessage;
    const imageMsg = msg.message?.imageMessage;
    const videoMsg = msg.message?.videoMessage;
    let source = null;

    if (documentMsg) {
      source = {
        mediaMessage: documentMsg,
        inputExt: getExtensionFromFileName(documentMsg.fileName) || getExtensionFromMimeType(documentMsg.mimetype) || 'bin',
        fileSize: toFileSizeBytes(documentMsg.fileLength)
      };
    } else if (imageMsg) {
      source = {
        mediaMessage: imageMsg,
        inputExt: getExtensionFromMimeType(imageMsg.mimetype) || 'jpg',
        fileSize: toFileSizeBytes(imageMsg.fileLength)
      };
    } else if (videoMsg) {
      source = {
        mediaMessage: videoMsg,
        inputExt: getExtensionFromMimeType(videoMsg.mimetype) || 'mp4',
        fileSize: toFileSizeBytes(videoMsg.fileLength)
      };
    }

    if (!source) {
      return command === '/topdf'
        ? '> *❌ FILE TIDAK DITEMUKAN*\n\nKirim dokumen/media dengan caption `/topdf`.'
        : '> *❌ FILE TIDAK DITEMUKAN*\n\nKirim file PDF dengan caption `/pdf compress` atau `/pdf to <format>`.';
    }

    const isLocalPdf = action === 'rotate' || action === 'extract';
    const maxSize = isLocalPdf ? MAX_PDF_LOCAL_INPUT_SIZE : MAX_PDF_INPUT_SIZE;
    if (source.fileSize > maxSize) {
      return `> *❌ Gagal: Ukuran file maksimal ${isLocalPdf ? '15MB' : '10MB'}!*`;
    }

    const isPdfInput = source.inputExt === 'pdf' || String(documentMsg?.mimetype || '').toLowerCase().includes('pdf');
    if (command === '/pdf' && !isPdfInput) {
      return '> *❌ FORMAT SALAH*\n\nCommand `/pdf` hanya untuk file PDF.';
    }

    let outputFormat = 'pdf';
    if (action === 'to' && args[1]) {
      outputFormat = String(args[1]).replace(/^\./, '').toLowerCase();
    }

    const timestamp = Date.now();
    const tempDir = await ensureTempDir();
    inputPath = path.join(tempDir, `input_${timestamp}.${source.inputExt}`);
    outputPath = path.join(tempDir, `output_${timestamp}.${outputFormat}`);

    const buffer = await downloadMediaMessage(
      msg,
      'buffer',
      {},
      { reuploadRequest: sock.updateMediaMessage }
    );
    await fs.writeFile(inputPath, buffer);

    const pdfRes = await handlePdfCommand({
      command,
      args,
      inputPath,
      outputPath,
      inputExt: source.inputExt,
      userId,
      platform: 'whatsapp'
    });

    if (pdfRes.type === 'message') {
      return pdfRes.message;
    }
    if (pdfRes.success) {
      const fileBuffer = await fs.readFile(outputPath);
      await sock.sendMessage(
        msg.key.remoteJid,
        {
          document: fileBuffer,
          mimetype: getMimeTypeFromExtension(pdfRes.outputFormat || 'pdf'),
          fileName: path.basename(outputPath),
          caption: pdfRes.caption
        },
        { quoted: msg }
      );
      return null;
    }
    return null;
  } catch (error) {
    console.error(`Error in ${command} handler for WhatsApp:`, error);
    return `> *ERROR PDF TOOLS*\n\n${error.message}`;
  } finally {
    safeUnlinkSync(inputPath);
    safeUnlinkSync(outputPath);
  }
}

async function handleWhatsAppPdfMergeUpload(sock, msg, incomingDocumentMsg, userId) {
  let downloadPath = null;
  try {
    const fileSizeBytes = toFileSizeBytes(incomingDocumentMsg.fileLength);
    if (fileSizeBytes > MAX_PDF_LOCAL_INPUT_SIZE) {
      await sock.sendMessage(
        msg.key.remoteJid,
        { text: '> *❌ Gagal*\n\nUkuran file maksimal 15MB per PDF untuk merge.' },
        { quoted: msg }
      );
      return;
    }

    const timestamp = Date.now();
    const tempDir = await ensureTempDir();
    const nextIndex = pdfMergeSessionManager.getSessionFiles(userId).length + 1;
    downloadPath = path.join(tempDir, `input_merge_${timestamp}_${nextIndex}.pdf`);

    const buffer = await downloadMediaMessage(
      msg,
      'buffer',
      {},
      { reuploadRequest: sock.updateMediaMessage }
    );
    await fs.writeFile(downloadPath, buffer);
    const totalFiles = pdfMergeSessionManager.addFileToSession(userId, downloadPath);

    await sock.sendMessage(
      msg.key.remoteJid,
      { text: `📄 File ke-${totalFiles} diterima! Kirim lagi atau ketik \`/pdf merge done\`.` },
      { quoted: msg }
    );
  } catch (error) {
    safeUnlinkSync(downloadPath);
    console.error('Error saat menerima file merge PDF WhatsApp:', error);
    await sock.sendMessage(
      msg.key.remoteJid,
      { text: `> *ERROR PDF MERGE* ❌\n\n${error.message}` },
      { quoted: msg }
    );
  }
}

async function handleWhatsAppDownloader(sock, msg, command, args) {
  const targetUrl = args.join(' ').trim();
  if (command === '/download') {
    if (!targetUrl) {
      return '❌ Masukkan link media! Contoh: /download https://www.instagram.com/reel/xxxx';
    }

    await sock.sendMessage(
      msg.key.remoteJid,
      { text: '⏳ Sedang memproses media, mohon tunggu sebentar...' },
      { quoted: msg }
    );

    const result = await handleDownloadCommand(targetUrl, 'whatsapp');
    if (!result.success) {
      return result.message;
    }

    for (const item of result.items) {
      if (item.type === 'video') {
        await sock.sendMessage(
          msg.key.remoteJid,
          { video: item.buffer, mimetype: 'video/mp4' },
          { quoted: msg }
        );
      } else {
        await sock.sendMessage(
          msg.key.remoteJid,
          { image: item.buffer, mimetype: 'image/jpeg' },
          { quoted: msg }
        );
      }
      await new Promise((resolve) => setTimeout(resolve, 1500));
    }
    return null;
  }

  if (command === '/audio') {
    if (!targetUrl) {
      return '❌ Masukkan link media! Contoh: /audio https://www.youtube.com/watch?v=xxxx';
    }

    await sock.sendMessage(
      msg.key.remoteJid,
      { text: '⏳ Sedang memproses audio, mohon tunggu sebentar...' },
      { quoted: msg }
    );

    const result = await handleAudioCommand(targetUrl, 'whatsapp');
    if (!result.success) {
      return result.message;
    }

    await sock.sendMessage(
      msg.key.remoteJid,
      {
        audio: result.buffer,
        mimetype: result.mimetype || 'audio/mpeg',
        ptt: false
      },
      { quoted: msg }
    );
    return null;
  }

  return null;
}

module.exports = {
  MAX_FILE_SIZE,
  MAX_PDF_INPUT_SIZE,
  MAX_PDF_LOCAL_INPUT_SIZE,
  ensureTempDir,
  safeUnlinkSync,
  toFileSizeBytes,
  getExtensionFromFileName,
  getExtensionFromMimeType,
  getMimeTypeFromExtension,
  isWhatsAppPdfDocument,
  getMessageContextInfo,
  unwrapMessageContent,
  getStickerMediaSource,
  formatWhatsAppReply,
  handleWhatsAppImageConverter,
  handleWhatsAppSticker,
  handleWhatsAppRemoveBg,
  handleWhatsAppScreenshot,
  handleWhatsAppPdf,
  handleWhatsAppPdfMergeUpload,
  handleWhatsAppDownloader
};
