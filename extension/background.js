/**
 * RefundGuardian AI — Service worker (Manifest V3)
 * Backend sync + local persistence for Amazon orders.
 *
 * Use ASCII only in this file — do not paste chat/translated text into the code (breaks parsing).
 */

const API_BASE_DEFAULT = 'http://localhost:3000';
const RG_API_BASE_STORAGE_KEY = 'rgApiBase';

/**
 * Low-level: read keys from chrome.storage.local as Promise.
 */
function chromeStorageLocalGet(keys) {
  return new Promise((resolve, reject) => {
    try {
      chrome.storage.local.get(keys, (result) => {
        const lastError = chrome.runtime.lastError;
        if (lastError) {
          reject(new Error(lastError.message));
          return;
        }
        resolve(result);
      });
    } catch (e) {
      reject(e instanceof Error ? e : new Error(String(e)));
    }
  });
}

/**
 * Low-level: write to chrome.storage.local as Promise.
 */
function chromeStorageLocalSet(items) {
  return new Promise((resolve, reject) => {
    try {
      chrome.storage.local.set(items, () => {
        const lastError = chrome.runtime.lastError;
        if (lastError) {
          reject(new Error(lastError.message));
          return;
        }
        resolve();
      });
    } catch (e) {
      reject(e instanceof Error ? e : new Error(String(e)));
    }
  });
}

async function resolveApiBase() {
  try {
    if (typeof chrome === 'undefined' || !chrome.storage || !chrome.storage.local) {
      return API_BASE_DEFAULT;
    }
    const r = await chromeStorageLocalGet([RG_API_BASE_STORAGE_KEY]);
    const b = r[RG_API_BASE_STORAGE_KEY];
    if (typeof b === 'string' && b.trim().length > 0) {
      return b.trim().replace(/\/$/, '');
    }
  } catch (_) {}
  return API_BASE_DEFAULT;
}
const AMAZON_ORDERS_STORAGE_KEY = 'amazonOrders';
const UBER_EATS_ORDERS_STORAGE_KEY = 'uberEatsOrders';
const UBER_EATS_SENT_ORDER_IDS_KEY = 'uberEatsSentOrderIds';
const UBER_RIDES_ORDERS_STORAGE_KEY = 'uberRidesOrders';
const UBER_RIDES_SENT_ORDER_IDS_KEY = 'uberRidesSentOrderIds';
const MAX_LOCAL_ORDER_ENTRIES = 100;
const MIN_BACKEND_INTERVAL_MS = 1800;

/** `true` in dev if you need console noise for POST /api/orders (default: off). */
const RG_VERBOSE_ORDERS_API = false;

/**
 * `true` to print `logError(...)` to the console (default: off — avoids noisy red errors in MV3).
 * Set to true locally when debugging the service worker.
 */
const RG_VERBOSE_ERRORS = false;

/** `true` to print startup / onInstalled lines (default: off). */
const RG_VERBOSE_LIFECYCLE = false;

function rgLogLifecycle(...args) {
  if (RG_VERBOSE_LIFECYCLE) console.log(...args);
}

let lastBackendPostAt = 0;

function logError(message, err) {
  if (!RG_VERBOSE_ERRORS) return;
  if (err !== undefined && err !== null) {
    console.error('[RefundGuardian] ERROR:', message, err);
  } else {
    console.error('[RefundGuardian] ERROR:', message);
  }
}

/**
 * Order-list / trip surfaces for all four US merchants (must match dashboard seed URLs).
 * Service worker opens these in inactive tabs on a schedule after accessToken is saved so content
 * scripts can run without the user manually visiting each site every time.
 * Deep per-order detail extraction still depends on what each content-script path implements when
 * those pages load (DOM-based; not a silent cross-origin API without a tab).
 */
const MERCHANT_BACKGROUND_URLS = [
  'https://www.amazon.com/gp/css/order-history',
  'https://www.ubereats.com/orders',
  'https://www.uber.com/global/en/trips',
  'https://www.doordash.com/orders',
];

const RG_ALARM_MERCHANT_PERIODIC = 'rg_merchant_background_periodic';
/** Alarm tick (minutes). Actual scan cadence is gated inside runBackgroundMerchantScan. */
const RG_PERIODIC_ALARM_MIN = 30;

/** First 24h after activation: allow scans every 30m. */
const RG_FIRST_ACTIVATION_WINDOW_MS = 24 * 60 * 60 * 1000;
/** Visits to merchant order surfaces within this window count as "active" (2h cadence). */
const RG_ACTIVE_USER_ENGAGEMENT_MS = 7 * 24 * 60 * 60 * 1000;

/**
 * Min time between full four-merchant background tab opens, based on activation age and engagement.
 * - First 24h after firstTokenSavedAt: 30m
 * - Active (recent PAGE_VISIT): 2h
 * - Otherwise: 6h
 */
async function getMinBackgroundScanIntervalMs() {
  const stored = await chromeStorageLocalGet(['firstTokenSavedAt', 'lastMerchantEngagementAt']);
  const first = typeof stored.firstTokenSavedAt === 'number' ? stored.firstTokenSavedAt : null;
  const now = Date.now();
  if (first != null && now - first < RG_FIRST_ACTIVATION_WINDOW_MS) {
    return 30 * 60 * 1000;
  }
  const eng = typeof stored.lastMerchantEngagementAt === 'number' ? stored.lastMerchantEngagementAt : 0;
  const isActive = eng > 0 && now - eng < RG_ACTIVE_USER_ENGAGEMENT_MS;
  if (isActive) {
    return 2 * 60 * 60 * 1000;
  }
  return 6 * 60 * 60 * 1000;
}

