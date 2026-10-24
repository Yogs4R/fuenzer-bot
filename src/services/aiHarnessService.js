// AI Agent Harness Service (Natural Language Tool Calling Orchestrator)
// Invariant: [AD-01] Transport agnostic, [AD-11] Domain service tool-calling orchestrator

const financeService = require('./financeService');
const weatherService = require('./weatherService');
const reminderService = require('./reminderService');
const religionService = require('./religionService');
const researchService = require('./researchService');
const { getActiveModel, getModelById, AI_MODELS } = require('./aiPreferenceService');
const { createChatCompletionWithTools } = require('../lib/openrouterClient');
const { logAIUsage } = require('./logService');

/**
 * Standardized OpenAI-compatible tool schemas for domain services.
 */
const HARNESS_TOOLS = [
  {
    type: 'function',
    function: {
      name: 'record_expense',
      description: 'Record an expense or money spent by the user (e.g. coffee, food, groceries, bills, shopping).',
      parameters: {
        type: 'object',
        properties: {
          amount: {
            type: 'number',
            description: 'The numeric amount of money spent (e.g. 35000, 120000).'
          },
          description: {
            type: 'string',
            description: 'Short description of what the money was spent on (e.g. "kopi", "lunch with team", "groceries").'
          }
        },
        required: ['amount', 'description']
      }
    }
  },
  {
    type: 'function',
    function: {
      name: 'record_income',
      description: 'Record an income or money received by the user (e.g. salary, freelance, transfer, bonus, gift).',
      parameters: {
        type: 'object',
        properties: {
          amount: {
            type: 'number',
            description: 'The numeric amount of money received (e.g. 500000, 2500000).'
          },
          description: {
            type: 'string',
            description: 'Short description of the income source (e.g. "gaji", "freelance web dev", "hadiah").'
          }
        },
        required: ['amount', 'description']
      }
    }
  },
  {
    type: 'function',
    function: {
      name: 'check_balance',
      description: 'Check the current balance, total income, and total expenses of the user.',
      parameters: {
        type: 'object',
        properties: {}
      }
    }
  },
  {
    type: 'function',
    function: {
      name: 'get_weather',
      description: 'Get current weather conditions, temperature, humidity, and forecast for a specific city or region.',
      parameters: {
        type: 'object',
        properties: {
          city: {
            type: 'string',
            description: 'City or district name (e.g. "Jakarta", "Bandung", "Surabaya", "Tokyo", "London").'
          }
        },
        required: ['city']
      }
    }
  },
  {
    type: 'function',
    function: {
      name: 'set_reminder',
      description: 'Set a timed reminder / alarm for a future delay (e.g. "10m", "1h", "2h", "1d").',
      parameters: {
        type: 'object',
        properties: {
          time: {
            type: 'string',
            description: 'Time delay string compatible with ms library (e.g. "10m", "30m", "1h", "2h", "1d").'
          },
          message: {
            type: 'string',
            description: 'The reminder note or task text (e.g. "call Alex", "jemput adik", "bayar wifi").'
          }
        },
        required: ['time', 'message']
      }
    }
  },
  {
    type: 'function',
    function: {
      name: 'get_prayer_times',
      description: 'Get daily Islamic prayer timetable (Subuh, Dzuhur, Ashar, Maghrib, Isya, Imsak) for a city in Indonesia.',
      parameters: {
        type: 'object',
        properties: {
          city: {
            type: 'string',
            description: 'Name of the city in Indonesia (e.g. "Jakarta", "Bandung", "Surabaya", "Medan").'
          }
        },
        required: ['city']
      }
    }
  },
  {
    type: 'function',
    function: {
      name: 'search_book',
      description: 'Search for book titles, authors, and reference information from Open Library.',
      parameters: {
        type: 'object',
        properties: {
          query: {
            type: 'string',
            description: 'Book title, topic, or author keywords (e.g. "Clean Code", "Artificial Intelligence").'
          }
        },
        required: ['query']
      }
    }
  }
];

/**
 * Executes a single tool call against decoupled domain services.
 *
 * @param {string} toolName - Name of the tool
 * @param {Object} args - Tool arguments
 * @param {Object} context - Execution context { userId, lang, platform }
 * @returns {Promise<Object>} Execution result object
 */
