// Finance services (currency, stocks, etc.)
const supabase = require('../lib/supabaseClient');
const { formatRupiah, formatBulletList } = require('../utils/formatter');
const { t } = require('../utils/i18n');
const { encrypt, decrypt } = require('../utils/crypto');

const SHORT_ID_LENGTH = 8;

function toShortTransactionId(transactionId) {
  return String(transactionId || '').slice(0, SHORT_ID_LENGTH);
}

async function resolveTransactionId(userId, transactionIdInput, lang = 'en') {
  const rawId = String(transactionIdInput || '').trim().toLowerCase();

  if (!rawId) {
    return { errorMessage: t('finance.delete_not_found', {}, lang) };
  }

  if (rawId.length === 36) {
    return { resolvedId: rawId, shortId: toShortTransactionId(rawId) };
  }

  const { data, error } = await supabase
    .from('finance')
    .select('id')
    .eq('user_id', userId);

  if (error) {
    console.error('Error resolving transaction ID:', error);
    return { errorMessage: `${t('common.general_error', {}, lang)} (${error.message})` };
  }

  const matches = (data || []).filter((record) =>
    String(record.id || '').toLowerCase().startsWith(rawId)
  );

  if (matches.length === 0) {
    return { errorMessage: t('finance.delete_not_found', {}, lang) };
  }

  if (matches.length > 1) {
    const candidates = matches.slice(0, 3).map((record) => toShortTransactionId(record.id)).join(', ');
    return { errorMessage: `ID ambiguous. Try a longer ID prefix. Candidates: ${candidates}` };
  }

  const resolvedId = matches[0].id;
  return { resolvedId, shortId: toShortTransactionId(resolvedId) };
}

function formatHistoryText(records, page, pageSize, totalCount, lang = 'en') {
  const header = t('finance.history_header', {}, lang);

  if (!records || records.length === 0) {
    const body = formatBulletList([t('finance.history_empty', {}, lang)]);
    return `${header}\n\n${body}`;
  }

  const startIndex = (page - 1) * pageSize;
  const transactions = records.map((record, index) => {
    const typeEmoji = record.type === 'IN' ? '💸' : '📝';
    const typeText = record.type === 'IN'
      ? t('finance.history_type_in', {}, lang)
      : t('finance.history_type_out', {}, lang);
    const date = new Date(record.created_at).toLocaleDateString(lang === 'en' ? 'en-US' : 'id-ID');

    const itemHeader = `*${startIndex + index + 1}. ${typeEmoji} ${typeText}*`;
    const itemBody = formatBulletList({
      ID: `${toShortTransactionId(record.id)}`,
      [t('finance.amount', {}, lang)]: formatRupiah(record.amount),
      [t('finance.description', {}, lang)]: record.description,
      [t('finance.date', {}, lang)]: date
    });

    return `${itemHeader}\n${itemBody}`;
  });

  const totalPages = Math.max(1, Math.ceil((totalCount || records.length) / pageSize));
  const body = transactions.join('\n\n');
  const footer = t('finance.history_footer', {
    page,
    totalPages,
    count: records.length,
    total: totalCount || records.length
  }, lang);

  return `${header}\n\n${body}\n\n${footer}`;
}

async function getHistoryPage(userId, page = 1, pageSize = 5, lang = 'en') {
  try {
    const safePageSize = Number.isInteger(pageSize) && pageSize > 0 ? pageSize : 5;
    const safePage = Number.isInteger(page) && page > 0 ? page : 1;

    const from = (safePage - 1) * safePageSize;
    const to = from + safePageSize - 1;

    const { data, error, count } = await supabase
      .from('finance')
      .select('id, amount, type, description, created_at', { count: 'exact' })
      .eq('user_id', userId)
      .order('created_at', { ascending: false })
      .range(from, to);

    if (error) {
      console.error('Error querying paginated finance history:', error);
      const header = t('common.general_error', {}, lang);
      const body = formatBulletList([error.message]);
      return {
        text: `${header}\n\n${body}`,
        page: 1,
        totalPages: 1,
        totalCount: 0,
        hasPrev: false,
        hasNext: false
      };
    }

    const totalCount = count || 0;
    const totalPages = Math.max(1, Math.ceil(totalCount / safePageSize));
    const normalizedPage = Math.min(safePage, totalPages);

    if (normalizedPage !== safePage) {
      return await getHistoryPage(userId, normalizedPage, safePageSize, lang);
    }

    const decryptedRecords = (data || []).map((record) => {
      let cleanDesc = record.description;
      if (process.env.ENCRYPTION_KEY && record.description) {
        try {
          cleanDesc = decrypt(record.description);
        } catch (_) {
          cleanDesc = record.description;
        }
      }
      return { ...record, description: cleanDesc };
    });

    const text = formatHistoryText(decryptedRecords, normalizedPage, safePageSize, totalCount, lang);

    return {
      text,
      page: normalizedPage,
      totalPages,
      totalCount,
      hasPrev: normalizedPage > 1,
      hasNext: normalizedPage < totalPages
    };
  } catch (error) {
    console.error('Unexpected error in getHistoryPage:', error);
    const header = t('common.general_error', {}, lang);
    const body = formatBulletList([error.message]);
    return {
      text: `${header}\n\n${body}`,
      page: 1,
      totalPages: 1,
      totalCount: 0,
      hasPrev: false,
      hasNext: false
    };
  }
}

