# Google Cloud Agent Platform for Antigravity IDE

A native VS Code / Antigravity IDE extension that reproduces and extends the analyzed **Antigravity Agent Lifecycle** architecture, connecting directly to **Google Cloud Vertex AI (Gemini 3.7-flash)** with built-in security guardrails, multi-view state synchronization, and 115 external lifecycle skills.

![Google Cloud Agent Platform Chat UI](./asset/chat-v0.2.0.webp)

---

## 📖 The Story & Development Background

### 1. The Origin: Direct Enterprise Cloud Connection
It started with a fundamental need: establishing an independent, enterprise-grade connection directly to Google Cloud Vertex AI (Gemini 3.7-flash) using Application Default Credentials (ADC) to ensure uninterrupted development even when default IDE quotas are exhausted. The initial prototype began as a simple PowerShell script (`quicksetup-agent-platform.ps1`) to verify API communication.

### 2. From Terminal to Custom Sidebar UI
Once cloud communication was proven, the next natural step was moving out of the terminal. We developed a custom VS Code extension (`src/extension.js`) embedding an interactive chat panel directly into the IDE's Primary and Secondary Sidebars. However, we quickly recognized that simple one-shot Q&A prompts were not enough — it lacked the true "autonomous, self-planning, and tool-using" capabilities of a native AI agent.

### 3. Uncovering the Core: VS Code OSS 1.107.0 & Antigravity Architecture
To understand how Antigravity natively executes autonomous agent loops, we investigated the underlying IDE version: **Antigravity IDE 2.5.5 (VSCode OSS 1.107.0 / Commit `ecfbad74d93962fc8ca485d93ab9b4f3d4cb6cf8`)**.
Release 1.107 introduced a paradigm shift with **Agent Sessions, Multi-Agent Orchestration, Background Execution, and Tool Call Folding**.

### 4. Special Gratitude & Acknowledgement
We extend our deepest gratitude to the **`lumusitech/AI`** repository and its author, **Carlos Luciano Figueroa**. Thanks to their deep reverse-engineering of Antigravity and VS Code agent mechanics, we were able to clearly identify the indispensable building blocks required for native agent chat and autonomous tool execution. This profound architectural insight was pivotal in empowering us to reconstruct, adapt, and build our own native Google Cloud Agent Platform.

### 5. The Synthesis: Native IDE Platform meets Google Cloud Power
While the upstream research packaged these concepts as Linux-centric OS-level dotfiles (`~/.agent`), we synthesized these proven lifecycle theories directly into a **cross-platform (Windows/macOS/Linux), IDE-native architecture**:
- Replacing bash scripts with cross-platform Node.js & Python modules.
- Introducing `ChatStateManager` for real-time dual-sidebar synchronization.
- Upgrading one-shot execution to a persistent stdio JSON-RPC 2.0 background daemon.
- Injecting the 115 external skills on demand via `/` slash commands, protected by local zero-token security guardrails.

### 6. Two-Repository Modular Architecture (Engine vs. Skills)
To maintain high modularity and clean separation of concerns, the system operates across two dedicated repositories under our management:
* **Execution Platform (This Repo: `google-cloud-agent-platform`)**: The IDE extension engine, state manager, Python JSON-RPC daemon, security guardrails, and UI panels.
* **Specialized Skills Library (`antigravity-agent-lifecycle`)**: Our forked repository containing the 115 curated agent workflow skills and analytical lifecycle knowledge.

`SkillManager` dynamically references and loads the skills repository on the fly without duplicating code, allowing both the engine and skillsets to evolve independently.

---

## 🏛️ Architecture Overview

This platform implements the reverse-engineered internal lifecycle specifications of Antigravity IDE:

```text
┌─────────────────────────────────────────────────────────────────────────────┐
│ [Primary / Secondary Sidebar Webviews] (Dual-Sidebar Synchronized UI)       │
└──────────────────────────────────────┬──────────────────────────────────────┘
                                       │ postMessage (State Sync)
                                       ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│ [ChatStateManager] (Single Source of Truth across Sidebars)                 │
└──────────────────┬───────────────────────────────────────┬──────────────────┘
                   │                                       │
                   ▼                                       ▼
┌──────────────────────────────────────┐ ┌────────────────────────────────────┐
│ [HookManager] (PreToolUse Firewall)  │ │ [SkillManager] (115 Antigravity    │
│  - Blocks .env leaks                 │ │  Skills scanned from repo & loaded │
│  - Blocks destructive commands       │ │  via slash commands: /plan, /audit)│
└──────────────────┬───────────────────┘ └────────────────────────────────────┘
                   │
                   ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│ [RpcClient] (Persistent Stdio JSON-RPC 2.0 Daemon)                          │
└──────────────────────────────────────┬──────────────────────────────────────┘
                                       │ JSON-RPC 2.0 (UTF-8)
                                       ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│ [chat_bridge.py] (Python Daemon with Google GenAI SDK & ADC)                │
└──────────────────────────────────────┬──────────────────────────────────────┘
                                       │ Vertex AI API
                                       ▼
                        [Google Cloud: Gemini 3.7-flash]
```

### Key Capabilities

1. **Dual-Sidebar Realtime State Synchronization**:
   - Supports both Primary (left) and Secondary (right) sidebars simultaneously.
   - Message history, GCP status, and model selections are seamlessly shared in real time.
2. **Persistent Stdio JSON-RPC 2.0 Bridge**:
   - Python process runs as a long-lived background daemon (`chat_bridge.py --daemon`), eliminating cold-start execution latency.
