// Utility command handler (shortener)
const { shortenUrl } = require('../../services/shortenerService');
const { escapeHtml } = require('../../utils/textFormatter');

async function handleShortCommand(args, platform = 'telegram') {
    const originalUrl = String(args.join(' ') || '').trim();

    if (!originalUrl) {
        return platform === 'telegram'
            ? '❌ Masukkan link yang ingin dipendekkan! Contoh: <code>/short https://fuenzerstudio.com</code>'
            : '❌ Masukkan link yang ingin dipendekkan! Contoh: /short https://fuenzerstudio.com';
    }

    if (!(originalUrl.startsWith('http://') || originalUrl.startsWith('https://'))) {
        return platform === 'telegram'
            ? '❌ URL tidak valid! URL harus diawali <code>http://</code> atau <code>https://</code>'
            : '❌ URL tidak valid! URL harus diawali http:// atau https://';
    }

    try {
        const shortUrl = await shortenUrl(originalUrl);
        return platform === 'telegram'
            ? `✅ Berhasil dipendekkan!\n🔗 URL Asli: ${escapeHtml(originalUrl)}\n✨ URL Pendek: ${escapeHtml(shortUrl)}`
            : `✅ Berhasil dipendekkan!\n🔗 URL Asli: ${originalUrl}\n✨ URL Pendek: ${shortUrl}`;
    } catch (error) {
        console.error('Error handling /short command:', error);
        return platform === 'telegram'
            ? `❌ Gagal memendekkan URL: ${escapeHtml(error.message)}`
            : `❌ Gagal memendekkan URL: ${error.message}`;
    }
}

module.exports = {
    handleShortCommand
};
