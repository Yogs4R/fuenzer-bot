// Comprehensive information and guide command handler
const { getQuotaStatus } = require('../../services/quotaService');
const { buildDonateMessage, getDonateQrImagePaths } = require('../../services/donateService');
const { buildSystemStatsFooter } = require('../devops/index');

function appendFooter(text, footer) {
  const base = String(text || '').trim();
  const foot = String(footer || '').trim();
  if (!base) return foot;
  if (!foot) return base;
  return `${base}\n\n${foot}`;
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

function getFinanceInfo(platform = 'whatsapp') {
  if (platform === 'telegram') {
    return `<b>FINANCE TOOLS</b> 💰\n\nPanduan lengkap fitur keuangan Fuenzer Bot.\n\n<b>COMMAND INTI:</b>\n• /saldo : Lihat ringkasan saldo terbaru\n• /catat &lt;nominal&gt; &lt;keterangan&gt; : Catat pengeluaran\n• /pemasukan &lt;nominal&gt; &lt;keterangan&gt; : Catat pemasukan\n• /laporan_chart : Tampilkan grafik laporan\n• /riwayat [halaman] : Riwayat transaksi (paging 5 data)\n• /edit &lt;id&gt; &lt;field&gt; &lt;nilai&gt; : Ubah transaksi\n• /hapus &lt;id&gt; : Hapus transaksi (dengan konfirmasi)\n\n<b>CONTOH CEPAT:</b>\n• <code>/catat 25000 makan siang</code>\n• <code>/pemasukan 150000 freelance logo</code>\n• <code>/riwayat 2</code>\n• <code>/edit 123e4567 nominal 30000</code>\n• <code>/hapus 123e4567</code>\n\n<b>TIPS:</b>\n• Gunakan /riwayat untuk ambil ID transaksi sebelum /edit atau /hapus\n• Tulisan nominal tanpa titik/koma agar lebih aman diproses`;
  }
  return `> *FINANCE TOOLS* 💰\n\nPanduan lengkap fitur keuangan Fuenzer Bot.\n\n*COMMAND INTI:*\n- /saldo : Lihat ringkasan saldo terbaru\n- /catat <nominal> <keterangan> : Catat pengeluaran\n- /pemasukan <nominal> <keterangan> : Catat pemasukan\n- /laporan_chart : Tampilkan grafik laporan\n- /riwayat [halaman] : Riwayat transaksi (paging 5 data)\n- /edit <id> <field> <nilai> : Ubah transaksi\n- /hapus <id> : Hapus transaksi (dengan konfirmasi)\n\n*CONTOH CEPAT:*\n- /catat 25000 makan siang\n- /pemasukan 150000 freelance logo\n- /riwayat 2\n- /edit 123e4567 nominal 30000\n- /hapus 123e4567\n\n*TIPS:*\n- Gunakan /riwayat untuk ambil ID transaksi sebelum /edit atau /hapus\n- Tulisan nominal tanpa titik/koma agar lebih aman diproses`;
}

function getRemindInfo(platform = 'whatsapp') {
  if (platform === 'telegram') {
    return `<b>REMINDER TOOLS</b> ⏰\n\nPanduan lengkap fitur pengingat (Reminder) Fuenzer Bot.\n\n<b>COMMAND INTI:</b>\n• /remind add &lt;waktu&gt; &lt;pesan&gt; : Buat pengingat sekali jalan\n• /remind loop &lt;waktu&gt; &lt;pesan&gt; : Buat pengingat berulang\n• /remind list : Tampilkan semua pengingat yang aktif\n• /remind hapus &lt;id&gt; : Hapus pengingat berdasarkan ID\n• /remind edit &lt;id&gt; &lt;waktu&gt; &lt;pesan&gt; : Edit pengingat\n\n<b>FORMAT WAKTU (Support Ms):</b>\n• Detik: <code>5s</code>, <code>30s</code>, <code>60s</code>\n• Menit: <code>1m</code>, <code>15m</code>, <code>30m</code>\n• Jam: <code>1h</code>, <code>2h</code>, <code>12h</code>\n• Hari: <code>1d</code>, <code>2d</code>, <code>7d</code>\n\n<b>CONTOH CEPAT:</b>\n• <code>/remind add 15m angkat jemuran</code>\n• <code>/remind loop 1d minum vitamin pagi</code>\n• <code>/remind edit A1B2C 2h minum vitamin siang</code>\n• <code>/remind hapus A1B2C</code>\n\n<b>TIPS:</b>\n• Gunakan <code>/remind list</code> untuk melihat ID unik dari pengingat.\n• Pengingat berulang akan selalu berjalan dengan interval yang telah ditentukan kecuali dihapus.`;
  }
  return `> *REMINDER TOOLS* ⏰\n\nPanduan lengkap fitur pengingat (Reminder) Fuenzer Bot.\n\n*COMMAND INTI:*\n- /remind add <waktu> <pesan> : Buat pengingat sekali jalan\n- /remind loop <waktu> <pesan> : Buat pengingat berulang\n- /remind list : Tampilkan semua pengingat yang aktif\n- /remind hapus <id> : Hapus pengingat berdasarkan ID\n- /remind edit <id> <waktu> <pesan> : Edit pengingat\n\n*FORMAT WAKTU (Support Ms):*\n- Detik: \`5s\`, \`30s\`, \`60s\`\n- Menit: \`1m\`, \`15m\`, \`30m\`\n- Jam: \`1h\`, \`2h\`, \`12h\`\n- Hari: \`1d\`, \`2d\`, \`7d\`\n\n*CONTOH CEPAT:*\n- /remind add 15m angkat jemuran\n- /remind loop 1d minum vitamin pagi\n- /remind edit A1B2C 2h minum vitamin siang\n- /remind hapus A1B2C\n\n*TIPS:*\n- Gunakan \`/remind list\` untuk melihat ID unik dari pengingat Anda. ID ini digunakan saat Anda ingin mengedit atau menghapus pengingat.\n- Pengingat berulang (loop) akan selalu berjalan dengan interval yang telah ditentukan kecuali dihapus.`;
}

function getTranslateInfo(platform = 'whatsapp') {
  if (platform === 'telegram') {
    return `<b>TRANSLATE TOOLS</b> 🌍\n\nPanduan menggunakan fitur terjemahan AI.\n\n<b>COMMAND INTI:</b>\n• <code>/translate &lt;kode_bahasa&gt; &lt;teks&gt;</code>\n• Atau <b>reply</b> pesan yang ingin diterjemahkan dengan <code>/translate &lt;kode_bahasa&gt;</code>\n\n<b>DAFTAR KODE BAHASA:</b>\n• <code>en</code> : English (Inggris)\n• <code>id</code> : Indonesia\n• <code>jv</code> : Javanese (Jawa)\n• <code>su</code> : Sundanese (Sunda)\n• <code>ar</code> : Arabic (Arab)\n• <code>ja</code> : Japanese (Jepang)\n• <code>ko</code> : Korean (Korea)\n• <code>zh</code> : Chinese (Mandarin)\n• <code>hi</code> : Hindi (India)\n• <code>ru</code> : Russian (Rusia)\n• <code>es</code> : Spanish (Spanyol)\n• <code>fr</code> : French (Perancis)\n• <code>de</code> : German (Jerman)\n• <code>it</code> : Italian (Italia)\n• <code>nl</code> : Dutch (Belanda)\n• <code>pt</code> : Portuguese (Portugis)\n• <code>th</code> : Thai (Thailand)\n• <code>vi</code> : Vietnamese (Vietnam)\n\n<b>CONTOH CEPAT:</b>\n• <code>/translate en Halo dunia, apa kabar?</code>\n• <code>/translate ar Selamat pagi</code>\n\n<b>TIPS:</b>\n• AI otomatis mendeteksi bahasa asal teks, Anda cukup tentukan bahasa tujuan.`;
  }
  return `> *TRANSLATE TOOLS* 🌍\n\nPanduan menggunakan fitur terjemahan AI.\n\n*COMMAND INTI:*\n- \`/translate <kode_bahasa> <teks>\`\n- Atau *reply* pesan yang ingin diterjemahkan dengan \`/translate <kode_bahasa>\`\n\n*DAFTAR KODE BAHASA (Ketikkan 2 huruf ini):*\n- \`en\` : English (Inggris)\n- \`id\` : Indonesia\n- \`jv\` : Javanese (Jawa)\n- \`su\` : Sundanese (Sunda)\n- \`ms\` : Sundanese (Sunda)\n- \`ar\` : Arabic (Arab)\n- \`ja\` : Japanese (Jepang)\n- \`ko\` : Korean (Korea)\n- \`zh\` : Chinese (Mandarin)\n- \`hi\` : Hindi (India)\n- \`ru\` : Russian (Rusia)\n- \`es\` : Spanish (Spanyol)\n- \`fr\` : French (Perancis)\n- \`de\` : German (Jerman)\n- \`it\` : Italian (Italia)\n- \`nl\` : Dutch (Belanda)\n- \`pt\` : Portuguese (Portugis)\n- \`th\` : Thai (Thailand)\n- \`vi\` : Vietnamese (Vietnam)\n\n*CONTOH CEPAT:*\n- \`/translate en Halo dunia, apa kabar?\`\n- \`/translate ar Selamat pagi\`\n\n*TIPS:*\n- AI otomatis mendeteksi bahasa asli dari teks yang Anda berikan, Anda hanya perlu menentukan bahasa tujuannya.`;
}

function getResearchInfo(platform = 'whatsapp') {
  if (platform === 'telegram') {
    return `<b>RESEARCH TOOLS</b> 📚\n\nPanduan Lengkap fitur riset Referensi buku, jurnal, dan artikel ilmiah.\n\n<b>COMMAND INTI:</b>\n• /buku &lt;keyword&gt; : Cari rekomendasi buku dari Open Library\n• /jurnal &lt;keyword&gt; : Cari referensi jurnal/artikel ilmiah dari Crossref\n• /artikel &lt;keyword&gt; : Cari artikel ilmiah dari OpenAlex\n\n<b>CONTOH CEPAT:</b>\n• <code>/buku atomic habits</code>\n• <code>/jurnal machine learning</code>\n• <code>/artikel deep learning healthcare</code>\n\n<b>OUTPUT:</b>\n• Judul, Penulis, Tahun, dan Link resmi (Open Library, DOI, atau Open Access PDF)\n\n<b>TIPS:</b>\n• Gunakan kata kunci spesifik untuk hasil optimal.`;
  }
  return `> *RESEARCH TOOLS* 📚\n\nPanduan Lengkap fitur riset Referensi buku, jurnal, dan artikel ilmiah.\n\n*COMMAND INTI:*\n- /buku <keyword> : Cari rekomendasi buku dari Open Library\n- /jurnal <keyword> : Cari referensi jurnal/artikel ilmiah dari Crossref\n- /artikel <keyword> : Cari artikel ilmiah dari OpenAlex\n\n*CONTOH CEPAT:*\n- /buku atomic habits\n- /jurnal machine learning\n- /artikel deep learning healthcare\n\n*OUTPUT /buku:*\n- Judul buku\n- Nama penulis\n- Tahun terbit pertama\n- Link Open Library\n\n*OUTPUT /jurnal:*\n- Judul artikel/jurnal\n- Nama penulis\n- Nama jurnal\n- Tahun terbit\n- Link DOI\n\n*OUTPUT /artikel:*\n- Judul artikel\n- Penulis (maks. 3 nama)\n- Tahun\n- Link PDF open access (jika tersedia) atau halaman artikel\n\n*TIPS:*\n- /jurnal bisa dipakai juga untuk cari artikel ilmiah berbasis kata kunci\n- Pakai kata kunci spesifik agar hasil lebih relevan\n- Jika hasil kurang pas, coba variasi bahasa Inggris/Indonesia`;
}

function getDownloaderInfo(platform = 'whatsapp') {
  if (platform === 'telegram') {
    return `<b>DOWNLOADER TOOLS</b> ⬇️\n\nPanduan Lengkap untuk download media dan audio.\n\n<b>COMMAND DOWNLOAD:</b>\n• /download &lt;url&gt; : Download media sosial (video/foto)\n• /audio &lt;url&gt; : Download audio dari YouTube/YouTube Music\n\n<b>CONTOH CEPAT:</b>\n• <code>/download https://www.instagram.com/reel/xxxx</code>\n• <code>/audio https://www.youtube.com/watch?v=xxxx</code>\n\n<b>SUPPORT PLATFORM:</b>\n• /download: Instagram, Twitter/X, YouTube, dan TikTok\n• /audio: YouTube dan YouTube Music\n\n<b>CATATAN:</b>\n• Jika media terlalu besar atau sumber menolak koneksi, coba beberapa saat lagi.`;
  }
  return `> *DOWNLOADER TOOLS* ⬇️\n\nPanduan Lengkap untuk download media dan audio.\n\n*COMMAND DOWNLOAD:*\n- /download <url> : Download media sosial (video/foto)\n- /audio <url> : Download audio dari YouTube/YouTube Music\n\n*CONTOH CEPAT:*\n- /download https://www.instagram.com/reel/xxxx\n- /audio https://www.youtube.com/watch?v=xxxx\n\n*SUPPORT PLATFORM:*\n- /download hanya support: Instagram, Twitter/X, YouTube, dan TikTok\n- /audio hanya support: YouTube dan YouTube Music\n\n*CATATAN:*\n- Jika media terlalu besar atau sumber menolak koneksi, coba ulang beberapa saat lagi`;
}

async function getImageToolsInfo(platform = 'whatsapp') {
  const footer = await buildImageToolsQuotaFooter(platform);
  if (platform === 'telegram') {
    const header = '<b>IMAGE TOOLS</b> 🖼️';
    const body = `Konversi, edit, hapus background, dan screenshot web.\n\n<b>MODE 1 - BALAS FOTO:</b>\n1. Balas pesan dengan gambar/foto\n2. Kirim salah satu command berikut:\n\n<pre>/img compress\n/img resize WxH\n/img to format\n/img rotate deg\n/hapusbg</pre>\n\n<b>MODE 2 - SCREENSHOT WEB:</b>\n<pre>/ss https://example.com</pre>\n\n<b>KETERANGAN:</b>\n• /img compress : Kompres ukuran gambar\n• /img resize WxH : Ubah ukuran (contoh: 500x500)\n• /img to format : Format didukung jpg, png, jpeg, webp\n• /img rotate deg : Sudut didukung 90, 180, 270\n• /hapusbg : Hapus background\n• /ss &lt;url&gt; : Screenshot website\n\n<b>BATASAN FILE FOTO:</b> Maks 5MB`;
    return appendFooter(`${header}\n\n${body}`, footer);
  }
  const header = '> *IMAGE TOOLS* 🖼️';
  const body = `Konversi, edit, hapus background, dan screenshot web.\n\n*MODE 1 - BALAS FOTO:*\n1. Balas pesan dengan gambar/foto\n2. Kirim salah satu command berikut\n\n\`\`\`\n/img compress\n/img resize WxH\n/img to format\n/img rotate deg\n/hapusbg\n\`\`\`\n\n*MODE 2 - SCREENSHOT WEB:*\n\`\`\`\n/ss https://example.com\n\`\`\`\n\n*KETERANGAN:*\n- /img compress : Kompres ukuran gambar\n- /img resize WxH : Ubah ukuran (contoh: 500x500)\n- /img to format : Format didukung jpg, png, jpeg, webp\n- /img rotate deg : Sudut didukung 90, 180, 270\n- /hapusbg : Hapus background (kuota 50/bulan)\n- /ss <url> : Screenshot website (kuota 50/bulan)\n\n*CATATAN REMOVE BG:*\nGratis hanya preview rendah (maks 0,25 MP).\n\n*BATASAN FILE FOTO:* Maks 5MB`;
  return appendFooter(`${header}\n\n${body}`, footer);
}

async function getPdfToolsInfo(platform = 'whatsapp') {
  const footer = await buildPdfToolsQuotaFooter(platform);
  if (platform === 'telegram') {
    const header = '<b>PDF TOOLS</b> 📄';
    const body = `Konversi, optimasi, rotasi, ekstrak, dan merge halaman PDF.\n\n<b>MODE 1 - KE PDF:</b>\n1. Balas/kirim dokumen atau media\n2. Kirim command:\n\n<pre>/topdf</pre>\n\n<b>MODE 2 - DARI PDF:</b>\nBalas/kirim file PDF, lalu gunakan:\n\n<pre>/pdf compress\n/pdf to format\n/pdf rotate deg\n/pdf extract 1-3,5</pre>\n\n<b>MODE 3 - MERGE BANYAK PDF:</b>\n<pre>/pdf merge start\n(kirim file PDF satu per satu)\n/pdf merge done\n/pdf merge cancel</pre>\n\n<b>KETERANGAN:</b>\n• /topdf : Konversi file ke PDF (CloudConvert)\n• /pdf compress : Kompres ukuran PDF (CloudConvert)\n• /pdf to format : Konversi PDF ke format lain (CloudConvert)\n• /pdf rotate deg : Rotasi semua halaman PDF (lokal)\n• /pdf extract pages : Ambil halaman tertentu (lokal)\n• /pdf merge start|done|cancel : Gabung banyak PDF (lokal)\n\n<b>CONTOH:</b>\n• <code>/pdf to docx</code>\n• <code>/pdf rotate 90</code>\n• <code>/pdf extract 1-3,5</code>\n• <code>/pdf merge start</code>\n\n<b>BATASAN:</b>\n• CloudConvert: max 10MB, kuota 10 request/hari\n• Proses lokal (rotate/extract/merge): max 15MB per file`;
    return appendFooter(`${header}\n\n${body}`, footer);
  }
  const header = '> *PDF TOOLS* 📄';
  const body = `Konversi, optimasi, rotasi, ekstrak, dan merge halaman PDF.\n\n*MODE 1 - KE PDF:*\n1. Balas dokumen atau media dengan format yang didukung\n2. Kirim command:\n\`\`\`\n/topdf\n\`\`\`\n\n*MODE 2 - DARI PDF:*\nBalas file PDF, lalu kirim salah satu command:\n\`\`\`\n/pdf compress\n/pdf to <format>\n/pdf rotate <sudut>\n/pdf extract <halaman>\n\`\`\`\n\n*MODE 3 - GABUNG (MERGE) BANYAK PDF:*\n\`\`\`\n/pdf merge start\n(Kirim file PDF satu per satu ke chat ini)\n/pdf merge done\n/pdf merge cancel\n\`\`\`\n\n*KETERANGAN FITUR:*\n- /topdf : Konversi dokumen/gambar ke PDF (CloudConvert)\n- /pdf compress : Kompres ukuran PDF (CloudConvert)\n- /pdf to <format> : Konversi PDF ke format lain (CloudConvert)\n- /pdf rotate <sudut> : Putar semua halaman PDF (lokal)\n- /pdf extract <halaman> : Ambil halaman tertentu (lokal)\n- /pdf merge start|done|cancel : Gabung banyak file PDF (lokal)\n\n*CONTOH PENGGUNAAN:*\n- /pdf to docx\n- /pdf rotate 90\n- /pdf extract 1-3,5\n- /pdf merge start\n\n*BATASAN:*\n- CloudConvert: Maks 10MB, kuota 10 request/hari\n- Proses lokal (rotate/extract/merge): Maks 15MB per file`;
  return appendFooter(`${header}\n\n${body}`, footer);
}

function getStickerInfo(platform = 'whatsapp') {
  if (platform === 'telegram') {
    return '<b>STICKER TOOLS</b> 🧩\n\nPanduan Lengkap sticker tools.\n\n/tosticker : Ubah gambar/video (max 5 dtk) jadi stiker.';
  }
  return '> *STICKER TOOLS* 🧩\n\nPanduan Lengkap sticker tools.\n\n/tosticker : Ubah gambar/video (max 5 dtk) jadi stiker.';
}

function getStartMessage(platform = 'whatsapp') {
  if (platform === 'telegram') {
    return '<b>SELAMAT DATANG DI FUENZER BOT</b> 🤖\n\nHalo! Saya adalah asisten virtual pribadi.\n\nGunakan /info untuk melihat daftar perintah lengkap.\n\nBot ini dapat membantu Anda dengan:\n• Manajemen keuangan (/saldo, /catat, dll)\n• Percakapan AI (langsung ketik pesan)\n• Dan berbagai fitur lainnya!';
  }
  return '> *SELAMAT DATANG DI FUENZER BOT* 🤖\n\nHalo! Saya adalah asisten virtual pribadi.\n\nGunakan /info untuk melihat daftar perintah lengkap.\n\nBot ini dapat membantu Anda dengan:\n• Manajemen keuangan (/saldo, /catat, dll)\n• Percakapan AI (langsung ketik pesan)\n• Dan berbagai fitur lainnya!';
}

function getInfoMessage(platform = 'whatsapp') {
  const footer = buildSystemStatsFooter(platform);
  if (platform === 'telegram') {
    const header = '<b>INFORMASI FUENZER BOT</b> 🤖';
    const body = `Saya adalah asisten virtual pribadi milik <b>Ridwan Yoga Suryantara</b>.\n\n<b>LAYANAN CS & FEEDBACK</b> 🆘\n• /help : Pusat Bantuan & Feedback\n\n<b>DUKUNGAN BOT</b> ☕\n• /donate : Link dukungan + QR donasi\n\n<b>FITUR KEUANGAN</b> 💰\n• /finance_info : Panduan Lengkap command keuangan\n\n<b>FITUR SISTEM</b> ⚙️\n• /ping : Cek status bot\n• /info : Menampilkan pesan ini\n• /start : Memulai bot\n\n<b>FITUR AI</b> 🧠\nKirim pesan biasa (tanpa awalan /) untuk ngobrol, tanya coding, atau diskusi teknologi.\n<i>(Support deteksi file: Gambar / Dokumen Teks)</i>\n• /model_info : Daftar model AI yang tersedia\n• /switch : Ganti model AI aktif\n\n<b>FITUR TRANSLATE</b> 🌍\n• /translate_info : Panduan Lengkap terjemah kata/kalimat\n\n<b>FITUR UTILITAS</b> 🛠️\n• /short : Pendekkan URL dengan is.gd\n• /research_info : Panduan Lengkap Referensi (buku/jurnal/artikel)\n• /downloader : Panduan Lengkap download (/download & /audio)\n• /remind_info : Panduan Lengkap fitur Reminder pengingat\n• /cuaca : Info cuaca hari ini\n• /sholat : Jadwal sholat hari ini\n• /me : Tentang pembuat bot\n\n<b>FITUR CONVERTER</b> 🖼️\n• /img_info : Panduan Lengkap image tools\n• /pdf_info : Panduan Lengkap PDF tools\n\n<b>FITUR STICKER</b> 🧩\n• /sticker_info : Panduan Lengkap sticker tools\n\n<b>FITUR ADMIN</b> 🛡️\n• /admin : Menu command admin`;
    return `${header}\n\n${body}\n\n${footer}`;
  }
  const header = '> *INFORMASI FUENZER BOT* 🤖';
  const body = `Saya adalah asisten virtual pribadi milik Ridwan Yoga Suryantara.\n\n🆘 *LAYANAN CS & FEEDBACK*\n- \`/help\`           : Pusat Bantuan & Feedback\n\n☕ *DUKUNGAN BOT*\n- \`/donate\`         : Link dukungan + QR donasi\n\n📋 *FITUR KEUANGAN* 💰\n- \`/finance_info\`   : Panduan Lengkap command keuangan\n\n📋 *FITUR SISTEM* ⚙️\n- \`/ping\`           : Cek status bot\n- \`/info\`           : Menampilkan pesan ini\n- \`/start\`          : Memulai bot\n\n💡 *FITUR AI* 🧠\nKirimkan pesan biasa (tanpa awalan '/') untuk ngobrol, bertanya seputar coding, teknologi, atau sekadar bertukar pikiran!\n*(Support deteksi file: Gambar / Dokumen Teks)*\n- \`/model_info\`     : Daftar model AI yang tersedia\n- \`/switch\`         : Ganti model AI aktif\n\n🌍 *FITUR TRANSLATE*\n- \`/translate_info\` : Panduan Lengkap terjemah kata/kalimat\n\n🛠️ *FITUR UTILITAS*\n- \`/short\`          : Pendekkan URL dengan is.gd\n- \`/research_info\`  : Panduan Lengkap Referensi (buku/jurnal/artikel)\n- \`/downloader\`     : Panduan Lengkap download (/download & /audio)\n- \`/remind_info\`    : Panduan Lengkap fitur Reminder pengingat\n- \`/cuaca\`          : Info cuaca hari ini\n- \`/sholat\`         : Jadwal sholat hari ini\n- \`/me\`             : Tentang pembuat bot\n\n🖼️ *FITUR CONVERTER* 📄\n- \`/img_info\`       : Panduan Lengkap image tools\n- \`/pdf_info\`       : Panduan Lengkap PDF tools\n\n🧩 *FITUR STICKER*\n- \`/sticker_info\`   : Panduan Lengkap sticker tools\n\n🛡️ *FITUR ADMIN*\n- \`/admin\`          : Menu command admin`;
  return appendFooter(`${header}\n\n${body}`, footer);
}

async function handleInfoCommand(command, args = [], userId = '', platform = 'whatsapp') {
  const cleanCommand = String(command || '').toLowerCase().trim();

  switch (cleanCommand) {
    case '/finance_info':
      return getFinanceInfo(platform);

    case '/remind_info':
      return getRemindInfo(platform);

    case '/translate_info':
      return getTranslateInfo(platform);

    case '/research_info':
      return getResearchInfo(platform);

    case '/downloader':
    case '/downloader_info':
      return getDownloaderInfo(platform);

    case '/img_info':
      return await getImageToolsInfo(platform);

    case '/pdf_info':
      return await getPdfToolsInfo(platform);

    case '/sticker_info':
      return getStickerInfo(platform);

    case '/start':
      return getStartMessage(platform);

    case '/info':
      return getInfoMessage(platform);

    case '/donate': {
      const donateText = buildDonateMessage(platform);
      const qrPaths = getDonateQrImagePaths();
      return {
        type: 'donate',
        text: donateText,
        qrPaths
      };
    }

    default:
      return 'Perintah panduan tidak dikenali.';
  }
}

module.exports = handleInfoCommand;
module.exports.handleInfoCommand = handleInfoCommand;
module.exports.getFinanceInfo = getFinanceInfo;
module.exports.getRemindInfo = getRemindInfo;
module.exports.getTranslateInfo = getTranslateInfo;
module.exports.getResearchInfo = getResearchInfo;
module.exports.getDownloaderInfo = getDownloaderInfo;
module.exports.getImageToolsInfo = getImageToolsInfo;
module.exports.getPdfToolsInfo = getPdfToolsInfo;
module.exports.getStickerInfo = getStickerInfo;
module.exports.getStartMessage = getStartMessage;
module.exports.getInfoMessage = getInfoMessage;
module.exports.buildImageToolsQuotaFooter = buildImageToolsQuotaFooter;
module.exports.buildPdfToolsQuotaFooter = buildPdfToolsQuotaFooter;