/** Only https seed targets we open from the dashboard (defense in depth). */
function isAllowedMerchantSeedUrl(url) {
  try {
    const u = new URL(url);
    if (u.protocol !== 'https:') return false;
    const h = u.hostname.toLowerCase().replace(/^www\./, '');
    if (h === 'amazon.com' || h.endsWith('.amazon.com')) return true;
    if (h === 'ubereats.com' || h.endsWith('.ubereats.com')) return true;
    if (h === 'uber.com' || h.endsWith('.uber.com')) return true;
    if (h === 'doordash.com' || h.endsWith('.doordash.com')) return true;
    return false;
  } catch (_) {
    return false;
  }
}

function registerMerchantBackgroundScanAlarms() {
  try {
    chrome.storage.local.get(['lastAlarmRegisterAt'], function (r) {
      if (chrome.runtime.lastError) return;
      var now = Date.now();
      var last = r && typeof r.lastAlarmRegisterAt === 'number' ? r.lastAlarmRegisterAt : 0;
      if (now - last < 5 * 60 * 1000) {
        rgLogLifecycle('[RefundGuardian] Alarms register debounced (5m)');
        return;
      }
      chrome.storage.local.set({ lastAlarmRegisterAt: now }, function () {
        if (chrome.runtime.lastError) return;
        try {
          try {
            chrome.alarms.clear('rg_merchant_background_kickoff');
          } catch (_) {}
          chrome.alarms.clear(RG_ALARM_MERCHANT_PERIODIC);
          chrome.alarms.create(RG_ALARM_MERCHANT_PERIODIC, {
            delayInMinutes: RG_PERIODIC_ALARM_MIN,
            periodInMinutes: RG_PERIODIC_ALARM_MIN,
          });
          rgLogLifecycle('[RefundGuardian] Background merchant scan alarms registered');
        } catch (e) {
          logError('registerMerchantBackgroundScanAlarms inner', e);
        }
      });
    });
  } catch (e) {
    logError('registerMerchantBackgroundScanAlarms', e);
  }
}

async function runBackgroundMerchantScan(reason) {
  try {
    const stored = await chromeStorageLocalGet([
      'accessToken',
      'lastBackgroundScanAt',
      'firstTokenSavedAt',
    ]);
    const token = typeof stored.accessToken === 'string' ? stored.accessToken : '';
    if (!token.length) {
      rgLogLifecycle('[RefundGuardian] Background scan skipped:', reason, 'no token');
      return;
    }
    if (typeof stored.firstTokenSavedAt !== 'number') {
      await chromeStorageLocalSet({ firstTokenSavedAt: Date.now() });
    }
    const minMs = await getMinBackgroundScanIntervalMs();
    /** Absolute minimum gap between full scans (25m) — never below this even if alarms fire early. */
    const gateMs = Math.max(minMs, 25 * 60 * 1000);
    const last = stored.lastBackgroundScanAt;
    if (typeof last === 'number' && Date.now() - last < gateMs) {
      rgLogLifecycle('[RefundGuardian] Background scan skipped:', reason, 'too soon after last scan');
      return;
    }
    let opened = 0;
    for (let i = 0; i < MERCHANT_BACKGROUND_URLS.length; i++) {
      const url = MERCHANT_BACKGROUND_URLS[i];
      if (!isAllowedMerchantSeedUrl(url)) continue;
      await new Promise(function (resolve) {
        try {
          chrome.tabs.create({ url: url, active: false }, function () {
            resolve();
          });
        } catch (_) {
          resolve();
        }
      });
      opened++;
    }
    await chromeStorageLocalSet({ lastBackgroundScanAt: Date.now() });
    console.log('[RefundGuardian] Background merchant scan:', reason, 'inactive tabs:', opened);
  } catch (e) {
    logError('runBackgroundMerchantScan', e);
  }
}

/** Detect Chrome extension storage quota errors */
function isQuotaError(err) {
  try {
    const msg =
      err instanceof Error
        ? err.message
        : typeof err === 'string'
          ? err
          : String(err || '');
    const m = msg.toLowerCase();
    return m.includes('quota') || m.includes('quota_bytes') || (m.includes('exceeded') && m.includes('storage'));
  } catch (_) {
    return false;
  }
}

/**
 * @returns {Promise<Array>} Current amazonOrders array (never throws; [] on failure)
 */
async function getAmazonOrders() {
  try {
    const result = await chromeStorageLocalGet([AMAZON_ORDERS_STORAGE_KEY]);
    const raw = result[AMAZON_ORDERS_STORAGE_KEY];
    return Array.isArray(raw) ? raw : [];
  } catch (e) {
    logError('getAmazonOrders', e);
    return [];
  }
}

/**
 * Strip heavy fields to reduce serialized size when approaching quota.
 */
function slimAmazonOrderEntry(entry) {
  try {
    const copy = {
      id: entry.id,
      orders: Array.isArray(entry.orders)
        ? entry.orders.map(function (o) {
            return {
              orderId: o.orderId,
              productTitle: o.productTitle,
              price: o.price,
              date: o.date,
              status: o.status,
            };
          })
        : [],
      url: entry.url,
      extractedAt: entry.extractedAt,
      batchHash: entry.batchHash,
      receivedAt: entry.receivedAt,
      backendStatus: entry.backendStatus,
      error: entry.error,
    };
    return copy;
  } catch (_) {
    return entry;
  }
}

