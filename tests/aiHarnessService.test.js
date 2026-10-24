const assert = require('assert');
const {
  HARNESS_TOOLS,
  buildHarnessSystemPrompt,
  executeToolCall,
  formatWhatsAppMarkdown
} = require('../src/services/aiHarnessService');

console.log('--- Running aiHarnessService Tests ---');

async function runTests() {
  // Test 1: Verify tool definitions schema integrity
  assert.ok(Array.isArray(HARNESS_TOOLS), 'HARNESS_TOOLS must be an array');
  assert.strictEqual(HARNESS_TOOLS.length, 7, 'Must register exactly 7 domain tools');

  const registeredNames = HARNESS_TOOLS.map((t) => t.function?.name);
  const expectedNames = [
    'record_expense',
    'record_income',
    'check_balance',
    'get_weather',
    'set_reminder',
    'get_prayer_times',
    'search_book'
  ];

  for (const name of expectedNames) {
    assert.ok(registeredNames.includes(name), `Tool "${name}" must be registered in HARNESS_TOOLS`);
  }

  for (const tool of HARNESS_TOOLS) {
    assert.strictEqual(tool.type, 'function', 'Tool type must be "function"');
    assert.ok(tool.function?.description?.length > 10, `Tool ${tool.function?.name} must have descriptive text`);
    assert.strictEqual(tool.function?.parameters?.type, 'object', `Tool ${tool.function?.name} parameters must be an object schema`);
  }
  console.log('✅ Test 1: Tool definitions schema integrity verified.');

  // Test 2: System prompt reflects bilingual sloth butler persona
  const promptEn = buildHarnessSystemPrompt('en');
  assert.ok(promptEn.includes('sloth butler'), 'English prompt must define sloth butler persona');
  assert.ok(promptEn.includes('slow, steady, and deliberate'), 'English prompt must include hackathon slogan');
  assert.ok(promptEn.includes('English'), 'English prompt must enforce English language');

  const promptId = buildHarnessSystemPrompt('id');
  assert.ok(promptId.includes('sloth butler'), 'Indonesian prompt must define sloth butler persona');
  assert.ok(promptId.includes('pelan tapi pasti'), 'Indonesian prompt must include Indonesian slogan');
  assert.ok(promptId.includes('Bahasa Indonesia'), 'Indonesian prompt must enforce Indonesian language');
  console.log('✅ Test 2: Bilingual Sloth Butler system prompts verified.');

  // Test 3: formatWhatsAppMarkdown transforms markdown tokens cleanly
  const rawText = '## Section Title\nHere is **bold** text and:\n* bullet one\n* bullet two';
  const formatted = formatWhatsAppMarkdown(rawText);
  assert.ok(formatted.includes('*Section Title*'), 'Headers must be converted to WhatsApp bold');
  assert.ok(formatted.includes('*bold*'), 'Double asterisks must be converted to single asterisks');
  assert.ok(formatted.includes('- bullet one'), 'Bullets must be normalized to hyphens');
  assert.ok(!formatted.includes('**'), 'No raw double asterisks should remain');
  console.log('✅ Test 3: formatWhatsAppMarkdown normalizes markdown successfully.');

  // Test 4: Unknown tool handled gracefully
  const unknownResult = await executeToolCall('unknown_magic_tool', {}, { userId: 'user-test', lang: 'en' });
  assert.strictEqual(unknownResult.success, false, 'Unknown tool must return success: false');
  assert.ok(unknownResult.error.includes('Unknown tool'), 'Must report unknown tool error');
  console.log('✅ Test 4: Unknown tool handled gracefully without throwing.');

  // Test 5: Tool dispatch for get_weather handles missing/empty city cleanly
  const weatherResult = await executeToolCall('get_weather', { city: '' }, { userId: 'user-test', lang: 'en' });
  assert.ok(weatherResult.tool === 'get_weather', 'Tool name must match');
  console.log('✅ Test 5: Weather tool dispatch safely returns result.');

  // Test 6: Tool dispatch for get_prayer_times executes safely
  const prayerResult = await executeToolCall('get_prayer_times', { city: 'Bandung' }, { userId: 'user-test', lang: 'id' });
  assert.ok(prayerResult.tool === 'get_prayer_times', 'Tool name must match');
  console.log('✅ Test 6: Prayer times tool dispatch safely returns result.');

  // Test 7: Tool dispatch for search_book executes safely
  const bookResult = await executeToolCall('search_book', { query: 'Clean Code' }, { userId: 'user-test', lang: 'en' });
  assert.ok(bookResult.tool === 'search_book', 'Tool name must match');
  assert.strictEqual(typeof bookResult.count, 'number', 'Book search returns result count');
  console.log('✅ Test 7: Book search tool dispatch safely returns result.');

  // Test 8: Tool dispatch for set_reminder rejects invalid delay format safely
  const reminderResult = await executeToolCall('set_reminder', { time: 'invalid-time', message: 'test' }, { userId: 'user-test', lang: 'id' });
  assert.strictEqual(reminderResult.success, false, 'Invalid time must fail safely');
  assert.ok(reminderResult.error.length > 0, 'Error message must be populated');
  console.log('✅ Test 8: Reminder tool dispatch validates delay format safely.');
}

runTests()
  .then(() => {
    console.log('✅ All aiHarnessService tests passed successfully!\n');
    process.exit(0);
  })
  .catch((err) => {
    console.error('❌ aiHarnessService tests failed:', err);
    process.exit(1);
  });
