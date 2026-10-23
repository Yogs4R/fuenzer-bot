// Utility command handler (shortener)
const { shortenUrl } = require('../../services/shortenerService');
const { escapeHtml } = require('../../utils/textFormatter');
const { t } = require('../../utils/i18n');

async function handleShortCommand(args, platform = 'telegram', context = {}) {
    const originalUrl = String(args.join(' ') || '').trim();
    const lang = typeof context === 'string' ? context : (context?.lang || 'en');
    const isTele = platform === 'telegram';

    if (!originalUrl) {
        return t('utility.short_prompt', {}, lang);
    }

    if (!(originalUrl.startsWith('http://') || originalUrl.startsWith('https://'))) {
        return t('utility.short_invalid_url', {}, lang);
    }

    try {
        const shortUrl = await shortenUrl(originalUrl);
        const safeOriginal = isTele ? escapeHtml(originalUrl) : originalUrl;
        const safeShort = isTele ? escapeHtml(shortUrl) : shortUrl;
        return t('utility.short_success', { originalUrl: safeOriginal, shortUrl: safeShort }, lang);
    } catch (error) {
        console.error('Error handling /short command:', error);
        return t('utility.short_failed', { error: isTele ? escapeHtml(error.message) : error.message }, lang);
    }
}

module.exports = {
    handleShortCommand
};
