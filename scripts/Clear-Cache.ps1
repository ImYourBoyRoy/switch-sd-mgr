# ./scripts/Clear-Cache.ps1
<#
Purpose: Clean Rust/Vite/Tauri caches with a normal mode for day-to-day maintenance and an optional deep purge mode.
How to run:
  powershell -ExecutionPolicy Bypass -File ./scripts/Clear-Cache.ps1
  powershell -ExecutionPolicy Bypass -File ./scripts/Clear-Cache.ps1 -Deep
Outputs: Reclaims disk space and resets build caches without forcing node_modules removal unless explicitly requested.
#>

[CmdletBinding()]
param(
    [Alias('h')]
    [switch]$Help,
    [switch]$Deep
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

$ScriptDirectory = Get-ScriptDirectory
$ProjectRoot = (Resolve-Path -Path (Join-Path -Path $ScriptDirectory -ChildPath '..')).Path

if ($Help) {
    Write-Host 'Switch SD Updater cache cleanup script' -ForegroundColor Cyan
    Write-Host 'Usage:' -ForegroundColor Gray
    Write-Host '  powershell -ExecutionPolicy Bypass -File .\scripts\Clear-Cache.ps1' -ForegroundColor Gray
    Write-Host '  powershell -ExecutionPolicy Bypass -File .\scripts\Clear-Cache.ps1 -Deep' -ForegroundColor Gray
    exit 0
}

Write-Host "--- SD Updater Cache Cleanup ---" -ForegroundColor Cyan

if (Get-Command cargo -ErrorAction SilentlyContinue) {
    Write-Host "Running cargo clean..." -ForegroundColor Gray
    cargo clean --manifest-path (Join-Path $ProjectRoot 'src-tauri\Cargo.toml')
}

$Targets = @(
    'dist',
    'build_portable',
    'data\temp',
    'src-tauri\target'
)

if ($Deep) {
    $Targets += @(
        'node_modules',
        'package-lock.json'
    )
}

foreach ($target in $Targets) {
    $path = Join-Path $ProjectRoot $target
    if (Test-Path $path) {
        Write-Host "Removing: $path" -ForegroundColor Gray
        Remove-Item -Path $path -Recurse -Force -ErrorAction SilentlyContinue
    }
}

$junkFiles = Get-ChildItem -Path $ProjectRoot -Recurse -Force -ErrorAction SilentlyContinue |
    Where-Object {
        $_.Name -in @('Thumbs.db', '.DS_Store', 'clippy_errors.txt') -or
        $_.Name -like '*.pdb' -or
        $_.Name -like '*.log' -or
        $_.Name -eq '__pycache__'
    }

foreach ($item in $junkFiles) {
    Write-Host "Removing junk: $($item.FullName)" -ForegroundColor Gray
    Remove-Item -Path $item.FullName -Recurse -Force -ErrorAction SilentlyContinue
}

Write-Host "--- Cleanup complete ---" -ForegroundColor Green
