// Telegram message/event handler
const bot = require('../lib/telegramClient');
const { Markup } = require('telegraf');
const { dispatchCommand, updateStatusAnswered } = require('../commands/index');
const { isAdmin } = require('../utils/auth');
const { getMonitorWebsiteLinks, checkWebsites } = require('../services/monitorService');
const { processAiChat } = require('../commands/ai/index');
const { handleAdminCommand } = require('../commands/admin/index');
const { formatMonitorMessage } = require('../commands/devops/index');
const { pdfMergeSessionManager } = require('../utils/sessionManager');
const { logCommand } = require('../services/logService');
const { getUserLanguage } = require('../services/languageService');
const { t } = require('../utils/i18n');
const { enqueueMessage } = require('../services/chatBufferService');

const {
    isTelegramPdfDocument,
    handleTelegramImageConverter,
    handleTelegramSticker,
    handleTelegramRemoveBg,
    handleTelegramScreenshot,
    handleTelegramPdfTools,
    handleTelegramPdfMergeUpload,
    handleTelegramDownloader
} = require('./adapters/teleMediaAdapter');

const {
    handleTeleRiwayat,
    handleTeleHapusConfirmation,
    handleTeleHistoryCallback,
    handleTeleDeleteCallback
} = require('../commands/finance/teleInteractive');

const {
    escapeHtml,
    escapeRegex,
    stripWrappingQuotes,
    formatTelegramHtml,
    formatBodyBold
} = require('../utils/textFormatter');

function getTelegramBotUsername() {
    const fromBotInfo = bot.botInfo?.username;
    const fromEnv = process.env.TELEGRAM_BOT_USERNAME;
    const username = String(fromBotInfo || fromEnv || '')
        .replace(/^@+/, '')
        .replace(/\s+/g, '')
        .trim();

    return username;
}

function sanitizeTelegramIncomingText(rawText) {
    let text = String(rawText || '').trim();
    const botUsername = getTelegramBotUsername();

    if (!botUsername) {
        return text;
    }

    const escapedBotUsername = escapeRegex(botUsername);

    text = text.replace(new RegExp(`^\\/(\\w+)@${escapedBotUsername}(?=\\s|$)`, 'i'), '/$1');
    text = text.replace(new RegExp(`(^|\\s)@${escapedBotUsername}\\b`, 'gi'), '$1');

    return text.replace(/\s{2,}/g, ' ').trim();
}

function buildMainMenuKeyboard() {
    return Markup.inlineKeyboard([
        [Markup.button.callback('☕ Donate', 'cmd:donate')],
        [Markup.button.callback('💰 Finance Info', 'cmd:finance_info'), Markup.button.callback('⚙️ Info', 'cmd:info')],
        [Markup.button.callback('👨‍💻 About Me', 'cmd:me'), Markup.button.callback('🏓 Ping', 'cmd:ping')],
        [Markup.button.callback('🖼️ Image Tools', 'cmd:img_info'), Markup.button.callback('📄 PDF Tools', 'cmd:pdf_info')],
        [Markup.button.callback('🤖 Model AI', 'cmd:model_info'), Markup.button.callback('🧩 Sticker Tools', 'cmd:sticker_info')],
        [Markup.button.callback('🔎 Research', 'cmd:research_info'), Markup.button.callback('⬇️ Downloader', 'cmd:downloader')],
        [Markup.button.callback('🌍 Translate Info', 'cmd:translate_info'), Markup.button.callback('⏰ Reminder Info', 'cmd:remind_info')],
        [Markup.button.callback('🆘 Help & CS', 'cmd:help')]
    ]);
}

function buildAdminMenuKeyboard() {
    return Markup.inlineKeyboard([
        [Markup.button.callback('📡 Monitor', 'admin:monitor'), Markup.button.callback('📣 Broadcast', 'admin:broadcast')],
        [Markup.button.callback('🧾 Cmd Usage', 'admin:cmd_usage'), Markup.button.callback('🤖 AI Usage', 'admin:ai_usage')],
    ]);
}

function buildMonitorLinksKeyboard() {
    const websiteLinks = getMonitorWebsiteLinks();
    const rows = websiteLinks
        .filter((item) => item.url)
        .map((item) => [Markup.button.url(item.label, item.url)]);

    if (rows.length === 0) return null;
    return Markup.inlineKeyboard(rows);
}

async function sendTelegramReply(ctx, payload, extra = {}) {
    if (payload && typeof payload === 'object' && payload.type === 'image') {
        const caption = formatTelegramHtml(payload.caption || '');
        const processedCaption = caption ? formatBodyBold(caption) : '';
        await ctx.replyWithPhoto(payload.url, {
            caption: processedCaption,
            parse_mode: 'HTML',
            ...extra
        });
        return;
    }

    const rawText = typeof payload === 'string' ? payload : String(payload || '');
    const formattedText = formatTelegramHtml(rawText);
    const finalText = formatBodyBold(formattedText);
    await ctx.reply(finalText, { parse_mode: 'HTML', ...extra });
}

