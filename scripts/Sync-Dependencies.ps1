# ./scripts/Sync-Dependencies.ps1
<#
Purpose: Maintenance script to find and optionally update Cargo.toml dependencies 
based on the latest resolved (or registry) versions.
How to run: powershell -File ./scripts/Sync-Dependencies.ps1 [-Fix] [-CheckLatest] [-DryRun]
#>

Param(
    [switch]$Fix,
    [switch]$DryRun,
    [switch]$CheckLatest,
    [string[]]$Exclude = @("reqwest"), # Exclude reqwest by default for Android compatibility
    [switch]$ExcludeBeta
)

$ErrorActionPreference = 'Stop'

Write-Host "--- SD Updater Dependency Sync ---" -ForegroundColor Cyan

# 1. Collect Target Versions
$TargetVersions = @{}
$MetadataKeysToSkip = @(
    "name", "version", "edition", "license", "resolver", "authors", 
    "description", "homepage", "repository", "documentation", 
    "keywords", "categories", "readme", "publish", "default-run"
)

$WorkspaceRoot = Resolve-Path "$PSScriptRoot\.."

if ($CheckLatest) {
    Write-Host "Fetching latest registry versions from crates.io..." -ForegroundColor Gray
    
    # Discovery Pass: Find all unique dependencies
    $AllTomlFiles = Get-ChildItem -Path $WorkspaceRoot -Filter "Cargo.toml" -Recurse -Exclude "Reference"
    $UniqueDependencyNames = @{}
    
    foreach ($TomlFile in $AllTomlFiles) {
        $RawTomlContent = Get-Content $TomlFile.FullName -Raw
        $DependencyIdentRegex = '(?m)^(\s*)([a-zA-Z0-9_-]+)\s*=\s*(?:\"([0-9.]+)\"|\{\s*version\s*=\s*\"([0-9.]+)\")'
        $DiscoveryMatchesResult = [regex]::Matches($RawTomlContent, $DependencyIdentRegex)
        foreach ($DiscMatchObj in $DiscoveryMatchesResult) { 
            $FoundNameVarStr = $DiscMatchObj.Groups[2].Value
            if ($FoundNameVarStr -notin $MetadataKeysToSkip) { 
                $UniqueDependencyNames[$FoundNameVarStr] = $true 
            }
        }
    }

    # Registry Query Pass
    $CurrentDepTrackerIndex = 0
    foreach ($NameReqItem in $UniqueDependencyNames.Keys) {
        $CurrentDepTrackerIndex++
        Write-Progress -Activity "Fetching registry versions" -Status "Checking $NameReqItem" -PercentComplete (($CurrentDepTrackerIndex / $UniqueDependencyNames.Count) * 100)
        
        $RawSearchOutputLines = (cargo search $NameReqItem --limit 1 2>$null) | Out-String
        if ($RawSearchOutputLines -match "^$([regex]::Escape($NameReqItem)) = `"([^`"]+)`"") {
            $TargetVersions[$NameReqItem] = $Matches[1].Split('+')[0]
        }
    }
    Write-Progress -Activity "Fetching registry versions" -Completed
} else {
    Write-Host "Fetching local resolved versions from cargo metadata..." -ForegroundColor Gray
    $RawMetadataJsonObj = cargo metadata --format-version 1 --no-deps --manifest-path (Join-Path $WorkspaceRoot "src-tauri/Cargo.toml") | ConvertFrom-Json
    foreach ($PackageInfoItem in $RawMetadataJsonObj.packages) {
        if ($null -ne $PackageInfoItem.source) {
            $TargetVersions[$PackageInfoItem.name] = $PackageInfoItem.version.Split('+')[0]
        }
    }
}

# 2. Update Pass
$TomlFilesToProcessLoop = Get-ChildItem -Path $WorkspaceRoot -Filter "Cargo.toml" -Recurse -Exclude "Reference"
$TotalUpdatesFoundAcrossAllFiles = 0
$TotalFilesUpdated = 0

foreach ($TargetFileProcessItem in $TomlFilesToProcessLoop) {
    $DisplayPathString = $TargetFileProcessItem.FullName.Replace($WorkspaceRoot.Path, ".")
    Write-Host "`nChecking: $DisplayPathString" -ForegroundColor Yellow
    
    $OriginalFileContentRawStr = Get-Content $TargetFileProcessItem.FullName -Raw
    $UpdatedContentResultStr = $OriginalFileContentRawStr
    $FileLevelUpdateCountTracker = 0

    $FetchPatternsListArray = @(
        '(?m)^(\s*)([a-zA-Z0-9_-]+)\s*=\s*\"([0-9.]+)\"',
        '(?m)^(\s*)([a-zA-Z0-9_-]+)\s*=\s*\{\s*version\s*=\s*\"([0-9.]+)\"'
    )

    foreach ($PatternStrItemValue in $FetchPatternsListArray) {
        $UpdateMatchesFoundInFileResult = [regex]::Matches($OriginalFileContentRawStr, $PatternStrItemValue)
        foreach ($UpdMatchObject in $UpdateMatchesFoundInFileResult) {
            $KeyNameFoundStr = $UpdMatchObject.Groups[2].Value
            $DeclVerFoundStr = $UpdMatchObject.Groups[3].Value

            if ($KeyNameFoundStr -notin $MetadataKeysToSkip -and $TargetVersions.ContainsKey($KeyNameFoundStr)) {
                $NewerVerFoundInMapStr = $TargetVersions[$KeyNameFoundStr]
                
                # Apply Filters
                if ($Exclude -and ($KeyNameFoundStr -in $Exclude)) {
                    continue
                }
                if ($ExcludeBeta -and ($NewerVerFoundInMapStr -match "beta|alpha|rc|preview")) {
                    continue
                }

                if ($DeclVerFoundStr -ne $NewerVerFoundInMapStr -and $DeclVerFoundStr -notlike "*workspace*") {
                    Write-Host "  [UPDATE] $KeyNameFoundStr : $DeclVerFoundStr -> $NewerVerFoundInMapStr" -ForegroundColor Green
                    $TotalUpdatesFoundAcrossAllFiles++
                    $FileLevelUpdateCountTracker++

                    if ($Fix) {
                        $MatchLineTextStr = $UpdMatchObject.Value
                        $NewLineTextResolvedStr = $MatchLineTextStr.Replace($DeclVerFoundStr, $NewerVerFoundInMapStr)
                        $UpdatedContentResultStr = $UpdatedContentResultStr.Replace($MatchLineTextStr, $NewLineTextResolvedStr)
                    }
                }
            }
        }
    }

    if ($FileLevelUpdateCountTracker -eq 0) {
        Write-Host "  No updates required." -ForegroundColor Gray
    } elseif ($Fix) {
        if ($DryRun) {
            Write-Host "  [DRY RUN] Would update $DisplayPathString" -ForegroundColor Magenta
        } else {
            Write-Host "  Updating $DisplayPathString..." -ForegroundColor Cyan
            $UpdatedContentResultStr | Set-Content $TargetFileProcessItem.FullName
            $TotalFilesUpdated++
        }
    }
}

Write-Host "`n--- Summary ---" -ForegroundColor Cyan
if ($TotalUpdatesFoundAcrossAllFiles -eq 0) {
    Write-Host "All dependencies are current." -ForegroundColor Green
} else {
    Write-Host "Found $TotalUpdatesFoundAcrossAllFiles pending updates." -ForegroundColor Yellow
    if ($Fix -and -not $DryRun) {
        Write-Host "Refreshing Cargo.lock..." -ForegroundColor Gray
        cargo update --manifest-path (Join-Path $WorkspaceRoot "src-tauri/Cargo.toml")
        Write-Host "Applied $TotalUpdatesFoundAcrossAllFiles updates." -ForegroundColor Green
    } elseif (-not $Fix) {
        Write-Host "Run with -Fix to apply these changes." -ForegroundColor Gray
    }
}

# Optional npm update
if ($Fix -and -not $DryRun) {
    Write-Host "`nSyncing NPM dependencies..." -ForegroundColor Cyan
    npm update
}

Write-Host "--- Done ---" -ForegroundColor Cyan
