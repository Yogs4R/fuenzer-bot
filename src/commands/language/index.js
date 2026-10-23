const { t, isValidLanguage } = require('../../utils/i18n');
const { getUserLanguage, setUserLanguage } = require('../../services/languageService');

/**
 * Handle language management commands (/lang, /language, /bahasa)
 * @param {string} command - Command name
 * @param {Array<string>} args - Command arguments
 * @param {string} userId - User identifier
 * @param {string} platform - 'whatsapp' | 'telegram'
 * @param {Object} [context={}] - Context metadata
 * @returns {Promise<string>}
 */
async function handleLanguageCommand(command, args = [], userId = '', platform = 'whatsapp', context = {}) {
  const currentLang = context?.lang || await getUserLanguage(userId, platform);

  if (args.length === 0) {
    const header = t('language.current_header', {}, currentLang);
    const body = t('language.current_body', {}, currentLang);
    return `${header}\n\n${body}`;
  }

  const requestedLang = String(args[0] || '').trim().toLowerCase();

  if (!isValidLanguage(requestedLang)) {
    return t('language.invalid', {}, currentLang);
  }

  await setUserLanguage(userId, platform, requestedLang);
  return t('language.switched', {}, requestedLang);
}

module.exports = {
  handleLanguageCommand
};