/**
 * Replace stored amazonOrders. Retries once with slimmer entries on quota errors.
 * @returns {Promise<{ ok: boolean, quotaExceeded?: boolean }>}
 */
async function setAmazonOrders(arr) {
  if (!Array.isArray(arr)) {
    return { ok: false, quotaExceeded: false };
  }
  const capped = arr.slice(0, MAX_LOCAL_ORDER_ENTRIES);
  try {
    await chromeStorageLocalSet({ [AMAZON_ORDERS_STORAGE_KEY]: capped });
    return { ok: true };
  } catch (e) {
    if (!isQuotaError(e)) {
      logError('setAmazonOrders', e);
      return { ok: false, quotaExceeded: false };
    }
    console.warn('[RefundGuardian] Storage: quota hit — retrying with slimmed entries');
    try {
      const slim = capped.map(slimAmazonOrderEntry);
      await chromeStorageLocalSet({
        [AMAZON_ORDERS_STORAGE_KEY]: slim.slice(0, Math.max(1, Math.floor(MAX_LOCAL_ORDER_ENTRIES / 2))),
      });
      return { ok: true };
    } catch (e2) {
      if (isQuotaError(e2)) {
        console.warn('[RefundGuardian] Storage: quota still exceeded — minimal write');
        try {
          const minimal = slimAmazonOrderEntry(capped[0] || {});
          await chromeStorageLocalSet({ [AMAZON_ORDERS_STORAGE_KEY]: [minimal] });
          return { ok: true };
        } catch (e3) {
          logError('setAmazonOrders quota fatal', e3);
          return { ok: false, quotaExceeded: true };
        }
      }
      logError('setAmazonOrders retry', e2);
      return { ok: false, quotaExceeded: isQuotaError(e2) };
    }
  }
}

/**
 * Prepend one snapshot; dedupe by batchHash vs latest entry.
 * @returns {Promise<{ ok: boolean, skipped?: boolean, count?: number, quotaExceeded?: boolean }>}
 */
async function getUberEatsOrders() {
  try {
    const result = await chromeStorageLocalGet([UBER_EATS_ORDERS_STORAGE_KEY]);
    const raw = result[UBER_EATS_ORDERS_STORAGE_KEY];
    return Array.isArray(raw) ? raw : [];
  } catch (e) {
    logError('getUberEatsOrders', e);
    return [];
  }
}

async function appendUberEatsOrders(entry) {
  try {
    const arr = await getUberEatsOrders();
    const next = [entry, ...arr].slice(0, MAX_LOCAL_ORDER_ENTRIES);
    await chromeStorageLocalSet({ [UBER_EATS_ORDERS_STORAGE_KEY]: next });
    return { ok: true, count: next.length };
  } catch (e) {
    logError('appendUberEatsOrders', e);
    return { ok: false };
  }
}

async function getUberRidesOrders() {
  try {
    const result = await chromeStorageLocalGet([UBER_RIDES_ORDERS_STORAGE_KEY]);
    const raw = result[UBER_RIDES_ORDERS_STORAGE_KEY];
    return Array.isArray(raw) ? raw : [];
  } catch (e) {
    logError('getUberRidesOrders', e);
    return [];
  }
}

async function appendUberRidesOrders(entry) {
  try {
    const arr = await getUberRidesOrders();
    const next = [entry, ...arr].slice(0, MAX_LOCAL_ORDER_ENTRIES);
    await chromeStorageLocalSet({ [UBER_RIDES_ORDERS_STORAGE_KEY]: next });
    return { ok: true, count: next.length };
  } catch (e) {
    logError('appendUberRidesOrders', e);
    return { ok: false };
  }
}

async function appendAmazonOrders(entry) {
  try {
    const arr = await getAmazonOrders();
    if (arr.length > 0) {
      const last = arr[0];
      if (last && last.batchHash && entry.batchHash && last.batchHash === entry.batchHash) {
        console.log('[RefundGuardian] Storage: duplicate batch skipped, hash=' + entry.batchHash);
        return { ok: true, skipped: true };
      }
    }
    const next = [entry, ...arr].slice(0, MAX_LOCAL_ORDER_ENTRIES);
    const result = await setAmazonOrders(next);
    if (!result.ok) {
      if (result.quotaExceeded) {
        console.warn('[RefundGuardian] Storage: append failed — quota exceeded');
      }
      return { ok: false, quotaExceeded: !!result.quotaExceeded };
    }
    console.log(
      '[RefundGuardian] Storage: appended local snapshot, total entries=' + next.length,
      'backendStatus=' + entry.backendStatus
    );
    return { ok: true, skipped: false, count: next.length };
  } catch (e) {
    logError('appendAmazonOrders', e);
    return { ok: false, quotaExceeded: isQuotaError(e) };
  }
}

function simpleHash(str) {
  try {
    let h = 0;
    const s = String(str);
    for (let i = 0; i < s.length; i++) {
      h = (Math.imul(31, h) + s.charCodeAt(i)) | 0;
    }
    return String(h);
  } catch (_) {
    return String(Date.now());
  }
}

function makeEntryId() {
  try {
    if (typeof crypto !== 'undefined' && crypto.randomUUID) {
      return crypto.randomUUID();
    }
  } catch (_) {}
  return Date.now() + '-' + Math.random().toString(36).slice(2, 12);
}

async function waitForRateLimit() {
  if (typeof lastBackendPostAt !== 'number') return;
  const now = Date.now();
  const wait = Math.max(0, MIN_BACKEND_INTERVAL_MS - (now - lastBackendPostAt));
  if (wait > 0) {
    console.log('[RefundGuardian] Rate limit: waiting ' + wait + 'ms before backend POST');
    await new Promise((r) => setTimeout(r, wait));
  }
}

