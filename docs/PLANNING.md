# Fuenzer Bot — DEV Challenge Week 3: "Slow and Steady"
## Project Architecture & Feature Planning (`PLANNING.md`)

---

## 1. Overview & Context

* **Event:** Hacktoberfest Open-Source AI Challenge Week 3 (`#hf26challenge`)
* **Theme:** **"Slow and Steady"** (In honor of International Sloth Day 🦥)
* **Theme Mandate:** Build something with open-source AI or open-weight models that rewards laziness, eliminates dreaded daily chores, and does the heavy lifting so the user doesn't have to.
* **Core Value Proposition:** An intelligent, omnichannel personal bot that passively buffers cluttered group chats across multiple platforms and automatically delivers a concise **Morning Sloth Briefing (Text & Voice Note)** at a scheduled hour.

---

## 2. Target Partner Categories

| Partner Category | Target | Implementation in Fuenzer Bot |
| :--- | :--- | :--- |
| **Best Use of Gemma** | $200 *(Featured)* | Uses **Google Gemma** (via serverless OpenRouter/Groq API) for long-context understanding, spam/noise filtering, action-item extraction, and executive summaries. |
| **Best Use of ElevenLabs** | $100 *(Partner)* | Converts the daily morning summary into a relaxed **30–45 second Voice Note** sent directly to the user's private chat (zero-effort listening from bed). |
| **Best Use of Browserbase** | $100 *(Partner)* | Headless cloud browser infrastructure reserved for a dedicated autonomous web-browsing/scraping command (to be defined). |

---

## 3. Core Feature: Automated Scheduled Chat Summarizer (`/summarize`)

### A. The "Sloth" Problem
Opening messaging apps in the morning or after work often reveals 300+ unread messages across various group chats. Users dread having to scroll and read everything, yet fear missing crucial announcements or direct tasks.

### B. The Solution Workflow
```
[ Incoming Group Chats ]
 (WA, Telegram, Discord, Slack)
           │
           ▼
[ Passive Ingestion Filter ] ── (Ignores private bot commands & spam)
           │
           ▼
[ Supabase `chat_buffer` ] ──── (Stores: platform, group_name, sender, text, timestamp)
           │
     (node-cron triggers at scheduled hour, e.g., 08:00 AM)
           │
           ▼
[ Summarizer Engine (Gemma) ] ─► 1. Sloth TL;DR (2-3 lines of core context)
                                 2. Action Items & Direct Mentions
                                 3. Noise & Chatter Statistics
           │
           ▼
[ ElevenLabs Voice Engine ] ───► Synthesizes audio voice note (MP3/OGG)
           │
           ▼
[ Delivery & Auto-Prune ] ─────► Sends text & voice note to user's private DM,
                                 then purges/marks buffered rows in Supabase.
```

### C. Command Interface
* `/summarize on` / `/summarize off`: Toggles passive group chat buffering.
* `/summarize schedule <HH:mm>`: Sets the automated morning briefing time (default: `08:00`).
* `/summarize now`: Instant manual trigger to summarize whatever is currently in the buffer.
* `/summarize status`: Checks current schedule, active monitored groups, and buffered message count.

---

## 4. Multi-Platform Omnichannel Architecture

Fuenzer Bot uses a unified adapter pattern (`MessageAdapter`) to normalize incoming messages across 4 major platforms:

1. **WhatsApp (via Baileys):**
   * Acts as a linked Web client on user's number.
   * Listens via `messages.upsert` event.
   * Filters group chats (`@g.us`) while ignoring bot DM triggers.
2. **Telegram (via Telegraf):**
   * Operates via official Bot API.
   * Privacy mode disabled in BotFather (`/setprivacy -> Disable`) or admin permissions in target groups to monitor group traffic.
3. **Discord (via `discord.js`):**
   * Listens to server channels with `Message Content Intent` enabled.
   * Captures message events via `messageCreate`.
4. **Slack (via `@slack/bolt`):**
   * Runs in Socket Mode.
   * Listens to designated channels via `message.channels` and `message.groups` scopes.

---

## 5. Storage, Encryption & Privacy Policy (Supabase)

