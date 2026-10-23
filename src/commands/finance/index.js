const { 
  checkSaldo, 
  addTransaction, 
  getFinanceChart,
  getHistory,
  deleteTransaction,
  editTransaction 
} = require('../../services/financeService');
const { formatBulletList } = require('../../utils/formatter');
const { t } = require('../../utils/i18n');

async function handleFinanceCommand(command, args, userId, platform, context = {}) {
  // Clean command to ensure it's in lowercase
  const cleanCommand = String(command || '').toLowerCase().trim();
  const lang = context?.lang || 'en';
  
  switch (cleanCommand) {
    case '/saldo':
    case '/balance':
      return await checkSaldo(userId, lang);
      
    case '/catat':
    case '/record':
    case '/expense':
    case '/pengeluaran':
    case '/pemasukan':
    case '/income':
      // Ensure there are enough arguments
      if (args.length < 2) {
        const header = t('common.format_error_header', {}, lang);
        const body = formatBulletList([
          t('finance.record_format_error', { command: cleanCommand }, lang)
        ]);
        return `${header}\n\n${body}`;
      }
      
      // Clean the amount: remove non-numeric characters except digits
      const rawAmount = args[0];
      const cleanedAmount = rawAmount.replace(/[^\d]/g, '');
      const amount = parseInt(cleanedAmount, 10);
      
      if (isNaN(amount) || amount <= 0) {
        const header = t('common.input_error_header', {}, lang);
        const body = formatBulletList([
          t('finance.record_amount_error', { command: cleanCommand, amount: rawAmount }, lang)
        ]);
        return `${header}\n\n${body}`;
      }
      
      // The rest of the arguments form the description
      const description = args.slice(1).join(' ');
      
      // Determine transaction type based on command
      const isIncome = cleanCommand === '/pemasukan' || cleanCommand === '/income';
      const type = isIncome ? 'IN' : 'OUT';
      
      return await addTransaction(userId, amount, type, description, platform, lang);
      
    case '/laporan_chart':
    case '/chart':
      return await getFinanceChart(userId, lang);
      
    case '/riwayat':
    case '/history':
      // Optional limit parameter
      const limit = args.length > 0 ? parseInt(args[0], 10) : 5;
      return await getHistory(userId, isNaN(limit) ? 5 : limit, lang);
      
    case '/hapus':
    case '/delete':
      if (args.length < 1) {
        const header = t('common.format_error_header', {}, lang);
        const body = formatBulletList([
          t('finance.delete_format_error', {}, lang)
        ]);
        return `${header}\n\n${body}`;
      }
      return await deleteTransaction(userId, args[0], lang);
      
    case '/edit':
      if (args.length < 3) {
        const header = t('common.format_error_header', {}, lang);
        const body = formatBulletList([
          t('finance.edit_format_error', {}, lang)
        ]);
        return `${header}\n\n${body}`;
      }
      
      // Clean the new amount
      const newRawAmount = args[1];
      const newCleanedAmount = newRawAmount.replace(/[^\d]/g, '');
      const newAmount = parseInt(newCleanedAmount, 10);
      
      if (isNaN(newAmount) || newAmount <= 0) {
        const header = t('common.input_error_header', {}, lang);
        const body = formatBulletList([
          t('finance.edit_amount_error', { id: args[0], amount: newRawAmount }, lang)
        ]);
        return `${header}\n\n${body}`;
      }
      
      // The rest of the arguments form the new description
      const newDescription = args.slice(2).join(' ');
      
      return await editTransaction(userId, args[0], newAmount, newDescription, lang);
      
    default: {
      const header = t('common.unknown_command_header', {}, lang);
      const body = t('common.unknown_command_body', { command }, lang);
      return `${header}\n\n${body}`;
    }
  }
}

module.exports = handleFinanceCommand;
