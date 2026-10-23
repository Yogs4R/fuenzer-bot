// Google Services & Customer Service (Sheet Sync) command handler
const { sendToSheet, updateStatusAnswered } = require('../../services/csService');
const { t } = require('../../utils/i18n');

async function handleGoogleCommand(command, args = [], userId = '', platform = 'whatsapp', context = {}) {
  const cleanCommand = String(command || '').toLowerCase().trim();
  const lang = context?.lang || 'en';

  switch (cleanCommand) {
    case '/help':
    case '/bantuan': {
      const header = t('google.help_header', {}, lang);
      const body = t('google.help_body', {}, lang);
      return `${header}\n\n${body}`;
    }

    case '/feedback':
    case '/saran': {
      const pesan = args.join(' ').trim();
      if (!pesan) {
        return t('google.feedback_prompt', {}, lang);
      }
      await sendToSheet('FEEDBACK', userId, pesan);
      return t('google.feedback_success', {}, lang);
    }

    case '/ask': {
      const pesan = args.join(' ').trim();
      if (!pesan) {
        return t('google.ask_prompt', {}, lang);
      }
      await sendToSheet('ASK', userId, pesan);
      return t('google.ask_success', {}, lang);
    }

    default:
      return t('common.unknown_command_body', { command }, lang);
  }
}

module.exports = {
  handleGoogleCommand,
  updateStatusAnswered
};
