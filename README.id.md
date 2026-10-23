<p align="center">
  <img src="assets/images/banner.png" alt="Fuenzer Bot Banner" width="70%" />
</p>

<h1 align="center">Fuenzer Bot</h1>

<p align="center">
  <b>Asisten Produktivitas Pribadi Otonom Multi-Platform (Omni-Channel)</b><br>
  Berjalan bersamaan di WhatsApp & Telegram · Ditenagai Node.js, Supabase, dan Serverless AI
</p>

<p align="center">
  <a href="https://github.com/Yogs4R/fuenzer-bot/releases"><img src="https://img.shields.io/github/v/release/Yogs4R/fuenzer-bot?style=flat-square&color=blue" alt="Release" /></a>
  <a href="https://github.com/Yogs4R/fuenzer-bot/actions/workflows/ci.yml"><img src="https://img.shields.io/github/actions/workflow/status/Yogs4R/fuenzer-bot/ci.yml?style=flat-square&label=CI" alt="CI Status" /></a>
  <img src="https://img.shields.io/badge/Node.js-20_LTS-339933?style=flat-square&logo=nodedotjs&logoColor=white" alt="Node.js" />
  <img src="https://img.shields.io/badge/WhatsApp-Baileys-25D366?style=flat-square&logo=whatsapp&logoColor=white" alt="WhatsApp" />
  <img src="https://img.shields.io/badge/Telegram-Telegraf-2CA5E0?style=flat-square&logo=telegram&logoColor=white" alt="Telegram" />
  <img src="https://img.shields.io/badge/Database-Supabase-3ECF8E?style=flat-square&logo=supabase&logoColor=white" alt="Supabase" />
  <img src="https://img.shields.io/badge/License-MIT-yellow?style=flat-square" alt="License" />
</p>

<p align="center">
  <a href="#apa-itu-fuenzer-bot">Tentang</a> •
  <a href="#preview">Preview</a> •
  <a href="#features">Fitur</a> •
  <a href="#tabel-referensi-command">Daftar Perintah</a> •
  <a href="#installation">Instalasi</a> •
  <a href="docs/ARCHITECTURE.md">Arsitektur</a> •
  <a href="docs/CICD.md">CI/CD</a> •
  <a href="docs/PRD.md">PRD</a>
</p>

<h4 align="center">
  <a href="README.md">English</a> | <a href="README.id.md">Bahasa Indonesia</a>
</h4>

<p align="center">
  <a href="https://ko-fi.com/fuenzer" target="_blank" rel="noopener noreferrer">
    <img src="https://ko-fi.com/img/githubbutton_sm.svg" alt="Dukung via Ko-fi" />
  </a>
  &nbsp;&nbsp;
  <a href="https://saweria.co/fuenzer" target="_blank" rel="noopener noreferrer">
    <img src="https://img.shields.io/badge/Saweria-Dukung%20Fuenzer%20Bot-FF6B00?style=for-the-badge&logo=buymeacoffee&logoColor=white" alt="Dukung via Saweria" />
  </a>
</p>

---

## Apa itu Fuenzer Bot?

**Fuenzer Bot** adalah asisten virtual mandiri dengan ketersediaan tinggi (*high-availability*) yang dirancang untuk meningkatkan produktivitas harian Anda dengan memadukan pencatatan keuangan, penalaran AI multi-modal, pengolahan dokumen, dan pemantauan server langsung dari aplikasi chat sehari-hari (WhatsApp & Telegram) tanpa perlu berganti-ganti aplikasi.

* **🔄 Arsitektur Omni-Channel:** Beroperasi secara bersamaan di WhatsApp (via Baileys) dan Telegram (via Telegraf).
* **🌐 Dukungan Bilingual & Internasionalisasi:** Default Bahasa Inggris (`en`) untuk evaluasi global dengan dukungan penuh Bahasa Indonesia (`id`) via `/lang [en|id]` dan alias perintah dwibahasa 1-ke-1.
* **🦥 Automated Morning Briefings:** Menampung tumpukan pesan grup yang ramai secara pasif dan mengirimkan ringkasan eksekutif via Google Gemma serta Voice Note santai ElevenLabs setiap pagi.
* **🔒 Privasi Terjaga dengan Enkripsi AES-256-GCM:** Semua percakapan grup yang ditampung dienkripsi sebelum disimpan ke database dengan format `iv:authTag:ciphertext` serta pembersihan otomatis (*retention purge*) 24 jam.
* **💰 Pencatatan Keuangan Praktis:** Catat pemasukan/pengeluaran secara instan via chat, cek saldo real-time, dan hasilkan grafik visual bulanan.
* **🛠 Utilitas Serbaguna (Swiss Army Knife):** Buat stiker WebP, hapus latar belakang foto, kompres/gabungkan PDF, serta pantau kesehatan server cloud VM Anda.

