// AI client (OpenRouter via OpenAI SDK)
const OpenAI = require('openai');
const { AI_MODELS, getActiveModel, getModelById } = require('../services/aiPreferenceService');
const { logAIUsage } = require('../services/logService');

// Inisialisasi OpenRouter API
const apiKey = process.env.OPENROUTER_API_KEY;
if (!apiKey) {
    console.error('ERROR: OPENROUTER_API_KEY tidak ditemukan di environment variables.');
    console.error('Pastikan Anda telah membuat file .env dengan OPENROUTER_API_KEY=your_key_here');
}

const openai = new OpenAI({
  baseURL: 'https://openrouter.ai/api/v1',
  apiKey
});

const modelName = AI_MODELS['gpt-oss'].id; // Default model
const RPM_LIMIT = parseInt(process.env.OPENROUTER_RPM_LIMIT || process.env.GEMINI_RPM_LIMIT || '15', 10);
const requestTimestamps = [];

const systemInstruction = `Kamu adalah Fuenzer Bot, asisten virtual pribadi milik Ridwan Yoga Suryantara (developer Fuenzer Studio & mahasiswa Sistem Informasi). Kamu ramah, pintar coding, dan asyik diajak ngobrol.

COMMAND YANG TERSEDIA:
SISTEM: /start, /info, /ping
AI: /model_info, /switch
RESEARCH: /research_info, /buku, /jurnal, /artikel
DOWNLOADER: /downloader, /download, /audio, /short
FINANCE: /finance_info, /saldo, /catat, /pemasukan, /laporan_chart, /riwayat, /edit, /hapus
UTILITAS: /cuaca, /sholat, /me
IMAGE: /img_info, /img, /hapusbg, /ss
PDF: /pdf_info, /topdf, /pdf
STICKER: /sticker_info, /tosticker
TRANSLATE: /translate, /translate_info
CS & FEEDBACK: /help, /answer, /donate
ADMIN: /admin, /monitor, /cmd_usage, /ai_usage, /broadcast

ATURAN PENTING:
1. PENGENALAN PERTANYAAN TENTANG COMMAND:
   - User bertanya tentang command JIKA: menyebut "command", "cara pakai", "fungsi /xxx", "gimana pakai", "command apa", "fitur apa", "/help", "/info", "daftar command"
   - Contoh pertanyaan: "command apa saja", "cara pakai /pdf", "fungsi /jurnal", "gimana download", "fitur apa"
   - JIKA user menanyakan command: JELASKAN RINGKAS fungsi dan cara pakai command yang relevan
   - JIKA user TIDAK menanyakan command: JANGAN memaksa membahas daftar command, fokus pada pertanyaan utamanya

2. PESAN TIDAK JELAS:
   - Jika pengguna mengirim pesan tidak jelas, ketikan acak (seperti 'ajsdas', 'sjadna'), atau hanya huruf tunggal ('P', 'y'), jangan memberikan jawaban panjang
   - Cukup balas singkat: "Maaf, aku kurang paham maksud ketikanmu. 😅 Ketik /info untuk melihat daftar kemampuanku ya!"

3. SAPAAN BARU:
   - Jika pengguna baru menyapa (seperti "Halo", "Hai", "Pagi") atau bertanya apa yang bisa kamu lakukan, akhiri jawabanmu dengan menawarkan "/info" untuk melihat semua kemampuan

4. FORMAT PESAN:
   - DILARANG KERAS menggunakan Tabel Markdown (| Kolom | Kolom |)
   - Jika perlu menyajikan data tabular, daftar, atau perbandingan → gunakan Bullet Points (-) atau Numbered Lists (1. 2. 3.)
   - Pastikan mudah dibaca di layar HP

5. BAHASA:
   - Selalu sesuaikan bahasa jawaban dengan input user
   - Jika user menulis English → balas English
   - Jika user menulis Indonesia → balas Indonesia
   - Jika user menulis bahasa Jawa → balas bahasa Jawa
   - Jika campuran → ikuti bahasa dominan user
   - Hal ini berlaku untuk banyak bahasa lain agar user merasa nyaman dan paham

6. CATATAN KHUSUS:
   - Command bot banyak menggunakan bahasa Indonesia
   - Saat ditanya command tertentu, jelaskan dengan contoh penggunaan singkat jika relevan
   - Jangan berasumsi user tahu command apa yang ada, tunggu user bertanya`;


