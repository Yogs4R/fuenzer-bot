const assert = require('assert');
const { dispatchCommand } = require('../src/commands/index');
const { clearLanguageCache } = require('../src/services/languageService');

async function runDispatcherAliasTests() {
  console.log('--- Running Dispatcher Alias Tests ---');
  clearLanguageCache();

  const userId = `unit-test-user-${Date.now()}`;
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

  // 4. Test DevOps commands: /ping and /about
  const pingEn = await dispatchCommand('/ping', [], userId, platform, { lang: 'en' });
  assert.ok(pingEn.includes('Pong! 🏓'), `Expected Pong in /ping, got: ${pingEn}`);
  assert.ok(pingEn.includes('*CPU:*'), `Expected *CPU:* in English stats`);

  const aboutReplyEn = await dispatchCommand('/about', [], userId, platform, { lang: 'en' });
  assert.ok(aboutReplyEn.includes('ABOUT CREATOR'), `Expected English header in /about, got: ${aboutReplyEn}`);
  assert.ok(aboutReplyEn.includes('Ridwan Yoga'), `Expected creator info in /about`);

  const aboutReplyId = await dispatchCommand('/me', [], userId, platform, { lang: 'id' });
  assert.ok(aboutReplyId.includes('TENTANG KREATOR'), `Expected Indonesian header in /me, got: ${aboutReplyId}`);

  // 5. Switch back to English
  await dispatchCommand('/language', ['en'], userId, platform, {});
  const langStatusEn = await dispatchCommand('/lang', [], userId, platform, {});
  assert.ok(langStatusEn.includes('Active language: *English*'), `Expected English active language`);

  // 6. Test AI /model and /models
  const modelEn = await dispatchCommand('/model', [], userId, platform, { lang: 'en' });
  assert.ok(modelEn.includes('AI MODEL DIRECTORY'), `Expected English AI models header, got: ${modelEn}`);

  const modelId = await dispatchCommand('/models', [], userId, platform, { lang: 'id' });
  assert.ok(modelId.includes('DAFTAR MODEL AI'), `Expected Indonesian AI models header, got: ${modelId}`);

  // 7. Test Google/CS /help and /bantuan
  const helpEn = await dispatchCommand('/help', [], userId, platform, { lang: 'en' });
  assert.ok(helpEn.includes('HELP & FEEDBACK CENTER'), `Expected English help center, got: ${helpEn}`);

  const helpId = await dispatchCommand('/bantuan', [], userId, platform, { lang: 'id' });
  assert.ok(helpId.includes('PUSAT BANTUAN & FEEDBACK'), `Expected Indonesian help center, got: ${helpId}`);

  // 8. Test Utility /short and /shortlink
  const shortEn = await dispatchCommand('/short', [], userId, platform, { lang: 'en' });
  assert.ok(shortEn.includes('Please enter the link'), `Expected English short prompt, got: ${shortEn}`);

  const shortId = await dispatchCommand('/shortlink', [], userId, platform, { lang: 'id' });
  assert.ok(shortId.includes('Masukkan link yang ingin dipendekkan'), `Expected Indonesian short prompt, got: ${shortId}`);

  // 9. Test Downloader /download and /unduh
  const dlEn = await dispatchCommand('/download', [], userId, platform, { lang: 'en' });
  assert.ok(dlEn.message.includes('Please enter a media link'), `Expected English dl prompt, got: ${dlEn.message}`);

  const dlId = await dispatchCommand('/unduh', [], userId, platform, { lang: 'id' });
  assert.ok(dlId.message.includes('Masukkan link media'), `Expected Indonesian dl prompt, got: ${dlId.message}`);

  // 10. Test Research /book and /buku
  const bookEn = await dispatchCommand('/book', [], userId, platform, { lang: 'en' });
  assert.ok(bookEn.includes('Enter a book title'), `Expected English book prompt, got: ${bookEn}`);

  const bookId = await dispatchCommand('/buku', [], userId, platform, { lang: 'id' });
  assert.ok(bookId.includes('Masukkan kata kunci buku'), `Expected Indonesian book prompt, got: ${bookId}`);

  // 11. Test unknown command routing returns null (delegated to platform adapter)
  const unknown = await dispatchCommand('/random_unknown_cmd_123', [], userId, platform, {});
  assert.strictEqual(unknown, null, 'Expected unknown command to return null from dispatchCommand');

  console.log('✅ All Dispatcher Alias tests passed successfully!');
}

runDispatcherAliasTests().catch((err) => {
  console.error('❌ Dispatcher Alias test failed:', err);
  process.exit(1);
});
