const { downloadMediaMessage } = require('@whiskeysockets/baileys');
const { dispatchCommand, updateStatusAnswered } = require('../commands/index');
const { processAiChat, formatAiError } = require('../commands/ai/index');
const { buildMultimodalPayload } = require('../utils/aiMediaHelper');
const { logCommand } = require('../services/logService');
const { pdfMergeSessionManager } = require('../utils/sessionManager');
const {
  isWhatsAppPdfDocument,
  getMessageContextInfo,
  formatWhatsAppReply,
  handleWhatsAppImageConverter,
  handleWhatsAppSticker,
  handleWhatsAppRemoveBg,
  handleWhatsAppScreenshot,
  handleWhatsAppPdf,
  handleWhatsAppPdfMergeUpload,
  handleWhatsAppDownloader
} = require('./adapters/waMediaAdapter');
const { getUserLanguage } = require('../services/languageService');
const { t } = require('../utils/i18n');
const { enqueueMessage } = require('../services/chatBufferService');

function normalizeWhatsAppId(value) {
  return String(value || '')
    .split('@')[0]
    .split(':')[0]
    .replace(/[^\d]/g, '');
}

function toWhatsAppJid(value) {
  const raw = String(value || '').trim();
  if (!raw) return '';
  if (raw.includes('@g.us')) return raw;
  const normalized = normalizeWhatsAppId(raw);
  return normalized ? `${normalized}@s.whatsapp.net` : '';
}

function resolveWhatsAppSenderJid(msg, fallbackUserId = '') {
  const candidates = [
    msg?.key?.senderPn,
    msg?.key?.participant,
    fallbackUserId,
    msg?.key?.remoteJid
  ];

  for (const candidate of candidates) {
    const raw = String(candidate || '').trim();
    if (!raw || raw.endsWith('@g.us') || raw.includes('@lid')) {
      continue;
    }
    const jid = toWhatsAppJid(raw);
    if (jid) return jid;
  }
  return '';
}

