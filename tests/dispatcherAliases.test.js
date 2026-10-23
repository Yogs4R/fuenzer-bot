const assert = require('assert');
const { dispatchCommand } = require('../src/commands/index');
const { clearLanguageCache } = require('../src/services/languageService');

async function runDispatcherAliasTests() {
  console.log('--- Running Dispatcher Alias Tests ---');
  clearLanguageCache();

  const userId = 'unit-test-user-123';
  const platform = 'whatsapp';

  // 1. Language status command
  const langStatus = await dispatchCommand('/lang', [], userId, platform, {});
  assert.ok(langStatus.includes('Active language'), `Expected English language status, got: ${langStatus}`);

  // 2. Language switch to Indonesian
  const switchReply = await dispatchCommand('/lang', ['id'], userId, platform, {});
  assert.ok(switchReply.includes('Bahasa berhasil diubah'), `Expected ID confirmation, got: ${switchReply}`);

  // 3. Language status now reflects Indonesian
  const langStatusId = await dispatchCommand('/bahasa', [], userId, platform, {});
  assert.ok(langStatusId.includes('Bahasa aktif'), `Expected ID status, got: ${langStatusId}`);

  // 4. Test DevOps bilingual aliases: /ping, /system, /sistem
  const pingEn = await dispatchCommand('/ping', [], userId, platform, { lang: 'en' });
  assert.ok(pingEn.includes('Pong! 🏓'), `Expected Pong in /ping, got: ${pingEn}`);
  assert.ok(pingEn.includes('*CPU:*'), `Expected *CPU:* in English stats`);

  const systemId = await dispatchCommand('/sistem', [], userId, platform, { lang: 'id' });
  assert.ok(systemId.includes('Pong! 🏓'), `Expected Pong in /sistem, got: ${systemId}`);

  // 5. Switch back to English
  await dispatchCommand('/language', ['en'], userId, platform, {});
  const langStatusEn = await dispatchCommand('/lang', [], userId, platform, {});
  assert.ok(langStatusEn.includes('Active language: *English*'), `Expected English active language`);

  // 6. Test unknown command routing returns null (delegated to platform adapter)
  const unknown = await dispatchCommand('/random_unknown_cmd_123', [], userId, platform, {});
  assert.strictEqual(unknown, null, 'Expected unknown command to return null from dispatchCommand');

  console.log('✅ All Dispatcher Alias tests passed successfully!');
}

runDispatcherAliasTests().catch((err) => {
  console.error('❌ Dispatcher Alias test failed:', err);
  process.exit(1);
});
