const assert = require('assert');
const { t, isValidLanguage, normalizeLanguage, DEFAULT_LANGUAGE } = require('../src/utils/i18n');

function runI18nTests() {
  console.log('--- Running i18n Tests ---');

  // 1. Default Language
  assert.strictEqual(DEFAULT_LANGUAGE, 'en');

  // 2. Language Validation
  assert.strictEqual(isValidLanguage('en'), true);
  assert.strictEqual(isValidLanguage('id'), true);
  assert.strictEqual(isValidLanguage('EN'), true);
  assert.strictEqual(isValidLanguage('fr'), false);
  assert.strictEqual(isValidLanguage(''), false);

  // 3. Normalization
  assert.strictEqual(normalizeLanguage('ID'), 'id');
  assert.strictEqual(normalizeLanguage('unknown'), 'en');

  // 4. English Default Translation
  const enHeader = t('finance.balance_header');
  assert.ok(enHeader.includes('FINANCE SUMMARY'), `Expected English header, got: ${enHeader}`);

  // 5. Indonesian Translation
  const idHeader = t('finance.balance_header', {}, 'id');
  assert.ok(idHeader.includes('RINGKASAN KEUANGAN'), `Expected Indonesian header, got: ${idHeader}`);

  // 6. Variable Interpolation
  const interpolated = t('common.unknown_command_body', { command: '/foo' }, 'en');
  assert.ok(interpolated.includes('Command "/foo" is not recognized'), `Expected interpolated text, got: ${interpolated}`);

  const interpolatedId = t('common.unknown_command_body', { command: '/bar' }, 'id');
  assert.ok(interpolatedId.includes('Perintah "/bar" tidak tersedia'), `Expected interpolated ID text, got: ${interpolatedId}`);

  // 7. Non-existent Key Fallback
  const missingKey = 'non.existent.key.xyz';
  assert.strictEqual(t(missingKey), missingKey);

  // 8. New Namespaces Verification
  const namespaces = ['about', 'ai', 'converter', 'downloader', 'research', 'google', 'utility', 'admin'];
  const enDict = require('../src/locales/en.json');
  const idDict = require('../src/locales/id.json');

  for (const ns of namespaces) {
    assert.ok(enDict[ns], `Missing namespace ${ns} in en.json`);
    assert.ok(idDict[ns], `Missing namespace ${ns} in id.json`);
    const enKeys = Object.keys(enDict[ns]);
    const idKeys = Object.keys(idDict[ns]);
    assert.strictEqual(enKeys.length, idKeys.length, `Key count mismatch in namespace "${ns}": en (${enKeys.length}) vs id (${idKeys.length})`);
  }

  console.log('✅ All i18n tests passed successfully!');
}

runI18nTests();
