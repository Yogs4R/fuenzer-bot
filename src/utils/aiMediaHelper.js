// Helper for multimodal AI media extraction and validation
function buildMultimodalPayload({ isImage, isDoc, fileSizeBytes = 0, buffer, mimeType = '', fileName = '', cleanText = '' }) {
  if (isImage) {
    if (fileSizeBytes > 5 * 1024 * 1024) {
      throw new Error('⛔ Ukuran gambar terlalu besar! Maksimal 5 MB.');
    }
    const base64Data = buffer.toString('base64');
    const promptUser = cleanText || 'Tolong jelaskan gambar ini.';
    const finalMime = mimeType || 'image/jpeg';
    return [
      { type: 'text', text: promptUser },
      { type: 'image_url', image_url: { url: `data:${finalMime};base64,${base64Data}` } }
    ];
  }

  if (isDoc) {
    if (fileSizeBytes > 10 * 1024 * 1024) {
      throw new Error('⛔ Ukuran dokumen terlalu besar! Maksimal 10 MB.');
    }

    const isText = mimeType.includes('text') || mimeType.includes('json') || mimeType.includes('csv');
    const isTextExt = fileName.endsWith('.js') || fileName.endsWith('.md') || fileName.endsWith('.txt') || fileName.endsWith('.csv') || fileName.endsWith('.json');

    if (isText || isTextExt) {
      const fileContent = buffer.toString('utf-8');
      return `[Isi File Terlampir:\n${fileContent}\n]\n\n${cleanText}`;
    }

    throw new Error('⛔ Mohon maaf, untuk saat ini Fuenzer Bot lebih optimal membaca file berbentuk gambar atau teks (.txt).');
  }

  return cleanText;
}

module.exports = {
  buildMultimodalPayload
};
