// AI commands and reasoning isolation handler
const { AI_MODELS, buildModelInfoMessage, setActiveModel, getActiveModel } = require('../../services/aiPreferenceService');
const { askAiDetailed, translateText } = require('../../lib/openrouterClient');

const { appendFooter } = require('../../utils/textFormatter');

function buildAiStatsFooter(aiMeta = {}, platform = 'whatsapp') {
  const model = aiMeta.modelName || aiMeta.model || '-';
  const tokenIn = aiMeta.usage?.promptTokenCount ?? 0;
  const tokenOut = aiMeta.usage?.candidatesTokenCount ?? 0;
  const rpmLabel = aiMeta.rpm?.label || '-';

  if (platform === 'whatsapp') {
    return [
      '—'.repeat(19),
      `*Model:* ${model}`,
      `*Token In:* ${tokenIn} | *Token Out:* ${tokenOut}`,
      `*RPM:* ${rpmLabel}`
    ].join('\n');
  }

  return [
    '—'.repeat(19),
    `Model: ${model}`,
    `Token In: ${tokenIn} | Token Out: ${tokenOut}`,
    `RPM: ${rpmLabel}`
  ].join('\n');
}

function formatAiError(error, platform = 'whatsapp') {
  const isWhatsApp = platform === 'whatsapp';
  const message = String(error?.message || '');

  if (message.startsWith('⛔') || message.includes('400 Bad Request: ⛔')) {
    return message.includes('400 Bad Request:') ? message.split('400 Bad Request: ')[1].trim() : message;
  }

  let errorHeader;
  let errorBody;

  if (message.includes('429 Rate Limit')) {
    errorHeader = isWhatsApp ? '> *RATE LIMIT AI* ⏳' : '<b>RATE LIMIT AI</b> ⏳';
    errorBody = 'Maaf, request AI sedang padat (429 Rate Limit).\nSilakan coba lagi beberapa saat.';
  } else if (message.includes('401 Unauthorized') || message.includes('403 Forbidden')) {
    errorHeader = isWhatsApp ? '> *AKSES AI DITOLAK* 🔒' : '<b>AKSES AI DITOLAK</b> 🔒';
    errorBody = 'Maaf, akses AI ditolak (401/403).\nAdmin perlu memeriksa API key OpenRouter.';
  } else if (message.includes('tidak ditemukan di OpenRouter')) {
    errorHeader = isWhatsApp ? '> *MODEL AI TIDAK DITEMUKAN* 🔍' : '<b>MODEL AI TIDAK DITEMUKAN</b> 🔍';
    errorBody = 'Maaf, model AI yang dipakai sedang tidak tersedia.\nCoba lagi nanti.';
  } else if (message.includes('API key OpenRouter')) {
    errorHeader = isWhatsApp ? '> *API KEY AI TIDAK VALID* 🔑' : '<b>API KEY AI TIDAK VALID</b> 🔑';
    errorBody = 'Maaf, konfigurasi OpenRouter belum lengkap atau tidak valid.\nAdmin telah diberitahu.';
  } else if (message.includes('Server OpenRouter sedang gangguan')) {
    errorHeader = isWhatsApp ? '> *SERVER AI GANGGUAN* 🛠️' : '<b>SERVER AI GANGGUAN</b> 🛠️';
    errorBody = 'Maaf, server AI sedang gangguan.\nSilakan coba lagi nanti.';
  } else {
    errorHeader = isWhatsApp ? '> *ERROR AI* 🤯' : '<b>ERROR AI</b> ❌';
    errorBody = 'Maaf, otak AI sedang gangguan.\nCoba lagi nanti atau gunakan perintah sistem (/ping, /saldo).';
  }

  const emptyFooter = buildAiStatsFooter({
    model: '-',
    usage: { promptTokenCount: 0, candidatesTokenCount: 0 },
    rpm: { label: '-' }
  }, platform);

  return appendFooter(`${errorHeader}\n\n${errorBody}`, emptyFooter);
}

async function handleAiCommand(command, args = [], userId = '', platform = 'whatsapp', extra = {}) {
  const cleanCommand = String(command || '').toLowerCase().trim();

  switch (cleanCommand) {
    case '/model_info': {
      return buildModelInfoMessage(platform);
    }

    case '/switch': {
      const alias = String(args[0] || '').trim().toLowerCase();
      if (!alias) {
        return platform === 'whatsapp'
          ? '❌ Ketik alias modelnya! Contoh: /switch elephant. Cek /model_info.'
          : '❌ Ketik alias modelnya! Contoh: <code>/switch elephant</code>. Cek /model_info.';
      }

      if (!AI_MODELS[alias]) {
        const knownAliases = Object.keys(AI_MODELS).join(', ');
        return `❌ Alias model tidak ditemukan. Alias tersedia: ${knownAliases}. Cek /model_info.`;
      }

      await setActiveModel(userId, platform, alias);
      return `✅ Berhasil! Otak AI kamu sekarang menggunakan ${AI_MODELS[alias].name}.`;
    }

    case '/translate': {
      const lang = args[0];
      const targetText = String(args.slice(1).join(' ') || extra?.quotedText || '').trim();

      if (!lang || !targetText) {
        return platform === 'whatsapp'
          ? '> *FORMAT SALAH* ❌\n\nGunakan: `/translate [kode_bahasa] [teks]`\nAtau reply pesan dengan `/translate [kode_bahasa]`.\n\nContoh: `/translate en Halo dunia`'
          : '<b>FORMAT SALAH</b> ❌\n\nGunakan: <code>/translate [kode_bahasa] [teks]</code>\nAtau reply pesan dengan <code>/translate [kode_bahasa]</code>.\n\nContoh: <code>/translate en Halo dunia</code>';
      }

      const translatedText = await translateText(lang, targetText);
      return `Terjemahan ke ${lang}:\n${translatedText}`;
    }

    default:
      return 'Perintah AI tidak dikenali.';
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
