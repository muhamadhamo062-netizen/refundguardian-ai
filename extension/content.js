/**
 * RefundGuardian AI — Content script (Manifest V3)
 * Amazon order extraction (Phase 2) + PAGE_VISIT + SPA hooks.
 */
(function () {
  'use strict';

  /**
   * CRITICAL: Register dashboard <-> extension bridge BEFORE __REFUNDGUARDIAN_AI_INJECTED__ guard.
   * Runs on localhost and *.vercel.app (add your custom domain to manifest matches if needed).
   * Same-window postMessage often has event.source === null — do not require e.source === window.
   */
  function shouldRegisterDashboardBridge() {
    var hn = window.location.hostname || '';
    if (hn === 'localhost' || hn === '127.0.0.1') return true;
    if (/\.vercel\.app$/i.test(hn)) return true;
    try {
      if (document.querySelector('meta[name="refundguardian-dashboard"]')) return true;
    } catch (_) {}
    return false;
  }

  function registerRefundGuardianDashboardBridgeOnce() {
    try {
      if (!shouldRegisterDashboardBridge()) return;
      if (window.__RG_DASHBOARD_BRIDGE_V2__) return;
      window.__RG_DASHBOARD_BRIDGE_V2__ = true;
      var rgTokenFlushTimer = null;
      var rgPendingTok = null;
      var rgPendingApiBase = null;
      window.addEventListener(
        'message',
        function rgDashboardStorageBridge(e) {
          try {
            if (e.origin !== window.location.origin) return;
            if (e.source != null && e.source !== window) return;
            var data = e.data;
            if (!data || !data.type) return;

            if (data.type === 'RG_EXTENSION_PROBE') {
              var rid = data.requestId;
              var ver = '1.0.9';
              try {
                if (chrome.runtime && typeof chrome.runtime.getManifest === 'function') {
                  var m = chrome.runtime.getManifest();
                  if (m && m.version) ver = m.version;
                }
              } catch (_) {}
              try {
                if (!window.__RG_EXTENSION_INSTALL_LOGGED__) {
                  window.__RG_EXTENSION_INSTALL_LOGGED__ = true;
                  console.log('[RefundGuardian] Extension installed.');
                }
              } catch (_) {}
              window.postMessage(
                {
                  type: 'RG_EXTENSION_ACK',
                  ok: true,
                  requestId: rid,
                  version: ver,
                },
                window.location.origin
              );
              return;
            }

            if (data.type === 'REFUNDGUARDIAN_CONNECT_TOKEN') {
              var tok2 = data.token;
              if (typeof tok2 !== 'string' || !tok2 || !chrome.runtime?.id) return;
              rgPendingTok = tok2;
              rgPendingApiBase =
                typeof data.apiBase === 'string' && data.apiBase.length > 0 ? data.apiBase : undefined;
              if (rgTokenFlushTimer) clearTimeout(rgTokenFlushTimer);
              rgTokenFlushTimer = setTimeout(function () {
                rgTokenFlushTimer = null;
                var tokSend = rgPendingTok;
                var apiB = rgPendingApiBase;
                rgPendingTok = null;
                rgPendingApiBase = undefined;
                if (typeof tokSend !== 'string' || !tokSend) return;
                chrome.runtime.sendMessage(
                  { type: 'SET_ACCESS_TOKEN', token: tokSend, apiBase: apiB },
                  function () {
                    var le2 = chrome.runtime.lastError;
                    if (le2) {
                      console.warn('[RefundGuardian] token sync failed:', le2.message);
                      try {
                        window.postMessage(
                          {
                            type: 'REFUNDGUARDIAN_TOKEN_ACK',
                            ok: false,
                            error: le2.message,
                          },
                          window.location.origin
                        );
                      } catch (_) {}
                      return;
                    }
                    console.log('[RefundGuardian] Token synced successfully.');
                    try {
                      window.postMessage(
                        {
                          type: 'REFUNDGUARDIAN_TOKEN_ACK',
                          ok: true,
                          at: new Date().toISOString(),
                        },
                        window.location.origin
                      );
                    } catch (_) {}
                  }
                );
              }, 450);
              return;
            }

            if (data.type === 'REFUNDGUARDIAN_OPEN_MERCHANT_SEED') {
              var ridSeed = data.requestId;
              var entriesSeed = data.entries;
              var urlsSeed = data.urls;
              var inactiveSeed = data.inactive !== false;
              if (!chrome.runtime?.id) {
                try {
                  window.postMessage(
                    {
                      type: 'REFUNDGUARDIAN_OPEN_MERCHANT_SEED_DONE',
                      requestId: ridSeed,
                      ok: false,
                      opened: 0,
                      results: [],
                    },
                    window.location.origin
                  );
                } catch (_) {}
                return;
              }
              var payloadSeed = { type: 'OPEN_MERCHANT_SEED_URLS', inactive: inactiveSeed };
              if (Array.isArray(entriesSeed) && entriesSeed.length > 0) {
                payloadSeed.entries = entriesSeed;
              } else if (Array.isArray(urlsSeed) && urlsSeed.length > 0) {
                payloadSeed.urls = urlsSeed;
              } else {
                try {
                  window.postMessage(
                    {
                      type: 'REFUNDGUARDIAN_OPEN_MERCHANT_SEED_DONE',
                      requestId: ridSeed,
                      ok: false,
                      opened: 0,
                      results: [],
                    },
                    window.location.origin
                  );
                } catch (_) {}
                return;
              }
              function finishSeed(resp, leSeed) {
                var okSeed =
                  !leSeed &&
                  resp &&
                  (resp.ok === true || (typeof resp.opened === 'number' && resp.opened > 0));
                var nOpen = resp && typeof resp.opened === 'number' ? resp.opened : 0;
                var resList = resp && Array.isArray(resp.results) ? resp.results : [];
                try {
                  window.postMessage(
                    {
                      type: 'REFUNDGUARDIAN_OPEN_MERCHANT_SEED_DONE',
                      requestId: ridSeed,
                      ok: okSeed,
                      opened: nOpen,
                      results: resList,
                    },
                    window.location.origin
                  );
                } catch (_) {}
              }
              chrome.runtime.sendMessage(payloadSeed, function (resp) {
                var leSeed = chrome.runtime.lastError;
                if (leSeed) {
                  console.warn('[RefundGuardian] OPEN_MERCHANT_SEED_URLS first try:', leSeed.message || leSeed);
                  setTimeout(function () {
                    chrome.runtime.sendMessage(payloadSeed, function (resp2) {
                      var le2 = chrome.runtime.lastError;
                      if (le2) {
                        console.warn('[RefundGuardian] OPEN_MERCHANT_SEED_URLS retry failed:', le2.message || le2);
                      }
                      finishSeed(resp2, le2);
                    });
                  }, 350);
                  return;
                }
                finishSeed(resp, leSeed);
              });
              return;
            }

            if (data.type !== 'RG_REQUEST_AMAZON_ORDERS') return;

            if (!chrome.runtime?.id || !chrome.storage?.local) {
              window.postMessage(
                {
                  type: 'RG_AMAZON_ORDERS_RESPONSE',
                  bridge: true,
                  payload: null,
                  error: 'no_extension_storage',
                },
                window.location.origin
              );
              return;
            }
            chrome.storage.local.get(['amazonOrders'], function (r) {
              var err = chrome.runtime.lastError;
              window.postMessage(
                {
                  type: 'RG_AMAZON_ORDERS_RESPONSE',
                  bridge: true,
                  payload: err ? null : r.amazonOrders ?? null,
                  error: err ? err.message : undefined,
                },
                window.location.origin
              );
            });
          } catch (bridgeErr) {
            try {
              if (e.data && e.data.type === 'RG_REQUEST_AMAZON_ORDERS') {
                window.postMessage(
                  {
                    type: 'RG_AMAZON_ORDERS_RESPONSE',
                    bridge: true,
                    payload: null,
                    error: bridgeErr instanceof Error ? bridgeErr.message : 'bridge_error',
                  },
                  window.location.origin
                );
              }
            } catch (_) {}
          }
        },
        false
      );
    } catch (_) {}
  }

  registerRefundGuardianDashboardBridgeOnce();

  try {
    if (window.__REFUNDGUARDIAN_AI_INJECTED__) {
      return;
    }
    window.__REFUNDGUARDIAN_AI_INJECTED__ = true;

    console.log('[RefundGuardian] content.js loaded', window.location.href);

    console.log('🔥 RefundGuardian AI Injected Successfully');

    const IS_TEST_ENV =
      window.location.hostname.includes('localhost') ||
      window.location.hostname === '127.0.0.1';

    if (window.location.hostname.includes('localhost') || window.location.hostname === '127.0.0.1') {
      console.log('[RefundGuardian] LOCALHOST MODE ACTIVE');
    }

    const host = window.location.hostname || '';

    function logSendError(context) {
      const err = chrome.runtime.lastError;
      if (err && err.message) {
        console.warn('[RefundGuardian] sendMessage failed (' + context + '):', err.message);
      }
    }

    function sendMessageSafe(payload, context) {
      if (!chrome.runtime?.id) {
        console.warn('[RefundGuardian] chrome.runtime not available (' + context + ')');
        return;
      }
      chrome.runtime.sendMessage(payload, () => logSendError(context));
    }

    function parseAmount(price) {
      try {
        if (price == null) return null;
        const s = String(price).replace(/,/g, '');
        const m = s.match(/([\d.]+)/);
        if (!m) return null;
        const n = parseFloat(m[1]);
        if (Number.isNaN(n)) return null;
        return n;
      } catch (_) {
        return null;
      }
    }

    /** Default API base; production set via dashboard auto-connect (rgApiBase in chrome.storage.local). */
    const RG_API_DEFAULT = 'http://localhost:3000';

    function postJsonToOrdersApi(body, contextLabel) {
      try {
        if (!chrome.storage?.local) {
          console.warn('[RefundGuardian] chrome.storage.local unavailable (' + (contextLabel || 'orders') + ')');
          return;
        }
        chrome.storage.local.get(['accessToken', 'rgApiBase'], function (stored) {
          var err = chrome.runtime.lastError;
          if (err) {
            console.warn('[RefundGuardian] storage get failed', err.message);
            return;
          }
          var base = RG_API_DEFAULT;
          if (stored && typeof stored.rgApiBase === 'string' && stored.rgApiBase.trim()) {
            base = stored.rgApiBase.trim().replace(/\/$/, '');
          }
          var token =
            stored && typeof stored.accessToken === 'string' ? stored.accessToken.trim() : '';
          var headers = { 'Content-Type': 'application/json' };
          if (token) {
            headers['Authorization'] = 'Bearer ' + token;
            if (window.__RG_VERBOSE_ORDERS_API__) {
              console.log('[RefundGuardian] POST /api/orders with Bearer token (' + (contextLabel || 'orders') + ')');
            }
          } else if (window.__RG_VERBOSE_ORDERS_API__) {
            console.log(
              '[RefundGuardian] POST /api/orders without Bearer (save token in extension popup) —',
              contextLabel || 'orders'
            );
          }
          fetch(base + '/api/orders', {
            method: 'POST',
            headers: headers,
            body: JSON.stringify(body),
          })
            .then(function (r) {
              return r
                .text()
                .then(function (t) {
                  return { ok: r.ok, status: r.status, body: t };
                })
                .catch(function () {
                  return { ok: r.ok, status: r.status, body: '' };
                });
            })
            .then(function (res) {
              if (res && res.ok) {
                if (window.__RG_VERBOSE_ORDERS_API__) {
                  console.log('[RefundGuardian] Backend status: success');
                }
                return;
              }
              if (window.__RG_VERBOSE_ORDERS_API__) {
                console.log('[RefundGuardian] Backend status: fail', res && res.status ? res.status : 'unknown');
              }
            })
            .catch(function (e) {
              if (window.__RG_VERBOSE_ORDERS_API__) {
                console.log('[RefundGuardian] POST /api/orders network error', e && e.message ? e.message : e);
              }
            });
        });
      } catch (e) {
        if (window.__RG_VERBOSE_ORDERS_API__) {
          console.log('[RefundGuardian] postJsonToOrdersApi error', e && e.message ? e.message : e);
        }
      }
    }

    function postAmazonOrderToLocalApi(order, context) {
      try {
        const payload = {
          provider: 'amazon',
          order_id: order && order.orderId ? String(order.orderId) : 'rg-' + Date.now() + '-' + Math.random().toString(36).slice(2, 10),
          merchant_name: 'Amazon',
          amount: parseAmount(order && order.price),
          created_at: new Date().toISOString(),
          raw: {
            scraped: order || null,
            url: window.location.href,
            context: context || 'amazon_extractor',
          },
        };
        postJsonToOrdersApi(payload, context || 'amazon_extractor');
      } catch (e) {
        if (window.__RG_VERBOSE_ORDERS_API__) {
          console.log('[RefundGuardian] postAmazonOrderToLocalApi error', e && e.message ? e.message : e);
        }
      }
    }

    function showInjectionIndicator(options) {
      const isTest = options && options.test === true;
      if (document.getElementById('rg-refundguardian-injection-badge')) {
        return;
      }
      const badge = document.createElement('div');
      badge.id = 'rg-refundguardian-injection-badge';
      badge.setAttribute('aria-hidden', 'true');
      badge.title = isTest
        ? 'RefundGuardian AI — TEST MODE (localhost)'
        : 'RefundGuardian AI is active on this page';
      badge.textContent = isTest ? 'RefundGuardian TEST' : 'RefundGuardian';
      Object.assign(badge.style, {
        position: 'fixed',
        bottom: '10px',
        right: '10px',
        zIndex: '2147483647',
        padding: '6px 10px',
        font: '600 11px/1.2 system-ui, Segoe UI, sans-serif',
        letterSpacing: '0.02em',
        background: isTest
          ? 'linear-gradient(135deg, #ca8a04 0%, #eab308 100%)'
          : 'linear-gradient(135deg, #16a34a 0%, #22c55e 100%)',
        color: isTest ? '#422006' : '#052e16',
        borderRadius: '8px',
        boxShadow: '0 2px 12px rgba(0,0,0,0.25)',
        pointerEvents: 'none',
        opacity: '0.92',
      });

      const mount = () => {
        const root = document.documentElement || document.body;
        if (root) {
          root.appendChild(badge);
        }
      };

      if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', mount, { once: true });
      } else {
        mount();
      }
    }

    /** --- Local dev (localhost / 127.0.0.1) — no Amazon extraction --- */
    if (IS_TEST_ENV) {
      console.log('🟡 RefundGuardian TEST MODE ACTIVE');
      showInjectionIndicator({ test: true });

      sendMessageSafe(
        {
          type: 'PAGE_VISIT',
          url: window.location.href,
          provider: 'local_dev',
          testMode: true,
          mockOrder: {
            orderId: 'rg-test-local',
            label: 'Local dashboard injection test',
            path: window.location.pathname || '/',
            detectedAt: new Date().toISOString(),
          },
        },
        'PAGE_VISIT test'
      );
      return;
    }

    /** US-only: US storefront uses hostnames ending in .amazon.com (www.amazon.com, smile.amazon.com, …). */
    const isAmazon = host === 'amazon.com' || /\.amazon\.com$/i.test(host);

    const isUberEats =
      host.includes('ubereats.com') || (typeof host === 'string' && host.indexOf('eats.') === 0);
    const isUberRides = host.includes('uber.com') && !isUberEats;
    const isDoorDash = host === 'doordash.com' || /\.doordash\.com$/i.test(host);

    if (isAmazon) {
      console.log('[RefundGuardian] Running on Amazon —', host);
    } else if (isUberEats) {
      console.log('[RefundGuardian] Running on Uber Eats —', host);
    } else if (isUberRides) {
      console.log('[RefundGuardian] Running on Uber Rides —', host);
    } else if (isDoorDash) {
      console.log('[RefundGuardian] Running on DoorDash —', host);
    }

    if (isUberEats || isUberRides) {
      try {
        chrome.storage.local.get(['accessToken'], function (r) {
          var le = chrome.runtime.lastError;
          if (le) return;
          var has = !!(r && r.accessToken && String(r.accessToken).trim().length > 0);
          console.log(
            '[RefundGuardian] accessToken for Uber sync:',
            has ? 'present' : 'missing (open dashboard or extension popup)'
          );
        });
      } catch (_) {}
    }

    showInjectionIndicator({ test: false });

    let lastPageVisitSent = '';

    function sendAmazonPageVisit(reason) {
      if (!isAmazon || !chrome.runtime?.id) return;
      const href = window.location.href;
      if (href === lastPageVisitSent) return;
      lastPageVisitSent = href;
      console.log('[RefundGuardian] PAGE_VISIT (' + reason + ')', href);
      sendMessageSafe(
        {
          type: 'PAGE_VISIT',
          url: href,
          provider: 'amazon',
          testMode: false,
        },
        'PAGE_VISIT amazon'
      );
    }

    sendAmazonPageVisit('initial');

    let lastDoorDashPageVisitSent = '';
    function sendDoorDashPageVisit(reason) {
      if (!isDoorDash || !chrome.runtime?.id) return;
      const href = window.location.href;
      if (href === lastDoorDashPageVisitSent) return;
      lastDoorDashPageVisitSent = href;
      console.log('[RefundGuardian] PAGE_VISIT (' + reason + ')', href);
      sendMessageSafe(
        {
          type: 'PAGE_VISIT',
          url: href,
          provider: 'doordash',
          testMode: false,
        },
        'PAGE_VISIT doordash'
      );
    }
    sendDoorDashPageVisit('initial');

    if (isDoorDash && typeof history !== 'undefined') {
      const scheduleDd = function () {
        queueMicrotask(function () {
          sendDoorDashPageVisit('route-change');
        });
      };
      const origPushDd = history.pushState;
      const origReplaceDd = history.replaceState;
      if (typeof origPushDd === 'function') {
        history.pushState = function () {
          const r = origPushDd.apply(this, arguments);
          scheduleDd();
          return r;
        };
      }
      if (typeof origReplaceDd === 'function') {
        history.replaceState = function () {
          const r = origReplaceDd.apply(this, arguments);
          scheduleDd();
          return r;
        };
      }
      window.addEventListener('popstate', scheduleDd, false);
    }

    /** SPA-style navigations (Amazon client-side route changes) */
    if (isAmazon && typeof history !== 'undefined') {
      const schedule = function () {
        queueMicrotask(function () {
          sendAmazonPageVisit('route-change');
          if (typeof window.__rgScheduleOrderExtractWithSync === 'function') {
            try {
              window.__rgScheduleOrderExtractWithSync();
            } catch (_) {}
          }
        });
      };
      const origPush = history.pushState;
      const origReplace = history.replaceState;
      if (typeof origPush === 'function') {
        history.pushState = function () {
          const r = origPush.apply(this, arguments);
          schedule();
          return r;
        };
      }
      if (typeof origReplace === 'function') {
        history.replaceState = function () {
          const r = origReplace.apply(this, arguments);
          schedule();
          return r;
        };
      }
      window.addEventListener('popstate', schedule, false);
    }

    /** ========== Amazon orders extraction (Phase 2) — Amazon domains only ========== */
    if (isAmazon) {
      (function initAmazonOrderExtractor() {
        const ORDER_ID_RE = /\b(\d{3}-\d{7}-\d{7})\b/g;
        const ORDER_ID_SINGLE = /\b\d{3}-\d{7}-\d{7}\b/;
        const sentFingerprints = new Set();
        let debounceTimer = null;
        let pollTimer = null;
        let mo = null;
        let lastUrl = window.location.href;
        let lastOrdersPageLoggedHref = '';

        function isAmazonOrdersPage() {
          try {
            const u = window.location.href;
            const p = window.location.pathname + window.location.search;
            if (/orderId=/i.test(window.location.search)) return true;
            return (
              /your-orders|order-history|orderHistory|gp\/css\/order|gp\/your-account\/order|YourOrders|order-details|progress-tracker/i.test(
                p
              ) || /\/your-orders\/?$/i.test(p)
            );
          } catch (_) {
            return false;
          }
        }

        function normalizeOrderStatus(text) {
          try {
            const t = String(text || '').toLowerCase();
            const rules = [
              [/delivered|تم التسليم|livré|geliefert/i, 'Delivered'],
              [/out for delivery|خارج للتسليم|en route/i, 'Out for delivery'],
              [/shipped|تم الشحن|versendet|expédié/i, 'Shipped'],
              [/processing|قيد المعالجة|in bearbeitung/i, 'Processing'],
              [/cancel(?:led|ed)|ملغى|annulé/i, 'Cancelled'],
              [/refunded|مسترد|erstattet/i, 'Refunded'],
              [/return|إرجاع/i, 'Return'],
            ];
            for (let i = 0; i < rules.length; i++) {
              if (rules[i][0].test(t)) return rules[i][1];
            }
            return '';
          } catch (_) {
            return '';
          }
        }

        function findContainerForOrderId(orderId) {
          try {
            const byData = document.querySelector('[data-order-id="' + orderId + '"]');
            if (byData) return byData.closest('.order-card, .a-box-group, [class*="order-card"], .a-section') || byData;

            const links = document.querySelectorAll(
              'a[href*="order-details"], a[href*="orderId="], a[href*="/progress-tracker/"]'
            );
            for (let i = 0; i < links.length; i++) {
              const a = links[i];
              if (ORDER_ID_SINGLE.test(a.href) && a.href.indexOf(orderId) !== -1) {
                let el = a;
                for (let d = 0; d < 14 && el; d++) {
                  if (
                    el.classList &&
                    (el.classList.contains('order-card') ||
                      el.classList.contains('a-box-group') ||
                      /order-card|yohtmlc-order|order-level/i.test(el.className || ''))
                  ) {
                    return el;
                  }
                  el = el.parentElement;
                }
                return a.parentElement && a.parentElement.parentElement ? a.parentElement.parentElement : a.parentElement;
              }
            }
          } catch (_) {}
          return null;
        }

        function extractFromContainer(container, orderId) {
          try {
            if (!container) return null;
            const text = (container.innerText || '').slice(0, 12000);

            let productTitle = '';
            try {
              const titleSel =
                'a[href*="/dp/"], a[href*="/gp/product/"], .yohtmlc-product-title, [data-cy="order-item-title"], .a-truncate-full, [class*="product-title"]';
              const ta = container.querySelectorAll(titleSel);
              for (let i = 0; i < ta.length; i++) {
                const s = (ta[i].textContent || '').trim();
                if (s.length > 3 && s.length < 600) {
                  productTitle = s;
                  break;
                }
              }
            } catch (_) {}

            let price = '';
            try {
              const pm = text.match(/[\$€£٣E£]\s*[\d.,]+\s*(?:USD|EUR|GBP|EGP)?|[\d.,]+\s*(?:USD|EUR|GBP|EGP)/i);
              if (pm) price = pm[0].trim().slice(0, 48);
              if (!price) {
                const pe = container.querySelector('.a-color-price, .a-price .a-offscreen, span.a-price, .a-offscreen');
                if (pe && pe.textContent) price = pe.textContent.trim().slice(0, 48);
              }
            } catch (_) {}

            let date = '';
            try {
              const dm = text.match(
                /\b(?:Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)[a-z]*\s+\d{1,2},?\s+\d{4}\b|\b\d{1,2}[\/\-.]\d{1,2}[\/\-.]\d{2,4}\b|\b\d{4}-\d{2}-\d{2}\b/
              );
              if (dm) date = dm[0];
            } catch (_) {}

            const status = normalizeOrderStatus(text) || '';

            return {
              orderId: orderId,
              productTitle: productTitle || '',
              price: price || '',
              status: status,
              date: date || '',
            };
          } catch (_) {
            return null;
          }
        }

        function collectOrderIds() {
          const ids = new Set();
          try {
            document.querySelectorAll('[data-order-id]').forEach(function (el) {
              const v = el.getAttribute('data-order-id');
              if (v && ORDER_ID_SINGLE.test(v)) ids.add(v.match(ORDER_ID_SINGLE)[0]);
            });
          } catch (_) {}

          try {
            document.querySelectorAll('a[href*="order-details"], a[href*="orderId="]').forEach(function (a) {
              const m = a.href.match(ORDER_ID_SINGLE);
              if (m) ids.add(m[0]);
            });
          } catch (_) {}

          try {
            const snippet = (document.body && document.body.innerText) ? document.body.innerText.slice(0, 60000) : '';
            let m;
            ORDER_ID_RE.lastIndex = 0;
            while ((m = ORDER_ID_RE.exec(snippet)) !== null) {
              ids.add(m[1]);
            }
          } catch (_) {}

          return ids;
        }

        function fingerprint(order) {
          try {
            if (order.orderId) return 'id:' + order.orderId;
            const h =
              (order.productTitle || '').slice(0, 80) +
              '|' +
              (order.price || '') +
              '|' +
              (order.date || '');
            return 'h:' + String(h.length) + ':' + h.slice(0, 120);
          } catch (_) {
            return 'x:' + Math.random();
          }
        }

        function pushAmazonHttpsIfOk(url, arr) {
          try {
            const u = new URL(url);
            if (u.protocol !== 'https:') return;
            const h = u.hostname.toLowerCase();
            if (!h.includes('amazon.com')) return;
            if (arr.indexOf(url) === -1) arr.push(url);
          } catch (_) {}
        }

        function collectAmazonDomDeepLinksForOrder(orderId) {
          const out = [];
          try {
            const sel =
              'a[href*="' +
              orderId +
              '"], a[href*="order-details"], a[href*="orderId="], a[href*="/progress-tracker/"]';
            document.querySelectorAll(sel).forEach(function (a) {
              const href = a.href || '';
              if (!href || href.indexOf(orderId) === -1) return;
              pushAmazonHttpsIfOk(href, out);
            });
          } catch (_) {}
          return out.slice(0, 6);
        }

        function scheduleAmazonDeepInactiveTabs(rows) {
          try {
            if (!Array.isArray(rows) || rows.length === 0 || !chrome.runtime?.id) return;
            const urls = [];
            const maxOrders = 3;
            for (let i = 0; i < rows.length && urls.length < 8 && i < maxOrders; i++) {
              const oid = rows[i].orderId;
              if (!oid || !ORDER_ID_SINGLE.test(String(oid))) continue;
              const sk = 'rg_deep_az_' + oid;
              try {
                if (sessionStorage.getItem(sk)) continue;
                sessionStorage.setItem(sk, '1');
              } catch (_) {}
              const dom = collectAmazonDomDeepLinksForOrder(oid);
              for (let j = 0; j < dom.length && urls.length < 8; j++) {
                pushAmazonHttpsIfOk(dom[j], urls);
              }
              const origin = window.location.origin || 'https://www.amazon.com';
              const detail = origin + '/gp/css/order-details?orderID=' + encodeURIComponent(oid);
              const receipt = origin + '/gp/css/summary/print.html?orderID=' + encodeURIComponent(oid);
              pushAmazonHttpsIfOk(detail, urls);
              if (urls.length < 8) pushAmazonHttpsIfOk(receipt, urls);
            }
            if (urls.length === 0) return;
            sendMessageSafe(
              { type: 'OPEN_MERCHANT_SEED_URLS', urls: urls, inactive: true },
              'OPEN deep amazon'
            );
          } catch (e) {
            console.warn('[RefundGuardian] scheduleAmazonDeepInactiveTabs', e);
          }
        }

        function isAmazonDetailDeepPage() {
          try {
            const p = window.location.pathname + window.location.search;
            return /order-details|gp\/css\/summary|print\.html|progress-tracker|invoice|billing/i.test(p);
          } catch (_) {
            return false;
          }
        }

        function parseOrderIdFromAmazonUrl() {
          try {
            const u = new URL(window.location.href);
            const q =
              (u.searchParams.get('orderID') || u.searchParams.get('orderId') || '').trim();
            if (q && ORDER_ID_SINGLE.test(q)) return String(q.match(ORDER_ID_SINGLE)[0]);
            const m = (u.pathname + u.search).match(ORDER_ID_SINGLE);
            return m ? m[0] : '';
          } catch (_) {
            return '';
          }
        }

        function extractDeliveryTimestampHint(text) {
          try {
            const t = String(text || '').slice(0, 32000);
            const m =
              t.match(
                /\b(?:Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)[a-z]*\s+\d{1,2},?\s+\d{4}[^\n]{0,40}|\b\d{4}-\d{2}-\d{2}T\d{2}:\d{2}[^\n]{0,24}|\b\d{1,2}:\d{2}\s*(?:AM|PM)\b[^\n]{0,48}/i
              ) ||
              t.match(/\b(?:delivered|delivery|arrived|ETA)[^\n]{0,120}/i);
            return m ? String(m[0]).slice(0, 200) : '';
          } catch (_) {
            return '';
          }
        }

        function extractIssueIndicatorsFromText(text) {
          const out = [];
          try {
            const t = String(text || '').toLowerCase();
            const rules = [
              [/refund|reimburs/i, 'refund'],
              [/\breturn\b|returned/i, 'return'],
              [/missing|wrong item|wrong order|item damaged/i, 'item_issue'],
              [/late|delayed|not delivered|never arrived/i, 'delivery_issue'],
              [/problem with|charge dispute|billing problem/i, 'support_issue'],
            ];
            for (let i = 0; i < rules.length; i++) {
              if (rules[i][0].test(t)) out.push(rules[i][1]);
            }
          } catch (_) {}
          return out;
        }

        function tryAmazonDetailDeepScan() {
          try {
            if (!isAmazonOrdersPage() || !isAmazonDetailDeepPage()) return;
            const oid = parseOrderIdFromAmazonUrl();
            if (!oid) return;
            const fp = 'deepdetail:' + oid;
            if (sentFingerprints.has(fp)) return;
            sentFingerprints.add(fp);
            const blob = document.body && document.body.innerText ? document.body.innerText.slice(0, 32000) : '';
            const row = {
              orderId: oid,
              productTitle: '',
              price: '',
              date: '',
              status: normalizeOrderStatus(blob) || '',
              deepScan: {
                source: 'detail_or_receipt_page',
                url: window.location.href,
                deliveryTimestampHint: extractDeliveryTimestampHint(blob),
                issueIndicators: extractIssueIndicatorsFromText(blob),
                receiptLikePage: /\/(?:summary|print|invoice)/i.test(window.location.pathname),
              },
            };
            sendMessageSafe(
              {
                type: 'AMAZON_ORDERS_DETECTED',
                data: [row],
                url: window.location.href,
                extractedAt: new Date().toISOString(),
              },
              'AMAZON_ORDERS_DETECTED deep'
            );
          } catch (e) {
            console.warn('[RefundGuardian] tryAmazonDetailDeepScan', e);
          }
        }

        function extractAmazonOrders() {
          const list = [];
          try {
            const idSet = collectOrderIds();
            idSet.forEach(function (oid) {
              try {
                const container = findContainerForOrderId(oid) || document.body;
                const row = extractFromContainer(container, oid);
                if (row && (row.orderId || row.productTitle || row.price)) {
                  list.push(row);
                }
              } catch (_) {}
            });

            if (list.length === 0 && isAmazonOrdersPage()) {
              try {
                const groups = document.querySelectorAll(
                  '.order-card, .a-box-group, [class*="yohtmlc-order"], [class*="order-card"]'
                );
                const max = Math.min(groups.length, 40);
                for (let i = 0; i < max; i++) {
                  const g = groups[i];
                  const blob = (g.innerText || '').slice(0, 4000);
                  const idm = blob.match(ORDER_ID_SINGLE);
                  const oid = idm ? idm[0] : '';
                  const row = extractFromContainer(g, oid || 'unknown-' + i);
                  if (row && (row.productTitle || row.price || row.orderId)) {
                    if (!row.orderId && oid) row.orderId = oid;
                    list.push(row);
                  }
                }
              } catch (_) {}
            }
          } catch (e) {
            console.warn('[RefundGuardian] extractAmazonOrders error', e);
          }
          return list;
        }

        function dedupeOrders(orders) {
          const seen = new Set();
          const out = [];
          for (let i = 0; i < orders.length; i++) {
            const fp = fingerprint(orders[i]);
            if (seen.has(fp)) continue;
            seen.add(fp);
            out.push(orders[i]);
          }
          return out;
        }

        function runOrderExtractionPass() {
          try {
            if (!isAmazonOrdersPage()) {
              return;
            }
            try {
              const h = window.location.href;
              if (h !== lastOrdersPageLoggedHref) {
                lastOrdersPageLoggedHref = h;
                console.log('[RefundGuardian] Orders page detected');
              }
            } catch (_) {}

            const raw = extractAmazonOrders();
            const merged = dedupeOrders(raw);
            const newOnes = [];
            for (let i = 0; i < merged.length; i++) {
              const fp = fingerprint(merged[i]);
              if (sentFingerprints.has(fp)) continue;
              sentFingerprints.add(fp);
              newOnes.push(merged[i]);
            }

            if (merged.length > 0) {
              console.log('[RefundGuardian] Extraction pass: ' + merged.length + ' order(s) in DOM (deduped)');
            }

            if (newOnes.length > 0) {
              console.log('[RefundGuardian] Sending orders to background');
              console.log(
                '[RefundGuardian] Sending orders to background (new=' + newOnes.length + ', page=orders)'
              );
              sendMessageSafe(
                {
                  type: 'AMAZON_ORDERS_DETECTED',
                  data: newOnes,
                  url: window.location.href,
                  extractedAt: new Date().toISOString(),
                },
                'AMAZON_ORDERS_DETECTED'
              );

              try {
                for (let i = 0; i < newOnes.length; i++) {
                  postAmazonOrderToLocalApi(newOnes[i], 'orders_page');
                }
              } catch (_) {}
              scheduleAmazonDeepInactiveTabs(newOnes);
            }
            tryAmazonDetailDeepScan();
          } catch (e) {
            console.warn('[RefundGuardian] runOrderExtractionPass', e);
          }
        }

        function scheduleOrderExtract() {
          try {
            if (debounceTimer) clearTimeout(debounceTimer);
            debounceTimer = setTimeout(function () {
              debounceTimer = null;
              try {
                if (window.location.href !== lastUrl) {
                  lastUrl = window.location.href;
                }
              } catch (_) {}
              runOrderExtractionPass();
            }, 650);
          } catch (_) {}
        }

        function attachObservers() {
          try {
            if (mo) {
              mo.disconnect();
              mo = null;
            }
            mo = new MutationObserver(function () {
              if (!isAmazonOrdersPage()) return;
              scheduleOrderExtract();
            });
            const root = document.body || document.documentElement;
            if (root) {
              mo.observe(root, { childList: true, subtree: true, attributes: false });
            }
          } catch (e) {
            console.warn('[RefundGuardian] MutationObserver attach failed', e);
          }
        }

        function syncOrdersPageWatchers() {
          try {
            if (!isAmazonOrdersPage()) {
              lastOrdersPageLoggedHref = '';
              if (mo) {
                mo.disconnect();
                mo = null;
              }
              return;
            }
            if (!mo) {
              attachObservers();
            }
          } catch (_) {}
        }

        function startPolling() {
          try {
            if (pollTimer) clearInterval(pollTimer);
            pollTimer = setInterval(function () {
              try {
                syncOrdersPageWatchers();
                if (!isAmazonOrdersPage()) return;
                scheduleOrderExtract();
              } catch (_) {}
            }, 4000);
          } catch (_) {}
        }

        function scheduleOrderExtractWithSync() {
          try {
            syncOrdersPageWatchers();
          } catch (_) {}
          scheduleOrderExtract();
        }

        window.__rgScheduleOrderExtract = scheduleOrderExtract;
        window.__rgScheduleOrderExtractWithSync = scheduleOrderExtractWithSync;

        scheduleOrderExtractWithSync();
        startPolling();

        window.addEventListener(
          'beforeunload',
          function () {
            try {
              if (mo) mo.disconnect();
              if (pollTimer) clearInterval(pollTimer);
              if (debounceTimer) clearTimeout(debounceTimer);
            } catch (_) {}
          },
          { once: true }
        );
      })();
    }

    /** ========== Uber Eats orders — ubereats.com / eats.uber.com only (does not touch Amazon) ========== */
    if (isUberEats) {
      (function initUberEatsOrderExtractor() {
        const UUID_RE = /[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/i;
        const sentOrderIds = new Set();
        const sentUeDeepDetail = new Set();
        let debounceTimerUe = null;
        let pollTimerUe = null;
        let moUe = null;
        let lastUrlUe = window.location.href;
        let lastOrdersPageLoggedHrefUe = '';

        function parsePriceToCentsUber(price) {
          const n = parseAmount(price);
          if (n == null) return null;
          return Math.round(n * 100);
        }

        function parseIsoFromText(text) {
          try {
            if (!text) return null;
            var m = text.match(/\b\d{4}-\d{2}-\d{2}T\d{2}:\d{2}/);
            if (m) {
              var d = new Date(m[0]);
              if (!isNaN(d.getTime())) return d.toISOString();
            }
            var m2 = text.match(
              /\b(?:Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)[a-z]*\s+\d{1,2},?\s+\d{4}\b|\b\d{1,2}\/\d{1,2}\/\d{2,4}\b/
            );
            if (m2) {
              var d2 = new Date(m2[0]);
              if (!isNaN(d2.getTime())) return d2.toISOString();
            }
          } catch (_) {}
          return null;
        }

        function walkJsonForUberOrders(node, out, depth) {
          if (depth > 22) return;
          if (!node || typeof node !== 'object') return;
          if (Array.isArray(node)) {
            for (var i = 0; i < node.length; i++) {
              walkJsonForUberOrders(node[i], out, depth + 1);
            }
            return;
          }
          var uuid =
            (typeof node.uuid === 'string' && node.uuid) ||
            (typeof node.orderUuid === 'string' && node.orderUuid) ||
            (typeof node.orderUUID === 'string' && node.orderUUID);
          if (uuid && UUID_RE.test(uuid)) {
            var merchant =
              node.title ||
              node.restaurantName ||
              node.storeName ||
              node.merchantName ||
              node.brandName ||
              '';
            var total = node.total || node.totalAmount || node.totalPrice || node.price || '';
            var cents = null;
            if (typeof node.totalInCents === 'number' && Number.isFinite(node.totalInCents)) {
              cents = Math.round(node.totalInCents);
            } else if (typeof node.total === 'number' && Number.isFinite(node.total)) {
              cents =
                node.total < 1000 && node.total > 0 ? Math.round(node.total * 100) : Math.round(node.total);
            } else if (typeof total === 'string') {
              cents = parsePriceToCentsUber(total);
            }
            var created =
              (typeof node.createdAt === 'string' && node.createdAt) ||
              (typeof node.placedAt === 'string' && node.placedAt) ||
              (typeof node.orderTime === 'string' && node.orderTime) ||
              (typeof node.orderDate === 'string' && node.orderDate) ||
              new Date().toISOString();
            out.push({
              orderId: String(uuid).toLowerCase(),
              merchantName: String(merchant).slice(0, 240) || 'Uber Eats',
              price: typeof total === 'string' ? total : '',
              orderValueCents: cents,
              createdAt: created,
              raw: { nextJson: node, url: window.location.href },
            });
          }
          for (var k in node) {
            if (Object.prototype.hasOwnProperty.call(node, k)) {
              walkJsonForUberOrders(node[k], out, depth + 1);
            }
          }
        }

        function extractUberEatsOrders() {
          const list = [];
          const seen = new Set();
          try {
            const nd = document.getElementById('__NEXT_DATA__');
            if (nd && nd.textContent) {
              const j = JSON.parse(nd.textContent);
              const found = [];
              walkJsonForUberOrders(j, found, 0);
              for (let i = 0; i < found.length; i++) {
                const f = found[i];
                if (f.orderId && !seen.has(f.orderId)) {
                  seen.add(f.orderId);
                  list.push(f);
                }
              }
            }
          } catch (e) {
            console.warn('[RefundGuardian] Uber Eats __NEXT_DATA__ parse failed', e);
          }

          try {
            const links = document.querySelectorAll('a[href*="/orders/"]');
            for (let i = 0; i < links.length; i++) {
              const href = links[i].href || '';
              const m = href.match(UUID_RE);
              if (!m) continue;
              const oid = m[0].toLowerCase();
              if (seen.has(oid)) continue;
              seen.add(oid);
              const card =
                links[i].closest('div, li, article, section, [data-testid]') || links[i].parentElement;
              const blob = card ? String(card.innerText || '').slice(0, 14000) : '';
              let merchant = '';
              const h =
                card &&
                card.querySelector(
                  'h1, h2, h3, h4, [data-testid*="restaurant"], [data-testid*="title"], [class*="Restaurant"]'
                );
              if (h && h.textContent) merchant = h.textContent.trim().slice(0, 240);
              if (!merchant) {
                const lines = blob.split('\n').filter(function (l) {
                  return l.trim().length > 0;
                });
                merchant = (lines[0] && lines[0].trim().slice(0, 240)) || 'Uber Eats';
              }
              let priceStr = '';
              const pm = blob.match(/[\$€£]\s*[\d.,]+|[\d.,]+\s*(?:USD|EUR|GBP)/i);
              if (pm) priceStr = pm[0];
              const cents = parsePriceToCentsUber(priceStr);
              const dt = parseIsoFromText(blob) || new Date().toISOString();
              list.push({
                orderId: oid,
                merchantName: merchant,
                price: priceStr,
                orderValueCents: cents,
                createdAt: dt,
                raw: {
                  domSnippet: blob.slice(0, 12000),
                  url: window.location.href,
                  href: href,
                },
              });
            }
          } catch (e2) {
            console.warn('[RefundGuardian] Uber Eats DOM extract failed', e2);
          }

          return list;
        }

        function fingerprintUe(o) {
          try {
            if (o.orderId) return 'id:' + o.orderId;
            return 'h:' + String((o.merchantName || '').slice(0, 40));
          } catch (_) {
            return 'x:' + Math.random();
          }
        }

        function isUberEatsOrdersPage() {
          try {
            const path = window.location.pathname || '';
            if (/\/orders\//i.test(path)) return true;
            if (/\/orders\/?$/i.test(path)) return true;
            const p = path + (window.location.search || '');
            return /\/orders|feed|past-orders|order-history/i.test(p);
          } catch (_) {
            return false;
          }
        }

        let lastUePageVisitSent = '';
        function sendUberEatsPageVisit(reason) {
          try {
            if (!chrome.runtime?.id) return;
            if (!isUberEatsOrdersPage()) return;
            const href = window.location.href;
            if (href === lastUePageVisitSent) return;
            lastUePageVisitSent = href;
            console.log('[RefundGuardian] PAGE_VISIT (' + reason + ')', href);
            sendMessageSafe(
              {
                type: 'PAGE_VISIT',
                url: href,
                provider: 'ubereats',
                testMode: false,
              },
              'PAGE_VISIT ubereats'
            );
          } catch (_) {}
        }

        function buildUberEatsOrderDeepUrl(uuid) {
          try {
            const o = window.location.origin;
            if (o && o.includes('ubereats.com')) return o + '/orders/' + encodeURIComponent(uuid);
          } catch (_) {}
          return 'https://www.ubereats.com/orders/' + encodeURIComponent(uuid);
        }

        function scheduleUberEatsDeepInactiveTabs(rows) {
          try {
            if (!Array.isArray(rows) || rows.length === 0 || !chrome.runtime?.id) return;
            const urls = [];
            const max = 6;
            for (let i = 0; i < rows.length && urls.length < max; i++) {
              const id = rows[i].orderId ? String(rows[i].orderId) : '';
              if (!id || !UUID_RE.test(id)) continue;
              const sk = 'rg_deep_ue_' + id;
              try {
                if (sessionStorage.getItem(sk)) continue;
                sessionStorage.setItem(sk, '1');
              } catch (_) {}
              const u = buildUberEatsOrderDeepUrl(id);
              if (urls.indexOf(u) === -1) urls.push(u);
            }
            if (urls.length === 0) return;
            sendMessageSafe(
              { type: 'OPEN_MERCHANT_SEED_URLS', urls: urls, inactive: true },
              'OPEN deep ubereats'
            );
          } catch (e) {
            console.warn('[RefundGuardian] scheduleUberEatsDeepInactiveTabs', e);
          }
        }

        function ueIssueIndicatorsFromText(text) {
          const out = [];
          try {
            const t = String(text || '').toLowerCase();
            const rules = [
              [/refund|credit/i, 'refund'],
              [/\bmissing\b|wrong order|spill/i, 'item_issue'],
              [/late|delay|never arrived/i, 'delivery_issue'],
            ];
            for (let i = 0; i < rules.length; i++) {
              if (rules[i][0].test(t)) out.push(rules[i][1]);
            }
          } catch (_) {}
          return out;
        }

        function extractUeDeliveryHint(text) {
          try {
            const t = String(text || '').slice(0, 32000);
            const m =
              t.match(
                /\b(?:Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)[a-z]*\s+\d{1,2},?\s+\d{4}[^\n]{0,40}|\b\d{4}-\d{2}-\d{2}T\d{2}:\d{2}[^\n]{0,24}|\b\d{1,2}:\d{2}\s*(?:AM|PM)\b[^\n]{0,48}/i
              ) || t.match(/\b(?:delivered|delivery|arrived|ETA)[^\n]{0,120}/i);
            return m ? String(m[0]).slice(0, 200) : '';
          } catch (_) {
            return '';
          }
        }

        function tryUberEatsDetailDeepScan() {
          try {
            if (!isUberEatsOrdersPage()) return;
            const path = window.location.pathname || '';
            const m = path.match(
              /\/orders\/([0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})/i
            );
            if (!m) return;
            const uuid = m[1].toLowerCase();
            const fp = 'uedeep:' + uuid;
            if (sentUeDeepDetail.has(fp)) return;
            sentUeDeepDetail.add(fp);
            const blob = document.body && document.body.innerText ? document.body.innerText.slice(0, 28000) : '';
            const row = {
              orderId: uuid,
              merchantName: 'Uber Eats',
              price: '',
              orderValueCents: null,
              createdAt: parseIsoFromText(blob) || new Date().toISOString(),
              raw: { url: window.location.href, deepDetail: true },
              deepScan: {
                source: 'order_detail',
                url: window.location.href,
                deliveryTimestampHint: extractUeDeliveryHint(blob),
                issueIndicators: ueIssueIndicatorsFromText(blob),
              },
            };
            sendMessageSafe(
              {
                type: 'UBER_EATS_ORDERS_DETECTED',
                data: [row],
                url: window.location.href,
                extractedAt: new Date().toISOString(),
              },
              'UBER_EATS_ORDERS_DETECTED deep'
            );
          } catch (e) {
            console.warn('[RefundGuardian] tryUberEatsDetailDeepScan', e);
          }
        }

        function runUberEatsExtractionPass() {
          try {
            if (!isUberEatsOrdersPage()) {
              return;
            }
            try {
              const h = window.location.href;
              if (h !== lastOrdersPageLoggedHrefUe) {
                lastOrdersPageLoggedHrefUe = h;
                console.log('[RefundGuardian] Uber Eats orders page context');
              }
            } catch (_) {}

            const merged = extractUberEatsOrders();
            const newOnes = [];
            for (let i = 0; i < merged.length; i++) {
              const row = merged[i];
              const idKey = row.orderId ? String(row.orderId) : '';
              if (!idKey) continue;
              if (sentOrderIds.has(idKey)) continue;
              sentOrderIds.add(idKey);
              newOnes.push(row);
            }

            if (merged.length > 0) {
              console.log('[RefundGuardian] Uber Eats extraction pass: ' + merged.length + ' order(s) in DOM');
            }

            if (newOnes.length > 0) {
              console.log(
                '[RefundGuardian] Uber Eats: sending ' + newOnes.length + ' new order(s) to background'
              );
              sendMessageSafe(
                {
                  type: 'UBER_EATS_ORDERS_DETECTED',
                  data: newOnes,
                  url: window.location.href,
                  extractedAt: new Date().toISOString(),
                },
                'UBER_EATS_ORDERS_DETECTED'
              );
              scheduleUberEatsDeepInactiveTabs(newOnes);
            }
            tryUberEatsDetailDeepScan();
          } catch (e) {
            console.warn('[RefundGuardian] runUberEatsExtractionPass', e);
          }
        }

        function scheduleUberEatsExtract() {
          try {
            if (debounceTimerUe) clearTimeout(debounceTimerUe);
            debounceTimerUe = setTimeout(function () {
              debounceTimerUe = null;
              try {
                if (window.location.href !== lastUrlUe) {
                  lastUrlUe = window.location.href;
                }
              } catch (_) {}
              runUberEatsExtractionPass();
            }, 700);
          } catch (_) {}
        }

        function attachUberEatsObservers() {
          try {
            if (moUe) {
              moUe.disconnect();
              moUe = null;
            }
            moUe = new MutationObserver(function () {
              if (!isUberEatsOrdersPage()) return;
              scheduleUberEatsExtract();
            });
            const root = document.body || document.documentElement;
            if (root) {
              moUe.observe(root, { childList: true, subtree: true, attributes: false });
            }
          } catch (e) {
            console.warn('[RefundGuardian] Uber Eats MutationObserver attach failed', e);
          }
        }

        function syncUberEatsWatchers() {
          try {
            if (!isUberEatsOrdersPage()) {
              lastOrdersPageLoggedHrefUe = '';
              if (moUe) {
                moUe.disconnect();
                moUe = null;
              }
              return;
            }
            if (!moUe) {
              attachUberEatsObservers();
            }
          } catch (_) {}
        }

        function scheduleUberEatsExtractWithSync() {
          try {
            syncUberEatsWatchers();
          } catch (_) {}
          scheduleUberEatsExtract();
        }

        if (typeof history !== 'undefined') {
          const scheduleUe = function () {
            queueMicrotask(function () {
              sendUberEatsPageVisit('route-change');
              scheduleUberEatsExtractWithSync();
            });
          };
          const origPushUe = history.pushState;
          const origReplaceUe = history.replaceState;
          if (typeof origPushUe === 'function') {
            history.pushState = function () {
              const r = origPushUe.apply(this, arguments);
              scheduleUe();
              return r;
            };
          }
          if (typeof origReplaceUe === 'function') {
            history.replaceState = function () {
              const r = origReplaceUe.apply(this, arguments);
              scheduleUe();
              return r;
            };
          }
          window.addEventListener('popstate', scheduleUe, false);
        }

        sendUberEatsPageVisit('initial');
        scheduleUberEatsExtractWithSync();
        try {
          if (pollTimerUe) clearInterval(pollTimerUe);
          pollTimerUe = setInterval(function () {
            try {
              syncUberEatsWatchers();
              if (!isUberEatsOrdersPage()) return;
              scheduleUberEatsExtract();
            } catch (_) {}
          }, 5000);
        } catch (_) {}

        window.addEventListener(
          'beforeunload',
          function () {
            try {
              if (moUe) moUe.disconnect();
              if (pollTimerUe) clearInterval(pollTimerUe);
              if (debounceTimerUe) clearTimeout(debounceTimerUe);
            } catch (_) {}
          },
          { once: true }
        );
      })();
    }

    /** ========== Uber Rides — uber.com only (excludes Uber Eats hosts) ========== */
    if (isUberRides) {
      (function initUberRidesOrderExtractor() {
        const UUID_RE = /[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/i;
        const sentOrderIdsUr = new Set();
        const sentUrDeepDetail = new Set();
        let debounceTimerUr = null;
        let pollTimerUr = null;
        let moUr = null;
        let lastUrlUr = window.location.href;
        let lastOrdersPageLoggedHrefUr = '';

        function parsePriceToCentsRides(price) {
          const n = parseAmount(price);
          if (n == null) return null;
          return Math.round(n * 100);
        }

        function parseIsoFromTextUr(text) {
          try {
            if (!text) return null;
            var m = text.match(/\b\d{4}-\d{2}-\d{2}T\d{2}:\d{2}/);
            if (m) {
              var d = new Date(m[0]);
              if (!isNaN(d.getTime())) return d.toISOString();
            }
            var m2 = text.match(
              /\b(?:Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)[a-z]*\s+\d{1,2},?\s+\d{4}\b|\b\d{1,2}\/\d{1,2}\/\d{2,4}\b/
            );
            if (m2) {
              var d2 = new Date(m2[0]);
              if (!isNaN(d2.getTime())) return d2.toISOString();
            }
          } catch (_) {}
          return null;
        }

        function looksLikeFoodOrderNode(node) {
          try {
            if (!node || typeof node !== 'object') return false;
            if (typeof node.restaurantName === 'string' && node.restaurantName) return true;
            if (typeof node.storeName === 'string' && node.storeName) return true;
            if (typeof node.orderUuid === 'string' && node.orderUuid && !node.tripUuid && !node.tripUUID)
              return true;
          } catch (_) {}
          return false;
        }

        function looksLikeRideNode(node) {
          try {
            if (!node || typeof node !== 'object') return false;
            if (node.tripStatus != null) return true;
            if (node.pickup != null || node.dropoff != null) return true;
            if (node.pickupLocation != null || node.dropoffLocation != null) return true;
            if (node.fare != null || node.fareAmount != null) return true;
            if (typeof node.tripUuid === 'string' || typeof node.tripUUID === 'string') return true;
            if (typeof node.rideRequestUUID === 'string' || typeof node.requestUuid === 'string')
              return true;
          } catch (_) {}
          return false;
        }

        function walkJsonForUberRides(node, out, depth) {
          if (depth > 22) return;
          if (!node || typeof node !== 'object') return;
          if (Array.isArray(node)) {
            for (var i = 0; i < node.length; i++) {
              walkJsonForUberRides(node[i], out, depth + 1);
            }
            return;
          }
          var uuid =
            (typeof node.tripUuid === 'string' && node.tripUuid) ||
            (typeof node.tripUUID === 'string' && node.tripUUID) ||
            (typeof node.requestUuid === 'string' && node.requestUuid) ||
            (typeof node.rideRequestUUID === 'string' && node.rideRequestUUID) ||
            (typeof node.uuid === 'string' && node.uuid);
          if (uuid && UUID_RE.test(uuid)) {
            if (looksLikeFoodOrderNode(node) && !looksLikeRideNode(node)) {
              /* skip */
            } else if (looksLikeRideNode(node) || typeof node.tripUuid === 'string' || typeof node.tripUUID === 'string') {
              var pickup =
                (typeof node.pickupAddress === 'string' && node.pickupAddress) ||
                (node.pickup && typeof node.pickup.title === 'string' && node.pickup.title) ||
                (node.pickup && typeof node.pickup === 'string' && node.pickup) ||
                '';
              var drop =
                (typeof node.dropoffAddress === 'string' && node.dropoffAddress) ||
                (node.dropoff && typeof node.dropoff.title === 'string' && node.dropoff.title) ||
                '';
              var merchant = 'Uber';
              if (pickup || drop) {
                merchant = ('Trip: ' + String(pickup || '').slice(0, 80) + (drop ? ' → ' + String(drop).slice(0, 80) : '')).slice(0, 240);
              }
              var total =
                node.totalFare ||
                node.fare ||
                node.fareAmount ||
                node.tripFare ||
                node.price ||
                '';
              var cents = null;
              if (typeof node.fareInCents === 'number' && Number.isFinite(node.fareInCents)) {
                cents = Math.round(node.fareInCents);
              } else if (typeof total === 'number' && Number.isFinite(total)) {
                cents = total < 1000 && total > 0 ? Math.round(total * 100) : Math.round(total);
              } else if (typeof total === 'string') {
                cents = parsePriceToCentsRides(total);
              }
              var created =
                (typeof node.completedAt === 'string' && node.completedAt) ||
                (typeof node.requestedAt === 'string' && node.requestedAt) ||
                (typeof node.createdAt === 'string' && node.createdAt) ||
                (typeof node.tripDate === 'string' && node.tripDate) ||
                new Date().toISOString();
              out.push({
                orderId: String(uuid).toLowerCase(),
                merchantName: String(merchant).slice(0, 240) || 'Uber',
                price: typeof total === 'string' ? total : '',
                orderValueCents: cents,
                createdAt: created,
                raw: { nextJson: node, url: window.location.href },
              });
            }
          }
          for (var k in node) {
            if (Object.prototype.hasOwnProperty.call(node, k)) {
              walkJsonForUberRides(node[k], out, depth + 1);
            }
          }
        }

        function extractUberRidesOrders() {
          const list = [];
          const seen = new Set();
          try {
            const nd = document.getElementById('__NEXT_DATA__');
            if (nd && nd.textContent) {
              const j = JSON.parse(nd.textContent);
              const found = [];
              walkJsonForUberRides(j, found, 0);
              for (let i = 0; i < found.length; i++) {
                const f = found[i];
                if (f.orderId && !seen.has(f.orderId)) {
                  seen.add(f.orderId);
                  list.push(f);
                }
              }
            }
          } catch (e) {
            console.warn('[RefundGuardian] Uber Rides __NEXT_DATA__ parse failed', e);
          }

          try {
            const links = document.querySelectorAll(
              'a[href*="/trips/"], a[href*="/trip/"], a[href*="trip_uuid"], a[href*="/p/trips"]'
            );
            for (let i = 0; i < links.length; i++) {
              const href = links[i].href || '';
              const m = href.match(UUID_RE);
              if (!m) continue;
              const oid = m[0].toLowerCase();
              if (seen.has(oid)) continue;
              seen.add(oid);
              const card =
                links[i].closest('div, li, article, section, [data-testid]') || links[i].parentElement;
              const blob = card ? String(card.innerText || '').slice(0, 14000) : '';
              let merchant = 'Uber';
              const lines = blob.split('\n').filter(function (l) {
                return l.trim().length > 0;
              });
              if (lines[0]) merchant = lines[0].trim().slice(0, 240);
              let priceStr = '';
              const pm = blob.match(/[\$€£]\s*[\d.,]+|[\d.,]+\s*(?:USD|EUR|GBP)/i);
              if (pm) priceStr = pm[0];
              const cents = parsePriceToCentsRides(priceStr);
              const dt = parseIsoFromTextUr(blob) || new Date().toISOString();
              list.push({
                orderId: oid,
                merchantName: merchant,
                price: priceStr,
                orderValueCents: cents,
                createdAt: dt,
                raw: {
                  domSnippet: blob.slice(0, 12000),
                  url: window.location.href,
                  href: href,
                },
              });
            }
          } catch (e2) {
            console.warn('[RefundGuardian] Uber Rides DOM extract failed', e2);
          }

          return list;
        }

        function isUberRidesOrdersPage() {
          try {
            const path = window.location.pathname || '';
            if (/\/trips?\//i.test(path)) return true;
            if (/\/trips\/?$/i.test(path)) return true;
            const p = path + (window.location.search || '');
            return /trips|ride-history|\/activity|past-trips|\/go\/trips/i.test(p);
          } catch (_) {
            return false;
          }
        }

        function parseTripUuidFromUberUrl() {
          try {
            const u = new URL(window.location.href);
            const q = (
              u.searchParams.get('trip_uuid') ||
              u.searchParams.get('tripUuid') ||
              u.searchParams.get('uuid') ||
              ''
            ).trim();
            if (q && UUID_RE.test(q)) return String(q.match(UUID_RE)[0]).toLowerCase();
            const path = u.pathname || '';
            const m = path.match(
              /\/(?:trips?|p\/trips)\/([0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})/i
            );
            return m ? m[1].toLowerCase() : '';
          } catch (_) {
            return '';
          }
        }

        let lastUrPageVisitSent = '';
        function sendUberRidesPageVisit(reason) {
          try {
            if (!chrome.runtime?.id) return;
            if (!isUberRidesOrdersPage()) return;
            const href = window.location.href;
            if (href === lastUrPageVisitSent) return;
            lastUrPageVisitSent = href;
            console.log('[RefundGuardian] PAGE_VISIT (' + reason + ')', href);
            sendMessageSafe(
              {
                type: 'PAGE_VISIT',
                url: href,
                provider: 'uber_rides',
                testMode: false,
              },
              'PAGE_VISIT uber_rides'
            );
          } catch (_) {}
        }

        function buildUberTripDeepUrl(uuid) {
          try {
            const o = window.location.origin;
            if (o && o.includes('uber.com')) return o + '/trips/' + encodeURIComponent(uuid);
          } catch (_) {}
          return 'https://www.uber.com/trips/' + encodeURIComponent(uuid);
        }

        function scheduleUberRidesDeepInactiveTabs(rows) {
          try {
            if (!Array.isArray(rows) || rows.length === 0 || !chrome.runtime?.id) return;
            const urls = [];
            const max = 6;
            for (let i = 0; i < rows.length && urls.length < max; i++) {
              const id = rows[i].orderId ? String(rows[i].orderId) : '';
              if (!id || !UUID_RE.test(id)) continue;
              const sk = 'rg_deep_ur_' + id;
              try {
                if (sessionStorage.getItem(sk)) continue;
                sessionStorage.setItem(sk, '1');
              } catch (_) {}
              const u = buildUberTripDeepUrl(id);
              if (urls.indexOf(u) === -1) urls.push(u);
            }
            if (urls.length === 0) return;
            sendMessageSafe(
              { type: 'OPEN_MERCHANT_SEED_URLS', urls: urls, inactive: true },
              'OPEN deep uber rides'
            );
          } catch (e) {
            console.warn('[RefundGuardian] scheduleUberRidesDeepInactiveTabs', e);
          }
        }

        function urIssueIndicatorsFromText(text) {
          const out = [];
          try {
            const t = String(text || '').toLowerCase();
            const rules = [
              [/refund|credit|adjustment/i, 'refund'],
              [/safety|incident|dispute/i, 'safety_issue'],
              [/surge|overcharg|wrong fare/i, 'fare_issue'],
            ];
            for (let i = 0; i < rules.length; i++) {
              if (rules[i][0].test(t)) out.push(rules[i][1]);
            }
          } catch (_) {}
          return out;
        }

        function extractUrDeliveryHint(text) {
          try {
            const t = String(text || '').slice(0, 32000);
            const m =
              t.match(
                /\b(?:Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)[a-z]*\s+\d{1,2},?\s+\d{4}[^\n]{0,40}|\b\d{4}-\d{2}-\d{2}T\d{2}:\d{2}[^\n]{0,24}|\b\d{1,2}:\d{2}\s*(?:AM|PM)\b[^\n]{0,48}/i
              ) || t.match(/\b(?:pickup|dropoff|completed|trip)[^\n]{0,120}/i);
            return m ? String(m[0]).slice(0, 200) : '';
          } catch (_) {
            return '';
          }
        }

        function tryUberRidesDetailDeepScan() {
          try {
            if (!isUberRidesOrdersPage()) return;
            const uuid = parseTripUuidFromUberUrl();
            if (!uuid) return;
            const fp = 'urdeep:' + uuid;
            if (sentUrDeepDetail.has(fp)) return;
            sentUrDeepDetail.add(fp);
            const blob = document.body && document.body.innerText ? document.body.innerText.slice(0, 28000) : '';
            const row = {
              orderId: uuid,
              merchantName: 'Uber',
              price: '',
              orderValueCents: null,
              createdAt: parseIsoFromTextUr(blob) || new Date().toISOString(),
              raw: { url: window.location.href, deepDetail: true },
              deepScan: {
                source: 'trip_detail',
                url: window.location.href,
                deliveryTimestampHint: extractUrDeliveryHint(blob),
                issueIndicators: urIssueIndicatorsFromText(blob),
              },
            };
            sendMessageSafe(
              {
                type: 'UBER_RIDES_ORDERS_DETECTED',
                data: [row],
                url: window.location.href,
                extractedAt: new Date().toISOString(),
              },
              'UBER_RIDES_ORDERS_DETECTED deep'
            );
          } catch (e) {
            console.warn('[RefundGuardian] tryUberRidesDetailDeepScan', e);
          }
        }

        function runUberRidesExtractionPass() {
          try {
            if (!isUberRidesOrdersPage()) {
              return;
            }
            try {
              const h = window.location.href;
              if (h !== lastOrdersPageLoggedHrefUr) {
                lastOrdersPageLoggedHrefUr = h;
                console.log('[RefundGuardian] Uber Rides trips / activity context');
              }
            } catch (_) {}

            const merged = extractUberRidesOrders();
            const newOnes = [];
            for (let i = 0; i < merged.length; i++) {
              const row = merged[i];
              const idKey = row.orderId ? String(row.orderId) : '';
              if (!idKey) continue;
              if (sentOrderIdsUr.has(idKey)) continue;
              sentOrderIdsUr.add(idKey);
              newOnes.push(row);
            }

            if (merged.length > 0) {
              console.log('[RefundGuardian] Uber Rides extraction pass: ' + merged.length + ' trip(s) in DOM');
            }

            if (newOnes.length > 0) {
              console.log(
                '[RefundGuardian] Uber Rides: sending ' + newOnes.length + ' new trip(s) to background'
              );
              sendMessageSafe(
                {
                  type: 'UBER_RIDES_ORDERS_DETECTED',
                  data: newOnes,
                  url: window.location.href,
                  extractedAt: new Date().toISOString(),
                },
                'UBER_RIDES_ORDERS_DETECTED'
              );
              scheduleUberRidesDeepInactiveTabs(newOnes);
            }
            tryUberRidesDetailDeepScan();
          } catch (e) {
            console.warn('[RefundGuardian] runUberRidesExtractionPass', e);
          }
        }

        function scheduleUberRidesExtract() {
          try {
            if (debounceTimerUr) clearTimeout(debounceTimerUr);
            debounceTimerUr = setTimeout(function () {
              debounceTimerUr = null;
              try {
                if (window.location.href !== lastUrlUr) {
                  lastUrlUr = window.location.href;
                }
              } catch (_) {}
              runUberRidesExtractionPass();
            }, 700);
          } catch (_) {}
        }

        function attachUberRidesObservers() {
          try {
            if (moUr) {
              moUr.disconnect();
              moUr = null;
            }
            moUr = new MutationObserver(function () {
              if (!isUberRidesOrdersPage()) return;
              scheduleUberRidesExtract();
            });
            const root = document.body || document.documentElement;
            if (root) {
              moUr.observe(root, { childList: true, subtree: true, attributes: false });
            }
          } catch (e) {
            console.warn('[RefundGuardian] Uber Rides MutationObserver attach failed', e);
          }
        }

        function syncUberRidesWatchers() {
          try {
            if (!isUberRidesOrdersPage()) {
              lastOrdersPageLoggedHrefUr = '';
              if (moUr) {
                moUr.disconnect();
                moUr = null;
              }
              return;
            }
            if (!moUr) {
              attachUberRidesObservers();
            }
          } catch (_) {}
        }

        function scheduleUberRidesExtractWithSync() {
          try {
            syncUberRidesWatchers();
          } catch (_) {}
          scheduleUberRidesExtract();
        }

        if (typeof history !== 'undefined') {
          const scheduleUr = function () {
            queueMicrotask(function () {
              sendUberRidesPageVisit('route-change');
              scheduleUberRidesExtractWithSync();
            });
          };
          const origPushUr = history.pushState;
          const origReplaceUr = history.replaceState;
          if (typeof origPushUr === 'function') {
            history.pushState = function () {
              const r = origPushUr.apply(this, arguments);
              scheduleUr();
              return r;
            };
          }
          if (typeof origReplaceUr === 'function') {
            history.replaceState = function () {
              const r = origReplaceUr.apply(this, arguments);
              scheduleUr();
              return r;
            };
          }
          window.addEventListener('popstate', scheduleUr, false);
        }

        sendUberRidesPageVisit('initial');
        scheduleUberRidesExtractWithSync();
        try {
          if (pollTimerUr) clearInterval(pollTimerUr);
          pollTimerUr = setInterval(function () {
            try {
              syncUberRidesWatchers();
              if (!isUberRidesOrdersPage()) return;
              scheduleUberRidesExtract();
            } catch (_) {}
          }, 5000);
        } catch (_) {}

        window.addEventListener(
          'beforeunload',
          function () {
            try {
              if (moUr) moUr.disconnect();
              if (pollTimerUr) clearInterval(pollTimerUr);
              if (debounceTimerUr) clearTimeout(debounceTimerUr);
            } catch (_) {}
          },
          { once: true }
        );
      })();
    }
  } catch (e) {
    console.error('[RefundGuardian] content.js fatal error:', e);
  }
})();
