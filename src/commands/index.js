// Central Command Router / Dispatcher
const handleFinanceCommand = require('./finance/index');
const { handleAdminCommand } = require('./admin/index');
const { handleDevopsCommand } = require('./devops/index');
const { handleWeatherCommand } = require('./weather/index');
const { handleReligionCommand } = require('./religion/index');
const { handleAiCommand } = require('./ai/index');
const { handleReminderCommand } = require('./reminder/index');
const { handleGoogleCommand, sendToSheet, updateStatusAnswered } = require('./google/index');
const { handleResearchCommand } = require('./research/index');
const { handleInfoCommand } = require('./info/index');
const { handleShortCommand } = require('./utility/index');
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
 * @param {string} command - E.g. '/ping', '/saldo', '/help'
 * @param {Array<string>} args - Command arguments
 * @param {string} userId - User identifier (JID or Telegram ID)
 * @param {string} platform - 'whatsapp' | 'telegram'
 * @param {Object} context - Platform specific context (extra data, callbacks, message objects)
 * @returns {Promise<any>}
 */
async function dispatchCommand(command, args = [], userId = '', platform = 'telegram', context = {}) {
    const cmd = String(command || '').toLowerCase().trim();

    switch (cmd) {
        // DevOps / System
        case '/ping':
        case '/system':
        case '/me':
        case '/monitor':
            return handleDevopsCommand(cmd, args, userId, platform, context);

        // Finance
        case '/saldo':
        case '/catat':
        case '/pemasukan':
        case '/laporan_chart':
        case '/riwayat':
        case '/hapus':
        case '/edit':
            return handleFinanceCommand(cmd, args, userId, platform, context);

        // Reminders
        case '/remind':
            return handleReminderCommand(args, userId, platform, context);

        // AI & Translations
        case '/translate':
        case '/model_info':
        case '/switch':
            return handleAiCommand(cmd, args, userId, platform, context);

        // Weather
        case '/cuaca':
            return handleWeatherCommand(cmd, args, userId, platform, context);

        // Religion
        case '/sholat':
            return handleReligionCommand(cmd, args, userId, platform, context);

        // Research & Education
        case '/buku':
        case '/jurnal':
        case '/artikel':
            return handleResearchCommand(cmd, args, userId, platform, context);

        // Google / CS Integration
        case '/help':
        case '/feedback':
        case '/ask':
            return handleGoogleCommand(cmd, args, userId, platform, context);

        // Info & Menu Guides
        case '/start':
        case '/info':
        case '/donate':
        case '/finance_info':
        case '/remind_info':
        case '/translate_info':
        case '/research_info':
        case '/downloader':
        case '/img_info':
        case '/pdf_info':
        case '/sticker_info':
            return handleInfoCommand(cmd, args, userId, platform, context);

        // Downloader
        case '/download': {
            const targetUrl = args.join(' ').trim();
            return handleDownloadCommand(targetUrl, platform);
        }
        case '/audio': {
            const targetUrl = args.join(' ').trim();
            return handleAudioCommand(targetUrl, platform);
        }

        // Utilities
        case '/short':
            return handleShortCommand(args, platform, context);

        // Admin Only Commands
        case '/admin':
        case '/cmd_usage':
        case '/ai_usage':
        case '/broadcast':
        case '/answer': {
            if (!isAdmin(userId, platform)) {
                return platform === 'telegram'
                    ? '<b>AKSES DITOLAK</b> ❌\n\nCommand ini khusus admin.'
                    : '> *AKSES DITOLAK* ❌\n\nCommand ini khusus admin.';
            }
            return handleAdminCommand(cmd, args, userId, platform, context);
        }

        default:
            return null; // Not handled by central router
    }
}

module.exports = {
    dispatchCommand,
    handleFinanceCommand,
    handleAdminCommand,
    handleDevopsCommand,
    handleWeatherCommand,
    handleReligionCommand,
    handleAiCommand,
    handleReminderCommand,
    handleGoogleCommand,
    handleResearchCommand,
    handleInfoCommand,
    handleShortCommand,
    handleDownloadCommand,
    handleAudioCommand,
    handleImgCommand,
    handleRemoveBgCommand,
    handleHtmlToImageCommand,
    handleStickerCommand,
    handlePdfCommand,
    sendToSheet,
    updateStatusAnswered
};