/**
 * POST batch to /api/orders with Bearer token (3 attempts, exponential backoff).
 */
async function postOrdersToBackend(payload, token) {
  const base = await resolveApiBase();
  const headers = {
    'Content-Type': 'application/json',
    Authorization: 'Bearer ' + token,
  };
  let lastErr = new Error('POST /api/orders failed');
  for (let attempt = 0; attempt < 3; attempt++) {
    if (attempt > 0) {
      const delay = 400 * Math.pow(2, attempt - 1);
      if (RG_VERBOSE_ORDERS_API) {
        console.log('[RefundGuardian] Retrying POST /api/orders in ' + delay + 'ms (attempt ' + (attempt + 1) + '/3)');
      }
      await new Promise((r) => setTimeout(r, delay));
    }
    try {
      const res = await fetch(base + '/api/orders', {
        method: 'POST',
        headers,
        body: JSON.stringify(payload),
      });
      const text = await res.text();
      let json = null;
      try {
        json = text ? JSON.parse(text) : null;
      } catch (_) {
        json = { raw: text };
      }
      if (!res.ok) {
        const msg = (json && json.error) || text || 'HTTP ' + res.status;
        lastErr = new Error(msg);
        continue;
      }
      return json;
    } catch (e) {
      lastErr = e instanceof Error ? e : new Error(String(e));
    }
  }
  throw lastErr;
}

/**
 * Optional analytics / sync hook after successful order ingest. Failures are ignored.
 */
async function postSyncExtensionSilently(token, body) {
  try {
    const base = await resolveApiBase();
    await fetch(base + '/api/sync-extension', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: 'Bearer ' + token,
      },
      body: JSON.stringify(body),
    });
  } catch (_) {
    /* silent */
  }
}

async function handleUberEatsOrdersDetected(message, sendResponse) {
  const orders = Array.isArray(message.data) ? message.data : [];
  const url = typeof message.url === 'string' ? message.url : '';
  const extractedAt = typeof message.extractedAt === 'string' ? message.extractedAt : '';

  console.log(
    '[RefundGuardian] Received UBER_EATS_ORDERS_DETECTED',
    'count=' + orders.length,
    'url=' + url,
    'at=' + extractedAt
  );

  if (orders.length === 0) {
    sendResponse({ ok: true, received: 0, skipped: true });
    return;
  }

  let token = '';
  try {
    const stored = await chromeStorageLocalGet(['accessToken']);
    token = typeof stored.accessToken === 'string' ? stored.accessToken : '';
  } catch (e) {
    logError('reading accessToken (uber eats)', e);
  }

  let sentIds = [];
  try {
    const s = await chromeStorageLocalGet([UBER_EATS_SENT_ORDER_IDS_KEY]);
    sentIds = Array.isArray(s[UBER_EATS_SENT_ORDER_IDS_KEY]) ? s[UBER_EATS_SENT_ORDER_IDS_KEY] : [];
  } catch (_) {}

  const sentSet = new Set(sentIds.map(String));
  const newOrders = orders.filter(function (o) {
    var id = o && o.orderId ? String(o.orderId) : '';
    return id && !sentSet.has(id);
  });

  if (newOrders.length === 0) {
    console.log('[RefundGuardian] Uber Eats: duplicate order_id(s) skipped (already sent)');
    sendResponse({ ok: true, received: 0, skipped: true, reason: 'deduped_order_id' });
    return;
  }

  const baseEntry = {
    id: makeEntryId(),
    orders: newOrders,
    url: url,
    extractedAt: extractedAt,
    receivedAt: new Date().toISOString(),
    backendStatus: 'pending',
  };

  if (!token) {
    console.warn('[RefundGuardian] Uber Eats: No access token — backend skipped, local snapshot only');
    console.log('[RefundGuardian] Backend status: skipped_no_token (uber eats)');
    baseEntry.backendStatus = 'failed';
    baseEntry.error = 'Missing access token (save token in extension popup)';
    try {
      await appendUberEatsOrders(baseEntry);
    } catch (e) {
      logError('appendUberEatsOrders no-token', e);
    }
    sendResponse({ ok: true, received: newOrders.length, backend: 'skipped_no_token', local: true });
    return;
  }

  const results = [];
  for (let i = 0; i < newOrders.length; i++) {
    const o = newOrders[i];
    try {
      await waitForRateLimit();
      const payload = {
        provider: 'uber_eats',
        order_id: String(o.orderId),
        merchant_name: typeof o.merchantName === 'string' ? o.merchantName : null,
        order_value_cents: typeof o.orderValueCents === 'number' && Number.isFinite(o.orderValueCents) ? o.orderValueCents : null,
        order_creation_time:
          typeof o.createdAt === 'string' ? o.createdAt : new Date().toISOString(),
        raw: {
          source: 'uber_eats_extension',
          page_url: url,
          batch_extracted_at: extractedAt,
          extracted: o,
        },
      };
      const result = await postOrdersToBackend(payload, token);
      console.log('[RefundGuardian] Uber Eats backend status: success', 'order_id=' + o.orderId, JSON.stringify(result).slice(0, 800));
      sentSet.add(String(o.orderId));
      results.push({ orderId: o.orderId, ok: true });
    } catch (apiErr) {
      console.log('[RefundGuardian] Uber Eats backend status: fail', 'order_id=' + (o && o.orderId), apiErr && apiErr.message ? apiErr.message : apiErr);
      logError('Uber Eats POST failed', apiErr);
      results.push({
        orderId: o.orderId,
        ok: false,
        error: apiErr instanceof Error ? apiErr.message : String(apiErr),
      });
    } finally {
      lastBackendPostAt = Date.now();
    }
  }

  try {
    await chromeStorageLocalSet({
      [UBER_EATS_SENT_ORDER_IDS_KEY]: Array.from(sentSet).slice(0, 800),
    });
  } catch (e) {
    logError('persist uberEatsSentOrderIds', e);
  }

  baseEntry.backendStatus = results.some(function (r) {
    return r && r.ok;
  })
    ? 'ok'
    : 'failed';
  baseEntry.backendResults = results;
  try {
    await appendUberEatsOrders(baseEntry);
    console.log('[RefundGuardian] Uber Eats local storage updated');
  } catch (e) {
    logError('appendUberEatsOrders after batch', e);
  }

  sendResponse({
    ok: true,
    received: newOrders.length,
    backend: baseEntry.backendStatus,
    local: true,
    results: results,
  });
}

