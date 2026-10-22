const {
  getDownloadUrl,
  getAudioUrl,
  getMediaBuffer,
  getAudioBuffer
} = require('../../services/downloaderService');

function formatErrorMessage(err, type = 'media', platform = 'whatsapp') {
  const isTele = platform === 'telegram';
  const errCode = err?.message || '';

  if (errCode === 'FILE_TOO_LARGE') {
    return '❌ Gagal: Ukuran file terlalu besar (Maksimal 25MB demi stabilitas bot).';
  }
  if (errCode === 'FB_NOT_SUPPORTED') {
    return '❌ Mohon maaf, fitur download Facebook sedang dalam perbaikan.';
  }
  if (errCode === 'AUDIO_PLATFORM_NOT_SUPPORTED') {
    return isTele
      ? '❌ Saat ini <code>/audio</code> hanya mendukung YouTube dan YouTube Music.'
      : '❌ Saat ini /audio hanya mendukung YouTube dan YouTube Music.';
  }
  if (errCode === 'DOWNLOAD_BUFFER_FAILED') {
    return '❌ Media ditemukan, tapi server sumber menolak koneksi (proxy/anti-hotlink). Coba ulang beberapa saat lagi.';
  }
  if (errCode === 'AUDIO_NOT_FOUND') {
    return '❌ Audio tidak ditemukan dari link tersebut.';
  }

  if (type === 'audio') {
    return '❌ Gagal mengunduh audio. Pastikan link valid dan akun tidak di-private!';
  }
  return '❌ Gagal mengunduh. Pastikan link valid dan akun tidak di-private!';
}

async function handleDownloadCommand(targetUrl, platform = 'whatsapp') {
  const url = String(targetUrl || '').trim();
  if (!url) {
    return {
      success: false,
      message: '❌ Masukkan link media! Contoh: /download https://www.instagram.com/reel/xxxx'
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
      message: formatErrorMessage(error, 'media', platform)
    };
  }
}

async function handleAudioCommand(targetUrl, platform = 'whatsapp') {
  const url = String(targetUrl || '').trim();
  if (!url) {
    return {
      success: false,
      message: '❌ Masukkan link media! Contoh: /audio https://www.youtube.com/watch?v=xxxx'
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
      message: formatErrorMessage(error, 'audio', platform)
    };
  }
}

module.exports = {
  handleDownloadCommand,
  handleAudioCommand
};
