---
name: gcp-auth-setup
description: >
  Interactively authenticates with Google Cloud via browser Application Default Credentials (ADC),
  fetches available projects, and allows selecting the target Google Cloud Project ID and location.
---

# 🔐 GCP Authentication & Project Setup Wizard

This skill guides the user through authenticating with Google Cloud and configuring their active project ID and location.

## Prerequisites
- Google Cloud SDK (`gcloud` CLI) installed and available on PATH.
- Active Google Cloud account with access to at least one project.

## Workflow

1. Execute the interactive setup Python script:
   ```bash
   python src/gcp_setup.py
   ```

2. The script will:
   - Open a browser window to `gcloud auth application-default login`.
   - Complete OAuth login (Success URL: `https://docs.cloud.google.com/sdk/auth_success`).
   - Retrieve all accessible GCP projects via `gcloud projects list`.
   - Prompt the user to select their desired project and location.
   - Automatically write settings to `.env`.

3. Verify connection:
   ```bash
   python src/chat_bridge.py --status
   ```
