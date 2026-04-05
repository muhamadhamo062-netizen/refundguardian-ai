/**
 * Cross-platform runner: bash (scripts/supabase-migrate.sh) on Unix / Git Bash,
 * PowerShell (scripts/supabase-migrate.ps1) on Windows.
 */
const { spawnSync } = require('child_process');
const path = require('path');

const root = path.join(__dirname, '..');
const isWin = process.platform === 'win32';

const cmd = isWin
  ? {
      exe: 'powershell.exe',
      args: ['-NoProfile', '-ExecutionPolicy', 'Bypass', '-File', path.join(root, 'scripts', 'supabase-migrate.ps1')],
    }
  : {
      exe: 'bash',
      args: [path.join(root, 'scripts', 'supabase-migrate.sh')],
    };

const r = spawnSync(cmd.exe, cmd.args, { stdio: 'inherit', cwd: root, env: process.env });
process.exit(r.status === null ? 1 : r.status);
