# RefundGuardian AI – Chrome Extension

Manifest v3 extension that runs in the background and detects when you visit order or delivery pages (Amazon, Uber, Uber Eats, DoorDash, Grubhub). It sends order data to the backend so the system can detect delays and request compensation on your behalf.

## Setup

1. In Chrome, go to `chrome://extensions/`, enable **Developer mode**, click **Load unpacked**, and select this `extension` folder.
2. Log in at the RefundGuardian AI dashboard (Google login).
3. On the dashboard, click **Copy token for extension**.
4. Click the RefundGuardian AI extension icon and paste the token, then **Save token**.

Orders from supported sites will be sent to the backend when you visit order/delivery pages. Ensure the app is running (e.g. `npm run dev` on port 3000) or use your deployed Vercel URL in `background.js` for production.
