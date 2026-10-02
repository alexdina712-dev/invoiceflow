$ErrorActionPreference = 'Stop'
$appPath = Join-Path $PSScriptRoot 'app'
if (!(Test-Path -LiteralPath (Join-Path $appPath 'package.json'))) { $appPath = Split-Path $PSScriptRoot -Parent }
if (!(Test-Path -LiteralPath (Join-Path $appPath 'package.json'))) { throw 'The InvoiceFlow app folder is missing.' }
$statePath = Join-Path $appPath '.runtime\launcher.json'
if (!(Test-Path -LiteralPath $statePath)) { Write-Host 'InvoiceFlow is already stopped.'; exit 0 }
$state = Get-Content -LiteralPath $statePath -Raw | ConvertFrom-Json
if ($state.root -ne $appPath) { throw 'Launcher state does not belong to this app folder.' }
Invoke-RestMethod -Method Post -Uri ($state.controlUrl + '/stop') -Headers @{Authorization = 'Bearer ' + $state.token} -TimeoutSec 30 | Out-Null
for ($attempt = 0; $attempt -lt 30; $attempt++) { if (!(Test-Path -LiteralPath $statePath)) { Write-Host 'InvoiceFlow stopped safely. Your database has been kept.'; exit 0 }; Start-Sleep -Seconds 1 }
throw 'InvoiceFlow is still shutting down. Check the runtime logs.'
