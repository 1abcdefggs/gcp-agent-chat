---
name: gcp-ask-gemini
description: >
  Sends queries or instructions to GCP Agent Chat Platform (Gemini Enterprise Agent API).
  Supports model selection (gemini-2.5-flash, gemini-3.5-flash, gemini-3.7-flash) and target language overrides.
---

# GCP Agent Chat Platform Query Skill

Use this skill to interface directly with GCP Agent Chat Platform models using Application Default Credentials.

## Execution Pattern

### Option A: Via Python Bridge
```bash
python src/chat_bridge.py "Your prompt or question" "gemini-3.7-flash" "auto"
```

### Option B: Via MCP Server
Call tool `ask_gemini` on `google-cloud-agent` MCP server with:
- `prompt`: The message/instruction for the agent.
- `model`: Gemini model (default `gemini-3.7-flash`).
- `language`: Target response language (`auto`, `en`, `ja`, `es`, etc.).

## Environment Variables
- `GOOGLE_CLOUD_PROJECT`: Active GCP Project ID (Required).
- `GOOGLE_CLOUD_LOCATION`: Project region (Default `global`).
- `GOOGLE_GENAI_USE_ENTERPRISE`: Set to `True`.