async function processMenuCommand(ctx, command, userId) {
    if (command === '/riwayat' || command === '/history') {
        await handleTeleRiwayat(ctx, userId, []);
        return;
    }

    const reply = await dispatchCommand(command, [], userId, 'telegram');
    if (reply !== null) {
        const keyboard = (command === '/start' || command === '/info')
            ? buildMainMenuKeyboard()
            : (command === '/me' || command === '/monitor')
                ? buildMonitorLinksKeyboard()
                : {};
        await sendTelegramReply(ctx, reply, keyboard);
    }
}

function setupTelegramBot() {
    bot.on('message', async (ctx) => {
        let text = ctx.message?.text || ctx.message?.caption || '';
        const userId = ctx.from.id.toString();
        const hasPdfDocument = isTelegramPdfDocument(ctx.message?.document);
        const hasActiveMergeSession = pdfMergeSessionManager.hasSession(userId);
        const isGroup = ctx.chat.type === 'group' || ctx.chat.type === 'supergroup';
        const botUsername = process.env.TELEGRAM_BOT_USERNAME;
        const isMentioned = botUsername && text.includes(`@${botUsername}`);

        if (isGroup && !isMentioned && !(hasActiveMergeSession && hasPdfDocument)) {
            const trimmedText = String(text || '').trim();
            if (trimmedText && !trimmedText.startsWith('/')) {
                const senderName = [ctx.from?.first_name, ctx.from?.last_name].filter(Boolean).join(' ') || ctx.from?.username || '';
                enqueueMessage({
                    platform: 'telegram',
                    chatId: String(ctx.chat.id),
                    chatName: ctx.chat.title || '',
                    senderName,
                    messageText: trimmedText
                }).catch((err) => {
                    console.warn(`[teleHandler] Buffer enqueue error: ${err.message}`);
                });
            }
            return;
        }

        if (hasPdfDocument && hasActiveMergeSession) {
            await handleTelegramPdfMergeUpload(ctx, ctx.message.document, userId, bot);
            return;
        }

        text = sanitizeTelegramIncomingText(text);
        if (!text) return;

        if (text.startsWith('/')) {
            const parts = text.split(' ');
            const command = parts[0].toLowerCase();
            const args = parts.slice(1);
            const lang = await getUserLanguage(userId, 'telegram');

            await logCommand(userId, 'telegram', command);

            const dispatched = await dispatchCommand(command, args, userId, 'telegram', {
                lang,
                quotedText: ctx.message?.reply_to_message?.text || ctx.message?.reply_to_message?.caption || '',
                notifyAdmin: async (textToAdmin) => {
                    await sendTelegramReply(ctx, String(textToAdmin || ''));
                },
                sendToUser: async (targetId, textToSend) => {
                    const chatId = Number(targetId);
                    if (!Number.isFinite(chatId)) throw new Error('Invalid Telegram target');
                    await ctx.telegram.sendMessage(chatId, String(textToSend || ''), { parse_mode: 'HTML' });
                }
            });

            if (dispatched !== null) {
                if (command === '/answer' && args[0]) {
                    await updateStatusAnswered(args[0]);
                }

                if (command === '/admin' && isAdmin(userId, 'telegram')) {
                    await sendTelegramReply(ctx, dispatched, buildAdminMenuKeyboard());
                } else if ((command === '/monitor' || command === '/me' || command === '/about') && !dispatched.includes('AKSES DITOLAK')) {
                    const linksKeyboard = buildMonitorLinksKeyboard();
                    await sendTelegramReply(ctx, dispatched, linksKeyboard || {});
                } else {
                    await sendTelegramReply(ctx, dispatched);
                }
                return;
            }

            switch (command) {
                case '/history':
                case '/riwayat':
                    await handleTeleRiwayat(ctx, userId, args);
                    break;

                case '/delete':
                case '/hapus':
                    await handleTeleHapusConfirmation(ctx, args);
                    break;

                case '/img':
                    await handleTelegramImageConverter(ctx, args, bot);
                    break;

                case '/sticker':
                case '/tosticker':
                    await handleTelegramSticker(ctx);
                    break;

                case '/removebg':
                case '/hapusbg':
                    await handleTelegramRemoveBg(ctx, bot);
                    break;

                case '/screenshot':
                case '/ss':
                    await handleTelegramScreenshot(ctx, args);
                    break;

                case '/topdf':
                case '/pdf':
                    await handleTelegramPdfTools(ctx, command, args, bot);
                    break;

                case '/download':
                case '/audio':
                    await handleTelegramDownloader(ctx, command, args);
                    break;

                default: {
                    const defaultHeader = formatTelegramHtml(t('common.unknown_command_header', {}, lang));
                    const defaultBody = formatTelegramHtml(t('common.unknown_command_body', { command }, lang));
                    await ctx.reply(`${defaultHeader}\n\n${defaultBody}`, { parse_mode: 'HTML' });
                }
            }
        } else {
            const lang = await getUserLanguage(userId, 'telegram');
            if (text.length <= 2) {
                const shortHeader = formatTelegramHtml(t('common.too_short_header', {}, lang));
                const shortBody = formatTelegramHtml(t('common.too_short_body', {}, lang));
                await ctx.reply(`${shortHeader}\n\n${shortBody}`, { parse_mode: 'HTML' });
                return;
            }

            const chatResult = await processAiChat(text, userId, 'telegram');
            const formattedReply = formatTelegramHtml(chatResult.fullText);
            const finalReply = formatBodyBold(formattedReply);
            await ctx.reply(finalReply, { parse_mode: 'HTML' });
        }
    });

    bot.on('callback_query', async (ctx) => {
        const data = ctx.callbackQuery?.data || '';
        const userId = ctx.from.id.toString();

        try {
            if (data.startsWith('cmd:')) {
                const key = data.split(':')[1];
                const commandMap = {
                    start: '/start',
                    info: '/info',
                    donate: '/donate',
                    ping: '/ping',
                    finance_info: '/finance_info',
                    research_info: '/research_info',
                    downloader: '/downloader',
                    remind_info: '/remind_info',
                    cuaca: '/cuaca',
                    sholat: '/sholat',
                    me: '/me',
                    img_info: '/img_info',
                    pdf_info: '/pdf_info',
                    model_info: '/model_info',
                    sticker_info: '/sticker_info',
                    translate_info: '/translate_info',
                    help: '/help'
                };

                const mapped = commandMap[key];
                if (mapped) {
                    await ctx.answerCbQuery();

                    if (mapped === '/cuaca') {
                        await ctx.reply('Untuk melihat cuaca, ketik command beserta nama kota.\nContoh: <code>/cuaca semarang</code>', { parse_mode: 'HTML' });
                        return;
                    }
                    if (mapped === '/sholat') {
                        await ctx.reply('Untuk melihat jadwal sholat, ketik command beserta nama kota.\nContoh: <code>/sholat jakarta</code>', { parse_mode: 'HTML' });
                        return;
                    }
                    if (mapped === '/me') {
                        await processMenuCommand(ctx, '/me', userId);
                        return;
                    }

                    await processMenuCommand(ctx, mapped, userId);
                } else {
                    await ctx.answerCbQuery('Aksi tidak dikenal.');
                }
                return;
            }

            if (data === 'admin:monitor') {
                await ctx.answerCbQuery();
                if (!isAdmin(userId, 'telegram')) {
                    await ctx.reply('<b>AKSES DITOLAK</b> ❌\n\nCommand ini khusus admin.', { parse_mode: 'HTML' });
                    return;
                }
                const { results } = await checkWebsites();
                const replyText = formatMonitorMessage(results, null, 'telegram');
                const linksKeyboard = buildMonitorLinksKeyboard();
                await sendTelegramReply(ctx, replyText, linksKeyboard || {});
                return;
            }

            if (data === 'admin:cmd_usage' || data === 'admin:ai_usage') {
                await ctx.answerCbQuery();
                if (!isAdmin(userId, 'telegram')) {
                    await ctx.reply('<b>AKSES DITOLAK</b> ❌\n\nCommand ini khusus admin.', { parse_mode: 'HTML' });
                    return;
                }
                const adminCommand = data === 'admin:ai_usage' ? '/ai_usage' : '/cmd_usage';
                await logCommand(userId, 'telegram', adminCommand);
                const replyText = await handleAdminCommand(adminCommand, [], userId, 'telegram');
                await sendTelegramReply(ctx, replyText);
                return;
            }

            if (data === 'admin:broadcast') {
                await ctx.answerCbQuery();
                if (!isAdmin(userId, 'telegram')) {
                    await ctx.reply('<b>AKSES DITOLAK</b> ❌\n\nCommand ini khusus admin.', { parse_mode: 'HTML' });
                    return;
                }
                await ctx.reply(
                    '<b>BROADCAST ADMIN</b> 📣\n\nGunakan format:\n<code>/broadcast &lt;pesan&gt;</code>\n\nContoh:\n<code>/broadcast Halo semua, bot sedang maintenance.</code>',
                    { parse_mode: 'HTML' }
                );
                return;
            }

            if (data.startsWith('history:')) {
                await handleTeleHistoryCallback(ctx, userId, data);
                return;
            }

            if (data.startsWith('delete_confirm:') || data.startsWith('delete_cancel:')) {
                await handleTeleDeleteCallback(ctx, userId, data);
                return;
            }

            await ctx.answerCbQuery('Aksi tidak tersedia.');
        } catch (error) {
            console.error('Error handling Telegram callback query:', error);
            try {
                await ctx.answerCbQuery('Terjadi kesalahan. Coba lagi.');
            } catch (_ignored) {}
        }
    });

    bot.catch((err, ctx) => {
        console.error(`Telegram Bot Error for ${ctx.updateType}:`, err);
        ctx.reply('<b>ERROR SISTEM</b> ❌\n\nTerjadi kesalahan internal. Silakan coba lagi nanti.', { parse_mode: 'HTML' });
    });
}

module.exports = { setupTelegramBot };
