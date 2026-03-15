# RefundGuardian AI

Production-ready web application that uses AI to detect delivery delays and file refund claims automatically.

## Tech Stack

- **Next.js 14** (App Router)
- **Tailwind CSS**
- **Supabase** (Auth, Database)

## Getting Started

### 1. Environment variables

Copy the example env file and add your Supabase credentials:

```bash
cp .env.local.example .env.local
```

Edit `.env.local` and set:

- `NEXT_PUBLIC_SUPABASE_URL` – your Supabase project URL
- `NEXT_PUBLIC_SUPABASE_ANON_KEY` – your Supabase anon/public key

### 2. Supabase setup

1. Create a project at [supabase.com](https://supabase.com).
2. Enable **Google** in Authentication → Providers.
3. In the SQL Editor, run the migration script: `supabase/migrations/001_initial_schema.sql`
4. Add your site URL and redirect URL in Authentication → URL Configuration (e.g. `http://localhost:3000` and `http://localhost:3000/auth/callback`).

### 3. Install and run

```bash
npm install
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

## Project structure

- `src/app/` – App Router pages and layouts
- `src/components/` – Reusable UI (layout, landing, dashboard)
- `src/lib/supabase/` – Supabase client (browser, server, middleware)
- `src/app/actions/` – Server actions (e.g. auth)
- `supabase/migrations/` – Database schema and RLS

## Pages

- **Landing** (`/`) – Hero, How It Works, Pricing, Footer
- **Login** (`/login`) – Google sign-in only
- **Dashboard** (`/dashboard`) – Total Recovered counter, Guardians, Activity Feed, Scan Last 30 Days
- **Refund History** (`/dashboard/refund-history`) – Table of recovered refunds
- **Pricing** (`/pricing`) – Three pricing cards

## Database tables

- `users` – Profile (synced from Supabase Auth)
- `receipts` – Orders/deliveries from connected sources
- `claims` – Refund claims filed by the system
- `refund_history` – Completed refunds for reporting
- `notifications` – In-app notifications
- `subscriptions` – Billing/subscription state

All tables use RLS and indexes for scalability.

## Build

```bash
npm run build
npm start
```
