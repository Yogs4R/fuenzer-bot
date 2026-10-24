// Slack message & event dispatcher handler
// Invariant: [AD-01] Transport-agnostic, passes normalized payload to chatBufferService & dispatchCommand

const { enqueueMessage } = require('../services/chatBufferService');
const { dispatchCommand } = require('../commands/index');
const { processAiChat } = require('../commands/ai/index');
const { logCommand } = require('../services/logService');
const { getUserLanguage } = require('../services/languageService');
const { stripWrappingQuotes, convertMarkdownTablesToBullets } = require('../utils/textFormatter');

// Simple user info cache to avoid excessive Slack API rate limits
const userDisplayCache = new Map();

/**
 * Resolves user display name with in-memory caching.
 *
 * @param {Object} client - Slack web client
 * @param {string} userId - Slack user ID
 * @returns {Promise<string>}
 */
async function resolveSlackUserName(client, userId) {
  if (!userId) return 'Slack User';
  if (userDisplayCache.has(userId)) {
    return userDisplayCache.get(userId);
  }

  try {
    const res = await client.users.info({ user: userId });
    const name = res.user?.profile?.display_name || res.user?.real_name || res.user?.name || userId;
    userDisplayCache.set(userId, name);
    setTimeout(() => userDisplayCache.delete(userId), 10 * 60 * 1000); // 10 min cache
    return name;
  } catch (_) {
    return userId;
  }
}

/**
 * Parses comma-separated channel IDs from environment.
 *
 * @param {string} [envValue]
 * @returns {string[]}
 */
function getMonitoredChannels(envValue) {
  return String(envValue || '')
    .split(/[\s,;|]+/)
    .map((item) => stripWrappingQuotes(item))
    .filter(Boolean);
}

/**
 * Checks if a channel is configured for passive chat buffer monitoring.
 *
 * @param {string} channelId
 * @returns {boolean}
 */
function isChannelMonitored(channelId) {
  const configured = getMonitoredChannels(process.env.SLACK_MONITOR_CHANNELS);
  if (configured.length === 0) {
    return true; // Monitor all channels if unconfigured
  }
  return configured.includes(String(channelId).trim());
}

/**
 * Cleans Slack user mentions (<@U12345>) from raw text.
 *
 * @param {string} text
 * @returns {string}
 */
function cleanSlackMention(text) {
  return String(text || '').replace(/<@[A-Z0-9]+>/gi, '').trim();
}

/**
 * Formats plain markdown text into Slack mrkdwn.
 *
 * @param {string} text
 * @returns {string}
 */
