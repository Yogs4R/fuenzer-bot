// DevOps and System diagnostics command handler
const os = require('os');
const { isAdmin } = require('../../utils/auth');
const { checkWebsites, formatMonitorMessage, getMonitorWebsiteLinks } = require('../../services/monitorService');
const { handleAboutMeCommand } = require('../../services/aboutService');
const { t } = require('../../utils/i18n');

function formatDuration(seconds) {
  const totalSeconds = Math.max(0, Math.floor(seconds || 0));
  const days = Math.floor(totalSeconds / 86400);
  const hours = Math.floor((totalSeconds % 86400) / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);

  const parts = [];
  if (days > 0) parts.push(`${days}d`);
  parts.push(`${hours}h`);
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

function buildSystemStatsFooter(platform = 'whatsapp', lang = 'en') {
  const isWhatsApp = String(platform || '').toLowerCase() === 'whatsapp';
  const cpuLabel = t('devops.cpu', {}, lang);
  const ramLabel = t('devops.ram', {}, lang);
  const uptimeLabel = t('devops.uptime', {}, lang);
  const statusLabel = t('devops.status', {}, lang);
  const onlineLabel = t('devops.online', {}, lang);

  if (isWhatsApp) {
    return [
      '—'.repeat(19),
      `*${cpuLabel}:* ${getCpuUsagePercent()}%`,
      `*${ramLabel}:* ${getRamUsageText()}`,
      `*${uptimeLabel}:* ${formatDuration(os.uptime())}`,
      `*${statusLabel}:* ${onlineLabel}`
    ].join('\n');
  }

  return [
    '—'.repeat(19),
    `${cpuLabel}: ${getCpuUsagePercent()}%`,
    `${ramLabel}: ${getRamUsageText()}`,
    `${uptimeLabel}: ${formatDuration(os.uptime())}`,
    `${statusLabel}: ${onlineLabel}`
  ].join('\n');
}

async function handleDevopsCommand(command, args = [], userId = '', platform = 'whatsapp', context = {}) {
  const cleanCommand = String(command || '').toLowerCase().trim();
  const lang = context?.lang || 'en';

  switch (cleanCommand) {
    case '/ping': {
      const footer = buildSystemStatsFooter(platform, lang);
      const pong = t('devops.ping_pong', {}, lang);
      return `${pong}\n\n${footer}`;
    }

    case '/me':
    case '/about': {
      return await handleAboutMeCommand(command, args, userId, platform);
    }

    case '/monitor': {
      if (!isAdmin(userId, platform)) {
        const header = t('common.access_denied_header', {}, lang);
        const body = t('common.access_denied_body', {}, lang);
        return `${header}\n\n${body}`;
      }

      const { results } = await checkWebsites();
      return formatMonitorMessage(results, null, platform);
    }

    default: {
      const notAvail = t('devops.not_available', {}, lang);
      const header = t('common.unknown_command_header', {}, lang);
      return `${header}\n\n${notAvail}`;
    }
  }
}

module.exports = {
  handleDevopsCommand,
  formatMonitorMessage,
  buildSystemStatsFooter
};
