<p align="center">
  <img src="https://img.shields.io/badge/Node.js-339933?style=for-the-badge&logo=nodedotjs&logoColor=white" alt="Node.js" />
  <img src="https://img.shields.io/badge/WhatsApp-25D366?style=for-the-badge&logo=whatsapp&logoColor=white" alt="WhatsApp" />
  <img src="https://img.shields.io/badge/Telegram-2CA5E0?style=for-the-badge&logo=telegram&logoColor=white" alt="Telegram" />
  <img src="https://img.shields.io/badge/Supabase-3ECF8E?style=for-the-badge&logo=supabase&logoColor=white" alt="Supabase" />
  <img src="https://img.shields.io/badge/AI_Powered-OpenRouter-blue?style=for-the-badge" alt="AI Powered" />
</p>

<p align="center">
  <img src="assets/images/banner.png" alt="Fuenzer Bot Banner" width="100%" />
</p>

<h1 align="center">Personal Bot Core - Fuenzer Bot</h1>

<h4 align="center">
    <a href="README.md">English</a> | <a href="README.id.md">Indonesia</a>
</h4>

<p align="center">
  <a href="https://ko-fi.com/fuenzer">
    <img src="https://ko-fi.com/img/githubbutton_sm.svg" alt="Dukung via Ko-fi" />
  </a>
  <a href="https://saweria.co/fuenzer">
    <img src="https://img.shields.io/badge/Saweria-Dukung%20Fuenzer%20Bot-FF6B00?style=for-the-badge&logo=buymeacoffee&logoColor=white" alt="Dukung via Saweria" />
  </a>
</p>

Fuenzer Bot adalah asisten virtual mandiri yang berjalan secara paralel di WhatsApp dan Telegram. Dirancang untuk meningkatkan produktivitas harian dengan memadukan pengelolaan keuangan, kecerdasan buatan, pemrosesan file media, hingga pemantauan server pribadi.

## Index

