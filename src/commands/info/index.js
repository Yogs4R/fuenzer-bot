// Comprehensive information and guide command handler
const { getQuotaStatus } = require('../../services/quotaService');
const { buildDonateMessage } = require('../../services/donateService');
const { buildSystemStatsFooter } = require('../devops/index');
const { appendFooter } = require('../../utils/textFormatter');
const { t } = require('../../utils/i18n');

function formatQuotaLimit(limit) {
  const numericLimit = Number(limit);
  return Number.isFinite(numericLimit) && numericLimit > 0 ? String(numericLimit) : 'Unlimited';
}

function formatQuotaUsageText(status) {
  const usage = Number(status?.usage || 0);
  const limitText = formatQuotaLimit(status?.limit);
  return limitText === 'Unlimited' ? String(usage) : `${usage}/${limitText}`;
}

async function buildImageToolsQuotaFooter(platform = 'whatsapp') {
  const [removeBgStatus, htmlToImageStatus] = await Promise.all([
    getQuotaStatus('removebg', 50, false),
    getQuotaStatus('html2img', 50, false)
  ]);

  const removeBgLimit = formatQuotaLimit(removeBgStatus.limit);
  const htmlToImageLimit = formatQuotaLimit(htmlToImageStatus.limit);

  if (platform === 'whatsapp') {
    return [
      '—'.repeat(19),
      `*RemoveBG:* Usage: ${formatQuotaUsageText(removeBgStatus)} | Limit: ${removeBgLimit}`,
      `*html2img:* Usage: ${formatQuotaUsageText(htmlToImageStatus)} | Limit: ${htmlToImageLimit}`
    ].join('\n');
  }

  return [
    '—'.repeat(19),
    `RemoveBG: Usage: ${formatQuotaUsageText(removeBgStatus)} | Limit: ${removeBgLimit}`,
    `html2img: Usage: ${formatQuotaUsageText(htmlToImageStatus)} | Limit: ${htmlToImageLimit}`
  ].join('\n');
}

async function buildPdfToolsQuotaFooter(platform = 'whatsapp') {
  const cloudConvertStatus = await getQuotaStatus('cloudconvert', 10, true);
  const cloudConvertLimit = formatQuotaLimit(cloudConvertStatus.limit);
  const cloudConvertUsage = formatQuotaUsageText(cloudConvertStatus);

  if (platform === 'whatsapp') {
    return [
      '—'.repeat(19),
      `*CloudConvert:* Usage: ${cloudConvertUsage} | Limit: ${cloudConvertLimit}`
    ].join('\n');
  }

  return [
    '—'.repeat(19),
    `CloudConvert: Usage: ${cloudConvertUsage} | Limit: ${cloudConvertLimit}`
  ].join('\n');
}

function getFinanceInfo(platform = 'whatsapp', lang = 'en') {
  if (lang === 'en') {
    return `> *FINANCE TOOLS* 💰\n\nComprehensive guide for Fuenzer Bot financial ledger.\n\n*CORE COMMANDS:*\n- /balance : View current wallet balance summary\n- /record <amount> <description> : Log an expense\n- /income <amount> <description> : Log an income\n- /chart : Generate financial summary chart\n- /history [page] : View transaction history (5 per page)\n- /edit <id> <new_amount> <new_desc> : Modify a transaction\n- /delete <id> : Remove a transaction (with ID confirmation)\n\n*QUICK EXAMPLES:*\n- /record 25000 lunch with team\n- /income 150000 freelance logo design\n- /history 2\n- /edit 123e4567 30000 dinner\n- /delete 123e4567\n\n*TIPS:*\n- Use /history to fetch the transaction ID before /edit or /delete.\n- Enter numbers without punctuation for clean parsing.`;
  }
  return `> *FINANCE TOOLS* 💰\n\nPanduan lengkap fitur keuangan Fuenzer Bot.\n\n*COMMAND INTI:*\n- /saldo : Lihat ringkasan saldo terbaru\n- /catat <nominal> <keterangan> : Catat pengeluaran\n- /pemasukan <nominal> <keterangan> : Catat pemasukan\n- /laporan_chart : Tampilkan grafik laporan\n- /riwayat [halaman] : Riwayat transaksi (paging 5 data)\n- /edit <id> <field> <nilai> : Ubah transaksi\n- /hapus <id> : Hapus transaksi (dengan konfirmasi)\n\n*CONTOH CEPAT:*\n- /catat 25000 makan siang\n- /pemasukan 150000 freelance logo\n- /riwayat 2\n- /edit 123e4567 nominal 30000\n- /hapus 123e4567\n\n*TIPS:*\n- Gunakan /riwayat untuk ambil ID transaksi sebelum /edit atau /hapus\n- Tulisan nominal tanpa titik/koma agar lebih aman diproses`;
}

