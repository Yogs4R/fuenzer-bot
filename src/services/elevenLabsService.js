const axios = require('axios');

const DEFAULT_ELEVENLABS_VOICE_ID = '21m00Tcm4TlvDq8ikWAM'; // Rachel - calm, warm, soothing voice
const DEFAULT_ELEVENLABS_MODEL_ID = 'eleven_multilingual_v2';
const ELEVENLABS_API_BASE = 'https://api.elevenlabs.io/v1';

/**
 * Normalizes text for clean, natural-sounding speech synthesis.
 * Strips markdown symbols, code blocks, URLs, and noisy emojis.
 *
 * @param {string} text - Raw input text
 * @returns {string} Cleaned text ready for TTS
 */
function cleanTextForSpeech(text) {
  if (typeof text !== 'string') return '';

  let cleaned = text
    // Remove code blocks and inline code
    .replace(/```[\s\S]*?```/g, ' ')
    .replace(/`([^`]+)`/g, '$1')
    // Remove URLs
    .replace(/https?:\/\/\S+/gi, ' ')
    // Remove blockquote arrows and markdown headers
    .replace(/^>+\s*/gm, '')
    .replace(/#{1,6}\s*/g, '')
    // Remove asterisks, underscores, and tildes
    .replace(/[*_~]/g, '')
    // Remove bullet points at line starts
    .replace(/^[\s-•*]+\s*/gm, '')
    // Strip common emojis to prevent pronunciation artifacts
    .replace(/[\u{1F600}-\u{1F64F}\u{1F300}-\u{1F5FF}\u{1F680}-\u{1F6FF}\u{1F1E0}-\u{1F1FF}\u{2600}-\u{26FF}\u{2700}-\u{27BF}\u{1F900}-\u{1F9FF}\u{1FA70}-\u{1FAFF}]/gu, '')
    // Collapse excess whitespace
    .replace(/\s+/g, ' ')
    .trim();

  return cleaned;
}

/**
 * Extracts the 2–3 sentence executive summary (Sloth TL;DR) from the 3-part structured briefing.
 *
 * @param {string} fullSummaryText - Full summary produced by Gemma
 * @returns {string} Extracted executive summary text
 */
function extractSlothTldr(fullSummaryText) {
  if (!fullSummaryText || typeof fullSummaryText !== 'string') return '';

  // 1. Target section 1: Sloth TL;DR or Ringkasan Santai up to section 2 (Action Items / Tindak Lanjut)
  const sectionMatch = fullSummaryText.match(
    /(?:1\.\s*)?[🦥*#\s]*(?:Sloth TL;DR|Ringkasan Santai)[^\n]*\n+([\s\S]*?)(?=(?:2\.\s*)?[🎯*#\s]*(?:Key Action Items|Poin Tindakan|Tindak Lanjut)|$)/i
  );

  if (sectionMatch && sectionMatch[1]?.trim()) {
    return cleanTextForSpeech(sectionMatch[1]);
  }

  // 2. Fallback: Take the first substantial paragraph
  const paragraphs = fullSummaryText
    .split(/\n\s*\n/)
    .map((p) => p.trim())
    .filter((p) => p.length > 20 && !p.startsWith('>') && !p.startsWith('#'));

  const candidate = paragraphs[0] || fullSummaryText.slice(0, 300);
  return cleanTextForSpeech(candidate);
}

/**
 * Synthesizes text into high-quality audio using ElevenLabs Text-to-Speech API.
 *
 * @param {Object} options
 * @param {string} options.text - Text to convert to speech
 * @param {string} [options.voiceId] - Custom ElevenLabs voice ID
 * @param {string} [options.modelId] - ElevenLabs model ID (defaults to eleven_multilingual_v2)
 * @returns {Promise<{ success: boolean, audioBuffer?: Buffer, mimeType?: string, voiceId?: string, modelId?: string, reason?: string, error?: string }>}
 */
async function synthesizeSpeech({ text, voiceId = null, modelId = null } = {}) {
  const apiKey = process.env.ELEVENLABS_API_KEY;

  if (!apiKey || apiKey === 'YOUR_ELEVENLABS_API_KEY') {
    return {
      success: false,
      reason: 'missing_api_key',
      error: 'ELEVENLABS_API_KEY is not configured in environment variables.'
    };
  }

  const cleanedText = cleanTextForSpeech(text);
  if (!cleanedText) {
    return {
      success: false,
      reason: 'empty_text',
      error: 'No valid speech text provided for synthesis.'
    };
  }

  const selectedVoiceId = voiceId || process.env.ELEVENLABS_VOICE_ID || DEFAULT_ELEVENLABS_VOICE_ID;
  const selectedModelId = modelId || process.env.ELEVENLABS_MODEL_ID || DEFAULT_ELEVENLABS_MODEL_ID;

  try {
    const url = `${ELEVENLABS_API_BASE}/text-to-speech/${selectedVoiceId}`;

    const response = await axios.post(
      url,
      {
        text: cleanedText,
        model_id: selectedModelId,
        voice_settings: {
          stability: 0.5,
          similarity_boost: 0.75,
          style: 0.0,
          use_speaker_boost: true
        }
      },
      {
        headers: {
          'xi-api-key': apiKey,
          'Content-Type': 'application/json',
          Accept: 'audio/mpeg'
        },
        responseType: 'arraybuffer',
        timeout: 25000
      }
    );

    const audioBuffer = Buffer.from(response.data);

    return {
      success: true,
      audioBuffer,
      mimeType: 'audio/mpeg',
      voiceId: selectedVoiceId,
      modelId: selectedModelId
    };
  } catch (err) {
    const errorDetails = err.response?.data
      ? Buffer.isBuffer(err.response.data)
        ? err.response.data.toString('utf8')
        : JSON.stringify(err.response.data)
      : err.message;

    console.warn(`[elevenLabsService] TTS synthesis failed (${selectedVoiceId}):`, errorDetails);

    return {
      success: false,
      reason: 'api_error',
      error: err.message,
      details: errorDetails
    };
  }
}

module.exports = {
  DEFAULT_ELEVENLABS_VOICE_ID,
  DEFAULT_ELEVENLABS_MODEL_ID,
  cleanTextForSpeech,
  extractSlothTldr,
  synthesizeSpeech
};
