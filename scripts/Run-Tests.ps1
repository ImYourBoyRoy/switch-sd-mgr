# ./scripts/Run-Tests.ps1
<#
Purpose: Runs the full local quality gate for the SD Card Updater.
How to run: powershell -ExecutionPolicy Bypass -File ./scripts/Run-Tests.ps1 [-FullClean]
#>

param(
    [Alias('h')]
    [switch]$Help,
    [switch]$FullClean
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

function Get-HostShellExecutable {
    if ($PSVersionTable.PSEdition -eq 'Core') {
        $pwsh = Get-Command pwsh -ErrorAction SilentlyContinue
        if ($pwsh) {
            return $pwsh.Source
        }
    }
    $powershell = Get-Command powershell -ErrorAction SilentlyContinue
    if ($powershell) {
        return $powershell.Source
    }
    throw 'Could not locate a PowerShell executable for nested script invocation.'
}

$ScriptRoot = Get-ScriptDirectory
$ProjectRoot = (Resolve-Path -Path (Join-Path -Path $ScriptRoot -ChildPath '..')).Path
$ShellExecutable = Get-HostShellExecutable
$ClearScript = Join-Path $ScriptRoot 'Clear-Cache.ps1'
$BuildScript = Join-Path $ScriptRoot 'build.ps1'

if ($Help) {
    Write-Host 'Switch SD Updater quality gate script' -ForegroundColor Cyan
    Write-Host 'Usage:' -ForegroundColor Gray
    Write-Host '  powershell -ExecutionPolicy Bypass -File .\scripts\Run-Tests.ps1' -ForegroundColor Gray
    Write-Host '  powershell -ExecutionPolicy Bypass -File .\scripts\Run-Tests.ps1 -FullClean' -ForegroundColor Gray
    exit 0
}

function Assert-LastExitCode {
    param([string]$Message)
    if ($LASTEXITCODE -ne 0) {
        throw "!!! $Message (Exit Code: $LASTEXITCODE) !!!"
    }
}

Write-Host "--- SD Updater Quality Gate ---" -ForegroundColor Cyan

try {
    if ($FullClean) {
        Write-Host "[1/4] Performing exhaustive environment clean..." -ForegroundColor Gray
        & $ShellExecutable -ExecutionPolicy Bypass -File $ClearScript -Deep
        Assert-LastExitCode -Message 'Exhaustive clean FAILED'
    } else {
        Write-Host "[1/4] Skipping clean (use -FullClean for a pristine state)..." -ForegroundColor DarkGray
    }

    # Restoring dependencies if cleaned
    if ($FullClean -or !(Test-Path (Join-Path $ProjectRoot 'node_modules'))) {
        Write-Host " Restoring Node dependencies..."
        npm install
    }

    Write-Host "[2/4] Running Rust core unit tests..." -ForegroundColor Cyan
    cargo test --manifest-path (Join-Path $ProjectRoot 'src-tauri\Cargo.toml')
    Assert-LastExitCode -Message 'Rust Logic Tests FAILED'

    Write-Host "[3/4] Running Frontend linting suite..." -ForegroundColor Cyan
    npm run lint
    Assert-LastExitCode -Message 'Frontend Lint FAILED'

    Write-Host "[4/4] Executing production build smoke test..." -ForegroundColor Cyan
    & $ShellExecutable -ExecutionPolicy Bypass -File $BuildScript -Mode Smoke
    Assert-LastExitCode -Message 'Build Smoke Test FAILED'

    Write-Host "`n========================================" -ForegroundColor Green
    Write-Host "  ALL QUALITY GATES PASSED SUCCESSFULLY" -ForegroundColor Green
    Write-Host "========================================`n" -ForegroundColor Green
}
catch {
    Write-Host "`n[FATAL] $($_.Exception.Message)" -ForegroundColor Red
    exit 1
}