async function executeToolCall(toolName, args = {}, context = {}) {
  const { userId, lang = 'en', platform = 'whatsapp' } = context;

  try {
    switch (toolName) {
      case 'record_expense': {
        const amount = Number(args.amount);
        const description = String(args.description || 'Pengeluaran').trim();
        const txResult = typeof financeService.addTransactionRecord === 'function'
          ? await financeService.addTransactionRecord(userId, amount, 'OUT', description, platform, lang)
          : { success: true, message: await financeService.addTransaction(userId, amount, 'OUT', description, platform, lang) };

        if (!txResult.success) {
          return {
            success: false,
            tool: 'record_expense',
            type: 'OUT',
            amount,
            description,
            error: txResult.error || 'Failed to record expense',
            output: txResult.message
          };
        }

        return {
          success: true,
          tool: 'record_expense',
          type: 'OUT',
          amount,
          description,
          output: txResult.message
        };
      }

      case 'record_income': {
        const amount = Number(args.amount);
        const description = String(args.description || 'Pemasukan').trim();
        const txResult = typeof financeService.addTransactionRecord === 'function'
          ? await financeService.addTransactionRecord(userId, amount, 'IN', description, platform, lang)
          : { success: true, message: await financeService.addTransaction(userId, amount, 'IN', description, platform, lang) };

        if (!txResult.success) {
          return {
            success: false,
            tool: 'record_income',
            type: 'IN',
            amount,
            description,
            error: txResult.error || 'Failed to record income',
            output: txResult.message
          };
        }

        return {
          success: true,
          tool: 'record_income',
          type: 'IN',
          amount,
          description,
          output: txResult.message
        };
      }

      case 'check_balance': {
        const output = await financeService.checkSaldo(userId, lang);
        return {
          success: true,
          tool: 'check_balance',
          output
        };
      }

      case 'get_weather': {
        const city = String(args.city || '').trim();
        const output = await weatherService.getCuaca(city, lang);
        return {
          success: true,
          tool: 'get_weather',
          city,
          output
        };
      }

      case 'set_reminder': {
        const time = String(args.time || '').trim();
        const message = String(args.message || '').trim();
        const reminderRecord = await reminderService.addReminder(userId, time, message);
        return {
          success: true,
          tool: 'set_reminder',
          reminderId: reminderRecord?.id,
          time,
          message,
          output: lang === 'en'
            ? `Reminder set successfully for "${message}" in ${time} (ID: ${reminderRecord?.id}).`
            : `Pengingat berhasil dipasang untuk "${message}" dalam ${time} (ID: ${reminderRecord?.id}).`
        };
      }

      case 'get_prayer_times': {
        const city = String(args.city || '').trim();
        const output = await religionService.getSholat(city, lang);
        return {
          success: true,
          tool: 'get_prayer_times',
          city,
          output
        };
      }

      case 'search_book': {
        const query = String(args.query || '').trim();
        const books = await researchService.searchBooks(query);
        return {
          success: true,
          tool: 'search_book',
          query,
          count: Array.isArray(books) ? books.length : 0,
          books: Array.isArray(books) ? books.slice(0, 3) : []
        };
      }

      default:
        return {
          success: false,
          tool: toolName,
          error: `Unknown tool: ${toolName}`
        };
    }
  } catch (err) {
    console.error(`[aiHarnessService] Execution error on tool "${toolName}":`, err.message);
    return {
      success: false,
      tool: toolName,
      error: err.message
    };
  }
}

const { convertMarkdownTablesToBullets } = require('../utils/textFormatter');

/**
 * Builds the Sloth Butler system prompt with conversational instructions.
 *
 * @param {string} lang - 'en' or 'id'
 * @returns {string} System instruction string
 */
