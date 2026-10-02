$ErrorActionPreference = 'Stop'
$appPath = Join-Path $PSScriptRoot 'app'
if (!(Test-Path -LiteralPath (Join-Path $appPath 'package.json'))) { $appPath = Split-Path $PSScriptRoot -Parent }
if (!(Test-Path -LiteralPath (Join-Path $appPath 'package.json'))) { throw 'The InvoiceFlow app folder is missing.' }
$statePath = Join-Path $appPath '.runtime\launcher.json'
if (Test-Path -LiteralPath $statePath) {
    $state = Get-Content -LiteralPath $statePath -Raw | ConvertFrom-Json
    try {
        $status = Invoke-RestMethod -Uri ($state.controlUrl + '/status') -Headers @{Authorization = 'Bearer ' + $state.token} -TimeoutSec 3
        if ($status.ready -and $status.root -eq $appPath) { Write-Host 'InvoiceFlow is already running: http://127.0.0.1:5175'; exit 0 }
        if ($status.root -eq $appPath) { Write-Host 'InvoiceFlow is still starting. Please wait and open Open InvoiceFlow.url.'; exit 0 }
    } catch {}
}
$nodeCommand = Get-Command node.exe -ErrorAction SilentlyContinue
$bundledNode = Join-Path $env:USERPROFILE '.cache\codex-runtimes\codex-primary-runtime\dependencies\node\bin\node.exe'
$nodePath = if ($nodeCommand) { $nodeCommand.Source } elseif (Test-Path -LiteralPath $bundledNode) { $bundledNode } else { throw 'Install Node.js 22 or newer, then try again.' }
if (!(Test-Path -LiteralPath (Join-Path $appPath 'node_modules\@prisma\client'))) {
    $pnpmCommand = Get-Command pnpm.cmd -ErrorAction SilentlyContinue
    $bundledPnpm = Join-Path $env:USERPROFILE '.cache\codex-runtimes\codex-primary-runtime\dependencies\bin\fallback\pnpm.cmd'
    $pnpmPath = if ($pnpmCommand) { $pnpmCommand.Source } elseif (Test-Path -LiteralPath $bundledPnpm) { $bundledPnpm } else { throw 'Install pnpm 11.19.0, then try again.' }
    Push-Location $appPath
    try { & $pnpmPath install --frozen-lockfile; if ($LASTEXITCODE -ne 0) { throw 'Dependency installation failed.' }; & $pnpmPath db:generate; if ($LASTEXITCODE -ne 0) { throw 'Prisma generation failed.' } } finally { Pop-Location }
}
if (!(Test-Path -LiteralPath (Join-Path $appPath '.env'))) { Copy-Item -LiteralPath (Join-Path $appPath '.env.example') -Destination (Join-Path $appPath '.env') }
$runtimePath = Join-Path $appPath '.runtime'
New-Item -ItemType Directory -Path $runtimePath -Force | Out-Null
$launchScript = Join-Path $appPath 'scripts\launch-local.mjs'
Start-Process -FilePath $nodePath -ArgumentList ('"' + $launchScript + '"') -WorkingDirectory $appPath -WindowStyle Hidden -RedirectStandardOutput (Join-Path $runtimePath 'startup.log') -RedirectStandardError (Join-Path $runtimePath 'errors.log') | Out-Null
for ($attempt = 0; $attempt -lt 180; $attempt++) {
    Start-Sleep -Seconds 1
    if (Test-Path -LiteralPath $statePath) {
        try {
            $state = Get-Content -LiteralPath $statePath -Raw | ConvertFrom-Json
            $status = Invoke-RestMethod -Uri ($state.controlUrl + '/status') -Headers @{Authorization = 'Bearer ' + $state.token} -TimeoutSec 2
            if ($status.ready -and $status.root -eq $appPath) { Write-Host 'InvoiceFlow is ready. Open Open InvoiceFlow.url or visit http://127.0.0.1:5175'; exit 0 }
        } catch {}
    }
}
throw 'InvoiceFlow did not start. See app\.runtime\startup.log and errors.log.'
