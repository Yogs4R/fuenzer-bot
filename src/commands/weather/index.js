// Weather command handler
const { getCuaca } = require('../../services/weatherService');

async function handleWeatherCommand(command, args, userId, platform) {
    if (command !== '/cuaca') {
        return 'Perintah tidak dikenali.';
    }
    
    if (args.length === 0) {
        return platform === 'telegram'
            ? '<b>ERROR FORMAT</b> ❌\n\n• Gunakan format: <code>/cuaca &lt;nama_kota&gt;</code>\n• Contoh: <code>/cuaca Jakarta</code>'
            : '> *ERROR FORMAT* ❌\n\n• Gunakan format: /cuaca <nama_kota>\n• Contoh: /cuaca Jakarta';
    }
    
    const kota = args.join(' ');
    return await getCuaca(kota);
}

module.exports = {
    handleWeatherCommand
};
