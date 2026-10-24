const assert = require('assert');
const {
  convertMarkdownTablesToBullets,
  formatTelegramHtml
} = require('../src/utils/textFormatter');
const { extractSlothTldr } = require('../src/services/elevenLabsService');
const {
  chunkDiscordText,
  cleanBotMention,
  isChannelMonitored: isDiscordChannelMonitored
} = require('../src/handlers/discordHandler');
const {
  formatSlackMrkdwn,
  cleanSlackMention,
  isChannelMonitored: isSlackChannelMonitored
} = require('../src/handlers/slackHandler');
const { getDiscordClient } = require('../src/lib/discordClient');
const { getSlackApp } = require('../src/lib/slackClient');
const { isAdmin } = require('../src/utils/auth');

console.log('--- Running Omnichannel & Post-Phase 6 Tests ---');

async function runTests() {
  // Test 1: convertMarkdownTablesToBullets converts table rows into mobile-friendly bullet points
  const markdownTable = [
    'Here is the report:',
    '| Item | Price | Status |',
    '|---|---|---|',
    '| Coffee | $4 | Done |',
    '| Tea | $3 | Pending |',
    'Hope this helps!'
  ].join('\n');

  const converted = convertMarkdownTablesToBullets(markdownTable);
  assert.ok(!converted.includes('| Item | Price |'), 'Headers table row must be converted');
  assert.ok(!converted.includes('|---|---|'), 'Table separator must be removed');
  assert.ok(converted.includes('- Item: Coffee | Price: $4 | Status: Done'), 'Row 1 must be formatted as a bullet point');
  assert.ok(converted.includes('- Item: Tea | Price: $3 | Status: Pending'), 'Row 2 must be formatted as a bullet point');
  console.log('✅ Test 1: convertMarkdownTablesToBullets works cleanly.');

  // Test 2: formatTelegramHtml eliminates markdown tables and handles **bold** without stray asterisks
  const tgInput = 'Summary:\n| Name | Val |\n|---|---|\n| Alpha | 10 |\nThis is **very bold** and *italic* with * bullet item';
  const tgHtml = formatTelegramHtml(tgInput);
  assert.ok(!tgHtml.includes('| Name |'), 'Markdown tables must be stripped in Telegram HTML');
  assert.ok(tgHtml.includes('<b>very bold</b>'), 'Double asterisks must be converted to <b>');
  assert.ok(!tgHtml.includes('**'), 'No raw double asterisks should remain');
  assert.ok(!tgHtml.includes('*<b>'), 'No stray outer asterisk on bold conversion');
  console.log('✅ Test 2: formatTelegramHtml bold & table handling verified.');

  // Test 3: extractSlothTldr accurately captures executive summary across diverse heading formats
  const summaryEn = `
1. 🦥 *Sloth TL;DR*
The team had a productive morning discussing sprint goals and deploying the release.

2. 🎯 *Key Action Items & Mentions*
- Review pull request by 3pm
`;
  const tldrEn = extractSlothTldr(summaryEn);
  assert.ok(tldrEn.includes('productive morning'), 'Must extract English TL;DR section');

  const summaryId = `
*1. 🦥 Ringkasan Santai:*
Grup pagi ini cukup santai membicarakan rencana akhir pekan dan progres fitur bot.

*2. 🎯 Poin Tindakan:*
- Cek server monitor jam 12
`;
  const tldrId = extractSlothTldr(summaryId);
  assert.ok(tldrId.includes('Grup pagi ini cukup santai'), 'Must extract Indonesian TL;DR with leading asterisks');
  console.log('✅ Test 3: extractSlothTldr heading resilience verified.');

  // Test 4: Discord utility functions (chunking, channel filtering, mention stripping)
  const longText = 'a'.repeat(2500);
  const chunks = chunkDiscordText(longText, 1000);
  assert.ok(chunks.length >= 3, 'Text longer than limit must be split into multiple chunks');

  const mentionRaw = 'Hello <@123456789>, check balance';
  const mentionCleaned = cleanBotMention(mentionRaw, '123456789');
  assert.strictEqual(mentionCleaned, 'Hello , check balance', 'Bot mention must be stripped');

  // Channel monitoring unconfigured defaults to true (monitor all)
  const isDefaultMonitored = isDiscordChannelMonitored('99999999');
  assert.strictEqual(isDefaultMonitored, true, 'Unconfigured channel filter should allow all channels');
  console.log('✅ Test 4: Discord utility functions verified.');

  // Test 5: Slack utility functions (mrkdwn formatting, mention stripping)
  const slackInput = '## Announcement\nHere is **bold** text and:\n| Task | Owner |\n|---|---|\n| QA | Alice |';
  const slackFormatted = formatSlackMrkdwn(slackInput);
  assert.ok(slackFormatted.includes('*Announcement*'), 'Header converted to Slack bold');
  assert.ok(slackFormatted.includes('*bold*'), 'Double asterisks converted to Slack single asterisk bold');
  assert.ok(!slackFormatted.includes('| Task |'), 'Table converted to bullet points');
  assert.ok(slackFormatted.includes('- Task: QA | Owner: Alice'), 'Table row rendered as bullet');

  const slackMentionClean = cleanSlackMention('<@U12345ABC> /saldo');
  assert.strictEqual(slackMentionClean, '/saldo', 'Slack user mention must be stripped');
  console.log('✅ Test 5: Slack utility functions verified.');

  // Test 6: Admin authorization for Discord and Slack
  process.env.ADMIN_DISCORD_IDS = '111222333,444555666';
  process.env.ADMIN_SLACK_IDS = 'U999888,U777666';

  assert.strictEqual(isAdmin('111222333', 'discord'), true, 'Discord admin must be authorized');
  assert.strictEqual(isAdmin('999999999', 'discord'), false, 'Non-admin Discord user must be rejected');
  assert.strictEqual(isAdmin('U999888', 'slack'), true, 'Slack admin must be authorized');
  assert.strictEqual(isAdmin('U000000', 'slack'), false, 'Non-admin Slack user must be rejected');
  console.log('✅ Test 6: Admin authorization for Discord and Slack verified.');

  // Test 7: Non-blocking client fallback when credentials are not configured
  const originalDiscordToken = process.env.DISCORD_BOT_TOKEN;
  const originalSlackToken = process.env.SLACK_BOT_TOKEN;
  delete process.env.DISCORD_BOT_TOKEN;
  delete process.env.SLACK_BOT_TOKEN;

  const discordInstance = getDiscordClient();
  const slackInstance = getSlackApp();

  assert.strictEqual(discordInstance, null, 'Discord client must gracefully return null if token is missing');
  assert.strictEqual(slackInstance, null, 'Slack client must gracefully return null if token is missing');

  process.env.DISCORD_BOT_TOKEN = originalDiscordToken;
  process.env.SLACK_BOT_TOKEN = originalSlackToken;
  console.log('✅ Test 7: Non-blocking graceful startup without tokens verified.');

  console.log('🎉 All Omnichannel & Post-Phase 6 tests passed successfully!');
}

runTests().catch((err) => {
  console.error('❌ Omnichannel tests failed:', err);
  process.exit(1);
});