3. **PreToolUse Security Guardrails**:
   - Automatically intercepts and blocks attempts to access `.env` files, export sensitive tokens to shell, or execute destructive commands.
4. **Dynamic 115 Skills Ingestion**:
   - Scans external skills from `antigravity-agent-lifecycle` (`skills/`) and injects them on demand via slash commands (e.g. `/plan-phases-create`, `/solid-audit`).

---

## 📜 Acknowledgements & Attributions

This project references and incorporates architectural concepts, skills, and security hooks from the [antigravity-agent-lifecycle](https://github.com/1abcdefggs/antigravity-agent-lifecycle) (upstream: [lumusitech/AI](https://github.com/lumusitech/AI)) project by **Carlos Luciano Figueroa**, licensed under the MIT License.


---

## 🚀 Quick Setup: Connecting to Google Cloud

If the Antigravity quota is exhausted or you wish to use enterprise Google Cloud capacity, you can establish the direct GCP connection as follows.

### 1. Prerequisites
- **Supported OS**: Windows 10/11 (PowerShell), macOS, or Linux.
- A Google Cloud project with Vertex AI API enabled.
- Python 3.10+ installed.

### 2. Application Default Credentials (ADC) Login

Run the following command in your terminal to authenticate:

```powershell
gcloud auth application-default login
```

Or via PowerShell script:
```powershell
powershell -c "iex (irm https://storage.googleapis.com/cloud-samples-data/adc/setup_adc.ps1)"
```

### 3. Quick Setup Script

Run [quicksetup-agent-platform.ps1](quicksetup-agent-platform.ps1) in PowerShell after setting your project ID:

```powershell
./quicksetup-agent-platform.ps1
```

---

## ⚙️ Configuration Settings

Configure the extension in VS Code / Antigravity IDE Settings (`agentPlatform.*`):

| Setting | Default | Description |
|---|---|---|
| `agentPlatform.projectId` | `""` | Google Cloud Project ID (Optional; auto-detected if empty) |
| `agentPlatform.location` | `"global"` | Google Cloud Region / Location |
| `agentPlatform.defaultModel` | `"gemini-3.7-flash"` | Default Gemini Model identifier |
| `agentPlatform.targetLanguage` | `"auto"` | Target response language (`auto`, `ja`, `en`, etc.) |

> [!NOTE]
> **Automatic Project ID Resolution**:
> If `agentPlatform.projectId` is left empty (`""`), the platform automatically detects and adopts the active Project ID from your local Application Default Credentials (ADC) / `gcloud config` environment. You only need to explicitly configure this setting if you wish to override the active cloud project.

---

## 📂 Project Structure

```text
c:\google-cloud-agent-platform\
├── src/
│   ├── extension.js               # Extension entrypoint & Webview provider
│   ├── chat_bridge.py             # Persistent stdio JSON-RPC 2.0 Python daemon
│   ├── mcp_server.py              # Model Context Protocol (MCP) server
│   │
│   ├── state/
│   │   └── chat_state_manager.js  # Cross-sidebar conversation & status sync
│   │
│   ├── bridge/
│   │   └── rpc_client.js          # Node.js JSON-RPC supervisor for Python daemon
│   │
│   └── agent/
│       ├── hook_manager.js        # PreToolUse security firewall
│       └── skill_manager.js       # External skills scanner & slash commands
│
├── docs/
│   ├── antigravity_agent_architecture.md # Full architecture specification
│   ├── phase1_implementation_design.md   # Phase 1 technical design
│   ├── phase2_implementation_design.md   # Phase 2 technical design
│   └── phase3_implementation_design.md   # Phase 3 technical design
│
├── LICENSE                        # Open-source MIT license
└── package.json                   # Extension manifest & views configuration
```

---

## 📋 Version History & Release Notes

### **v0.2.0** — *Native Agent Lifecycle & Dual-Sidebar Architecture*
* **Dual-Sidebar State Synchronization**: Seamless real-time conversation and state sharing between Primary (Activity Bar) and Secondary (Auxiliary Bar) sidebars via `ChatStateManager`.
* **Persistent JSON-RPC 2.0 Daemon**: Replaced one-shot script spawning with a long-lived background Python daemon (`chat_bridge.py --daemon`) via `RpcClient`, eliminating cold-start execution latency.
* **PreToolUse Security Guardrails**: Integrated `HookManager` firewall to automatically detect and intercept sensitive token leaks (`.env`), environment dumps, and destructive commands.
* **Dynamic 115 Skills Ingestion**: Added `SkillManager` to scan the external `antigravity-agent-lifecycle` repository and dynamically inject specialized workflows via slash commands (`/`).
* **Live Connection & UI Polish**: Real-time project ID and connectivity status badge, model switching, and optimized IDE-native dark UI.

### **v0.1.2** — *Packaging & Model Selection Enhancements*
* Added dynamic Gemini model selection dropdown directly within the chat UI.
* Drastically optimized `.vsix` extension package size (reduced from ~53MB to ~415KB).
* Added configurable workspace settings for Google Cloud Project ID, Location, and Default Model.

### **v0.1.1** — *UI & Authentication Improvements*
* Enhanced markdown syntax highlighting and code block formatting in the sidebar Webview.
* Streamlined Application Default Credentials (ADC) authentication validation and error diagnostics.

### **v0.1.0** — *Initial Prototype & Cloud Bridge*
* Initial proof-of-concept connecting VS Code / Antigravity IDE directly to Google Cloud Vertex AI using ADC authentication.
* First interactive sidebar chat panel prototype for autonomous prompt testing.
* Automated onboarding and validation scripts (`quicksetup-agent-platform.ps1`).
