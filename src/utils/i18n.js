const en = require('../locales/en.json');
const id = require('../locales/id.json');

const dictionaries = {
  en,
  id
};

const DEFAULT_LANGUAGE = 'en';
const SUPPORTED_LANGUAGES = ['en', 'id'];

function isValidLanguage(lang) {
  const normalized = String(lang || '').trim().toLowerCase();
  return SUPPORTED_LANGUAGES.includes(normalized);
}

function normalizeLanguage(lang) {
  const normalized = String(lang || '').trim().toLowerCase();
  return isValidLanguage(normalized) ? normalized : DEFAULT_LANGUAGE;
}

function getNestedValue(obj, keyPath) {
  if (!obj || typeof obj !== 'object' || !keyPath) {
    return undefined;
  }
  return keyPath.split('.').reduce((acc, part) => {
    return acc && acc[part] !== undefined ? acc[part] : undefined;
  }, obj);
}

function interpolate(template, params = {}) {
  if (typeof template !== 'string') {
    return template;
  }

  return template.replace(/\{(\w+)\}/g, (match, paramName) => {
    return params[paramName] !== undefined ? String(params[paramName]) : match;
  });
}

/**
 * Translate a key into the target language with fallback to default language ('en')
 * @param {string} key - Dot-separated key path, e.g. 'finance.balance_header'
 * @param {Object} [params={}] - Key-value replacements for {variable} tokens
 * @param {string} [lang='en'] - Target language ('en' | 'id')
 * @returns {string}
 */
function t(key, params = {}, lang = DEFAULT_LANGUAGE) {
  const chosenLang = normalizeLanguage(lang);
  let text = getNestedValue(dictionaries[chosenLang], key);

  // Fallback to default language if missing in chosen language
  if (text === undefined && chosenLang !== DEFAULT_LANGUAGE) {
    text = getNestedValue(dictionaries[DEFAULT_LANGUAGE], key);
  }

  // Fallback to raw key if completely not found
  if (text === undefined) {
    return key;
  }

  return interpolate(text, params);
}

module.exports = {
  t,
  DEFAULT_LANGUAGE,
  SUPPORTED_LANGUAGES,
  isValidLanguage,
  normalizeLanguage
};
