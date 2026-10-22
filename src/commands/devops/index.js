// DevOps and System diagnostics command handler
const os = require('os');
const { isAdmin } = require('../../utils/auth');
const { checkWebsites, formatMonitorMessage, getMonitorWebsiteLinks } = require('../../services/monitorService');
const { handleAboutMeCommand } = require('../../services/aboutService');

function formatDuration(seconds) {
  const totalSeconds = Math.max(0, Math.floor(seconds || 0));
  const days = Math.floor(totalSeconds / 86400);
  const hours = Math.floor((totalSeconds % 86400) / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);

  const parts = [];
  if (days > 0) parts.push(`${days}h`);
  parts.push(`${hours}j`);
  parts.push(`${minutes}m`);
  return parts.join(' ');
}

function getCpuUsagePercent() {
  const cpus = os.cpus() || [];
  if (cpus.length === 0) return 0;

  let idle = 0;
  let total = 0;
  for (const cpu of cpus) {
    const times = cpu.times || {};
    idle += times.idle || 0;
    total += (times.user || 0) + (times.nice || 0) + (times.sys || 0) + (times.idle || 0) + (times.irq || 0);
  }

  if (total <= 0) return 0;
  return Math.round((1 - (idle / total)) * 100);
}

function getRamUsageText() {
  const total = os.totalmem();
  const free = os.freemem();
  const used = Math.max(total - free, 0);
  const usedGb = (used / (1024 ** 3)).toFixed(1);
  const totalGb = (total / (1024 ** 3)).toFixed(1);
  return `${usedGb}/${totalGb} GB`;
}

function buildSystemStatsFooter(platform = 'whatsapp') {
  const isWhatsApp = String(platform || '').toLowerCase() === 'whatsapp';
  if (isWhatsApp) {
    return [
      '—'.repeat(19),
      `*CPU:* ${getCpuUsagePercent()}%`,
      `*RAM:* ${getRamUsageText()}`,
      `*UPTIME:* ${formatDuration(os.uptime())}`,
      `*STATUS:* ONLINE`
    ].join('\n');
  }

  return [
    '—'.repeat(19),
    `CPU: ${getCpuUsagePercent()}%`,
    `RAM: ${getRamUsageText()}`,
    `UPTIME: ${formatDuration(os.uptime())}`,
    `STATUS: ONLINE`
  ].join('\n');
}

async function handleDevopsCommand(command, args = [], userId = '', platform = 'whatsapp') {
  const cleanCommand = String(command || '').toLowerCase().trim();

  switch (cleanCommand) {
    case '/ping':
    case '/system': {
      const footer = buildSystemStatsFooter(platform);
      return `Pong! 🏓\n\n${footer}`;
    }

    case '/me': {
      return await handleAboutMeCommand(command, args, userId, platform);
    }

    case '/monitor': {
      if (!isAdmin(userId, platform)) {
        return platform === 'whatsapp'
          ? '> *AKSES DITOLAK* ❌\n\nCommand ini khusus admin.'
          : '<b>AKSES DITOLAK</b> ❌\n\nCommand ini khusus admin.';
      }

      const { results } = await checkWebsites();
      return formatMonitorMessage(results, null, platform);
    }

    default:
      return platform === 'whatsapp'
        ? '> *COMMAND TIDAK DIKENAL* ❌\n\nPerintah devops tidak tersedia.'
        : '<b>COMMAND TIDAK DIKENAL</b> ❌\n\nPerintah devops tidak tersedia.';
  }
}

module.exports = handleDevopsCommand;
module.exports.handleDevopsCommand = handleDevopsCommand;
module.exports.buildSystemStatsFooter = buildSystemStatsFooter;
module.exports.formatDuration = formatDuration;
module.exports.getCpuUsagePercent = getCpuUsagePercent;
module.exports.getRamUsageText = getRamUsageText;
module.exports.getMonitorWebsiteLinks = getMonitorWebsiteLinks;
