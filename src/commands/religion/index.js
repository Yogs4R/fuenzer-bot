// Religion and prayer schedule command handler
const { getSholat } = require('../../services/religionService');

async function handleReligionCommand(command, args, userId, platform) {
    if (command !== '/sholat') {
        return 'Perintah tidak dikenali.';
    }
    
    if (args.length === 0) {
        return platform === 'telegram'
            ? '<b>ERROR FORMAT</b> ❌\n\n• Gunakan format: <code>/sholat &lt;nama_kota&gt;</code>\n• Contoh: <code>/sholat Jakarta</code>'
            : '> *ERROR FORMAT* ❌\n\n• Gunakan format: /sholat <nama_kota>\n• Contoh: /sholat Jakarta';
    }
    
    const kota = args.join(' ');
    return await getSholat(kota);
}

module.exports = {
    handleReligionCommand
};
