$ErrorActionPreference = 'Stop'

$appDir = Join-Path $PSScriptRoot 'bewerbung-studio'
$packageJson = Join-Path $appDir 'package.json'
$electronExe = Join-Path $appDir 'node_modules\electron\dist\electron.exe'

if (-not (Test-Path -LiteralPath $packageJson)) {
    throw "Application not found: $packageJson"
}
if (-not (Test-Path -LiteralPath $electronExe)) {
    throw "Electron not found. Run 'npm ci' in $appDir first."
}

# Stop only this checkout's Electron app and Vite server, regardless of Vite's port.
$processes = Get-CimInstance Win32_Process
$projectProcesses = @($processes | Where-Object {
    ($_.Name -ieq 'electron.exe' -and $_.ExecutablePath -ieq $electronExe) -or
    ($_.Name -ieq 'node.exe' -and
        $_.CommandLine -like "*$appDir*" -and
        $_.CommandLine -match 'vite[\\/]bin[\\/]vite\.(?:js|mjs)')
})

foreach ($process in $projectProcesses) {
    Write-Host "Stopping $($process.Name) (PID $($process.ProcessId))..."
    Stop-Process -Id $process.ProcessId -Force -ErrorAction SilentlyContinue
}

Push-Location $appDir
try {
    Write-Host 'Building BewerbungsManager...'
    & npm.cmd run build
    if ($LASTEXITCODE -ne 0) {
        throw "Build failed (exit code $LASTEXITCODE)."
    }

    # A production build loads dist/index.html, not a previous Vite server.
    Remove-Item Env:VITE_DEV_SERVER_URL -ErrorAction SilentlyContinue
    Write-Host 'Starting BewerbungsManager...'
    $appProcess = Start-Process -FilePath $electronExe -ArgumentList '.' -WorkingDirectory $appDir -PassThru
    Write-Host "Started (PID $($appProcess.Id))."
}
finally {
    Pop-Location
}
