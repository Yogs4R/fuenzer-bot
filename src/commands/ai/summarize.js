const {
  getUserSummarizeSettings,
  upsertUserSummarizeSettings,
  getPendingMessages,
  markMessagesAsSummarized,
  resolveMonitoredGroupIds
} = require('../../services/chatBufferService');
const { generateGroupSummary, DEFAULT_GEMMA_MODEL } = require('../../services/summarizeService');
const { extractSlothTldr, synthesizeSpeech } = require('../../services/elevenLabsService');
const { t } = require('../../utils/i18n');

/**
 * Validates a 24-hour time string in format HH:mm.
 *
 * @param {string} timeStr
 * @returns {boolean}
 */
function isValidScheduleTime(timeStr) {
  if (typeof timeStr !== 'string') return false;
  const match = timeStr.trim().match(/^([01]\d|2[0-3]):([0-5]\d)$/);
  return Boolean(match);
}

/**
 * Modular command handler for /summarize and /ringkas.
 *
 * @param {string} command - '/summarize' or '/ringkas'
 * @param {Array<string>} args - Command arguments
 * @param {string} userId - User identifier (WhatsApp JID or Telegram ID)
 * @param {string} platform - 'whatsapp' | 'telegram'
 * @param {Object} [context] - Context with lang, quotedText, etc.
 * @returns {Promise<string|Object>}
 */
async function handleSummarizeCommand(command, args = [], userId = '', platform = 'whatsapp', context = {}) {
  const lang = context.lang || 'en';
  const subCommand = String(args[0] || '').toLowerCase().trim();
  const targetChatId = context.chatId || userId;

  switch (subCommand) {
    case 'on':
    case 'aktif': {
      await upsertUserSummarizeSettings(userId, platform, {
        isActive: true,
        language: lang
      });
      const settings = await getUserSummarizeSettings(userId, platform);
      const scheduleTime = settings?.schedule_time || '08:00';
      return t('summarize.enabled', { time: scheduleTime }, lang);
    }

    case 'off':
    case 'nonaktif': {
      await upsertUserSummarizeSettings(userId, platform, {
        isActive: false
      });
      return t('summarize.disabled', {}, lang);
    }

    case 'schedule':
    case 'jadwal': {
      const timeInput = String(args[1] || '').trim();
      if (!timeInput || !isValidScheduleTime(timeInput)) {
        return t('summarize.invalid_schedule', {}, lang);
      }

      await upsertUserSummarizeSettings(userId, platform, {
        scheduleTime: timeInput,
        isActive: true,
        language: lang
      });

      return t('summarize.schedule_updated', { time: timeInput }, lang);
    }

    case 'voice':
    case 'vn':
    case 'suara': {
      const mode = String(args[1] || '').toLowerCase().trim();
      if (mode === 'on' || mode === 'aktif') {
        await upsertUserSummarizeSettings(userId, platform, {
          voiceNoteEnabled: true,
          language: lang
        });
        return t('summarize.voice_enabled', {}, lang);
      }
      if (mode === 'off' || mode === 'nonaktif') {
        await upsertUserSummarizeSettings(userId, platform, {
          voiceNoteEnabled: false,
          language: lang
        });
        return t('summarize.voice_disabled', {}, lang);
      }
      return t('summarize.invalid_voice_option', {}, lang);
    }

    case 'now':
    case 'sekarang': {
      let chatIdToSummarize = targetChatId;
      // If run in private DM (targetChatId === userId), resolve active group IDs
      if (targetChatId === userId && !userId.includes('@g.us') && !userId.startsWith('-')) {
        const candidateGroups = await resolveMonitoredGroupIds(platform, userId);
        if (candidateGroups.length > 0) {
          chatIdToSummarize = candidateGroups[0];
        }
      }

      const summaryResult = await generateGroupSummary({
        platform,
        chatId: chatIdToSummarize,
        language: lang,
        autoMarkSummarized: false
      });

      if (!summaryResult.success) {
        if (summaryResult.reason === 'no_messages') {
          return t('summarize.no_messages', {}, lang);
        }
        return t('summarize.error_failed', { error: summaryResult.error || 'Unknown error' }, lang);
      }

      // Mark processed messages as summarized only after successful summary generation
      if (summaryResult.messageIds?.length > 0) {
        await markMessagesAsSummarized(summaryResult.messageIds);
      }

      const header = t('summarize.briefing_header', {}, lang);
      const fullText = `${header}\n\n${summaryResult.summaryText}`;

      // Synthesize audio voice note if user has voice enabled and ElevenLabs key is configured
      const settings = await getUserSummarizeSettings(userId, platform);
      const isVoiceActive = Boolean(settings?.voice_note_enabled);

      if (isVoiceActive && process.env.ELEVENLABS_API_KEY && process.env.ELEVENLABS_API_KEY !== 'YOUR_ELEVENLABS_API_KEY') {
        try {
          const tldrText = extractSlothTldr(summaryResult.summaryText);
          if (tldrText) {
            const ttsResult = await synthesizeSpeech({ text: tldrText });
            if (ttsResult.success && ttsResult.audioBuffer) {
              return {
                message: fullText,
                audio: ttsResult.audioBuffer,
                mimetype: ttsResult.mimeType || 'audio/mpeg',
                ptt: false
              };
            }
          }
        } catch (voiceErr) {
          console.warn('[summarizeCommand] Voice synthesis failed for /summarize now:', voiceErr.message);
        }
      }

      return fullText;
    }

    case 'status':
    default: {
      const settings = await getUserSummarizeSettings(userId, platform);

      let bufferChatId = targetChatId;
      if (targetChatId === userId && !userId.includes('@g.us') && !userId.startsWith('-')) {
        const candidateGroups = await resolveMonitoredGroupIds(platform, userId);
        if (candidateGroups.length > 0) {
          bufferChatId = candidateGroups[0];
        }
      }

      const pendingMessages = await getPendingMessages(platform, bufferChatId, { limit: 500 });
      const isActive = settings?.is_active ?? false;
      const scheduleTime = settings?.schedule_time || '08:00';
      const isVoiceActive = settings?.voice_note_enabled ?? true;
      const activeModel = process.env.GEMMA_MODEL || DEFAULT_GEMMA_MODEL;

      const header = t('summarize.status_header', {}, lang);
      const statusLine = t('summarize.status_active', { status: isActive ? 'ON (Active)' : 'OFF (Inactive)' }, lang);
      const scheduleLine = t('summarize.status_schedule', { time: scheduleTime }, lang);
      const voiceLine = t('summarize.status_voice', { status: isVoiceActive ? 'ON' : 'OFF' }, lang);
      const countLine = t('summarize.status_buffer_count', { count: pendingMessages.length }, lang);
      const modelLine = t('summarize.status_model', { model: activeModel }, lang);
      const footer = t('summarize.status_footer', {}, lang);

      return [header, '', statusLine, scheduleLine, voiceLine, countLine, modelLine, '', footer].join('\n');
    }
  }
}

module.exports = {
  handleSummarizeCommand,
  isValidScheduleTime
};