function getRemindInfo(platform = 'whatsapp', lang = 'en') {
  if (lang === 'en') {
    return `> *REMINDER TOOLS* ⏰\n\nGuide for scheduling one-shot and recurring reminders.\n\n*CORE COMMANDS:*\n- /remind add <time> <message> : Create a one-shot reminder\n- /remind loop <time> <message> : Create a recurring reminder\n- /remind list : List all active reminders\n- /remind delete <id> : Remove a reminder by ID\n- /remind edit <id> <time> <message> : Edit a reminder\n\n*TIME UNITS SUPPORTED:*\n- Seconds: \`5s\`, \`30s\`, \`60s\`\n- Minutes: \`1m\`, \`15m\`, \`30m\`\n- Hours: \`1h\`, \`2h\`, \`12h\`\n- Days: \`1d\`, \`2d\`, \`7d\`\n\n*EXAMPLES:*\n- /remind add 15m Take out the laundry\n- /remind loop 1d Take morning vitamins\n- /remind delete A1B2C`;
  }
  return `> *REMINDER TOOLS* ⏰\n\nPanduan lengkap fitur pengingat (Reminder) Fuenzer Bot.\n\n*COMMAND INTI:*\n- /remind add <waktu> <pesan> : Buat pengingat sekali jalan\n- /remind loop <waktu> <pesan> : Buat pengingat berulang\n- /remind list : Tampilkan semua pengingat yang aktif\n- /remind hapus <id> : Hapus pengingat berdasarkan ID\n- /remind edit <id> <waktu> <pesan> : Edit pengingat\n\n*FORMAT WAKTU (Support Ms):*\n- Detik: \`5s\`, \`30s\`, \`60s\`\n- Menit: \`1m\`, \`15m\`, \`30m\`\n- Jam: \`1h\`, \`2h\`, \`12h\`\n- Hari: \`1d\`, \`2d\`, \`7d\`\n\n*CONTOH CEPAT:*\n- /remind add 15m angkat jemuran\n- /remind loop 1d minum vitamin pagi\n- /remind edit A1B2C 2h minum vitamin siang\n- /remind hapus A1B2C\n\n*TIPS:*\n- Gunakan \`/remind list\` untuk melihat ID unik dari pengingat Anda. ID ini digunakan saat Anda ingin mengedit atau menghapus pengingat.\n- Pengingat berulang (loop) akan selalu berjalan dengan interval yang telah ditentukan kecuali dihapus.`;
}

