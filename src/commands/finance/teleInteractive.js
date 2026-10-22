const { Markup } = require('telegraf');
const { getHistoryPage } = require('../../services/financeService');
const handleFinanceCommand = require('./index');

const HISTORY_PAGE_SIZE = 5;

const {
    escapeHtml,
    formatTelegramHtml,
    formatBodyBold
} = require('../../utils/textFormatter');

function buildHistoryKeyboard(page, hasPrev, hasNext) {
    const navButtons = [];

    if (hasPrev) {
        navButtons.push(Markup.button.callback('⬅️ Prev', `history:${page - 1}`));
    }

    if (hasNext) {
        navButtons.push(Markup.button.callback('Next ➡️', `history:${page + 1}`));
    }

    const rows = [];
    if (navButtons.length > 0) {
        rows.push(navButtons);
    }
    rows.push([
        Markup.button.callback('🔄 Refresh', `history:${page}`),
        Markup.button.callback('🏠 Menu', 'cmd:start')
    ]);

    return Markup.inlineKeyboard(rows);
}

function buildDeleteConfirmKeyboard(transactionId) {
    return Markup.inlineKeyboard([
        [
            Markup.button.callback('✅ Ya, hapus', `delete_confirm:${transactionId}`),
            Markup.button.callback('❌ Batal', `delete_cancel:${transactionId}`)
        ]
    ]);
}

async function sendHistoryPageMessage(ctx, userId, page = 1, useEdit = false) {
    const result = await getHistoryPage(userId, page, HISTORY_PAGE_SIZE);
    const html = formatTelegramHtml(result.text);
    const finalHtml = formatBodyBold(html);
    const replyMarkup = buildHistoryKeyboard(result.page, result.hasPrev, result.hasNext).reply_markup;

    if (useEdit) {
        try {
            await ctx.editMessageText(finalHtml, { parse_mode: 'HTML', reply_markup: replyMarkup });
            return;
        } catch (error) {
            console.error('Error editing history message in Telegram:', error);
        }
    }

    await ctx.reply(finalHtml, { parse_mode: 'HTML', reply_markup: replyMarkup });
}

async function handleTeleRiwayat(ctx, userId, args = []) {
    try {
        const requestedPage = args.length > 0 ? parseInt(args[0], 10) : 1;
        const page = Number.isInteger(requestedPage) && requestedPage > 0 ? requestedPage : 1;
        await sendHistoryPageMessage(ctx, userId, page, false);
    } catch (error) {
        console.error('Error handling riwayat command in Telegram:', error);
        await ctx.reply('<b>ERROR RIWAYAT</b> ❌\n\nGagal menampilkan riwayat transaksi.', { parse_mode: 'HTML' });
    }
}

async function handleTeleHapusConfirmation(ctx, args = []) {
    if (args.length < 1) {
        await ctx.reply(
            'Format: <code>/hapus &lt;id_transaksi&gt;</code>\nContoh: <code>/hapus 123e4567</code>\nGunakan /riwayat untuk melihat ID transaksi.',
            { parse_mode: 'HTML' }
        );
        return;
    }

    const transactionId = args[0];
    await ctx.reply(
        `<b>KONFIRMASI HAPUS</b> ⚠️\n\nYakin ingin menghapus transaksi dengan ID <code>${escapeHtml(transactionId)}</code>?`,
        {
            parse_mode: 'HTML',
            ...buildDeleteConfirmKeyboard(transactionId)
        }
    );
}

async function handleTeleHistoryCallback(ctx, userId, data) {
    const page = parseInt(data.split(':')[1], 10);
    await ctx.answerCbQuery();
    await sendHistoryPageMessage(ctx, userId, Number.isInteger(page) && page > 0 ? page : 1, true);
}

async function handleTeleDeleteCallback(ctx, userId, data) {
    if (data.startsWith('delete_confirm:')) {
        const transactionId = data.split(':')[1] || '';
        await ctx.answerCbQuery('Menghapus transaksi...');
        const result = await handleFinanceCommand('/hapus', [transactionId], userId, 'telegram');

        try {
            await ctx.editMessageText(formatBodyBold(formatTelegramHtml(result)), {
                parse_mode: 'HTML'
            });
        } catch (error) {
            console.error('Error editing delete confirmation message:', error);
            await ctx.reply(formatBodyBold(formatTelegramHtml(result)), { parse_mode: 'HTML' });
        }
        return;
    }

    if (data.startsWith('delete_cancel:')) {
        await ctx.answerCbQuery('Dibatalkan.');
        await ctx.editMessageText('<b>HAPUS DIBATALKAN</b> ✅\n\nTransaksi tidak jadi dihapus.', {
            parse_mode: 'HTML'
        });
    }
}

module.exports = {
    HISTORY_PAGE_SIZE,
    buildHistoryKeyboard,
    buildDeleteConfirmKeyboard,
    sendHistoryPageMessage,
    handleTeleRiwayat,
    handleTeleHapusConfirmation,
    handleTeleHistoryCallback,
    handleTeleDeleteCallback
};
