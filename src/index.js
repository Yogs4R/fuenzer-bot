// Main entry point
require('dotenv').config(); // Load environment variables from .env file

// Log untuk memastikan environment variable terbaca (opsional)
if (!process.env.OPENROUTER_API_KEY) {
    console.warn('⚠️  Peringatan: OPENROUTER_API_KEY tidak ditemukan di environment variables.');
    console.warn('   Buat file .env di root dengan: OPENROUTER_API_KEY=your_key_here');
    console.warn('   Dapatkan API key dari: https://openrouter.ai/keys');
} else {
    console.log('✅ OPENROUTER_API_KEY ditemukan dan siap digunakan.');
}

const { DisconnectReason } = require('@whiskeysockets/baileys');
const settings = require('./config/settings');
const { connectToWhatsApp, destroyWhatsAppSocket } = require('./lib/waClient');
const WhatsAppHandler = require('./handlers/waHandler');
const { setupTelegramBot } = require('./handlers/teleHandler');
const telegramBot = require('./lib/telegramClient');
const { startCronJobs } = require('./jobs/serverMonitor');
const { startReminderCron } = require('./jobs/reminderCron');
const { startBufferCleanupCron } = require('./jobs/bufferCleanupCron');
const { startSummarizeCron } = require('./jobs/summarizeCron');
const { startDiscordBot, stopDiscordBot, getDiscordClient } = require('./lib/discordClient');
const { setupDiscordBot } = require('./handlers/discordHandler');
const { startSlackBot, stopSlackBot, getSlackApp } = require('./lib/slackClient');
const { setupSlackBot } = require('./handlers/slackHandler');

console.log(`Starting ${settings.app.name} v${settings.app.version} in ${settings.app.env} mode`);

// Variabel untuk menyimpan instance WhatsApp & menjaga single-flight connection
let waSocket = null;
let waHandler = null;
let isWaConnecting = false;
let waReconnectTimer = null;
let isShuttingDown = false;
let monitorCronTask = null;
let bufferCleanupCronTask = null;
let summarizeCronTask = null;

function scheduleWhatsAppReconnect(delayMs) {
    if (isShuttingDown) return;
    if (waReconnectTimer) {
        clearTimeout(waReconnectTimer);
        waReconnectTimer = null;
    }
    console.log(`Mencoba menghubungkan kembali dalam ${Math.round(delayMs / 1000)} detik...`);
    waReconnectTimer = setTimeout(() => {
        waReconnectTimer = null;
        startWhatsAppBot();
    }, delayMs);
}

// Fungsi untuk memulai WhatsApp bot dengan proteksi race condition (single-flight)
async function startWhatsAppBot() {
    if (isShuttingDown) return;
    if (isWaConnecting) {
        console.log('[WhatsApp] Proses koneksi sedang berjalan, melewati pemanggilan duplikat.');
        return;
    }

    if (waReconnectTimer) {
        clearTimeout(waReconnectTimer);
        waReconnectTimer = null;
    }

    isWaConnecting = true;

    try {
        if (waSocket) {
            destroyWhatsAppSocket(waSocket);
            waSocket = null;
            waHandler = null;
        }

        console.log('Menghubungkan ke WhatsApp...');
        const currentSocket = await connectToWhatsApp();
        waSocket = currentSocket;

        // Inisialisasi WhatsApp handler hanya setelah koneksi benar-benar terbuka
        waHandler = new WhatsAppHandler(currentSocket);
        console.log('WhatsApp handler berhasil diinisialisasi');

        console.log('Bot berhasil terhubung dan siap menerima pesan!');

        // Tambahkan event listener tunggal untuk menangani putusnya koneksi saat runtime
        currentSocket.ev.on('connection.update', (update) => {
            if (update.connection === 'close') {
                const statusCode = update.lastDisconnect?.error?.output?.statusCode;
                const isLoggedOut = statusCode === DisconnectReason.loggedOut;

                destroyWhatsAppSocket(currentSocket);
                if (waSocket === currentSocket) {
                    waSocket = null;
                    waHandler = null;
                }

                if (isLoggedOut) {
                    console.error('Koneksi WhatsApp logout. Silakan hapus sesi lama dan scan QR code ulang.');
                    return;
                }

                if (!isShuttingDown) {
                    console.log('Koneksi terputus dari dalam handler. Mencoba ulang...');
                    scheduleWhatsAppReconnect(10000);
                }
            }
        });
    } catch (error) {
        console.error('Gagal memulai WhatsApp bot:', error.message);
        if (error?.isLoggedOut || error?.message === 'Logged out') {
            console.error('WhatsApp membutuhkan autentikasi ulang (QR code). Tidak melakukan auto-reconnect.');
            return;
        }
        // Coba ulang setelah waktu yang bervariasi
        const retryDelay = Math.floor(Math.random() * 10000) + 10000; // 10-20 detik
        scheduleWhatsAppReconnect(retryDelay);
    } finally {
        isWaConnecting = false;
    }
}

