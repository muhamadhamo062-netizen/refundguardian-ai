# Copies this repo's src/ (and key config) into D:\AI so `npm run dev` there matches Cursor edits.
# Run from repo root: npm run sync:d-ai
param(
  [string]$Destination = "D:\AI"
)

$ErrorActionPreference = "Stop"
$RepoRoot = Resolve-Path (Join-Path $PSScriptRoot "..")

if (-not (Test-Path $Destination)) {
  Write-Error "Destination not found: $Destination — create the folder or pass -Destination."
}

$items = @(
  @{ Src = "src"; Dst = "src" },
  @{ Src = "public"; Dst = "public" },
  @{ Src = "next.config.mjs"; Dst = "next.config.mjs" },
  @{ Src = "next.config.js"; Dst = "next.config.js" },
  @{ Src = "tailwind.config.ts"; Dst = "tailwind.config.ts" },
  @{ Src = "tailwind.config.js"; Dst = "tailwind.config.js" },
  @{ Src = "postcss.config.mjs"; Dst = "postcss.config.mjs" },
  @{ Src = "postcss.config.js"; Dst = "postcss.config.js" },
  @{ Src = "tsconfig.json"; Dst = "tsconfig.json" },
  @{ Src = "package.json"; Dst = "package.json" },
  @{ Src = "package-lock.json"; Dst = "package-lock.json" }
)

foreach ($item in $items) {
  $from = Join-Path $RepoRoot $item.Src
  $to = Join-Path $Destination $item.Dst
  if (-not (Test-Path $from)) { continue }
  if (Test-Path $from -PathType Container) {
    New-Item -ItemType Directory -Force -Path (Split-Path $to -Parent) | Out-Null
    & robocopy $from $to /E /XD node_modules .next /NFL /NDL /NJH /NJS /NP | Out-Null
    if ($LASTEXITCODE -ge 8) { exit $LASTEXITCODE }
  } else {
    New-Item -ItemType Directory -Force -Path (Split-Path $to -Parent) | Out-Null
    Copy-Item -Force $from $to
  }
}

Write-Host "Synced repo -> $Destination. Next: cd $Destination; Remove-Item -Recurse -Force .next; npm run dev"
