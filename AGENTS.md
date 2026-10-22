<!-- bmad:context -->
<!-- Verified 2026-10-22 against 7720c14. Managed by bmad-project-context; edits inside this block are replaced on refresh. Keep anything you want preserved outside the markers. -->

## fuenzer-bot

Personal omni-channel productivity bot running concurrently on WhatsApp (Baileys) and Telegram (Telegraf). Built with Node.js, Express (release webhook), Supabase (PostgreSQL), and serverless AI APIs (OpenRouter, Gemma). Active feature roadmap lives in `docs/PLANNING.md`, user setup guide in `README.md`.

## Policy

- Credentials and authentication folders (`auth/`, `credentials/`, and `.env`) are strictly **READ-ONLY** for AI agents. Agents may inspect them for context but must NEVER edit, overwrite, or commit them. Use `.env.example` as configuration reference.
- Direct push to `main` triggers automated remote deployment via SSH (`.github/workflows/deploy.yml`) and restarts PM2 (`fuenzerbot`). Verify all code before pushing to `main`.
- Commit messages must follow conventional commit prefixes (`feat:`, `fix:`, `docs:`, etc.) as defined in `.github/changelog-config.json` for automated release notes.

## Where things are

- Application bootstrap & webhook server: `src/index.js`
- WhatsApp client & event dispatcher: `src/lib/waClient.js` and `src/handlers/waHandler.js`
- Telegram bot handler: `src/handlers/teleHandler.js` and `src/lib/telegramClient.js`
- Domain services (finance, converters, CS sync, AI): `src/services/`
- Command modules (modular handlers): `src/commands/` (`admin/`, `ai/`, `converter/`, `devops/`, `finance/`, `google/`, `religion/`, `reminder/`, `weather/`)
- Background schedulers & cron jobs: `src/jobs/` (`serverMonitor.js`, `reminderCron.js`)
- Upcoming features specification: `docs/PLANNING.md` (Omnichannel Chat Buffer, Gemma summarizer, ElevenLabs audio brief, Browserbase runner)

## Running and verifying

- Local development: `npm run dev` (runs nodemon on `src/index.js`) or containerized: `docker compose up`.
- Production run: `npm start` (or managed via PM2: `pm2 start src/index.js --name fuenzerbot`).
- Automated webhook listener: `POST /webhook-release` secured with `AUTO_BROADCAST_RELEASE` secret token.
- Environment variables must be loaded before running services; missing Supabase or AI keys must fallback gracefully without terminating the process.

## Conventions that differ from defaults

- **Modular Command Separation**: Do NOT add new command switch cases directly into `src/handlers/waHandler.js` or `src/handlers/teleHandler.js`. New or refactored commands must be placed in their corresponding category under `src/commands/<category>/index.js` (e.g., `ai/`, `devops/`, `weather/`) and delegate business logic to `src/services/`.
- Admin authorization must always be checked via `isAdmin()` from `src/utils/auth.js`.
- Multi-platform message formatting must respect platform syntax: use asterisks `*bold*` and underscores `_italic_` for WhatsApp, and HTML tags (`<b>`, `<i>`) for Telegram.
- Temporary interactive states (such as PDF merge queue) are kept in memory sessions (`mergeSessions`), not persisted in the database.

## Known pitfalls

- WhatsApp Baileys connection can drop unpredictably; connection recovery logic in `src/index.js` uses an exponential backoff retry (10–20 seconds). Never block or alter the reconnect event listener without careful verification.
- `waHandler.js` contains legacy tightly-coupled dependencies; modify with extreme care to avoid breaking global variable state.
- Supabase queries must handle offline/unreachable conditions gracefully without unhandled promise rejections.

<!-- /bmad:context -->

## Active Architecture & Roadmap Directives (DEV Challenge Week 3)

- **Detailed Specifications:** Refer to [`docs/PLANNING.md`](./docs/PLANNING.md) for feature planning and [`docs/ARCHITECTURE.md`](./docs/ARCHITECTURE.md) for system architecture invariants (`[AD-01]` through `[AD-10]`).
- **Data Privacy & Encryption:** Any sensitive conversational or financial text persisted to Supabase (`chat_buffer`, transaction details) must be encrypted at rest using **AES-256-GCM** via `src/utils/crypto.js` in format `iv:authTag:ciphertext`. Decryption is strictly application-side.
- **Ephemeral Chat Retention:** Summarized messages in `chat_buffer` have a 24-hour grace period retention (`is_summarized = TRUE AND created_at < NOW() - INTERVAL '24 hours'`) before automated purge. Inactive/unsummarized messages expire after a 7-day TTL.
- **Internationalization (i18n) & Aliasing:** The bot defaults to English (`en`) for international evaluation with Indonesian (`id`) toggle via `/lang [en|id]`. All commands must maintain bilingual aliases (e.g., `/balance` ↔ `/saldo`, `/record` ↔ `/catat`, `/weather` ↔ `/cuaca`) without breaking legacy workflows.
