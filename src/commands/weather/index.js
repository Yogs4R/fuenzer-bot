// Weather command handler
const { getCuaca } = require('../../services/weatherService');
const { t } = require('../../utils/i18n');

async function handleWeatherCommand(command, args, userId, platform, context = {}) {
    const cleanCommand = String(command || '').toLowerCase().trim();
    const lang = context?.lang || 'en';

    if (cleanCommand !== '/cuaca' && cleanCommand !== '/weather') {
        const header = t('common.unknown_command_header', {}, lang);
        return `${header}\n\n${t('common.unknown_command_body', { command }, lang)}`;
    }
    
    if (args.length === 0) {
        const header = t('common.format_error_header', {}, lang);
        const body = t('weather.format_error', {}, lang);
        return `${header}\n\n${body}`;
    }
    
    const kota = args.join(' ');
    return await getCuaca(kota, lang);
}

module.exports = {
    handleWeatherCommand
};