async function handleUberRidesOrdersDetected(message, sendResponse) {
  const orders = Array.isArray(message.data) ? message.data : [];
  const url = typeof message.url === 'string' ? message.url : '';
  const extractedAt = typeof message.extractedAt === 'string' ? message.extractedAt : '';

  console.log(
    '[RefundGuardian] Received UBER_RIDES_ORDERS_DETECTED',
    'count=' + orders.length,
    'url=' + url,
    'at=' + extractedAt
  );

  if (orders.length === 0) {
    sendResponse({ ok: true, received: 0, skipped: true });
    return;
  }

  let token = '';
  try {
    const stored = await chromeStorageLocalGet(['accessToken']);
    token = typeof stored.accessToken === 'string' ? stored.accessToken : '';
  } catch (e) {
    logError('reading accessToken (uber rides)', e);
  }

  let sentIds = [];
  try {
    const s = await chromeStorageLocalGet([UBER_RIDES_SENT_ORDER_IDS_KEY]);
    sentIds = Array.isArray(s[UBER_RIDES_SENT_ORDER_IDS_KEY]) ? s[UBER_RIDES_SENT_ORDER_IDS_KEY] : [];
  } catch (_) {}

  const sentSet = new Set(sentIds.map(String));
  const newOrders = orders.filter(function (o) {
    var id = o && o.orderId ? String(o.orderId) : '';
    return id && !sentSet.has(id);
  });

  if (newOrders.length === 0) {
    console.log('[RefundGuardian] Uber Rides: duplicate order_id(s) skipped (already sent)');
    sendResponse({ ok: true, received: 0, skipped: true, reason: 'deduped_order_id' });
    return;
  }

  const baseEntry = {
    id: makeEntryId(),
    orders: newOrders,
    url: url,
    extractedAt: extractedAt,
    receivedAt: new Date().toISOString(),
    backendStatus: 'pending',
  };

  if (!token) {
    console.warn('[RefundGuardian] Uber Rides: No access token — backend skipped, local snapshot only');
    console.log('[RefundGuardian] Backend status: skipped_no_token (uber rides)');
    baseEntry.backendStatus = 'failed';
    baseEntry.error = 'Missing access token (save token in extension popup)';
    try {
      await appendUberRidesOrders(baseEntry);
    } catch (e) {
      logError('appendUberRidesOrders no-token', e);
    }
    sendResponse({ ok: true, received: newOrders.length, backend: 'skipped_no_token', local: true });
    return;
  }

  const results = [];
  for (let i = 0; i < newOrders.length; i++) {
    const o = newOrders[i];
    try {
      await waitForRateLimit();
      const payload = {
        provider: 'uber',
        order_id: String(o.orderId),
        merchant_name: typeof o.merchantName === 'string' ? o.merchantName : null,
        order_value_cents: typeof o.orderValueCents === 'number' && Number.isFinite(o.orderValueCents) ? o.orderValueCents : null,
        order_creation_time:
          typeof o.createdAt === 'string' ? o.createdAt : new Date().toISOString(),
        raw: {
          source: 'uber_rides_extension',
          page_url: url,
          batch_extracted_at: extractedAt,
          extracted: o,
        },
      };
      const result = await postOrdersToBackend(payload, token);
      console.log(
        '[RefundGuardian] Uber Rides backend status: success',
        'order_id=' + o.orderId,
        JSON.stringify(result).slice(0, 800)
      );
      sentSet.add(String(o.orderId));
      results.push({ orderId: o.orderId, ok: true });
    } catch (apiErr) {
      console.log(
        '[RefundGuardian] Uber Rides backend status: fail',
        'order_id=' + (o && o.orderId),
        apiErr && apiErr.message ? apiErr.message : apiErr
      );
      logError('Uber Rides POST failed', apiErr);
      results.push({
        orderId: o.orderId,
        ok: false,
        error: apiErr instanceof Error ? apiErr.message : String(apiErr),
      });
    } finally {
      lastBackendPostAt = Date.now();
    }
  }

  try {
    await chromeStorageLocalSet({
      [UBER_RIDES_SENT_ORDER_IDS_KEY]: Array.from(sentSet).slice(0, 800),
    });
  } catch (e) {
    logError('persist uberRidesSentOrderIds', e);
  }

  baseEntry.backendStatus = results.some(function (r) {
    return r && r.ok;
  })
    ? 'ok'
    : 'failed';
  baseEntry.backendResults = results;
  try {
    await appendUberRidesOrders(baseEntry);
    console.log('[RefundGuardian] Uber Rides local storage updated');
  } catch (e) {
    logError('appendUberRidesOrders after batch', e);
  }

  sendResponse({
    ok: true,
    received: newOrders.length,
    backend: baseEntry.backendStatus,
    local: true,
    results: results,
  });
}

