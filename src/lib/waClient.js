const makeWASocket = require('@whiskeysockets/baileys').default;
const {
    useMultiFileAuthState,
    DisconnectReason,
    fetchLatestBaileysVersion,
    Browsers,
    makeCacheableSignalKeyStore,
    jidDecode
} = require('@whiskeysockets/baileys');
const pino = require('pino');
const path = require('path');
const fs = require('fs');
const qrcode = require('qrcode-terminal');

function createTtlCache(ttlMs = 3600000, maxEntries = 1000) {
    const store = new Map();

    const pruneExpired = () => {
        const now = Date.now();
        for (const [key, entry] of store.entries()) {
            if (entry.expiresAt <= now) {
                store.delete(key);
            }
        }
        while (store.size > maxEntries) {
            const oldestKey = store.keys().next().value;
            if (oldestKey === undefined) break;
            store.delete(oldestKey);
        }
    };

    return {
        get(key) {
            const entry = store.get(key);
            if (!entry) return undefined;
            if (entry.expiresAt <= Date.now()) {
                store.delete(key);
                return undefined;
            }
            return entry.value;
        },
        set(key, value) {
            if (store.size >= maxEntries) {
                pruneExpired();
            }
            store.set(key, { value, expiresAt: Date.now() + ttlMs });
            return true;
        },
        del(key) {
            store.delete(key);
        },
        flushAll() {
            store.clear();
        }
    };
}

const msgRetryCounterCache = createTtlCache(60 * 60 * 1000, 2000);
const sentMessagesCache = createTtlCache(60 * 60 * 1000, 500);
// Cooldown 60 detik agar proses negosiasi ulang PreKey oleh Baileys tidak terputus di tengah jalan
const sessionPurgeCooldown = createTtlCache(60 * 1000, 500);

const CORRUPTED_SESSION_ERROR_PATTERN = /bad mac|no matching sessions|invalid prekey|missing signedprekey/i;

function isCorruptedSessionError(reason = '') {
    return CORRUPTED_SESSION_ERROR_PATTERN.test(String(reason || ''));
}

function destroyWhatsAppSocket(sock) {
    if (!sock) return;
    try {
        sock.ev?.removeAllListeners('connection.update');
        sock.ev?.removeAllListeners('creds.update');
        sock.ev?.removeAllListeners('messages.upsert');
    } catch {
        // Ignore listener cleanup errors
    }
    try {
        sock.end?.(undefined);
    } catch {
        // Ignore socket end errors
    }
    try {
        sock.ws?.close?.();
    } catch {
        // Ignore websocket close errors
    }
}

async function purgeCorruptedSignalSession(sock, msg, reason = '') {
    // Jangan pernah menghapus sesi jika alasan gagalnya adalah "No session record"
    // karena Baileys sedang melakukan handshake PreKey baru untuk membuat sesi tersebut.
    if (reason && !isCorruptedSessionError(reason)) {
        return false;
    }

    const authKeys = sock?.authState?.keys;
    if (!authKeys || typeof authKeys.set !== 'function' || !msg?.key) {
        return false;
    }

    const candidates = [
        msg.key.participant,
        msg.key.senderLid,
        msg.key.senderPn,
        msg.key.participantLid,
        msg.key.participantPn,
        msg.key.remoteJid
    ].filter(Boolean);

    const sessionUpdates = {};
    const senderKeyUpdates = {};
    const isGroup = String(msg.key.remoteJid || '').endsWith('@g.us');

    for (const rawJid of candidates) {
        if (String(rawJid).endsWith('@g.us') || String(rawJid).endsWith('@broadcast')) {
            continue;
        }
        const decoded = jidDecode(rawJid);
        if (!decoded?.user) continue;

        const deviceId = decoded.device || 0;
        const signalAddr = `${decoded.user}.${deviceId}`;

        if (!sessionPurgeCooldown.get(signalAddr)) {
            sessionPurgeCooldown.set(signalAddr, true);
            sessionUpdates[signalAddr] = null;
            if (deviceId !== 0) {
                sessionUpdates[`${decoded.user}.0`] = null;
            }
            if (isGroup && msg.key.remoteJid) {
                senderKeyUpdates[`${msg.key.remoteJid}::${decoded.user}::${deviceId}`] = null;
            }
        }
    }

    const sessionAddrs = Object.keys(sessionUpdates);
    if (sessionAddrs.length === 0) {
        return false;
    }

    try {
        const payload = { session: sessionUpdates };
        if (Object.keys(senderKeyUpdates).length > 0) {
            payload['sender-key'] = senderKeyUpdates;
        }
        await authKeys.set(payload);
        console.log(`[waClient] Purged corrupted Signal session(s) for recovery (${reason || 'corrupted'}): ${sessionAddrs.join(', ')}`);
        return true;
    } catch (err) {
        console.error('[waClient] Failed to purge corrupted Signal session:', err.message);
        return false;
    }
}

