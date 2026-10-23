const cron = require('node-cron');
const { purgeExpiredBuffer } = require('../services/chatBufferService');

/**
 * Starts the automated chat buffer cleanup cron job.
 * Executes daily at 03:00 server time to enforce the architectural retention policy [AD-05]:
 * - Purges summarized group messages after the 24-hour grace period.
 * - Purges inactive unsummarized messages older than 7 days (fallback TTL).
 *
 * @returns {cron.ScheduledTask}
 */
function startBufferCleanupCron() {
  const task = cron.schedule('0 3 * * *', async () => {
    try {
      console.log('[CRON] Running daily chat buffer retention cleanup...');
      const result = await purgeExpiredBuffer();
      console.log(`[CRON] Chat buffer retention cleanup finished. Purged: ${result.purgedSummarized} summarized (24h+), ${result.purgedStale} stale unsummarized (7d+).`);
    } catch (err) {
      console.error('[CRON] Error during chat buffer cleanup cron:', err.message);
    }
  });

  console.log('[CRON] Buffer retention cleanup cron started (scheduled daily at 03:00).');
  return task;
}

module.exports = {
  startBufferCleanupCron
};
