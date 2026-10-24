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

const settings = require('./config/settings');
const { connectToWhatsApp } = require('./lib/waClient');
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

// Variabel untuk menyimpan instance WhatsApp
let waSocket = null;
let waHandler = null;
let monitorCronTask = null;
let bufferCleanupCronTask = null;
let summarizeCronTask = null;

// Fungsi untuk memulai WhatsApp bot
async function startWhatsAppBot() {
    try {
        console.log('Menghubungkan ke WhatsApp...');
        waSocket = await connectToWhatsApp();
        
        // Inisialisasi WhatsApp handler hanya setelah koneksi benar-benar terbuka
        waHandler = new WhatsAppHandler(waSocket);
        console.log('WhatsApp handler berhasil diinisialisasi');
        
        console.log('Bot berhasil terhubung dan siap menerima pesan!');
        
        // Tambahkan event listener untuk menangani error koneksi
        waSocket.ev.on('connection.update', (update) => {
            if (update.connection === 'close') {
                console.log('Koneksi terputus dari dalam handler. Mencoba ulang...');
                // Restart bot
                setTimeout(() => {
                    startWhatsAppBot();
                }, 10000);
            }
        });
        
    } catch (error) {
        console.error('Gagal memulai WhatsApp bot:', error.message);
        // Coba ulang setelah waktu yang bervariasi
        const retryDelay = Math.floor(Math.random() * 10000) + 10000; // 10-20 detik
        console.log(`Mencoba menghubungkan kembali dalam ${retryDelay/1000} detik...`);
        setTimeout(() => {
            startWhatsAppBot();
        }, retryDelay);
    }
}

// Fungsi untuk menghentikan WhatsApp bot
function stopWhatsAppBot() {
    if (waSocket) {
        console.log('Menghentikan WhatsApp bot...');
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
