// Central Command Router / Dispatcher
const handleFinanceCommand = require('./finance/index');
const { handleAdminCommand } = require('./admin/index');
const { handleDevopsCommand } = require('./devops/index');
const { handleWeatherCommand } = require('./weather/index');
const { handleReligionCommand } = require('./religion/index');
const { handleAiCommand } = require('./ai/index');
const { handleReminderCommand } = require('./reminder/index');
const { handleGoogleCommand, updateStatusAnswered } = require('./google/index');
const { handleResearchCommand } = require('./research/index');
const { handleInfoCommand } = require('./info/index');
const { handleShortCommand } = require('./utility/index');
const { handleLanguageCommand } = require('./language/index');
const { handleSummarizeCommand } = require('./ai/summarize');
const { handleBrowserCommand } = require('./browser/index');
const { getUserLanguage } = require('../services/languageService');
const { t } = require('../utils/i18n');
const {
    handleDownloadCommand,
    handleAudioCommand
} = require('./downloader/index');
const {
    handleImgCommand,
    handleRemoveBgCommand,
    handleHtmlToImageCommand,
    handleStickerCommand,
    handlePdfCommand
} = require('./converter/index');
const { isAdmin } = require('../utils/auth');

/**
 * Dispatch command to the appropriate modular domain handler
 * @param {string} command - E.g. '/ping', '/saldo', '/balance', '/help'
 * @param {Array<string>} args - Command arguments
 * @param {string} userId - User identifier (JID or Telegram ID)
 * @param {string} platform - 'whatsapp' | 'telegram'
 * @param {Object} context - Platform specific context (extra data, callbacks, message objects)
 * @returns {Promise<any>}
 */
async function dispatchCommand(command, args = [], userId = '', platform = 'telegram', context = {}) {
    const cmd = String(command || '').toLowerCase().trim();
    const lang = context.lang || await getUserLanguage(userId, platform);
    const enrichedContext = { ...context, lang };

    switch (cmd) {
        // Language Preference Management
        case '/lang':
        case '/language':
        case '/bahasa':
            return handleLanguageCommand(cmd, args, userId, platform, enrichedContext);

        // DevOps / Diagnostics
        case '/ping':
        case '/me':
        case '/about':
        case '/monitor':
            return handleDevopsCommand(cmd, args, userId, platform, enrichedContext);

        // Finance (Bilingual Aliases)
        case '/saldo':
        case '/balance':
        case '/catat':
        case '/record':
        case '/expense':
        case '/pengeluaran':
        case '/pemasukan':
        case '/income':
        case '/laporan_chart':
        case '/chart':
        case '/riwayat':
        case '/history':
        case '/hapus':
        case '/delete':
        case '/edit':
            return handleFinanceCommand(cmd, args, userId, platform, enrichedContext);

        // Reminders
        case '/remind':
        case '/ingatkan':
            return handleReminderCommand(args, userId, platform, enrichedContext);

        // AI & Translations
        case '/translate':
        case '/terjemahkan':
        case '/terjemah':
        case '/model':
        case '/models':
        case '/model_info':
        case '/switch':
            return handleAiCommand(cmd, args, userId, platform, enrichedContext);

        // Chat Summarizer (DEV Challenge Morning Briefing)
        case '/summarize':
        case '/ringkas':
            return handleSummarizeCommand(cmd, args, userId, platform, enrichedContext);

        // Dedicated Cloud Browsing Agent (Browserbase)
        case '/browse':
        case '/jelajah':
            return handleBrowserCommand(cmd, args, userId, platform, enrichedContext);

        // Weather
        case '/cuaca':
        case '/weather':
            return handleWeatherCommand(cmd, args, userId, platform, enrichedContext);

        // Religion
        case '/sholat':
        case '/prayer':
        case '/jadwalsholat':
            return handleReligionCommand(cmd, args, userId, platform, enrichedContext);

        // Research & Education
        case '/buku':
        case '/book':
        case '/jurnal':
        case '/journal':
        case '/artikel':
        case '/article':
        case '/paper':
            return handleResearchCommand(cmd, args, userId, platform, enrichedContext);

        // Google / CS Integration
        case '/help':
        case '/bantuan':
        case '/feedback':
        case '/saran':
        case '/ask':
            return handleGoogleCommand(cmd, args, userId, platform, enrichedContext);

        // Info & Menu Guides
        case '/start':
        case '/info':
        case '/donate':
        case '/finance_info':
        case '/remind_info':
        case '/translate_info':
        case '/research_info':
        case '/downloader':
        case '/downloader_info':
        case '/img_info':
        case '/pdf_info':
        case '/sticker_info':
            return handleInfoCommand(cmd, args, userId, platform, enrichedContext);

        // Downloader
        case '/download':
        case '/unduh': {
            const targetUrl = args.join(' ').trim();
            return handleDownloadCommand(targetUrl, platform, lang);
        }
        case '/audio':
        case '/suara': {
            const targetUrl = args.join(' ').trim();
            return handleAudioCommand(targetUrl, platform, lang);
        }

        // Utilities
        case '/short':
        case '/shortlink':
        case '/pendekkan':
            return handleShortCommand(args, platform, enrichedContext);

        // Admin Only Commands
        case '/admin':
        case '/cmd_usage':
        case '/ai_usage':
        case '/broadcast':
        case '/answer': {
            if (!isAdmin(userId, platform)) {
                const header = t('common.access_denied_header', {}, lang);
                const body = t('common.access_denied_body', {}, lang);
                return `${header}\n\n${body}`;
            }
            return handleAdminCommand(cmd, args, userId, platform, enrichedContext);
        }

        default:
            return null; // Not handled by central router
    }
}

module.exports = {
    dispatchCommand,
    updateStatusAnswered
};
