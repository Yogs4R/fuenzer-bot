const assert = require('assert');
const { isEncrypted } = require('../src/utils/crypto');
const chatBufferService = require('../src/services/chatBufferService');

console.log('--- Running chatBufferService Tests ---');

async function runTests() {
  // Test 1: Command messages starting with '/' must NOT be buffered
  const commandResult = await chatBufferService.enqueueMessage({
    platform: 'whatsapp',
    chatId: '1234567890@g.us',
    chatName: 'Dev Group',
    senderName: 'Alice',
    messageText: '/catat 50000 makan siang'
  });
  assert.strictEqual(commandResult.queued, false, 'Slash commands must not be queued');
  assert.strictEqual(commandResult.reason, 'bot_command_ignored', 'Reason must be bot_command_ignored');
  console.log('✅ Test 1: Bot commands (/command) are successfully ignored.');

  // Test 2: Empty messages and missing required fields
  const emptyResult = await chatBufferService.enqueueMessage({
    platform: 'telegram',
    chatId: '-100123456789',
    messageText: '   '
  });
  assert.strictEqual(emptyResult.queued, false, 'Empty messages must not be queued');
  assert.strictEqual(emptyResult.reason, 'missing_required_fields', 'Reason must be missing_required_fields');

  const missingPlatformResult = await chatBufferService.enqueueMessage({
    chatId: '-100123456789',
    messageText: 'Hello world'
  });
  assert.strictEqual(missingPlatformResult.queued, false, 'Missing platform must be rejected');

  // Test 2b: Require ENCRYPTION_KEY (fail closed) (Codex P1)
  const savedKey = process.env.ENCRYPTION_KEY;
  delete process.env.ENCRYPTION_KEY;
  const noKeyResult = await chatBufferService.enqueueMessage({
    platform: 'telegram',
    chatId: '-100123456789',
    messageText: 'Hello world'
  });
  assert.strictEqual(noKeyResult.queued, false, 'Must not queue when key is missing');
  assert.strictEqual(noKeyResult.reason, 'missing_encryption_key', 'Reason must be missing_encryption_key');
  // Restore key
  process.env.ENCRYPTION_KEY = savedKey || 'test-secret-encryption-key-for-unit-tests-32b';
  console.log('✅ Test 2: Empty messages, missing fields, and missing ENCRYPTION_KEY are safely rejected (fail closed).');

  // Test 3: Normal message validation and error resilience
  // Even if Supabase is offline in local dev test environment, enqueueMessage must never throw an unhandled exception
  const validResult = await chatBufferService.enqueueMessage({
    platform: 'whatsapp',
    chatId: '1234567890@g.us',
    chatName: 'Tech Talk Group',
    senderName: 'Bob',
    messageText: 'Teman-teman besok kita ada sprint review jam 10 pagi ya'
  });
  assert.ok(typeof validResult === 'object', 'Result must be an object');
  console.log('✅ Test 3: Ingestion pipeline executes safely without unhandled exceptions.');

  // Test 4: Pending messages retrieval resilience
  const pending = await chatBufferService.getPendingMessages('whatsapp', '1234567890@g.us');
  assert.ok(Array.isArray(pending), 'getPendingMessages must return an array');
  console.log('✅ Test 4: getPendingMessages returns array safely.');

  // Test 5: Mark messages as summarized with empty array
  const emptySummarized = await chatBufferService.markMessagesAsSummarized([]);
  assert.strictEqual(emptySummarized.updated, false, 'Empty array should return updated: false');
  assert.strictEqual(emptySummarized.count, 0, 'Empty array should have count: 0');
  console.log('✅ Test 5: markMessagesAsSummarized handles empty arrays safely.');

  // Test 6: Purge expired buffer resilience
  const purgeResult = await chatBufferService.purgeExpiredBuffer();
  assert.ok(typeof purgeResult === 'object', 'Purge result must be an object');
  console.log('✅ Test 6: purgeExpiredBuffer executes safely.');

  console.log('✅ All chatBufferService tests passed successfully!\n');
}

runTests().catch((err) => {
  console.error('❌ chatBufferService test failed:', err);
  process.exit(1);
});