To guarantee end-to-end user privacy and prevent storage bloating, messages are encrypted at rest and stored only temporarily in Supabase:

### A. Field-Level AES-256-GCM Encryption
* **Industry Standard Security:** Sensitive message content (`message_text`, `chat_name`, `sender_name`) must be encrypted prior to insertion into Supabase using **AES-256-GCM** via `src/utils/crypto.js`.
* **Payload Structure:** Stored as `iv:authTag:ciphertext` (hex-encoded string). 
* **Key Management:** Encrypted and decrypted with a 32-byte secret key (`ENCRYPTION_KEY`) in environment variables. Even direct database inspection reveals zero plain text conversation data.

### B. Database Schema
```sql
CREATE TABLE chat_buffer (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    platform VARCHAR(30) NOT NULL,       -- 'whatsapp', 'telegram', 'discord', 'slack'
    chat_id VARCHAR(100) NOT NULL,       -- Group/Room identifier
    chat_name TEXT,                      -- AES-256-GCM encrypted group title
    sender_name TEXT,                    -- AES-256-GCM encrypted sender display name
    message_text TEXT NOT NULL,          -- AES-256-GCM encrypted message body
    is_summarized BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE user_summarize_settings (
    user_id VARCHAR(100) PRIMARY KEY,
    platform VARCHAR(30) NOT NULL,
    is_active BOOLEAN DEFAULT TRUE,
    schedule_time VARCHAR(5) DEFAULT '08:00', -- 24h format
    voice_note_enabled BOOLEAN DEFAULT TRUE,
    language VARCHAR(5) DEFAULT 'en',         -- 'en' (default) or 'id'
    last_run_at TIMESTAMPTZ
);
```

### C. Ephemeral Retention & 24-Hour Grace Period Purge
* **Post-Summarization Grace Period (24 Hours):** Once messages are processed and delivered as the morning summary, they are marked `is_summarized = TRUE`. A 24-hour retention buffer is maintained to allow re-summarization or manual audit before being permanently expunged.
* **Automated Cleanup Query:**
  ```sql
  -- Daily cron deletes summarized messages older than 24 hours
  DELETE FROM chat_buffer 
  WHERE is_summarized = TRUE 
    AND created_at < NOW() - INTERVAL '24 hours';

  -- Fallback TTL deletes inactive unsummarized messages older than 7 days
  DELETE FROM chat_buffer 
  WHERE is_summarized = FALSE 
    AND created_at < NOW() - INTERVAL '7 days';
  ```

---

## 6. Internationalization (i18n) & Bilingual Command Aliasing

To deliver an exceptional experience for the international DEV Challenge Week 3 jury while maintaining full backwards-compatibility for existing Indonesian users:

### A. Default Language: English (`en`)
* All command responses, help texts, system alerts, and AI morning briefing prompts default to **English (`en`)**.
* Users and group admins can toggle their preferred language at any time using:
  * `/lang en` or `/language en`: Set language to English.
  * `/lang id` or `/language id`: Set language to Indonesian (Bahasa Indonesia).
  * `/lang`: Check current language setting.

### B. Bilingual Command Aliasing
Command modules in `src/commands/` support simultaneous English and Indonesian triggers through command aliasing:
* **Finance:** `/balance` ↔ `/saldo`, `/record` / `/expense` ↔ `/catat` / `/pengeluaran`, `/income` ↔ `/pemasukan`, `/history` ↔ `/riwayat`, `/delete` ↔ `/hapus`
* **Weather:** `/weather` ↔ `/cuaca`, `/earthquake` ↔ `/gempa`
* **Religion:** `/prayer` ↔ `/jadwalsholat`, `/qibla` ↔ `/kiblat`
* **DevOps:** `/system` ↔ `/sistem`, `/ping`, `/checkweb`
* **Summarizer:** `/summarize` ↔ `/ringkas`

---

## 7. Open-Weight Model (Gemma) & ElevenLabs Integration

