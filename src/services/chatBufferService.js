const supabase = require('../lib/supabaseClient');
const { encrypt, decrypt } = require('../utils/crypto');

/**
 * Validates and enqueues an incoming group message into the encrypted chat buffer.
 * Messages starting with '/' or empty strings are discarded to avoid logging bot commands.
 *
 * @param {Object} params
 * @param {string} params.platform - Messaging platform ('whatsapp', 'telegram', 'discord', 'slack')
 * @param {string} params.chatId - Group / room identifier
 * @param {string} [params.chatName] - Optional group display name
 * @param {string} [params.senderName] - Optional sender display name or pushName
 * @param {string} params.messageText - Raw message text to encrypt and buffer
 * @returns {Promise<{ queued: boolean, id?: string, reason?: string, error?: string }>}
 */
async function enqueueMessage({ platform, chatId, chatName = '', senderName = '', messageText = '' }) {
  const cleanPlatform = String(platform || '').toLowerCase().trim();
  const cleanChatId = String(chatId || '').trim();
  const rawText = String(messageText || '').trim();

  if (!cleanPlatform || !cleanChatId || !rawText) {
    return { queued: false, reason: 'missing_required_fields' };
  }

  // Never buffer bot commands (messages starting with '/')
  if (rawText.startsWith('/')) {
    return { queued: false, reason: 'bot_command_ignored' };
  }

  // Require ENCRYPTION_KEY in environment before buffering to fail closed (Codex P1 / AD-09)
  if (!process.env.ENCRYPTION_KEY) {
    console.warn('[chatBufferService] Ingestion skipped: ENCRYPTION_KEY environment variable is not configured.');
    return { queued: false, reason: 'missing_encryption_key' };
  }

  try {
    const encryptedChatName = chatName ? encrypt(String(chatName).trim()) : null;
    const encryptedSenderName = senderName ? encrypt(String(senderName).trim()) : null;
    const encryptedMessageText = encrypt(rawText);

    const { data, error } = await supabase
      .from('chat_buffer')
      .insert({
        platform: cleanPlatform,
        chat_id: cleanChatId,
        chat_name: encryptedChatName,
        sender_name: encryptedSenderName,
        message_text: encryptedMessageText,
        is_summarized: false
      })
      .select('id')
      .maybeSingle();

    if (error) {
      console.warn(`[chatBufferService] Failed to enqueue message for ${cleanPlatform}:${cleanChatId}: ${error.message}`);
      return { queued: false, error: error.message };
    }

    return { queued: true, id: data?.id };
  } catch (err) {
    console.warn(`[chatBufferService] Exception enqueuing message: ${err.message}`);
    return { queued: false, error: err.message };
  }
}

/**
 * Retrieves unsummarized messages for a specific group, decrypting the content for AI summarization.
 *
 * @param {string} platform - Messaging platform
 * @param {string} chatId - Group identifier
 * @param {Object} [options]
 * @param {number} [options.limit=100] - Max messages to retrieve
 * @returns {Promise<Array<{ id: string, platform: string, chatId: string, chatName: string, senderName: string, messageText: string, createdAt: string }>>}
 */
