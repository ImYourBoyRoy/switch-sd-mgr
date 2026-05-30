# ./scripts/build.ps1
<#
Purpose: Build and verify the portable Switch SD Updater desktop bundle with optional clean/smoke-test modes.
How to run:
  powershell -ExecutionPolicy Bypass -File ./scripts/build.ps1
  powershell -ExecutionPolicy Bypass -File ./scripts/build.ps1 -Mode Clean
  powershell -ExecutionPolicy Bypass -File ./scripts/build.ps1 -Mode Smoke
Outputs: A clean portable bundle in ./build_portable plus optional smoke-test validation output.
#>

[CmdletBinding()]
param(
    [Alias('h')]
    [switch]$Help,
    [ValidateSet('Build', 'Clean', 'Smoke', 'Purge')]
    [string]$Mode = 'Build'
)

$ErrorActionPreference = 'Stop'

function Convert-ToNativePath {
    param([Parameter(Mandatory = $true)][string]$PathText)

    $normalized = $PathText -replace '^Microsoft\.PowerShell\.Core\\FileSystem::', ''
    if ($normalized -like '\\?\*') {
        $normalized = $normalized.Substring(4)
    }
    return $normalized
}

function Get-ScriptDirectory {
    if ($PSScriptRoot) {
        return Convert-ToNativePath $PSScriptRoot
    }
    if ($MyInvocation.MyCommand.Path) {
        return Convert-ToNativePath (Split-Path -Parent $MyInvocation.MyCommand.Path)
    }
    return Convert-ToNativePath ((Get-Location).Path)
}

$scriptDirectory = Get-ScriptDirectory

$repoRoot = (Resolve-Path -Path (Join-Path -Path $scriptDirectory -ChildPath '..')).Path
$buildDir = Join-Path $repoRoot 'build_portable'
$configsDir = if (Test-Path (Join-Path $repoRoot 'configs')) { Join-Path $repoRoot 'configs' } else { Join-Path $repoRoot 'build\configs' }
$customDir = if (Test-Path (Join-Path $repoRoot 'Custom_stuff')) { Join-Path $repoRoot 'Custom_stuff' } else { Join-Path $repoRoot 'build\Custom_stuff' }
$iconsDir = Join-Path $repoRoot 'icons'
$tauriIconsDir = Join-Path $repoRoot 'src-tauri\icons'
$tauriExe = Join-Path $repoRoot 'src-tauri\target\release\switch-sd-mgr.exe'
$portableExe = Join-Path $buildDir 'Switch_SD_Updater.exe'

if ($Help) {
    Write-Host 'Switch SD Updater portable build script' -ForegroundColor Cyan
    Write-Host 'Usage:' -ForegroundColor Gray
    Write-Host '  powershell -ExecutionPolicy Bypass -File .\scripts\build.ps1' -ForegroundColor Gray
    Write-Host '  powershell -ExecutionPolicy Bypass -File .\scripts\build.ps1 -Mode Clean' -ForegroundColor Gray
    Write-Host '  powershell -ExecutionPolicy Bypass -File .\scripts\build.ps1 -Mode Smoke' -ForegroundColor Gray
    Write-Host '  powershell -ExecutionPolicy Bypass -File .\scripts\build.ps1 -Mode Purge' -ForegroundColor Gray
    exit 0
}

function Sync-ProjectIcons {
    if (-not (Test-Path $iconsDir)) {
        return
    }

    foreach ($iconName in @('32x32.png', '128x128.png', '128x128@2x.png', 'icon.ico', 'icon.png')) {
        $source = Join-Path $iconsDir $iconName
        $dest = Join-Path $tauriIconsDir $iconName
        if (Test-Path $source) {
            Copy-Item $source $dest -Force
        }
    }
}