const generationConfig = {
  temperature: 0.7,
  top_p: 0.8,
  max_tokens: 1024,
};

/**
 * Fungsi untuk membersihkan dan memformat Markdown AI agar sesuai dengan standar WhatsApp
 * @param {string} text - Teks mentah dari AI
 * @returns {string} - Teks yang sudah diformat untuk WA
 */
function formatForWhatsApp(text) {
  if (!text) return text;
  
  let formattedText = text;
  
  // Ubah Bold: **teks** menjadi *teks*
  formattedText = formattedText.replace(/\*\*(.*?)\*\*/g, '*$1*');
  
  // Ubah Header Markdown: ### Judul menjadi *Judul*
  formattedText = formattedText.replace(/^#+\s*(.*)$/gm, '*$1*');
  
  // Ubah Bullet Points: dari * menjadi - agar tidak salah terbaca sebagai bold di WA
  formattedText = formattedText.replace(/^\s*\*\s+/gm, '- ');

  return formattedText;
}

/**
 * Fungsi untuk berinteraksi dengan AI
 * @param {string} message - Pesan dari pengguna
 * @returns {Promise<string>} - Jawaban dari AI
 */
async function askGemini(message, userId, platform, logUserId) {
  const detailed = await askGeminiDetailed(message, userId, platform, logUserId);
  return detailed.text;
}

function trackRequestAndGetRpmStatus() {
  const now = Date.now();
  const oneMinuteAgo = now - 60000;

  while (requestTimestamps.length > 0 && requestTimestamps[0] < oneMinuteAgo) {
    requestTimestamps.shift();
  }

  requestTimestamps.push(now);

  const used = requestTimestamps.length;
  const remaining = Math.max(RPM_LIMIT - used, 0);
  const status = remaining > 0 ? 'AMAN' : 'BATAS RPM';

  return {
    used,
    limit: RPM_LIMIT,
    remaining,
    status,
    label: `${used}/${RPM_LIMIT} (${status})`
  };
}

function extractUsageMetadata(response) {
  const usage = response?.usage || {};

  const promptTokenCount = usage.prompt_tokens || 0;
  const candidatesTokenCount = usage.completion_tokens || 0;
  const totalTokenCount = usage.total_tokens || (promptTokenCount + candidatesTokenCount);

  return {
    promptTokenCount,
    candidatesTokenCount,
    totalTokenCount
  };
}

async function askGeminiDetailed(message, userId, platform, logUserId) {
  let modelId = modelName;
  let isAutoSwitched = false;

  try {
    // Validasi API key
    if (!apiKey) {
      throw new Error('API key OpenRouter tidak ditemukan. Periksa file .env Anda.');
    }

    modelId = await getActiveModel(userId, platform);
    
    // Auto-Switch Model Logic
    const visionModelsAliases = ['gemma4', 'deepseek'];
    const visionModels = visionModelsAliases.map(alias => AI_MODELS[alias]?.id).filter(Boolean);
    const fallbackVisionAlias = 'gemma4';
    const fallbackVisionModelId = AI_MODELS[fallbackVisionAlias].id;
    
    const isArrayMsg = Array.isArray(message);
    const hasImage = isArrayMsg && message.some(part => part.type === 'image_url');
    const msgString = isArrayMsg ? (message.find(m => m.type === 'text')?.text || '') : String(message || '');
    const hasFileText = msgString.includes('[Isi File Terlampir:');

    if (hasImage || hasFileText) {
      if (!visionModels.includes(modelId)) {
        modelId = fallbackVisionModelId;
        isAutoSwitched = true;
      }
    }
    
    // Log untuk debugging
    console.log(`Mengirim permintaan ke OpenRouter API dengan model: ${modelId}`);
    
    const response = await openai.chat.completions.create({
      model: modelId,
      messages: [
        { role: 'system', content: systemInstruction },
        { role: 'user', content: Array.isArray(message) ? message : String(message || '') }
      ],
      ...generationConfig
    });

    const content = response?.choices?.[0]?.message?.content;
    const rawText = Array.isArray(content)
      ? content.map((part) => part?.text || '').join('\n').trim()
      : String(content || '').trim();
    
    // Periksa jika ada teks
    if (!rawText) {
      throw new Error('Tidak ada teks dalam respons dari OpenRouter API');
    }
    
    // Ambil teks mentah lalu format untuk WhatsApp
    let finalMessageWA = formatForWhatsApp(rawText);
    
    if (isAutoSwitched) {
      finalMessageWA = `🤖 *(Dialihkan otomatis ke model Gemma karena pesan berisi gambar/file)*\n\n${finalMessageWA}`;
    }
    
    const usage = extractUsageMetadata(response);
    const rpm = trackRequestAndGetRpmStatus();
    const modelMeta = getModelById(modelId);

    const aiLogUserId = typeof logUserId === 'string' ? logUserId : userId;

    const loggedMessage = Array.isArray(message) 
      ? message.find(m => m.type === 'text')?.text || '[Multimodal Message]' 
      : String(message || '');

    await logAIUsage(
      aiLogUserId,
      platform,
      modelId,
      loggedMessage,
      usage.promptTokenCount,
      usage.candidatesTokenCount
    );
    
    return {
      text: finalMessageWA,
      model: modelId,
      modelName: modelMeta?.name || modelId,
      usage,
      rpm
    };

  } catch (error) {
    const statusCode = error?.status || error?.response?.status;
    const errorMessage = String(error?.message || 'Unknown error');
    const lowerErrorMessage = errorMessage.toLowerCase();

    console.error('Error saat memanggil OpenRouter API:', statusCode || '-', errorMessage);
    
    if (statusCode === 400 && lowerErrorMessage.includes('image')) {
      throw new Error('400 Bad Request: ⛔ Model AI yang kamu gunakan belum mendukung pembacaan gambar atau gambar terlalu besar. Silakan ganti model AI (misal ke Gemini Gemma 4).');
    } else if (statusCode === 400) {
      throw new Error(`400 Bad Request: ${errorMessage}`);
    } else if (statusCode === 429 || lowerErrorMessage.includes('rate limit')) {
      throw new Error('429 Rate Limit dari OpenRouter. Batas request tercapai, coba lagi sebentar.');
    } else if (statusCode === 401 || lowerErrorMessage.includes('unauthorized')) {
      throw new Error('401 Unauthorized dari OpenRouter. Periksa OPENROUTER_API_KEY Anda.');
    } else if (statusCode === 403 || lowerErrorMessage.includes('forbidden')) {
      throw new Error('403 Forbidden dari OpenRouter. API key valid tetapi akses model ditolak.');
    } else if (statusCode === 404 || lowerErrorMessage.includes('model not found')) {
      throw new Error(`Model ${modelId || modelName} tidak ditemukan di OpenRouter.`);
    } else if (statusCode >= 500 && statusCode <= 599) {
      throw new Error(`Server OpenRouter sedang gangguan (${statusCode}). Coba lagi nanti.`);
    } else if (lowerErrorMessage.includes('api key')) {
      throw new Error('API key OpenRouter tidak valid atau belum diatur.');
    } else {
      throw error;
    }
  }
}

async function askAi(message, userId, platform, logUserId) {
  return askGemini(message, userId, platform, logUserId);
}

async function askAiDetailed(message, userId, platform, logUserId) {
  return askGeminiDetailed(message, userId, platform, logUserId);
}

/**
 * Fungsi untuk menerjemahkan teks menggunakan OpenRouter
 * @param {string} lang - Kode atau nama bahasa tujuan
 * @param {string} text - Teks yang akan diterjemahkan
 * @returns {Promise<string>} - Hasil terjemahan
 */
async function translateText(lang, text) {
  if (!apiKey) throw new Error('API key OpenRouter tidak ditemukan.');

  const translateInstruction = `You are a professional native translator. Translate the given text into ${lang} language. ONLY output the translated text. Do not add any explanations, notes, or quotes.`;

  const response = await openai.chat.completions.create({
    model: AI_MODELS['gpt-oss'].id, // Model default yang cepat
    messages: [
      { role: 'system', content: translateInstruction },
      { role: 'user', content: text }
    ],
    temperature: 0.3, // Lebih rendah agar hasil terjemahan presisi
    max_tokens: 1024,
  });

  const content = response?.choices?.[0]?.message?.content;
  return Array.isArray(content)
      ? content.map((part) => part?.text || '').join('\n').trim()
      : String(content || '').trim();
}

module.exports = { askGemini, askGeminiDetailed, askAi, askAiDetailed, translateText, modelName };
