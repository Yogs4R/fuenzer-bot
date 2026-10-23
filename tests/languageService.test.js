const assert = require('assert');
const { getUserLanguage, setUserLanguage, clearLanguageCache } = require('../src/services/languageService');

async function runLanguageServiceTests() {
  console.log('--- Running languageService Tests ---');

  clearLanguageCache();

  const testUserId = 'test-user-9999';
  const platform = 'whatsapp';

  // 1. Initial lookup with clear cache should return default 'en'
  const initialLang = await getUserLanguage(testUserId, platform);
  assert.strictEqual(initialLang, 'en', `Expected 'en', got ${initialLang}`);

  // 2. Setting language to 'id'
  const updatedLang = await setUserLanguage(testUserId, platform, 'id');
  assert.strictEqual(updatedLang, 'id', `Expected 'id', got ${updatedLang}`);

  // 3. Immediately getting cached language
  const cachedLang = await getUserLanguage(testUserId, platform);
  assert.strictEqual(cachedLang, 'id', `Expected cached 'id', got ${cachedLang}`);

  // 4. Invalid language should normalize to 'en'
  const fallbackLang = await setUserLanguage(testUserId, platform, 'invalid_code');
  assert.strictEqual(fallbackLang, 'en', `Expected fallback 'en', got ${fallbackLang}`);

  console.log('✅ All languageService tests passed successfully!');
}

runLanguageServiceTests().catch((err) => {
  console.error('❌ languageService test failed:', err);
  process.exit(1);
});