function escapeRegex(value) {
  return String(value || '').replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function cleanMentionFromGroupText(text, mentionIds = []) {
  let cleanText = String(text || '').trim();
  const normalizedMentionIds = mentionIds
    .map((mentionId) => normalizeWhatsAppId(mentionId))
    .filter(Boolean);

  for (const mentionId of normalizedMentionIds) {
    const mentionRegex = new RegExp(`@${escapeRegex(mentionId)}\\b`, 'gi');
    cleanText = cleanText.replace(mentionRegex, ' ');
  }

  cleanText = cleanText.replace(/^(@\S+\s+)+(?=\/)/, '');
  return cleanText.replace(/\s{2,}/g, ' ').trim();
}

class WhatsAppHandler {
  constructor(sock) {
    this.sock = sock;
    this.setup();
  }

  setup() {
    this.sock.ev.on('messages.upsert', async (m) => {
      if (m.type !== 'notify') return;

      const msg = m.messages[0];
      if (!msg.message || msg.key.fromMe) return;

      const isGroup = msg.key.remoteJid.endsWith('@g.us');
      const userId = isGroup
        ? (msg.key.participant || msg.participant || msg.key.remoteJid)
        : msg.key.remoteJid;
      const botJid = this.sock.user?.id || '';
      const botNumber = normalizeWhatsAppId(botJid);
      let text = '';

      if (msg.message?.conversation) {
        text = msg.message.conversation;
      } else if (msg.message?.extendedTextMessage?.text) {
        text = msg.message.extendedTextMessage.text;
      } else if (msg.message?.imageMessage?.caption) {
        text = msg.message.imageMessage.caption;
      } else if (msg.message?.documentMessage?.caption) {
        text = msg.message.documentMessage.caption;
      } else if (msg.message?.videoMessage?.caption) {
        text = msg.message.videoMessage.caption;
      } else if (msg.message?.buttonsResponseMessage?.selectedButtonId) {
        text = msg.message.buttonsResponseMessage.selectedButtonId;
      } else if (msg.message?.templateButtonReplyMessage?.selectedId) {
        text = msg.message.templateButtonReplyMessage.selectedId;
      }

      const contextInfo = getMessageContextInfo(msg);
      const mentionedJids = contextInfo?.mentionedJid || [];
      const botLid = normalizeWhatsAppId(process.env.BOT_WA_LID);
      const incomingDocumentMsg = msg.message?.documentMessage;
      const hasPdfDocument = isWhatsAppPdfDocument(incomingDocumentMsg);
      const hasActiveMergeSession = pdfMergeSessionManager.hasSession(userId);
      const isBotMentioned = mentionedJids.some((jid) => {
        const normalizedJid = normalizeWhatsAppId(jid);
        return normalizedJid === botNumber || normalizedJid === botLid;
      });
      const isReplyToBot = normalizeWhatsAppId(contextInfo?.participant) === botNumber;

      if (isGroup && !isBotMentioned && !isReplyToBot && !(hasActiveMergeSession && hasPdfDocument)) {
        const trimmedText = String(text || '').trim();
        if (trimmedText && !trimmedText.startsWith('/')) {
          enqueueMessage({
            platform: 'whatsapp',
            chatId: msg.key.remoteJid,
            senderName: msg.pushName || '',
            messageText: trimmedText
          }).catch((err) => {
            console.warn(`[waHandler] Buffer enqueue error: ${err.message}`);
          });
        }
        return;
      }

      let cleanText = text.trim();
      if (isGroup && isBotMentioned) {
        cleanText = cleanMentionFromGroupText(cleanText, [botNumber, botLid, ...mentionedJids]);
      }

      if (isGroup && !cleanText && !(hasActiveMergeSession && hasPdfDocument)) {
        return;
      }

      let replyText = '';

      // PDF merge interactive session inbound receiver
      if (hasPdfDocument && hasActiveMergeSession) {
        await handleWhatsAppPdfMergeUpload(this.sock, msg, incomingDocumentMsg, userId);
        return;
      }

      if (cleanText.startsWith('/')) {
        const parts = cleanText.split(' ');
        const command = parts[0].toLowerCase();
        const args = parts.slice(1);

        const realId = resolveWhatsAppSenderJid(msg, userId);
        const lang = await getUserLanguage(realId || userId, 'whatsapp');

        if (command && realId) {
          await logCommand(realId, 'whatsapp', command);
        }

        const quotedMsg = msg.message?.extendedTextMessage?.contextInfo?.quotedMessage;
        const quotedText = quotedMsg ? (
          quotedMsg.conversation ||
          quotedMsg.extendedTextMessage?.text ||
          quotedMsg.imageMessage?.caption ||
          quotedMsg.videoMessage?.caption ||
          ''
        ) : '';

        const dispatched = await dispatchCommand(command, args, realId, 'whatsapp', {
          lang,
          quotedText,
          notifyAdmin: async (textToAdmin) => {
            await this.sock.sendMessage(
              msg.key.remoteJid,
              { text: formatWhatsAppReply(String(textToAdmin || '')) },
              { quoted: msg }
            );
          },
          sendToUser: async (targetId, textToSend) => {
            const targetJid = toWhatsAppJid(targetId);
            if (!targetJid) throw new Error('Invalid WhatsApp target');
            await this.sock.sendMessage(targetJid, { text: String(textToSend || '') });
          }
        });

        if (dispatched !== null) {
          if (command === '/answer' && args[0]) {
            await updateStatusAnswered(args[0]);
          }

          if (typeof dispatched === 'object' && dispatched?.type === 'image') {
            await this.sock.sendMessage(
              msg.key.remoteJid,
              {
                image: { url: dispatched.url },
                caption: formatWhatsAppReply(dispatched.caption || '')
              },
              { quoted: msg }
            );
            return;
          }

          replyText = typeof dispatched === 'string' ? dispatched : (dispatched.message || '');
        } else {
          switch (command) {
            case '/img':
              replyText = await handleWhatsAppImageConverter(this.sock, msg, args);
              break;

            case '/sticker':
            case '/tosticker':
              replyText = await handleWhatsAppSticker(this.sock, msg, contextInfo);
              break;

            case '/removebg':
            case '/hapusbg':
              replyText = await handleWhatsAppRemoveBg(this.sock, msg);
              break;

            case '/screenshot':
            case '/ss':
              replyText = await handleWhatsAppScreenshot(this.sock, msg, args);
              break;

            case '/topdf':
            case '/pdf':
              replyText = await handleWhatsAppPdf(this.sock, msg, command, args, userId);
              break;

            case '/download':
            case '/audio':
              replyText = await handleWhatsAppDownloader(this.sock, msg, command, args);
              break;

            default: {
              const defaultHeader = t('common.unknown_command_header', {}, lang);
              const defaultBody = t('common.unknown_command_body', { command }, lang);
              replyText = `${defaultHeader}\n\n${defaultBody}`;
            }
          }
        }
      } else {
        const isImage = !!msg.message?.imageMessage;
        const isDoc = !!msg.message?.documentMessage;
        const hasMedia = isImage || isDoc;

        const realId = resolveWhatsAppSenderJid(msg, userId);
        const lang = await getUserLanguage(realId || userId, 'whatsapp');

        if (cleanText.length <= 2 && !hasMedia) {
          const shortHeader = t('common.too_short_header', {}, lang);
          const shortBody = t('common.too_short_body', {}, lang);
          replyText = `${shortHeader}\n\n${shortBody}`;
        } else {
          try {
            const realId = resolveWhatsAppSenderJid(msg, userId);
            let aiPayload = cleanText;

            if (hasMedia) {
              const fileLength = msg.message?.imageMessage?.fileLength || 
                                 msg.message?.documentMessage?.fileLength;
              const fileSizeBytes = Number(fileLength) || 0;
              const buffer = await downloadMediaMessage(msg, 'buffer', {}, { reuploadRequest: this.sock.updateMediaMessage });
              const docMsg = msg.message?.documentMessage;
              aiPayload = buildMultimodalPayload({
                isImage,
                isDoc,
                fileSizeBytes,
                buffer,
                mimeType: isImage ? (msg.message.imageMessage?.mimetype || 'image/jpeg') : (docMsg?.mimetype || ''),
                fileName: docMsg?.fileName || '',
                cleanText
              });
            }

            const chatResult = await processAiChat(aiPayload, userId, 'whatsapp', { realId });
            replyText = chatResult.fullText;
          } catch (error) {
            console.error('Error saat memproses AI di WhatsApp:', error);
            replyText = formatAiError(error, 'whatsapp');
          }
        }
      }

      if (replyText) {
        await this.sock.sendMessage(msg.key.remoteJid, {
          text: formatWhatsAppReply(replyText)
        });
      }
    });
  }
}

module.exports = WhatsAppHandler;
