const os = require('os');
const fs = require('fs/promises');
const fsSync = require('fs');
const path = require('path');
const { downloadMediaMessage } = require('@whiskeysockets/baileys');
const { askAiDetailed, translateText } = require('../lib/aiClient');
const handleFinanceCommand = require('../commands/finance/index');
const { handleAdminCommand } = require('../commands/admin/index');
const { isAdmin } = require('../utils/auth');
const { checkWebsites, formatMonitorMessage } = require('../services/monitorService');
const { AI_MODELS, buildModelInfoMessage, setActiveModel } = require('../services/aiPreferenceService');
const { handleImgCommand } = require('../commands/converter/index');
const { handleReminderCommand } = require('../commands/reminder/index');
const { createSticker, isFfmpegMissingError } = require('../services/stickerService');
const { getQuotaStatus } = require('../services/quotaService');
const { sendToSheet, updateStatusAnswered } = require('../services/csService');
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
const MAX_PDF_INPUT_SIZE = 10 * 1024 * 1024;
const MAX_PDF_LOCAL_INPUT_SIZE = 15 * 1024 * 1024;
const mergeSessions = {};

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
    `*CPU:* ${getCpuUsagePercent()}%`,
    `*RAM:* ${getRamUsageText()}`,
    `*UPTIME:* ${formatDuration(os.uptime())}`,
    `*STATUS:* ONLINE`
  ].join('\n');
}

function buildAiStatsFooter(aiMeta = {}) {
  const model = aiMeta.modelName || aiMeta.model || '-';
  const tokenIn = aiMeta.usage?.promptTokenCount ?? 0;
  const tokenOut = aiMeta.usage?.candidatesTokenCount ?? 0;
  const rpmLabel = aiMeta.rpm?.label || '-';

  return [
    '—'.repeat(19),
    `*Model:* ${model}`,
    `*Token In:* ${tokenIn} | *Token Out:* ${tokenOut}`,
    `*RPM:* ${rpmLabel}`
  ].join('\n');
}

function appendFooter(text, footer) {
  const base = String(text || '').trim();
  const foot = String(footer || '').trim();
  if (!base) return foot;
  if (!foot) return base;
  return `${base}\n\n${foot}`;
}

function formatWhatsAppReply(text) {
  const lines = String(text || '').split('\n');
  const isBoxLine = (line) => /^[┌├└]\s/.test(String(line || '').trim());

  const bodyBoxIndexes = [];
  for (let i = 0; i < lines.length; i += 1) {
    if (isBoxLine(lines[i])) {
      bodyBoxIndexes.push(i);
    }
  }

  if (bodyBoxIndexes.length === 0) {
    return String(text || '');
  }

  const lastBodyBoxIndex = bodyBoxIndexes[bodyBoxIndexes.length - 1];
  const firstFooterLineIndex = lines.findIndex((line, index) => index > lastBodyBoxIndex && String(line || '').trim().length > 0);

  if (firstFooterLineIndex === -1) {
    return String(text || '');
  }

  const formatted = [];
  for (let i = 0; i < lines.length; i += 1) {
    const line = lines[i];

    if (i === firstFooterLineIndex) {
      if (formatted.length > 0 && String(formatted[formatted.length - 1]).trim().length > 0) {
        formatted.push('');
      }
      formatted.push('—'.repeat(19));
    }

    formatted.push(line);
  }

  return formatted.join('\n');
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

  const removeBgLimit = formatQuotaLimit(removeBgStatus.limit);
  const htmlToImageLimit = formatQuotaLimit(htmlToImageStatus.limit);

  return [
    '—'.repeat(19),
    `*RemoveBG:* Usage: ${formatQuotaUsageText(removeBgStatus)} | Limit: ${removeBgLimit}`,
    `*html2img:* Usage: ${formatQuotaUsageText(htmlToImageStatus)} | Limit: ${htmlToImageLimit}`
  ].join('\n');
}

async function buildPdfToolsQuotaFooter() {
  const cloudConvertStatus = await getQuotaStatus('cloudconvert', 10, true);
  const cloudConvertLimit = formatQuotaLimit(cloudConvertStatus.limit);
  const cloudConvertUsage = formatQuotaUsageText(cloudConvertStatus);

  return [
    '—'.repeat(19),
    `*CloudConvert:* Usage: ${cloudConvertUsage} | Limit: ${cloudConvertLimit}`
  ].join('\n');
}

function buildBookRecommendationText(keyword, books = []) {
  const safeKeyword = String(keyword || '').trim();
  const lines = [`📚 REKOMENDASI BUKU: ${safeKeyword}`];

  books.slice(0, 5).forEach((book, index) => {
    lines.push('');
    lines.push(`${index + 1}. ${String(book?.title || '-')}`);
    lines.push(`   👤 Penulis: ${String(book?.author || '-')}`);
    lines.push(`   📅 Tahun: ${String(book?.year || '-')}`);
    lines.push(`   🔗 Link: ${String(book?.url || 'https://openlibrary.org')}`);
  });

  return lines.join('\n');
}

function buildJournalRecommendationText(keyword, journals = []) {
  const safeKeyword = String(keyword || '').trim();
  const lines = [`🎓 REFERENSI JURNAL: ${safeKeyword}`];

  journals.slice(0, 5).forEach((item, index) => {
    lines.push('');
    lines.push(`${index + 1}. ${String(item?.title || '-')}`);
    lines.push(`   👤 Penulis: ${String(item?.author || '-')}`);
    lines.push(`   📚 Jurnal: ${String(item?.journal || '-')}`);
    lines.push(`   📅 Tahun: ${String(item?.year || '-')}`);
    lines.push(`   🔗 DOI: ${String(item?.doiUrl || '-')}`);
  });

  return lines.join('\n');
}

function buildArticleRecommendationText(keyword, articles = []) {
  const safeKeyword = String(keyword || '').trim();
  const lines = [`📰 REFERENSI ARTIKEL: ${safeKeyword}`];

  articles.slice(0, 5).forEach((item, index) => {
    lines.push('');
    lines.push(`${index + 1}. ${String(item?.title || '-')}`);
    lines.push(`   👤 Penulis: ${String(item?.author || '-')}`);
    lines.push(`   📅 Tahun: ${String(item?.year || '-')}`);
    lines.push(`   🔗 Link: ${String(item?.link || '-')}`);
  });

  return lines.join('\n');
}

function normalizeWhatsAppId(value) {
  return String(value || '')
    .split('@')[0]
    .split(':')[0]
    .replace(/[^\d]/g, '');
}

function toWhatsAppJid(value) {
  const raw = String(value || '').trim();
  if (!raw) {
    return '';
  }

  if (raw.includes('@g.us')) {
    return raw;
  }

  const normalized = normalizeWhatsAppId(raw);
  return normalized ? `${normalized}@s.whatsapp.net` : '';
}

function resolveWhatsAppSenderJid(msg, fallbackUserId = '') {
  const candidates = [
    msg?.key?.senderPn,
    msg?.key?.participant,
    fallbackUserId,
    msg?.key?.remoteJid
  ];

  for (const candidate of candidates) {
    const raw = String(candidate || '').trim();
    if (!raw || raw.endsWith('@g.us') || raw.includes('@lid')) {
      continue;
    }

    const jid = toWhatsAppJid(raw);
    if (jid) {
      return jid;
    }
  }

  return '';
}

