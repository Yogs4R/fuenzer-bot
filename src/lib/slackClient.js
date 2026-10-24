// Slack Bolt client initialization and lifecycle manager (Socket Mode)
const { App } = require('@slack/bolt');

let slackApp = null;

/**
 * Initializes and returns the Slack Bolt App singleton.
 * Returns null if SLACK_BOT_TOKEN or SLACK_APP_TOKEN is not configured.
 *
 * @returns {App|null}
 */
function getSlackApp() {
  if (slackApp) {
    return slackApp;
  }

  const botToken = process.env.SLACK_BOT_TOKEN;
  const appToken = process.env.SLACK_APP_TOKEN;

  if (
    !botToken ||
    !appToken ||
    botToken.includes('xoxb-your') ||
    appToken.includes('xapp-your')
  ) {
    console.warn('[slackClient] SLACK_BOT_TOKEN or SLACK_APP_TOKEN is not configured. Slack adapter skipped.');
    return null;
  }

  try {
    slackApp = new App({
      token: botToken,
      appToken: appToken,
      socketMode: true,
      signingSecret: process.env.SLACK_SIGNING_SECRET || 'optional-in-socket-mode'
    });

    return slackApp;
  } catch (err) {
    console.error('[slackClient] Failed to instantiate Slack App:', err.message);
    return null;
  }
}

/**
 * Starts the Slack App in Socket Mode.
 *
 * @returns {Promise<App|null>}
 */
async function startSlackBot() {
  const app = getSlackApp();
  if (!app) {
    return null;
  }

  try {
    await app.start();
    console.log('⚡ [slackClient] Slack Bolt app connected in Socket Mode!');
    return app;
  } catch (err) {
    console.error('[slackClient] Error starting Slack app in Socket Mode:', err.message);
    return null;
  }
}

/**
 * Gracefully stops the Slack Bolt App.
 *
 * @returns {Promise<void>}
 */
async function stopSlackBot() {
  if (slackApp) {
    console.log('[slackClient] Stopping Slack app connection...');
    try {
      await slackApp.stop();
    } catch (err) {
      console.warn('[slackClient] Error stopping Slack app:', err.message);
    }
    slackApp = null;
  }
}

module.exports = {
  getSlackApp,
  startSlackBot,
  stopSlackBot
};
