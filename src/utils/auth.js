const { stripWrappingQuotes } = require('./textFormatter');

function parseCommaSeparatedList(value) {
  return stripWrappingQuotes(value)
    .split(/[\s,;|]+/)
    .map((item) => stripWrappingQuotes(item))
    .filter(Boolean);
}

function normalizeWhatsAppUserId(userId) {
  return stripWrappingQuotes(userId)
    .split('@')[0]
    .split(':')[0]
    .replace(/[^\d]/g, '');
}

function normalizeTelegramUserId(userId) {
  return stripWrappingQuotes(userId).replace(/[^\d-]/g, '');
}

function isAdmin(userId, platform) {
  const platformName = String(platform || '').toLowerCase();

  if (platformName === 'whatsapp') {
    const adminNumbers = parseCommaSeparatedList(process.env.ADMIN_WA_NUMBERS)
      .map((adminNumber) => normalizeWhatsAppUserId(adminNumber));
    const normalizedUserId = normalizeWhatsAppUserId(userId);
    return adminNumbers.includes(normalizedUserId);
  }

  if (platformName === 'telegram') {
    const adminIds = parseCommaSeparatedList(process.env.ADMIN_TELE_IDS)
      .map((adminId) => normalizeTelegramUserId(adminId));
    const normalizedUserId = normalizeTelegramUserId(userId);
    return adminIds.includes(normalizedUserId);
  }

  return false;
}

module.exports = {
  isAdmin
};