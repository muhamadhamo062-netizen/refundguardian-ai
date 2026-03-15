// RefundGuardian AI - Background service worker (Manifest v3)
// Listens for order data from content script and sends to backend

const API_BASE = 'http://localhost:3000';

chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
  if (message.type === 'ORDER_DETECTED') {
    const payload = message.payload || {};
    chrome.storage.local.get(['accessToken'], (stored) => {
      const token = stored.accessToken;
      const headers = { 'Content-Type': 'application/json' };
      if (token) headers['Authorization'] = 'Bearer ' + token;
      fetch(`${API_BASE}/api/orders`, {
        method: 'POST',
        headers,
        body: JSON.stringify(payload),
      })
      .then((res) => res.json())
      .then((data) => sendResponse({ ok: true, data }))
      .catch((err) => sendResponse({ ok: false, error: err.message }));
      });
    return true;
  }
  if (message.type === 'PAGE_VISIT') {
    const { url, provider } = message;
    chrome.storage.local.set({ lastOrderPage: { url, provider, at: Date.now() } });
    sendResponse({ ok: true });
    return true;
  }
  return false;
});
