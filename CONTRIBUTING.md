# Contributing to Fuenzer Bot

First off, thank you for considering contributing to **Fuenzer Bot**! 🎉

This document outlines the guidelines and workflow for contributing to this project. Following these guidelines helps maintain clean code, consistent architecture, and automated release notes.

---

## 📜 Code of Conduct

By participating in this project, you agree to abide by our [Code of Conduct](./CODE_OF_CONDUCT.md). Please report any unacceptable behavior to the project maintainer.

---

## 🛠 Getting Started

### Prerequisites
* **Node.js**: `v20.x` or higher (LTS recommended)
* **NPM**: `v10.x` or higher
* **FFmpeg**: Required on your system path for sticker and audio conversions (or run via Docker).
* *(Alternative)*: **Docker & Docker Compose** for zero-dependency containerized local testing.

### Local Development Setup
1. **Fork & Clone:**
   ```bash
   git clone https://github.com/<your-username>/fuenzer-bot.git
   cd fuenzer-bot
   ```
2. **Install Dependencies:**
   ```bash
   npm install
   ```
3. **Configure Environment:**
   ```bash
   cp .env.example .env
   # Fill in minimal required variables (e.g. TELEGRAM_BOT_TOKEN, OPENROUTER_API_KEY)
   ```
4. **Run Local Dev Server:**
   ```bash
   # Run directly with nodemon:
   npm run dev

   # Or run via Docker Compose:
   docker compose up
   ```

---

## 📐 Architecture & Coding Standards

Before writing code, please review [`AGENTS.md`](./AGENTS.md) and [`docs/ARCHITECTURE.md`](./docs/ARCHITECTURE.md) to understand the project's structural patterns:

### 1. Modular Command Separation (Crucial)
* **Do NOT** add monolithic command logic or large switch-case blocks directly inside `src/handlers/waHandler.js` or `src/handlers/teleHandler.js`.
* Register new commands under the appropriate category in `src/commands/<category>/index.js` (e.g., `ai/`, `devops/`, `weather/`).
* Delegate actual data processing, external API calls, and calculations to standalone service files in `src/services/`.

### 2. Multi-Platform Message Formatting
* **WhatsApp:** Uses asterisks `*bold*`, underscores `_italic_`, and tildes `~strikethrough~`. Use `formatWhatsAppReply()` utility when needed.
* **Telegram:** Uses HTML tags (`<b>bold</b>`, `<i>italic</i>`, `<code>code</code>`).

### 3. Security & Sensitive Files
* **NEVER** commit credentials, secrets, or session data. Folders `auth/`, `credentials/`, and `.env` are strictly protected and checked by automated CI guards.

---

## 📝 Commit Message Conventions

This repository uses automated release notes generated directly from commit messages via `.github/changelog-config.json`. 

You **must** prefix all commit messages with conventional commit types:

| Prefix | Usage | Example |
| :--- | :--- | :--- |
| `feat:` | A new user-facing feature or command | `feat: add scheduled group chat summarizer` |
| `fix:` | A bug fix | `fix: prevent crash when baileys reconnects` |
| `refactor:` | Code reorganization without changing behavior | `refactor: extract admin commands to modular router` |
| `chore:` | Dependency updates, config tweaks | `chore: upgrade @supabase/supabase-js to v2.97.0` |
| `docs:` | Documentation updates | `docs: add contributing and security guidelines` |

For more details on CI/CD and release automation, see [`docs/CICD.md`](./docs/CICD.md).

---

## 🚀 Pull Request Process

1. **Create a Feature Branch:**
   ```bash
   git checkout -b feat/your-feature-name
   # or
   git checkout -b fix/your-bugfix-name
   ```
2. **Verify JavaScript Syntax Locally:**
   Ensure there are no syntax errors before opening a PR:
   ```bash
   node -c src/index.js
   ```
3. **Ensure Sensitive Files are Untracked:**
   Check `git status` to ensure `auth/`, `credentials/`, or `.env` are never staged.
4. **Push & Open a Pull Request:**
   * Push your branch to your GitHub fork.
   * Open a PR against the `main` branch of `Yogs4R/fuenzer-bot`.
   * Describe the changes clearly and link any related issues or discussions.
   * Ensure all automated GitHub Actions checks (`CI & Security Guard`) pass.

Thank you for helping make Fuenzer Bot better! 🚀
