// Browserbase command handler (/browse, /jelajah)
const { browseWebPage } = require('../../services/browserbaseService');
const { formatBulletList } = require('../../utils/formatter');
const { t } = require('../../utils/i18n');

/**
 * Handles browser automation commands via Browserbase cloud agent.
 *
 * @param {string} command - E.g. '/browse' or '/jelajah'
 * @param {Array<string>} args - Command arguments (target URL)
 * @param {string} userId - User identifier
 * @param {string} platform - 'whatsapp' | 'telegram'
 * @param {Object} context - Execution context { lang }
 * @returns {Promise<string|Object>} Text string or { image: Buffer, caption: string }
 */
async function handleBrowserCommand(command, args = [], userId = '', platform = 'whatsapp', context = {}) {
  const lang = context?.lang || 'en';
  const targetUrl = args.join(' ').trim();

  if (!targetUrl) {
    const header = t('browser.agent_header', {}, lang);
    const usageObj = {
      [t('browser.usage_label', {}, lang)]: t('browser.usage_text', {}, lang),
      [t('browser.example_label', {}, lang)]: t('browser.example_text', {}, lang),
      [t('browser.features_label', {}, lang)]: t('browser.features_text', {}, lang)
    };

    return `${header}\n\n${formatBulletList(usageObj)}`;
  }

  const result = await browseWebPage({ url: targetUrl, lang });

  if (!result.success) {
    const header = t('common.format_error_header', {}, lang);
    return `${header}\n\n${result.error || t('browser.failed', {}, lang)}`;
  }

  const header = t('browser.capture_header', {}, lang);

  const detailsObj = {
    [t('browser.page_title', {}, lang)]: result.title || '-',
    [t('browser.url_label', {}, lang)]: result.url
  };

  if (result.excerpt) {
    detailsObj[t('browser.content_snippet', {}, lang)] = result.excerpt;
  }

  if (result.debuggerUrl) {
    detailsObj[t('browser.live_inspector', {}, lang)] = result.debuggerUrl;
  }

  const formattedCaption = `${header}\n\n${formatBulletList(detailsObj)}`;

  if (result.screenshotBuffer) {
    return {
      image: result.screenshotBuffer,
      caption: formattedCaption,
      message: formattedCaption
    };
  }

  return formattedCaption;
}

module.exports = {
  handleBrowserCommand
};
