// Discord client initialization and lifecycle manager
const { Client, GatewayIntentBits, Partials } = require('discord.js');

let discordClient = null;

/**
 * Initializes and returns the Discord client singleton.
 * Returns null if DISCORD_BOT_TOKEN is not configured in the environment.
 *
 * @returns {Client|null}
 */
function getDiscordClient() {
  if (discordClient) {
    return discordClient;
  }

  const token = process.env.DISCORD_BOT_TOKEN;
  if (!token || token.trim() === '' || token.includes('YOUR_DISCORD_BOT_TOKEN')) {
    console.warn('[discordClient] DISCORD_BOT_TOKEN is not configured. Discord adapter skipped.');
    return null;
  }

  try {
    discordClient = new Client({
      intents: [
        GatewayIntentBits.Guilds,
        GatewayIntentBits.GuildMessages,
        GatewayIntentBits.MessageContent,
        GatewayIntentBits.DirectMessages
      ],
      partials: [
        Partials.Channel,
        Partials.Message
      ]
    });

    return discordClient;
  } catch (err) {
    console.error('[discordClient] Failed to instantiate Discord Client:', err.message);
    return null;
  }
}

/**
 * Logs in and starts the Discord bot.
 *
 * @returns {Promise<Client|null>}
 */
async function startDiscordBot() {
  const client = getDiscordClient();
  if (!client) {
    return null;
  }

  try {
    await client.login(process.env.DISCORD_BOT_TOKEN);
    console.log(`[discordClient] Connected to Discord as ${client.user?.tag || 'Bot'}!`);
    return client;
  } catch (err) {
    console.error('[discordClient] Error logging in to Discord:', err.message);
    return null;
  }
}

/**
 * Gracefully shuts down the Discord client connection.
 *
 * @returns {Promise<void>}
 */
async function stopDiscordBot() {
  if (discordClient) {
    console.log('[discordClient] Destroying Discord client connection...');
    try {
      await discordClient.destroy();
    } catch (err) {
      console.warn('[discordClient] Error destroying client:', err.message);
    }
    discordClient = null;
  }
}

module.exports = {
  getDiscordClient,
  startDiscordBot,
  stopDiscordBot
};
