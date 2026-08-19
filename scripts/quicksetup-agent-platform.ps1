<#
MIT License
Copyright (c) 2026 1abcdefggs (https://github.com/1abcdefggs/gcp-agent-chat)

.SYNOPSIS
Quickstart setup script for Google Cloud Agent Platform (Gemini API)

To use this, you must first configure it for use with a project in Google Cloud.

This script connects to Google Cloud-based agents (such as Gemini) to test basic chat functionality.

.DESCRIPTION
This script automates the initial setup for using the Google Cloud Gen AI SDK:
1. Validates Python environment and resolves a working Python interpreter.
2. Configures necessary Google Cloud environment variables.
3. Installs/updates the `google-genai` Python SDK.
4. Generates a sample script (request.py) and executes it to verify connectivity.

.USAGE INSTRUCTIONS
1. Set `$env:GOOGLE_CLOUD_PROJECT` below (or pass via environment).
2. Run in PowerShell:
   .\quicksetup-agent-platform.ps1

.PREREQUISITES
- Python 3.10+ installed on your system.
- Google Cloud CLI authenticated (`gcloud auth application-default login`).
- A valid Google Cloud Project with the Agent Platform / Vertex AI API enabled.
#>

$ErrorActionPreference = "Stop"

Write-Host "=== Google Cloud Agent Platform Quick Setup & Test ===" -ForegroundColor Cyan

# ----------------------------------------------------
# 1. Resolve a working Python executable
# ----------------------------------------------------
Write-Host "`n[Step 1/4] Checking Python environment..." -ForegroundColor Cyan

$knownPaths = @(
    "$env:LOCALAPPDATA\Python\pythoncore-3.14-64\python.exe",
    "$env:LOCALAPPDATA\Programs\Python\Python314\python.exe",
    "$env:LOCALAPPDATA\Programs\Python\Python313\python.exe",
    "$env:LOCALAPPDATA\Programs\Python\Python312\python.exe",
    "C:\Python314\python.exe",
    "C:\Python313\python.exe",
    "C:\Python312\python.exe"
)

$selectedPythonPath = $null

# Check known functional paths first
foreach ($p in $knownPaths) {
    if (Test-Path $p) {
        $check = & $p -c "import sys, encodings; print(sys.executable)" 2>$null
        if ($LASTEXITCODE -eq 0 -and $check) {
            $selectedPythonPath = $p
            break
        }
    }
}

# Fallback to PATH commands if known paths not found
if (-not $selectedPythonPath) {
    $commands = @("python.exe", "python3.exe", "py.exe")
    foreach ($cmd in $commands) {
        $found = Get-Command $cmd -ErrorAction SilentlyContinue
        if ($found) {
            $check = & $cmd -c "import sys, encodings; print(sys.executable)" 2>$null
            if ($LASTEXITCODE -eq 0 -and $check) {
                $selectedPythonPath = $found.Source
                break
            }
        }
    }
}

if (-not $selectedPythonPath) {
    Write-Host "[ERROR] Could not find a functional Python interpreter with standard libraries." -ForegroundColor Red
    Write-Host "Please ensure Python 3.10+ is installed and accessible." -ForegroundColor Yellow
    exit 1
}

Write-Host "[OK] Using Python: $selectedPythonPath" -ForegroundColor Green

# ----------------------------------------------------
# 2. Set environment variables
# ----------------------------------------------------
Write-Host "`n[Step 2/4] Setting environment variables..." -ForegroundColor Cyan

# [!] Replace "YOUR_PROJECT_ID" with your actual Google Cloud Project ID if not set in environment.
if (-not $env:GOOGLE_CLOUD_PROJECT -or $env:GOOGLE_CLOUD_PROJECT -eq "YOUR_PROJECT_ID") {
    $env:GOOGLE_CLOUD_PROJECT = "YOUR_PROJECT_ID"
}

if (-not $env:GOOGLE_CLOUD_LOCATION) {
    $env:GOOGLE_CLOUD_LOCATION = "global"
}

$env:GOOGLE_GENAI_USE_ENTERPRISE = "True"

Write-Host "  GOOGLE_CLOUD_PROJECT  = $($env:GOOGLE_CLOUD_PROJECT)"
Write-Host "  GOOGLE_CLOUD_LOCATION = $($env:GOOGLE_CLOUD_LOCATION)"
Write-Host "  GOOGLE_GENAI_USE_ENTERPRISE = $($env:GOOGLE_GENAI_USE_ENTERPRISE)"

# ----------------------------------------------------
# 3. Install / Verify Google Gen AI SDK
# ----------------------------------------------------
Write-Host "`n[Step 3/4] Ensuring google-genai SDK is installed..." -ForegroundColor Cyan

$sdkCheck = & $selectedPythonPath -c "import google.genai; print('READY')" 2>$null
if ($sdkCheck -like "*READY*") {
    Write-Host "[OK] google-genai SDK is already installed and ready." -ForegroundColor Green
} else {
    Write-Host "Installing google-genai SDK via pip..." -ForegroundColor Cyan
    & $selectedPythonPath -m pip install --quiet --upgrade google-genai
    if ($LASTEXITCODE -eq 0) {
        Write-Host "[OK] google-genai SDK installed successfully." -ForegroundColor Green
    } else {
        Write-Host "[ERROR] Failed to install google-genai SDK via pip." -ForegroundColor Red
        exit 1
    }
}

# ----------------------------------------------------
# 4. Create request.py and verify connectivity
# ----------------------------------------------------
Write-Host "`n[Step 4/4] Creating request.py and testing connectivity..." -ForegroundColor Cyan

$pythonCode = @"
from google import genai
from google.genai.types import HttpOptions
import os

client = genai.Client(
    project=os.environ.get("GOOGLE_CLOUD_PROJECT"),
    location=os.environ.get("GOOGLE_CLOUD_LOCATION"),
    http_options=HttpOptions(api_version="v1")
)

response = client.models.generate_content(
    model="gemini-3.7-flash",
    contents="Hello! Please reply in one short friendly sentence to confirm the connection.",
)

print("--- Response from Cloud ---")
print(response.text.strip())
print("--------------------------")
"@

$scriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path
if (-not $scriptDir) { $scriptDir = (Get-Location).Path }
$requestPyPath = Join-Path $scriptDir "request.py"

Set-Content -Path $requestPyPath -Value $pythonCode -Encoding UTF8
Write-Host "Generated: $requestPyPath"

Write-Host "`nExecuting test request with Gemini 3.7 Flash..." -ForegroundColor Cyan
try {
    & $selectedPythonPath $requestPyPath
    if ($LASTEXITCODE -eq 0) {
        Write-Host "`n=== All setup and connectivity testing completed successfully! ===" -ForegroundColor Green
    } else {
        Write-Host "`n[ERROR] Request failed with exit code $LASTEXITCODE." -ForegroundColor Red
        exit $LASTEXITCODE
    }
} catch {
    Write-Host "`n[ERROR] Failed to execute $requestPyPath : $_" -ForegroundColor Red
    exit 1
}
