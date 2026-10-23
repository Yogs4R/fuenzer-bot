// AI commands and reasoning isolation handler
const { AI_MODELS, buildModelInfoMessage, setActiveModel, getActiveModel } = require('../../services/aiPreferenceService');
const { askAiDetailed, translateText } = require('../../lib/openrouterClient');
const { appendFooter } = require('../../utils/textFormatter');
const { t } = require('../../utils/i18n');

function buildAiStatsFooter(aiMeta = {}, platform = 'whatsapp', lang = 'en') {
  const model = aiMeta.modelName || aiMeta.model || '-';
  const tokenIn = aiMeta.usage?.promptTokenCount ?? 0;
  const tokenOut = aiMeta.usage?.candidatesTokenCount ?? 0;
  const rpmLabel = aiMeta.rpm?.label || '-';
  const labelModel = t('ai.stats_model', {}, lang) || 'Model';
  const labelIn = t('ai.stats_token_in', {}, lang) || 'Token In';
  const labelOut = t('ai.stats_token_out', {}, lang) || 'Token Out';
  const labelRpm = t('ai.stats_rpm', {}, lang) || 'RPM';

  if (platform === 'whatsapp') {
    return [
      '—'.repeat(19),
      `*${labelModel}:* ${model}`,
      `*${labelIn}:* ${tokenIn} | *${labelOut}:* ${tokenOut}`,
      `*${labelRpm}:* ${rpmLabel}`
    ].join('\n');
  }

  return [
    '—'.repeat(19),
    `${labelModel}: ${model}`,
    `${labelIn}: ${tokenIn} | ${labelOut}: ${tokenOut}`,
    `${labelRpm}: ${rpmLabel}`
  ].join('\n');
}

function formatAiError(error, platform = 'whatsapp', lang = 'en') {
  const isWhatsApp = platform === 'whatsapp';
  const message = String(error?.message || '');

  if (message.startsWith('⛔') || message.includes('400 Bad Request: ⛔')) {
    return message.includes('400 Bad Request:') ? message.split('400 Bad Request: ')[1].trim() : message;
  }

  let errorHeader;
  let errorBody;

  if (message.includes('429 Rate Limit')) {
    errorHeader = isWhatsApp ? t('ai.error_rate_limit_header', {}, lang) : `<b>${t('ai.error_rate_limit_header', {}, lang).replace(/^>\s*\*/, '').replace(/\*$/, '')}</b>`;
    errorBody = t('ai.error_rate_limit_body', {}, lang);
  } else if (message.includes('401 Unauthorized') || message.includes('403 Forbidden')) {
    errorHeader = isWhatsApp ? t('ai.error_access_denied_header', {}, lang) : `<b>${t('ai.error_access_denied_header', {}, lang).replace(/^>\s*\*/, '').replace(/\*$/, '')}</b>`;
    errorBody = t('ai.error_access_denied_body', {}, lang);
  } else if (message.includes('tidak ditemukan di OpenRouter') || message.includes('not found in OpenRouter')) {
    errorHeader = isWhatsApp ? t('ai.error_model_not_found_header', {}, lang) : `<b>${t('ai.error_model_not_found_header', {}, lang).replace(/^>\s*\*/, '').replace(/\*$/, '')}</b>`;
    errorBody = t('ai.error_model_not_found_body', {}, lang);
  } else if (message.includes('API key OpenRouter')) {
    errorHeader = isWhatsApp ? t('ai.error_invalid_key_header', {}, lang) : `<b>${t('ai.error_invalid_key_header', {}, lang).replace(/^>\s*\*/, '').replace(/\*$/, '')}</b>`;
    errorBody = t('ai.error_invalid_key_body', {}, lang);
  } else if (message.includes('Server OpenRouter sedang gangguan') || message.includes('OpenRouter server issue')) {
    errorHeader = isWhatsApp ? t('ai.error_server_down_header', {}, lang) : `<b>${t('ai.error_server_down_header', {}, lang).replace(/^>\s*\*/, '').replace(/\*$/, '')}</b>`;
    errorBody = t('ai.error_server_down_body', {}, lang);
  } else {
    errorHeader = isWhatsApp ? t('ai.error_generic_header', {}, lang) : `<b>${t('ai.error_generic_header', {}, lang).replace(/^>\s*\*/, '').replace(/\*$/, '')}</b>`;
    errorBody = t('ai.error_generic_body', {}, lang);
  }

  const emptyFooter = buildAiStatsFooter({
    model: '-',
    usage: { promptTokenCount: 0, candidatesTokenCount: 0 },
    rpm: { label: '-' }
  }, platform, lang);

  return appendFooter(`${errorHeader}\n\n${errorBody}`, emptyFooter);
}

async function handleAiCommand(command, args = [], userId = '', platform = 'whatsapp', extra = {}) {
  const cleanCommand = String(command || '').toLowerCase().trim();
  const lang = extra?.lang || 'en';

  switch (cleanCommand) {
    case '/models':
    case '/model':
    case '/model_info': {
      return buildModelInfoMessage(platform, lang);
    }

    case '/switch': {
      const alias = String(args[0] || '').trim().toLowerCase();
      if (!alias) {
        return t('ai.switch_missing_alias', { alias: 'gpt-oss' }, lang);
      }

      if (!AI_MODELS[alias]) {
        const knownAliases = Object.keys(AI_MODELS).join(', ');
        return t('ai.switch_unknown_alias', { aliases: knownAliases }, lang);
      }

      await setActiveModel(userId, platform, alias);
      return t('ai.switch_success', { model: AI_MODELS[alias].name }, lang);
    }

    case '/translate':
    case '/terjemahkan':
    case '/terjemah': {
      const targetLang = args[0];
      const targetText = String(args.slice(1).join(' ') || extra?.quotedText || '').trim();

      if (!targetLang || !targetText) {
        return t('ai.translate_usage', {}, lang);
      }

      const translatedText = await translateText(targetLang, targetText);
      return lang === 'en'
        ? `Translation to ${targetLang}:\n${translatedText}`
        : `Terjemahan ke ${targetLang}:\n${translatedText}`;
    }

    default:
      return t('common.unknown_command_body', { command }, lang);
  }
}

async function processAiChat(payload, userId, platform = 'whatsapp', extra = {}) {
  try {
    const realId = extra?.realId || userId;
    const aiResult = await askAiDetailed(payload, userId, platform, realId);
    const footer = buildAiStatsFooter(aiResult, platform);
    return {
      success: true,
      text: aiResult.text,
      footer,
      fullText: appendFooter(aiResult.text, footer),
      rawResult: aiResult
    };
  } catch (error) {
    console.error(`Error dari OpenRouter AI (${platform}):`, error);
    const errorText = formatAiError(error, platform);
    return {
      success: false,
      error,
      fullText: errorText
    };
  }
}

module.exports = {
  handleAiCommand,
  processAiChat,
  formatAiError
};
