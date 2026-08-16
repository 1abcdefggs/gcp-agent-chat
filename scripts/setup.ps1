# Windows Setup Script for GCP Agent Chat Platform Dotfiles Ecosystem
$ErrorActionPreference = "Stop"

Write-Host "==================================================" -ForegroundColor Cyan
Write-Host " GCP Agent Chat Platform Setup Wizard" -ForegroundColor Cyan
Write-Host "==================================================" -ForegroundColor Cyan

# 1. Check Python installation
try {
    $pythonVersion = python --version 2>&1
    Write-Host "[OK] Python detected: $pythonVersion" -ForegroundColor Green
} catch {
    Write-Host "[ERROR] Python is not installed or not on PATH." -ForegroundColor Red
    exit 1
}

# 2. Install required Python packages
Write-Host "`nInstalling required Python packages (google-genai, google-auth, fastmcp)..." -ForegroundColor Yellow
python -m pip install --quiet google-genai google-auth fastmcp

# 3. Check gcloud CLI
try {
    $gcloudVer = gcloud --version 2>&1 | Select-Object -First 1
    Write-Host "[OK] Google Cloud SDK detected: $gcloudVer" -ForegroundColor Green
} catch {
    Write-Host "[WARNING] gcloud CLI not detected. Please install Google Cloud SDK." -ForegroundColor Yellow
}

# 4. Create .env if missing
if (-not (Test-Path ".env")) {
    if (Test-Path ".env.example") {
        Copy-Item ".env.example" ".env"
        Write-Host "[OK] Created .env from .env.example" -ForegroundColor Green
    }
}

# 5. Run Interactive GCP Auth & Project Setup
Write-Host "`nLaunching interactive GCP Authentication Wizard..." -ForegroundColor Yellow
python src/gcp_setup.py

Write-Host "`n==================================================" -ForegroundColor Cyan
Write-Host " Setup complete! You can now launch VS Code and use" -ForegroundColor Cyan
Write-Host " the GCP Agent Chat Platform sidebar extension & MCP." -ForegroundColor Cyan
Write-Host "==================================================" -ForegroundColor Cyan