function getTranslateInfo(platform = 'whatsapp', lang = 'en') {
  if (lang === 'en') {
    return `> *TRANSLATE TOOLS* 🌍\n\nGuide for AI-powered multi-lingual translations.\n\n*CORE COMMANDS:*\n- \`/translate <lang_code> <text>\`\n- Or *reply* to any message with \`/translate <lang_code>\`\n\n*SUPPORTED LANGUAGE CODES:*\n- \`en\` : English\n- \`id\` : Indonesian\n- \`ja\` : Japanese\n- \`ko\` : Korean\n- \`zh\` : Chinese\n- \`ar\` : Arabic\n- \`es\` : Spanish\n- \`fr\` : French\n- \`de\` : German\n\n*EXAMPLES:*\n- \`/translate id Good morning, how are you today?\`\n- \`/translate ja Hello world\``;
  }
  return `> *TRANSLATE TOOLS* 🌍\n\nPanduan menggunakan fitur terjemahan AI.\n\n*COMMAND INTI:*\n- \`/translate <kode_bahasa> <teks>\`\n- Atau *reply* pesan yang ingin diterjemahkan dengan \`/translate <kode_bahasa>\`\n\n*DAFTAR KODE BAHASA (Ketikkan 2 huruf ini):*\n- \`en\` : English (Inggris)\n- \`id\` : Indonesia\n- \`jv\` : Javanese (Jawa)\n- \`su\` : Sundanese (Sunda)\n- \`ar\` : Arabic (Arab)\n- \`ja\` : Japanese (Jepang)\n- \`ko\` : Korean (Korea)\n- \`zh\` : Chinese (Mandarin)\n\n*CONTOH CEPAT:*\n- \`/translate en Halo dunia, apa kabar?\`\n- \`/translate ar Selamat pagi\``;
}

function getResearchInfo(platform = 'whatsapp', lang = 'en') {
  if (lang === 'en') {
    return `> *RESEARCH TOOLS* 📚\n\nAcademic references for books, journals, and research papers.\n\n*COMMANDS:*\n- /book <keyword> : Search books on Open Library\n- /journal <keyword> : Search journal articles on Crossref\n- /article <keyword> : Search open-access articles on OpenAlex\n\n*EXAMPLES:*\n- /book atomic habits\n- /journal machine learning\n- /article deep learning healthcare`;
  }
  return `> *RESEARCH TOOLS* 📚\n\nPanduan Lengkap fitur riset Referensi buku, jurnal, dan artikel ilmiah.\n\n*COMMAND INTI:*\n- /buku <keyword> : Cari rekomendasi buku dari Open Library\n- /jurnal <keyword> : Cari referensi jurnal/artikel ilmiah dari Crossref\n- /artikel <keyword> : Cari artikel ilmiah dari OpenAlex\n\n*CONTOH CEPAT:*\n- /buku atomic habits\n- /jurnal machine learning\n- /artikel deep learning healthcare`;
}

function getDownloaderInfo(platform = 'whatsapp', lang = 'en') {
  if (lang === 'en') {
    return `> *DOWNLOADER TOOLS* ⬇️\n\nDownload social media video and audio.\n\n*COMMANDS:*\n- /download <url> : Download social media video/image (IG, TikTok, X, YouTube)\n- /audio <url> : Extract audio from YouTube\n\n*EXAMPLES:*\n- /download https://www.instagram.com/reel/xxxx\n- /audio https://www.youtube.com/watch?v=xxxx`;
  }
  return `> *DOWNLOADER TOOLS* ⬇️\n\nPanduan Lengkap untuk download media dan audio.\n\n*COMMAND DOWNLOAD:*\n- /download <url> : Download media sosial (video/foto)\n- /audio <url> : Download audio dari YouTube/YouTube Music\n\n*CONTOH CEPAT:*\n- /download https://www.instagram.com/reel/xxxx\n- /audio https://www.youtube.com/watch?v=xxxx\n\n*SUPPORT PLATFORM:*\n- /download hanya support: Instagram, Twitter/X, YouTube, dan TikTok\n- /audio hanya support: YouTube dan YouTube Music`;
}

async function getImageToolsInfo(platform = 'whatsapp') {
  const footer = await buildImageToolsQuotaFooter(platform);
  const header = '> *IMAGE TOOLS* 🖼️';
  const body = `Image converter, edit, background removal, and website screenshot.\n\n*MODE 1 - REPLY TO PHOTO:*\n1. Reply to an image/photo\n2. Send one of the following commands:\n\`\`\`\n/img compress\n/img resize WxH\n/img to format\n/img rotate deg\n/hapusbg\n\`\`\`\n\n*MODE 2 - WEBSITE SCREENSHOT:*\n\`\`\`\n/ss https://example.com\n\`\`\``;
  return appendFooter(`${header}\n\n${body}`, footer);
}

