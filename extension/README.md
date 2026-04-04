# RefundGuardian AI – Chrome Extension

Manifest v3 extension that runs in the background and detects when you visit order or delivery pages (Amazon, Uber, Uber Eats, DoorDash, Grubhub). It sends order data to the backend so the system can detect delays and request compensation on your behalf.

## Setup

1. In Chrome, go to `chrome://extensions/`, enable **Developer mode**, click **Load unpacked**, and select this `extension` folder.
2. Log in at the RefundGuardian AI dashboard (email/password).
3. On the dashboard, click **Copy token for extension**.
4. Click the RefundGuardian AI extension icon and paste the token, then **Save token**.

Orders from supported sites will be sent to the backend when you visit order/delivery pages. Ensure the app is running (e.g. `npm run dev` on port 3000) or use your deployed Vercel URL in `background.js` for production.

## Automatic background scanning (v1.1.9+)

After the dashboard saves your **access token** (`SET_ACCESS_TOKEN`), the service worker registers **alarms** (requires `alarms` permission):

- **Kickoff:** first inactive-tab scan for all four merchant list URLs after ~12 minutes (one-shot).
- **Periodic:** repeats every **6 hours**, opening **four inactive background tabs** (Amazon order history, Uber Eats orders, Uber trips, DoorDash orders) so `content.js` can run without you manually opening each site every time.

**Important (Chrome / security):** The extension cannot read merchant DOM or cookies **without a tab** on that origin. Background scanning therefore **opens inactive tabs** on a schedule — not “invisible server-side HTTP” to Amazon/Uber. **Deep** per-order detail (every line item, every receipt URL) depends on what each platform exposes on the pages our scripts handle; it is **not** guaranteed to crawl unlimited detail for every order without visiting additional URLs.

**Debounce:** Re-registering alarms is limited to once per 5 minutes so repeated token pushes from the dashboard do not reset schedules constantly.

## Local testing (dashboard)

The extension injects `content.js` on **`http://localhost:3000/*`** and **`http://127.0.0.1:3000/*`** only (see `manifest.json`). On those URLs:

- Console shows **`🟡 RefundGuardian TEST MODE ACTIVE`** and a yellow **RefundGuardian TEST** badge.
- `PAGE_VISIT` is stored under **`lastDevPageTest`** in `chrome.storage.local` — not the production **`lastOrderPage`** key used for Amazon.

After **any** `manifest.json` change: `chrome://extensions` → **Reload** on RefundGuardian AI, then **hard-refresh** the page (Ctrl+Shift+R).

### If content script logs never appear

1. Confirm **Errors** on the extension card (fix manifest until none).
2. **Reload** the extension, then reload the tab.
3. Open DevTools **Console** on the **page** (not only the service worker) — look for `[RefundGuardian]` and `🔥 RefundGuardian AI Injected Successfully`.
4. Ensure the URL matches `manifest` patterns (e.g. `https://www.amazon.com/...`, `http://localhost:3000/...`).

## Console warnings on Amazon (not caused by this extension)

RefundGuardian AI does not send requests to:

- `/suggestions`
- Amazon autocomplete endpoints
- Any search suggestion APIs

If you see errors like:

`HEAD https://www.amazon.eg/suggestions 405`

This is coming from Amazon’s internal scripts or other browser extensions, not from RefundGuardian.

### How to verify

- Open Incognito mode with only this extension enabled
- Disable other extensions temporarily
- Reproduce the page
