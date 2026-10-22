// Google Services & Customer Service (Sheet Sync) command handler
const { sendToSheet, updateStatusAnswered } = require('../../services/csService');

async function handleGoogleCommand(command, args = [], userId = '', platform = 'whatsapp') {
  const cleanCommand = String(command || '').toLowerCase().trim();

  switch (cleanCommand) {
    case '/help': {
      return platform === 'whatsapp'
        ? '*PUSAT BANTUAN & FEEDBACK* 🆘\n\nJika kamu menemukan bug atau punya pertanyaan seputar fitur bot, gunakan fitur CS ini:\n\n1. `/feedback [pesan]` : Berikan saran, kritik, atau laporan bug ke tim Fuenzer.\n2. `/ask [pesan]` : Tanyakan apa saja ke Admin terkait operasional bot.\n\nContoh:\n`/feedback Fitur translate error saat menerjemahkan ke bahasa Korea`\n`/ask Bagaimana cara upgrade kuota premium?`'
        : '<b>PUSAT BANTUAN & FEEDBACK</b> 🆘\n\nJika kamu menemukan bug atau punya pertanyaan seputar fitur bot, gunakan fitur CS ini:\n\n1. <code>/feedback [pesan]</code> : Berikan saran, kritik, atau laporan bug ke tim Fuenzer.\n2. <code>/ask [pesan]</code> : Tanyakan apa saja ke Admin terkait operasional bot.\n\nContoh:\n<code>/feedback Fitur translate error saat menerjemahkan ke bahasa Korea</code>\n<code>/ask Bagaimana cara upgrade kuota premium?</code>';
    }

    case '/feedback': {
      const pesan = args.join(' ').trim();
      if (!pesan) {
        return platform === 'whatsapp'
          ? 'Silakan tuliskan pesan feedback setelah command.\nContoh: `/feedback bot ini sangat membantu!`'
          : 'Silakan tuliskan pesan feedback setelah command.\nContoh: <code>/feedback bot ini sangat membantu!</code>';
      }
      await sendToSheet('FEEDBACK', userId, pesan);
      return '✅ Terima kasih! Feedback kamu telah masuk ke sistem Fuenzer Studio.';
    }

    case '/ask': {
      const pesan = args.join(' ').trim();
      if (!pesan) {
        return platform === 'whatsapp'
          ? 'Silakan tuliskan pertanyaan setelah command.\nContoh: `/ask kapan fitur baru rilis?`'
          : 'Silakan tuliskan pertanyaan setelah command.\nContoh: <code>/ask kapan fitur baru rilis?</code>';
      }
      await sendToSheet('ASK', userId, pesan);
      return '✅ Pertanyaan kamu telah dikirim ke Admin. Harap tunggu balasannya ya!';
    }

    default:
      return 'Perintah tidak dikenali.';
  }
}

module.exports = handleGoogleCommand;
module.exports.handleGoogleCommand = handleGoogleCommand;
module.exports.sendToSheet = sendToSheet;
module.exports.updateStatusAnswered = updateStatusAnswered;
