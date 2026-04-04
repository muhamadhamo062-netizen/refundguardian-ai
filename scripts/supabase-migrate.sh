#!/usr/bin/env bash
# RefundGuardian — run all Supabase migrations (including 013 default seed for new users)
# Usage:
#   npm run db:migrate
#   SKIP_LINK=1 npm run db:migrate          # skip link attempt (already linked)
#   SUPABASE_PROJECT_REF=xxx npm run db:migrate   # non-interactive link first

set -euo pipefail

echo "Starting RefundGuardian migrations..."

if ! command -v supabase >/dev/null 2>&1; then
  echo "❌ Supabase CLI not found."
  echo "   Install: https://supabase.com/docs/guides/cli/getting-started"
  echo "   Examples: npm i -g supabase | brew install supabase/tap/supabase | scoop install supabase"
  exit 1
fi

echo "✅ Supabase CLI: $(supabase --version)"

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

if [[ "${SKIP_LINK:-0}" != "1" ]]; then
  if [[ -n "${SUPABASE_PROJECT_REF:-}" ]]; then
    echo "Linking project (SUPABASE_PROJECT_REF)..."
    supabase link --project-ref "${SUPABASE_PROJECT_REF}" || {
      echo "⚠️  supabase link failed — if already linked, set SKIP_LINK=1 and re-run."
      exit 1
    }
  else
    if [[ ! -f supabase/config.toml ]]; then
      echo "⚠️  No supabase/config.toml — link this repo to your Supabase project once:"
      echo "   supabase login"
      echo "   supabase link --project-ref <your-project-ref>"
      echo "   Or: SUPABASE_PROJECT_REF=<ref> npm run db:migrate"
      exit 1
    fi
    echo "ℹ️  Using existing supabase/config.toml (project linked)."
  fi
else
  echo "ℹ️  SKIP_LINK=1 — not running supabase link."
fi

echo ""
echo "Pushing migrations (supabase db push)..."
if supabase db push; then
  echo ""
  echo "✅ All RefundGuardian migrations applied successfully!"
  echo "   New users will automatically receive default orders for Amazon, Uber Eats, Uber, and DoorDash (migration 013)."
  echo ""
  echo "Local migration SQL files:"
  ls -1 supabase/migrations/*.sql 2>/dev/null | sort || true
  exit 0
fi

echo ""
echo "❌ Migration failed. Check Supabase CLI output and https://supabase.com/docs/guides/cli/troubleshooting"
exit 1
