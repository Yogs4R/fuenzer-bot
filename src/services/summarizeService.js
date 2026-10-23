const OpenAI = require('openai');
const chatBufferService = require('./chatBufferService');
const { t } = require('../utils/i18n');

const DEFAULT_GEMMA_MODEL = 'google/gemma-4-26b-a4b-it';

let openAiClient = null;

function getOpenAiClient() {
  if (!openAiClient) {
    const apiKey = process.env.OPENROUTER_API_KEY;
    if (!apiKey) {
      console.warn('[summarizeService] OPENROUTER_API_KEY is not defined in environment variables.');
    }
    openAiClient = new OpenAI({
      baseURL: 'https://openrouter.ai/api/v1',
      apiKey: apiKey || 'dummy-key-for-offline-test'
    });
  }
  return openAiClient;
}

/**
 * Formats decrypted raw chat records into a clean, chronologically sorted transcript.
 *
 * @param {Array<Object>} messages - Array of message objects from chatBufferService
 * @returns {string} Formatted transcript
 */
function formatChatTranscript(messages = []) {
  if (!Array.isArray(messages) || messages.length === 0) {
    return '';
  }

  const sorted = [...messages].sort((a, b) => new Date(a.createdAt) - new Date(b.createdAt));

  return sorted.map((msg) => {
    let timeStr = '';
    try {
      const d = new Date(msg.createdAt);
      timeStr = !isNaN(d.getTime())
        ? d.toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' })
        : '00:00';
    } catch (_) {
      timeStr = '00:00';
    }

    const sender = (msg.senderName || 'Anonymous').trim();
    const text = (msg.messageText || '').trim();
    return `[${timeStr}] ${sender}: ${text}`;
  }).join('\n');
}

/**
 * Builds the structured system and user prompts for Gemma adhering to the "Slow and Steady" Sloth Butler persona.
 *
 * @param {string} transcript - Formatted chat transcript
 * @param {string} [language='en'] - 'en' or 'id'
 * @returns {{ systemPrompt: string, userPrompt: string }}
 */
function buildSummarizePrompt(transcript, language = 'en') {
  const isEn = language === 'en';

  const systemPrompt = isEn
    ? `You are Fuenzer Bot's Sloth Butler 🦥 — an exceptionally intelligent, calm, and relaxed personal assistant who eliminates the chore of reading noisy group chats.
Your goal is to save the user from context-switching and dreading unread notifications by providing a pristine, highly actionable Morning Briefing.

Respond in English. Format your response into exactly three structured sections:
1. 🦥 *Sloth TL;DR*
   (A relaxed, concise 2–3 sentence executive summary capturing the core topics and general atmosphere).
2. 🎯 *Key Action Items & Mentions*
   (Bullet points of tasks, questions, decisions, links, or deadlines. If none exist, write "- None detected.").
3. 📊 *Chatter & Activity Snapshot*
   (Brief observation on message volume, top active contributors, and signal-to-noise ratio).

Style rules:
- Do NOT use markdown tables (| Column |). Use clear bullet points (-).
- Keep it concise, friendly, and zero-effort to read on a smartphone screen.`
    : `Kamu adalah Butler Sloth Fuenzer Bot 🦥 — asisten pribadi yang santai, cerdas, dan bijak yang bertugas membaca tumpukan chat grup yang ramai agar pengguna tidak perlu repot membaca semuanya.
Tujuanmu adalah menyelamatkan pengguna dari capek membaca ratusan notifikasi dengan memberikan Ringkasan Pagi (Morning Briefing) yang bersih dan praktis.

Balas dalam Bahasa Indonesia. Format jawabanmu ke dalam 3 bagian terstruktur berikut:
1. 🦥 *Ringkasan Santai (Sloth TL;DR)*
   (2–3 kalimat santai dan padat yang merangkum inti pembicaraan dan suasana obrolan).
2. 🎯 *Tindak Lanjut & Mention Penting*
   (Daftar poin berisi tugas, keputusan, pengumuman, atau hal penting. Jika tidak ada, tulis "- Tidak ada tindak lanjut khusus.").
3. 📊 *Statistik & Suasana Obrolan*
   (Ulasan singkat volume obrolan, kontributor paling aktif, dan perbandingan obrolan penting vs basa-basi).

Aturan format:
- JANGAN gunakan tabel Markdown. Gunakan bullet point (-) atau daftar berangka.
- Buat agar nyaman dibaca di layar HP tanpa terasa melelahkan.`;

  const userPrompt = isEn
    ? `Please read and summarize the following group chat history:\n\n${transcript}\n\nDeliver the Morning Sloth Briefing:`
    : `Tolong baca dan rangkum riwayat percakapan grup berikut:\n\n${transcript}\n\nBerikan Morning Sloth Briefing:`;

  return { systemPrompt, userPrompt };
}

