# Change Log

All notable changes to the "gcp-agent-chat" extension will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

---

## [0.8.0] - 2026-08-16
### Added
- **Gemini AI Visual Design Architecture**: Complete UI/UX transformation bringing Google's organic, high-aesthetic visual design system to the VS Code Webview sidebar.
- **Animated Light Beam Border**: AI message bubbles feature dynamic 4-color `conic-gradient` rotating light beams (`.ai-wrapper.generating`) during streaming, smoothly fading to subtle borders upon completion.
- **Organic Spectrum Orb**: Header intelligence node reflecting AI lifecycle states (`idle` breathing pulse, `thinking` concentrated pulse, and `replying` multicolor spin).
- **Calm, Decisive Wave Indicator**: Replaced generic loading spinners with a 4-dot breathing wave in Gemini's signature palette for enhanced psychological safety.
- **Directional Input with Energy Flow**: Active focus and text input triggers a flowing gradient aura along the input card.
- **1-Click Rich FX Toggle (`✨`) & VS Code Setting**: Added `#toggleEffectsBtn` in the header for instant, seamless toggling between **Rich Gemini Mode** and **Minimal Classic Mode**, with settings synchronization via `gcpAgentChat.enableRichAnimations`.

---

## [0.7.2] - 2026-08-16
### Fixed
- **Python Bridge Auto-Detection**: Improved fallback resolution for Python 3 executables across Windows, macOS, and Linux environments.

---

## [0.7.1] - 2026-08-16
### Added
- **Interactive Welcome Screen Connection & Login**: Added real-time GCP connection state badge, loading spinner animation, and a one-click "Connect & Sign In to GCP" button directly on the initial welcome screen.
- **Enhanced Authentication Guidance**: Added proactive notification and QuickPick description explaining Google's official security email ("Google Auth Library access granted") when logging in via `gcloud auth application-default login`.
- **Configuration Namespace Normalization**: Unified internal configuration references to `gcpAgentChat` for faster ADC resolution and settings synchronization.

---

## [0.7.0] - 2026-08-16
### Added
- **Official Character Logo & Branding**: Adopted the new friendly blue AI robot logo (`asset/gcpagent-logo.jpg`) and updated extension icons (`asset/icon.png`).
- **Editor Direct Integration**: Added "Ask GCP Agent Chat about this code" context menu in the editor and one-click code insertion into active documents (`src/editor/editor_bridge.js`).
- **Real-Time Token & Cost Tracker**: Live calculation of Gemini 3.7 / 2.5 token costs with configurable monthly budget limits (`src/cost/cost_tracker.js`).
- **Multi-Modal Vision Support**: Support for pasting and uploading images (PNG/JPEG/WEBP) for visual code reviews and UI analysis (`src/media/image_handler.js`).
- **Automated Session Persistence & Markdown Export**: Automatic JSONL logging per session and one-click export to Markdown in `.agents/artifacts/` (`src/storage/session_storage.js`).

---

## [0.5.0] - 2026-08-15
### Added
- **Antigravity IDE Zero-CLI Authentication**: Direct integration with `vscode.authentication` API. Log into Antigravity IDE with your Google Account, enter your Project ID, and start chatting immediately without touching the `gcloud` CLI.
- **Multi-Account Coexistence (`gcpAgentChat.authMode`)**: Added granular authentication mode selection supporting `auto`, `ide`, `gcloud` ADC, and `serviceAccount`, allowing developers to seamlessly operate GCP projects with external client/partner accounts distinct from their IDE login.
- **Interactive QuickPick Auth Manager**: Clicking the connection status badge opens an intuitive management menu for one-click IDE login, gcloud terminal login, live auth mode switching, and token revocation.

---

## [0.4.9] - 2026-08-14
### Added
- **Autonomous Function Calling Loop**: Implemented a multi-turn tool execution loop in `chat_bridge.py` allowing Gemini to autonomously inspect workspace files (`read_file`, `list_files`) and return complete solutions without empty text returns.
- **Top-Header UI Reorganization**: Moved the Language selector to the top-right action bar alongside session buttons, giving full-width visibility to the Model selection dropdown.
- **Sleek Deep Dark Theme**: Tuned background and component colors to a refined dark OLED palette (`#0d0d12` base, `#121218` card background).

---

## [0.4.8] - 2026-08-13
### Added
- **Interactive Session Management**: Added `+` (New Chat) and `🕘` (Session History QuickPick) buttons to seamlessly switch, resume, and manage past `.jsonl` conversation sessions.
- **Webview Script Modularization**: Extracted `markdown_renderer.js` to isolate markdown parsing, syntax highlighting, and code action handlers.
- **Logical Settings Hierarchy**: Introduced explicit schema `order` (1 to 7) to enforce logical top-down grouping in VS Code settings.

---

## [0.4.7] - 2026-08-12
### Added
- **Multi-Modal Image Support**: Support for uploading and pasting screenshots directly into prompts for visual code review and UI debugging.
- **Markdown Conversation Export**: One-click export of chat sessions directly to `.agents/artifacts/` markdown documents.
- **Token Budget Guardrail**: Configurable monthly budget limit (`gcpAgentChat.monthlyBudgetLimit`) preventing unexpected Vertex AI API overuse.

---

## [0.2.0] - 2026-08-10
### Added
- **Dual-Sidebar State Synchronization**: Seamless real-time conversation and state sharing between Primary (Activity Bar) and Secondary (Auxiliary Bar) sidebars via `ChatStateManager`.
- **Persistent JSON-RPC 2.0 Daemon**: Replaced one-shot script spawning with a long-lived background Python daemon (`chat_bridge.py --daemon`) via `RpcClient`, eliminating cold-start execution latency.
- **PreToolUse Security Guardrails**: Integrated `HookManager` firewall to automatically detect and intercept sensitive token leaks (`.env`), environment dumps, and destructive commands.
- **Dynamic 115 Skills Ingestion**: Added `SkillManager` to scan the external `antigravity-agent-lifecycle` repository and dynamically inject specialized workflows via slash commands (`/`).

---

## [0.1.0] - 2026-08-08
### Added
- Proof-of-concept connecting VS Code / Antigravity IDE directly to Google Cloud Vertex AI using ADC authentication.
- First interactive sidebar chat panel prototype for autonomous prompt testing.
- Automated onboarding and validation scripts (`quicksetup-gcp-agent-chat.ps1`).