// Fungsi untuk menghentikan WhatsApp bot
function stopWhatsAppBot() {
    isShuttingDown = true;
    if (waReconnectTimer) {
        clearTimeout(waReconnectTimer);
        waReconnectTimer = null;
    }
    if (waSocket) {
        console.log('Menghentikan WhatsApp bot...');
        destroyWhatsAppSocket(waSocket);
        waSocket = null;
        waHandler = null;
    }
}

// Fungsi utama
async function main() {
    // TODO: Initialize other clients, services, handlers, and jobs
    
    // Start Webhook Server untuk Release GitHub Actions
    const app = require('express')();
    app.use(require('express').json());

    app.post('/webhook-release', async (req, res) => {
        const { version, changelog, secret } = req.body;

        // Validasi keamanan
        if (secret !== process.env.AUTO_BROADCAST_RELEASE) {
            return res.status(401).json({ error: 'Unauthorized' });
        }

        const { handleAdminCommand } = require('./commands/admin/index');
        const rawChangelog = changelog || '- No changelog provided';

        // Format for WhatsApp (converting Markdown GitHub to WhatsApp Format)
        const waChangelog = rawChangelog
            .replace(/\*\*(.*?)\*\*/g, '*$1*')          // Bold
            .replace(/__(.*?)__/g, '_$1_')              // Italic
            .replace(/\[(.*?)\]\((.*?)\)/g, '$1: $2')   // Links -> text: url
            .replace(/^#{1,6}\s+(.*)$/gm, '*$1*');      // Headers -> *Header*

        const waMessageText = `🚀 *NEW RELEASE: ${version || 'Unknown'}* 🚀\n\n*Changelog:*\n${waChangelog}`;

        // Format for Telegram (converting Markdown GitHub to HTML)
        const teleChangelog = rawChangelog
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/\*\*(.*?)\*\*/g, '<b>$1</b>')     // Bold
            .replace(/__(.*?)__/g, '<i>$1</i>')         // Italic
            .replace(/\[(.*?)\]\((.*?)\)/g, '<a href="$2">$1</a>') // Links
            .replace(/^#{1,6}\s+(.*)$/gm, '<b>$1</b>'); // Headers -> <b>Header</b>

        const teleMessageText = `🚀 <b>NEW RELEASE: ${version || 'Unknown'}</b> 🚀\n\n<b>Changelog:</b>\n${teleChangelog}`;

        // Broadcast ke WhatsApp (jika bot WA aktif)
        if (waSocket) {
            handleAdminCommand('/broadcast', [waMessageText], 'system', 'whatsapp', {
                notifyAdmin: async (msg) => console.log('[Webhook Broadcast WA] ' + msg),
                sendToUser: async (targetId, text) => {
                    const jid = targetId.includes('@s.whatsapp.net') ? targetId : `${targetId}@s.whatsapp.net`;
                    await waSocket.sendMessage(jid, { text });
                }
            }).catch(err => console.error('[Webhook WA Error]', err));
        }

        // Broadcast ke Telegram (jika bot Tele aktif)
        if (process.env.TELEGRAM_BOT_TOKEN && telegramBot) {
            handleAdminCommand('/broadcast', [teleMessageText], 'system', 'telegram', {
                notifyAdmin: async (msg) => console.log('[Webhook Broadcast Tele] ' + msg),
                sendToUser: async (targetId, text) => {
                    const chatId = Number(targetId);
                    if (Number.isFinite(chatId)) {
                        await telegramBot.telegram.sendMessage(chatId, String(text), { parse_mode: 'HTML' });
                    }
                }
            }).catch(err => console.error('[Webhook Tele Error]', err));
        }

        // Format for Discord (standard Markdown)
        const discordMessageText = `🚀 **NEW RELEASE: ${version || 'Unknown'}** 🚀\n\n**Changelog:**\n${rawChangelog}`;

        // Format for Slack (Slack mrkdwn)
        const slackChangelog = rawChangelog
            .replace(/\*\*(.*?)\*\*/g, '*$1*')          // Bold
            .replace(/__(.*?)__/g, '_$1_')              // Italic
            .replace(/\[(.*?)\]\((.*?)\)/g, '<$2|$1>')  // Links -> <url|text>
            .replace(/^#{1,6}\s+(.*)$/gm, '*$1*')       // Headers
            .replace(/^\s*\*\s+/gm, '- ');              // Bullets
        const slackMessageText = `🚀 *NEW RELEASE: ${version || 'Unknown'}* 🚀\n\n*Changelog:*\n${slackChangelog}`;

        // Broadcast ke Discord (jika bot Discord aktif)
        const activeDiscordClient = getDiscordClient();
        if (process.env.DISCORD_BOT_TOKEN && activeDiscordClient) {
            handleAdminCommand('/broadcast', [discordMessageText], 'system', 'discord', {
                notifyAdmin: async (msg) => console.log('[Webhook Broadcast Discord] ' + msg),
                sendToUser: async (targetId, text) => {
                    try {
                        const targetUser = await activeDiscordClient.users.fetch(targetId);
                        if (targetUser) {
                            await targetUser.send(String(text || ''));
                        }
                    } catch (dmErr) {
                        console.warn(`[Webhook Discord] Could not DM user ${targetId}:`, dmErr.message);
                    }
                }
            }).catch(err => console.error('[Webhook Discord Error]', err));
        }

        // Broadcast ke Slack (jika bot Slack aktif)
        const activeSlackApp = getSlackApp();
        if (process.env.SLACK_BOT_TOKEN && activeSlackApp) {
            handleAdminCommand('/broadcast', [slackMessageText], 'system', 'slack', {
                notifyAdmin: async (msg) => console.log('[Webhook Broadcast Slack] ' + msg),
                sendToUser: async (targetId, text) => {
                    try {
                        const dm = await activeSlackApp.client.conversations.open({ users: targetId });
                        if (dm.ok && dm.channel?.id) {
                            await activeSlackApp.client.chat.postMessage({
                                channel: dm.channel.id,
                                text: String(text || '')
                            });
                        }
                    } catch (dmErr) {
                        console.warn(`[Webhook Slack] Could not DM user ${targetId}:`, dmErr.message);
                    }
                }
            }).catch(err => console.error('[Webhook Slack Error]', err));
        }

        res.status(200).json({ message: 'Broadcast triggered successfully' });
    });

    const PORT = process.env.PORT || 3000;
    app.listen(PORT, () => {
        console.log(`🚀 Webhook server is running on port ${PORT}`);
    });

    // Start WhatsApp bot
    await startWhatsAppBot();
    
    // Start Telegram bot
    if (process.env.TELEGRAM_BOT_TOKEN) {
        setupTelegramBot();
        telegramBot.launch();
        console.log('Telegram Bot berhasil dijalankan!');
    } else {
        console.warn('⚠️  TELEGRAM_BOT_TOKEN tidak ditemukan. Bot Telegram tidak akan berjalan.');
    }

    // Start Discord bot
    const discordClient = getDiscordClient();
    if (discordClient) {
        setupDiscordBot(discordClient);
        await startDiscordBot();
    }

    // Start Slack bot
    const slackApp = getSlackApp();
    if (slackApp) {
        setupSlackBot(slackApp);
        await startSlackBot();
    }

    monitorCronTask = startCronJobs(telegramBot, () => waSocket);
    
    // Start Reminder Cron
    startReminderCron(() => waSocket, telegramBot);

    // Start Chat Buffer Retention Cleanup Cron
    bufferCleanupCronTask = startBufferCleanupCron();

    // Start Automated Morning Briefing Cron
    summarizeCronTask = startSummarizeCron(() => waSocket, telegramBot);

    console.log('Semua layanan berjalan!');
}

// Menjalankan aplikasi
main();

// Handle graceful shutdown
process.on('SIGINT', async () => {
    console.log('\nMenerima SIGINT. Melakukan shutdown...');
    if (monitorCronTask) {
        monitorCronTask.stop();
        monitorCronTask = null;
    }
    if (bufferCleanupCronTask) {
        bufferCleanupCronTask.stop();
        bufferCleanupCronTask = null;
    }
    if (summarizeCronTask) {
        summarizeCronTask.stop();
        summarizeCronTask = null;
    }
    stopWhatsAppBot();
    // Stop Telegram bot
    if (process.env.TELEGRAM_BOT_TOKEN) {
        telegramBot.stop('SIGINT');
    }
    await stopDiscordBot();
    await stopSlackBot();
    console.log('Shutdown selesai.');
    process.exit(0);
});

process.on('SIGTERM', async () => {
    console.log('\nMenerima SIGTERM. Melakukan shutdown...');
    if (monitorCronTask) {
        monitorCronTask.stop();
        monitorCronTask = null;
    }
    if (bufferCleanupCronTask) {
        bufferCleanupCronTask.stop();
        bufferCleanupCronTask = null;
    }
    if (summarizeCronTask) {
        summarizeCronTask.stop();
        summarizeCronTask = null;
    }
    stopWhatsAppBot();
    // Stop Telegram bot
    if (process.env.TELEGRAM_BOT_TOKEN) {
        telegramBot.stop('SIGTERM');
    }
    await stopDiscordBot();
    await stopSlackBot();
    console.log('Shutdown selesai.');
    process.exit(0);
});
