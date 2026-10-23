// Research reference commands handler (/buku, /book, /jurnal, /journal, /artikel, /paper)
const { searchBooks, searchJournals, searchArticles } = require('../../services/researchService');
const { escapeHtml } = require('../../utils/textFormatter');
const { t } = require('../../utils/i18n');

function buildBookRecommendation(keyword, books = [], platform = 'whatsapp', lang = 'en') {
  const isTele = platform === 'telegram';
  const safeKeyword = isTele ? escapeHtml(keyword) : String(keyword || '').trim();
  const header = t('research.book_header', { keyword: safeKeyword }, lang);
  const authorLabel = t('research.book_author', {}, lang);
  const yearLabel = t('research.book_year', {}, lang);
  const linkLabel = t('research.book_link', {}, lang);
  const lines = [header];

  books.slice(0, 5).forEach((book, index) => {
    lines.push('');
    const title = isTele ? escapeHtml(book?.title || '-') : String(book?.title || '-');
    const author = isTele ? escapeHtml(book?.author || '-') : String(book?.author || '-');
    const year = isTele ? escapeHtml(book?.year || '-') : String(book?.year || '-');
    const url = isTele ? escapeHtml(book?.url || 'https://openlibrary.org') : String(book?.url || 'https://openlibrary.org');
    lines.push(`${index + 1}. ${title}`);
    lines.push(`   👤 ${authorLabel}: ${author}`);
    lines.push(`   📅 ${yearLabel}: ${year}`);
    lines.push(`   🔗 ${linkLabel}: ${url}`);
  });

  return lines.join('\n');
}

function buildJournalRecommendation(keyword, journals = [], platform = 'whatsapp', lang = 'en') {
  const isTele = platform === 'telegram';
  const safeKeyword = isTele ? escapeHtml(keyword) : String(keyword || '').trim();
  const header = t('research.journal_header', { keyword: safeKeyword }, lang);
  const authorLabel = t('research.journal_author', {}, lang);
  const journalLabel = t('research.journal_name', {}, lang);
  const yearLabel = t('research.journal_year', {}, lang);
  const lines = [header];

  journals.slice(0, 5).forEach((item, index) => {
    lines.push('');
    const title = isTele ? escapeHtml(item?.title || '-') : String(item?.title || '-');
    const author = isTele ? escapeHtml(item?.author || '-') : String(item?.author || '-');
    const journal = isTele ? escapeHtml(item?.journal || '-') : String(item?.journal || '-');
    const year = isTele ? escapeHtml(item?.year || '-') : String(item?.year || '-');
    const doiUrl = isTele ? escapeHtml(item?.doiUrl || '-') : String(item?.doiUrl || '-');
    lines.push(`${index + 1}. ${title}`);
    lines.push(`   👤 ${authorLabel}: ${author}`);
    lines.push(`   📚 ${journalLabel}: ${journal}`);
    lines.push(`   📅 ${yearLabel}: ${year}`);
    lines.push(`   🔗 DOI: ${doiUrl}`);
  });

  return lines.join('\n');
}

function buildArticleRecommendation(keyword, articles = [], platform = 'whatsapp', lang = 'en') {
  const isTele = platform === 'telegram';
  const safeKeyword = isTele ? escapeHtml(keyword) : String(keyword || '').trim();
  const header = t('research.paper_header', { keyword: safeKeyword }, lang);
  const authorLabel = t('research.book_author', {}, lang);
  const yearLabel = t('research.book_year', {}, lang);
  const linkLabel = t('research.book_link', {}, lang);
  const lines = [header];

  articles.slice(0, 5).forEach((item, index) => {
    lines.push('');
    const title = isTele ? escapeHtml(item?.title || '-') : String(item?.title || '-');
    const author = isTele ? escapeHtml(item?.author || '-') : String(item?.author || '-');
    const year = isTele ? escapeHtml(item?.year || '-') : String(item?.year || '-');
    const link = isTele ? escapeHtml(item?.link || '-') : String(item?.link || '-');
    lines.push(`${index + 1}. ${title}`);
    lines.push(`   👤 ${authorLabel}: ${author}`);
    lines.push(`   📅 ${yearLabel}: ${year}`);
    lines.push(`   🔗 ${linkLabel}: ${link}`);
  });

  return lines.join('\n');
}

async function handleResearchCommand(command, args = [], userId = '', platform = 'whatsapp', context = {}) {
  const cleanCommand = String(command || '').toLowerCase().trim();
  const keyword = String(args.join(' ') || '').trim();
  const lang = context?.lang || 'en';

  switch (cleanCommand) {
    case '/book':
    case '/buku': {
      if (!keyword) {
        return t('research.book_prompt', {}, lang);
      }

      try {
        const books = await searchBooks(keyword);
        if (!Array.isArray(books) || books.length === 0) {
          return t('research.book_not_found', { keyword }, lang);
        }
        return buildBookRecommendation(keyword, books, platform, lang);
      } catch (error) {
        console.error('Error in /buku:', error);
        return t('research.error_failed', {}, lang);
      }
    }

    case '/journal':
    case '/jurnal': {
      if (!keyword) {
        return t('research.journal_prompt', {}, lang);
      }

      try {
        const journals = await searchJournals(keyword);
        if (!Array.isArray(journals) || journals.length === 0) {
          return t('research.journal_not_found', { keyword }, lang);
        }
        return buildJournalRecommendation(keyword, journals, platform, lang);
      } catch (error) {
        console.error('Error in /jurnal:', error);
        return t('research.error_failed', {}, lang);
      }
    }

    case '/paper':
    case '/article':
    case '/artikel': {
      if (!keyword) {
        return t('research.paper_prompt', {}, lang);
      }

      try {
        const articles = await searchArticles(keyword);
        if (!Array.isArray(articles) || articles.length === 0) {
          return t('research.paper_not_found', { keyword }, lang);
        }
        return buildArticleRecommendation(keyword, articles, platform, lang);
      } catch (error) {
        console.error('Error in /artikel:', error);
        return t('research.error_failed', {}, lang);
      }
    }

    default:
      return t('common.unknown_command_body', { command }, lang);
  }
}

module.exports = {
  handleResearchCommand
};