async function getPdfToolsInfo(platform = 'whatsapp') {
  const footer = await buildPdfToolsQuotaFooter(platform);
  const header = '> *PDF TOOLS* 📄';
  const body = `Convert, compress, rotate, extract, and merge PDF pages.\n\n*MODE 1 - CONVERT TO PDF:*\nReply to a document with \`/topdf\`\n\n*MODE 2 - MODIFY PDF:*\nReply to a PDF with:\n\`\`\`\n/pdf compress\n/pdf to <format>\n/pdf rotate <deg>\n/pdf extract <pages>\n\`\`\`\n\n*MODE 3 - MERGE MULTIPLE PDFS:*\n\`\`\`\n/pdf merge start\n(Send files one-by-one)\n/pdf merge done\n/pdf merge cancel\n\`\`\``;
  return appendFooter(`${header}\n\n${body}`, footer);
}

function getStickerInfo(platform = 'whatsapp') {
  return '> *STICKER TOOLS* 🧩\n\nConvert images or short videos (max 5s) to stickers.\n\nCommand: `/tosticker` (reply to image/video)';
}

function getStartMessage(platform = 'whatsapp', lang = 'en') {
  if (lang === 'en') {
    return `> *WELCOME TO FUENZER BOT* 🤖\n\nHello! I am your intelligent personal productivity bot.\n\nUse /info to view the full list of available commands.\n\nI can help you with:\n• Personal finance ledger (/balance, /record, /chart)\n• Conversational AI (simply chat naturally)\n• Morning briefings & chat summarizer (/summarize)\n• Weather forecast, prayer times, reminders & utilities!`;
  }
  return `> *SELAMAT DATANG DI FUENZER BOT* 🤖\n\nHalo! Saya adalah asisten virtual pribadi.\n\nGunakan /info untuk melihat daftar perintah lengkap.\n\nBot ini dapat membantu Anda dengan:\n• Manajemen keuangan (/saldo, /catat, dll)\n• Percakapan AI (langsung ketik pesan)\n• Briefing pagi & ringkasan chat grup (/ringkas)\n• Dan berbagai fitur lainnya!`;
}

function getInfoMessage(platform = 'whatsapp', lang = 'en') {
  const footer = buildSystemStatsFooter(platform, lang);
  const header = t('info.main_title', {}, lang);
  const intro = t('info.main_intro', {}, lang);

  const sections = [
    intro,
    '',
    t('info.section_cs', {}, lang),
    '',
    t('info.section_donate', {}, lang),
    '',
    t('info.section_finance', {}, lang),
    '',
    t('info.section_system', {}, lang),
    '',
    t('info.section_ai', {}, lang),
    '',
    t('info.section_utilities', {}, lang),
    '',
    t('info.section_converter', {}, lang),
    '',
    t('info.section_admin', {}, lang)
  ].join('\n');

  return appendFooter(`${header}\n\n${sections}`, footer);
}

async function handleInfoCommand(command, args = [], userId = '', platform = 'whatsapp', context = {}) {
  const cleanCommand = String(command || '').toLowerCase().trim();
  const lang = context?.lang || 'en';

  switch (cleanCommand) {
    case '/finance_info':
      return getFinanceInfo(platform, lang);

    case '/remind_info':
      return getRemindInfo(platform, lang);

    case '/translate_info':
      return getTranslateInfo(platform, lang);

    case '/research_info':
      return getResearchInfo(platform, lang);

    case '/downloader':
    case '/downloader_info':
      return getDownloaderInfo(platform, lang);

    case '/img_info':
      return await getImageToolsInfo(platform);

    case '/pdf_info':
      return await getPdfToolsInfo(platform);

    case '/sticker_info':
      return getStickerInfo(platform);

    case '/start':
      return getStartMessage(platform, lang);

    case '/info':
      return getInfoMessage(platform, lang);

    case '/donate':
      return buildDonateMessage(platform);

    default:
      return 'Command guide not recognized.';
  }
}

module.exports = {
  handleInfoCommand,
  buildDonateMessage
};
