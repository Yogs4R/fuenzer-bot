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
    <img src="https://ko-fi.com/img/githubbutton_sm.svg" alt="Support via Ko-fi" />
  </a>
  <a href="https://saweria.co/fuenzer">
    <img src="https://img.shields.io/badge/Saweria-Dukung%20Fuenzer%20Bot-FF6B00?style=for-the-badge&logo=buymeacoffee&logoColor=white" alt="Support via Saweria" />
  </a>
</p>

Fuenzer Bot is a standalone virtual assistant that runs in parallel on WhatsApp and Telegram. Designed to increase daily productivity by combining financial management, artificial intelligence, media file processing, and personal server monitoring.

## Index

- [Features](#features)
- [Command Reference Table](#command-reference-table)
  - [Admin Commands Table](#admin-commands-table)
- [Preview](#preview)
- [Installation](#installation)
- [Configuration](#configuration)
- [VM Deployment Tutorial (From Scratch to PM2 Start)](#vm-deployment-tutorial-from-scratch-to-pm2-start)
- [CI/CD and Auto Release Tutorial (Step by Step)](#cicd-and-auto-release-tutorial-step-by-step)
  - [A. Setup Repository Secrets & Variables](#a-setup-repository-secrets--variables)
  - [B. Setup Firewall for Auto Broadcast Webhook](#b-setup-firewall-for-auto-broadcast-webhook)
  - [C. Required file structure](#c-required-file-structure)
  - [D. Example changelog-config.json](#d-example-changelog-configjson)
  - [E. Example auto-release.yml](#e-example-auto-releaseyml)
  - [F. Commit message format rules for changelog](#f-commit-message-format-rules-for-changelog)
  - [G. How to trigger auto release](#g-how-to-trigger-auto-release)
  - [H. Common errors and fixes](#h-common-errors-and-fixes)
  - [I. Quick checklist after cloning this repo](#i-quick-checklist-after-cloning-this-repo)
  - [J. CI/CD Smoke Test (Copy-Paste for first release)](#j-cicd-smoke-test-copy-paste-for-first-release)
  - [K. Rollback when release tag is wrong](#k-rollback-when-release-tag-is-wrong)
- [Supabase Database Schema](#supabase-database-schema)
- [Updating Local Code (Without Losing Changes)](#updating-local-code-without-losing-changes)
- [Google Sheets Integration Tutorial (Customer Service)](#google-sheets-integration-tutorial-customer-service)

## Features

### 🔄 Multi-Platform Integration
Runs simultaneously, independently but fully integrated:
- **WhatsApp Bot** (powered by Baileys)
- **Telegram Bot** (powered by Telegraf)

### 🤖 AI Assistant
Advanced smart assistant powered by large language models (LLM) via OpenRouter API integration. Ready to answer technical questions, discussions, and coding.
- **Multimodal** support (capable of reading Images, Audio/Voice Notes, and extracting Text Documents).
- **Fast Translator** command using `/translate`.
- Multi-model support with user-level model switching command.
- Built-in model usage metadata in replies (token usage and RPM label).
- Supports multilingual answers by following the user's input language.
- Most bot commands are still optimized with Indonesian command labels and examples.

### 📚 Research Tools
Research references powered by multiple public APIs (no API key required):
- Book discovery from Open Library, journal lookup from Crossref, and scientific article lookup from OpenAlex.
- Journal lookup can also be used to search article references by topic keywords.
- Returns title, authors, year, and source link (DOI/Open Access PDF when available).
- Better fallback messages for timeout/down/network errors per provider.

### ⬇️ Downloader Tools
Unified downloader commands for social media and music:
- Supports media downloads from Instagram, Twitter/X, YouTube, and TikTok.
- Supports audio downloads from YouTube and YouTube Music.
- Built-in URL shortener utility via is.gd.

### 💰 Finance Management
Interactive financial logging directly from chat:
- Check current balance
- Dynamic income and expense logging
- Visual reports in chart format
- Paginated transaction history with control buttons
- Ability to delete (with confirmation) and edit transactions

### 🗂️ Media and File Converter
Powerful file and media conversion services with batch support:
- Image conversion, compress, rotate, resize, remove background, to web screenshots.
- PDF document operations: Word/Docx to PDF, compress PDF, rotate, extract pages, to merge various PDF files into a single document.
- Sticker generator for WhatsApp and Telegram image input.

### 🖥️ System and Server Monitoring
Reliable backend infrastructure with monitoring support:
- Hardware metrics monitoring (CPU, RAM, and Uptime).
- Regular website uptime monitoring.
- Command Usage Tracker to report top-tier user statistics and most popular commands.
- Admin command center for monitor checks, usage tracker, and broadcast tools.
- Monitor cron job sends notification only when any monitored website is down.

### 🛠️ Daily Utilities
Useful companion services:
- Reminder & Cronjob (Daily/One-time reminder with loop options)
- Prayer times checker per city
- Real-time weather condition checker per city
- *About Me* creator portfolio module
- Donation module with Ko-fi and Saweria QR delivery in chat.

### 🆘 Customer Service & Feedback
Simple ticketing system to receive user questions and feedback:
- Forwards questions (`/ask`) and feedback (`/feedback`) directly to Google Sheets using Google Apps Script.
- Automated sentiment analysis directly inside the Spreadsheet (Positive, Negative, Neutral).
- Reply to user questions straight from the bot using the `/answer` command (Admin only).

---

## Command Reference Table

| Command | Description | Library Used | Example Usage |
|---|---|---|---|
| /start | Start bot and show quick menu | Baileys, Telegraf | /start |
| /info | Show command categories and bot info | Baileys, Telegraf | /info |
| /ping | Check bot online status and system footer | Node.js os module | /ping |
| /model_info | Show available AI models and aliases | OpenRouter, aiPreferenceService | /model_info |
| /switch | Switch active AI model per user | OpenRouter, aiPreferenceService | /switch elephant |
| /translate_info | Show full guide for translation system | aiClient, OpenRouter | /translate_info |
| /translate | Translate text or replied message to a specific language | aiClient, OpenRouter | /translate en Hello world |
| /finance_info | Full finance command guide | financeService, Supabase | /finance_info |
| /saldo | Show latest balance summary | financeService, Supabase | /saldo |
| /catat | Record expense transaction | financeService, Supabase | /catat 25000 lunch |
| /pemasukan | Record income transaction | financeService, Supabase | /pemasukan 150000 freelance |
| /laporan_chart | Generate finance chart report | financeService, chart renderer | /laporan_chart |
| /riwayat | Show paginated transaction history | financeService, Supabase | /riwayat 2 |
| /edit | Edit transaction by id and field | financeService, Supabase | /edit 123e4567 nominal 30000 |
| /hapus | Delete transaction with confirmation | financeService, Supabase | /hapus 123e4567 |
| /remind_info | Full reminder command guide | reminderService, node-cron | /remind_info |
| /remind | Add reminder message, loop option, target time | reminderService, node-cron, Supabase | /remind "Team Meeting" 10m loop |
| /research_info | Full reference search guide, including note that /jurnal can also search article references | researchService, axios | /research_info |
| /buku | Search book references | Open Library API, axios | /buku clean code |
| /jurnal | Search journal and article references | Crossref API, axios | /jurnal machine learning |
| /artikel | Search scientific article references | OpenAlex API, axios | /artikel deep learning healthcare |
| /downloader | Full media downloader guide | downloaderService | /downloader |
| /cuaca | Show weather information by city | weatherService, external weather API | /cuaca bandung |
| /sholat | Show prayer times by city | religionService, prayer time API | /sholat bandung |
| /me | Show creator profile and links | aboutService | /me |
| /img_info | Full image tools guide | converterService | /img_info |
| /img | Image convert, resize, rotate, compress | converterService, image processor | /img to png |
| /hapusbg | Remove image background | converterService, remove.bg API | /hapusbg |
| /ss | Capture website screenshot | converterService, html-to-image engine | /ss https://example.com |
| /pdf_info | Full PDF tools guide | converterService | /pdf_info |
| /topdf | Convert document/media to PDF | converterService, CloudConvert | /topdf |
| /pdf | Compress, convert, rotate, extract, merge PDF | converterService, CloudConvert, PDF tools | /pdf compress |
| /sticker_info | Full sticker tools guide | stickerService | /sticker_info |
| /donate | Show support links and donation QR | donateService | /donate |
| /help | Show help center and Customer Service menu | csService | /help |
| /feedback | Send feedback (saved to Google Sheets) | csService, GAS | /feedback great bot |
| /ask | Send question to admin via CS | csService, GAS | /ask how to donate? |

### Admin Commands Table

| Command | Description | Library Used | Example Usage |
|---|---|---|---|
| /admin | Open admin command center | auth util, admin command module | /admin |
| /monitor | Run website status check manually | monitorService | /monitor |
| /cmd_usage | Show top command usage stats | admin module, log service | /cmd_usage |
| /ai_usage | Show AI usage stats by model | admin module, log service | /ai_usage |
| /broadcast | Send admin broadcast to users | admin module, WhatsApp/Telegram clients | /broadcast maintenance tonight |
| /answer | Reply to user question (admin only) | csService, admin module | /answer 628123xxx admin message |

---

## Preview

| Platform | Screenshot |
|---|---|
| WhatsApp Bot | <img src="assets/images/screenshot-wa.png" alt="WhatsApp Bot Screenshot" width="260" /> |
| Telegram Bot | <img src="assets/images/screenshot-tele.png" alt="Telegram Bot Screenshot" width="260" /> |

---

## Installation

1. Clone the repository
```bash
git clone https://github.com/Yogs4R/fuenzer-bot.git
cd yoga-bot
```

2. Install dependencies
```bash
npm install
```

3. Configure credentials
Copy the `.env.example` file to `.env` and adjust it with your API keys and tokens (Supabase, Telegram, OpenRouter, CloudConvert, RemoveBg).

4. Run the application
```bash
npm start
```

## Configuration

The `.env` file contains all essential configuration strings. Copy `.env.example` to `.env` and fill the variables completely (without any extra quotes).

**Key Configuration Explanations:**
- **WhatsApp**: `WA_SESSION_DIR` (Auth data folder), `WA_PHONE_NUMBER` (Bot's phone number), `BOT_WA_LID` (Specific bot WhatsApp LID if needed).
- **Telegram**: `TELEGRAM_BOT_TOKEN` and `TELEGRAM_BOT_USERNAME` (From BotFather), and `TELEGRAM_SESSION_DIR` (Session folder).
- **Database (Supabase)**: `SUPABASE_URL`, `SUPABASE_PUBLISHABLE_KEY` (Anon public key), `SUPABASE_SECRET_KEY` (Service role to bypass RLS for admin).
- **AI APIs**: `GEMINI_API_KEY` or `OPENROUTER_API_KEY`.
- **Other APIs**: `OPENWEATHER_API_KEY` for weather features, `REMOVEBG_API_KEY`, `CLOUDCONVERT_API_KEY`, *HCTI* (web screenshots), and `GAS_WEBAPP_URL` for Google Sheets feedback service.
- **Admin**: `ADMIN_WA_NUMBERS` and `ADMIN_TELE_IDS` (Comma-separated IDs for monitor & broadcast accesses).
- **Monitoring**: `MONITOR_URLS` (Websites monitored by the bot) and `MONITOR_INTERVAL` (Interval gap, e.g. 300000ms = 5 minutes).

*Note: The cron job for server health reports runs every morning (06:00, server time) and sends a message only when one or more monitored websites are down. If all websites are healthy, no alert message is sent.*

---

## VM Deployment Tutorial (From Scratch to PM2 Start)

This guide uses Ubuntu 22.04 LTS as an example. Adjust commands if you use a different distro.

1. SSH into your VM
```bash
ssh username@vm-ip
```

2. Update OS packages
```bash
sudo apt update && sudo apt upgrade -y
```

3. Install base dependencies
```bash
sudo apt install -y git curl build-essential ffmpeg
```

4. Install Node.js LTS (example: Node 20)
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

6. Install project dependencies
```bash
npm install
```

7. Prepare environment file
```bash
cp .env.example .env
nano .env
```

8. Fill required variables in `.env`
- Telegram: `TELEGRAM_BOT_TOKEN`, `TELEGRAM_BOT_USERNAME`
- OpenRouter/Gemini: `OPENROUTER_API_KEY`, `GEMINI_API_KEY`
- Supabase: `SUPABASE_URL`, `SUPABASE_PUBLISHABLE_KEY`, `SUPABASE_SECRET_KEY`
- CloudConvert: `CLOUDCONVERT_API_KEY`
- RemoveBG: `REMOVEBG_API_KEY`
- Weather: `OPENWEATHER_API_KEY`
- Admin and monitoring: `ADMIN_WA_NUMBERS`, `ADMIN_TELE_IDS`, `MONITOR_URLS`

9. Run a quick local test
```bash
npm start
```
If the process runs normally, stop it with `Ctrl + C`.

10. Install PM2 globally
```bash
sudo npm install -g pm2
pm2 -v
```

11. Start bot with PM2
```bash
pm2 start src/index.js --name fuenzer-bot
pm2 status
pm2 logs fuenzer-bot
```

12. Persist PM2 process for reboot
```bash
pm2 save
pm2 startup
```
Run the extra command shown by PM2 (usually needs `sudo`).

13. Daily PM2 operations
```bash
pm2 restart fuenzer-bot
pm2 stop fuenzer-bot
pm2 delete fuenzer-bot
pm2 logs fuenzer-bot --lines 200
```

---

## CI/CD and Auto Release Tutorial (Step by Step)

This section is important for people who clone this repository and wonder why GitHub Actions fails.

### A. Setup Repository Secrets & Variables
To enable CI/CD auto-deployment and the auto broadcast release feature, you need to configure Secrets in your GitHub Repository (`Settings > Secrets and variables > Actions > New repository secret`):
- `HOST`: Your VM IP address (used for SSH deploy, optional but recommended).
- `USERNAME`: Your VM SSH username (e.g., `my_vm`).
- `SSH_KEY`: Your private SSH key for accessing the VM automatically.
- `VM_IP`: Your VM IP (used as the webhook URL target).
- `AUTO_BROADCAST_RELEASE`: The secret password you set in the `.env` file of your VM for the webhook endpoint security.

### B. Setup Firewall for Auto Broadcast Webhook
The auto-broadcast webhook endpoint runs on port `3000` by default. You must open this port in your VM internal firewall securely so GitHub Actions can reach it. Make sure not to block your SSH access (`22`).

1. SSH to your VM.
2. Execute this command to allow SSH and port 3000 through the Ubuntu Uncomplicated Firewall (UFW):
   ```bash
   sudo ufw allow ssh
   sudo ufw allow 3000/tcp
   sudo ufw reload
   sudo ufw status
   ```

### C. Required file structure

1. Release workflow at `.github/workflows/auto-release.yml`
2. Changelog config at `.github/changelog-config.json`

### D. Configure `changelog-config.json`

This file is used by the *changelog builder* to group and categorize specific commits (e.g. `feat:`, `fix:`, or `chore:`). Ensure you commit messages correctly matching the patterns configured in its `label_extractors` rules so the result mapped in GitHub Release remains grouped well.

### E. Workflow `auto-release.yml`

This workflow utilizes `actions/checkout` and an open-source *changelog builder* action. It triggers the job each time you run a **push tag starting with "v"** (e.g., `v1.0.0`). The action summarizes the commits between versions to automatically create a release draft and publishes it natively on the Releases page of your GitHub project.

Additionally, this workflow includes a **Webhook Broadcast** step. Once the GitHub Release is created, it formats the exact changelog notes along with the version tag into a JSON payload using `jq`, and sends an HTTP POST request to your bot's live server (`http://${VM_IP}:3000/webhook-release`). This triggers the bot to automatically broadcast the *What's New* release notes to all of your WhatsApp and Telegram users in real-time.

### F. Commit message format rules for changelog

Use commit prefixes like:
- `feat: add new command`
- `fix: resolve argument parsing`
- `chore: update dependency`
- `refactor: clean handler`
- `docs: update README` (ignored if `documentation` is listed in `ignore_labels`)

### G. How to trigger auto release

1. Commit and push to main branch
```bash
git add .
git commit -m "feat: add vm deployment tutorial"
git push origin main
```

2. Create and push a version tag
```bash
git tag v1.0.6
git push origin v1.0.6
```

3. Check GitHub Actions and Releases tabs

### H. Common errors and fixes

1. `Empty CHANGELOG`
- Ensure there are new commits after the previous tag.
- Ensure commit format matches regex (`feat:`, `fix:`, etc).
- Ensure workflow uses `mode: COMMIT`.

2. `No categories found` or commits not grouped
- Ensure each `target` in `label_extractors` exactly matches a label in `categories`.

3. `Workflow not triggered`
- Ensure workflow trigger is `push` on `tags: v*`.
- Ensure you pushed a tag, not only a commit.

4. `Permission denied` when creating release
- Ensure workflow includes:
  - `permissions: contents: write`

5. Config file not found error
- Ensure path is correct: `.github/changelog-config.json`

### I. Quick checklist after cloning this repo

1. Ensure `.github/workflows` and `.github/changelog-config.json` are present after clone.
2. Ensure commit messages follow supported patterns.
3. Ensure release is triggered by pushing a `v*` tag.

### J. CI/CD Smoke Test (Copy-Paste for first release)

Run these commands from the repository root. Replace `v1.0.6` if that version already exists.

```bash
# 1) Check active branch and pull latest changes
git branch --show-current
git pull origin main

# 2) Create a guaranteed changelog-visible test commit
git commit --allow-empty -m "feat: smoke test auto release pipeline"
git push origin main

# 3) Create and push first release tag for testing
git tag v1.0.6
git push origin v1.0.6

# 4) Verify that the tag exists on remote
git ls-remote --tags origin
```

If the tag already exists and you want to re-test with a new version:

```bash
# Example: bump to another version
git tag v1.0.7
git push origin v1.0.7
```

Verify in GitHub after running the commands above:

1. Actions tab: `Auto Release` workflow completed successfully.
2. Releases tab: new release appears with the tag title (for example `v1.0.6`).
3. Release notes are not empty and include `feat: smoke test auto release pipeline`.

### K. Rollback when release tag is wrong

If you pushed a wrong tag (for example version typo), delete local and remote tag, then create a new one.

```bash
# Example: wrong tag v1.0.6, replace with v1.0.7
git tag -d v1.0.6
git push origin :refs/tags/v1.0.6

git tag v1.0.7
git push origin v1.0.7
```

Notes:
1. If release `v1.0.6` was already created in the Releases tab, delete that release in GitHub UI too for cleanup.
2. Do not reuse the same tag name for different commits.

---

## Supabase Database Schema

Please make sure to have RLS (Row Level Security) enabled when creating these tables under your Supabase project.

```sql
-- command_logs table:
-- Stores the command usage history by users for statistical purposes.
CREATE TABLE command_logs (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    user_id TEXT NOT NULL,
    platform TEXT NOT NULL,
    command TEXT NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- user_preferences table:
-- Stores user preferences, such as their currently active AI model.
CREATE TABLE user_preferences (
    user_id TEXT PRIMARY KEY,
    platform TEXT,
    active_model TEXT DEFAULT 'openai/gpt-oss-120b',
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ai_logs table:
-- Stores AI interaction logs, including the used model and token consumption.
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
-- Manages limits and tracks the usage of third-party API quotas (removebg, cloudconvert, etc.).
CREATE TABLE public.api_quotas (
  service text not null,
  usage integer null default 0,
  updated_at timestamp with time zone null default now(),
  "limit" integer null default 50,
  constraint api_quotas_pkey primary key (service)
) TABLESPACE pg_default;

-- Note: CloudConvert has a different limit
UPDATE api_quotas SET "limit" = 10 WHERE service = 'cloudconvert';

-- finance table:
-- Stores users' financial records (income & expenses).
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
-- Stores reminders and loops for the reminder feature
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

## Updating Local Code (Without Losing Changes)

If you have modified the code locally and want to pull the latest updates from the repository without losing your changes, you can use the following git commands:

```bash
# Option 1: Using Git Stash
# 1. Stash your local changes
git stash
# 2. Pull the latest updates from the repository
git pull origin main
# 3. Apply your stashed changes back
git stash pop

# Option 2: Using Auto-Stash on Rebase (One liner)
# Automatically stashes unsaved changes, rebases against the latest main, 
# and pops the changes back seamlessly.
git pull --rebase --autostash
```

---

## Google Sheets Integration Tutorial (Customer Service)

The `/ask` and `/feedback` features require a Web App URL from Google Apps Script (GAS) to save incoming queries straight into a spreadsheet.

1. Create a new blank spreadsheet in [Google Sheets](https://sheets.google.com).
2. Set up headers on the first row (A1 - F1):
   `Timestamp` | `Type` | `User_ID` | `Message` | `Status` | `Customer Sentiment`
3. Create a table and name it "User Questions" or with anything you like.
4. In cell **F2** (Customer Sentiment), insert the following automated sentiment formula and drag it down to the subsequent rows:
   ```excel
   =IF(ISBLANK(D2), "", IF(REGEXMATCH(LOWER(D2), "good|great|excellent|awesome|love|thanks|thank you|happy|bagus|keren|mantap|terima kasih|suka|puas"), "Positive", IF(REGEXMATCH(LOWER(D2), "bad|terrible|awful|hate|issue|problem|error|fail|angry|upset|worst|poor|jelek|buruk|masalah|rusak|gagal|kecewa"), "Negative", "Netral")))
   ```
5. Click **Extensions > Apps Script** from the top menu.
6. Clear any existing code and paste the following snippet:
   ```javascript
   function doPost(e) {
    try {
      const sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName("User Questions");
      
      // If the sheet is not found, stop the process to prevent errors.
      if (!sheet) throw new Error("Tab 'User Questions' tidak ditemukan!");
      const data = JSON.parse(e.postData.contents);

      if (data.action === "UPDATE_STATUS") {
        const dataRange = sheet.getDataRange();
        const values = dataRange.getValues();
        
        // Search from the bottom so that the latest questions from that user are updated.
        for (let i = values.length - 1; i >= 1; i--) {
          // Column C (index 2) is User_ID, Column E (index 4) is Status
          if (values[i][2].toString() === data.userId.toString() && values[i][4] === "UNANSWERED") {
            sheet.getRange(i + 1, 5).setValue("ANSWERED"); // Change cells in Column E
          }
        }
        return ContentService.createTextOutput(JSON.stringify({"status": "success", "message": "Status Updated"}))
          .setMimeType(ContentService.MimeType.JSON);
      }
      
      // Prepare data to be entered into a new row
      const rowData = [
        new Date(), 
        data.type,       // 'FEEDBACK' or 'ASK'
        data.userId,     // User's WA/Tele number
        data.message,    // Message content
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
7. Click **Deploy > New deployment**.
8. Select **Web app** as the deployment type. Set "Who has access" to **Anyone**.
9. Once successfully deployed, copy the generated Web App URL (ends with `/exec`).
10. Open your server's `.env` file and append the following environment variable then restart the bot:
   ```env
   GAS_WEBAPP_URL="YOUR_WEBAPP_URL_HERE"
   ```