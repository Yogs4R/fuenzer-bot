const assert = require('assert');
const crypto = require('crypto');
const { encrypt, decrypt, isEncrypted, resolveKey } = require('../src/utils/crypto');

// Set test encryption key
process.env.ENCRYPTION_KEY = 'test-secret-encryption-key-for-unit-tests-32b';

console.log('--- Running crypto.js Tests ---');

// Test 0: Verify fail-closed when key is missing (Codex P1)
const savedEnvKey = process.env.ENCRYPTION_KEY;
delete process.env.ENCRYPTION_KEY;
assert.throws(() => {
  resolveKey();
}, /ENCRYPTION_KEY environment variable is required/, 'Must throw error when ENCRYPTION_KEY is missing');
process.env.ENCRYPTION_KEY = savedEnvKey;
console.log('✅ Test 0: Fail closed on missing ENCRYPTION_KEY passed.');

// Test 1: Basic Round-Trip Encryption and Decryption
const sampleText = 'Halo dunia, ini pesan rahasia bot fuenzer!';
const encrypted = encrypt(sampleText);

assert.strictEqual(typeof encrypted, 'string', 'Encrypted output should be a string');
assert.ok(isEncrypted(encrypted), 'Encrypted output should match iv:authTag:ciphertext format');

const decrypted = decrypt(encrypted);
assert.strictEqual(decrypted, sampleText, 'Decrypted text should match original text');
console.log('✅ Test 1: Basic round-trip encryption/decryption passed.');

// Test 2: Payload structure validation
const parts = encrypted.split(':');
assert.strictEqual(parts.length, 3, 'Payload must have exactly 3 colon-separated parts');
assert.strictEqual(parts[0].length, 24, 'IV should be 12 bytes = 24 hex characters');
assert.strictEqual(parts[1].length, 32, 'Auth tag should be 16 bytes = 32 hex characters');
assert.ok(parts[2].length > 0, 'Ciphertext should not be empty');
console.log('✅ Test 2: Payload structure format validated.');

// Test 3: Non-deterministic IV (different ciphertext for same plaintext)
const encrypted2 = encrypt(sampleText);
assert.notStrictEqual(encrypted, encrypted2, 'Two encryptions of same plaintext should produce different ciphertexts due to random IV');
assert.strictEqual(decrypt(encrypted2), sampleText, 'Both ciphertexts should decrypt to same plaintext');
console.log('✅ Test 3: Random IV produces unique ciphertexts for identical plaintext.');

// Test 4: Custom Key Support
const customKey = crypto.randomBytes(32);
const customEncrypted = encrypt(sampleText, customKey);
assert.strictEqual(decrypt(customEncrypted, customKey), sampleText, 'Decryption with matching custom key must succeed');

assert.throws(() => {
  const wrongKey = crypto.randomBytes(32);
  decrypt(customEncrypted, wrongKey);
}, /Decryption failed/, 'Decryption with wrong key must fail and throw');
console.log('✅ Test 4: Custom key isolation and wrong-key rejection passed.');

// Test 5: Tamper Resistance (AEAD Integrity Verification)
const tamperedCipher = parts[0] + ':' + parts[1] + ':' + (parts[2].slice(0, -2) + (parts[2].slice(-2) === 'aa' ? 'bb' : 'aa'));
assert.throws(() => {
  decrypt(tamperedCipher);
}, /Decryption failed/, 'Tampered ciphertext must fail authentication and throw');

const tamperedAuthTag = parts[0] + ':' + (parts[1].slice(0, -2) + (parts[1].slice(-2) === '00' ? '11' : '00')) + ':' + parts[2];
assert.throws(() => {
  decrypt(tamperedAuthTag);
}, /Decryption failed/, 'Tampered auth tag must fail authentication and throw');
console.log('✅ Test 5: Tamper resistance (ciphertext & authTag integrity) passed.');

// Test 6: Empty, Null, and Non-string Handling
assert.strictEqual(encrypt(''), '', 'Empty string should return empty string');
assert.strictEqual(encrypt(null), null, 'Null input should return null');
assert.strictEqual(decrypt(''), '', 'Empty ciphertext should return empty string');
assert.strictEqual(decrypt(null), null, 'Null ciphertext should return null');
assert.strictEqual(decrypt('not-an-encrypted-string'), 'not-an-encrypted-string', 'Unencrypted string should pass through unchanged');
console.log('✅ Test 6: Empty, null, and non-encrypted passthrough passed.');

console.log('✅ All crypto.js tests passed successfully!\n');