async function handleAmazonOrdersDetected(message, sendResponse) {
  const orders = Array.isArray(message.data) ? message.data : [];
  const url = typeof message.url === 'string' ? message.url : '';
  const extractedAt = typeof message.extractedAt === 'string' ? message.extractedAt : '';

  console.log(
    '[RefundGuardian] Received AMAZON_ORDERS_DETECTED',
    'count=' + orders.length,
    'url=' + url,
    'at=' + extractedAt
  );

  if (orders.length === 0) {
    sendResponse({ ok: true, received: 0, skipped: true });
    return;
  }

  const batchHash = simpleHash(JSON.stringify(orders) + '|' + url + '|' + extractedAt);

  let token = '';
  try {
    const stored = await chromeStorageLocalGet(['accessToken']);
    token = typeof stored.accessToken === 'string' ? stored.accessToken : '';
  } catch (e) {
    logError('reading accessToken', e);
  }

  const baseEntry = {
    id: makeEntryId(),
    orders,
    url,
    extractedAt,
    batchHash,
    receivedAt: new Date().toISOString(),
    backendStatus: 'pending',
  };

  try {
    if (!token) {
      console.warn('[RefundGuardian] No access token — backend skipped, local fallback only');
      console.log('[RefundGuardian] Backend status: skipped_no_token');
      baseEntry.backendStatus = 'failed';
      baseEntry.error = 'Missing access token (save token in extension popup)';
      const persistNoToken = await appendAmazonOrders(baseEntry);
      if (persistNoToken.ok) {
        console.log('[RefundGuardian] Local storage updated');
      }
      sendResponse({ ok: true, received: orders.length, backend: 'skipped_no_token', local: true });
      return;
    }

    await waitForRateLimit();

    const payload = {
      orders,
      url,
      extractedAt,
    };

    if (RG_VERBOSE_ORDERS_API) {
      console.log('[RefundGuardian] Sending to backend', 'orders=' + orders.length, 'POST /api/orders');
    }

    try {
      const result = await postOrdersToBackend(payload, token);
      console.log('[RefundGuardian] Backend success', JSON.stringify(result).slice(0, 2000));
      baseEntry.backendStatus = 'ok';
      baseEntry.backendResponse = result;
      console.log('[RefundGuardian] Backend status: success');

      let extensionVersion = '1.0.0';
      try {
        extensionVersion = chrome.runtime.getManifest().version || extensionVersion;
      } catch (_) {}

      await postSyncExtensionSilently(token, {
        type: 'amazon_orders_batch',
        data: orders,
        meta: {
          url: url,
          extractedAt: extractedAt,
          extensionVersion: extensionVersion,
        },
      });
    } catch (apiErr) {
      logError('Backend failed', apiErr);
      console.log('[RefundGuardian] Backend status: fail');
      console.log('[RefundGuardian] Backend failed — persisting to local storage');
      baseEntry.backendStatus = 'failed';
      baseEntry.error = apiErr instanceof Error ? apiErr.message : String(apiErr);
    } finally {
      lastBackendPostAt = Date.now();
    }

    const persist = await appendAmazonOrders(baseEntry);
    if (persist.ok) {
      console.log('[RefundGuardian] Local storage updated');
    } else if (persist.quotaExceeded) {
      console.warn('[RefundGuardian] Local snapshot skipped (storage quota)');
    }

    sendResponse({
      ok: true,
      received: orders.length,
      backend: baseEntry.backendStatus === 'ok' ? 'success' : 'failed',
      local: true,
    });
  } catch (e) {
    logError('handleAmazonOrdersDetected', e);
    try {
      baseEntry.backendStatus = 'failed';
      baseEntry.error = e instanceof Error ? e.message : String(e);
      await appendAmazonOrders(baseEntry);
    } catch (e2) {
      logError('fatal: could not persist', e2);
    }
    sendResponse({ ok: false, error: e instanceof Error ? e.message : String(e) });
  }
}

rgLogLifecycle('[RefundGuardian] background.js evaluated');
rgLogLifecycle('RefundGuardian AI Service Worker Active');

chrome.runtime.onInstalled.addListener((details) => {
  try {
    rgLogLifecycle('[RefundGuardian] onInstalled:', details.reason, 'previousVersion:', details.previousVersion);
  } catch (e) {
    logError('onInstalled', e);
  }
  try {
    chrome.storage.local.get(['accessToken'], function (r) {
      if (chrome.runtime.lastError) return;
      if (r && r.accessToken && String(r.accessToken).trim().length > 0) {
        registerMerchantBackgroundScanAlarms();
      }
    });
  } catch (e) {
    logError('onInstalled register alarms', e);
  }
});

chrome.runtime.onStartup.addListener(function () {
  try {
    chrome.storage.local.get(['accessToken'], function (r) {
      if (chrome.runtime.lastError) return;
      if (r && r.accessToken && String(r.accessToken).trim().length > 0) {
        registerMerchantBackgroundScanAlarms();
      }
    });
  } catch (e) {
    logError('onStartup register alarms', e);
  }
});

chrome.alarms.onAlarm.addListener(function (alarm) {
  try {
    if (alarm.name === RG_ALARM_MERCHANT_PERIODIC) {
      runBackgroundMerchantScan('periodic');
    }
  } catch (e) {
    logError('alarms.onAlarm', e);
  }
});

