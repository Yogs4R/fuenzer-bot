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

## 5. Storage & Database Schema (Supabase)

To maintain privacy and prevent bloating, messages are stored only temporarily in Supabase until processed:

```sql
CREATE TABLE chat_buffer (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    platform VARCHAR(30) NOT NULL,       -- 'whatsapp', 'telegram', 'discord', 'slack'
    chat_id VARCHAR(100) NOT NULL,       -- Group/Room identifier
    chat_name VARCHAR(150),              -- Readable group title
    sender_name VARCHAR(100),            -- Sender display name
    message_text TEXT NOT NULL,          -- Message body
    is_summarized BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE user_summarize_settings (
    user_id VARCHAR(100) PRIMARY KEY,
    platform VARCHAR(30) NOT NULL,
    is_active BOOLEAN DEFAULT TRUE,
    schedule_time VARCHAR(5) DEFAULT '08:00', -- 24h format
    voice_note_enabled BOOLEAN DEFAULT TRUE,
    last_run_at TIMESTAMPTZ
);
```

---

## 6. Open-Weight Model (Gemma) & ElevenLabs Integration

* **Model:** `google/gemma-4-26b-a4b-it` (or `google/gemma-2-9b-it:free`) via OpenRouter / Groq API.
* **Why Serverless:** Zero local RAM/GPU footprint on the Azure VM; high throughput and instant latency.
* **Prompt Structure:**
  * System prompt instructing Gemma to be an executive, casual "sloth butler".
  * Strict extraction of:
    1. **Summary:** 2–3 sentences max.
    2. **Urgent Items:** Bullet points with `@mention` or actionable commitments.
    3. **Filtered Ratio:** E.g., *"Analyzed 412 messages: 88% casual banter, 12% important topics."*
* **ElevenLabs Pipeline:**
  * Takes the 2–3 sentence summary.
  * Generates audio via ElevenLabs TTS API using a calm, soothing voice.
  * Sends directly as a native voice message / audio attachment to Telegram & WhatsApp.

---

## 7. Dedicated Browserbase Integration (Separate Command)

* **Architecture Placement:** Independent module in `src/commands/` and `src/services/browserbaseService.js`.
* **Purpose:** Cloud-based headless browser automation for web tasks (scraping, anti-bot navigation, visual capture, or data retrieval) triggered via a distinct command (e.g., `/browse` or `/extract`).
* **Technical Value:** Demonstrates functional cloud browser agents without cluttering the chat summarizer flow.

---

## 8. Implementation Roadmap (Deadline: October 25, 2026)

- [ ] **Phase 1: Database & Buffer Service**
  - Create `chat_buffer` and `user_summarize_settings` tables in Supabase.
  - Implement `chatBufferService.js` to enqueue incoming group messages.
- [ ] **Phase 2: Summarizer Service with Gemma & Cron**
  - Implement `summarizeService.js` calling Gemma API with structured prompts.
  - Setup automated daily execution using `node-cron`.
- [ ] **Phase 3: ElevenLabs Audio Briefing**
  - Connect ElevenLabs TTS to synthesize the executive summary.
  - Send voice notes natively to WhatsApp & Telegram.
- [ ] **Phase 4: Discord & Slack Listeners (Omnichannel Expansion)**
  - Add basic message listeners in Discord.js and Slack Bolt.
- [ ] **Phase 5: Browserbase Dedicated Command**
  - Implement standalone browser automation command.
- [ ] **Phase 6: English Documentation & DEV Submission**
  - Update `README.md` in English highlighting the "Slow and Steady" architecture.
  - Draft submission for DEV Challenge Week 3.
