// In-memory session manager with TTL auto-cleanup
const fsSync = require('fs');

class SessionManager {
  constructor(defaultTtlMs = 15 * 60 * 1000) {
    this.sessions = new Map(); // userId -> { files: [], timer: Timeout }
    this.defaultTtlMs = defaultTtlMs;
  }

  hasSession(userId) {
    return this.sessions.has(String(userId));
  }

  startSession(userId) {
    this.clearSession(userId);
    const id = String(userId);
    const timer = setTimeout(() => {
      this.clearSession(id);
    }, this.defaultTtlMs);

    this.sessions.set(id, {
      files: [],
      timer
    });
  }

  addFileToSession(userId, filePath) {
    const id = String(userId);
    const session = this.sessions.get(id);
    if (!session) {
      return false;
    }

    session.files.push(filePath);

    // Refresh TTL
    if (session.timer) clearTimeout(session.timer);
    session.timer = setTimeout(() => {
      this.clearSession(id);
    }, this.defaultTtlMs);

    return session.files.length;
  }

  getSessionFiles(userId) {
    const session = this.sessions.get(String(userId));
    return session ? [...session.files] : [];
  }

  clearSession(userId) {
    const id = String(userId);
    const session = this.sessions.get(id);
    if (!session) return;

    if (session.timer) {
      clearTimeout(session.timer);
    }

    // Clean up temporary files on disk
    if (Array.isArray(session.files)) {
      session.files.forEach((filePath) => {
        try {
          if (filePath && fsSync.existsSync(filePath)) {
            fsSync.unlinkSync(filePath);
          }
        } catch (err) {
          console.error(`Failed to cleanup session file ${filePath}:`, err);
        }
      });
    }

    this.sessions.delete(id);
  }
}

const pdfMergeSessionManager = new SessionManager();

module.exports = {
  SessionManager,
  pdfMergeSessionManager
};
