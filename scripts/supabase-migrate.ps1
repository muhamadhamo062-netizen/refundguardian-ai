# RefundGuardian — run all Supabase migrations (including 013 default seed for new users)
# Usage: npm run db:migrate:win
# Env: $env:SKIP_LINK="1"  |  $env:SUPABASE_PROJECT_REF="your-ref"

$ErrorActionPreference = "Stop"

Write-Host "Starting RefundGuardian migrations..."

$supabase = Get-Command supabase -ErrorAction SilentlyContinue
if (-not $supabase) {
  Write-Host "❌ Supabase CLI not found."
  Write-Host "   Install: https://supabase.com/docs/guides/cli/getting-started"
  exit 1
}

Write-Host "✅ Supabase CLI: $(supabase --version)"

$root = Split-Path $PSScriptRoot -Parent
Set-Location $root

if ($env:SKIP_LINK -ne "1") {
  if ($env:SUPABASE_PROJECT_REF) {
    Write-Host "Linking project (SUPABASE_PROJECT_REF)..."
    supabase link --project-ref $env:SUPABASE_PROJECT_REF
  } else {
    $config = Join-Path $root "supabase\config.toml"
    if (-not (Test-Path $config)) {
      Write-Host "⚠️  No supabase\config.toml — link this repo to your Supabase project once:"
      Write-Host "   supabase login"
      Write-Host "   supabase link --project-ref <your-project-ref>"
      Write-Host "   Or set `$env:SUPABASE_PROJECT_REF and re-run."
      exit 1
    }
    Write-Host "ℹ️  Using existing supabase\config.toml (project linked)."
  }
} else {
  Write-Host "ℹ️  SKIP_LINK=1 — not running supabase link."
}

Write-Host ""
Write-Host "Pushing migrations (supabase db push)..."
supabase db push
if ($LASTEXITCODE -eq 0) {
  Write-Host ""
  Write-Host "✅ All RefundGuardian migrations applied successfully!"
  Write-Host "   New users will automatically receive default orders for Amazon, Uber Eats, Uber, and DoorDash (migration 013)."
  Write-Host ""
  Write-Host "Local migration SQL files:"
  Get-ChildItem -Path (Join-Path $root "supabase\migrations") -Filter "*.sql" | Sort-Object Name | ForEach-Object { $_.FullName }
  exit 0
}

Write-Host ""
Write-Host "❌ Migration failed. Check Supabase CLI output."
exit 1
