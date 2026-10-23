const cron = require('node-cron');
const supabase = require('../lib/supabaseClient');
const { generateGroupSummary } = require('../services/summarizeService');
const { formatWhatsAppReply } = require('../handlers/adapters/waMediaAdapter');
const { formatTelegramHtml, formatBodyBold } = require('../utils/textFormatter');
const { t } = require('../utils/i18n');

/**
 * Starts the automated morning briefing cron job.
 * Checks active schedules in user_summarize_settings every minute and delivers
 * the Sloth Morning Briefing to the designated recipient.
 *
 * @param {Function|Object} getWaSocket - Getter for active WhatsApp socket
 * @param {Object} [telegramBot] - Telegraf bot instance
 * @returns {cron.ScheduledTask}
 */
function startSummarizeCron(getWaSocket, telegramBot = null) {
  const task = cron.schedule('* * * * *', async () => {
    try {
      const now = new Date();
      const currentHours = String(now.getHours()).padStart(2, '0');
      const currentMinutes = String(now.getMinutes()).padStart(2, '0');
      const currentTimeStr = `${currentHours}:${currentMinutes}`;

      const { data: activeSettings, error } = await supabase
        .from('user_summarize_settings')
        .select('*')
        .eq('is_active', true)
        .eq('schedule_time', currentTimeStr);

      if (error) {
        if (error.code !== 'PGRST116' && !error.message.includes('schema cache')) {
          console.warn('[summarizeCron] Error fetching active summarize settings:', error.message);
        }
        return;
      }

      if (!Array.isArray(activeSettings) || activeSettings.length === 0) {
        return;
      }

      for (const setting of activeSettings) {
        const userId = setting.user_id;
        const platform = setting.platform;
        const language = setting.language || 'en';

        // Check if already executed in the same minute
        if (setting.last_run_at) {
          const lastRun = new Date(setting.last_run_at);
          if (
            lastRun.getFullYear() === now.getFullYear() &&
            lastRun.getMonth() === now.getMonth() &&
            lastRun.getDate() === now.getDate() &&
            lastRun.getHours() === now.getHours() &&
            lastRun.getMinutes() === now.getMinutes()
          ) {
            continue;
          }
        }

        console.log(`[summarizeCron] Triggering morning briefing for ${platform}:${userId} at ${currentTimeStr}...`);

        try {
          const summaryResult = await generateGroupSummary({
            platform,
            chatId: userId,
            language
          });

          if (!summaryResult.success) {
            console.log(`[summarizeCron] Summary skipped for ${platform}:${userId}: ${summaryResult.reason || summaryResult.error}`);
            // Still update last_run_at so we don't spam checks in the same minute
            await supabase
              .from('user_summarize_settings')
              .update({ last_run_at: now.toISOString() })
              .eq('user_id', userId)
              .eq('platform', platform);
            continue;
          }

          const header = t('summarize.briefing_header', {}, language);
          const fullBriefingText = `${header}\n\n${summaryResult.summaryText}`;

          if (platform === 'whatsapp') {
            const sock = typeof getWaSocket === 'function' ? getWaSocket() : getWaSocket;
            if (sock) {
              const formattedReply = formatWhatsAppReply(fullBriefingText);
              await sock.sendMessage(userId, { text: formattedReply });
              console.log(`[summarizeCron] WhatsApp briefing delivered to ${userId}.`);
            }
          } else if (platform === 'telegram' && telegramBot) {
            const chatId = Number(userId);
            if (Number.isFinite(chatId)) {
              const formattedHtml = formatBodyBold(formatTelegramHtml(fullBriefingText));
              await telegramBot.telegram.sendMessage(chatId, formattedHtml, { parse_mode: 'HTML' });
              console.log(`[summarizeCron] Telegram briefing delivered to ${chatId}.`);
            }
          }

          // Update last_run_at
          await supabase
            .from('user_summarize_settings')
            .update({ last_run_at: now.toISOString() })
            .eq('user_id', userId)
            .eq('platform', platform);
        } catch (jobErr) {
          console.error(`[summarizeCron] Failed to process briefing for ${platform}:${userId}:`, jobErr.message);
        }
      }
    } catch (err) {
      console.error('[summarizeCron] General error during summarize cron:', err.message);
    }
  });

  console.log('[summarizeCron] Scheduled morning briefing cron started (checking every minute).');
  return task;
}

module.exports = {
  startSummarizeCron
};
