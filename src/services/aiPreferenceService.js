const supabase = require('../lib/supabaseClient');

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
  const isEn = lang === 'en';
  const defaultModel = { alias: DEFAULT_AI_MODEL_ALIAS, ...AI_MODELS[DEFAULT_AI_MODEL_ALIAS] };
  const freeModels = getModelAliasList().filter((model) => model.type === 'free');
  const premiumModels = getModelAliasList().filter((model) => model.type === 'premium');

  const renderModel = (index, model) => {
    return [
      `${index}. *${model.name}*`,
      `   ${isEn ? 'Type' : 'Ketik'}: \`/switch ${model.alias}\``
    ].join('\n');
  };

  return [
    isEn ? '> 🤖 *FUENZER BOT AI MODEL DIRECTORY*' : '> 🤖 *DAFTAR MODEL AI FUENZER BOT*',
    isEn ? 'Type `/switch <alias>` to change active AI model.' : 'Ketik `/switch <alias>` untuk mengganti model AI aktif.',
    '',
    isEn ? '*DEFAULT MODEL*' : '*MODEL DEFAULT (Bawaan)*',
    renderModel(1, defaultModel),
    '',
    isEn ? '*FREE MODELS (Training Data)*' : '*MODEL GRATIS (Data Latihan)*',
    isEn ? '_Note: Conversations may be logged for training._' : '_Catatan: Percakapan mungkin dicatat untuk latihan._',
    freeModels.map((model, index) => renderModel(index + 1, model)).join('\n\n'),
    '',
    isEn ? '*PREMIUM MODELS*' : '*MODEL PREMIUM*',
    premiumModels.map((model, index) => renderModel(index + 1, model)).join('\n\n')
  ].join('\n');
}

function buildTelegramModelInfoMessage(lang = 'en') {
  const isEn = lang === 'en';
  const defaultModel = { alias: DEFAULT_AI_MODEL_ALIAS, ...AI_MODELS[DEFAULT_AI_MODEL_ALIAS] };
  const freeModels = getModelAliasList().filter((model) => model.type === 'free');
  const premiumModels = getModelAliasList().filter((model) => model.type === 'premium');

  const renderModel = (index, model) => {
    return [
      `${index}. <b>${model.name}</b>`,
      `   ${isEn ? 'Type' : 'Ketik'}: <code>/switch ${model.alias}</code>`
    ].join('\n');
  };

  return [
    isEn ? '<b>🤖 FUENZER BOT AI MODEL DIRECTORY</b>' : '<b>🤖 DAFTAR MODEL AI FUENZER BOT</b>',
    isEn ? 'Type <code>/switch &lt;alias&gt;</code> to change active AI model.' : 'Ketik <code>/switch &lt;alias&gt;</code> untuk mengganti model AI aktif.',
    '',
    isEn ? '<b>DEFAULT MODEL</b>' : '<b>MODEL DEFAULT (Bawaan)</b>',
    renderModel(1, defaultModel),
    '',
    isEn ? '<b>FREE MODELS (Training Data)</b>' : '<b>MODEL GRATIS (Data Latihan)</b>',
    isEn ? '<i>Note: Conversations may be logged for training.</i>' : '<i>Catatan: Percakapan mungkin dicatat untuk latihan.</i>',
    freeModels.map((model, index) => renderModel(index + 1, model)).join('\n\n'),
    '',
    isEn ? '<b>PREMIUM MODELS</b>' : '<b>MODEL PREMIUM</b>',
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
  const isEn = lang === 'en';

  if (!normalizedUserId) {
    throw new Error(isEn ? 'Invalid User ID.' : 'User ID tidak valid.');
  }

  if (!normalizedPlatform) {
    throw new Error(isEn ? 'Invalid platform.' : 'Platform tidak valid.');
  }

  if (!model) {
    throw new Error(isEn ? 'AI model alias not found.' : 'Alias model tidak ditemukan.');
  }

  const { data: existingPreference, error: existingError } = await supabase
    .from('user_preferences')
    .select('user_id')
    .eq('user_id', normalizedUserId)
    .eq('platform', normalizedPlatform)
    .maybeSingle();

  if (existingError && existingError.code !== 'PGRST116') {
    console.error(`Error checking AI preference for ${normalizedPlatform}/${normalizedUserId}:`, existingError);
    throw new Error(isEn ? 'Failed to save AI model preference.' : 'Gagal menyimpan preferensi model AI.');
  }

  if (existingPreference) {
    const { error: updateError } = await supabase
      .from('user_preferences')
      .update({ active_model: model.id })
      .eq('user_id', normalizedUserId)
      .eq('platform', normalizedPlatform);

    if (updateError) {
      console.error(`Error updating AI preference for ${normalizedPlatform}/${normalizedUserId}:`, updateError);
      throw new Error(isEn ? 'Failed to save AI model preference.' : 'Gagal menyimpan preferensi model AI.');
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
      throw new Error(isEn ? 'Failed to save AI model preference.' : 'Gagal menyimpan preferensi model AI.');
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