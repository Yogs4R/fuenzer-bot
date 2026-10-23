// About me service
const { t } = require('../utils/i18n');

function getAboutMe(platform = 'whatsapp', lang = 'en') {
    const header = t('about.header', {}, lang);
    const body = t('about.body', {}, lang);
    return `${header}\n\n${body}`;
}

async function handleAboutMeCommand(command, args, userId, platform = 'whatsapp', lang = 'en') {
    if (command !== '/me' && command !== '/about') {
        return t('common.unknown_command_body', { command }, lang);
    }
    return getAboutMe(platform, lang);
}

module.exports = {
    getAboutMe,
    handleAboutMeCommand
};