function buildHarnessSystemPrompt(lang = 'en') {
  const isEn = lang === 'en';
  return isEn
    ? `You are Fuenzer Bot, a calm, warm, and highly dependable "sloth butler" personal productivity assistant.
Your motto is "slow, steady, and deliberate" — helping the user stay organized without stress.
You have access to specialized productivity tools:
- record_expense: Log expenses or money spent
- record_income: Log income or earnings
- check_balance: Check current financial balance and totals
- get_weather: Check weather in any city
- set_reminder: Set a future reminder (delay like "10m", "1h", "2h", "1d")
- get_prayer_times: Query daily prayer times in Indonesia
- search_book: Search book titles and references from Open Library

CORE RULES:
1. When the user asks you to take an action, call the corresponding tool(s).
2. If the user asks for multiple actions in one message (e.g. "record $10 for lunch and check weather in Tokyo"), call ALL appropriate tools in parallel!
3. If the user is having a casual conversation, asking questions, or asking for help, reply helpfully and warmly without forcing tool calls.
4. After receiving tool results, synthesize a friendly, charming confirmation summarizing what was accomplished. Mention numbers, remaining balances, temperatures, or reminder times clearly.
5. Tone: Relaxed, polite, helpful, with a subtle sloth butler charm (use 🦥 or relevant emojis sparingly).
6. Language: You MUST reply in English.
7. STRICT FORMATTING: NEVER use Markdown tables (| Column | Column |). If presenting tabular data, lists, or comparisons, ALWAYS use clean bullet points (- Item: Value) or numbered lists (1. 2. 3.).`
    : `Kamu adalah Fuenzer Bot, asisten pribadi "sloth butler" milik Ridwan Yoga Suryantara yang tenang, santai, dan sangat bisa diandalkan.
Prinsipmu adalah "pelan tapi pasti" (slow and steady) — membantu pengguna tetap teratur dan produktif tanpa rasa cemas.
Kamu punya akses ke tools produktivitas:
- record_expense: Catat pengeluaran atau uang keluar
- record_income: Catat pemasukan atau uang masuk
- check_balance: Cek saldo terkini dan total keuangan
- get_weather: Cek kondisi dan prakiraan cuaca kota
- set_reminder: Pasang alarm/pengingat waktu (contoh jeda: "10m", "1h", "2h", "1d")
- get_prayer_times: Cek jadwal sholat kota di Indonesia
- search_book: Cari referensi buku dari Open Library

ATURAN UTAMA:
1. Saat pengguna meminta aksi (misal catat pengeluaran, cek saldo, cek cuaca, pasang pengingat), panggil tool yang relevan.
2. Jika pengguna meminta beberapa aksi sekaligus dalam satu pesan (contoh: "catat 35rb beli kopi dan cek cuaca Bandung"), panggil SEMUA tool yang dibutuhkan!
3. Jika pengguna hanya menyapa, ngobrol santai, atau bertanya materi/coding biasa, jawablah dengan ramah tanpa memaksakan pemanggilan tool.
4. Setelah menerima hasil tool, rangkai jawaban konfirmasi yang ramah, jelas, dan santai. Sebutkan nominal yang dicatat, sisa saldo, kondisi cuaca, atau waktu pengingat secara rapi.
5. Gaya bahasa: Santai, sopan, ramah dengan sentuhan sloth butler (gunakan emoji 🦥 atau emoji pendukung secukupnya).
6. Bahasa: Wajib membalas dalam Bahasa Indonesia.
7. FORMAT PESAN: DILARANG KERAS menggunakan Tabel Markdown (| Kolom |). Selalu gunakan Bullet Points (-) atau Numbered Lists (1. 2. 3.) untuk daftar atau perbandingan data.`;
}

/**
 * Formats markdown text for WhatsApp compatibility.
 */
