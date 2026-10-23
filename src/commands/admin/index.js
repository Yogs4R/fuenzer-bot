const { checkWebsites, formatMonitorMessage } = require('../../services/monitorService');
const { getUniqueUsers } = require('../../services/broadcastService');
const supabase = require('../../lib/supabaseClient');
const delay = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

function formatNumber(value) {
  return Number(value || 0).toLocaleString('en-US');
}

function formatPercent(value) {
  const normalized = Number(value || 0);
  const rounded = Math.round(normalized * 10) / 10;
  return Number.isInteger(rounded) ? String(rounded) : rounded.toFixed(1);
}

const { escapeHtml } = require('../../utils/textFormatter');

async function getCommandUsageStats() {
  const { count: totalExecution, error: totalError } = await supabase
    .from('command_logs')
    .select('*', { count: 'exact', head: true });

  if (totalError) {
    throw totalError;
  }

  const { data: userRows, error: userError } = await supabase
    .from('command_logs')
    .select('user_id');

  if (userError) {
    throw userError;
  }

  const { data: commandRows, error: commandError } = await supabase
    .from('command_logs')
    .select('command');

  if (commandError) {
    throw commandError;
  }

  const uniqueUsers = new Set(
    (userRows || [])
      .map((row) => String(row.user_id || '').trim())
      .filter(Boolean)
  ).size;

  const commandCounter = new Map();
  for (const row of commandRows || []) {
    const command = String(row.command || '').trim();
    if (!command) {
      continue;
    }
    commandCounter.set(command, (commandCounter.get(command) || 0) + 1);
  }

  const topCommands = Array.from(commandCounter.entries())
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5)
    .map(([command, count]) => ({ command, count }));

  return {
    totalExecution: Number(totalExecution || 0),
    uniqueUsers,
    topCommands
  };
}

async function getAIUsageStats() {
  const { data: aiRows, error } = await supabase
    .from('ai_logs')
    .select('model, input_tokens, output_tokens');

  if (error) {
    throw error;
  }

  const rows = aiRows || [];
  const totalChat = rows.length;

  let totalInputTokens = 0;
  let totalOutputTokens = 0;
  const modelCounter = new Map();

  for (const row of rows) {
    totalInputTokens += Number(row.input_tokens || 0);
    totalOutputTokens += Number(row.output_tokens || 0);

    const model = String(row.model || '').trim();
    if (!model) {
      continue;
    }

    modelCounter.set(model, (modelCounter.get(model) || 0) + 1);
  }

  const topModels = Array.from(modelCounter.entries())
    .sort((a, b) => b[1] - a[1])
    .slice(0, 3)
    .map(([model, count]) => ({
      model,
      count,
      percentage: totalChat > 0 ? (count / totalChat) * 100 : 0
    }));

  return {
    totalChat,
    totalInputTokens,
    totalOutputTokens,
    topModels
  };
}

const { t } = require('../../utils/i18n');

