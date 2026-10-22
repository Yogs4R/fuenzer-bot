# CI/CD, Automated Release & Deployment Guide (`CICD.md`)
## Fuenzer Bot — Automation Pipelines & Release Engineering

---

This document provides a comprehensive reference for the Continuous Integration (CI), automated remote deployment, automated GitHub release generator, and auto-broadcast webhook features of **Fuenzer Bot**.

---

## 1. Overview of GitHub Actions Workflows

The repository contains three primary automation workflows under `.github/workflows/`:

| Workflow File | Trigger Event | Primary Purpose |
| :--- | :--- | :--- |
| **`ci.yml`** | Push to any branch (`**`) & PR to `main` | Runs sensitive file guard (`.env`, `auth/`, `credentials/`), Gitleaks secret scan, and Node.js syntax verification. |
| **`deploy.yml`** | Push to branch `main` | Executes SSH remote deployment to your Linux Cloud VM, runs `npm install`, and restarts the PM2 process (`fuenzerbot`). |
| **`auto-release.yml`** | Push tag matching `v*` (e.g. `v1.0.6`) | Builds grouped changelog from commits, creates GitHub Release, and POSTs payload to VM `/webhook-release` endpoint for real-time chat broadcast. |

---

## 2. Configuration & Required Files

### 2.1 File Structure
```
.github/
├── changelog-config.json    # Commit categorizer rules & regex extractors
└── workflows/
    ├── ci.yml               # Lint, security guard & secret scanner
    ├── deploy.yml           # SSH deployment to VM on push to main
    └── auto-release.yml     # Release builder & Webhook broadcaster
```

### 2.2 Configure `changelog-config.json`
The changelog builder (`mikepenz/release-changelog-builder-action`) reads `.github/changelog-config.json` to extract commit prefixes and group them into distinct categories in the release notes:

* `feat: ...` ➔ **🚀 New Features**
* `fix: ...` ➔ **🐛 Bug Fixes**
* `refactor: ...` ➔ **🛠 Code Refactoring**
* `chore: ...` ➔ **📦 Maintenance & Chores**
* `docs: ...` ➔ Filtered or categorized under **📖 Documentation**

Ensure commit messages strictly follow these patterns so release notes remain grouped properly.

---

## 3. Commit Message Conventions

Commit messages must follow the standard Conventional Commits format:

```bash
git commit -m "<type>: <concise description>"
```

### Supported Types:
* `feat: add scheduled chat summarizer command`
* `fix: handle unexpected baileys socket close reconnect`
* `refactor: extract finance switch cases to commands/finance`
* `chore: update dependencies in package.json`
* `docs: update PRD and architecture specification`

---

## 4. How to Trigger an Automated Release

To publish a new official release and broadcast it to users:

### Step 1: Ensure `main` is up to date
```bash
git checkout main
git pull origin main
```

### Step 2: Create and push a semver tag
```bash
# Example: Creating version 1.1.0
git tag v1.1.0
git push origin v1.1.0
```

### Step 3: Automated Execution
1. GitHub Actions detects the `v*` tag and runs `auto-release.yml`.
2. It gathers all commit messages since the previous tag.
3. It creates an official GitHub Release with formatted changelog notes.
4. It sends an HTTP POST request to your VM:
   ```bash
   POST http://${VM_IP}:3000/webhook-release
   Header/Payload: { version: "v1.1.0", changelog: "...", secret: "${AUTO_BROADCAST_RELEASE}" }
   ```
5. Fuenzer Bot validates the secret and immediately broadcasts the release notes to all registered WhatsApp and Telegram channels!

---

## 5. CI/CD Smoke Test (First Release Verification)

You can run this smoke test from the root repository to verify the entire pipeline end-to-end:

```bash
# 1) Check active branch and ensure clean working tree
git branch --show-current
git pull origin main

# 2) Create an empty test commit guaranteed to be captured
git commit --allow-empty -m "feat: smoke test auto release pipeline"
git push origin main

# 3) Create and push a test release tag
git tag v1.0.6
git push origin v1.0.6

# 4) Verify tag exists on remote
git ls-remote --tags origin
```

### Verification Checklist in GitHub:
* [ ] **Actions Tab:** `Auto Release` workflow status is green (success).
* [ ] **Releases Tab:** A new release titled `v1.0.6` appears.
* [ ] **Changelog Content:** Release notes include the bullet: `feat: smoke test auto release pipeline`.
* [ ] **Bot Broadcast:** Registered WhatsApp/Telegram admin receives the formatted announcement.

---

## 6. Common Errors and Troubleshooting

### 1. `Empty CHANGELOG`
* **Cause:** No new commits were pushed between the previous tag and the current tag, or commit messages didn't match the regex patterns.
* **Fix:** Ensure there is at least one new commit matching `feat:`, `fix:`, etc., and ensure `mode: COMMIT` is set in the workflow.

### 2. `No categories found` or Commits Not Grouped
* **Cause:** The `target` value in `label_extractors` does not exactly match a label defined in `categories` inside `.github/changelog-config.json`.
* **Fix:** Keep label names synchronized between `categories` and `label_extractors`.

### 3. `Workflow not triggered`
* **Cause:** A regular commit was pushed instead of a tag, or the tag did not start with `v`.
* **Fix:** Ensure you run `git push origin vX.Y.Z` with the `v` prefix.

### 4. `Permission denied` When Creating Release
* **Cause:** GitHub Actions token does not have write permissions for repository contents.
* **Fix:** Ensure `permissions: contents: write` is explicitly declared in `auto-release.yml`.

### 5. Webhook HTTP `401 Unauthorized`
* **Cause:** The `AUTO_BROADCAST_RELEASE` secret set in GitHub Repository Secrets does not match the value inside `.env` on your VM.
* **Fix:** Synchronize both secret values.

---

## 7. Rollback Guide (When a Release Tag is Wrong)

If you accidentally pushed an incorrect tag (e.g. typo in version number `v1.0.6` instead of `v1.1.0`):

```bash
# 1) Delete the tag locally
git tag -d v1.0.6

# 2) Delete the tag from the remote repository
git push origin :refs/tags/v1.0.6

# 3) Create and push the correct tag
git tag v1.0.7
git push origin v1.0.7
```

> **Important Notes:**
> 1. If the release was already published in GitHub, navigate to the GitHub **Releases** tab and delete the release entry manually to keep the release history clean.
> 2. **Never** reuse an existing deleted tag name for a different commit SHA; always increment to a new tag (e.g., `v1.0.7`).
