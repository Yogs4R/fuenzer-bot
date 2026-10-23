const supabase = require('../lib/supabaseClient');
const { DEFAULT_LANGUAGE, isValidLanguage, normalizeLanguage } = require('../utils/i18n');

// In-memory cache for fast lookups without hammering Supabase on every message
const languageCache = new Map();

function buildCacheKey(userId, platform) {
  const normalizedUser = String(userId || '').trim();
  const normalizedPlatform = String(platform || '').trim().toLowerCase();
  return `${normalizedPlatform}:${normalizedUser}`;
}

/**
 * Get user's preferred language ('en' | 'id')
 * Checks in-memory cache first, falls back to Supabase user_preferences table,
 * and defaults to 'en' if unconfigured or database is unreachable.
 *
 * @param {string} userId - User identifier (WhatsApp JID or Telegram ID)
 * @param {string} platform - 'whatsapp' | 'telegram'
 * @returns {Promise<string>}
 */
async function getUserLanguage(userId, platform) {
  const cacheKey = buildCacheKey(userId, platform);

  if (languageCache.has(cacheKey)) {
    return languageCache.get(cacheKey);
  }

  const normalizedUser = String(userId || '').trim();
  const normalizedPlatform = String(platform || '').trim().toLowerCase();

  if (!normalizedUser || !normalizedPlatform) {
    return DEFAULT_LANGUAGE;
  }

  try {
    const { data, error } = await supabase
      .from('user_preferences')
      .select('language')
      .eq('user_id', normalizedUser)
      .eq('platform', normalizedPlatform)
      .maybeSingle();

    if (error && error.code !== 'PGRST116') {
      // Gracefully handle missing column or table connectivity issues
      console.warn(`[languageService] Unable to read language preference for ${cacheKey}: ${error.message}`);
      languageCache.set(cacheKey, DEFAULT_LANGUAGE);
      return DEFAULT_LANGUAGE;
    }

    const savedLang = String(data?.language || '').trim().toLowerCase();
    const resolvedLang = isValidLanguage(savedLang) ? savedLang : DEFAULT_LANGUAGE;

    languageCache.set(cacheKey, resolvedLang);
    return resolvedLang;
  } catch (err) {
    console.warn(`[languageService] Exception fetching language preference for ${cacheKey}:`, err.message);
    languageCache.set(cacheKey, DEFAULT_LANGUAGE);
    return DEFAULT_LANGUAGE;
  }
}

/**
 * Save user's preferred language ('en' | 'id')
 * Updates in-memory cache immediately and persists to Supabase.
 *
 * @param {string} userId - User identifier
 * @param {string} platform - 'whatsapp' | 'telegram'
 * @param {string} lang - 'en' | 'id'
 * @returns {Promise<string>} The active language code
 */
async function setUserLanguage(userId, platform, lang) {
  const resolvedLang = normalizeLanguage(lang);
  const cacheKey = buildCacheKey(userId, platform);
  const normalizedUser = String(userId || '').trim();
  const normalizedPlatform = String(platform || '').trim().toLowerCase();

  // Optimistically set in-memory cache
  languageCache.set(cacheKey, resolvedLang);

  if (!normalizedUser || !normalizedPlatform) {
    return resolvedLang;
  }

  try {
    const { data: existing, error: checkError } = await supabase
      .from('user_preferences')
      .select('user_id')
      .eq('user_id', normalizedUser)
      .eq('platform', normalizedPlatform)
      .maybeSingle();

    if (checkError && checkError.code !== 'PGRST116') {
      console.warn(`[languageService] Error checking existing user preference: ${checkError.message}`);
      return resolvedLang;
    }

    if (existing) {
      const { error: updateError } = await supabase
        .from('user_preferences')
        .update({ language: resolvedLang })
        .eq('user_id', normalizedUser)
        .eq('platform', normalizedPlatform);

      if (updateError) {
        console.warn(`[languageService] Error updating language preference: ${updateError.message}`);
      }
    } else {
      const { error: insertError } = await supabase
        .from('user_preferences')
        .insert([
          {
            user_id: normalizedUser,
            platform: normalizedPlatform,
            language: resolvedLang
          }
        ]);

      if (insertError) {
        console.warn(`[languageService] Error inserting language preference: ${insertError.message}`);
      }
    }
  } catch (err) {
    console.warn(`[languageService] Exception persisting language preference:`, err.message);
  }

  return resolvedLang;
}

function clearLanguageCache() {
  languageCache.clear();
}

module.exports = {
  getUserLanguage,
  setUserLanguage,
  clearLanguageCache
};
