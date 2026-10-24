const assert = require('assert');
const {
  cleanTextForSpeech,
  extractSlothTldr,
  synthesizeSpeech,
  DEFAULT_ELEVENLABS_VOICE_ID,
  DEFAULT_ELEVENLABS_MODEL_ID
} = require('../src/services/elevenLabsService');
const { handleSummarizeCommand } = require('../src/commands/ai/summarize');

console.log('--- Running elevenLabsService & Voice Note Tests ---');

async function runTests() {
  // Test 1: cleanTextForSpeech normalizes markdown, URLs, and emojis
  const dirtyText = 'Hello *world*! Check `npm test` and https://somelink/resource 🦥 #heading\n> quote line\n- list item';
  const cleaned = cleanTextForSpeech(dirtyText);
  assert.ok(!cleaned.includes('*'), 'Asterisks must be stripped');
  assert.ok(!cleaned.includes('`'), 'Backticks must be stripped');
  assert.ok(!/https?:\/\//i.test(cleaned), 'URLs must be stripped');
  assert.ok(!cleaned.includes('somelink'), 'URL host must be stripped');
  assert.ok(!cleaned.includes('resource'), 'URL path must be stripped');
  assert.ok(!cleaned.includes('🦥'), 'Emojis must be stripped');
  assert.ok(!cleaned.includes('>'), 'Blockquote markers must be stripped');
  assert.ok(cleaned.includes('Hello world! Check npm test and heading quote line list item'), 'Clean text must retain spoken content');
  console.log('✅ Test 1: cleanTextForSpeech cleans markdown, URLs, and emojis cleanly.');

  // Test 2: extractSlothTldr extracts Section 1 from structured English summary
  const sampleEnSummary = `1. 🦥 *Sloth TL;DR*
The engineering team finalized the backend API refactoring and reviewed the PRs for deployment. General mood was positive and focused on upcoming sprint targets.

2. 🎯 *Key Action Items & Mentions*
• @alex: Review database indexing PR by 3 PM
• @sarah: Prepare deployment notes

3. 📊 *Chatter & Noise Statistics*
• 85% signal, 15% noise.`;

  const tldrEn = extractSlothTldr(sampleEnSummary);
  assert.ok(tldrEn.includes('engineering team finalized the backend API refactoring'), 'English TL;DR must be extracted');
  assert.ok(!tldrEn.includes('Key Action Items'), 'Action items must not bleed into TL;DR');
  console.log('✅ Test 2: extractSlothTldr extracts English Sloth TL;DR accurately.');

  // Test 3: extractSlothTldr extracts Section 1 from structured Indonesian summary
  const sampleIdSummary = `1. 🦥 *Ringkasan Santai (Sloth TL;DR)*
Tim backend telah menyelesaikan perbaikan arsitektur dan mempersiapkan rilis sistem. Suasana obrolan sangat santai namun tetap terarah pada target mingguan.

2. 🎯 *Poin Tindakan Kunci & Mention (Action Items)*
• @budi: Periksa migrasi tabel Supabase
• @ani: Validasi integrasi API

3. 📊 *Statistik Obrolan (Chatter Stats)*
• 90% obrolan kerja, 10% santai.`;

  const tldrId = extractSlothTldr(sampleIdSummary);
  assert.ok(tldrId.includes('Tim backend telah menyelesaikan perbaikan arsitektur'), 'Indonesian TL;DR must be extracted');
  assert.ok(!tldrId.includes('Poin Tindakan Kunci'), 'Action items must not bleed into TL;DR');
  console.log('✅ Test 3: extractSlothTldr extracts Indonesian Sloth TL;DR accurately.');

  // Test 4: Default voice and model constants
  assert.strictEqual(DEFAULT_ELEVENLABS_VOICE_ID, '21m00Tcm4TlvDq8ikWAM', 'Default voice ID must match Rachel');
  assert.strictEqual(DEFAULT_ELEVENLABS_MODEL_ID, 'eleven_multilingual_v2', 'Default model ID must match eleven_multilingual_v2');
  console.log('✅ Test 4: Default ElevenLabs constants match specification.');

  // Test 5: synthesizeSpeech gracefully fails closed on missing/invalid API key
  const savedKey = process.env.ELEVENLABS_API_KEY;
  delete process.env.ELEVENLABS_API_KEY;

  const noKeyResult = await synthesizeSpeech({ text: 'Hello test speech' });
  assert.strictEqual(noKeyResult.success, false, 'Must fail closed when API key is missing');
  assert.strictEqual(noKeyResult.reason, 'missing_api_key', 'Reason must be missing_api_key');

  // Restore key
  process.env.ELEVENLABS_API_KEY = savedKey || 'test-key';
  console.log('✅ Test 5: synthesizeSpeech handles missing API key gracefully.');

  // Test 6: synthesizeSpeech rejects empty speech text
  const emptyResult = await synthesizeSpeech({ text: '   ' });
  assert.strictEqual(emptyResult.success, false, 'Must reject empty text');
  assert.strictEqual(emptyResult.reason, 'empty_text', 'Reason must be empty_text');
  console.log('✅ Test 6: synthesizeSpeech rejects empty speech text.');

  // Test 7: /summarize voice subcommand toggles
  const voiceOnReplyEn = await handleSummarizeCommand('/summarize', ['voice', 'on'], 'user-voice-test', 'whatsapp', { lang: 'en' });
  assert.ok(voiceOnReplyEn.includes('VOICE NOTE BRIEFING ACTIVATED'), 'English voice on reply must confirm activation');

  const voiceOffReplyEn = await handleSummarizeCommand('/summarize', ['voice', 'off'], 'user-voice-test', 'whatsapp', { lang: 'en' });
  assert.ok(voiceOffReplyEn.includes('VOICE NOTE BRIEFING DEACTIVATED'), 'English voice off reply must confirm deactivation');

  const voiceOnReplyId = await handleSummarizeCommand('/ringkas', ['voice', 'on'], 'user-voice-test', 'telegram', { lang: 'id' });
  assert.ok(voiceOnReplyId.includes('AUDIO BRIEFING DIAKTIFKAN'), 'Indonesian voice on reply must confirm activation');

  const voiceInvalidReply = await handleSummarizeCommand('/summarize', ['voice', 'invalid'], 'user-voice-test', 'whatsapp', { lang: 'en' });
  assert.ok(voiceInvalidReply.includes('Invalid option'), 'Invalid option must return guidance');
  console.log('✅ Test 7: /summarize voice toggles execute with localized confirmation.');

  // Test 8: /summarize status displays voice note status
  const statusReply = await handleSummarizeCommand('/summarize', ['status'], 'user-voice-test', 'whatsapp', { lang: 'en' });
  assert.ok(statusReply.includes('Voice Note (TTS):'), 'Status output must include Voice Note line');
  console.log('✅ Test 8: /summarize status outputs Voice Note TTS status.');

  console.log('✅ All elevenLabsService & voice note tests passed successfully!\n');
}

runTests().catch((err) => {
  console.error('❌ elevenLabsService test failed:', err);
  process.exit(1);
});