function formatWhatsAppMarkdown(text) {
  if (!text || typeof text !== 'string') return '';
  const withoutTables = convertMarkdownTablesToBullets(text);
  return withoutTables
    .replace(/\*\*(.*?)\*\*/g, '*$1*')
    .replace(/^#+\s*(.*)$/gm, '*$1*')
    .replace(/^\s*\*\s+/gm, '- ');
}

/**
 * Runs the AI Harness conversational pipeline with multi-turn tool calling.
 *
 * @param {Object} params
 * @param {string} params.text - User text input
 * @param {string} params.userId - User identifier
 * @param {string} [params.platform] - 'whatsapp' | 'telegram'
 * @param {string} [params.lang] - User language ('en' | 'id')
 * @param {string} [params.realId] - Actual sender ID for logging
 * @returns {Promise<{ text: string, model: string, modelName: string, usage: Object, rpm: Object, toolCalls: Array }>}
 */
async function runAiHarnessChat({
  text,
  userId,
  platform = 'whatsapp',
  lang = 'en',
  realId = null
}) {
  const canonicalUserId = typeof realId === 'string' && realId.trim() ? realId.trim() : userId;
  const activeModelId = await getActiveModel(canonicalUserId, platform);
  const fallbackModelId = AI_MODELS['gemma4']?.id || 'google/gemma-4-26b-a4b-it';

  const systemPrompt = buildHarnessSystemPrompt(lang);
  const messages = [
    { role: 'system', content: systemPrompt },
    { role: 'user', content: text }
  ];

  let selectedModelId = activeModelId;
  let firstTurnResult;

  // Attempt 1: Call with active model
  try {
    firstTurnResult = await createChatCompletionWithTools({
      model: selectedModelId,
      messages,
      tools: HARNESS_TOOLS
    });
  } catch (modelErr) {
    console.warn(`[aiHarnessService] Model ${selectedModelId} failed on tool calling:`, modelErr.message);

    // If active model failed and is different from fallback, retry with fallback model
    if (selectedModelId !== fallbackModelId) {
      console.log(`[aiHarnessService] Retrying with fallback model ${fallbackModelId}...`);
      selectedModelId = fallbackModelId;
      firstTurnResult = await createChatCompletionWithTools({
        model: selectedModelId,
        messages,
        tools: HARNESS_TOOLS
      });
    } else {
      throw modelErr;
    }
  }

  const firstMessage = firstTurnResult?.message;
  const toolCalls = firstMessage?.tool_calls;

  let totalPromptTokens = firstTurnResult.usage.promptTokenCount;
  let totalCandidatesTokens = firstTurnResult.usage.candidatesTokenCount;
  let finalRpm = firstTurnResult.rpm;
  const executedToolSummaries = [];

  // Case A: No tools called (Standard conversational response)
  if (!Array.isArray(toolCalls) || toolCalls.length === 0) {
    const rawContent = firstMessage?.content || '';
    const finalText = platform === 'whatsapp' ? formatWhatsAppMarkdown(rawContent) : rawContent;
    const modelMeta = getModelById(selectedModelId);

    const logUserId = typeof realId === 'string' ? realId : userId;
    await logAIUsage(
      logUserId,
      platform,
      selectedModelId,
      text,
      totalPromptTokens,
      totalCandidatesTokens
    );

    return {
      text: finalText,
      model: selectedModelId,
      modelName: modelMeta?.name || selectedModelId,
      usage: {
        promptTokenCount: totalPromptTokens,
        candidatesTokenCount: totalCandidatesTokens,
        totalTokenCount: totalPromptTokens + totalCandidatesTokens
      },
      rpm: finalRpm,
      toolCalls: []
    };
  }

  // Case B: Tools were called -> execute tools and run second turn for butler summary
  console.log(`[aiHarnessService] Detected ${toolCalls.length} tool call(s) for user ${userId}.`);

  // Append assistant message with tool calls to conversation history
  messages.push(firstMessage);

  for (const call of toolCalls) {
    const fnName = call.function?.name;
    let fnArgs = {};
    try {
      fnArgs = typeof call.function?.arguments === 'string'
        ? JSON.parse(call.function.arguments)
        : (call.function?.arguments || {});
    } catch (parseErr) {
      console.warn(`[aiHarnessService] Failed to parse arguments for tool ${fnName}:`, parseErr.message);
      fnArgs = {};
    }

    const toolResult = await executeToolCall(fnName, fnArgs, { userId, lang, platform });
    executedToolSummaries.push({
      id: call.id,
      name: fnName,
      args: fnArgs,
      result: toolResult
    });

    messages.push({
      role: 'tool',
      tool_call_id: call.id,
      content: JSON.stringify(toolResult)
    });
  }

  // Second turn: LLM synthesizes natural confirmation with tool results
  const secondTurnResult = await createChatCompletionWithTools({
    model: selectedModelId,
    messages
  });

  totalPromptTokens += secondTurnResult.usage.promptTokenCount;
  totalCandidatesTokens += secondTurnResult.usage.candidatesTokenCount;
  finalRpm = secondTurnResult.rpm;

  const rawSecondTurnContent = secondTurnResult.message?.content || '';
  const finalSummaryText = platform === 'whatsapp'
    ? formatWhatsAppMarkdown(rawSecondTurnContent)
    : rawSecondTurnContent;

  const modelMeta = getModelById(selectedModelId);
  const logUserId = typeof realId === 'string' ? realId : userId;

  await logAIUsage(
    logUserId,
    platform,
    selectedModelId,
    text,
    totalPromptTokens,
    totalCandidatesTokens
  );

  return {
    text: finalSummaryText,
    model: selectedModelId,
    modelName: modelMeta?.name || selectedModelId,
    usage: {
      promptTokenCount: totalPromptTokens,
      candidatesTokenCount: totalCandidatesTokens,
      totalTokenCount: totalPromptTokens + totalCandidatesTokens
    },
    rpm: finalRpm,
    toolCalls: executedToolSummaries
  };
}

module.exports = {
  HARNESS_TOOLS,
  buildHarnessSystemPrompt,
  executeToolCall,
  runAiHarnessChat,
  formatWhatsAppMarkdown
};