function Invoke-SmokeTest {
    Write-Host '--- Portable smoke test ---' -ForegroundColor Cyan
    $requiredPaths = @(
        $portableExe,
        (Join-Path $buildDir 'configs'),
        (Join-Path $buildDir 'Custom_stuff'),
        (Join-Path $buildDir 'SD'),
        (Join-Path $buildDir 'RCMLoader'),
        (Join-Path $buildDir 'configs\manifest.lock')
    )

    foreach ($requiredPath in $requiredPaths) {
        if (-not (Test-Path $requiredPath)) {
            throw "Smoke test failed. Missing expected path: $requiredPath"
        }
    }

    $manifestPath = Join-Path $buildDir 'configs\manifest.lock'
    $manifestContent = Get-Content $manifestPath -Raw
    if ($manifestContent.Trim() -ne '{}') {
        throw "Smoke test failed. Expected a reset manifest at $manifestPath"
    }

    if (Test-Path (Join-Path $buildDir 'portable_settings.json')) {
        throw 'Smoke test failed. Legacy portable_settings.json should not be shipped.'
    }

    if (Test-Path (Join-Path $buildDir 'configs\configs')) {
        throw 'Smoke test failed. Nested configs\configs directory detected.'
    }

    if (Test-Path (Join-Path $buildDir 'Custom_stuff\Custom_stuff')) {
        throw 'Smoke test failed. Nested Custom_stuff\Custom_stuff directory detected.'
    }

    Write-Host '[SUCCESS] Portable smoke test passed.' -ForegroundColor Green
}

function Reset-BuildOutput {
    if (Test-Path $buildDir) {
        Remove-Item $buildDir -Recurse -Force -ErrorAction SilentlyContinue
    }
    New-Item -ItemType Directory -Path $buildDir -Force | Out-Null
}

function Assert-PortableSeedFiles {
    $requiredSeedFiles = @(
        (Join-Path $configsDir 'config.json'),
        (Join-Path $configsDir 'switch_configs.json'),
        (Join-Path $configsDir 'hosts_config.json'),
        (Join-Path $configsDir 'sources.json')
    )

    foreach ($seedFile in $requiredSeedFiles) {
        if (-not (Test-Path $seedFile)) {
            throw "Portable seed file missing: $seedFile"
        }
    }
}

if ($Mode -eq 'Purge') {
    Write-Host '--- Purging build output only ---' -ForegroundColor Cyan
    if (Test-Path $buildDir) {
        Remove-Item $buildDir -Recurse -Force -ErrorAction SilentlyContinue
    }
    Write-Host '[SUCCESS] Removed build_portable output.' -ForegroundColor Green
    exit 0
}

if ($Mode -eq 'Clean') {
    Write-Host '--- Running clean build ---' -ForegroundColor Cyan
    cargo clean --manifest-path (Join-Path $repoRoot 'src-tauri\Cargo.toml')
}

Sync-ProjectIcons
Reset-BuildOutput
Assert-PortableSeedFiles

Write-Host '--- Building portable SD Updater workspace ---' -ForegroundColor Cyan
npm run build
npm run tauri build

if (-not (Test-Path $tauriExe)) {
    throw "Tauri desktop executable not found at $tauriExe"
}

Copy-Item $tauriExe $portableExe -Force
if (-not (Test-Path $configsDir)) {
    throw "Portable configs source not found at $configsDir"
}
if (-not (Test-Path $customDir)) {
    throw "Portable Custom_stuff source not found at $customDir"
}
Copy-Item $configsDir (Join-Path $buildDir 'configs') -Recurse -Force
Copy-Item $customDir (Join-Path $buildDir 'Custom_stuff') -Recurse -Force
New-Item -ItemType Directory -Path (Join-Path $buildDir 'SD') -Force | Out-Null
New-Item -ItemType Directory -Path (Join-Path $buildDir 'RCMLoader') -Force | Out-Null

$defaultSourcesPath = Join-Path $buildDir 'configs\sources.defaults.json'
$activeSourcesPath = Join-Path $buildDir 'configs\sources.json'
if (Test-Path $activeSourcesPath) {
    Copy-Item $activeSourcesPath $defaultSourcesPath -Force
}

$legacySettings = Join-Path $buildDir 'portable_settings.json'
if (Test-Path $legacySettings) {
    Remove-Item $legacySettings -Force -ErrorAction SilentlyContinue
}

$manifestPath = Join-Path $buildDir 'configs\manifest.lock'
if (Test-Path $manifestPath) {
    '{}' | Set-Content $manifestPath
}

$nestedData = Join-Path $buildDir 'configs\configs'
if (Test-Path $nestedData) {
    Remove-Item $nestedData -Recurse -Force
}

$nestedLegacyData = Join-Path $buildDir 'configs\data'
if (Test-Path $nestedLegacyData) {
    Remove-Item $nestedLegacyData -Recurse -Force
}

$nestedCustom = Join-Path $buildDir 'Custom_stuff\Custom_stuff'
if (Test-Path $nestedCustom) {
    Remove-Item $nestedCustom -Recurse -Force
}

Write-Host "[SUCCESS] Portable workspace created at $buildDir" -ForegroundColor Green

if ($Mode -eq 'Smoke') {
    Invoke-SmokeTest
}