---

## Preview

<p align="center">
  <img src="assets/images/screenshot-wa.png" alt="WhatsApp Bot Screenshot" width="45%" />
  &nbsp;&nbsp;&nbsp;&nbsp;
  <img src="assets/images/screenshot-tele.png" alt="Telegram Bot Screenshot" width="45%" />
</p>
<p align="center">
  <i>Antarmuka multi-platform: Format teks WhatsApp native (kiri) dan format HTML Telegram (kanan).</i>
</p>

---

## Index

- [Apa itu Fuenzer Bot?](#apa-itu-fuenzer-bot)
- [Preview](#preview)
- [Features](#features)
- [Tabel Referensi Command](#tabel-referensi-command)
  - [Tabel Command Admin](#tabel-command-admin)
- [Installation](#installation)
- [Configuration](#configuration)
- [Tutorial Deploy di VM (Dari Nol Sampai PM2 Start)](#tutorial-deploy-di-vm-dari-nol-sampai-pm2-start)
- [CI/CD dan Auto Release](#cicd-dan-auto-release)
  - [A. Setup Secrets Repo & Variables GitHub](#a-setup-secrets-repo--variables-github)
  - [B. Setup Firewall untuk Auto Broadcast Webhook](#b-setup-firewall-untuk-auto-broadcast-webhook)
  - [C. Ringkasan Workflow & Trigger Rilis](#c-ringkasan-workflow--trigger-rilis)
  - [D. Panduan Lengkap CI/CD & Troubleshooting](#d-panduan-lengkap-cicd--troubleshooting)
- [Skema Database Supabase](#skema-database-supabase)
- [Cara Update Kode Lokal Tanpa Kehilangan Perubahan](#cara-update-kode-lokal-tanpa-kehilangan-perubahan)
- [Tutorial Integrasi Google Sheets (Customer Service)](#tutorial-integrasi-google-sheets-customer-service)

## Features

### 🔄 Multi-Platform Integration
Berjalan ganda secara independen namun terintegrasi penuh:
- **WhatsApp Bot** (powered by Baileys)
- **Telegram Bot** (powered by Telegraf)

### 🌐 Dukungan Dwibahasa (Bilingual & i18n)
Internasionalisasi penuh untuk kenyamanan pengguna lokal maupun internasional:
- **Default Bahasa Inggris (`en`)**: Siap untuk evaluasi global dan standar internasional.
- **Pilihan Bahasa Indonesia (`id`)**: Ganti preferensi bahasa dengan mudah kapan saja via `/lang en` atau `/lang id` (atau `/bahasa id`).
- **Alias Command 1-ke-1**: Jalankan setiap perintah dalam bahasa Inggris maupun bahasa Indonesia (contoh: `/balance` ↔ `/saldo`, `/record` ↔ `/catat`, `/weather` ↔ `/cuaca`, `/remind` ↔ `/ingatkan`).
- **Tolerant Caching & Fallback**: Preferensi bahasa disimpan dalam cache in-memory dan disinkronkan ke Supabase PostgreSQL tanpa risiko crash saat koneksi offline.

### 🔒 Privasi Data & Enkripsi Field-Level (AES-256-GCM)
Keamanan privasi percakapan tingkat tinggi yang dirancang tanpa kompromi:
- **AES-256-GCM at Rest**: Semua pesan grup yang disimpan ke tabel `chat_buffer` (teks pesan, nama pengirim, nama grup) dienkripsi di sisi aplikasi menggunakan AES-256-GCM dalam format `iv:authTag:ciphertext`.
- **Verifikasi Integritas Data (AEAD)**: Setiap payload dilengkapi authentication tag 16-byte untuk menolak data yang dimanipulasi atau korup.
- **Fail-Closed Security**: Ingestion mewajibkan adanya `ENCRYPTION_KEY`; jika kunci tidak disetel, penampungan pesan grup akan berhenti secara aman agar tidak menyimpan pesan dalam bentuk plaintext.
- **Retensi Efemeral 24 Jam**: Pesan grup yang telah diringkas memiliki batas simpan 24 jam sebelum dihapus permanen secara otomatis, dan pesan pasif yang belum diringkas akan dibersihkan setelah 7 hari.

### 🤖 AI Assistant
Asisten cerdas tingkat lanjut yang ditenagai oleh model bahasa besar (LLM) melalui integrasi OpenRouter API. Siap menjawab pertanyaan teknis, diskusi, dan coding.
- Dukungan **Multimodal** (mampu membaca file Gambar, dan mengekstrak isi Dokumen teks).
- Fitur **Penerjemah Bahasa** cepat menggunakan command `/translate`.
- Dukungan multi-model dengan command pergantian model per pengguna.
- Metadata penggunaan model di balasan (token usage dan label RPM).
- Mendukung jawaban multi-bahasa dengan menyesuaikan bahasa input pengguna.
- Mendukung alias perintah dwibahasa penuh dan respons output yang terlokalisasi di seluruh modul.

### 📚 Research Tools
Fitur riset referensi berbasis beberapa API publik (tanpa API key):
- Rekomendasi buku dari Open Library, pencarian jurnal dari Crossref, dan pencarian artikel ilmiah dari OpenAlex.
- Pencarian jurnal juga bisa digunakan untuk mencari referensi artikel berdasarkan topik.
- Menampilkan judul, penulis, tahun, dan link sumber (DOI/PDF open access jika tersedia).
- Fallback pesan lebih jelas saat timeout/down/network error sesuai provider.

### ⬇️ Downloader Tools
Kumpulan command downloader media dan audio:
- Mendukung unduhan media dari Instagram, Twitter/X, YouTube, dan TikTok.
- Mendukung unduhan audio dari YouTube dan YouTube Music.
- Tersedia utilitas pemendek URL via is.gd.

### 💰 Finance Management
Pencatatan keuangan interaktif langsung dari dalam chat:
- Cek saldo terkini
- Pencatatan pemasukan dan pengeluaran dinamis
- Laporan visual dalam bentuk grafik (chart)
- Riwayat transaksi berhalaman dengan tombol kendali
- Kemampuan hapus (dengan konfirmasi) dan edit transaksi

### 🗂️ Media and File Converter
Layanan konversi file dan media tangguh dengan dukungan batch:
- Konversi gambar, kompres, rotasi, resize, hapus background, hingga tangkapan layar web (screenshot).
- Operasi dokumen PDF: Word/Docx ke PDF, compress PDF, rotasi, ekstrak halaman, hingga menggabungkan (merge) berbagai file PDF menjadi satu dokumen.
- Generator stiker untuk input gambar WhatsApp dan Telegram.

### 🖥️ System and Server Monitoring
Infrastruktur backend yang andal dengan dukungan monitoring:
- Pemantauan metrik perangkat keras (CPU, RAM, dan Uptime).
- Pemantauan uptime website reguler.
- Command Usage Tracker untuk melaporkan statistik top tier pengguna dan perintah terpopuler.
- Pusat command admin untuk monitor, statistik command/AI, dan broadcast.
- Cron job monitor akan mengirim notifikasi hanya jika ada website yang down.

### 🛠️ Daily Utilities
Layanan pendamping yang bermanfaat:
- Reminder & Cronjob (Pengingat harian/sekali jalan dengan opsi loop)
- Pemeriksa jadwal sholat per kota
- Pemeriksa kondisi cuaca per kota teraktual
- Modul *About Me* portfolio kreator
- Modul donasi dengan pengiriman QR Ko-fi dan Saweria di chat.

### 🆘 Customer Service & Feedback
Sistem tiket sederhana untuk menerima pertanyaan dan masukan pengguna:
- Meneruskan pertanyaan (`/ask`) dan masukan (`/feedback`) langsung ke Google Sheets.
- Analisis sentimen otomatis di Spreadsheet (Positif, Negatif, Netral).
- Balas pertanyaan user langsung dari bot menggunakan command `/answer` (khusus Admin).

---

## Tabel Referensi Command

### 1. Perintah Bahasa Inggris (`en` - Default)

| Command | Deskripsi | Library yang Digunakan | Contoh Penggunaan |
|---|---|---|---|
| `/start` | Mulai bot dan tampilkan menu cepat | Baileys, Telegraf | `/start` |
| `/info` | Tampilkan kategori command dan panduan bot | Baileys, Telegraf | `/info` |
| `/lang`, `/language` | Cek atau ubah bahasa antarmuka bot (`en` atau `id`) | languageService, Supabase | `/lang en`, `/lang id` |
| `/ping` | Cek status online bot dan metrik resource sistem | Node.js os module | `/ping` |
| `/balance` | Tampilkan ringkasan saldo keuangan terbaru | financeService, Supabase | `/balance` |
| `/record`, `/expense` | Catat transaksi pengeluaran | financeService, Supabase | `/record 25000 lunch` |
| `/income` | Catat transaksi pemasukan | financeService, Supabase | `/income 150000 freelance` |
| `/chart` | Buat laporan keuangan visual grafik | financeService, QuickChart | `/chart` |
| `/history` | Tampilkan riwayat transaksi berhalaman | financeService, Supabase | `/history 2` |
| `/edit` | Ubah transaksi berdasarkan ID | financeService, Supabase | `/edit 123e4567 30000 dinner` |
| `/delete` | Hapus transaksi dengan konfirmasi ID | financeService, Supabase | `/delete 123e4567` |
| `/weather` | Tampilkan prakiraan cuaca kota | weatherService, OpenWeather | `/weather bandung` |
| `/prayer` | Tampilkan jadwal sholat harian kota | religionService, MyQuran API | `/prayer bandung` |
| `/remind` | Pasang pengingat waktu | reminderService, node-cron, Supabase | `/remind add 15m Laundry` |
| `/about`, `/me` | Tampilkan profil pembuat bot | aboutService | `/about` |
| `/book` | Cari referensi buku | Open Library API, axios | `/book clean code` |
| `/journal` | Cari referensi jurnal ilmiah | Crossref API, axios | `/journal machine learning` |
| `/article` | Cari referensi artikel ilmiah | OpenAlex API, axios | `/article deep learning` |
| `/translate` | Terjemahkan teks atau pesan | aiClient, OpenRouter | `/translate id Hello world` |
| `/model_info` | Tampilkan daftar model AI yang tersedia | OpenRouter, aiPreferenceService | `/model_info` |
| `/switch` | Ganti model AI aktif per pengguna | OpenRouter, aiPreferenceService | `/switch gemma4` |
| `/help` | Pusat bantuan dan layanan Customer Service | csService | `/help` |
| `/feedback` | Kirim feedback ke Google Sheets | csService, GAS | `/feedback great bot` |
| `/ask` | Kirim pertanyaan ke admin via CS | csService, GAS | `/ask how to donate?` |
| `/download` | Unduh media sosial (IG, TikTok, X, YT) | downloaderService | `/download https://...` |
| `/audio` | Ekstrak audio dari YouTube | downloaderService | `/audio https://...` |
| `/img` | Konversi, resize, rotasi, kompres gambar | converterService, Sharp | `/img to png` |
| `/removebg` | Hapus background gambar | converterService, remove.bg API | `/removebg` |
| `/screenshot`, `/ss` | Screenshot halaman website | converterService, html-to-image | `/ss https://example.com` |
| `/topdf` | Konversi dokumen/gambar ke PDF | converterService, CloudConvert | `/topdf` |
| `/pdf` | Kompres, rotasi, ekstrak, gabung PDF | converterService, CloudConvert, PDF tools | `/pdf compress` |
| `/sticker` | Ubah gambar atau video pendek jadi stiker | stickerService | `/sticker` (balas foto) |
| `/short`, `/shortlink` | Pendekkan link URL dengan is.gd | shortenerService, is.gd API | `/short https://github.com` |
| `/donate` | Tampilkan tautan donasi & QRIS | donateService | `/donate` |

### 2. Alias Perintah Bahasa Indonesia (`id` - Bahasa Indonesia)

| Command (ID) | Padanan English | Deskripsi | Contoh Penggunaan |
|---|---|---|---|
| `/bahasa` | `/lang` | Cek atau ubah bahasa antarmuka bot | `/bahasa id`, `/bahasa en` |
| `/saldo` | `/balance` | Tampilkan ringkasan saldo keuangan | `/saldo` |
| `/catat`, `/pengeluaran` | `/record`, `/expense` | Catat pengeluaran keuangan | `/catat 25000 makan siang` |
| `/pemasukan` | `/income` | Catat pemasukan keuangan | `/pemasukan 150000 freelance` |
| `/laporan_chart` | `/chart` | Tampilkan grafik keuangan | `/laporan_chart` |
| `/riwayat` | `/history` | Tampilkan riwayat transaksi | `/riwayat 2` |
| `/hapus` | `/delete` | Hapus transaksi berdasarkan ID | `/hapus 123e4567` |
| `/cuaca` | `/weather` | Cek prakiraan cuaca kota | `/cuaca jakarta` |
| `/sholat`, `/jadwalsholat` | `/prayer` | Cek jadwal sholat kota | `/sholat jakarta` |
| `/ingatkan` | `/remind` | Pasang pengingat waktu | `/ingatkan add 10m jemuran` |
| `/buku` | `/book` | Cari referensi buku | `/buku clean code` |
| `/jurnal` | `/journal` | Cari referensi jurnal ilmiah | `/jurnal machine learning` |
| `/artikel`, `/paper` | `/article`, `/paper` | Cari artikel ilmiah | `/artikel healthcare` |
| `/terjemah`, `/terjemahkan` | `/translate` | Terjemahkan teks atau pesan | `/terjemah en Selamat pagi` |
| `/model`, `/models` | `/model_info` | Tampilkan daftar model AI yang tersedia | `/model` |
| `/bantuan` | `/help` | Bantuan & CS | `/bantuan` |
| `/saran` | `/feedback` | Kirim feedback ke Google Sheets | `/saran bot mantap` |
| `/unduh` | `/download` | Unduh media sosial | `/unduh https://...` |
| `/suara` | `/audio` | Unduh audio YouTube | `/suara https://...` |
| `/shortlink`, `/pendekkan` | `/short` | Pendekkan link URL | `/shortlink https://...` |
| `/hapusbg` | `/removebg` | Hapus latar belakang gambar | `/hapusbg` |
| `/tosticker` | `/sticker` | Ubah media jadi stiker | `/tosticker` |

### Tabel Command Admin

| Command | Deskripsi | Library yang digunakan | Contoh penggunaan |
|---|---|---|---|
| /admin | Buka pusat command admin | auth util, modul admin | /admin |
| /monitor | Jalankan cek status website manual | monitorService | /monitor |
| /cmd_usage | Tampilkan statistik command terpopuler | modul admin, log service | /cmd_usage |
| /ai_usage | Tampilkan statistik penggunaan AI per model | modul admin, log service | /ai_usage |
| /broadcast | Kirim broadcast admin ke pengguna | modul admin, WhatsApp/Telegram clients | /broadcast maintenance malam ini |
| /answer | Balas pertanyaan user khusus admin | csService, admin modul | /answer 628123xxx pesan admin |

---

## Installation

1. Clone repositori
```bash
git clone https://github.com/Yogs4R/fuenzer-bot.git
cd yoga-bot
```

2. Instal dependensi
```bash
npm install
```

3. Konfigurasi kredensial
Salin file `.env.example` menjadi `.env` lalu sesuaikan dengan kunci API dan token Anda (Supabase, Telegram, OpenRouter, CloudConvert, RemoveBg).

4. Jalankan aplikasi
```bash
npm start
```

## Configuration

File `.env` berisi seluruh konfigurasi penting. Pastikan Anda menyalin `.env.example` menjadi `.env` dan mengisi nilainya dengan benar (tanpa kutip tambahan).

**Penjelasan Konfigurasi Kunci:**
- **WhatsApp**: `WA_SESSION_DIR` (Folder data auth), `WA_PHONE_NUMBER` (Nomor bot), `BOT_WA_LID` (ID LID khusus bot bila diperlukan).
- **Telegram**: `TELEGRAM_BOT_TOKEN` dan `TELEGRAM_BOT_USERNAME` (Dari BotFather), serta `TELEGRAM_SESSION_DIR` (Folder session).
- **Database (Supabase)**: `SUPABASE_URL`, `SUPABASE_PUBLISHABLE_KEY` (Role anon), `SUPABASE_SECRET_KEY` (Service role untuk bypass RLS bot admin).
- **API AI**: `GEMINI_API_KEY` atau `OPENROUTER_API_KEY`.
- **API Lainnya**: `OPENWEATHER_API_KEY` untuk info cuaca, `REMOVEBG_API_KEY`, `CLOUDCONVERT_API_KEY`, *HCTI* (ss web), dan `GAS_WEBAPP_URL` untuk layanan Google Sheets feedback.
- **Keamanan & Privasi Data (AES-256-GCM)**: `ENCRYPTION_KEY` (Kunci rahasia 32-byte untuk enkripsi percakapan grup). Generate kunci hex 64-karakter (32 byte) dengan perintah:
  ```bash
  node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
  ```
- **Monitoring**: `MONITOR_URLS` (Web yang dicek oleh bot) dan `MONITOR_INTERVAL` (Jeda cek, misalnya 300000ms = 5 menit).

*Catatan: Cron job laporan kesehatan server berjalan setiap pagi (06:00, zona waktu server) dan hanya mengirim pesan saat ada website monitor yang down. Jika semua website normal, pesan tidak akan dikirim.*

---

## Tutorial Deploy di VM (Dari Nol Sampai PM2 Start)

Panduan ini telah diuji pada Ubuntu 22.04 / 24.04 LTS dan Debian 12.

### Opsi 1: Setup Otomatis 1-Baris (Direkomendasikan)
Jalankan script otomasi provision kami langsung di terminal VM Anda untuk menginstal Node.js 20 LTS, `ffmpeg`, `build-essential`, `pm2`, dan konfigurasi firewall UFW secara otomatis:

```bash
curl -fsSL https://raw.githubusercontent.com/Yogs4R/fuenzer-bot/main/scripts/setup-vm.sh | bash
```

Setelah script selesai, Anda cukup menjalankan bot dengan langkah berikut:
```bash
# 1. Clone repository
git clone https://github.com/Yogs4R/fuenzer-bot.git ~/fuenzer-bot
cd ~/fuenzer-bot

# 2. Install dependensi & siapkan file .env
npm install
cp .env.example .env
nano .env

# 3. Jalankan dan simpan proses dengan PM2
pm2 start src/index.js --name fuenzerbot
pm2 save
pm2 startup
```

<details>
<summary><b>Opsi 2: Instalasi Manual Step-by-Step</b></summary>

1. **Masuk ke VM via SSH:**
   ```bash
   ssh username@ip-vm
   ```
2. **Install dependensi sistem & ffmpeg:**
   ```bash
   sudo apt update && sudo apt upgrade -y
   sudo apt install -y git curl build-essential ffmpeg ca-certificates
   ```
3. **Install Node.js 20 LTS & PM2:**
   ```bash
   curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
   sudo apt install -y nodejs
   sudo npm install -g pm2
   ```
4. **Konfigurasi Firewall UFW (Buka SSH & Webhook 3000):**
   ```bash
   sudo ufw allow ssh
   sudo ufw allow 3000/tcp
   sudo ufw reload
   ```
5. **Clone, Konfigurasi & Jalankan:**
   ```bash
   git clone https://github.com/Yogs4R/fuenzer-bot.git
   cd fuenzer-bot
   npm install
   cp .env.example .env
   nano .env
   pm2 start src/index.js --name fuenzerbot
   pm2 save
   pm2 startup
   ```
</details>

### Command Operasional PM2:
```bash
pm2 status                  # Cek status bot & penggunaan memori
pm2 logs fuenzerbot --lines 100 # Lihat log live bot
pm2 restart fuenzerbot      # Restart bot
pm2 stop fuenzerbot         # Hentikan bot
```

---

## CI/CD dan Auto Release

Repositori ini telah dilengkapi dengan automasi workflow GitHub Actions untuk pengujian CI, auto-deploy ke VM via SSH, pembuatan rilis GitHub otomatis, dan broadcast notifikasi rilis secara real-time ke pengguna WhatsApp & Telegram.

### A. Setup Secrets Repo & Variables GitHub
Agar CI/CD dapat bekerja dan fitur auto broadcast release berjalan, buat repository secrets di GitHub repo Anda (`Settings > Secrets and variables > Actions > New repository secret`):
- `HOST`: IP VM Anda (digunakan untuk auto-deploy SSH).
- `USERNAME`: Username remote akses VM Anda (contoh: `my_vm`).
- `SSH_KEY`: Private SSH Key untuk autentikasi deploy otomatis dari GitHub ke VM Anda.
- `VM_IP`: Alamat IP VM Anda (digunakan sebagai alamat target hit webhook auto-broadcast).
- `AUTO_BROADCAST_RELEASE`: Password secret webhook yang harus sama dengan yang Anda tulis di dalam `.env` VM Anda.

### B. Setup Firewall untuk Auto Broadcast Webhook
Pastikan server (VM) telah membuka port TCP `3000` (atau PORT env server Anda) agar Webhook otomatis GitHub Actions bisa berkomunikasi. Pastikan juga akses SSH (`22`) tidak ditutup agar Anda tidak kehilangan akses.

```bash
sudo ufw allow ssh
sudo ufw allow 3000/tcp
sudo ufw reload
sudo ufw status
```

### C. Ringkasan Workflow & Trigger Rilis
1. **Pull Request & Commit (`ci.yml`):** Otomatis dipindai oleh Gitleaks untuk mencegah kebocoran secret, diverifikasi agar tidak ada file kredensial (`.env`, `auth/`, `credentials/`) yang ter-commit, dan divalidasi keabsahan sintaksis JavaScript-nya.
2. **Push ke `main` (`deploy.yml`):** Otomatis menarik kode terbaru ke VM Anda via SSH dan me-restart proses PM2 (`fuenzerbot`).
3. **Memicu Auto Release (`auto-release.yml`):**
   Gunakan format commit konvensional (`feat:`, `fix:`, `refactor:`, `chore:`) lalu buat dan push tag versi:
   ```bash
   git tag v1.1.0
   git push origin v1.1.0
   ```
   Pipeline akan otomatis merangkum changelog, membuat GitHub Release, dan memicu webhook bot untuk menyiarkan pesan rilis ke pengguna.

### D. Panduan Lengkap CI/CD & Troubleshooting
Untuk dokumentasi teknis mendalam—termasuk aturan `.github/changelog-config.json`, panduan smoke test pipeline, solusi error umum (`Empty CHANGELOG`, `401 Unauthorized`), hingga cara rollback tag jika salah versi—silakan baca panduan terpisah:
👉 **[Panduan Lengkap CI/CD & Rilis (`docs/CICD.md`)](./docs/CICD.md)**

---

## Skema Database Supabase

Pastikan RLS (Row Level Security) menyala saat Anda membuat tabel-tabel di Supabase:

```sql
-- command_logs table:
-- Menyimpan riwayat penggunaan command oleh user untuk keperluan statistik.
CREATE TABLE command_logs (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    user_id TEXT NOT NULL,
    platform TEXT NOT NULL,
    command TEXT NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- user_preferences table:
-- Menyimpan preferensi pengguna, seperti model AI yang sedang aktif.
CREATE TABLE user_preferences (
    user_id TEXT PRIMARY KEY,
    platform TEXT,
    active_model TEXT DEFAULT 'openai/gpt-oss-120b',
    language VARCHAR(5) DEFAULT 'en',
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ai_logs table:
-- Menyimpan log penggunaan AI, termasuk model yang dipakai dan jumlah token.
CREATE TABLE ai_logs (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    user_id TEXT NOT NULL,
    platform TEXT NOT NULL,
    model TEXT NOT NULL,
    prompt TEXT,
    input_tokens INT,
    output_tokens INT,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- api_quotas table:
-- Mengatur limit dan melacak penggunaan kuota API pihak ketiga (removebg, cloudconvert, dll).
CREATE TABLE public.api_quotas (
  service text not null,
  usage integer null default 0,
  updated_at timestamp with time zone null default now(),
  "limit" integer null default 50,
  constraint api_quotas_pkey primary key (service)
) TABLESPACE pg_default;

-- Note: Untuk cloudconvert batas defaultnya diset berbeda
UPDATE api_quotas SET "limit" = 10 WHERE service = 'cloudconvert';

-- finance table:
-- Menyimpan data catatan keuangan (pemasukan & pengeluaran) pengguna.
CREATE TABLE public.finance (
  id uuid not null default gen_random_uuid (),
  user_id text null,
  amount bigint null,
  type text null,
  description text null,
  created_at timestamp with time zone null default now(),
  platform text null,
  updated_at timestamp with time zone null,
  constraint finance_pkey primary key (id)
) TABLESPACE pg_default;

-- reminders table:
-- Menyimpan catatan pengingat dan loop dari fitur reminder.
CREATE TABLE reminders (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  message TEXT NOT NULL,
  trigger_time BIGINT NOT NULL,
  is_loop BOOLEAN DEFAULT FALSE,
  loop_interval BIGINT
);

-- chat_buffer table:
-- Menyimpan pesan grup terenkripsi AES-256-GCM secara efemeral untuk ringkasan AI pagi hari.
CREATE TABLE chat_buffer (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    platform VARCHAR(30) NOT NULL,            -- 'whatsapp', 'telegram', 'discord', 'slack'
    chat_id VARCHAR(100) NOT NULL,            -- Group / Room identifier
    chat_name TEXT,                           -- Nama grup terenkripsi (AES-256-GCM)
    sender_name TEXT,                         -- Nama pengirim terenkripsi (AES-256-GCM)
    message_text TEXT NOT NULL,               -- Isi pesan terenkripsi (AES-256-GCM)
    is_summarized BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_chat_buffer_unsummarized 
    ON chat_buffer(platform, chat_id, is_summarized, created_at);

CREATE INDEX idx_chat_buffer_cleanup 
    ON chat_buffer(is_summarized, created_at);

-- user_summarize_settings table:
-- Menyimpan preferensi jadwal pengiriman briefing pagi per user atau grup.
CREATE TABLE user_summarize_settings (
    user_id VARCHAR(100) PRIMARY KEY,
    platform VARCHAR(30) NOT NULL,
    is_active BOOLEAN DEFAULT TRUE,
    schedule_time VARCHAR(5) DEFAULT '08:00',  -- Format 24 jam (HH:mm)
    voice_note_enabled BOOLEAN DEFAULT TRUE,
    language VARCHAR(5) DEFAULT 'en',          -- 'en' atau 'id'
    last_run_at TIMESTAMPTZ
);
```

---

## Cara Update Kode Lokal Tanpa Kehilangan Perubahan

Jika Anda (atau kolaborator) telah memodifikasi kode secara lokal dan ingin mengambil update terbaru dari repositori tanpa menghilangkan modifikasi tersebut, gunakan kombinasi perintah git berikut:

```bash
# Opsi 1: Menggunakan Git Stash
# 1. Simpan perubahan lokal Anda sementara
git stash
# 2. Ambil update terbaru dari repository
git pull origin main
# 3. Kembalikan perubahan lokal yang disimpan
git stash pop

# Opsi 2: Menggunakan Git Rebase Autostash (Satu baris)
# Perintah ini secara otomatis menyimpan sementara (stash) perubahan Anda,
# melakukan rebase terhadap commit terbaru, lalu mengembalikan (pop) modifikasi tersebut.
git pull --rebase --autostash
```

---

## Tutorial Integrasi Google Sheets (Customer Service)

Fitur `/ask` dan `/feedback` membutuhkan URL Web App dari Google Apps Script (GAS) untuk menyimpan data ke spreadsheet secara langsung.

1. Buat Spreadsheet baru di [Google Sheets](https://sheets.google.com).
2. Buat header pada baris pertama (A1 - F1):
   `Timestamp` | `Type` | `User_ID` | `Message` | `Status` | `Customer Sentiment`
3. Buat tabel dan berikan nama "User Questions" atau apapun yang anda sukai.
4. Pada sel **F2** (Customer Sentiment), masukkan formula analisis otomatis berikut dan drag/tarik ke baris-baris bawahnya:
   ```excel
   =IF(ISBLANK(D2), "", IF(REGEXMATCH(LOWER(D2), "good|great|excellent|awesome|love|thanks|thank you|happy|bagus|keren|mantap|terima kasih|suka|puas"), "Positive", IF(REGEXMATCH(LOWER(D2), "bad|terrible|awful|hate|issue|problem|error|fail|angry|upset|worst|poor|jelek|buruk|masalah|rusak|gagal|kecewa"), "Negative", "Netral")))
   ```
5. Klik menu **Ekstensi > Apps Script**.
6. Hapus kode bawaan yang ada, lalu paste kode berikut:
   ```javascript
   function doPost(e) {
    try {
      const sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName("User Questions");
      
      // Jika sheet tidak ditemukan, hentikan proses untuk mencegah error
      if (!sheet) throw new Error("Tab 'User Questions' tidak ditemukan!");
      const data = JSON.parse(e.postData.contents);

      if (data.action === "UPDATE_STATUS") {
        const dataRange = sheet.getDataRange();
        const values = dataRange.getValues();
        
        // Cari dari urutan terbawah agar yang diupdate adalah pertanyaan TERBARU dari user tersebut
        for (let i = values.length - 1; i >= 1; i--) {
          // Kolom C (index 2) adalah User_ID, Kolom E (index 4) adalah Status
          if (values[i][2].toString() === data.userId.toString() && values[i][4] === "UNANSWERED") {
            sheet.getRange(i + 1, 5).setValue("ANSWERED"); // Mengubah sel di Kolom E
          }
        }
        return ContentService.createTextOutput(JSON.stringify({"status": "success", "message": "Status Updated"}))
          .setMimeType(ContentService.MimeType.JSON);
      }
      
      // Siapkan data untuk dimasukkan ke baris baru
      const rowData = [
        new Date(), 
        data.type,       // 'FEEDBACK' atau 'ASK'
        data.userId,     // Nomor WA/Tele pengguna
        data.message,    // Isi pesan
        'UNANSWERED'     // Status default
      ];
      
      sheet.appendRow(rowData);
      
      return ContentService.createTextOutput(JSON.stringify({"status": "success"}))
        .setMimeType(ContentService.MimeType.JSON);
    } catch (error) {
      return ContentService.createTextOutput(JSON.stringify({"status": "error", "message": error.toString()}))
        .setMimeType(ContentService.MimeType.JSON);
    }
   }
   ```
7. Klik **Terapkan (Deploy) > Deployment baru**.
8. Pilih jenis **Aplikasi Web (Web App)**. Set "Akses" ke **Siapa saja (Anyone)**.
9. Salin URL Web App yang dihasilkan (berakhiran `/exec`).
10. Buka file `.env` dan tambahkan variabel environment berikut lalu restart bot:
   ```env
   GAS_WEBAPP_URL="URL_WEBAPP_ANDA_DISINI"
   ```
