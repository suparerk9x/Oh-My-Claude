# Oh-My-Claude — safe restart via PM2 (the supervisor).
# PM2 manages a SINGLE instance by app name, so this can never spawn a duplicate, and it never
# matches processes by 'server.js' (that pattern also hits other projects' Next.js servers).
#   .\restart-safe.ps1          restart backend only
#   .\restart-safe.ps1 -Build   rebuild the frontend first, then restart (use after UI changes)
param([switch]$Build)

$ROOT  = $PSScriptRoot
$PORT  = 4825

if ($Build) {
  Write-Host "Building frontend..."
  Push-Location (Join-Path $ROOT 'frontend')
  & npm run build
  Pop-Location
}

# Start if not present, otherwise restart. Either way PM2 keeps exactly one instance.
$running = (& pm2 jlist | Out-String) -match 'omc-backend'
if ($running) { & pm2 restart omc-backend } else { & pm2 start (Join-Path $ROOT 'backend\ecosystem.config.cjs') }
& pm2 save

Start-Sleep -Seconds 5
try {
  $u = (Invoke-WebRequest -Uri "http://localhost:$PORT/api/usage" -TimeoutSec 6 -UseBasicParsing).Content | ConvertFrom-Json
  Write-Host ("OK ${PORT} — 5h={0}%  7d={1}%  lastSync={2}" -f $u.five_hour.utilization, $u.seven_day.utilization, $u.lastSync)
} catch { Write-Host "WARN: backend not answering on ${PORT} yet — check: pm2 logs omc-backend" }
