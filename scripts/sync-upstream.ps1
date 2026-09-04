# OpenAlgo Upstream Synchronization Script
# Automatically pulls the latest MarketCalls upstream updates into your 0codedev/openalgo fork
# Usage: .\scripts\sync-upstream.ps1

param(
    [switch]$SkipPush = $false
)

$ErrorActionPreference = "Stop"

Write-Host "==========================================" -ForegroundColor Cyan
Write-Host "   OpenAlgo Upstream Synchronization      " -ForegroundColor Cyan
Write-Host "==========================================" -ForegroundColor Cyan

$RepoRoot = Split-Path -Parent $PSScriptRoot
Set-Location $RepoRoot

# Step 1: Backup sensitive env files
Write-Host "`n[1/6] Backing up environment files..." -ForegroundColor Yellow
$BackupDir = Join-Path $RepoRoot "db\backups\env_sync_$(Get-Date -Format 'yyyyMMdd_HHmmss')"
New-Item -ItemType Directory -Path $BackupDir -Force | Out-Null
Get-ChildItem -Path $RepoRoot -Force | Where-Object { $_.Name -like ".env*" } | ForEach-Object {
    Copy-Item $_.FullName -Destination $BackupDir -Force
}
Write-Host "  [OK] Backed up to: $BackupDir" -ForegroundColor Green

# Step 2: Fetch upstream
Write-Host "`n[2/6] Fetching latest upstream commits..." -ForegroundColor Yellow
git fetch upstream main --no-tags
if ($LASTEXITCODE -ne 0) {
    Write-Host "  [ERROR] Failed to fetch upstream main." -ForegroundColor Red
    exit 1
}
Write-Host "  [OK] Upstream fetched." -ForegroundColor Green

# Step 3: Merge upstream into main
Write-Host "`n[3/6] Merging upstream/main into local main..." -ForegroundColor Yellow
git merge upstream/main --no-edit
if ($LASTEXITCODE -ne 0) {
    Write-Host "  [WARN] Automatic merge encountered conflicts. Review git status." -ForegroundColor Yellow
    exit 1
}
Write-Host "  [OK] Merged cleanly." -ForegroundColor Green

# Step 4: Sync Python dependencies & run database migrations
Write-Host "`n[4/6] Updating Python dependencies and database schema..." -ForegroundColor Yellow
uv sync
if ($LASTEXITCODE -ne 0) {
    Write-Host "  [WARN] uv sync reported errors." -ForegroundColor Yellow
}
uv run upgrade/migrate_all.py
Write-Host "  [OK] Python dependencies and database migrated." -ForegroundColor Green

# Step 5: Build frontend
Write-Host "`n[5/6] Building frontend assets..." -ForegroundColor Yellow
Set-Location (Join-Path $RepoRoot "frontend")
npm run build
Set-Location $RepoRoot
if ($LASTEXITCODE -ne 0) {
    Write-Host "  [ERROR] Frontend build failed." -ForegroundColor Red
    exit 1
}
Write-Host "  [OK] Frontend build succeeded." -ForegroundColor Green

# Step 6: Push to your GitHub fork
if (-not $SkipPush) {
    Write-Host "`n[6/6] Pushing to your GitHub fork (0codedev/openalgo)..." -ForegroundColor Yellow
    git add -A
    $status = git status --porcelain
    if ($status) {
        git commit -m "chore: sync with upstream release $(Get-Date -Format 'yyyy-MM-dd')"
    }
    git push origin main
    if ($LASTEXITCODE -eq 0) {
        Write-Host "  [OK] Pushed to origin/main successfully!" -ForegroundColor Green
    } else {
        Write-Host "  [WARN] Could not push to origin. Check if fork exists or push manually." -ForegroundColor Yellow
    }
} else {
    Write-Host "`n[6/6] SkipPush enabled - skipping push to origin." -ForegroundColor DarkGray
}

Write-Host "`n==========================================" -ForegroundColor Green
Write-Host "   OpenAlgo is fully synced & updated!   " -ForegroundColor Green
Write-Host "==========================================" -ForegroundColor Green