/** True when visit URL is local dev — never treat as real Amazon order context. */
function isLocalDevPageVisitUrl(url) {
  if (typeof url !== 'string' || !url) return false;
  try {
    const u = new URL(url);
    return u.hostname === 'localhost' || u.hostname === '127.0.0.1';
  } catch {
    return false;
  }
}

/**
 * Fallback: programmatic injection if declarative content_scripts ever fail to run.
 */
function urlMatchesInjectable(url) {
  if (typeof url !== 'string' || !url) return false;
  try {
    const u = new URL(url);
    const h = u.hostname;
    const p = u.port;
    if (h === 'localhost' || h === '127.0.0.1') {
      return p === '3000';
    }
    if (
      /\.amazon\.(com|eg|co\.uk|de|fr|it|es|ca|in|com\.au|co\.jp|com\.mx|com\.br|nl|se|pl|sa|ae|sg|com\.tr)$/i.test(
        h
      )
    ) {
      return true;
    }
    if (h.includes('uber.com') || h.includes('ubereats.com')) return true;
    return false;
  } catch {
    return false;
  }
}

chrome.tabs.onUpdated.addListener((tabId, changeInfo, tab) => {
  try {
    if (changeInfo.status !== 'complete' || !tab || !tab.url) return;
    if (!urlMatchesInjectable(tab.url)) return;

    chrome.scripting
      .executeScript({
        target: { tabId: tabId, allFrames: false },
        files: ['content.js'],
      })
      .then(() => {
        console.log('[RefundGuardian] programmatic inject OK tab', tabId, tab.url);
      })
      .catch((err) => {
        console.warn('[RefundGuardian] programmatic inject skipped:', err && err.message ? err.message : err);
      });
  } catch (e) {
    logError('tabs.onUpdated', e);
  }
});

/**
 * Opens merchant seed URLs in tabs (inactive by default). Returns a Promise so MV3 delivers
 * the response reliably (async sendResponse alone often loses the channel before tabs open).
 */
function handleOpenMerchantSeedUrls(message) {
  let entries = message.entries;
  if (!Array.isArray(entries) || entries.length === 0) {
    const urlsOnly = message.urls;
    if (Array.isArray(urlsOnly) && urlsOnly.length > 0) {
      entries = urlsOnly.map(function (u) {
        return { key: 'unknown', url: u, label: '' };
      });
    }
  }
  if (!Array.isArray(entries) || entries.length === 0) {
    return Promise.resolve({ ok: false, opened: 0, results: [] });
  }

  const wantInactive = message.inactive !== false;

  function createOne(url) {
    return new Promise(function (resolve) {
      try {
        chrome.tabs.create({ url: url, active: wantInactive ? false : true }, function () {
          var err = chrome.runtime.lastError;
          if (err) {
            resolve({ ok: false, error: err.message });
          } else {
            resolve({ ok: true });
          }
        });
      } catch (e) {
        resolve({ ok: false, error: e instanceof Error ? e.message : String(e) });
      }
    });
  }

  return (async function () {
    /** @type {{ key: string; url: string; ok: boolean; error?: string }[]} */
    var results = [];
    var opened = 0;
    var i;
    for (i = 0; i < entries.length; i++) {
      if (i > 0) {
        await new Promise(function (r) {
          setTimeout(r, 150);
        });
      }
      var row = entries[i] || {};
      var u = typeof row.url === 'string' ? row.url : '';
      var key = typeof row.key === 'string' && row.key ? row.key : 'idx_' + i;
      if (!u || !isAllowedMerchantSeedUrl(u)) {
        console.warn('[RefundGuardian] Merchant seed tab: ' + key + ' SKIP (invalid URL)');
        results.push({ key: key, url: u, ok: false, error: 'invalid_or_disallowed_url' });
        continue;
      }

      var attempt = await createOne(u);
      if (!attempt.ok) {
        console.warn(
          '[RefundGuardian] Merchant seed tab: ' + key + ' FAIL — ' + (attempt.error || 'unknown') + ' (retry)'
        );
        await new Promise(function (r) {
          setTimeout(r, 200);
        });
        attempt = await createOne(u);
      }
      if (attempt.ok) {
        opened++;
        console.log(
          '[RefundGuardian] Merchant seed tab: ' +
            key +
            ' OK (' +
            (wantInactive ? 'inactive' : 'active') +
            ', background-safe)'
        );
        results.push({ key: key, url: u, ok: true });
      } else {
        console.warn('[RefundGuardian] Merchant seed tab: ' + key + ' FAIL — ' + (attempt.error || 'unknown'));
        results.push({ key: key, url: u, ok: false, error: attempt.error });
      }
    }

    return { ok: opened > 0, opened: opened, results: results };
  })().catch(function (e) {
    console.error('[RefundGuardian] handleOpenMerchantSeedUrls', e);
    return { ok: false, opened: 0, results: [], error: e instanceof Error ? e.message : String(e) };
  });
}

chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
  if (message.type === 'FETCH') {
    const url = message.url;
    const init = message.init || {};
    if (typeof url !== 'string' || url.length === 0) {
      sendResponse({ ok: false, error: 'Missing url' });
      return false;
    }

    (async () => {
      try {
        const res = await fetch(url, init);
        const contentType = res.headers.get('content-type') || '';
        const body = contentType.includes('application/json')
          ? await res.json().catch(() => null)
          : await res.text().catch(() => null);

        sendResponse({
          ok: true,
          status: res.status,
          headers: Object.fromEntries(res.headers.entries()),
          body,
        });
      } catch (err) {
        sendResponse({
          ok: false,
          error: err instanceof Error ? err.message : 'Fetch failed',
        });
      }
    })().catch((e) => {
      logError('FETCH handler', e);
      try {
        sendResponse({ ok: false, error: String(e) });
      } catch (_) {}
    });

    return true;
  }

  if (message.type === 'ORDER_DETECTED') {
    const payload = message.payload || {};
    chrome.storage.local.get(['accessToken', RG_API_BASE_STORAGE_KEY], (stored) => {
      try {
        if (chrome.runtime.lastError) {
          sendResponse({ ok: false, error: chrome.runtime.lastError.message });
          return;
        }
        const token = stored.accessToken;
        let base = API_BASE_DEFAULT;
        const rb = stored[RG_API_BASE_STORAGE_KEY];
        if (typeof rb === 'string' && rb.trim()) {
          base = rb.trim().replace(/\/$/, '');
        }
        const headers = { 'Content-Type': 'application/json' };
        if (token) headers['Authorization'] = 'Bearer ' + token;

        const tryPost = (attempt) => {
          fetch(base + '/api/orders', {
            method: 'POST',
            headers,
            body: JSON.stringify(payload),
          })
            .then((res) => res.json())
            .then((data) => sendResponse({ ok: true, data }))
            .catch((err) => {
              if (attempt < 2) {
                const delay = 400 * Math.pow(2, attempt);
                setTimeout(() => tryPost(attempt + 1), delay);
              } else {
                sendResponse({ ok: false, error: err.message });
              }
            });
        };
        tryPost(0);
      } catch (e) {
        logError('ORDER_DETECTED', e);
        sendResponse({ ok: false, error: String(e) });
      }
    });
    return true;
  }

  if (message.type === 'UBER_EATS_ORDERS_DETECTED') {
    handleUberEatsOrdersDetected(message, sendResponse).catch((e) => {
      logError('UBER_EATS_ORDERS_DETECTED async', e);
      try {
        sendResponse({ ok: false, error: String(e) });
      } catch (_) {}
    });
    return true;
  }

  if (message.type === 'UBER_RIDES_ORDERS_DETECTED') {
    handleUberRidesOrdersDetected(message, sendResponse).catch((e) => {
      logError('UBER_RIDES_ORDERS_DETECTED async', e);
      try {
        sendResponse({ ok: false, error: String(e) });
      } catch (_) {}
    });
    return true;
  }

  if (message.type === 'AMAZON_ORDERS_DETECTED') {
    handleAmazonOrdersDetected(message, sendResponse).catch((e) => {
      logError('AMAZON_ORDERS_DETECTED async', e);
      try {
        sendResponse({ ok: false, error: String(e) });
      } catch (_) {}
    });
    return true;
  }

  if (message.type === 'PAGE_VISIT') {
    try {
      const { url, provider, testMode, mockOrder } = message;
      const treatAsDevTest =
        testMode === true || provider === 'local_dev' || isLocalDevPageVisitUrl(url);

      if (treatAsDevTest) {
        console.log('[RefundGuardian] PAGE_VISIT (dev test — not production Amazon data)', url);
        chrome.storage.local.set(
          {
            lastDevPageTest: {
              url,
              provider: provider || 'local_dev',
              testMode: true,
              mockOrder: mockOrder || null,
              at: Date.now(),
            },
          },
          () => {
            if (chrome.runtime.lastError) {
              sendResponse({ ok: false, error: chrome.runtime.lastError.message });
            } else {
              sendResponse({ ok: true, devTest: true });
            }
          }
        );
        return true;
      }

      console.log('[RefundGuardian] PAGE_VISIT (production)', provider, url);
      const at = Date.now();
      chrome.storage.local.set(
        {
          lastOrderPage: { url, provider, at: at },
          lastMerchantEngagementAt: at,
        },
        () => {
          if (chrome.runtime.lastError) {
            sendResponse({ ok: false, error: chrome.runtime.lastError.message });
          } else {
            sendResponse({ ok: true });
          }
        }
      );
      return true;
    } catch (e) {
      logError('PAGE_VISIT', e);
      sendResponse({ ok: false, error: String(e) });
      return false;
    }
  }

  if (message.type === 'OPEN_MERCHANT_SEED_URLS') {
    return handleOpenMerchantSeedUrls(message);
  }

  if (message.type === 'SET_ACCESS_TOKEN') {
    const token = message.token;
    if (typeof token === 'string' && token.length > 0) {
      chrome.storage.local.get(['firstTokenSavedAt'], function (existing) {
        if (chrome.runtime.lastError) {
          sendResponse({ ok: false, error: chrome.runtime.lastError.message });
          return;
        }
        const toSet = { accessToken: token };
        if (typeof message.apiBase === 'string' && message.apiBase.trim().length > 0) {
          toSet[RG_API_BASE_STORAGE_KEY] = message.apiBase.trim().replace(/\/$/, '');
        }
        if (!(existing && typeof existing.firstTokenSavedAt === 'number')) {
          toSet.firstTokenSavedAt = Date.now();
        }
        chrome.storage.local.set(toSet, () => {
          if (chrome.runtime.lastError) {
            sendResponse({ ok: false, error: chrome.runtime.lastError.message });
          } else {
            try {
              registerMerchantBackgroundScanAlarms();
            } catch (e) {
              logError('SET_ACCESS_TOKEN alarms', e);
            }
            sendResponse({ ok: true });
          }
        });
      });
      return true;
    }
    sendResponse({ ok: false, error: 'Invalid token' });
    return false;
  }

  return false;
});
