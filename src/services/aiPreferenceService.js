const supabase = require('../lib/supabaseClient');

const DEFAULT_AI_MODEL_ALIAS = 'gpt-oss';

const AI_MODELS = {
  'gpt-oss': {
    id: 'openai/gpt-oss-120b',
    name: 'OpenAI GPT-OSS 120B',
    type: 'default',
    description: '117B MoE, kuat logika & serbaguna.',
    inputPrice: '$0.039/M',
    outputPrice: '$0.19/M',
    context: '131k',
    maxOut: '131k'
  },
  'nvidia-nano': {
    id: 'nvidia/nemotron-3-nano-omni-30b-a3b-reasoning:free',
    name: 'NVIDIA Nemotron 3 Nano Omni',
    type: 'free',
    description: 'Model multimodal efisien NVIDIA untuk persepsi dan penalaran agen perusahaan.',
    inputPrice: '-',
    outputPrice: '-',
    context: '256k',
    maxOut: '65k'
  },
  'glm-air': {
    id: 'z-ai/glm-4.5-air:free',
    name: 'Z.ai GLM 4.5 Air',
    type: 'free',
    description: 'Versi ringan, dirancang khusus untuk aplikasi agent-centric.',
    inputPrice: '-',
    outputPrice: '-',
    context: '131k',
    maxOut: '96k'
  },
  'nvidia-nemotron': {
    id: 'nvidia/nemotron-3-super-120b-a12b:free',
    name: 'NVIDIA Nemotron 3 Super',
    type: 'free',
    description: '120B hybrid MoE (12B aktif), akurat untuk multi-agent kompleks.',
    inputPrice: '-',
    outputPrice: '-',
    context: '262k',
    maxOut: '262k'
  },
  'gemma4': {
    id: 'google/gemma-4-26b-a4b-it',
    name: 'Google Gemma 4 31B',
    type: 'premium',
    description: 'Multimodal (Teks/Gambar).',
    inputPrice: '$0.13/M',
    outputPrice: '$0.38/M',
    context: '262k',
    maxOut: '262k'
  },
  'deepseek': {
    id: 'deepseek/deepseek-v3.2 ',
    name: 'DeepSeek 3.2',
    type: 'premium',
    description: 'Efisien komputasi, kuat logika & andal menggunakan tools agentic.',
    inputPrice: '$0.26/M',
    outputPrice: '$0.38/M',
    context: '163k',
    maxOut: '163k'
  },
  'mimo-flash': {
    id: 'xiaomi/mimo-v2-flash',
    name: 'Xiaomi Mimo V2 Flash',
    type: 'premium',
    description: '309B MoE (15B aktif), unggul untuk logika, coding & skenario agent.',
    inputPrice: '$0.09/M',
    outputPrice: '$0.29/M',
    context: '262k',
    maxOut: '65k'
  },
  'mistral-nemo': {
    id: 'mistralai/mistral-nemo',
    name: 'Mistral Nemo',
    type: 'premium',
    description: '12B params, model kolaborasi tangguh dari Mistral & NVIDIA.',
    inputPrice: '$0.02/M',
    outputPrice: '$0.04/M',
    context: '131k',
    maxOut: '131k'
  },
  'llama': {
    id: 'meta-llama/llama-3.1-8b-instruct',
    name: 'Meta Llama 3.1 8B Instruct',
    type: 'premium',
    description: 'Versi 8B instruct-tuned, sangat cepat & efisien untuk tugas umum.',
    inputPrice: '$0.02/M',
    outputPrice: '$0.05/M',
    context: '131k',
    maxOut: '131k'
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

function buildWhatsAppModelInfoMessage() {
  const defaultModel = { alias: DEFAULT_AI_MODEL_ALIAS, ...AI_MODELS[DEFAULT_AI_MODEL_ALIAS] };
  const freeModels = getModelAliasList().filter((model) => model.type === 'free');
  const premiumModels = getModelAliasList().filter((model) => model.type === 'premium');

  const renderModel = (index, model, options = {}) => {
    const parts = [
      `${index}. *${model.name}*`,
      `Ketik: \`/switch ${model.alias}\``,
      `📝 ${model.description}`
    ];

    if (!options.freeOnly) {
      parts.push(`💰 Input: ${model.inputPrice} | Output: ${model.outputPrice}`);
    }

    parts.push(`📊 Context: ${model.context} | Max Out: ${model.maxOut}`);
    return parts.join('\n');
  };

  return [
    '> 🤖 DAFTAR MODEL AI FUENZER BOT',
    'Ketik /switch <alias> untuk mengganti "otak" AI.',
    '',
    '*DEFAULT MODEL (Bawaan)*',
    renderModel(1, defaultModel),
    '',
    '*GRATIS (Training Models)*',
    '⚠️ Catatan: Chat mungkin dicatat untuk training.',
    freeModels.map((model, index) => renderModel(index + 1, model, { freeOnly: true })).join('\n\n'),
    '',
    '*PREMIUM (Berbayar)*',
    premiumModels.map((model, index) => renderModel(index + 1, model)).join('\n\n')
  ].join('\n');
}

function buildTelegramModelInfoMessage() {
  const defaultModel = { alias: DEFAULT_AI_MODEL_ALIAS, ...AI_MODELS[DEFAULT_AI_MODEL_ALIAS] };
  const freeModels = getModelAliasList().filter((model) => model.type === 'free');
  const premiumModels = getModelAliasList().filter((model) => model.type === 'premium');

  const renderModel = (index, model, options = {}) => {
    const parts = [
      `${index}. <b>${model.name}</b>`,
      `Ketik: <pre>/switch ${model.alias}</pre>`,
      `📝 ${model.description}`
    ];

    if (!options.freeOnly) {
      parts.push(`💰 Input: ${model.inputPrice} | Output: ${model.outputPrice}`);
    }

    parts.push(`📊 Context: ${model.context} | Max Out: ${model.maxOut}`);
    return parts.join('\n');
  };

  return [
    '<b>🤖 DAFTAR MODEL AI FUENZER BOT</b>',
    'Ketik <code>/switch &lt;alias&gt;</code> untuk mengganti "otak" AI.',
    '',
    '<b>DEFAULT MODEL (Bawaan)</b>',
    renderModel(1, defaultModel),
    '',
    '<b>GRATIS (Training Models)</b>',
    '⚠️ Catatan: Chat mungkin dicatat untuk training.',
    freeModels.map((model, index) => renderModel(index + 1, model, { freeOnly: true })).join('\n\n'),
    '',
    '<b>PREMIUM (Berbayar)</b>',
    premiumModels.map((model, index) => renderModel(index + 1, model)).join('\n\n')
  ].join('\n');
}

function buildModelInfoMessage(platform = 'telegram') {
  const platformName = normalizePlatform(platform);
  const isWhatsApp = platformName === 'whatsapp';
  if (isWhatsApp) {
    return buildWhatsAppModelInfoMessage();
  }

  return buildTelegramModelInfoMessage();
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

async function setActiveModel(userId, platform, alias) {
  const normalizedUserId = normalizeUserId(userId);
  const normalizedPlatform = normalizePlatform(platform);
  const normalizedAlias = String(alias || '').trim().toLowerCase();
  const model = AI_MODELS[normalizedAlias];

  if (!normalizedUserId) {
    throw new Error('User ID tidak valid.');
  }

  if (!normalizedPlatform) {
    throw new Error('Platform tidak valid.');
  }

  if (!model) {
    throw new Error('Alias model tidak ditemukan.');
  }

  const { data: existingPreference, error: existingError } = await supabase
    .from('user_preferences')
    .select('user_id')
    .eq('user_id', normalizedUserId)
    .eq('platform', normalizedPlatform)
    .maybeSingle();

  if (existingError && existingError.code !== 'PGRST116') {
    console.error(`Error checking AI preference for ${normalizedPlatform}/${normalizedUserId}:`, existingError);
    throw new Error('Gagal menyimpan preferensi model AI.');
  }

  if (existingPreference) {
    const { error: updateError } = await supabase
      .from('user_preferences')
      .update({ active_model: model.id })
      .eq('user_id', normalizedUserId)
      .eq('platform', normalizedPlatform);

    if (updateError) {
      console.error(`Error updating AI preference for ${normalizedPlatform}/${normalizedUserId}:`, updateError);
      throw new Error('Gagal menyimpan preferensi model AI.');
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
      throw new Error('Gagal menyimpan preferensi model AI.');
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