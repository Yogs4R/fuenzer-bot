# Security Policy

## Supported Versions

We actively maintain and provide security patches for the following versions of **Fuenzer Bot**:

| Version | Supported          |
| :---    | :---               |
| `1.x.x` | :white_check_mark: |
| `< 1.0` | :x:                |

---

## Reporting a Vulnerability

If you discover a security vulnerability within **Fuenzer Bot**, please follow responsible disclosure guidelines. **Do NOT report security vulnerabilities through public GitHub issues.**

### How to Report
1. **GitHub Private Security Advisory (Preferred):**
   Navigate to the **Security** tab of the repository on GitHub and click **"Report a vulnerability"** to submit a private advisory.
2. **Direct Maintainer Contact:**
   Contact the project owner directly via GitHub profile: [**@Yogs4R**](https://github.com/Yogs4R).

### What to Include in Your Report
To help us triage and resolve the issue quickly, please provide:
* A detailed description of the vulnerability.
* Steps to reproduce the issue or a minimal proof of concept (PoC).
* Potential impact and affected components (e.g. webhook handler, Baileys socket, Supabase queries).
* Any suggested mitigations or patches if available.

### Response Timeline
* **Initial Acknowledgment:** Within 48 hours of report submission.
* **Triage & Status Update:** Within 5 business days detailing validation results and planned fixes.
* **Public Disclosure:** Coordinated only after a security fix or release patch has been deployed.

---

## Security Best Practices for Self-Hosters

If you are self-hosting or deploying Fuenzer Bot on your own VM or server:

1. **Protect Credentials and Session Folders:**
   * Never commit or publicly expose `.env`, `auth/` (WhatsApp Baileys multi-device session tokens), or `credentials/` (Google Service Account keys).
   * Ensure directory permissions on Linux are restricted: `chmod 700 auth credentials`.
2. **Webhook Endpoint Security:**
   * The release broadcast endpoint (`POST /webhook-release`) is protected by `AUTO_BROADCAST_RELEASE`. Ensure this secret is a strong, cryptographically secure random string.
   * Restrict access via UFW firewall or reverse proxy if the bot is publicly exposed.
3. **Database Row Level Security (RLS):**
   * When using Supabase, ensure Row Level Security (RLS) is enabled on all tables (`transactions`, `reminders`, `chat_buffer`).
4. **Automated Secret Scanning:**
   * This repository runs automated **Gitleaks** scans and sensitive file guards on every pull request and push to prevent credential leaks.
