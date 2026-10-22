// Research reference commands handler (/buku, /jurnal, /artikel)
const { searchBooks, searchJournals, searchArticles } = require('../../services/researchService');

const { escapeHtml } = require('../../utils/textFormatter');

function buildBookRecommendation(keyword, books = [], platform = 'whatsapp') {
  const isTele = platform === 'telegram';
  const safeKeyword = isTele ? escapeHtml(keyword) : String(keyword || '').trim();
  const lines = [`📚 REKOMENDASI BUKU: ${safeKeyword}`];

  books.slice(0, 5).forEach((book, index) => {
    lines.push('');
    const title = isTele ? escapeHtml(book?.title || '-') : String(book?.title || '-');
    const author = isTele ? escapeHtml(book?.author || '-') : String(book?.author || '-');
    const year = isTele ? escapeHtml(book?.year || '-') : String(book?.year || '-');
    const url = isTele ? escapeHtml(book?.url || 'https://openlibrary.org') : String(book?.url || 'https://openlibrary.org');
    lines.push(`${index + 1}. ${title}`);
    lines.push(`   👤 Penulis: ${author}`);
    lines.push(`   📅 Tahun: ${year}`);
    lines.push(`   🔗 Link: ${url}`);
  });

  return lines.join('\n');
}

function buildJournalRecommendation(keyword, journals = [], platform = 'whatsapp') {
  const isTele = platform === 'telegram';
  const safeKeyword = isTele ? escapeHtml(keyword) : String(keyword || '').trim();
  const lines = [`🎓 REFERENSI JURNAL: ${safeKeyword}`];

  journals.slice(0, 5).forEach((item, index) => {
    lines.push('');
    const title = isTele ? escapeHtml(item?.title || '-') : String(item?.title || '-');
    const author = isTele ? escapeHtml(item?.author || '-') : String(item?.author || '-');
    const journal = isTele ? escapeHtml(item?.journal || '-') : String(item?.journal || '-');
    const year = isTele ? escapeHtml(item?.year || '-') : String(item?.year || '-');
    const doiUrl = isTele ? escapeHtml(item?.doiUrl || '-') : String(item?.doiUrl || '-');
    lines.push(`${index + 1}. ${title}`);
    lines.push(`   👤 Penulis: ${author}`);
    lines.push(`   📚 Jurnal: ${journal}`);
    lines.push(`   📅 Tahun: ${year}`);
    lines.push(`   🔗 DOI: ${doiUrl}`);
  });

  return lines.join('\n');
}

function buildArticleRecommendation(keyword, articles = [], platform = 'whatsapp') {
  const isTele = platform === 'telegram';
  const safeKeyword = isTele ? escapeHtml(keyword) : String(keyword || '').trim();
  const lines = [`📰 REFERENSI ARTIKEL: ${safeKeyword}`];

  articles.slice(0, 5).forEach((item, index) => {
    lines.push('');
    const title = isTele ? escapeHtml(item?.title || '-') : String(item?.title || '-');
    const author = isTele ? escapeHtml(item?.author || '-') : String(item?.author || '-');
    const year = isTele ? escapeHtml(item?.year || '-') : String(item?.year || '-');
    const link = isTele ? escapeHtml(item?.link || '-') : String(item?.link || '-');
    lines.push(`${index + 1}. ${title}`);
    lines.push(`   👤 Penulis: ${author}`);
    lines.push(`   📅 Tahun: ${year}`);
    lines.push(`   🔗 Link: ${link}`);
  });

  return lines.join('\n');
}

async function handleResearchCommand(command, args = [], userId = '', platform = 'whatsapp') {
  const cleanCommand = String(command || '').toLowerCase().trim();
  const keyword = String(args.join(' ') || '').trim();

  switch (cleanCommand) {
    case '/buku': {
      if (!keyword) {
        return platform === 'whatsapp'
          ? '❌ Masukkan kata kunci buku! Contoh: /buku atomic habits'
          : '❌ Masukkan kata kunci buku! Contoh: <code>/buku atomic habits</code>';
      }

      try {
        const books = await searchBooks(keyword);
        if (!Array.isArray(books) || books.length === 0) {
          return `📚 REKOMENDASI BUKU: ${keyword}\n\nTidak ada hasil ditemukan. Coba keyword lain.`;
        }
        return buildBookRecommendation(keyword, books, platform);
      } catch (error) {
        console.error('Error in /buku:', error);
        const detailedMessage = String(error?.message || '').trim();
        return detailedMessage || '❌ Gagal mencari buku. Coba lagi beberapa saat.';
      }
    }

    case '/jurnal': {
      if (!keyword) {
        return platform === 'whatsapp'
          ? '❌ Masukkan kata kunci jurnal/artikel! Contoh: /jurnal machine learning'
          : '❌ Masukkan kata kunci jurnal/artikel! Contoh: <code>/jurnal machine learning</code>';
      }

      try {
        const journals = await searchJournals(keyword);
        if (!Array.isArray(journals) || journals.length === 0) {
          return `🎓 REFERENSI JURNAL: ${keyword}\n\nTidak ada hasil ditemukan. Coba keyword lain.`;
        }
        return buildJournalRecommendation(keyword, journals, platform);
      } catch (error) {
        console.error('Error in /jurnal:', error);
        const detailedMessage = String(error?.message || '').trim();
        return detailedMessage || '❌ Gagal mencari jurnal. Coba lagi beberapa saat.';
      }
    }

    case '/artikel': {
      if (!keyword) {
        return platform === 'whatsapp'
          ? '❌ Masukkan kata kunci artikel! Contoh: /artikel machine learning'
          : '❌ Masukkan kata kunci artikel! Contoh: <code>/artikel machine learning</code>';
      }

      try {
        const articles = await searchArticles(keyword);
        if (!Array.isArray(articles) || articles.length === 0) {
          return `📰 REFERENSI ARTIKEL: ${keyword}\n\nTidak ada hasil ditemukan. Coba keyword lain.`;
        }
        return buildArticleRecommendation(keyword, articles, platform);
      } catch (error) {
        console.error('Error in /artikel:', error);
        const detailedMessage = String(error?.message || '').trim();
        return detailedMessage || '❌ Gagal mencari artikel ilmiah. Coba lagi beberapa saat.';
      }
    }

    default:
      return 'Perintah riset tidak dikenali.';
  }
}

module.exports = {
  handleResearchCommand
};