// Get transaction history
async function getHistory(userId, limit = 5, lang = 'en') {
  try {
    const safeLimit = Number.isInteger(limit) && limit > 0 ? limit : 5;
    const paged = await getHistoryPage(userId, 1, safeLimit, lang);
    return paged.text;
  } catch (error) {
    console.error('Unexpected error in getHistory:', error);
    const header = t('common.general_error', {}, lang);
    const body = formatBulletList([error.message]);
    return `${header}\n\n${body}`;
  }
}

// Delete a transaction
async function deleteTransaction(userId, transactionId, lang = 'en') {
  try {
    if (!transactionId || typeof transactionId !== 'string' || transactionId.trim().length === 0) {
      const header = t('common.format_error_header', {}, lang);
      const body = formatBulletList([t('finance.delete_format_error', {}, lang)]);
      return `${header}\n\n${body}`;
    }

    const { resolvedId, shortId, errorMessage } = await resolveTransactionId(userId, transactionId, lang);
    if (errorMessage) {
      const header = t('common.format_error_header', {}, lang);
      const body = formatBulletList([errorMessage]);
      return `${header}\n\n${body}`;
    }

    const { error } = await supabase
      .from('finance')
      .delete()
      .eq('id', resolvedId)
      .eq('user_id', userId);

    if (error) {
      console.error('Error deleting transaction:', error);
      const header = t('common.general_error', {}, lang);
      const body = formatBulletList([error.message]);
      return `${header}\n\n${body}`;
    }

    return t('finance.delete_success', { id: shortId }, lang);
  } catch (error) {
    console.error('Unexpected error in deleteTransaction:', error);
    const header = t('common.general_error', {}, lang);
    const body = formatBulletList([error.message]);
    return `${header}\n\n${body}`;
  }
}

// Edit a transaction
async function editTransaction(userId, transactionId, newAmount, newDescription, lang = 'en') {
  try {
    if (!transactionId || typeof transactionId !== 'string' || transactionId.trim().length === 0) {
      const header = t('common.format_error_header', {}, lang);
      const body = formatBulletList([t('finance.edit_format_error', {}, lang)]);
      return `${header}\n\n${body}`;
    }

    if (isNaN(newAmount) || newAmount <= 0) {
      const header = t('common.input_error_header', {}, lang);
      const body = formatBulletList([t('finance.edit_amount_error', { id: transactionId, amount: newAmount }, lang)]);
      return `${header}\n\n${body}`;
    }

    const { resolvedId, shortId, errorMessage } = await resolveTransactionId(userId, transactionId, lang);
    if (errorMessage) {
      const header = t('common.format_error_header', {}, lang);
      const body = formatBulletList([errorMessage]);
      return `${header}\n\n${body}`;
    }

    let storedDescription = newDescription;
    if (process.env.ENCRYPTION_KEY && newDescription) {
      storedDescription = encrypt(newDescription);
    }

    const { data, error } = await supabase
      .from('finance')
      .update({
        amount: newAmount,
        description: storedDescription,
        updated_at: new Date().toISOString()
      })
      .eq('id', resolvedId)
      .eq('user_id', userId)
      .select();

    if (error) {
      console.error('Error editing transaction:', error);
      const header = t('common.general_error', {}, lang);
      const body = formatBulletList([error.message]);
      return `${header}\n\n${body}`;
    }

    if (!data || data.length === 0) {
      const header = t('common.format_error_header', {}, lang);
      const body = formatBulletList([t('finance.delete_not_found', {}, lang)]);
      return `${header}\n\n${body}`;
    }

    return t('finance.edit_success', { id: shortId }, lang);
  } catch (error) {
    console.error('Unexpected error in editTransaction:', error);
    const header = t('common.general_error', {}, lang);
    const body = formatBulletList([error.message]);
    return `${header}\n\n${body}`;
  }
}

// Check balance
async function checkSaldo(userId, lang = 'en') {
  try {
    const { data, error } = await supabase
      .from('finance')
      .select('amount, type')
      .eq('user_id', userId);

    if (error) {
      console.error('Error querying finance data for balance:', error);
      const header = t('common.general_error', {}, lang);
      const body = formatBulletList([error.message]);
      return `${header}\n\n${body}`;
    }

    if (!data || data.length === 0) {
      const header = t('finance.balance_header', {}, lang);
      const body = t('finance.balance_empty', {}, lang);
      return `${header}\n\n${body}`;
    }

    let totalIn = 0;
    let totalOut = 0;
    data.forEach((record) => {
      if (record.type === 'IN') {
        totalIn += record.amount;
      } else if (record.type === 'OUT') {
        totalOut += record.amount;
      }
    });

    const total = totalIn - totalOut;
    const header = t('finance.balance_header', {}, lang);
    const body = formatBulletList({
      [t('finance.balance_total', {}, lang)]: formatRupiah(total),
      [t('finance.balance_total_in', {}, lang)]: formatRupiah(totalIn),
      [t('finance.balance_total_out', {}, lang)]: formatRupiah(totalOut)
    });
    
    return `${header}\n\n${body}`;
  } catch (error) {
    console.error('Unexpected error in checkSaldo:', error);
    const header = t('common.general_error', {}, lang);
    const body = formatBulletList([error.message]);
    return `${header}\n\n${body}`;
  }
}

