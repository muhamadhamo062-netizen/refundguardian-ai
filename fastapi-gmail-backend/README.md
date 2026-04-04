# Gmail Order Monitor (FastAPI)

Python **FastAPI** backend with a **mobile-friendly HTML** (Jinja2) frontend:

- Gmail **IMAP** using **App Password** (encrypted at rest with **AES/Fernet**).
- Search only these senders:
  - `auto-confirm@amazon.com`
  - `no-reply@uber.com`
  - `noreply@uber-eats.com`
  - `orders@doordash.com`
- Extract **Order Date** and **Delivery Time** (heuristics + optional OpenAI when ambiguous).
- **OpenAI**: if delay **> 15 minutes**, generate a **unique US English complaint letter**.
- **Per-user** SQLite/PostgreSQL data; JWT auth; users only see **their own** orders and letters.

## Security

- **Never** commit `.env` or real API keys.
- **Never** paste OpenAI keys into chat or source control. If a key was exposed, **rotate it** in the [OpenAI dashboard](https://platform.openai.com/api-keys) immediately.
- Set `OPENAI_API_KEY` only in environment variables (local `.env` / host dashboard).

## Local setup

```bash
cd fastapi-gmail-backend
python -m venv .venv
.venv\Scripts\activate          # Windows
# source .venv/bin/activate     # macOS/Linux

pip install -r requirements.txt
copy .env.example .env          # Windows: copy; then edit .env
```

Fill in `.env`:

1. `APP_ENCRYPTION_KEY` — run:
   ```bash
   python -c "from cryptography.fernet import Fernet; print(Fernet.generate_key().decode())"
   ```
2. `SECRET_KEY` — long random string.
3. `OPENAI_API_KEY` — your key from OpenAI (no quotes in `.env`).

Run:

```bash
uvicorn app.main:app --reload --host 0.0.0.0 --port 8000
```

Open **http://127.0.0.1:8000** — register, add Gmail + App Password on the dashboard, then **Scan Gmail now**.

### Mobile (same Wi‑Fi)

Use your PC’s LAN IP, e.g. `http://192.168.1.10:8000`, and ensure the firewall allows port 8000.

## Production deployment (recommended)

**FastAPI** is best suited to **containers** or **Python hosts** (not the same as a Next.js static deploy):

| Platform | Notes |
|----------|--------|
| [Render](https://render.com/) | Web Service, `build: pip install -r requirements.txt`, `start: uvicorn app.main:app --host 0.0.0.0 --port $PORT` |
| [Railway](https://railway.app/) | Same; set env vars in dashboard |
| [Fly.io](https://fly.io/) | Dockerfile optional |

Set **`DATABASE_URL`** to PostgreSQL for production (Render/Railway provide a URL).  
Set **`SECRET_KEY`**, **`APP_ENCRYPTION_KEY`**, **`OPENAI_API_KEY`**, and use **HTTPS**; then set cookie `secure=True` in `app/routers/auth.py` for production.

### Vercel (serverless)

Vercel is **Node-first**; Python runs as **serverless functions** with **short timeouts** and **no long-lived IMAP** ideal for heavy scans. If you still want to try:

1. Add a Mangum (or similar) ASGI adapter and a single serverless entry.
2. Keep **IMAP scan** on a **background worker** or **cron** elsewhere, or accept timeouts.

**Practical recommendation:** deploy this API to **Render/Railway** and point your mobile PWA or web app at that URL.

## API summary

| Method | Path | Description |
|--------|------|-------------|
| POST | `/api/auth/register` | Register + sets cookie |
| POST | `/api/auth/login` | Login + sets cookie |
| POST | `/api/auth/logout` | Clears cookie |
| POST | `/api/gmail/connect` | Save encrypted Gmail App Password |
| POST | `/api/gmail/scan` | IMAP fetch + parse + OpenAI letters |
| GET | `/api/orders` | List current user’s orders |
| GET | `/api/orders/{id}` | One order |
| PATCH | `/api/orders/{id}` | Update letter / status |
| DELETE | `/api/orders/{id}` | Delete |

Browser pages: `/`, `/register`, `/dashboard` (cookie auth).

## Environment variables (checklist)

| Variable | Required | Purpose |
|----------|----------|---------|
| `APP_ENCRYPTION_KEY` | Yes | Fernet key for Gmail App Password storage |
| `SECRET_KEY` | Yes | JWT signing |
| `OPENAI_API_KEY` | Yes | Delay analysis + complaint letters |
| `OPENAI_MODEL` | No | Default `gpt-4o-mini` |
| `DATABASE_URL` | No | Default SQLite file |

On **Vercel** (if used): Project → Settings → Environment Variables — add the same keys for Production / Preview / Development.

## License

Example project scaffold — adapt for your product.
