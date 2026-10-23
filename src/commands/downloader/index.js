const {
  getDownloadUrl,
  getAudioUrl,
  getMediaBuffer,
  getAudioBuffer
} = require('../../services/downloaderService');
const { t } = require('../../utils/i18n');

function formatErrorMessage(err, type = 'media', platform = 'whatsapp', lang = 'en') {
  const errCode = err?.message || '';

  if (errCode === 'FILE_TOO_LARGE') {
    return t('downloader.file_too_large', {}, lang);
  }
  if (errCode === 'FB_NOT_SUPPORTED') {
    return t('downloader.fb_not_supported', {}, lang);
  }
  if (errCode === 'AUDIO_PLATFORM_NOT_SUPPORTED') {
    return t('downloader.audio_platform_not_supported', {}, lang);
  }
  if (errCode === 'DOWNLOAD_BUFFER_FAILED') {
    return t('downloader.download_buffer_failed', {}, lang);
  }
  if (errCode === 'AUDIO_NOT_FOUND') {
    return t('downloader.audio_not_found', {}, lang);
  }

  return t('downloader.failed', {}, lang);
}

async function handleDownloadCommand(targetUrl, platform = 'whatsapp', lang = 'en') {
  const url = String(targetUrl || '').trim();
  if (!url) {
    return {
      success: false,
      message: t('downloader.input_prompt', {}, lang)
    };
  }

  try {
    const mediaUrls = await getDownloadUrl(url);
    if (!Array.isArray(mediaUrls) || mediaUrls.length === 0) {
      throw new Error('DOWNLOAD_FAILED');
    }

    const items = [];
    let hasFileTooLarge = false;
    let hasBufferFailed = false;

    for (const mediaUrl of mediaUrls) {
      try {
        const media = await getMediaBuffer(mediaUrl);
        items.push({
          type: media.type === 'video' ? 'video' : 'image',
          buffer: media.buffer,
          mimetype: media.type === 'video' ? 'video/mp4' : 'image/jpeg'
        });
      } catch (itemErr) {
        console.error('Failed to fetch media buffer:', itemErr.message);
        if (itemErr.message === 'FILE_TOO_LARGE') {
          hasFileTooLarge = true;
        }
        if (itemErr.message === 'DOWNLOAD_BUFFER_FAILED') {
          hasBufferFailed = true;
        }
      }
    }

    if (items.length === 0) {
      if (hasFileTooLarge) throw new Error('FILE_TOO_LARGE');
      if (hasBufferFailed) throw new Error('DOWNLOAD_BUFFER_FAILED');
      throw new Error('DOWNLOAD_FAILED');
    }

    return {
      success: true,
      items
    };
  } catch (error) {
    return {
      success: false,
      message: formatErrorMessage(error, 'media', platform, lang)
    };
  }
}

async function handleAudioCommand(targetUrl, platform = 'whatsapp', lang = 'en') {
  const url = String(targetUrl || '').trim();
  if (!url) {
    return {
      success: false,
      message: t('downloader.audio_prompt', {}, lang)
    };
  }

  try {
    const audioUrl = await getAudioUrl(url);
    const audio = await getAudioBuffer(audioUrl);

    return {
      success: true,
      buffer: audio.buffer,
      mimetype: audio.mimetype || 'audio/mpeg',
      filename: 'audio.mp3'
    };
  } catch (error) {
    return {
      success: false,
      message: formatErrorMessage(error, 'audio', platform, lang)
    };
  }
}

module.exports = {
  handleDownloadCommand,
  handleAudioCommand
};
