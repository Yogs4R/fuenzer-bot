const supabase = require('../lib/supabaseClient');
const { t } = require('../utils/i18n');

const DEFAULT_AI_MODEL_ALIAS = 'gpt-oss';

const AI_MODELS = {
  'gpt-oss': {
    id: 'openai/gpt-oss-120b',
    name: 'OpenAI GPT-OSS 120B',
    type: 'default'
  },
  'nvidia-nano': {
    id: 'nvidia/nemotron-3-nano-omni-30b-a3b-reasoning:free',
    name: 'NVIDIA Nemotron 3 Nano Omni',
    type: 'free'
  },
  'mammoth': {
    id: 'baseten/mammoth-1:free',
    name: 'Baseten Mammoth 1',
    type: 'free'
  },
  'nvidia-nemotron': {
    id: 'nvidia/nemotron-3.5-super-vl:free',
    name: 'NVIDIA Nemotron 3.5 Super VL',
    type: 'free'
  },
  'gemma4': {
    id: 'google/gemma-4-26b-a4b-it',
    name: 'Google Gemma 4 26B',
    type: 'premium'
  },
  'deepseek': {
    id: 'deepseek/deepseek-v4.1-flash-1017',
    name: 'DeepSeek 4.1 Flash',
    type: 'premium'
  }
};

function normalizePlatform(platform) {
  return String(platform || '').trim().toLowerCase();
}

function normalizeUserId(userId) {
  return String(userId || '').trim();
}

function getDefaultModelId() {
  return AI_MODELS[DEFAULT_AI_MODEL_ALIAS].id;
}

function getModelAliasList() {
  return Object.entries(AI_MODELS).map(([alias, model]) => ({ alias, ...model }));
}

function getModelById(modelId) {
  const normalizedModelId = String(modelId || '').trim();
  if (!normalizedModelId) {
    return null;
  }

  const entry = getModelAliasList().find((model) => model.id === normalizedModelId);
  return entry || null;
}

function buildWhatsAppModelInfoMessage(lang = 'en') {
  const defaultModel = { alias: DEFAULT_AI_MODEL_ALIAS, ...AI_MODELS[DEFAULT_AI_MODEL_ALIAS] };
  const freeModels = getModelAliasList().filter((model) => model.type === 'free');
  const premiumModels = getModelAliasList().filter((model) => model.type === 'premium');
  const typeCmd = t('ai.model_type_command', {}, lang);

  const renderModel = (index, model) => {
    return [
      `${index}. *${model.name}*`,
      `   ${typeCmd}: \`/switch ${model.alias}\``
    ].join('\n');
  };

  return [
    `> 🤖 *${t('ai.model_dir_title', {}, lang)}*`,
    t('ai.model_dir_switch_hint', {}, lang),
    '',
    `*${t('ai.model_dir_default', {}, lang)}*`,
    renderModel(1, defaultModel),
    '',
    `*${t('ai.model_dir_free', {}, lang)}*`,
    `_${t('ai.model_dir_free_note', {}, lang)}_`,
    freeModels.map((model, index) => renderModel(index + 1, model)).join('\n\n'),
    '',
    `*${t('ai.model_dir_premium', {}, lang)}*`,
    premiumModels.map((model, index) => renderModel(index + 1, model)).join('\n\n')
  ].join('\n');
}

