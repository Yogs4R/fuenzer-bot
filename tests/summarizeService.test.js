const assert = require('assert');
const {
  formatChatTranscript,
  buildSummarizePrompt,
  DEFAULT_GEMMA_MODEL
} = require('../src/services/summarizeService');
const {
  isValidScheduleTime,
  handleSummarizeCommand
} = require('../src/commands/ai/summarize');

console.log('--- Running summarizeService & /summarize Command Tests ---');

async function runTests() {
  // Test 1: formatChatTranscript
  const emptyTranscript = formatChatTranscript([]);
  assert.strictEqual(emptyTranscript, '', 'Empty messages must produce empty transcript');

  const sampleMessages = [
    {
      id: 'msg-2',
      createdAt: '2026-10-24T08:32:00.000Z',
      senderName: 'Bob',
      messageText: 'Don’t forget the PR review deadline today at 5 PM'
    },
    {
      id: 'msg-1',
      createdAt: '2026-10-24T08:30:00.000Z',
      senderName: 'Alice',
      messageText: 'Good morning team! Has everyone checked the new deployment?'
    }
  ];

  const transcript = formatChatTranscript(sampleMessages);
  assert.ok(transcript.includes('Alice: Good morning team!'), 'Alice message must be in transcript');
  assert.ok(transcript.includes('Bob: Don’t forget the PR review'), 'Bob message must be in transcript');
  assert.ok(transcript.indexOf('Alice') < transcript.indexOf('Bob'), 'Transcript must be chronologically sorted');
  console.log('✅ Test 1: formatChatTranscript sorts and formats messages correctly.');

  // Test 2: buildSummarizePrompt (English & Indonesian)
  const promptEn = buildSummarizePrompt(transcript, 'en');
  assert.ok(promptEn.systemPrompt.includes('Sloth Butler'), 'English prompt must include Sloth Butler persona');
  assert.ok(promptEn.systemPrompt.includes('Sloth TL;DR'), 'English prompt must contain Sloth TL;DR section');
  assert.ok(promptEn.systemPrompt.includes('Key Action Items'), 'English prompt must contain Action Items section');
  assert.ok(promptEn.userPrompt.includes(transcript), 'User prompt must embed the chat transcript');

  const promptId = buildSummarizePrompt(transcript, 'id');
  assert.ok(promptId.systemPrompt.includes('Butler Sloth'), 'Indonesian prompt must include Butler Sloth');
  assert.ok(promptId.systemPrompt.includes('Ringkasan Santai'), 'Indonesian prompt must contain Ringkasan Santai section');
  assert.ok(promptId.systemPrompt.includes('Tindak Lanjut'), 'Indonesian prompt must contain Tindak Lanjut section');
  console.log('✅ Test 2: buildSummarizePrompt constructs structured bilingual prompts.');

  // Test 3: isValidScheduleTime
  assert.strictEqual(isValidScheduleTime('08:00'), true, '08:00 must be valid');
  assert.strictEqual(isValidScheduleTime('23:59'), true, '23:59 must be valid');
  assert.strictEqual(isValidScheduleTime('00:00'), true, '00:00 must be valid');
  assert.strictEqual(isValidScheduleTime('8:00'), false, '8:00 without leading zero must be invalid');
  assert.strictEqual(isValidScheduleTime('25:00'), false, '25:00 must be invalid');
  assert.strictEqual(isValidScheduleTime('12:60'), false, '12:60 must be invalid');
  assert.strictEqual(isValidScheduleTime(null), false, 'null must be invalid');
  assert.strictEqual(isValidScheduleTime('invalid'), false, 'invalid text must be invalid');
  console.log('✅ Test 3: isValidScheduleTime validates HH:mm 24h formats accurately.');

  // Test 4: Default Gemma Model Constant
  assert.strictEqual(DEFAULT_GEMMA_MODEL, 'google/gemma-4-26b-a4b-it', 'Default Gemma model should match planning specification');
  console.log('✅ Test 4: DEFAULT_GEMMA_MODEL matches google/gemma-4-26b-a4b-it.');

  // Test 5: /summarize schedule format error handling
  const invalidScheduleReply = await handleSummarizeCommand('/summarize', ['schedule', '99:99'], 'user-123', 'whatsapp', { lang: 'en' });
  assert.ok(invalidScheduleReply.includes('Invalid time format'), 'Should return invalid format notice in English');

  const invalidScheduleReplyId = await handleSummarizeCommand('/ringkas', ['jadwal', 'invalid'], 'user-123', 'whatsapp', { lang: 'id' });
  assert.ok(invalidScheduleReplyId.includes('Format waktu salah'), 'Should return invalid format notice in Indonesian');
  console.log('✅ Test 5: /summarize schedule validates input and returns localized error.');

  // Test 6: /summarize status output
  const statusReplyEn = await handleSummarizeCommand('/summarize', ['status'], 'user-123', 'whatsapp', { lang: 'en' });
  assert.ok(statusReplyEn.includes('CHAT SUMMARIZER STATUS'), 'Status reply must have English header');
  assert.ok(statusReplyEn.includes('Daily Schedule'), 'Status reply must show schedule');

  const statusReplyId = await handleSummarizeCommand('/ringkas', ['status'], 'user-123', 'telegram', { lang: 'id' });
  assert.ok(statusReplyId.includes('STATUS CHAT SUMMARIZER'), 'Status reply must have Indonesian header');
  assert.ok(statusReplyId.includes('Jadwal Harian'), 'Status reply must show Indonesian schedule label');
  console.log('✅ Test 6: /summarize status outputs clean bilingual status reports.');

  // Test 7: /summarize now with empty buffer
  const nowReplyEn = await handleSummarizeCommand('/summarize', ['now'], 'user-test-empty', 'whatsapp', { lang: 'en', chatId: 'empty-group' });
  assert.ok(nowReplyEn.includes('No pending group messages'), 'Should inform user that buffer is empty');
  console.log('✅ Test 7: /summarize now gracefully handles empty message buffers.');

  console.log('✅ All summarizeService & /summarize tests passed successfully!\n');
}

runTests().catch((err) => {
  console.error('❌ summarizeService test failed:', err);
  process.exit(1);
});
