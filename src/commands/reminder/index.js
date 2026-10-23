const { addReminder, listReminders, deleteReminder, updateReminder } = require('../../services/reminderService');
const { t } = require('../../utils/i18n');

async function handleReminderCommand(args = [], userId = '', platform = 'whatsapp', context = {}) {
    const lang = context?.lang || 'en';

    if (args.length === 0) {
        const header = t('common.format_error_header', {}, lang);
        const body = t('reminder.format_error', {}, lang);
        return `${header}\n\n${body}`;
    }

    const subCommand = String(args[0] || '').toLowerCase().trim();

    try {
        if (subCommand === 'add' || subCommand === 'loop') {
            if (args.length < 3) {
                const header = t('common.format_error_header', {}, lang);
                const body = t('reminder.format_error', {}, lang);
                return `${header}\n\n${body}`;
            }
            const timeStr = args[1];
            const message = args.slice(2).join(' ');
            const isLoop = subCommand === 'loop';

            const data = await addReminder(userId, timeStr, message, isLoop);
            
            if (isLoop) {
                return t('reminder.loop_success', { time: timeStr, message }, lang) + `\nID: \`${data.id}\``;
            } else {
                return t('reminder.add_success', { time: timeStr, message }, lang) + `\nID: \`${data.id}\``;
            }
        }

        if (subCommand === 'list') {
            const reminders = await listReminders(userId);
            if (reminders.length === 0) {
                const header = t('reminder.list_header', {}, lang);
                const body = t('reminder.list_empty', {}, lang);
                return `${header}\n\n${body}`;
            }

            const header = t('reminder.list_header', {}, lang);
            const items = reminders.map((r, idx) => {
                const date = new Date(r.trigger_time).toLocaleString(lang === 'en' ? 'en-US' : 'id-ID');
                const icon = r.is_loop ? '🔁' : '⏰';
                return `${idx + 1}. [${r.id}] ${icon} ${date}\n   ${lang === 'en' ? 'Message' : 'Pesan'}: ${r.message}`;
            }).join('\n');

            return `${header}\n\n${items}`;
        }

        if (subCommand === 'hapus' || subCommand === 'delete') {
            if (args.length < 2) {
                const header = t('common.format_error_header', {}, lang);
                return `${header}\n\n${lang === 'en' ? 'Please provide ID. Example: /remind delete A1B2C' : 'Sertakan ID! Contoh: /remind hapus A1B2C'}`;
            }
            const reqId = args[1];
            await deleteReminder(userId, reqId);
            return t('reminder.deleted', { id: reqId }, lang);
        }

        if (subCommand === 'edit') {
            if (args.length < 4) {
                const header = t('common.format_error_header', {}, lang);
                return `${header}\n\n${lang === 'en' ? 'Incomplete format! Use: /remind edit [id] [time] [message]' : 'Format tidak lengkap! Gunakan: /remind edit [id] [waktu] [pesan]'}`;
            }
            const reqId = args[1];
            const timeStr = args[2];
            const message = args.slice(3).join(' ');

            await updateReminder(userId, reqId, timeStr, message);
            return `${lang === 'en' ? `✅ Reminder ${reqId} successfully updated.` : `✅ Pengingat ${reqId} berhasil diupdate.`}`;
        }

        const header = t('common.unknown_command_header', {}, lang);
        return `${header}\n\n${t('reminder.format_error', {}, lang)}`;
    } catch (error) {
        return `❌ ${error.message}`;
    }
}

module.exports = {
    handleReminderCommand
};
