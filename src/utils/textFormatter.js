function escapeHtml(text) {
  return String(text || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function autoLink(text) {
  return String(text || '').replace(/(https?:\/\/[^\s<]+)/g, '<a href="$1">$1</a>');
}

function escapeRegex(value) {
  return String(value || '').replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function stripWrappingQuotes(value) {
  const text = String(value || '').trim();
  if (!text) return '';

  const hasDoubleQuotes = text.startsWith('"') && text.endsWith('"');
  const hasSingleQuotes = text.startsWith("'") && text.endsWith("'");

  if (hasDoubleQuotes || hasSingleQuotes) {
    return text.slice(1, -1).trim();
  }
  return text;
}

function appendFooter(text, footer) {
  const base = String(text || '').trim();
  const foot = String(footer || '').trim();
  if (!base) return foot;
  if (!foot) return base;
  return `${base}\n\n${foot}`;
}

function formatTelegramHtml(rawText) {
  let text = String(rawText || '').replace(/\r\n/g, '\n').trim();

  const preservedTags = [];
  const preserveTag = (tag) => {
    preservedTags.push(tag);
    return `__HTML_TAG_${preservedTags.length - 1}__`;
  };

  text = text
    .replace(/<b>/gi, (tag) => preserveTag(tag))
    .replace(/<\/b>/gi, (tag) => preserveTag(tag))
    .replace(/<code>/gi, (tag) => preserveTag(tag))
    .replace(/<\/code>/gi, (tag) => preserveTag(tag));

  text = escapeHtml(text);

  text = text.replace(/^&gt;\s*\*([^*]+)\*\s*(.*)$/gm, (_match, title, suffix) => {
    const cleanTitle = title.trim();
    const cleanSuffix = (suffix || '').trim();
    return cleanSuffix ? `<b>${cleanTitle}</b> ${cleanSuffix}` : `<b>${cleanTitle}</b>`;
  });

  text = text.replace(/```([\s\S]*?)```/g, (_match, codeBlock) => codeBlock.trim());
  text = text.replace(/`([^`\n]+)`/g, '$1');
  text = text.replace(/\*([^*\n]+)\*/g, '<b>$1</b>');
  text = text.replace(/(^|\n)-\s+/g, '$1');
  text = autoLink(text);

  text = text.replace(/__HTML_TAG_(\d+)__/g, (_match, indexText) => {
    const index = parseInt(indexText, 10);
    return preservedTags[index] || '';
  });

  return text;
}

function formatBodyBold(htmlText) {
  const lines = String(htmlText || '').split('\n');
  const firstContentLineIndex = lines.findIndex((line) => line.trim().length > 0);

  if (firstContentLineIndex === -1) return '';

  const isBoxLine = (line) => /^[┌├└]\s/.test(line.trim());
  const alreadyBold = (line) => {
    const trimmed = line.trim();
    return trimmed.startsWith('<b>') && trimmed.endsWith('</b>');
  };
  const makeBold = (line) => (alreadyBold(line) ? line : `<b>${line}</b>`);

  const bodyBoxIndexes = [];
  for (let i = firstContentLineIndex + 1; i < lines.length; i += 1) {
    if (isBoxLine(lines[i])) {
      bodyBoxIndexes.push(i);
    }
  }

  const hasBodyBox = bodyBoxIndexes.length > 0;
  const lastBodyBoxIndex = hasBodyBox ? bodyBoxIndexes[bodyBoxIndexes.length - 1] : -1;

  const firstFooterLineIndex = hasBodyBox
    ? lines.findIndex((line, index) => index > lastBodyBoxIndex && line.trim().length > 0)
    : -1;

  const formatted = [];
  for (let i = 0; i < lines.length; i += 1) {
    const line = lines[i];
    const trimmed = line.trim();

    if (!trimmed) {
      formatted.push(line);
      continue;
    }

    if (i === firstContentLineIndex || isBoxLine(line)) {
      formatted.push(makeBold(line));
      continue;
    }

    if (i === firstFooterLineIndex && hasBodyBox) {
      if (formatted.length > 0 && String(formatted[formatted.length - 1]).trim().length > 0) {
        formatted.push('');
      }
      formatted.push('—'.repeat(19));
    }

    formatted.push(line);
  }

  return formatted.join('\n');
}

module.exports = {
  escapeHtml,
  autoLink,
  escapeRegex,
  stripWrappingQuotes,
  appendFooter,
  formatTelegramHtml,
  formatBodyBold
};
