# ./scripts/Check-Env.ps1
<#
Purpose: Verifies the development environment for the SD Card Updater.
How to run: powershell -File ./scripts/Check-Env.ps1
#>

$ErrorActionPreference = 'Stop'
Set-StrictMode -Version Latest

Write-Host "--- SD Updater Environment Check ---" -ForegroundColor Cyan

$Success = $true

function Write-Status {
    param([string]$Level, [string]$Message)
    $color = switch ($Level) {
        'OK' { 'Green' }
        'WARN' { 'Yellow' }
        'FAIL' { 'Red' }
        default { 'Gray' }
    }
    Write-Host "[$Level] $Message" -ForegroundColor $color
}

# 1. Cargo / Rust
if (Get-Command cargo -ErrorAction SilentlyContinue) {
    Write-Status "OK" "Cargo found: $(cargo --version)"
} else {
    Write-Status "FAIL" "Cargo NOT found. Install from https://rustup.rs"
    $Success = $false
}

# 2. Node / NPM
if (Get-Command npm -ErrorAction SilentlyContinue) {
    Write-Status "OK" "NPM found: $(npm --version)"
} else {
    Write-Status "FAIL" "NPM NOT found."
    $Success = $false
}

# 3. Tauri CLI
if (npm list -g @tauri-apps/cli --depth=0) {
    Write-Status "OK" "Tauri CLI (Global) detected."
} else {
    Write-Status "WARN" "Tauri CLI not found globally. Recommended: npm install -g @tauri-apps/cli"
}

# 4. Multi-Arch Rust Targets
if (Get-Command rustup -ErrorAction SilentlyContinue) {
    $targets = rustup target list --installed
    $required = @("x86_64-pc-windows-msvc", "aarch64-pc-windows-msvc")
    foreach ($r in $required) {
        if ($targets -contains $r) {
            Write-Status "OK" "Target $r is installed."
        } else {
            Write-Status "WARN" "Target $r is missing. Run 'rustup target add $r'"
        }
    }
}

# 5. Git Readiness
if (Get-Command git -ErrorAction SilentlyContinue) {
    Write-Status "OK" "Git on PATH."
} else {
    Write-Status "FAIL" "Git NOT found. Required for publish.ps1"
    $Success = $false
}

if ($Success) {
    Write-Host "--- Environment READY for professional development ---" -ForegroundColor Green
} else {
    Write-Host "--- Environment is MISSING prerequisites ---" -ForegroundColor Red
    exit 1
}
