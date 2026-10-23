// Religion and prayer schedule command handler
const { getSholat } = require('../../services/religionService');
const { t } = require('../../utils/i18n');

async function handleReligionCommand(command, args, userId, platform, context = {}) {
    const cleanCommand = String(command || '').toLowerCase().trim();
    const lang = context?.lang || 'en';

    if (cleanCommand !== '/sholat' && cleanCommand !== '/prayer' && cleanCommand !== '/jadwalsholat') {
        const header = t('common.unknown_command_header', {}, lang);
        return `${header}\n\n${t('common.unknown_command_body', { command }, lang)}`;
    }
    
    if (args.length === 0) {
        const header = t('common.format_error_header', {}, lang);
        const body = t('religion.format_error', {}, lang);
        return `${header}\n\n${body}`;
    }
    
    const kota = args.join(' ');
    return await getSholat(kota, lang);
}

module.exports = {
    handleReligionCommand
};