* **Model:** `google/gemma-4-26b-a4b-it` (or `google/gemma-2-9b-it:free`) via OpenRouter / Groq API.
* **Why Serverless:** Zero local RAM/GPU footprint on the Azure VM; high throughput and instant latency.
* **Prompt Structure:**
  * System prompt instructing Gemma to be an executive, casual "sloth butler".
  * Strict extraction of:
    1. **Summary:** 2–3 sentences max (localized to user's configured language, default English).
    2. **Urgent Items:** Bullet points with `@mention` or actionable commitments.
    3. **Filtered Ratio:** E.g., *"Analyzed 412 messages: 88% casual banter, 12% important topics."*
* **ElevenLabs Pipeline:**
  * Takes the 2–3 sentence executive summary.
  * Generates audio via ElevenLabs TTS API using a calm, soothing voice.
  * Sends directly as a native voice message / audio attachment to Telegram & WhatsApp.

---

## 8. AI Agent Harness (Natural Language Tool Calling & Butler Interface)

* **Concept:** In addition to classic slash commands (`/catat`, `/balance`, `/weather`), users can converse with Fuenzer Bot naturally in casual language (e.g. *"Bro, catetin tadi beli kopi 35rb sama cek cuaca di Jaksel"* or *"Hey, log $12 for lunch and remind me to call John in 1 hour"*).
* **Architecture:**
  * Uses OpenRouter / Gemma native function-calling / structured tool schemas.
  * Maps natural language intents directly to existing pure domain services (`financeService.addTransaction`, `weatherService.getWeather`, `reminderService.addReminder`).
  * Because domain services were cleanly decoupled in recent refactoring, the AI Harness acts as a pure orchestrator (`src/services/aiHarnessService.js`) without touching transport sockets.
* **Friendly Persona:** Returns empathetic, warm, and concise replies in the user's preferred language (`en` or `id`), maintaining the relaxed "sloth butler" tone.

---

## 9. Dedicated Browserbase Integration (Separate Command)

* **Architecture Placement:** Independent module in `src/commands/` and `src/services/browserbaseService.js`.
* **Purpose:** Cloud-based headless browser automation for web tasks (scraping, anti-bot navigation, visual capture, or data retrieval) triggered via a distinct command (e.g., `/browse` or `/extract`).
* **Technical Value:** Demonstrates functional cloud browser agents without cluttering the chat summarizer flow.

---

## 10. Implementation Roadmap (Deadline: October 25, 2026)

- [x] **Phase 1: Internationalization (i18n) & Bilingual Command Aliases**
  - [x] Implement lightweight i18n utility (`src/utils/i18n.js`) with English (`en`) default and Indonesian (`id`) translations (`src/locales/`).
  - [x] Register bilingual aliases for all existing commands across handlers (e.g. `/balance` ↔ `/saldo`).
  - [x] Implement `/lang [en|id]` preference management command and persist to user profile.
- [ ] **Phase 2: Security, Storage & Buffer Ingestion**
  - Implement AES-256-GCM encryption/decryption module in `src/utils/crypto.js`.
  - Create `chat_buffer` and `user_summarize_settings` tables in Supabase.
  - Implement `chatBufferService.js` to encrypt and enqueue incoming group messages.
- [ ] **Phase 3: Summarizer Service with Gemma & Cron**
  - Implement `summarizeService.js` calling Gemma API with structured prompts (decrypting buffer on read).
  - Setup automated daily execution and 24-hour purge cron using `node-cron`.
- [ ] **Phase 4: ElevenLabs Audio Briefing**
  - Connect ElevenLabs TTS to synthesize the executive summary.
  - Send voice notes natively to WhatsApp & Telegram.
- [ ] **Phase 5: AI Agent Harness (Natural Language Tool Calling)**
  - Implement `aiHarnessService.js` with tool definitions for finance, reminders, and weather.
  - Connect conversational prompt pipeline to allow conversational command execution with friendly replies.
- [ ] **Phase 6: Discord & Slack Listeners (Omnichannel Expansion)**
  - Add basic message listeners in Discord.js and Slack Bolt.
- [ ] **Phase 7: Browserbase Dedicated Command**
  - Implement standalone browser automation command.
- [ ] **Phase 8: English Documentation & DEV Submission**
  - Update `README.md` in English highlighting the "Slow and Steady" architecture, AES-256 privacy, and AI Agent Harness.
  - Draft submission for DEV Challenge Week 3.