function buildTelegramModelInfoMessage(lang = 'en') {
  const defaultModel = { alias: DEFAULT_AI_MODEL_ALIAS, ...AI_MODELS[DEFAULT_AI_MODEL_ALIAS] };
  const freeModels = getModelAliasList().filter((model) => model.type === 'free');
  const premiumModels = getModelAliasList().filter((model) => model.type === 'premium');
  const typeCmd = t('ai.model_type_command', {}, lang);

  const renderModel = (index, model) => {
    return [
      `${index}. <b>${model.name}</b>`,
      `   ${typeCmd}: <code>/switch ${model.alias}</code>`
    ].join('\n');
  };

  return [
    `<b>🤖 ${t('ai.model_dir_title', {}, lang)}</b>`,
    t('ai.model_dir_switch_hint', {}, lang).replace(/`([^`]+)`/g, (_, code) => `<code>${code.replace(/</g, '&lt;').replace(/>/g, '&gt;')}</code>`),
    '',
    `<b>${t('ai.model_dir_default', {}, lang)}</b>`,
    renderModel(1, defaultModel),
    '',
    `<b>${t('ai.model_dir_free', {}, lang)}</b>`,
    `<i>${t('ai.model_dir_free_note', {}, lang)}</i>`,
    freeModels.map((model, index) => renderModel(index + 1, model)).join('\n\n'),
    '',
    `<b>${t('ai.model_dir_premium', {}, lang)}</b>`,
    premiumModels.map((model, index) => renderModel(index + 1, model)).join('\n\n')
  ].join('\n');
}

function buildModelInfoMessage(platform = 'telegram', lang = 'en') {
  const platformName = normalizePlatform(platform);
  const isWhatsApp = platformName === 'whatsapp';
  if (isWhatsApp) {
    return buildWhatsAppModelInfoMessage(lang);
  }

  return buildTelegramModelInfoMessage(lang);
}

async function getActiveModel(userId, platform) {
  const normalizedUserId = normalizeUserId(userId);
  const normalizedPlatform = normalizePlatform(platform);

  if (!normalizedUserId || !normalizedPlatform) {
    return getDefaultModelId();
  }

  const { data, error } = await supabase
    .from('user_preferences')
    .select('active_model')
    .eq('user_id', normalizedUserId)
    .eq('platform', normalizedPlatform)
    .maybeSingle();

  if (error && error.code !== 'PGRST116') {
    console.error(`Error fetching AI preference for ${normalizedPlatform}/${normalizedUserId}:`, error);
    return getDefaultModelId();
  }

  const activeModel = String(data?.active_model || '').trim();
  return activeModel || getDefaultModelId();
}

async function setActiveModel(userId, platform, alias, lang = 'en') {
  const normalizedUserId = normalizeUserId(userId);
  const normalizedPlatform = normalizePlatform(platform);
  const normalizedAlias = String(alias || '').trim().toLowerCase();
  const model = AI_MODELS[normalizedAlias];
  if (!normalizedUserId) {
    throw new Error(t('ai.model_invalid_user', {}, lang));
  }

  if (!normalizedPlatform) {
    throw new Error(t('ai.model_invalid_platform', {}, lang));
  }

  if (!model) {
    const knownAliases = Object.keys(AI_MODELS).join(', ');
    throw new Error(t('ai.switch_unknown_alias', { aliases: knownAliases }, lang));
  }

  const { data: existingPreference, error: existingError } = await supabase
    .from('user_preferences')
    .select('user_id')
    .eq('user_id', normalizedUserId)
    .eq('platform', normalizedPlatform)
    .maybeSingle();

  if (existingError && existingError.code !== 'PGRST116') {
    console.error(`Error checking AI preference for ${normalizedPlatform}/${normalizedUserId}:`, existingError);
    throw new Error(t('ai.model_save_failed', {}, lang));
  }

  if (existingPreference) {
    const { error: updateError } = await supabase
      .from('user_preferences')
      .update({ active_model: model.id })
      .eq('user_id', normalizedUserId)
      .eq('platform', normalizedPlatform);

    if (updateError) {
      console.error(`Error updating AI preference for ${normalizedPlatform}/${normalizedUserId}:`, updateError);
      throw new Error(t('ai.model_save_failed', {}, lang));
    }
  } else {
    const { error: insertError } = await supabase
      .from('user_preferences')
      .insert([
        {
          user_id: normalizedUserId,
          platform: normalizedPlatform,
          active_model: model.id
        }
      ]);

    if (insertError) {
      console.error(`Error creating AI preference for ${normalizedPlatform}/${normalizedUserId}:`, insertError);
      throw new Error(t('ai.model_save_failed', {}, lang));
    }
  }

  return model.id;
}

module.exports = {
  AI_MODELS,
  buildModelInfoMessage,
  getModelById,
  getActiveModel,
  setActiveModel
};