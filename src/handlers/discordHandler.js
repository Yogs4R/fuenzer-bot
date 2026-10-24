// Discord message & event dispatcher handler
// Invariant: [AD-01] Transport-agnostic, passes normalized payload to chatBufferService & dispatchCommand

const { AttachmentBuilder } = require('discord.js');
const { enqueueMessage } = require('../services/chatBufferService');
const { dispatchCommand } = require('../commands/index');
const { processAiChat } = require('../commands/ai/index');
const { logCommand } = require('../services/logService');
const { getUserLanguage } = require('../services/languageService');
const { stripWrappingQuotes } = require('../utils/textFormatter');

/**
 * Splits a long text into chunks compatible with Discord's 2000 character message limit.
 *
 * @param {string} text - Message text
 * @param {number} [maxLength=1950] - Maximum length per chunk
 * @returns {string[]}
 */
function chunkDiscordText(text, maxLength = 1950) {
  const content = String(text || '').trim();
  if (content.length <= maxLength) return [content];

  const chunks = [];
  let remaining = content;

  while (remaining.length > 0) {
    if (remaining.length <= maxLength) {
      chunks.push(remaining);
      break;
    }

    let splitIndex = remaining.lastIndexOf('\n', maxLength);
    if (splitIndex === -1 || splitIndex < maxLength * 0.5) {
      splitIndex = remaining.lastIndexOf(' ', maxLength);
    }
    if (splitIndex === -1 || splitIndex < maxLength * 0.5) {
      splitIndex = maxLength;
    }

    chunks.push(remaining.slice(0, splitIndex).trim());
    remaining = remaining.slice(splitIndex).trim();
  }

  return chunks;
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
  const configured = getMonitoredChannels(process.env.DISCORD_MONITOR_CHANNELS);
  if (configured.length === 0) {
    return true; // Monitor all channels if unconfigured
  }
  return configured.includes(String(channelId).trim());
}

/**
 * Cleans the bot mention from message content.
 *
 * @param {string} text
 * @param {string} botUserId
 * @returns {string}
 */
function cleanBotMention(text, botUserId) {
  if (!text) return '';
  const mentionRegex = new RegExp(`<@!?${botUserId}>`, 'g');
  return text.replace(mentionRegex, '').trim();
}

/**
 * Sends a reply message with chunking support.
 *
 * @param {Object} message - Discord Message instance
 * @param {string} text - Reply text
 */
async function sendDiscordReply(message, text) {
  const chunks = chunkDiscordText(text);
  for (const chunk of chunks) {
    if (chunk) {
      await message.channel.send(chunk);
    }
  }
}

/**
 * Attaches event listeners to the Discord client.
 *
 * @param {import('discord.js').Client} client
 */
function setupDiscordBot(client) {
  if (!client) return;

  client.on('messageCreate', async (message) => {
    // Ignore messages from other bots or self
    if (message.author.bot) return;

    const rawText = String(message.content || '').trim();
    if (!rawText) return;

    const isGuild = Boolean(message.guild);
    const botUser = client.user;
    const isBotMentioned = botUser ? message.mentions.has(botUser) : false;
    const isDM = !isGuild;

    // 1. Passive Group Chat Buffer Ingestion
    if (isGuild && !rawText.startsWith('/') && !isBotMentioned) {
      if (isChannelMonitored(message.channel.id)) {
        enqueueMessage({
          platform: 'discord',
          chatId: message.channel.id,
          chatName: message.guild.name || message.channel.name || 'Discord Channel',
          senderName: message.member?.displayName || message.author.username || 'Discord User',
          messageText: rawText
        }).catch((err) => {
          console.warn(`[discordHandler] Buffer enqueue error for ${message.channel.id}:`, err.message);
        });
      }
      return;
    }

    // 2. Command Execution (/cmd)
    if (rawText.startsWith('/')) {
      const parts = rawText.split(/\s+/);
      const command = parts[0].toLowerCase();
      const args = parts.slice(1);
      const userId = message.author.id;
      const lang = await getUserLanguage(userId, 'discord');

      await logCommand(userId, 'discord', command);

      try {
        const context = {
          lang,
          chatId: message.channel.id,
          isGroup: isGuild,
          guildId: message.guild?.id || null,
          quotedText: message.reference ? `[Referenced Message in ${message.channel.id}]` : '',
          notifyAdmin: async (textToAdmin) => {
            await sendDiscordReply(message, `[Admin Notice]\n${textToAdmin}`);
          },
          sendToUser: async (targetId, textToSend) => {
            try {
              const targetUser = await client.users.fetch(targetId);
              if (targetUser) {
                await targetUser.send(String(textToSend || ''));
              }
            } catch (dmErr) {
              console.warn(`[discordHandler] Could not DM user ${targetId}:`, dmErr.message);
            }
          }
        };

        const dispatched = await dispatchCommand(command, args, userId, 'discord', context);

        if (dispatched !== null && dispatched !== undefined) {
          // Audio voice briefing payload
          if (typeof dispatched === 'object' && dispatched?.audio) {
            if (dispatched.message) {
              await sendDiscordReply(message, dispatched.message);
            }
            try {
              console.log(`[discordHandler] Sending audio briefing to Discord channel ${message.channel.id}...`);
              const fileAttachment = new AttachmentBuilder(dispatched.audio, { name: 'briefing.mp3' });
              await message.channel.send({
                files: [fileAttachment]
              });
            } catch (audioErr) {
              console.error('[discordHandler] Failed to send audio file to Discord:', audioErr.message);
            }
            return;
          }

          // Image payload
          if (typeof dispatched === 'object' && (dispatched?.type === 'image' || dispatched?.image)) {
            const rawAttachment = dispatched.image || dispatched.url;
            const fileAttachment = rawAttachment ? new AttachmentBuilder(rawAttachment, { name: 'image.png' }) : null;
            await message.channel.send({
              content: dispatched.caption || '',
              files: fileAttachment ? [fileAttachment] : []
            });
            return;
          }

          const replyString = typeof dispatched === 'string' ? dispatched : (dispatched.message || '');
          if (replyString) {
            await sendDiscordReply(message, replyString);
          }
        }
      } catch (cmdErr) {
        console.error(`[discordHandler] Error executing command ${command}:`, cmdErr);
        await sendDiscordReply(message, `⚠️ Error: ${cmdErr.message}`);
      }
      return;
    }

    // 3. Conversational AI Chat via AI Agent Harness (In DMs or @mentions)
    if (isDM || isBotMentioned) {
      const cleanedInput = isBotMentioned ? cleanBotMention(rawText, botUser?.id) : rawText;
      if (!cleanedInput) return;

      const userId = message.author.id;
      try {
        await message.channel.sendTyping().catch(() => {});
        const chatResult = await processAiChat(cleanedInput, userId, 'discord', { realId: userId });
        await sendDiscordReply(message, chatResult.fullText);
      } catch (aiErr) {
        console.error('[discordHandler] AI chat error on Discord:', aiErr);
        await sendDiscordReply(message, '⚠️ Failed to process conversational response.');
      }
    }
  });

  console.log('[discordHandler] Discord event listeners registered.');
}

module.exports = {
  setupDiscordBot,
  chunkDiscordText,
  isChannelMonitored,
  cleanBotMention
};