// Add a transaction record (structured result with encryption at rest)
async function addTransactionRecord(userId, amount, type, description, platform, lang = 'en') {
  try {
    if (isNaN(amount) || amount <= 0) {
      const header = t('common.input_error_header', {}, lang);
      const errorMessage = t('finance.record_amount_error', { command: '/record', amount }, lang);
      const body = formatBulletList([errorMessage]);
      return {
        success: false,
        error: errorMessage,
        message: `${header}\n\n${body}`
      };
    }

    let storedDescription = description;
    if (process.env.ENCRYPTION_KEY && description) {
      storedDescription = encrypt(description);
    }

    const { data, error } = await supabase
      .from('finance')
      .insert({
        user_id: userId,
        amount: amount,
        type: type,
        description: storedDescription,
        platform: platform,
        created_at: new Date().toISOString()
      })
      .select()
      .single();

    if (error) {
      console.error('Error inserting transaction:', error);
      const header = t('common.general_error', {}, lang);
      const body = formatBulletList([error.message]);
      return {
        success: false,
        error: error.message,
        message: `${header}\n\n${body}`
      };
    }

    const header = type === 'IN' 
      ? t('finance.income_recorded', {}, lang)
      : t('finance.expense_recorded', {}, lang);

    const body = formatBulletList({
      [t('finance.amount', {}, lang)]: formatRupiah(amount),
      [t('finance.description', {}, lang)]: description,
      Platform: platform
    });

    return {
      success: true,
      data,
      message: `${header}\n\n${body}`
    };
  } catch (error) {
    console.error('Unexpected error in addTransactionRecord:', error);
    const header = t('common.general_error', {}, lang);
    const body = formatBulletList([error.message]);
    return {
      success: false,
      error: error.message,
      message: `${header}\n\n${body}`
    };
  }
}

// Add a transaction (returns string response for legacy/dispatcher compatibility)
async function addTransaction(userId, amount, type, description, platform, lang = 'en') {
  const result = await addTransactionRecord(userId, amount, type, description, platform, lang);
  return result.message;
}

// Generate finance chart
async function getFinanceChart(userId, lang = 'en') {
  try {
    const { data, error } = await supabase
      .from('finance')
      .select('amount, type')
      .eq('user_id', userId);

    if (error) {
      console.error('Error querying finance data for chart:', error);
      const header = t('common.general_error', {}, lang);
      const body = formatBulletList([error.message]);
      return `${header}\n\n${body}`;
    }

    let totalIn = 0;
    let totalOut = 0;
    (data || []).forEach((record) => {
      if (record.type === 'IN') {
        totalIn += record.amount;
      } else if (record.type === 'OUT') {
        totalOut += record.amount;
      }
    });

    const inLabel = t('finance.history_type_in', {}, lang);
    const outLabel = t('finance.history_type_out', {}, lang);

    const chartConfig = {
      type: 'doughnut',
      data: {
        labels: [inLabel, outLabel],
        datasets: [{
          data: [totalIn, totalOut],
          backgroundColor: ['#4CAF50', '#F44336'],
          borderColor: ['#388E3C', '#D32F2F'],
          borderWidth: 1
        }]
      },
      options: {
        plugins: {
          legend: {
            display: true,
            position: 'bottom'
          },
          title: {
            display: true,
            text: lang === 'en' ? 'Financial Report' : 'Laporan Keuangan',
            font: {
              size: 16
            }
          }
        }
      }
    };

    const chartUrl = 'https://quickchart.io/chart?c=' + encodeURIComponent(JSON.stringify(chartConfig));
    const captionText = t('finance.chart_caption', {}, lang) + '\n\n' + formatBulletList({
      [inLabel]: formatRupiah(totalIn),
      [outLabel]: formatRupiah(totalOut)
    });

    return {
      type: 'image',
      url: chartUrl,
      caption: captionText
    };
  } catch (error) {
    console.error('Unexpected error in getFinanceChart:', error);
    const header = t('common.general_error', {}, lang);
    const body = formatBulletList([error.message]);
    return `${header}\n\n${body}`;
  }
}

module.exports = {
  checkSaldo,
  addTransaction,
  addTransactionRecord,
  getFinanceChart,
  getHistory,
  getHistoryPage,
  deleteTransaction,
  editTransaction
};