async function getPendingMessages(platform, chatId, options = {}) {
  const cleanPlatform = String(platform || '').toLowerCase().trim();
  const cleanChatId = String(chatId || '').trim();
  const limit = Number(options?.limit) > 0 ? Number(options.limit) : 100;

  if (!cleanPlatform || !cleanChatId) {
    return [];
  }

  try {
    const { data, error } = await supabase
      .from('chat_buffer')
      .select('id, platform, chat_id, chat_name, sender_name, message_text, created_at')
      .eq('platform', cleanPlatform)
      .eq('chat_id', cleanChatId)
      .eq('is_summarized', false)
      .order('created_at', { ascending: true })
      .limit(limit);

    if (error) {
      console.warn(`[chatBufferService] Failed to get pending messages for ${cleanPlatform}:${cleanChatId}: ${error.message}`);
      return [];
    }

    if (!Array.isArray(data)) return [];

    return data.map((row) => {
      let decryptedChatName = '';
      let decryptedSenderName = '';
      let decryptedMessageText = '';

      try {
        decryptedChatName = row.chat_name ? decrypt(row.chat_name) : '';
      } catch (_) {
        decryptedChatName = '[Decryption Failed]';
      }

      try {
        decryptedSenderName = row.sender_name ? decrypt(row.sender_name) : '';
      } catch (_) {
        decryptedSenderName = '[Decryption Failed]';
      }

      try {
        decryptedMessageText = row.message_text ? decrypt(row.message_text) : '';
      } catch (_) {
        decryptedMessageText = '[Decryption Failed]';
      }

      return {
        id: row.id,
        platform: row.platform,
        chatId: row.chat_id,
        chatName: decryptedChatName,
        senderName: decryptedSenderName,
        messageText: decryptedMessageText,
        createdAt: row.created_at
      };
    });
  } catch (err) {
    console.warn(`[chatBufferService] Exception retrieving pending messages: ${err.message}`);
    return [];
  }
}

/**
 * Marks messages as summarized by their IDs once processed by the AI summarizer.
 *
 * @param {string[]} ids - Array of message UUIDs
 * @returns {Promise<{ updated: boolean, count: number }>}
 */
async function markMessagesAsSummarized(ids = []) {
  if (!Array.isArray(ids) || ids.length === 0) {
    return { updated: false, count: 0 };
  }

  try {
    const { data, error } = await supabase
      .from('chat_buffer')
      .update({ is_summarized: true })
      .in('id', ids)
      .select('id');

    if (error) {
      console.warn(`[chatBufferService] Failed to mark messages as summarized: ${error.message}`);
      return { updated: false, count: 0 };
    }

    return { updated: true, count: data?.length || ids.length };
  } catch (err) {
    console.warn(`[chatBufferService] Exception marking messages summarized: ${err.message}`);
    return { updated: false, count: 0 };
  }
}

/**
 * Purges expired messages following the architectural retention policy [AD-05]:
 * - Summarized messages older than 24 hours (grace period expired).
 * - Unsummarized inactive messages older than 7 days (stale buffer TTL).
 *
 * @returns {Promise<{ success: boolean, purgedSummarized: number, purgedStale: number }>}
 */
async function purgeExpiredBuffer() {
  const cutoff24h = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
  const cutoff7d = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();

  let purgedSummarized = 0;
  let purgedStale = 0;

  try {
    // 1. Purge summarized messages older than 24h
    const { data: sumData, error: sumErr } = await supabase
      .from('chat_buffer')
      .delete()
      .eq('is_summarized', true)
      .lt('created_at', cutoff24h)
      .select('id');

    if (sumErr) {
      console.warn(`[chatBufferService] Error purging summarized messages: ${sumErr.message}`);
    } else {
      purgedSummarized = sumData?.length || 0;
    }

    // 2. Purge stale unsummarized messages older than 7 days
    const { data: staleData, error: staleErr } = await supabase
      .from('chat_buffer')
      .delete()
      .eq('is_summarized', false)
      .lt('created_at', cutoff7d)
      .select('id');

    if (staleErr) {
      console.warn(`[chatBufferService] Error purging stale messages: ${staleErr.message}`);
    } else {
      purgedStale = staleData?.length || 0;
    }

    return { success: true, purgedSummarized, purgedStale };
  } catch (err) {
    console.warn(`[chatBufferService] Exception during buffer purge: ${err.message}`);
    return { success: false, purgedSummarized, purgedStale };
  }
}

/**
 * Fetches user or group summarization settings.
 *
 * @param {string} userId - User or group ID
 * @param {string} platform - 'whatsapp' | 'telegram'
 * @returns {Promise<Object|null>}
 */