/**
 * Generates an executive group chat summary using Google Gemma via OpenRouter API.
 * Automatically decrypts messages from chat_buffer and flags them as summarized upon success.
 *
 * @param {Object} params
 * @param {string} params.platform - 'whatsapp' | 'telegram'
 * @param {string} params.chatId - Group / room identifier
 * @param {string} [params.language='en'] - 'en' or 'id'
 * @param {string} [params.modelOverride] - Optional model override
 * @returns {Promise<{ success: boolean, summaryText?: string, messageCount?: number, model?: string, reason?: string, error?: string }>}
 */
async function generateGroupSummary({ platform, chatId, language = 'en', modelOverride, autoMarkSummarized = false }) {
  const cleanPlatform = String(platform || '').toLowerCase().trim();
  const cleanChatId = String(chatId || '').trim();
  const resolvedLang = language === 'id' ? 'id' : 'en';

  if (!cleanPlatform || !cleanChatId) {
    return {
      success: false,
      reason: 'missing_params',
      error: 'Platform and Chat ID are required.'
    };
  }

  // 1. Fetch unsummarized decrypted messages from chat_buffer
  const messages = await chatBufferService.getPendingMessages(cleanPlatform, cleanChatId, { limit: 200 });

  if (!messages || messages.length === 0) {
    return {
      success: false,
      reason: 'no_messages',
      error: t('summarize.no_messages', {}, resolvedLang)
    };
  }

  // 2. Format transcript
  const transcript = formatChatTranscript(messages);
  const { systemPrompt, userPrompt } = buildSummarizePrompt(transcript, resolvedLang);

  const selectedModel = modelOverride || process.env.GEMMA_MODEL || DEFAULT_GEMMA_MODEL;
  const client = getOpenAiClient();

  try {
    const completion = await client.chat.completions.create({
      model: selectedModel,
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userPrompt }
      ],
      temperature: 0.7,
      max_tokens: 1500
    });

    const summaryText = completion.choices?.[0]?.message?.content?.trim();

    if (!summaryText) {
      throw new Error('Received empty response from Gemma model.');
    }

    // 3. Mark processed messages as summarized only if requested (default false to keep pending until delivery)
    const messageIds = messages.map((m) => m.id).filter(Boolean);
    if (autoMarkSummarized && messageIds.length > 0) {
      await chatBufferService.markMessagesAsSummarized(messageIds);
    }

    return {
      success: true,
      summaryText,
      messageCount: messages.length,
      messageIds,
      model: selectedModel,
      usage: completion.usage
    };
  } catch (err) {
    console.error(`[summarizeService] Gemma API error for ${cleanPlatform}:${cleanChatId}:`, err.message);
    return {
      success: false,
      reason: 'api_error',
      error: err.message
    };
  }
}

module.exports = {
  generateGroupSummary,
  formatChatTranscript,
  buildSummarizePrompt,
  DEFAULT_GEMMA_MODEL
};
