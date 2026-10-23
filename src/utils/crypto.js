const crypto = require('crypto');

const ALGORITHM = 'aes-256-gcm';
const IV_LENGTH = 12; // 12 bytes is the standard recommended IV length for GCM
const AUTH_TAG_LENGTH = 16; // 16 bytes (128 bits) authentication tag

let warnedMissingKey = false;

/**
 * Resolves a 32-byte key buffer from the given input or process.env.ENCRYPTION_KEY.
 * Guarantees a valid 32-byte buffer for AES-256-GCM.
 *
 * @param {string|Buffer} [keyOverride]
 * @returns {Buffer}
 */
function resolveKey(keyOverride) {
  const rawKey = keyOverride || process.env.ENCRYPTION_KEY;

  if (!rawKey) {
    if (!warnedMissingKey) {
      console.warn('[crypto] WARNING: ENCRYPTION_KEY environment variable is not defined! Using fallback development key.');
      warnedMissingKey = true;
    }
    // Fallback deterministic development key
    return crypto.createHash('sha256').update('fuenzer-bot-default-dev-encryption-key-2026').digest();
  }

  if (Buffer.isBuffer(rawKey)) {
    if (rawKey.length === 32) return rawKey;
    return crypto.createHash('sha256').update(rawKey).digest();
  }

  const strKey = String(rawKey).trim();

  // If 64 hex characters (32 bytes)
  if (/^[0-9a-fA-F]{64}$/.test(strKey)) {
    return Buffer.from(strKey, 'hex');
  }

  // If Base64 string that decodes to 32 bytes
  if (/^[A-Za-z0-9+/=]{43,44}$/.test(strKey)) {
    try {
      const buf = Buffer.from(strKey, 'base64');
      if (buf.length === 32) return buf;
    } catch (_) {
      // Fall through to hash
    }
  }

  // Otherwise, securely hash the arbitrary string to produce an exact 32-byte key
  return crypto.createHash('sha256').update(strKey, 'utf8').digest();
}

/**
 * Checks whether a given string matches the AES-256-GCM encrypted payload format:
 * 'iv:authTag:ciphertext' (all in hex).
 *
 * @param {any} value
 * @returns {boolean}
 */
function isEncrypted(value) {
  if (typeof value !== 'string') return false;
  // 12-byte IV = 24 hex chars; 16-byte authTag = 32 hex chars; ciphertext >= 2 hex chars
  return /^[0-9a-fA-F]{24}:[0-9a-fA-F]{32}:[0-9a-fA-F]+$/.test(value);
}

/**
 * Encrypts plain text using AES-256-GCM.
 *
 * @param {string} plainText - The text to encrypt
 * @param {string|Buffer} [keyOverride] - Optional key override for testing
 * @returns {string} Formatted as 'iv:authTag:ciphertext' in hex
 */
function encrypt(plainText, keyOverride) {
  if (plainText === null || plainText === undefined || plainText === '') {
    return plainText;
  }

  const key = resolveKey(keyOverride);
  const iv = crypto.randomBytes(IV_LENGTH);
  const cipher = crypto.createCipheriv(ALGORITHM, key, iv);

  const ciphertext = Buffer.concat([
    cipher.update(String(plainText), 'utf8'),
    cipher.final()
  ]);

  const authTag = cipher.getAuthTag();

  return `${iv.toString('hex')}:${authTag.toString('hex')}:${ciphertext.toString('hex')}`;
}

/**
 * Decrypts an encrypted payload string formatted as 'iv:authTag:ciphertext'.
 * If the payload is not in encrypted format, returns the value as-is for safety.
 *
 * @param {string} encryptedPayload - Format 'iv:authTag:ciphertext' in hex
 * @param {string|Buffer} [keyOverride] - Optional key override for testing
 * @returns {string} Decrypted UTF-8 plain text
 * @throws {Error} If authentication tag verification fails (tampering/wrong key)
 */
function decrypt(encryptedPayload, keyOverride) {
  if (encryptedPayload === null || encryptedPayload === undefined || encryptedPayload === '') {
    return encryptedPayload;
  }

  if (typeof encryptedPayload !== 'string' || !isEncrypted(encryptedPayload)) {
    return encryptedPayload;
  }

  const parts = encryptedPayload.split(':');
  if (parts.length !== 3) {
    return encryptedPayload;
  }

  const [ivHex, authTagHex, cipherHex] = parts;
  const key = resolveKey(keyOverride);
  const iv = Buffer.from(ivHex, 'hex');
  const authTag = Buffer.from(authTagHex, 'hex');
  const ciphertext = Buffer.from(cipherHex, 'hex');

  const decipher = crypto.createDecipheriv(ALGORITHM, key, iv);
  decipher.setAuthTag(authTag);

  try {
    const decrypted = Buffer.concat([
      decipher.update(ciphertext),
      decipher.final()
    ]);
    return decrypted.toString('utf8');
  } catch (err) {
    throw new Error(`[crypto] Decryption failed: ${err.message}. Data may be corrupted or key is incorrect.`);
  }
}

module.exports = {
  encrypt,
  decrypt,
  isEncrypted,
  resolveKey,
  ALGORITHM
};