async function getUserSummarizeSettings(userId, platform) {
  const cleanUser = String(userId || '').trim();
  const cleanPlatform = String(platform || '').toLowerCase().trim();

  if (!cleanUser || !cleanPlatform) return null;

  try {
    const { data, error } = await supabase
      .from('user_summarize_settings')
      .select('*')
      .eq('user_id', cleanUser)
      .eq('platform', cleanPlatform)
      .maybeSingle();

    if (error) {
      console.warn(`[chatBufferService] Failed to get summarize settings for ${cleanUser}: ${error.message}`);
      return null;
    }

    return data || null;
  } catch (err) {
    console.warn(`[chatBufferService] Exception getting summarize settings: ${err.message}`);
    return null;
  }
}

/**
 * Resolves monitored group IDs for a platform.
 * If targetId is provided and represents a group, returns [targetId].
 * Otherwise, queries chat_buffer for distinct group IDs having unsummarized messages.
 *
 * @param {string} platform - 'whatsapp' | 'telegram'
 * @param {string} [targetId] - Optional target chat/user ID
 * @returns {Promise<string[]>}
 */
async function resolveMonitoredGroupIds(platform, targetId = null) {
  const cleanPlatform = String(platform || '').toLowerCase().trim();
  const cleanTarget = String(targetId || '').trim();

  // If targetId is already an explicit group identifier (WA @g.us or TG negative ID)
  if (cleanTarget && (cleanTarget.includes('@g.us') || cleanTarget.startsWith('-'))) {
    return [cleanTarget];
  }

  try {
    const { data, error } = await supabase
      .from('chat_buffer')
      .select('chat_id')
      .eq('platform', cleanPlatform)
      .eq('is_summarized', false);

    if (error) {
      console.warn(`[chatBufferService] Error resolving group IDs for ${cleanPlatform}: ${error.message}`);
      return [];
    }

    if (!Array.isArray(data) || data.length === 0) {
      return [];
    }

    const uniqueIds = [...new Set(data.map((r) => r.chat_id).filter(Boolean))];
    return uniqueIds;
  } catch (err) {
    console.warn(`[chatBufferService] Exception resolving group IDs: ${err.message}`);
    return [];
  }
}

/**
 * Upserts user or group summarization settings.
 * Merges with existing settings to preserve schedule_time and other options when toggling.
 *
 * @param {string} userId
 * @param {string} platform
 * @param {Object} settings
 * @returns {Promise<boolean>}
 */
async function upsertUserSummarizeSettings(userId, platform, settings = {}) {
  const cleanUser = String(userId || '').trim();
  const cleanPlatform = String(platform || '').toLowerCase().trim();

  if (!cleanUser || !cleanPlatform) return false;

  try {
    const existing = await getUserSummarizeSettings(cleanUser, cleanPlatform);

    const payload = {
      user_id: cleanUser,
      platform: cleanPlatform,
      is_active: settings.isActive !== undefined ? settings.isActive : (existing?.is_active ?? true),
      schedule_time: settings.scheduleTime || existing?.schedule_time || '08:00',
      voice_note_enabled: settings.voiceNoteEnabled !== undefined ? settings.voiceNoteEnabled : (existing?.voice_note_enabled ?? true),
      language: settings.language || existing?.language || 'en'
    };

    const { error } = await supabase
      .from('user_summarize_settings')
      .upsert(payload);

    if (error) {
      console.warn(`[chatBufferService] Failed to upsert summarize settings for ${cleanUser}: ${error.message}`);
      return false;
    }

    return true;
  } catch (err) {
    console.warn(`[chatBufferService] Exception upserting summarize settings: ${err.message}`);
    return false;
  }
}

module.exports = {
  enqueueMessage,
  getPendingMessages,
  markMessagesAsSummarized,
  purgeExpiredBuffer,
  getUserSummarizeSettings,
  upsertUserSummarizeSettings,
  resolveMonitoredGroupIds
};
