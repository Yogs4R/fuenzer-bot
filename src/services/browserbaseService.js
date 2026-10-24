// Browserbase Cloud Agent Service
// Invariant: [AD-01] Transport agnostic, pure domain service for cloud browser automation

const axios = require('axios');
const { chromium } = require('playwright-core');
const { t } = require('../utils/i18n');

const BROWSERBASE_API_BASE = 'https://api.browserbase.com/v1';
const DEFAULT_TIMEOUT_MS = 30000;

/**
 * Normalizes and validates a URL string.
 * Auto-prepends https:// if protocol is omitted.
 *
 * @param {string} rawUrl - Input URL string
 * @returns {string|null} Normalized URL or null if invalid
 */
function normalizeUrl(rawUrl) {
  if (!rawUrl || typeof rawUrl !== 'string') return null;

  const trimmed = rawUrl.trim();
  if (!trimmed) return null;

  // Reject non-http/https explicit protocols (ftp:, javascript:, file:, etc.)
  if (/^[a-zA-Z][a-zA-Z0-9+.-]*:/i.test(trimmed) && !/^https?:\/\//i.test(trimmed)) {
    return null;
  }

  const urlToParse = /^https?:\/\//i.test(trimmed) ? trimmed : `https://${trimmed}`;

  try {
    const parsed = new URL(urlToParse);
    if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
      return null;
    }
    if (!parsed.hostname || (!parsed.hostname.includes('.') && parsed.hostname !== 'localhost')) {
      return null;
    }
    return parsed.toString();
  } catch (_) {
    return null;
  }
}

/**
 * Creates an ephemeral cloud browser session on Browserbase.
 *
 * @param {Object} [options]
 * @param {string} [options.projectId] - Optional Browserbase project ID override
 * @returns {Promise<{ id: string, connectUrl: string, status: string }>}
 */
async function createBrowserbaseSession({ projectId = null } = {}) {
  const apiKey = process.env.BROWSERBASE_API_KEY;
  if (!apiKey || apiKey === 'YOUR_BROWSERBASE_API_KEY') {
    throw new Error('BROWSERBASE_API_KEY is not configured in environment variables.');
  }

  const selectedProjectId = projectId || process.env.BROWSERBASE_PROJECT_ID;

  const payload = {};
  if (selectedProjectId && selectedProjectId !== 'YOUR_BROWSERBASE_PROJECT_ID') {
    payload.projectId = selectedProjectId;
  }

  payload.browserSettings = {
    blockAds: true,
    solveCaptchas: true
  };

  const response = await axios.post(`${BROWSERBASE_API_BASE}/sessions`, payload, {
    headers: {
      'x-bb-api-key': apiKey,
      'Content-Type': 'application/json'
    },
    timeout: 15000
  });

  return response.data;
}

/**
 * Retrieves the live debugger / inspector URLs for an active or completed session.
 *
 * @param {string} sessionId - Browserbase session ID
 * @returns {Promise<{ debuggerUrl?: string, debuggerFullscreenUrl?: string }>}
 */
async function getSessionDebugUrls(sessionId) {
  const apiKey = process.env.BROWSERBASE_API_KEY;
  if (!apiKey || apiKey === 'YOUR_BROWSERBASE_API_KEY' || !sessionId) {
    return {};
  }

  try {
    const response = await axios.get(`${BROWSERBASE_API_BASE}/sessions/${sessionId}/debug`, {
      headers: {
        'x-bb-api-key': apiKey
      },
      timeout: 10000
    });

    return {
      debuggerUrl: response.data?.debuggerUrl || '',
      debuggerFullscreenUrl: response.data?.debuggerFullscreenUrl || ''
    };
  } catch (err) {
    console.warn(`[browserbaseService] Could not fetch debug URLs for session ${sessionId}:`, err.message);
    return {};
  }
}

/**
 * Executes cloud browser automation to navigate to a target URL,
 * take a high-resolution screenshot, and extract readable text content.
 *
 * @param {Object} params
 * @param {string} params.url - Target URL to browse
 * @param {string} [params.lang] - User language ('en' | 'id')
 * @returns {Promise<{ success: boolean, url?: string, title?: string, excerpt?: string, screenshotBuffer?: Buffer, sessionId?: string, debuggerUrl?: string, error?: string }>}
 */
async function browseWebPage({ url, lang = 'en' }) {
  const apiKey = process.env.BROWSERBASE_API_KEY;
  if (!apiKey || apiKey === 'YOUR_BROWSERBASE_API_KEY') {
    return {
      success: false,
      reason: 'missing_api_key',
      error: t('browser.missing_api_key', {}, lang)
    };
  }

  const targetUrl = normalizeUrl(url);
  if (!targetUrl) {
    return {
      success: false,
      reason: 'invalid_url',
      error: t('browser.invalid_url', {}, lang)
    };
  }

  let session;
  let browser;

  try {
    // 1. Create Browserbase Cloud Session
    session = await createBrowserbaseSession();
    const sessionId = session.id;
    const connectUrl = session.connectUrl;

    if (!connectUrl) {
      throw new Error(`Browserbase session created (${sessionId}) but returned no connectUrl.`);
    }

    // 2. Connect over CDP via Playwright Core
    browser = await chromium.connectOverCDP(connectUrl, {
      timeout: DEFAULT_TIMEOUT_MS
    });

    const defaultContext = browser.contexts()[0] || await browser.newContext();
    const page = defaultContext.pages()[0] || await defaultContext.newPage();

    // 3. Navigate with timeout guard
    await page.goto(targetUrl, {
      waitUntil: 'domcontentloaded',
      timeout: 25000
    });

    // Extract Title & Text Excerpt
    const pageTitle = await page.title().catch(() => targetUrl);
    const pageExcerpt = await page.evaluate(() => {
      // Clean visible text from body
      const bodyText = document.body ? document.body.innerText : '';
      return bodyText
        .replace(/\s+/g, ' ')
        .trim()
        .slice(0, 450);
    }).catch(() => '');

    // 4. Capture high-quality screenshot
    const screenshotBuffer = await page.screenshot({
      type: 'jpeg',
      quality: 85,
      fullPage: false
    });

    // 5. Fetch debug inspector URLs
    const debugInfo = await getSessionDebugUrls(sessionId);

    return {
      success: true,
      url: targetUrl,
      title: pageTitle,
      excerpt: pageExcerpt,
      screenshotBuffer,
      sessionId,
      debuggerUrl: debugInfo.debuggerFullscreenUrl || debugInfo.debuggerUrl || ''
    };
  } catch (err) {
    console.error(`[browserbaseService] Error browsing ${targetUrl}:`, err.message);
    return {
      success: false,
      reason: 'browser_error',
      url: targetUrl,
      error: err.message
    };
  } finally {
    if (browser) {
      try {
        await browser.close();
      } catch (_) {}
    }
  }
}

module.exports = {
  BROWSERBASE_API_BASE,
  normalizeUrl,
  createBrowserbaseSession,
  getSessionDebugUrls,
  browseWebPage
};
