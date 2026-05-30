# ./scripts/set-version.ps1
<#
Purpose: Synchronizes the project version across React (package.json), Rust (Cargo.toml), and Tauri (tauri.conf.json).
How to run: powershell -File ./scripts/set-version.ps1 -Version 7.0.0
Inputs: Target semantic version string.
#>

param(
    [Parameter(Mandatory = $true)]
    [string]$Version
)

$ErrorActionPreference = 'Stop'
$repoRoot = Resolve-Path (Join-Path $PSScriptRoot '..')

if ($Version -notmatch '^\d+\.\d+\.\d+([-.][0-9A-Za-z.-]+)?$') {
    throw "Invalid version '$Version'. Expected semver (e.g. 7.0.0)."
}

Write-Host "--- Syncing Version to $Version ---" -ForegroundColor Cyan

# 1. package.json
$pkgPath = Join-Path $repoRoot "package.json"
if (Test-Path $pkgPath) {
    Write-Host " Updating $pkgPath" -ForegroundColor Gray
    $json = Get-Content $pkgPath | ConvertFrom-Json
    $json.version = $Version
    $json | ConvertTo-Json -Depth 10 | Set-Content $pkgPath
}

# 2. Cargo.toml
$cargoPath = Join-Path $repoRoot "src-tauri/Cargo.toml"
if (Test-Path $cargoPath) {
    Write-Host " Updating $cargoPath" -ForegroundColor Gray
    $content = Get-Content $cargoPath -Raw
    $updated = [regex]::Replace($content, '(?m)^version\s*=\s*"[^"]+"', "version = `"$Version`"")
    $updated | Set-Content $cargoPath
}

# 3. tauri.conf.json
$tauriPath = Join-Path $repoRoot "src-tauri/tauri.conf.json"
if (Test-Path $tauriPath) {
    Write-Host " Updating $tauriPath" -ForegroundColor Gray
    $json = Get-Content $tauriPath | ConvertFrom-Json
    $json.version = $Version
    # Also update bundle version if needed
    $json | ConvertTo-Json -Depth 10 | Set-Content $tauriPath
}

Write-Host "[SUCCESS] Version synchronized." -ForegroundColor Green
