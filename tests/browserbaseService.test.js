const assert = require('assert');
const {
  normalizeUrl,
  createBrowserbaseSession,
  getSessionDebugUrls,
  browseWebPage
} = require('../src/services/browserbaseService');
const { handleBrowserCommand } = require('../src/commands/browser/index');

console.log('--- Running browserbaseService Tests ---');

async function runTests() {
  // Test 1: URL Normalization
  assert.strictEqual(normalizeUrl(null), null, 'null input must return null');
  assert.strictEqual(normalizeUrl(''), null, 'empty input must return null');
  assert.strictEqual(normalizeUrl('   '), null, 'whitespace input must return null');
  assert.strictEqual(normalizeUrl('ftp://files.org/item'), null, 'non-http protocol must return null');
  assert.strictEqual(normalizeUrl('javascript:alert(1)'), null, 'javascript protocol must return null');

  const normalizedNoProtocol = normalizeUrl('hacker-news.firebaseio.com/v0/item');
  assert.ok(normalizedNoProtocol && normalizedNoProtocol.startsWith('https://'), 'Must prepend https:// when protocol missing');

  const normalizedWithHttps = normalizeUrl('https://github.com/trending');
  assert.strictEqual(normalizedWithHttps, 'https://github.com/trending', 'Must preserve existing valid https URL');

  const normalizedWithHttp = normalizeUrl('http://insecure-site.org/path');
  assert.strictEqual(normalizedWithHttp, 'http://insecure-site.org/path', 'Must preserve existing valid http URL');
  console.log('✅ Test 1: URL normalization and protocol validation verified.');

  // Test 2: Missing API key handling in browseWebPage
  const originalKey = process.env.BROWSERBASE_API_KEY;
  try {
    delete process.env.BROWSERBASE_API_KEY;
    const resEn = await browseWebPage({ url: 'https://news.ycombinator.com', lang: 'en' });
    assert.strictEqual(resEn.success, false);
    assert.strictEqual(resEn.reason, 'missing_api_key');
    assert.ok(resEn.error.includes('BROWSERBASE_API_KEY'), 'English error must cite missing BROWSERBASE_API_KEY');

    const resId = await browseWebPage({ url: 'https://news.ycombinator.com', lang: 'id' });
    assert.strictEqual(resId.success, false);
    assert.strictEqual(resId.reason, 'missing_api_key');
    assert.ok(resId.error.includes('BROWSERBASE_API_KEY'), 'Indonesian error must cite missing BROWSERBASE_API_KEY');
  } finally {
    if (originalKey) process.env.BROWSERBASE_API_KEY = originalKey;
  }
  console.log('✅ Test 2: Missing API key fail-safe verified.');

  // Test 3: Invalid URL handling in browseWebPage
  const fakeKey = 'bb_live_fake_key_for_testing';
  const prevKey = process.env.BROWSERBASE_API_KEY;
  try {
    process.env.BROWSERBASE_API_KEY = fakeKey;
    const invalidResEn = await browseWebPage({ url: 'invalid_domain_with_spaces and bad tokens', lang: 'en' });
    // URL parser treats it as https://invalid_domain_with_spaces%20and%20bad%20tokens or rejects
    const badProtocolRes = await browseWebPage({ url: 'ftp://ftp.site.org', lang: 'en' });
    assert.strictEqual(badProtocolRes.success, false);
    assert.strictEqual(badProtocolRes.reason, 'invalid_url');
    assert.ok(badProtocolRes.error.length > 5);

    const badProtocolResId = await browseWebPage({ url: 'file:///etc/passwd', lang: 'id' });
    assert.strictEqual(badProtocolResId.success, false);
    assert.strictEqual(badProtocolResId.reason, 'invalid_url');
  } finally {
    if (prevKey) {
      process.env.BROWSERBASE_API_KEY = prevKey;
    } else {
      delete process.env.BROWSERBASE_API_KEY;
    }
  }
  console.log('✅ Test 3: Invalid URL validation in browseWebPage verified.');

  // Test 4: getSessionDebugUrls graceful degradation
  const debugEmpty = await getSessionDebugUrls('');
  assert.deepStrictEqual(debugEmpty, {}, 'Empty session ID must return empty object');
  console.log('✅ Test 4: getSessionDebugUrls graceful degradation verified.');

  // Test 5: handleBrowserCommand usage guides (no arguments)
  const usageEn = await handleBrowserCommand('/browse', [], 'test-user', 'whatsapp', { lang: 'en' });
  assert.ok(usageEn.includes('BROWSERBASE CLOUD AGENT'), 'Usage output must include agent header');
  assert.ok(usageEn.includes('/browse'), 'Usage output must show /browse command');
  assert.ok(usageEn.includes('Usage:'), 'English usage output must include Usage label');

  const usageId = await handleBrowserCommand('/jelajah', [], 'test-user', 'whatsapp', { lang: 'id' });
  assert.ok(usageId.includes('AGEN BROWSERBASE CLOUD'), 'Indonesian usage must include Indonesian header');
  assert.ok(usageId.includes('Penggunaan:'), 'Indonesian usage output must include Penggunaan label');
  console.log('✅ Test 5: Bilingual usage guides verified.');

  // Test 6: handleBrowserCommand missing key failure output
  const savedKey = process.env.BROWSERBASE_API_KEY;
  try {
    delete process.env.BROWSERBASE_API_KEY;
    const failReply = await handleBrowserCommand('/browse', ['github.com'], 'test-user', 'whatsapp', { lang: 'en' });
    assert.ok(typeof failReply === 'string', 'Failure response must be a string error message');
    assert.ok(failReply.includes('BROWSERBASE_API_KEY'), 'Failure message must mention missing API key');
  } finally {
    if (savedKey) process.env.BROWSERBASE_API_KEY = savedKey;
  }
  console.log('✅ Test 6: Command error handling verified.');

  console.log('All browserbaseService tests passed successfully! 🎉');
}

runTests().catch((err) => {
  console.error('❌ browserbaseService test failed:', err);
  process.exit(1);
});