- [Features](#features)
- [Tabel Referensi Command](#tabel-referensi-command)
  - [Tabel Command Admin](#tabel-command-admin)
- [Preview](#preview)
- [Installation](#installation)
- [Configuration](#configuration)
- [Tutorial Deploy di VM (Dari Nol Sampai PM2 Start)](#tutorial-deploy-di-vm-dari-nol-sampai-pm2-start)
- [Tutorial CI/CD dan Auto Release (Step by Step)](#tutorial-cicd-dan-auto-release-step-by-step)
  - [A. Setup Secrets Repo & Variables GitHub](#a-setup-secrets-repo--variables-github)
  - [B. Setup Firewall untuk Auto Broadcast Webhook](#b-setup-firewall-untuk-auto-broadcast-webhook)
  - [C. Struktur file yang wajib ada](#c-struktur-file-yang-wajib-ada)
  - [D. Contoh changelog-config.json](#d-contoh-changelog-configjson)
  - [E. Contoh workflow auto-release.yml](#e-contoh-workflow-auto-releaseyml)
  - [F. Aturan format commit agar masuk changelog](#f-aturan-format-commit-agar-masuk-changelog)
  - [G. Cara trigger auto release](#g-cara-trigger-auto-release)
  - [H. Error umum dan solusinya](#h-error-umum-dan-solusinya)
  - [I. Checklist cepat setelah clone repo](#i-checklist-cepat-setelah-clone-repo)
  - [J. Smoke Test CI/CD (Copy-Paste untuk rilis pertama)](#j-smoke-test-cicd-copy-paste-untuk-rilis-pertama)
  - [K. Rollback saat tag release salah](#k-rollback-saat-tag-release-salah)
- [Skema Database Supabase](#skema-database-supabase)
- [Cara Update Kode Lokal Tanpa Kehilangan Perubahan](#cara-update-kode-lokal-tanpa-kehilangan-perubahan)
- [Tutorial Integrasi Google Sheets (Customer Service)](#tutorial-integrasi-google-sheets-customer-service)

## Features

### 🔄 Multi-Platform Integration
Berjalan ganda secara independen namun terintegrasi penuh:
- **WhatsApp Bot** (powered by Baileys)
- **Telegram Bot** (powered by Telegraf)

### 🤖 AI Assistant
Asisten cerdas tingkat lanjut yang ditenagai oleh model bahasa besar (LLM) melalui integrasi OpenRouter API. Siap menjawab pertanyaan teknis, diskusi, dan coding.
- Dukungan **Multimodal** (mampu membaca file Gambar, dan mengekstrak isi Dokumen teks).
- Fitur **Penerjemah Bahasa** cepat menggunakan command `/translate`.
- Dukungan multi-model dengan command pergantian model per pengguna.
- Metadata penggunaan model di balasan (token usage dan label RPM).
- Mendukung jawaban multi-bahasa dengan menyesuaikan bahasa input pengguna.
- Sebagian besar command bot masih dioptimalkan dengan label dan contoh berbahasa Indonesia.

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

| Command | Deskripsi | Library yang digunakan | Contoh penggunaan |
|---|---|---|---|
| /start | Mulai bot dan tampilkan menu cepat | Baileys, Telegraf | /start |
| /info | Tampilkan kategori command dan info bot | Baileys, Telegraf | /info |
| /ping | Cek status online bot dan footer sistem | Node.js os module | /ping |
| /model_info | Tampilkan model AI dan alias yang tersedia | OpenRouter, aiPreferenceService | /model_info |
| /switch | Ganti model AI aktif per pengguna | OpenRouter, aiPreferenceService | /switch elephant |
| /translate_info | Panduan panduan lengkap penggunaan fitur terjemahan | aiClient, OpenRouter | /translate_info |
| /translate | Terjemahkan teks atau reply pesan ke bahasa tertentu | aiClient, OpenRouter | /translate en Halo dunia |
| /finance_info | Panduan Lengkap command keuangan | financeService, Supabase | /finance_info |
| /saldo | Tampilkan ringkasan saldo terbaru | financeService, Supabase | /saldo |
| /catat | Catat transaksi pengeluaran | financeService, Supabase | /catat 25000 makan siang |
| /pemasukan | Catat transaksi pemasukan | financeService, Supabase | /pemasukan 150000 freelance |
| /laporan_chart | Buat laporan keuangan berbentuk grafik | financeService, chart renderer | /laporan_chart |
| /riwayat | Tampilkan riwayat transaksi berhalaman | financeService, Supabase | /riwayat 2 |
| /edit | Ubah transaksi berdasarkan id dan field | financeService, Supabase | /edit 123e4567 nominal 30000 |
| /hapus | Hapus transaksi dengan konfirmasi | financeService, Supabase | /hapus 123e4567 |
| /remind_info | Panduan perintah reminder / pengingat | reminderService, node-cron | /remind_info |
| /remind | Tambah teks pengingat, loop opsi, target waktu | reminderService, node-cron, Supabase | /remind "Meeting Tim" 10m loop |
| /research_info | Panduan Lengkap pencarian Referensi, termasuk info bahwa /jurnal juga bisa mencari artikel | researchService, axios | /research_info |
| /buku | Cari referensi buku | Open Library API, axios | /buku clean code |
| /jurnal | Cari referensi jurnal dan artikel | Crossref API, axios | /jurnal machine learning |
| /artikel | Cari referensi artikel ilmiah | OpenAlex API, axios | /artikel deep learning healthcare |
| /downloader | Panduan Lengkap download media | downloaderService | /downloader |
| /cuaca | Tampilkan info cuaca per kota | weatherService, weather API | /cuaca bandung |
| /sholat | Tampilkan jadwal sholat per kota | religionService, prayer time API | /sholat bandung |
| /me | Tampilkan profil pembuat dan link penting | aboutService | /me |
| /img_info | Panduan Lengkap image tools | converterService | /img_info |
| /img | Konversi, resize, rotate, kompres gambar | converterService, image processor | /img to png |
| /hapusbg | Hapus background gambar | converterService, remove.bg API | /hapusbg |
| /ss | Screenshot website dari URL | converterService, html-to-image engine | /ss https://example.com |
| /pdf_info | Panduan Lengkap PDF tools | converterService | /pdf_info |
| /topdf | Konversi dokumen/media ke PDF | converterService, CloudConvert | /topdf |
| /pdf | Kompres, konversi, rotate, extract, merge PDF | converterService, CloudConvert, PDF tools | /pdf compress |
| /sticker_info | Panduan Lengkap sticker tools | stickerService | /sticker_info |
| /donate | Tampilkan link dukungan dan QR donasi | donateService | /donate |
| /help | Tampilkan pusat bantuan dan menu CS | csService | /help |
| /feedback | Kirim saran/masukan (tersimpan ke Google Sheets) | csService, GAS | /feedback botnya bagus |
| /ask | Kirim pertanyaan ke admin via CS | csService, GAS | /ask cara donasi? |

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

## Preview

| Platform | Screenshot |
|---|---|
| WhatsApp Bot | <img src="assets/images/screenshot-wa.png" alt="WhatsApp Bot Screenshot" width="260" /> |
| Telegram Bot | <img src="assets/images/screenshot-tele.png" alt="Telegram Bot Screenshot" width="260" /> |

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
- **Admin**: `ADMIN_WA_NUMBERS` dan `ADMIN_TELE_IDS` (Daftar ID yang dipisahkan koma untuk akses monitor & broadcast).
- **Monitoring**: `MONITOR_URLS` (Web yang dicek oleh bot) dan `MONITOR_INTERVAL` (Jeda cek, misalnya 300000ms = 5 menit).

*Catatan: Cron job laporan kesehatan server berjalan setiap pagi (06:00, zona waktu server) dan hanya mengirim pesan saat ada website monitor yang down. Jika semua website normal, pesan tidak akan dikirim.*

---

## Tutorial Deploy di VM (Dari Nol Sampai PM2 Start)

Panduan ini menggunakan Ubuntu 22.04 LTS sebagai contoh. Sesuaikan jika Anda memakai distro lain.

1. Masuk ke VM via SSH
```bash
ssh username@ip-vm
```

2. Update package OS
```bash
sudo apt update && sudo apt upgrade -y
```

3. Install dependensi dasar
```bash
sudo apt install -y git curl build-essential ffmpeg
```

4. Install Node.js LTS (contoh Node 20)
```bash
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
sudo apt install -y nodejs
node -v
npm -v
```

5. Clone repository
```bash
git clone https://github.com/Yogs4R/fuenzer-bot.git
cd fuenzer-bot
```

6. Install dependency project
```bash
npm install
```

7. Siapkan file environment
```bash
cp .env.example .env
nano .env
```

8. Isi variabel penting di `.env`
- Telegram: `TELEGRAM_BOT_TOKEN`, `TELEGRAM_BOT_USERNAME`
- OpenRouter/Gemini: `OPENROUTER_API_KEY`, `GEMINI_API_KEY`
- Supabase: `SUPABASE_URL`, `SUPABASE_PUBLISHABLE_KEY`, `SUPABASE_SECRET_KEY`
- CloudConvert: `CLOUDCONVERT_API_KEY`
- RemoveBG: `REMOVEBG_API_KEY`
- Cuaca: `OPENWEATHER_API_KEY`
- Admin dan monitoring: `ADMIN_WA_NUMBERS`, `ADMIN_TELE_IDS`, `MONITOR_URLS`

9. Jalankan test lokal singkat
```bash
npm start
```
Jika proses berjalan normal, hentikan dengan `Ctrl + C`.

10. Install PM2 secara global
```bash
sudo npm install -g pm2
pm2 -v
```

11. Jalankan bot dengan PM2
```bash
pm2 start src/index.js --name fuenzer-bot
pm2 status
pm2 logs fuenzer-bot
```

12. Simpan state PM2 agar auto-start saat reboot
```bash
pm2 save
pm2 startup
```
Ikuti command tambahan yang ditampilkan PM2 (biasanya perlu `sudo`).

13. Command operasional harian PM2
```bash
pm2 restart fuenzer-bot
pm2 stop fuenzer-bot
pm2 delete fuenzer-bot
pm2 logs fuenzer-bot --lines 200
```

---

## Tutorial CI/CD dan Auto Release (Step by Step)

Bagian ini penting untuk yang baru clone repo agar tidak bingung saat GitHub Actions gagal.

### A. Setup Secrets Repo & Variables GitHub
Agar CI/CD dapat bekerja dan fitur auto broadcast release berjalan, buat repository secrets dan variables di GitHub repo Anda (`Settings > Secrets and variables > Actions > New repository secret`):
- `HOST`: IP VM Anda (digunakan untuk auto-deploy SSH, opsional bila ada workflow deploy).
- `USERNAME`: Username remote akses VM Anda (contoh: `my_vm`).
- `SSH_KEY`: Private SSH Key untuk autentikasi deploy otomatis dari GitHub ke VM Anda.
- `VM_IP`: Alamat IP VM Anda (digunakan sebagai alamat target hit webhook auto-broadcast).
- `AUTO_BROADCAST_RELEASE`: Password secret webhook yang harus sama dengan yang Anda tulis di dalam `.env` VM Anda.

### B. Setup Firewall untuk Auto Broadcast Webhook
Pastikan server (VM) telah membuka port TCP `3000` (atau PORT env server Anda) agar Webhook otomatis GitHub Actions bisa berkomunikasi. Pastikan juga akses SSH (`22`) tidak ditutup agar Anda tidak kehilangan akses.

1. Masuk ke terminal SSH VM Anda.
2. Jalankan perintah di bawah untuk mengizinkan koneksi SSH dan port `3000` via UFW:
   ```bash
   sudo ufw allow ssh
   sudo ufw allow 3000/tcp
   sudo ufw reload
   sudo ufw status
   ```

### C. Struktur file yang wajib ada

1. Workflow release di `.github/workflows/auto-release.yml`
2. Konfigurasi changelog di `.github/changelog-config.json`

### D. Konfigurasi `changelog-config.json`

File ini digunakan oleh *changelog builder* untuk mengkategorikan setiap commit (misal: `feat:`, `fix:`, atau `chore:`). Anda cukup memastikan tag pada commit diurutkan sesuai pola yang didaftarkan di dalam *label_extractors* sehingga hasil di GitHub Release lebih tertata per kategori.

### E. Workflow `auto-release.yml`

Workflow ini menggunakan `actions/checkout` untuk mengambil kode dan *changelog builder* Action. Pipeline akan dieksekusi setiap Anda melakukan **push tag dengan awalan "v"** (misalnya `v1.0.0`). Action kemudian secara otomatis merangkum pesan commit sejak versi sebelumnya menjadi draf Release dan memublikasikannya ke tab Releases di repository.

Selain itu, workflow ini telah diintegrasikan dengan langkah **Webhook Broadcast**. Segera setelah GitHub Release berhasil dipublikasikan, ia akan menggunakan `jq` untuk memformat versi dan catatan pembaruan ke dalam payload JSON, lalu mengirim request HTTP POST secara otomatis menuju backend bot Anda (`http://${VM_IP}:3000/webhook-release`). Ini akan memberikan sinyal kepada bot agar segera menyiarkan pemberitahuan update "What's New" kepada seluruh pengguna WhatsApp maupun Telegram secara real-time.

### F. Aturan format commit agar masuk changelog

Gunakan awalan commit message berikut:
- `feat: tambah command baru`
- `fix: perbaiki parsing argumen`
- `chore: update dependency`
- `refactor: rapikan handler`
- `docs: update README` (akan di-ignore jika `documentation` ada di `ignore_labels`)

### G. Cara trigger auto release

1. Commit dan push ke branch utama
```bash
git add .
git commit -m "feat: tambah tutorial deploy vm"
git push origin main
```

2. Buat dan push tag versi
```bash
git tag v1.0.6
git push origin v1.0.6
```

3. Cek tab Actions dan Releases di GitHub

### H. Error umum dan solusinya

1. `CHANGELOG kosong`
- Pastikan ada commit baru sejak tag sebelumnya.
- Pastikan format commit sesuai regex (`feat:`, `fix:`, dst).
- Pastikan `mode: COMMIT` aktif di workflow.

2. `No categories found` atau commit tidak terkelompok
- Pastikan `target` di `label_extractors` sama persis dengan label di `categories`.

3. `Workflow tidak jalan`
- Pastikan trigger di workflow adalah `push` ke `tags: v*`.
- Pastikan Anda benar-benar push tag, bukan hanya commit.

4. `Permission denied` saat create release
- Pastikan workflow punya:
  - `permissions: contents: write`

5. Error karena file config tidak ditemukan
- Pastikan path benar: `.github/changelog-config.json`

### I. Checklist cepat setelah clone repo

1. Pastikan folder `.github/workflows` dan file `.github/changelog-config.json` ikut ter-clone.
2. Pastikan commit message mengikuti pola yang didukung.
3. Pastikan release dipicu lewat push tag `v*`.

### J. Smoke Test CI/CD (Copy-Paste untuk rilis pertama)

Jalankan dari root repository. Ganti `v1.0.6` jika versi tersebut sudah dipakai.

```bash
# 1) Cek branch aktif dan update terbaru
git branch --show-current
git pull origin main

# 2) Buat commit uji yang pasti terbaca changelog
git commit --allow-empty -m "feat: smoke test auto release pipeline"
git push origin main

# 3) Buat tag rilis pertama untuk pengujian
git tag v1.0.6
git push origin v1.0.6

# 4) Verifikasi tag sudah ter-push
git ls-remote --tags origin
```

Jika tag sudah pernah ada dan ingin tes ulang dengan versi lain:

```bash
# Contoh ganti ke versi baru
git tag v1.0.7
git push origin v1.0.7
```

Verifikasi di GitHub setelah command di atas:

1. Tab Actions: workflow `Auto Release` status sukses.
2. Tab Releases: release baru dengan judul tag (mis. `v1.0.6`).
3. Isi release notes tidak kosong dan memuat commit `feat: smoke test auto release pipeline`.

### K. Rollback saat tag release salah

Jika salah push tag (misalnya typo versi), hapus tag lokal dan remote lalu buat tag baru.

```bash
# Contoh: tag salah v1.0.6, ganti ke v1.0.7
git tag -d v1.0.6
git push origin :refs/tags/v1.0.6

git tag v1.0.7
git push origin v1.0.7
```

Catatan:
1. Jika release `v1.0.6` sudah sempat terbentuk di tab Releases, hapus release tersebut juga dari GitHub UI agar rapi.
2. Jangan re-use nama tag yang sama untuk commit berbeda.

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