async function handleAdminCommand(command, args, userId, platform, options = {}) {
  void args;
  void userId;

  const cleanCommand = String(command || '').toLowerCase();
  const platformName = String(platform || '').toLowerCase().trim();
  const isWhatsApp = platformName === 'whatsapp';
  const lang = options?.lang || 'en';

  switch (cleanCommand) {
    case '/admin': {
      const header = t('admin.menu_header', {}, lang);
      const body = t('admin.menu_body', {}, lang);
      const footer = ['—'.repeat(19), t('admin.menu_footer', {}, lang)].join('\n');
      return `${header}\n\n${body}\n\n${footer}`;
    }

    case '/answer': {
      const targetUserId = args[0];
      const jawaban = args.slice(1).join(' ').trim();

      if (!targetUserId || !jawaban) {
        return isWhatsApp 
          ? 'Format salah. Gunakan: `/answer [user_id] [pesan_jawaban]`' 
          : 'Format salah. Gunakan: <code>/answer [user_id] [pesan_jawaban]</code>';
      }

      const sendToUser = options.sendToUser;
      if (typeof sendToUser !== 'function') {
        return isWhatsApp
          ? '> *ERROR ANSWER* ❌\n\nFungsi sendToUser belum dikonfigurasi.'
          : '<b>ERROR ANSWER</b> ❌\n\nFungsi sendToUser belum dikonfigurasi.';
      }

      try {
        const payload = isWhatsApp
          ? `👨‍💻 *BALASAN ADMIN FUENZER:*\n\n${jawaban}`
          : `👨‍💻 <b>BALASAN ADMIN FUENZER:</b>\n\n${escapeHtml(jawaban)}`;
          
        await sendToUser(targetUserId, payload);
        return `✅ Jawaban berhasil dikirim ke ${targetUserId}.`;
      } catch (err) {
        return `❌ Gagal mengirim pesan. Pastikan ID target valid.\nError: ${err.message}`;
      }
    }

    case '/broadcast': {
      const broadcastMsg = args.join(' ').trim();
      if (!broadcastMsg) {
        return '❌ Harap masukkan pesan! Contoh: /broadcast Halo semua, bot sedang maintenance.';
      }

      const targets = await getUniqueUsers(platformName);
      if (!Array.isArray(targets) || targets.length === 0) {
        return '❌ Tidak ada pengguna yang ditemukan.';
      }

      const notifyAdmin = options.notifyAdmin;
      const sendToUser = options.sendToUser;

      if (typeof notifyAdmin !== 'function' || typeof sendToUser !== 'function') {
        return isWhatsApp
          ? '> *ERROR BROADCAST* ❌\n\nSender broadcast belum dikonfigurasi.'
          : '<b>ERROR BROADCAST</b> ❌\n\nSender broadcast belum dikonfigurasi.';
      }

      await notifyAdmin(`⏳ Memulai broadcast ke ${targets.length} pengguna... Mohon tunggu.`);

      let success = 0;
      let failed = 0;
      const payload = `[ 📢 BROADCAST ADMIN ]\n\n${broadcastMsg}`;

      for (const target of targets) {
        try {
          await sendToUser(target, payload);
          success += 1;
        } catch (_error) {
          failed += 1;
        }

        await delay(3000);
      }

      await notifyAdmin(`✅ Broadcast selesai!\nSukses: ${success}\nGagal: ${failed}`);
      return '';
    }

    case '/monitor': {
      const { results } = await checkWebsites();
      return formatMonitorMessage(results, null, platformName);
    }

    case '/cmd_usage': {
      try {
        const usageStats = await getCommandUsageStats();
        const topLines = usageStats.topCommands.length > 0
          ? usageStats.topCommands
            .map((item, index) => `${index + 1}. ${item.command} (${formatNumber(item.count)})`)
            .join('\n')
          : (lang === 'id' ? 'Belum ada data command.' : 'No command data yet.');

        const header = t('admin.cmd_usage_header', {}, lang);
        const labelTotal = t('admin.cmd_usage_total', {}, lang);
        const labelUsers = t('admin.cmd_usage_users', {}, lang);
        const labelTop = t('admin.cmd_usage_top', {}, lang);

        const body = [
          `${labelTotal}: ${formatNumber(usageStats.totalExecution)}`,
          `${labelUsers}: ${formatNumber(usageStats.uniqueUsers)}`,
          '',
          `${labelTop}:`,
          topLines
        ].join('\n');

        return `${header}\n\n${body}`;
      } catch (error) {
        const errorHeader = isWhatsApp ? '> *ERROR CMD USAGE* ❌' : '<b>ERROR CMD USAGE</b> ❌';
        const errorBody = `Failed to retrieve command usage data: ${error.message}`;
        return `${errorHeader}\n\n${errorBody}`;
      }
    }

    case '/ai_usage': {
      try {
        const aiUsageStats = await getAIUsageStats();
        const topLines = aiUsageStats.topModels.length > 0
          ? aiUsageStats.topModels
            .map((item, index) => `${index + 1}. ${item.model} (${formatPercent(item.percentage)}%)`)
            .join('\n')
          : (lang === 'id' ? 'Belum ada data model.' : 'No model data yet.');

        const header = t('admin.ai_usage_header', {}, lang);
        const labelChats = t('admin.ai_usage_total_chats', {}, lang);
        const labelIn = t('admin.ai_usage_input_tokens', {}, lang);
        const labelOut = t('admin.ai_usage_output_tokens', {}, lang);

        const body = [
          `${labelChats}: ${formatNumber(aiUsageStats.totalChat)}`,
          `${labelIn}: ${formatNumber(aiUsageStats.totalInputTokens)}`,
          `${labelOut}: ${formatNumber(aiUsageStats.totalOutputTokens)}`,
          '',
          'TOP MODELS:',
          topLines
        ].join('\n');

        return `${header}\n\n${body}`;
      } catch (error) {
        const errorHeader = isWhatsApp ? '> *ERROR AI USAGE* ❌' : '<b>ERROR AI USAGE</b> ❌';
        const errorBody = `Failed to retrieve AI usage data: ${error.message}`;
        return `${errorHeader}\n\n${errorBody}`;
      }
    }

    default: {
      if (isWhatsApp) {
        const header = '> *COMMAND ADMIN TIDAK DIKENAL* ❌';
        const body = [
          `Perintah admin "${cleanCommand}" tidak tersedia.`,
          'Gunakan \`/admin\` untuk melihat daftar command admin.'
        ].join('\n');
        return `${header}\n\n${body}`;
      }

      const header = '<b>COMMAND ADMIN TIDAK DIKENAL</b> ❌';
      const body = [
        `Perintah admin "${cleanCommand}" tidak tersedia.`,
        'Gunakan /admin untuk melihat daftar command admin.'
      ].join('\n');
      return `${header}\n\n${body}`;
    }
  }
}

module.exports = {
  handleAdminCommand
};