function formatSlackMrkdwn(text) {
  if (!text || typeof text !== 'string') return '';
  const withoutTables = convertMarkdownTablesToBullets(text);

  return withoutTables
    // Convert bold **text** to *text*
    .replace(/\*\*(.*?)\*\*/g, '*$1*')
    // Convert headers ### Title to *Title*
    .replace(/^#+\s*(.*)$/gm, '*$1*')
    // Normalize asterisks bullets to hyphens
    .replace(/^\s*\*\s+/gm, '- ');
}

/**
 * Attaches Slack event listeners to Bolt App instance.
 *
 * @param {import('@slack/bolt').App} app
 */
function setupSlackBot(app) {
  if (!app) return;

  // 1. Inbound Channel & DM Messages
  app.event('message', async ({ event, client, say }) => {
    // Ignore message subtypes from bots or message deletion/edits
    if (event.bot_id || event.subtype === 'bot_message' || event.subtype === 'message_deleted') {
      return;
    }

    const rawText = String(event.text || '').trim();
    if (!rawText) return;

    const isDM = event.channel_type === 'im';
    const isChannel = !isDM;

    // Passive Group Chat Buffer Ingestion
    if (isChannel && !rawText.startsWith('/')) {
      if (isChannelMonitored(event.channel)) {
        const senderName = await resolveSlackUserName(client, event.user);
        enqueueMessage({
          platform: 'slack',
          chatId: event.channel,
          chatName: `Slack Channel ${event.channel}`,
          senderName,
          messageText: rawText
        }).catch((err) => {
          console.warn(`[slackHandler] Buffer enqueue error for ${event.channel}:`, err.message);
        });
      }
      return;
    }

    // Direct Commands in Slack
    if (rawText.startsWith('/')) {
      const parts = rawText.split(/\s+/);
      const command = parts[0].toLowerCase();
      const args = parts.slice(1);
      const userId = event.user;
      const lang = await getUserLanguage(userId, 'slack');

      await logCommand(userId, 'slack', command);

      try {
        const context = {
          lang,
          chatId: event.channel,
          quotedText: event.thread_ts ? `[Thread Message in ${event.channel}]` : '',
          notifyAdmin: async (adminText) => {
            await say({ text: formatSlackMrkdwn(`[Admin Notice]\n${adminText}`) });
          },
          sendToUser: async (targetId, userText) => {
            try {
              const dm = await client.conversations.open({ users: targetId });
              if (dm.ok && dm.channel?.id) {
                await client.chat.postMessage({
                  channel: dm.channel.id,
                  text: formatSlackMrkdwn(userText)
                });
              }
            } catch (dmErr) {
              console.warn(`[slackHandler] Could not DM Slack user ${targetId}:`, dmErr.message);
            }
          }
        };

        const dispatched = await dispatchCommand(command, args, userId, 'slack', context);

        if (dispatched !== null && dispatched !== undefined) {
          // Audio voice briefing payload
          if (typeof dispatched === 'object' && dispatched?.audio) {
            if (dispatched.message) {
              await say({ text: formatSlackMrkdwn(dispatched.message) });
            }
            try {
              console.log(`[slackHandler] Uploading audio briefing to Slack channel ${event.channel}...`);
              if (typeof client.filesUploadV2 === 'function') {
                await client.filesUploadV2({
                  channel_id: event.channel,
                  file: dispatched.audio,
                  filename: 'briefing.mp3',
                  title: 'Morning Briefing'
                });
              }
            } catch (audioErr) {
              console.error('[slackHandler] Failed to upload audio file to Slack:', audioErr.message);
            }
            return;
          }

          // Image payload
          if (typeof dispatched === 'object' && (dispatched?.type === 'image' || dispatched?.image)) {
            const caption = formatSlackMrkdwn(dispatched.caption || '');
            if (typeof client.filesUploadV2 === 'function' && dispatched.image) {
              await client.filesUploadV2({
                channel_id: event.channel,
                file: dispatched.image,
                filename: 'image.png',
                initial_comment: caption
              });
            } else {
              await say({ text: caption });
            }
            return;
          }

          const replyString = typeof dispatched === 'string' ? dispatched : (dispatched.message || '');
          if (replyString) {
            await say({ text: formatSlackMrkdwn(replyString) });
          }
        }
      } catch (cmdErr) {
        console.error(`[slackHandler] Error executing command ${command}:`, cmdErr);
        await say({ text: `⚠️ Error: ${cmdErr.message}` });
      }
      return;
    }

    // Direct Messages with AI Chat
    if (isDM) {
      try {
        const chatResult = await processAiChat(rawText, event.user, 'slack', { realId: event.user });
        await say({ text: formatSlackMrkdwn(chatResult.fullText) });
      } catch (aiErr) {
        console.error('[slackHandler] AI chat error on Slack:', aiErr);
        await say({ text: '⚠️ Failed to process conversational response.' });
      }
    }
  });

  // 2. App Mentions (@FuenzerBot ...)
  app.event('app_mention', async ({ event, client, say }) => {
    const rawText = String(event.text || '').trim();
    const cleanText = cleanSlackMention(rawText);
    if (!cleanText) return;

    if (cleanText.startsWith('/')) {
      const parts = cleanText.split(/\s+/);
      const command = parts[0].toLowerCase();
      const args = parts.slice(1);
      const userId = event.user;
      const lang = await getUserLanguage(userId, 'slack');

      const dispatched = await dispatchCommand(command, args, userId, 'slack', {
        lang,
        chatId: event.channel,
        quotedText: ''
      });

      if (dispatched) {
        const reply = typeof dispatched === 'string' ? dispatched : (dispatched.message || '');
        await say({ text: formatSlackMrkdwn(reply) });
      }
      return;
    }

    // Conversational AI response to mention
    try {
      const chatResult = await processAiChat(cleanText, event.user, 'slack', { realId: event.user });
      await say({ text: formatSlackMrkdwn(chatResult.fullText) });
    } catch (aiErr) {
      console.error('[slackHandler] AI mention error on Slack:', aiErr);
      await say({ text: '⚠️ Failed to process conversational response.' });
    }
  });

  console.log('[slackHandler] Slack event listeners registered.');
}

module.exports = {
  setupSlackBot,
  formatSlackMrkdwn,
  cleanSlackMention,
  isChannelMonitored
};