async function connectToWhatsApp() {
    // Membuat folder auth/whatsapp jika belum ada
    const authFolder = path.join(__dirname, '..', '..', 'auth', 'whatsapp');
    if (!fs.existsSync(authFolder)) {
        fs.mkdirSync(authFolder, { recursive: true });
    }

    // Menggunakan multi file auth state
    const { state, saveCreds } = await useMultiFileAuthState(authFolder);
    const baileysLogger = pino({ level: process.env.BAILEYS_LOG_LEVEL || 'silent' });

    // Gunakan versi Baileys terbaru untuk menghindari error 405
    const { version } = await fetchLatestBaileysVersion();

    // Membuat socket connection dengan in-memory Signal key cache untuk mencegah race condition I/O
    const sock = makeWASocket({
        logger: baileysLogger,
        auth: {
            creds: state.creds,
            keys: makeCacheableSignalKeyStore(state.keys, baileysLogger)
        },
        msgRetryCounterCache,
        getMessage: async (key) => {
            if (!key?.id) return undefined;
            return sentMessagesCache.get(key.id);
        },
        // Opsi untuk meningkatkan koneksi
        connectTimeoutMs: 30000,
        keepAliveIntervalMs: 10000,
        emitOwnEvents: true,
        defaultQueryTimeoutMs: 30000,
        // Browser info yang umum & stabil
        browser: Browsers.windows('Chrome'),
        // Versi Baileys terbaru
        version,
        // Percepat retry receipt agar antrean pesan tidak tertahan lama
        retryRequestDelayMs: 300,
        maxMsgRetryCount: 5,
        maxRetries: 3,
        // Tambahkan options untuk QR
        qrTimeout: 60000,
        // Kurangi beban sinkronisasi
        syncFullHistory: false,
        markOnlineOnConnect: false
    });

    // Simpan pesan keluar di cache agar Baileys dapat melayani retry receipt dari perangkat penerima
    const originalSendMessage = sock.sendMessage.bind(sock);
    sock.sendMessage = async (jid, content, options) => {
        const sent = await originalSendMessage(jid, content, options);
        if (sent?.key?.id && sent?.message) {
            sentMessagesCache.set(sent.key.id, sent.message);
        }
        return sent;
    };

    // Serialisasi penyimpanan kredensial agar tidak terjadi race condition saat creds.update beruntun
    let credsSaveChain = Promise.resolve();
    sock.ev.on('creds.update', () => {
        credsSaveChain = credsSaveChain
            .then(() => saveCreds())
            .catch((err) => console.error('[waClient] Failed to save creds:', err.message));
    });

    // Variable untuk menyimpan promise resolver
    let resolvePromise;
    let rejectPromise;
    let settled = false;

    const connectionPromise = new Promise((resolve, reject) => {
        resolvePromise = resolve;
        rejectPromise = reject;
    });

    // Flag untuk menandai apakah QR sudah ditampilkan
    let qrDisplayed = false;
    let connectionTimeout;

    const clearPendingTimeout = () => {
        if (connectionTimeout) {
            clearTimeout(connectionTimeout);
            connectionTimeout = null;
        }
    };

    const failAndCleanup = (err) => {
        clearPendingTimeout();
        if (!settled) {
            settled = true;
            destroyWhatsAppSocket(sock);
            rejectPromise(err);
        }
    };

    // Menangani event connection.update selama fase inisialisasi
    const onInitialConnectionUpdate = (update) => {
        console.log('Log Update:', JSON.stringify(update, null, 2));
        const { connection, lastDisconnect, qr, isNewLogin } = update;

        // Tampilkan QR code jika tersedia
        if (qr && !qrDisplayed) {
            console.log('\n=== QR CODE UNTUK WHATSAPP ===');
            qrcode.generate(qr, { small: true });
            console.log('=== SCAN QR CODE DI ATAS ===\n');
            qrDisplayed = true;
            // Reset timeout ketika QR muncul
            clearPendingTimeout();
            connectionTimeout = setTimeout(() => {
                if (!sock.user && !settled) {
                    console.log('QR code timeout. Coba ulang...');
                    failAndCleanup(new Error('QR timeout'));
                }
            }, 120000);
        }

        if (connection === 'connecting') {
            console.log('Sedang menghubungkan ke WhatsApp...');
            if (isNewLogin && !qrDisplayed) {
                console.log('Login baru diperlukan. Silakan tunggu QR code...');
            }
        } else if (connection === 'close') {
            console.error('Koneksi ditutup.');
            if (lastDisconnect?.error) {
                console.error('Alasan Error:', lastDisconnect.error.message || lastDisconnect.error);
                // Cek jika error 405
                if (lastDisconnect.error.output?.statusCode === 405) {
                    console.log('Error 405: Mungkin ada masalah dengan server atau koneksi internet.');
                    console.log('Coba: 1. Gunakan VPN 2. Pastikan internet stabil 3. Tunggu beberapa menit');
                }
            }
            const statusCode = lastDisconnect?.error?.output?.statusCode;
            const shouldReconnect = statusCode !== DisconnectReason.loggedOut;

            if (shouldReconnect) {
                console.log('Koneksi terputus. Akan mencoba kembali...');
                failAndCleanup(new Error('Connection closed, need to reconnect'));
            } else {
                console.log('Koneksi ditutup karena logout. Silakan scan QR code lagi.');
                const loggedOutError = new Error('Logged out');
                loggedOutError.isLoggedOut = true;
                failAndCleanup(loggedOutError);
            }
        } else if (connection === 'open') {
            console.log('Berhasil terhubung ke WhatsApp!');
            qrDisplayed = false;
            clearPendingTimeout();
            // Lepaskan listener fase inisialisasi agar tidak duplikat dengan listener runtime di index.js
            sock.ev.off('connection.update', onInitialConnectionUpdate);
            if (!settled) {
                settled = true;
                resolvePromise(sock);
            }
        }
    };

    sock.ev.on('connection.update', onInitialConnectionUpdate);

    // Set timeout untuk connection awal
    connectionTimeout = setTimeout(() => {
        if (!sock.user && !qrDisplayed && !settled) {
            console.log('Waktu koneksi habis. Coba ulang...');
            failAndCleanup(new Error('Connection timeout'));
        }
    }, 60000);

    return connectionPromise;
}

module.exports = {
    connectToWhatsApp,
    destroyWhatsAppSocket,
    purgeCorruptedSignalSession,
    isCorruptedSessionError,
    createTtlCache
};
