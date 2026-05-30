# ./scripts/publish.ps1
<#
Purpose: Synchronize version, commit, tag, and push to trigger a GitHub release.
How to run: powershell -File ./scripts/publish.ps1 -Version 7.0.1 -Description "Improved SSH stability"
#>

param(
    [Parameter(Mandatory = $true)] [string]$Version,
    [Parameter(Mandatory = $true)] [string]$Description,
    [switch]$DryRun
)

$ErrorActionPreference = 'Stop'
$repoRoot = Resolve-Path (Join-Path $PSScriptRoot '..')
$Tag = "v$Version"

# 0. Basic Validation
if ($Version -notmatch '^\d+\.\d+\.\d+$') {
    throw "Version must be in MAJOR.MINOR.PATCH format, got: $Version"
}

$CurrentBranch = (& git branch --show-current 2>$null).Trim()
if (!$CurrentBranch) { throw "Not in a git branch." }

$ExistingTag = (& git tag -l $Tag)
if ($ExistingTag) { throw "Tag '$Tag' already exists." }

Write-Host "--- SD Updater Publish [Expert Mode] ---" -ForegroundColor Cyan
Write-Host " Version     : $Version"
Write-Host " Tag         : $Tag"
Write-Host " Branch      : $CurrentBranch"
Write-Host " Description : $Description"
Write-Host ""

if ($DryRun) {
    Write-Host "[DRY RUN] Would sync version to $Version" -ForegroundColor Yellow
    Write-Host "[DRY RUN] Would run: git add --renormalize ." -ForegroundColor Yellow
    Write-Host "[DRY RUN] Would run local quality gate (Run-Tests.ps1)" -ForegroundColor Yellow
    Write-Host "[DRY RUN] Would commit and create annotated tag" -ForegroundColor Yellow
    Write-Host "[DRY RUN] Would push to origin --follow-tags" -ForegroundColor Yellow
    return
}

# 1. Sync Version
Write-Host "[1/6] Synchronizing project version metadata..." -ForegroundColor Cyan
powershell -ExecutionPolicy Bypass -File "$PSScriptRoot/set-version.ps1" -Version $Version

# 2. Stage Changes
Write-Host "[2/6] Staging all changes..." -ForegroundColor Cyan
git add -A

# 3. Renormalize (Critical for cross-platform files)
Write-Host "[3/6] Renormalizing line endings..." -ForegroundColor Cyan
git add --renormalize .

# 4. Quality Gate
Write-Host "[4/6] Running local quality gate..." -ForegroundColor Cyan
powershell -ExecutionPolicy Bypass -File "$PSScriptRoot/Run-Tests.ps1" -FullClean

# 5. Commit & Tag
Write-Host "[5/6] Committing and Tagging..." -ForegroundColor Cyan
git add -A
git commit -m "release: $Tag`n`n$Description"
git tag -a $Tag -m "$Description"

# 6. Push
Write-Host "[6/6] Pushing to origin..." -ForegroundColor Cyan
git push origin $CurrentBranch --follow-tags

Write-Host "`n[SUCCESS] Published $Tag. Monitor GitHub Actions for build status." -ForegroundColor Green