function escapeRegex(value) {
  return String(value || '').replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function toFileSizeBytes(value) {
  if (typeof value === 'number' && Number.isFinite(value)) {
    return value;
  }

  if (typeof value === 'bigint') {
    return Number(value);
  }

  if (value && typeof value === 'object') {
    if (typeof value.toNumber === 'function') {
      return value.toNumber();
    }

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
  if (!documentMessage) {
    return false;
  }

  const extFromName = getExtensionFromFileName(documentMessage.fileName);
  const mimeType = String(documentMessage.mimetype || '').toLowerCase();
  return extFromName === 'pdf' || mimeType.includes('pdf');
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
  if (!quotedRaw) {
    return null;
  }

  const quotedMessage = unwrapMessageContent(quotedRaw);
  const quotedImage = quotedMessage?.imageMessage;
  const quotedVideo = quotedMessage?.videoMessage;

  if (!quotedImage && !quotedVideo) {
    return null;
  }

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

function cleanMentionFromGroupText(text, mentionIds = []) {
  let cleanText = String(text || '').trim();
  const normalizedMentionIds = mentionIds
    .map((mentionId) => normalizeWhatsAppId(mentionId))
    .filter(Boolean);

  for (const mentionId of normalizedMentionIds) {
    const mentionRegex = new RegExp(`@${escapeRegex(mentionId)}\\b`, 'gi');
    cleanText = cleanText.replace(mentionRegex, ' ');
  }

  // Handle case where mentions are at the beginning of the message followed by a command (e.g. "@bot /command")
  cleanText = cleanText.replace(/^(@\S+\s+)+(?=\/)/, '');

  return cleanText.replace(/\s{2,}/g, ' ').trim();
}

class WhatsAppHandler {
  constructor(sock) {
    this.sock = sock;
    this.setup();
  }

  setup() {
    this.sock.ev.on('messages.upsert', async (m) => {
      if (m.type !== 'notify') return;

      const msg = m.messages[0];
      if (!msg.message || msg.key.fromMe) return;

      const isGroup = msg.key.remoteJid.endsWith('@g.us');
      const userId = isGroup
        ? (msg.key.participant || msg.participant || msg.key.remoteJid)
        : msg.key.remoteJid;
      const botJid = this.sock.user?.id || '';
      const botNumber = normalizeWhatsAppId(botJid);
      let text = '';

      if (msg.message?.conversation) {
        text = msg.message.conversation;
      } else if (msg.message?.extendedTextMessage?.text) {
        text = msg.message.extendedTextMessage.text;
      } else if (msg.message?.imageMessage?.caption) {
        text = msg.message.imageMessage.caption;
      } else if (msg.message?.documentMessage?.caption) {
        text = msg.message.documentMessage.caption;
      } else if (msg.message?.videoMessage?.caption) {
        text = msg.message.videoMessage.caption;
      } else if (msg.message?.buttonsResponseMessage?.selectedButtonId) {
        text = msg.message.buttonsResponseMessage.selectedButtonId;
      } else if (msg.message?.templateButtonReplyMessage?.selectedId) {
        text = msg.message.templateButtonReplyMessage.selectedId;
      }

      const contextInfo = getMessageContextInfo(msg);
      const mentionedJids = contextInfo?.mentionedJid || [];
      const botLid = normalizeWhatsAppId(process.env.BOT_WA_LID);
      const incomingDocumentMsg = msg.message?.documentMessage;
      const hasPdfDocument = isWhatsAppPdfDocument(incomingDocumentMsg);
      const hasActiveMergeSession = Array.isArray(mergeSessions[userId]);
      const isBotMentioned = mentionedJids.some((jid) => {
        // Hapus @s.whatsapp.net atau @lid beserta suffix device (:x)
        const normalizedJid = normalizeWhatsAppId(jid);
        return normalizedJid === botNumber || normalizedJid === botLid;
      });
      const isReplyToBot = normalizeWhatsAppId(contextInfo?.participant) === botNumber;
      
      // In group chats, bot only responds if bot is mentioned, or it's a reply to bot's message
      // If it does not these requirements, ignore the entire message
      if (isGroup && !isBotMentioned && !isReplyToBot && !(hasActiveMergeSession && hasPdfDocument)) {
        return;
      }

      let cleanText = text.trim();
      if (isGroup && isBotMentioned) {
        cleanText = cleanMentionFromGroupText(cleanText, [botNumber, botLid, ...mentionedJids]);
      }

      if (isGroup && !cleanText && !(hasActiveMergeSession && hasPdfDocument)) {
        return;
      }

      let replyText = '';

      if (hasPdfDocument && hasActiveMergeSession) {
        let downloadPath = null;

        try {
          const fileSizeBytes = toFileSizeBytes(incomingDocumentMsg.fileLength);
          if (fileSizeBytes > MAX_PDF_LOCAL_INPUT_SIZE) {
            await this.sock.sendMessage(
              msg.key.remoteJid,
              { text: '> *❌ Gagal*\n\nUkuran file maksimal 15MB per PDF untuk merge.' },
              { quoted: msg }
            );
            return;
          }

          const timestamp = Date.now();
          const tempDir = await ensureTempDir();
          const nextIndex = mergeSessions[userId].length + 1;
          downloadPath = path.join(tempDir, `input_merge_${timestamp}_${nextIndex}.pdf`);

          const buffer = await downloadMediaMessage(
            msg,
            'buffer',
            {},
            { reuploadRequest: this.sock.updateMediaMessage }
          );
          await fs.writeFile(downloadPath, buffer);
          mergeSessions[userId].push(downloadPath);

          await this.sock.sendMessage(
            msg.key.remoteJid,
            { text: `📄 File ke-${mergeSessions[userId].length} diterima! Kirim lagi atau ketik \`/pdf merge done\`.` },
            { quoted: msg }
          );
        } catch (error) {
          safeUnlinkSync(downloadPath);
          console.error('Error saat menerima file merge PDF WhatsApp:', error);
          await this.sock.sendMessage(
            msg.key.remoteJid,
            { text: `> *ERROR PDF MERGE* ❌\n\n${error.message}` },
            { quoted: msg }
          );
        }

        return;
      }

      if (cleanText.startsWith('/')) {
        const parts = cleanText.split(' ');
        const command = parts[0].toLowerCase();
        const args = parts.slice(1);

        const realId = resolveWhatsAppSenderJid(msg, userId);

        // Log Command with Real Sender ID
        if (command && realId) {
            await logCommand(realId, 'whatsapp', command);
        }

        switch (command) {
          case '/ping':
            replyText = appendFooter('Pong! 🏓', buildSystemStatsFooter());
            break;

          case '/saldo':
          case '/catat':
          case '/pemasukan':
          case '/laporan_chart':
          case '/riwayat':
          case '/hapus':
          case '/edit': {
            const financeReply = await handleFinanceCommand(command, args, msg.key.remoteJid, 'whatsapp');
            if (financeReply) {
              if (typeof financeReply === 'object' && financeReply.type === 'image') {
                await this.sock.sendMessage(
                  msg.key.remoteJid,
                  {
                    image: { url: financeReply.url },
                    caption: formatWhatsAppReply(financeReply.caption || '')
                  },
                  { quoted: msg }
                );
              } else {
                await this.sock.sendMessage(
                  msg.key.remoteJid,
                  { text: formatWhatsAppReply(financeReply) },
                  { quoted: msg }
                );
              }
              return;
            }
            break;
          }

          case '/remind': {
            const remindReply = await handleReminderCommand(args, realId, 'whatsapp');
            await this.sock.sendMessage(
              msg.key.remoteJid,
              { text: formatWhatsAppReply(remindReply) },
              { quoted: msg }
            );
            return;
          }

          case '/translate': {
            const lang = args[0];
            const optionalText = args.slice(1).join(' ');
            let targetText = optionalText;

            const quotedMsg = msg.message?.extendedTextMessage?.contextInfo?.quotedMessage;
            if (quotedMsg) {
              targetText = quotedMsg.conversation ||
                           quotedMsg.extendedTextMessage?.text ||
                           quotedMsg.imageMessage?.caption ||
                           quotedMsg.videoMessage?.caption ||
                           targetText;
            }

            if (!lang || !targetText || !targetText.trim()) {
              replyText = '> *FORMAT SALAH* ❌\n\nGunakan: `/translate [kode_bahasa] [teks]`\nAtau reply pesan dengan `/translate [kode_bahasa]`.\n\nContoh: `/translate en Halo dunia`';
            } else {
              try {
                const translatedText = await translateText(lang, targetText);
                replyText = `Terjemahan ke ${lang}:\n${translatedText}`;
              } catch (err) {
                console.error('Error in /translate:', err);
                replyText = `> *GAGAL MENERJEMAHKAN* ❌\n\nMaaf, terjadi kesalahan: ${err.message}`;
              }
            }
            break;
          }

          case '/finance_info': {
            const header = '> *FINANCE TOOLS* 💰';
            const body = `Panduan lengkap fitur keuangan Fuenzer Bot.\n\n*COMMAND INTI:*\n- /saldo : Lihat ringkasan saldo terbaru\n- /catat <nominal> <keterangan> : Catat pengeluaran\n- /pemasukan <nominal> <keterangan> : Catat pemasukan\n- /laporan_chart : Tampilkan grafik laporan\n- /riwayat [halaman] : Riwayat transaksi (paging 5 data)\n- /edit <id> <field> <nilai> : Ubah transaksi\n- /hapus <id> : Hapus transaksi (dengan konfirmasi)\n\n*CONTOH CEPAT:*\n- /catat 25000 makan siang\n- /pemasukan 150000 freelance logo\n- /riwayat 2\n- /edit 123e4567 nominal 30000\n- /hapus 123e4567\n\n*TIPS:*\n- Gunakan /riwayat untuk ambil ID transaksi sebelum /edit atau /hapus\n- Tulisan nominal tanpa titik/koma agar lebih aman diproses`;
            replyText = `${header}\n\n${body}`;
            break;
          }

          case '/remind_info': {
            const header = '> *REMINDER TOOLS* ⏰';
            const body = `Panduan lengkap fitur pengingat (Reminder) Fuenzer Bot.\n\n*COMMAND INTI:*\n- /remind add <waktu> <pesan> : Buat pengingat sekali jalan\n- /remind loop <waktu> <pesan> : Buat pengingat berulang\n- /remind list : Tampilkan semua pengingat yang aktif\n- /remind hapus <id> : Hapus pengingat berdasarkan ID\n- /remind edit <id> <waktu> <pesan> : Edit pengingat\n\n*FORMAT WAKTU (Support Ms):*\n- Detik: \`5s\`, \`30s\`, \`60s\`\n- Menit: \`1m\`, \`15m\`, \`30m\`\n- Jam: \`1h\`, \`2h\`, \`12h\`\n- Hari: \`1d\`, \`2d\`, \`7d\`\n\n*CONTOH CEPAT:*\n- /remind add 15m angkat jemuran\n- /remind loop 1d minum vitamin pagi\n- /remind edit A1B2C 2h minum vitamin siang\n- /remind hapus A1B2C\n\n*TIPS:*\n- Gunakan \`/remind list\` untuk melihat ID unik dari pengingat Anda. ID ini digunakan saat Anda ingin mengedit atau menghapus pengingat.\n- Pengingat berulang (loop) akan selalu berjalan dengan interval yang telah ditentukan kecuali dihapus.`;
            replyText = `${header}\n\n${body}`;
            break;
          }

          case '/translate_info': {
            const header = '> *TRANSLATE TOOLS* 🌍';
            const body = `Panduan menggunakan fitur terjemahan AI.\n\n*COMMAND INTI:*\n- \`/translate <kode_bahasa> <teks>\`\n- Atau *reply* pesan yang ingin diterjemahkan dengan \`/translate <kode_bahasa>\`\n\n*DAFTAR KODE BAHASA (Ketikkan 2 huruf ini):*\n- \`en\` : English (Inggris)\n- \`id\` : Indonesia\n- \`jv\` : Javanese (Jawa)\n- \`su\` : Sundanese (Sunda)\n- \`ms\` : Sundanese (Sunda)\n- \`ar\` : Arabic (Arab)\n- \`ja\` : Japanese (Jepang)\n- \`ko\` : Korean (Korea)\n- \`zh\` : Chinese (Mandarin)\n- \`hi\` : Hindi (India)\n- \`ru\` : Russian (Rusia)\n- \`es\` : Spanish (Spanyol)\n- \`fr\` : French (Perancis)\n- \`de\` : German (Jerman)\n- \`it\` : Italian (Italia)\n- \`nl\` : Dutch (Belanda)\n- \`pt\` : Portuguese (Portugis)\n- \`th\` : Thai (Thailand)\n- \`vi\` : Vietnamese (Vietnam)\n\n*CONTOH CEPAT:*\n- \`/translate en Halo dunia, apa kabar?\`\n- \`/translate ar Selamat pagi\`\n\n*TIPS:*\n- AI otomatis mendeteksi bahasa asli dari teks yang Anda berikan, Anda hanya perlu menentukan bahasa tujuannya.`;
            replyText = `${header}\n\n${body}`;
            break;
          }

          case '/research_info': {
            const header = '> *RESEARCH TOOLS* 📚';
            const body = `Panduan Lengkap fitur riset Referensi buku, jurnal, dan artikel ilmiah.\n\n*COMMAND INTI:*\n- /buku <keyword> : Cari rekomendasi buku dari Open Library\n- /jurnal <keyword> : Cari referensi jurnal/artikel ilmiah dari Crossref\n- /artikel <keyword> : Cari artikel ilmiah dari OpenAlex\n\n*CONTOH CEPAT:*\n- /buku atomic habits\n- /jurnal machine learning\n- /artikel deep learning healthcare\n\n*OUTPUT /buku:*\n- Judul buku\n- Nama penulis\n- Tahun terbit pertama\n- Link Open Library\n\n*OUTPUT /jurnal:*\n- Judul artikel/jurnal\n- Nama penulis\n- Nama jurnal\n- Tahun terbit\n- Link DOI\n\n*OUTPUT /artikel:*\n- Judul artikel\n- Penulis (maks. 3 nama)\n- Tahun\n- Link PDF open access (jika tersedia) atau halaman artikel\n\n*TIPS:*\n- /jurnal bisa dipakai juga untuk cari artikel ilmiah berbasis kata kunci\n- Pakai kata kunci spesifik agar hasil lebih relevan\n- Jika hasil kurang pas, coba variasi bahasa Inggris/Indonesia`;
            replyText = `${header}\n\n${body}`;
            break;
          }

          case '/downloader': {
            const header = '> *DOWNLOADER TOOLS* ⬇️';
            const body = `Panduan Lengkap untuk download media dan audio.\n\n*COMMAND DOWNLOAD:*\n- /download <url> : Download media sosial (video/foto)\n- /audio <url> : Download audio dari YouTube/YouTube Music\n\n*CONTOH CEPAT:*\n- /download https://www.instagram.com/reel/xxxx\n- /audio https://www.youtube.com/watch?v=xxxx\n\n*SUPPORT PLATFORM:*\n- /download hanya support: Instagram, Twitter/X, YouTube, dan TikTok\n- /audio hanya support: YouTube dan YouTube Music\n\n*CATATAN:*\n- Jika media terlalu besar atau sumber menolak koneksi, coba ulang beberapa saat lagi`;
            replyText = `${header}\n\n${body}`;
            break;
          }
          
          case '/cuaca': {
            const { handleWeatherCommand } = require('../services/weatherService');
            const weatherReply = await handleWeatherCommand(command, args, msg.key.remoteJid, 'whatsapp');
            replyText = weatherReply;
            break;
          }
          
          case '/sholat': {
            const { handleReligionCommand } = require('../services/religionService');
            const sholatReply = await handleReligionCommand(command, args, msg.key.remoteJid, 'whatsapp');
            replyText = sholatReply;
            break;
          }

          case '/admin': {
            if (!isAdmin(userId, 'whatsapp')) {
              replyText = '> *AKSES DITOLAK* ❌\n\nCommand ini khusus admin.';
              break;
            }

            const adminReply = await handleAdminCommand('/admin', args, userId, 'whatsapp');
            replyText = adminReply;

            break;
          }

          case '/monitor': {
            if (!isAdmin(userId, 'whatsapp')) {
              replyText = '> *AKSES DITOLAK* ❌\n\nCommand ini khusus admin.';
              break;
            }

            const { results } = await checkWebsites();
            const monitorReply = formatMonitorMessage(results, null, 'whatsapp');
            replyText = monitorReply;
            break;
          }
          
          case '/me': {
            const { handleAboutMeCommand } = require('../services/aboutService');
            const aboutReply = await handleAboutMeCommand(command, args, msg.key.remoteJid, 'whatsapp');
            replyText = aboutReply;
            break;
          }

          case '/buku': {
            const keyword = String(args.join(' ') || '').trim();

            if (!keyword) {
              replyText = '❌ Masukkan kata kunci buku! Contoh: /buku atomic habits';
              break;
            }

            try {
              await this.sock.sendMessage(
                msg.key.remoteJid,
                { text: '⏳ Sedang mencari referensi buku...' },
                { quoted: msg }
              );

              const books = await searchBooks(keyword);
              if (!Array.isArray(books) || books.length === 0) {
                replyText = `📚 REKOMENDASI BUKU: ${keyword}\n\nTidak ada hasil ditemukan. Coba keyword lain.`;
                break;
              }

              replyText = buildBookRecommendationText(keyword, books);
            } catch (error) {
              console.error('Error in /buku handler for WhatsApp:', error);
              const detailedMessage = String(error?.message || '').trim();
              replyText = detailedMessage || '❌ Gagal mencari buku. Coba lagi beberapa saat.';
            }
            break;
          }

          case '/jurnal': {
            const keyword = String(args.join(' ') || '').trim();

            if (!keyword) {
              replyText = '❌ Masukkan kata kunci jurnal/artikel! Contoh: /jurnal machine learning';
              break;
            }

            try {
              await this.sock.sendMessage(
                msg.key.remoteJid,
                { text: '⏳ Sedang mencari referensi jurnal/artikel...' },
                { quoted: msg }
              );

              const journals = await searchJournals(keyword);
              if (!Array.isArray(journals) || journals.length === 0) {
                replyText = `🎓 REFERENSI JURNAL: ${keyword}\n\nTidak ada hasil ditemukan. Coba keyword lain.`;
                break;
              }

              replyText = buildJournalRecommendationText(keyword, journals);
            } catch (error) {
              console.error('Error in /jurnal handler for WhatsApp:', error);
              const detailedMessage = String(error?.message || '').trim();
              replyText = detailedMessage || '❌ Gagal mencari jurnal. Coba lagi beberapa saat.';
            }
            break;
          }

          case '/artikel': {
            const keyword = String(args.join(' ') || '').trim();

            if (!keyword) {
              replyText = '❌ Masukkan kata kunci artikel! Contoh: /artikel machine learning';
              break;
            }

            try {
              await this.sock.sendMessage(
                msg.key.remoteJid,
                { text: '⏳ Sedang mencari artikel ilmiah...' },
                { quoted: msg }
              );

              const articles = await searchArticles(keyword);
              if (!Array.isArray(articles) || articles.length === 0) {
                replyText = `📰 REFERENSI ARTIKEL: ${keyword}\n\nTidak ada hasil ditemukan. Coba keyword lain.`;
                break;
              }

              replyText = buildArticleRecommendationText(keyword, articles);
            } catch (error) {
              console.error('Error in /artikel handler for WhatsApp:', error);
              const detailedMessage = String(error?.message || '').trim();
              replyText = detailedMessage || '❌ Gagal mencari artikel ilmiah. Coba lagi beberapa saat.';
            }
            break;
          }

          case '/model_info': {
            replyText = buildModelInfoMessage('whatsapp');
            break;
          }

          case '/switch': {
            const alias = String(args[0] || '').trim().toLowerCase();
            if (!alias) {
              replyText = '❌ Ketik alias modelnya! Contoh: /switch elephant. Cek /model_info.';
              break;
            }

            if (!AI_MODELS[alias]) {
              const knownAliases = Object.keys(AI_MODELS).join(', ');
              replyText = `❌ Alias model tidak ditemukan. Alias tersedia: ${knownAliases}. Cek /model_info.`;
              break;
            }

            try {
              await setActiveModel(userId, 'whatsapp', alias);
              replyText = `✅ Berhasil! Otak AI kamu sekarang menggunakan ${AI_MODELS[alias].name}.`;
            } catch (error) {
              console.error('Error handling /switch command in WhatsApp:', error);
              replyText = `❌ Gagal menyimpan model AI: ${error.message}`;
            }
            break;
          }

          case '/cmd_usage':
          case '/ai_usage': {
            if (!isAdmin(userId, 'whatsapp')) {
              replyText = '> *AKSES DITOLAK* ❌\n\nCommand ini khusus admin.';
              break;
            }

            const statsReply = await handleAdminCommand(command, args, userId, 'whatsapp');
            replyText = statsReply;
            break;
          }

          case '/answer':
          case '/broadcast': {
            if (!isAdmin(userId, 'whatsapp')) {
              replyText = '> *AKSES DITOLAK* ❌\n\nCommand ini khusus admin.';
              break;
            }

            const broadcastReply = await handleAdminCommand(command, args, userId, 'whatsapp', {
              notifyAdmin: async (textToAdmin) => {
                await this.sock.sendMessage(
                  msg.key.remoteJid,
                  { text: formatWhatsAppReply(String(textToAdmin || '')) },
                  { quoted: msg }
                );
              },
              sendToUser: async (targetId, textToSend) => {
                const targetJid = toWhatsAppJid(targetId);
                if (!targetJid) {
                  throw new Error('Invalid WhatsApp target');
                }

                await this.sock.sendMessage(targetJid, { text: String(textToSend || '') });
              }
            });

            if (command === '/answer' && args[0]) {
              await updateStatusAnswered(args[0]);
            }

            replyText = broadcastReply;
            break;
          }

          case '/img': {
            let inputPath = null;
            let outputPath = null;

            try {
              const imageMsg = msg.message?.imageMessage;
              if (!imageMsg) {
                replyText = '> *❌ ERROR CONVERTER*\n\nBalas pesan dengan gambar untuk menggunakan converter.';
                break;
              }

              const fileSizeBytes = imageMsg.fileLength || 0;
              if (fileSizeBytes > MAX_FILE_SIZE) {
                replyText = '> *❌ Gagal*\n\nUkuran gambar maksimal 5MB!';
                break;
              }

              const timestamp = Date.now();
              const tempDir = await ensureTempDir();
              inputPath = path.join(tempDir, `input_${timestamp}.jpg`);
              outputPath = path.join(tempDir, `output_${timestamp}.jpg`);

              const buffer = await downloadMediaMessage(
                msg,
                'buffer',
                {},
                { reuploadRequest: this.sock.updateMediaMessage }
              );
              await fs.writeFile(inputPath, buffer);

              const action = String(args[0] || '').toLowerCase().trim();
              if (action === 'to' && args[1]) {
                const format = String(args[1]).toLowerCase();
                const formatMap = { 'jpg': '.jpg', 'jpeg': '.jpg', 'png': '.png', 'webp': '.webp' };
                const newExt = formatMap[format] || '.jpg';
                outputPath = path.join(tempDir, `output_${timestamp}${newExt}`);
              }

              const resultMsg = await handleImgCommand(args, inputPath, outputPath, 'whatsapp');
              replyText = resultMsg;

              const outputExists = await fs.stat(outputPath).catch(() => null);
              if (outputExists && replyText.includes('BERHASIL')) {
                const fileBuffer = await fs.readFile(outputPath);
                const mediaType = outputPath.endsWith('.png') ? 'image/png' : outputPath.endsWith('.webp') ? 'image/webp' : 'image/jpeg';
                if (action === 'to') {
                  await this.sock.sendMessage(msg.key.remoteJid, {
                    document: fileBuffer,
                    mimetype: mediaType,
                    fileName: path.basename(outputPath),
                    caption: '✅ File hasil konversi siap!'
                  });
                } else {
                  await this.sock.sendMessage(msg.key.remoteJid, {
                    image: fileBuffer,
                    mimetype: mediaType,
                    caption: '✅ Gambar siap!'
                  });
                }
              }
            } catch (error) {
              console.error('Error in /img handler for WhatsApp:', error);
              replyText = `> *❌ ERROR CONVERTER*\n\nGagal memproses gambar: ${error.message}`;
            } finally {
              if (inputPath) await fs.unlink(inputPath).catch(() => {});
              if (outputPath) await fs.unlink(outputPath).catch(() => {});
            }
            break;
          }

          case '/img_info': {
            const header = '> *IMAGE TOOLS* 🖼️';
            const body = `Konversi, edit, hapus background, dan screenshot web.\n\n*MODE 1 - BALAS FOTO:*\n1. Balas pesan dengan gambar/foto\n2. Kirim salah satu command berikut\n\n\`\`\`\n/img compress\n/img resize WxH\n/img to format\n/img rotate deg\n/hapusbg\n\`\`\`\n\n*MODE 2 - SCREENSHOT WEB:*\n\`\`\`\n/ss https://example.com\n\`\`\`\n\n*KETERANGAN:*\n- /img compress : Kompres ukuran gambar\n- /img resize WxH : Ubah ukuran (contoh: 500x500)\n- /img to format : Format didukung jpg, png, jpeg, webp\n- /img rotate deg : Sudut didukung 90, 180, 270\n- /hapusbg : Hapus background (kuota 50/bulan)\n- /ss <url> : Screenshot website (kuota 50/bulan)\n\n*CATATAN REMOVE BG:*\nGratis hanya preview rendah (maks 0,25 MP).\n\n*BATASAN FILE FOTO:* Maks 5MB`;
            const footer = await buildImageToolsQuotaFooter();
            replyText = appendFooter(`${header}\n\n${body}`, footer);
            break;
          }

          case '/pdf_info': {
            const header = '> *PDF TOOLS* 📄';
            const body = `Konversi, optimasi, rotasi, ekstrak, dan merge halaman PDF.\n\n*MODE 1 - KE PDF:*\nKirim dokumen/media dengan caption:\n\n\`\`\`\n/topdf\n\`\`\`\n\n*MODE 2 - DARI PDF:*\nKirim file PDF dengan caption:\n\n\`\`\`\n/pdf compress\n/pdf to format\n/pdf rotate deg\n/pdf extract 1-3,5\n\`\`\`\n\n*MODE 3 - MERGE BANYAK PDF:*\n\`\`\`\n/pdf merge start\n(kirim file PDF satu per satu)\n/pdf merge done\n/pdf merge cancel\n\`\`\`\n\n*KETERANGAN:*\n- /topdf : Konversi file ke PDF (CloudConvert)\n- /pdf compress : Kompres ukuran PDF (CloudConvert)\n- /pdf to format : Konversi PDF ke format lain (CloudConvert)\n- /pdf rotate deg : Rotasi semua halaman PDF (lokal)\n- /pdf extract pages : Ambil halaman tertentu (lokal)\n- /pdf merge start|done|cancel : Gabung banyak PDF (lokal)\n\n*CONTOH:*\n- /pdf to docx\n- /pdf rotate 90\n- /pdf extract 1-3,5\n- /pdf merge start\n\n*BATASAN:*\n- CloudConvert: max 10MB, kuota 10 request/hari\n- Proses lokal (rotate/extract/merge): max 15MB per file`;
            const footer = await buildPdfToolsQuotaFooter();
            replyText = appendFooter(`${header}\n\n${body}`, footer);
            break;
          }

          case '/sticker_info': {
            replyText = '> *STICKER TOOLS* 🧩\n\nPanduan Lengkap sticker tools.\n\n\`/tosticker\` : Ubah gambar/video (max 5 dtk) jadi stiker.';
            break;
          }

          case '/tosticker': {
            try {
              const mediaSource = getStickerMediaSource(msg, contextInfo);
              if (!mediaSource) {
                replyText = '> *❌ FORMAT SALAH*\n\nKirim gambar/video atau balas gambar/video dengan command `/tosticker`.';
                break;
              }

              if (mediaSource.mediaType === 'video' && mediaSource.seconds > 5) {
                replyText = '❌ Gagal: Durasi video maksimal 5 detik!';
                break;
              }

              const mediaBuffer = await downloadMediaMessage(
                mediaSource.mediaMessage,
                'buffer',
                {},
                { reuploadRequest: this.sock.updateMediaMessage }
              );

              const stickerBuffer = await createSticker(mediaBuffer, mediaSource.mediaType === 'video');
              await this.sock.sendMessage(
                msg.key.remoteJid,
                { sticker: stickerBuffer },
                { quoted: msg }
              );
            } catch (error) {
              console.error('Error in /tosticker handler for WhatsApp:', error);
              if (isFfmpegMissingError(error)) {
                replyText = '> *❌ ERROR STICKER*\n\nFFmpeg belum terpasang di server. Hubungi admin untuk install FFmpeg agar fitur stiker berjalan normal.';
                break;
              }

              replyText = `> *❌ ERROR STICKER*\n\nGagal membuat stiker: ${error.message}`;
            }
            break;
          }

          case '/start': {
            const startHeader = '> *SELAMAT DATANG DI FUENZER BOT* 🤖';
            const startBody = `Halo! Saya adalah asisten virtual pribadi.\n\nGunakan /info untuk melihat daftar perintah lengkap.\n\nBot ini dapat membantu Anda dengan:\n• Manajemen keuangan (/saldo, /catat, dll)\n• Percakapan AI (langsung ketik pesan)\n• Dan berbagai fitur lainnya!`;
            replyText = `${startHeader}\n\n${startBody}`;
            break;
          }

          case '/help': {
            replyText = `*PUSAT BANTUAN & FEEDBACK* 🆘\n\nJika kamu menemukan bug atau punya pertanyaan seputar fitur bot, gunakan fitur CS ini:\n\n1. \`/feedback [pesan]\` : Berikan saran, kritik, atau laporan bug ke tim Fuenzer.\n2. \`/ask [pesan]\` : Tanyakan apa saja ke Admin terkait operasional bot.\n\nContoh:\n\`/feedback Fitur translate error saat menerjemahkan ke bahasa Korea\`\n\`/ask Bagaimana cara upgrade kuota premium?\``;
            break;
          }

          case '/feedback': {
            const pesan = args.join(' ').trim();
            if (!pesan) {
              replyText = 'Silakan tuliskan pesan feedback setelah command.\nContoh: `/feedback bot ini sangat membantu!`';
              break;
            }
            await sendToSheet('FEEDBACK', realId, pesan);
            replyText = '✅ Terima kasih! Feedback kamu telah masuk ke sistem Fuenzer Studio.';
            break;
          }

          case '/ask': {
            const pesan = args.join(' ').trim();
            if (!pesan) {
              replyText = 'Silakan tuliskan pertanyaan setelah command.\nContoh: `/ask kapan fitur baru rilis?`';
              break;
            }
            await sendToSheet('ASK', realId, pesan);
            replyText = '✅ Pertanyaan kamu telah dikirim ke Admin. Harap tunggu balasannya ya!';
            break;
          }

          case '/info': {
            const header = '> *INFORMASI FUENZER BOT* 🤖';
            const body = `Saya adalah asisten virtual pribadi milik Ridwan Yoga Suryantara.\n\n🆘 *LAYANAN CS & FEEDBACK*\n- \`/help\`           : Pusat Bantuan & Feedback\n\n☕ *DUKUNGAN BOT*\n- \`/donate\`         : Link dukungan + QR donasi\n\n📋 *FITUR KEUANGAN* 💰\n- \`/finance_info\`   : Panduan Lengkap command keuangan\n\n📋 *FITUR SISTEM* ⚙️\n- \`/ping\`           : Cek status bot\n- \`/info\`           : Menampilkan pesan ini\n- \`/start\`          : Memulai bot\n\n💡 *FITUR AI* 🧠\nKirimkan pesan biasa (tanpa awalan '/') untuk ngobrol, bertanya seputar coding, teknologi, atau sekadar bertukar pikiran!\n*(Support deteksi file: Gambar / Audio VN / Dokumen Teks)*\n- \`/model_info\`     : Daftar model AI yang tersedia\n- \`/switch\`         : Ganti model AI aktif\n\n🌍 *FITUR TRANSLATE*\n- \`/translate_info\` : Panduan Lengkap terjemah kata/kalimat\n\n🛠️ *FITUR UTILITAS*\n- \`/short\`          : Pendekkan URL dengan is.gd\n- \`/research_info\`  : Panduan Lengkap Referensi (buku/jurnal/artikel)\n- \`/downloader\`     : Panduan Lengkap download (/download & /audio)\n- \`/remind_info\`    : Panduan Lengkap fitur Reminder pengingat\n- \`/cuaca\`          : Info cuaca hari ini\n- \`/sholat\`         : Jadwal sholat hari ini\n- \`/me\`             : Tentang pembuat bot\n\n🖼️ *FITUR CONVERTER* 📄\n- \`/img_info\`       : Panduan Lengkap image tools\n- \`/pdf_info\`       : Panduan Lengkap PDF tools\n\n🧩 *FITUR STICKER*\n- \`/sticker_info\`   : Panduan Lengkap sticker tools\n\n🛡️ *FITUR ADMIN*\n- \`/admin\`          : Menu command admin`;
            replyText = appendFooter(`${header}\n\n${body}`, buildSystemStatsFooter());
            break;
          }

          case '/donate': {
            try {
              const donateText = buildDonateMessage('whatsapp');
              const { koFi, saweria } = getDonateQrImagePaths();

              await this.sock.sendMessage(
                msg.key.remoteJid,
                { text: formatWhatsAppReply(donateText) },
                { quoted: msg }
              );

              const koFiBuffer = await fs.readFile(koFi);
              await this.sock.sendMessage(
                msg.key.remoteJid,
                {
                  image: koFiBuffer,
                  mimetype: 'image/png',
                  caption: '🌍 QR Donasi Ko-fi'
                },
                { quoted: msg }
              );

              const saweriaBuffer = await fs.readFile(saweria);
              await this.sock.sendMessage(
                msg.key.remoteJid,
                {
                  image: saweriaBuffer,
                  mimetype: 'image/png',
                  caption: '🇮🇩 QR Donasi Saweria'
                },
                { quoted: msg }
              );
            } catch (error) {
              console.error('Error in /donate handler for WhatsApp:', error);
              replyText = `❌ Gagal menampilkan info donasi: ${error.message}`;
              break;
            }

            return;
          }

          case '/hapusbg': {
            let inputPath = null;
            let outputPath = null;

            try {
              const imageMsg = msg.message?.imageMessage;
              if (!imageMsg) {
                replyText = '> *❌ ERROR REMOVE BG*\n\nBalas pesan dengan gambar untuk menghapus background.';
                break;
              }

              const fileSizeBytes = imageMsg.fileLength || 0;
              if (fileSizeBytes > MAX_FILE_SIZE) {
                replyText = '> *❌ Gagal*\n\nUkuran gambar maksimal 5MB!';
                break;
              }

              const timestamp = Date.now();
              const tempDir = await ensureTempDir();
              inputPath = path.join(tempDir, `input_bg_${timestamp}.jpg`);
              outputPath = path.join(tempDir, `output_bg_${timestamp}.png`);

              const buffer = await downloadMediaMessage(
                msg,
                'buffer',
                {},
                { reuploadRequest: this.sock.updateMediaMessage }
              );
              await fs.writeFile(inputPath, buffer);

              await removeBackground(inputPath, outputPath);

              const fileBuffer = await fs.readFile(outputPath);
              await this.sock.sendMessage(
                msg.key.remoteJid,
                {
                  image: fileBuffer,
                  mimetype: 'image/png',
                  caption: '*✅ Background Dihapus!*\n\n_Preview resolusi rendah. Untuk HD resolution, gunakan kredit berbayar di situs remove.bg.'
                },
                { quoted: msg }
              );
            } catch (error) {
              console.error('Error in /hapusbg handler for WhatsApp:', error);
              const errorMsg = error.message.includes('Kuota') 
                ? error.message 
                : `❌ Error: ${error.message}`;
              replyText = `> *ERROR REMOVE BG*\n\n${errorMsg}`;
            } finally {
              if (inputPath) await fs.unlink(inputPath).catch(() => {});
              if (outputPath) await fs.unlink(outputPath).catch(() => {});
            }
            break;
          }

          case '/ss': {
            let outputPath = null;

            try {
              if (args.length === 0) {
                replyText = '> *❌ FORMAT SALAH*\n\nGunakan: \`/ss <URL>\`\n\nContoh: \`/ss https://example.com\`';
                break;
              }

              const url = args.join(' ').trim();

              // Validate URL
              try {
                new URL(url);
              } catch (e) {
                replyText = '> *❌ URL TIDAK VALID*\n\nTetapkan URL yang benar dimulai dengan http:// atau https://';
                break;
              }

              const timestamp = Date.now();
              const tempDir = await ensureTempDir();
              outputPath = path.join(tempDir, `output_ss_${timestamp}.jpg`);

              await htmlToImage(url, outputPath);

              const fileBuffer = await fs.readFile(outputPath);
              await this.sock.sendMessage(
                msg.key.remoteJid,
                {
                  image: fileBuffer,
                  mimetype: 'image/jpeg',
                  caption: '*✅ Screenshot Berhasil!*\n\n_Tangkapan halaman web diambil dengan resolusi standar._'
                },
                { quoted: msg }
              );
            } catch (error) {
              console.error('Error in /ss handler for WhatsApp:', error);
              const errorMsg = error.message.includes('Kuota') 
                ? error.message 
                : `❌ Error: ${error.message}`;
              replyText = `> *ERROR SCREENSHOT*\n\n${errorMsg}`;
            } finally {
              if (outputPath) await fs.unlink(outputPath).catch(() => {});
            }
            break;
          }

          case '/topdf': {
            let inputPath = null;
            let outputPath = null;

            try {
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
                replyText = '> *❌ FILE TIDAK DITEMUKAN*\n\nKirim dokumen/media dengan caption \`/topdf\`.';
                break;
              }

              if (source.fileSize > MAX_PDF_INPUT_SIZE) {
                replyText = '> *❌ Gagal: Ukuran file maksimal 10MB!*';
                break;
              }

              const timestamp = Date.now();
              const tempDir = await ensureTempDir();
              inputPath = path.join(tempDir, `input_${timestamp}.${source.inputExt}`);
              outputPath = path.join(tempDir, `output_${timestamp}.pdf`);

              const buffer = await downloadMediaMessage(
                msg,
                'buffer',
                {},
                { reuploadRequest: this.sock.updateMediaMessage }
              );
              await fs.writeFile(inputPath, buffer);

              await convertToPdf(inputPath, outputPath, source.inputExt);

              const fileBuffer = await fs.readFile(outputPath);
              await this.sock.sendMessage(
                msg.key.remoteJid,
                {
                  document: fileBuffer,
                  mimetype: 'application/pdf',
                  fileName: path.basename(outputPath),
                  caption: '*✅ TOPDF BERHASIL*\n\nFile berhasil dikonversi ke PDF.'
                },
                { quoted: msg }
              );
            } catch (error) {
              console.error('Error in \`/topdf\` handler for WhatsApp:', error);
              replyText = `> *ERROR PDF TOOLS*\n\n${error.message}`;
            } finally {
              safeUnlinkSync(inputPath);
              safeUnlinkSync(outputPath);
            }
            break;
          }

          case '/pdf': {
            let inputPath = null;
            let outputPath = null;

            try {
              const action = String(args[0] || '').toLowerCase().trim();
              let mode = '';
              let outputFormat = 'pdf';
              let rotateAngle = 0;
              let extractPages = '';

              if (action === 'merge') {
                const mergeAction = String(args[1] || '').toLowerCase().trim();

                if (mergeAction === 'start') {
                  const previousFiles = mergeSessions[userId] || [];
                  for (const filePath of previousFiles) {
                    safeUnlinkSync(filePath);
                  }

                  mergeSessions[userId] = [];
                  replyText = '✅ Mode Merge Aktif! Kirim file PDF satu per satu. Ketik \`/pdf merge done\` jika sudah semua, atau \`/pdf merge cancel\` untuk batal.';
                  break;
                }

                if (mergeAction === 'cancel') {
                  const sessionFiles = mergeSessions[userId] || [];
                  for (const filePath of sessionFiles) {
                    safeUnlinkSync(filePath);
                  }

                  delete mergeSessions[userId];
                  replyText = '❌ Merge dibatalkan. Semua file sesi dihapus.';
                  break;
                }

                if (mergeAction === 'done') {
                  const sessionFiles = mergeSessions[userId];
                  if (!Array.isArray(sessionFiles) || sessionFiles.length < 2) {
                    replyText = '❌ Minimal butuh 2 file PDF!';
                    break;
                  }

                  const filesToMerge = [...sessionFiles];
                  const tempDir = await ensureTempDir();
                  outputPath = path.join(tempDir, `merged_${Date.now()}.pdf`);

                  try {
                    await mergePdfs(filesToMerge, outputPath);
                    const fileBuffer = await fs.readFile(outputPath);
                    await this.sock.sendMessage(
                      msg.key.remoteJid,
                      {
                        document: fileBuffer,
                        mimetype: 'application/pdf',
                        fileName: path.basename(outputPath),
                        caption: '*✅ PDF MERGE BERHASIL*\n\nSemua file PDF berhasil digabung.'
                      },
                      { quoted: msg }
                    );
                  } finally {
                    for (const filePath of filesToMerge) {
                      safeUnlinkSync(filePath);
                    }
                    safeUnlinkSync(outputPath);
                    delete mergeSessions[userId];
                  }

                  break;
                }

                replyText = '> *❌ FORMAT SALAH*\n\nGunakan:\n\`/pdf merge start\`\n\`/pdf merge done\`\n\`/pdf merge cancel\`';
                break;
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
                  replyText = '> *❌ FORMAT SALAH*\n\nContoh rotasi: \`/pdf rotate 90\`';
                  break;
                }
              } else if (action === 'extract' && args.length > 1) {
                mode = 'extract';
                outputFormat = 'pdf';
                extractPages = args.slice(1).join(' ').trim();
                if (!extractPages) {
                  replyText = '> *❌ FORMAT SALAH*\n\nContoh extract: \`/pdf extract 1-3,5\`';
                  break;
                }
              } else {
                replyText = '> *❌ FORMAT SALAH*\n\nGunakan:\n\`/pdf compress\`\n\`/pdf to <format>\`\n\`/pdf rotate <deg>\`\n\`/pdf extract <halaman>\`\n\`/pdf merge start|done|cancel\`';
                break;
              }

              const documentMsg = msg.message?.documentMessage;
              if (!documentMsg) {
                replyText = '> *❌ FILE TIDAK DITEMUKAN*\n\nKirim file PDF dengan caption \`/pdf compress\` atau \`/pdf to <format>\`.';
                break;
              }

              const inputExt = getExtensionFromFileName(documentMsg.fileName) || getExtensionFromMimeType(documentMsg.mimetype) || 'bin';
              const isPdfInput = inputExt === 'pdf' || String(documentMsg.mimetype || '').toLowerCase().includes('pdf');
              if (!isPdfInput) {
                replyText = '> *❌ FORMAT SALAH*\n\nCommand \`/pdf\` hanya untuk file PDF.';
                break;
              }

              const fileSizeBytes = toFileSizeBytes(documentMsg.fileLength);
              const isLocalPdfProcess = mode === 'rotate' || mode === 'extract';
              const maxPdfSize = isLocalPdfProcess ? MAX_PDF_LOCAL_INPUT_SIZE : MAX_PDF_INPUT_SIZE;
              if (fileSizeBytes > maxPdfSize) {
                const maxLabel = isLocalPdfProcess ? '15MB' : '10MB';
                replyText = `> *❌ Gagal: Ukuran file maksimal ${maxLabel}!*`;
                break;
              }

              const timestamp = Date.now();
              const tempDir = await ensureTempDir();
              inputPath = path.join(tempDir, `input_${timestamp}.pdf`);
              outputPath = path.join(tempDir, `output_${timestamp}.${outputFormat}`);

              const buffer = await downloadMediaMessage(
                msg,
                'buffer',
                {},
                { reuploadRequest: this.sock.updateMediaMessage }
              );
              await fs.writeFile(inputPath, buffer);

              if (mode === 'compress') {
                await compressPdf(inputPath, outputPath);
              } else if (mode === 'rotate') {
                await rotatePdf(inputPath, outputPath, rotateAngle);
              } else if (mode === 'extract') {
                await extractPdf(inputPath, outputPath, extractPages);
              } else {
                await convertFromPdf(inputPath, outputPath, outputFormat);
              }

              const fileBuffer = await fs.readFile(outputPath);
              const resultCaption = mode === 'compress'
                ? '*✅ PDF COMPRESS BERHASIL*\n\nFile PDF berhasil dikompres.'
                : mode === 'rotate'
                  ? `*✅ PDF ROTATE BERHASIL*\n\nSemua halaman diputar ${rotateAngle} derajat.`
                  : mode === 'extract'
                    ? `*✅ PDF EXTRACT BERHASIL*\n\nHalaman terpilih: ${extractPages}.`
                : `*✅ PDF CONVERT BERHASIL*\n\nFile PDF berhasil dikonversi ke ${outputFormat}.`;

              await this.sock.sendMessage(
                msg.key.remoteJid,
                {
                  document: fileBuffer,
                  mimetype: getMimeTypeFromExtension(outputFormat),
                  fileName: path.basename(outputPath),
                  caption: resultCaption
                },
                { quoted: msg }
              );
            } catch (error) {
              console.error('Error in /pdf handler for WhatsApp:', error);
              replyText = `> *ERROR PDF TOOLS*\n\n${error.message}`;
            } finally {
              safeUnlinkSync(inputPath);
              safeUnlinkSync(outputPath);
            }
            break;
          }

          case '/short': {
            try {
              const originalUrl = String(args.join(' ') || '').trim();

              if (!originalUrl) {
                replyText = '❌ Masukkan link yang ingin dipendekkan! Contoh: /short https://fuenzerstudio.com';
                break;
              }

              if (!(originalUrl.startsWith('http://') || originalUrl.startsWith('https://'))) {
                replyText = '❌ URL tidak valid! URL harus diawali http:// atau https://';
                break;
              }

              const shortUrl = await shortenUrl(originalUrl);
              replyText = `✅ Berhasil dipendekkan!\n🔗 URL Asli: ${originalUrl}\n✨ URL Pendek: ${shortUrl}`;
            } catch (error) {
              console.error('Error in /short handler for WhatsApp:', error);
              replyText = `❌ Gagal memendekkan URL: ${error.message}`;
            }
            break;
          }

          case '/download': {
            const targetUrl = String(args.join(' ') || '').trim();

            if (!targetUrl) {
              replyText = '❌ Masukkan link media! Contoh: /download https://www.instagram.com/reel/xxxx';
              break;
            }

            try {
              await this.sock.sendMessage(
                msg.key.remoteJid,
                { text: '⏳ Sedang memproses media, mohon tunggu sebentar...' },
                { quoted: msg }
              );

              const mediaUrls = await getDownloadUrl(targetUrl);
              if (!Array.isArray(mediaUrls) || mediaUrls.length === 0) {
                throw new Error('DOWNLOAD_FAILED');
              }

              let successCount = 0;
              let hasFileTooLarge = false;
              let hasBufferFailed = false;

              for (const mediaUrl of mediaUrls) {
                try {
                  const media = await getMediaBuffer(mediaUrl);
                  if (media.type === 'video') {
                    await this.sock.sendMessage(
                      msg.key.remoteJid,
                      { video: media.buffer, mimetype: 'video/mp4' },
                      { quoted: msg }
                    );
                  } else {
                    await this.sock.sendMessage(
                      msg.key.remoteJid,
                      { image: media.buffer, mimetype: 'image/jpeg' },
                      { quoted: msg }
                    );
                  }

                  successCount += 1;
                  await new Promise((resolve) => setTimeout(resolve, 1500));
                } catch (itemErr) {
                  console.error('Failed to download one slide on WhatsApp:', itemErr.message);
                  if (itemErr.message === 'FILE_TOO_LARGE') {
                    hasFileTooLarge = true;
                  }
                  if (itemErr.message === 'DOWNLOAD_BUFFER_FAILED') {
                    hasBufferFailed = true;
                  }
                }
              }

              if (successCount === 0) {
                if (hasFileTooLarge) {
                  throw new Error('FILE_TOO_LARGE');
                }
                if (hasBufferFailed) {
                  throw new Error('DOWNLOAD_BUFFER_FAILED');
                }
                throw new Error('DOWNLOAD_FAILED');
              }
            } catch (err) {
              if (err.message === 'FILE_TOO_LARGE') {
                replyText = '❌ Gagal: Ukuran file terlalu besar (Maksimal 25MB demi stabilitas bot).';
              } else if (err.message === 'FB_NOT_SUPPORTED') {
                replyText = '❌ Mohon maaf, fitur download Facebook sedang dalam perbaikan.';
              } else if (err.message === 'DOWNLOAD_BUFFER_FAILED') {
                replyText = '❌ Media ditemukan, tapi server sumber menolak koneksi (proxy/anti-hotlink). Coba ulang beberapa saat lagi.';
              } else {
                replyText = '❌ Gagal mengunduh. Pastikan link valid dan akun tidak di-private!';
              }
            }
            break;
          }

          case '/audio': {
            const targetUrl = String(args.join(' ') || '').trim();

            if (!targetUrl) {
              replyText = '❌ Masukkan link media! Contoh: /audio https://www.youtube.com/watch?v=xxxx';
              break;
            }

            try {
              await this.sock.sendMessage(
                msg.key.remoteJid,
                { text: '⏳ Sedang memproses audio, mohon tunggu sebentar...' },
                { quoted: msg }
              );

              const audioUrl = await getAudioUrl(targetUrl);
              const audio = await getAudioBuffer(audioUrl);

              await this.sock.sendMessage(
                msg.key.remoteJid,
                {
                  audio: audio.buffer,
                  mimetype: audio.mimetype || 'audio/mpeg',
                  ptt: false
                },
                { quoted: msg }
              );
            } catch (err) {
              if (err.message === 'FILE_TOO_LARGE') {
                replyText = '❌ Gagal: Ukuran file audio terlalu besar (Maksimal 25MB demi stabilitas bot).';
              } else if (err.message === 'AUDIO_PLATFORM_NOT_SUPPORTED') {
                replyText = '❌ Saat ini /audio hanya mendukung YouTube dan YouTube Music.';
              } else if (err.message === 'DOWNLOAD_BUFFER_FAILED') {
                replyText = '❌ Audio ditemukan, tapi server sumber menolak koneksi (proxy/anti-hotlink). Coba ulang beberapa saat lagi.';
              } else if (err.message === 'AUDIO_NOT_FOUND') {
                replyText = '❌ Audio tidak ditemukan dari link tersebut.';
              } else {
                replyText = '❌ Gagal mengunduh audio. Pastikan link valid dan akun tidak di-private!';
              }
            }
            break;
          }

          default: {
            const defaultHeader = '> *COMMAND TIDAK DIKENAL* 🤔';
            const defaultBody = `Perintah "${command}" tidak tersedia.\nCoba \`/ping\`, \`/saldo\`, \`/catat\`, \`/pemasukan\`, \`/laporan_chart\`, atau \`/info\`.`;
            replyText = `${defaultHeader}\n\n${defaultBody}`;
          }
        }
      } else {
        const isImage = !!msg.message?.imageMessage;
        const isAudio = !!msg.message?.audioMessage;
        const isDoc = !!msg.message?.documentMessage;
        const hasMedia = isImage || isAudio || isDoc;

        if (cleanText.length <= 2 && !hasMedia) {
          const shortHeader = '> *PESAN TERLALU PENDEK* 📏';
          const shortBody = 'Maaf, pesan terlalu pendek atau kurang jelas.\nKetik \`/info\` untuk melihat daftar kemampuanku ya!';
          replyText = `${shortHeader}\n\n${shortBody}`;
        } else {
          try {
            const realId = resolveWhatsAppSenderJid(msg, userId);
            let aiPayload = cleanText;

            if (hasMedia) {
              const fileLength = msg.message?.imageMessage?.fileLength || 
                                 msg.message?.audioMessage?.fileLength || 
                                 msg.message?.documentMessage?.fileLength;
              const fileSizeBytes = Number(fileLength) || 0;

              if (isImage) {
                if (fileSizeBytes > 5 * 1024 * 1024) {
                   throw new Error('⛔ Ukuran gambar terlalu besar! Maksimal 5 MB.');
                }
                const buffer = await downloadMediaMessage(msg, 'buffer', {}, { reuploadRequest: this.sock.updateMediaMessage });
                const base64Data = buffer.toString('base64');
                const promptUser = cleanText || "Tolong jelaskan gambar ini.";
                const mimeType = msg.message.imageMessage.mimetype || 'image/jpeg';
                aiPayload = [
                  { type: "text", text: promptUser },
                  { type: "image_url", image_url: { url: `data:${mimeType};base64,${base64Data}` } }
                ];
              } else if (isAudio) {
                if (fileSizeBytes > 10 * 1024 * 1024) {
                   throw new Error('⛔ Durasi atau ukuran pesan suara terlalu besar! Maksimal 10 MB.');
                }
                const buffer = await downloadMediaMessage(msg, 'buffer', {}, { reuploadRequest: this.sock.updateMediaMessage });
                const base64Data = buffer.toString('base64');
                const promptUser = cleanText || "Tolong transkripsikan atau tanggapi pesan suara ini.";
                // We can extract extension from mimetype,e.g., audio/ogg; codecs=opus -> ogg
                let formatExt = "ogg";
                if (msg.message.audioMessage.mimetype) {
                   if (msg.message.audioMessage.mimetype.includes('mp3')) formatExt = 'mp3';
                   else if (msg.message.audioMessage.mimetype.includes('mp4')) formatExt = 'mp4';
                   else if (msg.message.audioMessage.mimetype.includes('wav')) formatExt = 'wav';
                }
                aiPayload = [
                  { type: "text", text: promptUser },
                  { type: "input_audio", input_audio: { data: base64Data, format: formatExt } }
                ];
              } else if (isDoc) {
                if (fileSizeBytes > 10 * 1024 * 1024) {
                   throw new Error('⛔ Ukuran dokumen terlalu besar! Maksimal 10 MB.');
                }
                const docMsg = msg.message.documentMessage;
                const mimetype = docMsg.mimetype || '';
                const fileName = docMsg.fileName || '';
                
                const isText = mimetype.includes('text') || mimetype.includes('json') || mimetype.includes('csv');
                const isTextExt = fileName.endsWith('.js') || fileName.endsWith('.md') || fileName.endsWith('.txt') || fileName.endsWith('.csv') || fileName.endsWith('.json');
                
                if (isText || isTextExt) {
                  const buffer = await downloadMediaMessage(msg, 'buffer', {}, { reuploadRequest: this.sock.updateMediaMessage });
                  const fileContent = buffer.toString('utf-8');
                  aiPayload = `[Isi File Terlampir:\n${fileContent}\n]\n\n${cleanText}`;
                } else {
                  throw new Error('⛔ Mohon maaf, untuk saat ini Fuenzer Bot lebih optimal membaca file berbentuk gambar atau teks (.txt).');
                }
              }
            }

            const aiResult = await askAiDetailed(aiPayload, userId, 'whatsapp', realId);
            replyText = appendFooter(aiResult.text, buildAiStatsFooter(aiResult));
          } catch (error) {
            console.error('Error dari OpenRouter AI:', error);

            let errorHeader;
            let errorBody;
            const message = String(error?.message || '');
            if (message.startsWith('⛔') || message.includes('400 Bad Request: ⛔')) {
              replyText = message.includes('400 Bad Request:') ? message.split('400 Bad Request: ')[1].trim() : message;
            } else {
              if (message.includes('429 Rate Limit')) {
                errorHeader = '> *RATE LIMIT AI* ⏳';
                errorBody = 'Maaf, request AI sedang padat (429 Rate Limit).\nSilakan coba lagi beberapa saat.';
              } else if (message.includes('401 Unauthorized') || message.includes('403 Forbidden')) {
                errorHeader = '> *AKSES AI DITOLAK* 🔒';
                errorBody = 'Maaf, akses AI ditolak (401/403).\nAdmin perlu memeriksa API key OpenRouter.';
              } else if (message.includes('tidak ditemukan di OpenRouter')) {
                errorHeader = '> *MODEL AI TIDAK DITEMUKAN* 🔍';
                errorBody = 'Maaf, model AI yang dipakai sedang tidak tersedia.\nCoba lagi nanti.';
              } else if (message.includes('API key OpenRouter')) {
                errorHeader = '> *API KEY AI TIDAK VALID* 🔑';
                errorBody = 'Maaf, konfigurasi OpenRouter belum lengkap atau tidak valid.\nAdmin telah diberitahu.';
              } else if (message.includes('Server OpenRouter sedang gangguan')) {
                errorHeader = '> *SERVER AI GANGGUAN* 🛠️';
                errorBody = 'Maaf, server AI sedang gangguan.\nSilakan coba lagi nanti.';
              } else {
                errorHeader = '> *ERROR AI* 🤯';
                errorBody = 'Maaf, otak AI sedang gangguan.\nCoba lagi nanti atau gunakan perintah sistem (/ping, /saldo).';
              }

              replyText = appendFooter(
                `${errorHeader}\n\n${errorBody}`,
                buildAiStatsFooter({ model: '-', usage: { promptTokenCount: 0, candidatesTokenCount: 0 }, rpm: { label: '-' } })
              );
            }
          }
        }
      }

      if (replyText) {
        await this.sock.sendMessage(msg.key.remoteJid, {
          text: formatWhatsAppReply(replyText)
        });
      }
    });
  }
}

module.exports = WhatsAppHandler;
