const vscode = require('vscode');
const path = require('path');

const { ChatStateManager } = require('./state/chat_state_manager');
const { RpcClient } = require('./bridge/rpc_client');
const { HookManager } = require('./agent/hook_manager');
const { SkillManager } = require('./agent/skill_manager');

let rpcClient = null;
let stateManager = null;
let hookManager = null;
let skillManager = null;

function activate(context) {
    stateManager = new ChatStateManager();
    hookManager = new HookManager();
    skillManager = new SkillManager();

    // Resolve path to python bridge script
    const bridgeScript = path.join(__dirname, 'chat_bridge.py');
    const customEnv = getEnv();

    // Initialize persistent JSON-RPC client
    rpcClient = new RpcClient(bridgeScript, {
        cwd: vscode.workspace.workspaceFolders?.[0]?.uri.fsPath || __dirname,
        env: customEnv
    });

    const provider = new AgentPlatformChatViewProvider(context.extensionUri, stateManager, rpcClient, hookManager, skillManager);

    // Register WebviewViewProvider for both Primary (left) and Secondary (right) Sidebars
    context.subscriptions.push(
        vscode.window.registerWebviewViewProvider('agent-platform-chat-view', provider),
        vscode.window.registerWebviewViewProvider('agent-platform-chat-view-secondary', provider)
    );

    // Initial GCP connection status verification
    checkGcpStatus();

    // Refresh environment when settings change
    context.subscriptions.push(
        vscode.workspace.onDidChangeConfiguration(e => {
            if (e.affectsConfiguration('agentPlatform')) {
                checkGcpStatus();
            }
        })
    );
}

function getEnv() {
    const config = vscode.workspace.getConfiguration('agentPlatform');
    const customEnv = Object.assign({}, process.env);
    const configuredProjectId = config.get('projectId');
    const configuredLocation = config.get('location');

    if (configuredProjectId) {
        customEnv.GOOGLE_CLOUD_PROJECT = configuredProjectId;
    }
    if (configuredLocation) {
        customEnv.GOOGLE_CLOUD_LOCATION = configuredLocation;
    }
    return customEnv;
}

async function checkGcpStatus() {
    if (!rpcClient) return;
    try {
        const result = await rpcClient.call('gcp/checkStatus', {});
        stateManager.updateGcpStatus({
            authenticated: result.authenticated,
            projectId: result.project_id,
            location: result.location,
            account: result.account,
            error: result.error
        });
    } catch (err) {
        stateManager.updateGcpStatus({
            authenticated: false,
            error: err.message || 'Failed to check GCP status'
        });
    }
}

class AgentPlatformChatViewProvider {
    constructor(extensionUri, state, rpc, hooks, skills) {
        this._extensionUri = extensionUri;
        this._state = state;
        this._rpc = rpc;
        this._hooks = hooks;
        this._skills = skills;
    }

    resolveWebviewView(webviewView, context, _token) {
        this._view = webviewView;

        webviewView.webview.options = {
            enableScripts: true,
            localResourceRoots: [this._extensionUri]
        };

        webviewView.webview.html = this._getHtmlForWebview(webviewView.webview);

        // Register Webview with StateManager for cross-sidebar synchronization
        this._state.registerWebview(webviewView.webview);

        webviewView.onDidDispose(() => {
            this._state.unregisterWebview(webviewView.webview);
        });

        webviewView.webview.onDidReceiveMessage(async (data) => {
            switch (data.type) {
                case 'sendMessage': {
                    await this._handleUserMessage(data.prompt, data.model, data.language);
                    break;
                }
                case 'checkStatus': {
                    await checkGcpStatus();
                    break;
                }
                case 'openSettings': {
                    vscode.commands.executeCommand('workbench.action.openSettings', 'agentPlatform');
                    break;
                }
                case 'getSkillSuggestions': {
                    const suggestions = this._skills.getSuggestions(data.query);
                    webviewView.webview.postMessage({
                        type: 'skillSuggestions',
                        suggestions
                    });
                    break;
                }
            }
        });
    }

    async _handleUserMessage(prompt, model, language) {
        if (!prompt || !prompt.trim()) return;

        // 1. Add user message to StateManager and broadcast immediately
        this._state.addMessage('user', prompt);

        // 2. PreToolUse security verification via HookManager
        const hookCheck = this._hooks.verifyPreToolUse(prompt);
        if (!hookCheck.allowed) {
            this._state.addMessage('system', hookCheck.reason);
            return;
        }

        // 3. Slash command (Skill) detection and prompt injection
        let effectivePrompt = prompt;
        let activeSkill = null;
        if (prompt.startsWith('/')) {
            const skillName = prompt.split(' ')[0].replace('/', '');
            activeSkill = this._skills.getSkill(skillName);
            if (activeSkill) {
                effectivePrompt = `[Applied Skill: ${activeSkill.name}]\n${activeSkill.content}\n\n[User Instruction]:\n${prompt}`;
            }
        }

        // 4. Add loading agent message
        const agentMsg = this._state.addMessage('agent', '...', { status: 'loading' });

        try {
            // 5. Dispatch request to Python JSON-RPC daemon
            const response = await this._rpc.call('chat/sendMessage', {
                prompt: effectivePrompt,
                model: model || this._state.selectedModel,
                language: language || this._state.targetLanguage
            });

            if (response && response.text) {
                this._state.updateMessage(agentMsg.id, {
                    text: response.text,
                    status: 'complete',
                    usage: response.usage
                });
            } else {
                this._state.updateMessage(agentMsg.id, {
                    text: 'Failed to receive a valid response.',
                    status: 'error'
                });
            }
        } catch (err) {
            this._state.updateMessage(agentMsg.id, {
                text: `Error: ${err.message || 'Unknown RPC Error'}`,
                status: 'error'
            });
        }
    }

    _getHtmlForWebview(webview) {
        return `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Google Cloud Agent Chat</title>
    <style>
        :root {
            --bg-color: #1e1e2e;
            --card-bg: rgba(255, 255, 255, 0.05);
            --border-color: rgba(255, 255, 255, 0.1);
            --primary-accent: #89b4fa;
            --user-bubble: #313244;
            --agent-bubble: #181825;
            --text-color: #cdd6f4;
            --muted-text: #a6adc8;
            --success-color: #a6e3a1;
            --error-color: #f38ba8;
            --warning-color: #f9e2af;
        }

        body {
            font-family: var(--vscode-font-family, 'Segoe UI', sans-serif);
            background-color: var(--vscode-sideBar-background, var(--bg-color));
            color: var(--vscode-sideBar-foreground, var(--text-color));
            margin: 0;
            padding: 10px;
            display: flex;
            flex-direction: column;
            height: 100vh;
            box-sizing: border-box;
        }

        .header {
            display: flex;
            flex-direction: column;
            gap: 8px;
            padding-bottom: 8px;
            border-bottom: 1px solid var(--border-color);
            margin-bottom: 8px;
        }

        .top-row {
            display: flex;
            justify-content: space-between;
            align-items: center;
            gap: 6px;
        }

        .project-badge {
            display: inline-flex;
            align-items: center;
            gap: 5px;
            padding: 3px 8px;
            border-radius: 12px;
            font-size: 0.72rem;
            font-weight: 600;
            background: rgba(255, 255, 255, 0.06);
            border: 1px solid var(--border-color);
            cursor: pointer;
            user-select: none;
            overflow: hidden;
            text-overflow: ellipsis;
            white-space: nowrap;
            max-width: 60%;
        }

        .project-badge .status-dot {
            width: 7px;
            height: 7px;
            border-radius: 50%;
            background-color: #888;
            flex-shrink: 0;
        }

        .project-badge.connected .status-dot {
            background-color: var(--success-color);
            box-shadow: 0 0 6px var(--success-color);
        }

        .project-badge.disconnected .status-dot {
            background-color: var(--error-color);
            box-shadow: 0 0 6px var(--error-color);
        }

        .right-controls {
            display: flex;
            align-items: center;
            gap: 4px;
        }

        .model-select {
            background: var(--vscode-dropdown-background, #313244);
            color: var(--vscode-dropdown-foreground, #cdd6f4);
            border: 1px solid var(--border-color);
            padding: 3px 6px;
            border-radius: 4px;
            font-size: 0.75rem;
            outline: none;
        }

        .icon-btn {
            background: transparent;
            color: var(--vscode-sideBar-foreground, var(--text-color));
            border: none;
            border-radius: 4px;
            padding: 4px;
            display: inline-flex;
            align-items: center;
            justify-content: center;
            cursor: pointer;
            opacity: 0.8;
        }
        .icon-btn:hover { opacity: 1; background: rgba(255,255,255,0.1); }
        .icon-btn svg { width: 14px; height: 14px; fill: currentColor; }

        .chat-container {
            flex: 1;
            overflow-y: auto;
            display: flex;
            flex-direction: column;
            gap: 10px;
            padding-right: 4px;
        }

        .message {
            max-width: 90%;
            padding: 8px 12px;
            border-radius: 8px;
            font-size: 0.85rem;
            line-height: 1.45;
            word-wrap: break-word;
            white-space: pre-wrap;
            box-shadow: 0 2px 4px rgba(0,0,0,0.15);
        }

        .message.user {
            align-self: flex-end;
            background: #3b4252;
            color: #eceff4;
            border-bottom-right-radius: 2px;
        }

        .message.agent {
            align-self: flex-start;
            background: #2e3440;
            color: #d8dee9;
            border-bottom-left-radius: 2px;
            border: 1px solid var(--border-color);
        }

        .message.system {
            align-self: center;
            background: rgba(249, 226, 175, 0.12);
            color: var(--warning-color);
            border: 1px solid var(--warning-color);
            font-size: 0.78rem;
        }

        .message.error {
            align-self: center;
            background: rgba(243, 139, 168, 0.15);
            color: var(--error-color);
            border: 1px solid var(--error-color);
            font-size: 0.8rem;
        }

        .input-wrapper {
            position: relative;
            margin-top: 8px;
            border-top: 1px solid var(--border-color);
            padding-top: 8px;
        }

        .autocomplete-dropdown {
            position: absolute;
            bottom: 100%;
            left: 0;
            right: 0;
            background: #181825;
            border: 1px solid var(--border-color);
            border-radius: 6px;
            max-height: 160px;
            overflow-y: auto;
            display: none;
            flex-direction: column;
            box-shadow: 0 -4px 12px rgba(0,0,0,0.3);
            z-index: 100;
        }

        .autocomplete-item {
            padding: 6px 10px;
            cursor: pointer;
            font-size: 0.8rem;
            display: flex;
            flex-direction: column;
            gap: 2px;
            border-bottom: 1px solid rgba(255,255,255,0.05);
        }

        .autocomplete-item:hover, .autocomplete-item.selected {
            background: rgba(137, 180, 250, 0.15);
        }

        .autocomplete-item .name { font-weight: bold; color: var(--primary-accent); }
        .autocomplete-item .desc { font-size: 0.72rem; color: var(--muted-text); }

        .input-area {
            display: flex;
            gap: 6px;
        }

        textarea {
            flex: 1;
            background: var(--vscode-input-background, #313244);
            color: var(--vscode-input-foreground, #cdd6f4);
            border: 1px solid var(--border-color);
            border-radius: 6px;
            padding: 8px;
            font-family: inherit;
            font-size: 0.85rem;
            resize: none;
            outline: none;
            height: 38px;
        }

        textarea:focus { border-color: var(--primary-accent); }

        button.send-btn {
            background: #89b4fa;
            color: #11111b;
            border: none;
            border-radius: 6px;
            padding: 0 12px;
            font-weight: bold;
            cursor: pointer;
        }

        button.send-btn:hover { opacity: 0.85; }
    </style>
</head>
<body>
    <div class="header">
        <div class="top-row">
            <!-- PROJECT ID Label Badge -->
            <div class="project-badge disconnected" id="projectBadge" title="Click to refresh GCP Status">
                <span class="status-dot"></span>
                <span id="projectLabel">PROJECT ID: None</span>
            </div>
            <div class="right-controls">
                <select class="model-select" id="modelSelect" title="Select Model">
                    <option value="gemini-3.7-flash" selected>gemini-3.7-flash</option>
                    <option value="gemini-3.6-flash">gemini-3.6-flash</option>
                    <option value="gemini-2.5-flash">gemini-2.5-flash</option>
                    <option value="gemini-2.5-pro">gemini-2.5-pro</option>
                </select>
                <button class="icon-btn" id="settingsBtn" title="Settings">
                    <svg viewBox="0 0 16 16"><path d="M9.1 4.4L8.6 2H7.4l-.5 2.4-.7.3-2-1.3-.9.8 1.3 2-.2.7-2.5.5v1.2l2.5.5.3.8-1.4 1.9.8.8 2-1.3.8.3.4 2.5h1.2l.5-2.5.7-.3 2 1.3.8-.8-1.3-2 .3-.7 2.4-.5V7.4l-2.4-.5-.3-.7 1.3-2-.8-.8-2 1.3-.7-.3zM8 10c-1.1 0-2-.9-2-2s.9-2 2-2 2 .9 2 2-.9 2-2 2z"/></svg>
                </button>
            </div>
        </div>
    </div>

    <div class="chat-container" id="chatContainer">
        <div class="message agent">Connected to Google Cloud Agent Platform. How can I assist you today?</div>
    </div>

    <div class="input-wrapper">
        <div class="autocomplete-dropdown" id="autoDropdown"></div>
        <div class="input-area">
            <textarea id="promptInput" placeholder="Type a message... (type / for skills)"></textarea>
            <button class="send-btn" id="sendBtn">Send</button>
        </div>
    </div>

    <script>
        const vscode = acquireVsCodeApi();
        const chatContainer = document.getElementById('chatContainer');
        const promptInput = document.getElementById('promptInput');
        const sendBtn = document.getElementById('sendBtn');
        const modelSelect = document.getElementById('modelSelect');
        const settingsBtn = document.getElementById('settingsBtn');
        const projectBadge = document.getElementById('projectBadge');
        const projectLabel = document.getElementById('projectLabel');
        const autoDropdown = document.getElementById('autoDropdown');

        function renderMessages(messages) {
            chatContainer.innerHTML = '';
            messages.forEach(msg => appendMessageDOM(msg));
            chatContainer.scrollTop = chatContainer.scrollHeight;
        }

        function appendMessageDOM(msg) {
            let el = document.getElementById(msg.id);
            if (!el) {
                el = document.createElement('div');
                el.id = msg.id;
                el.className = 'message ' + msg.sender + (msg.status === 'error' ? ' error' : '');
                chatContainer.appendChild(el);
            }
            el.textContent = msg.text;
            chatContainer.scrollTop = chatContainer.scrollHeight;
        }

        function sendMessage() {
            const text = promptInput.value.trim();
            if (!text) return;

            vscode.postMessage({
                type: 'sendMessage',
                prompt: text,
                model: modelSelect.value,
                language: 'auto'
            });

            promptInput.value = '';
            autoDropdown.style.display = 'none';
        }

        sendBtn.addEventListener('click', sendMessage);

        settingsBtn.addEventListener('click', () => {
            vscode.postMessage({ type: 'openSettings' });
        });

        projectBadge.addEventListener('click', () => {
            projectLabel.textContent = 'Checking...';
            vscode.postMessage({ type: 'checkStatus' });
        });

        promptInput.addEventListener('keydown', (e) => {
            if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                sendMessage();
            }
        });

        // Slash command autocomplete
        promptInput.addEventListener('input', () => {
            const val = promptInput.value;
            if (val.startsWith('/')) {
                vscode.postMessage({ type: 'getSkillSuggestions', query: val });
            } else {
                autoDropdown.style.display = 'none';
            }
        });

        window.addEventListener('message', event => {
            const msg = event.data;
            switch (msg.type) {
                case 'syncState': {
                    if (msg.messages) renderMessages(msg.messages);
                    if (msg.model) modelSelect.value = msg.model;
                    if (msg.gcpStatus) updateGcpBadge(msg.gcpStatus);
                    break;
                }
                case 'addMessage': {
                    appendMessageDOM(msg.message);
                    break;
                }
                case 'updateMessage': {
                    appendMessageDOM(msg.message);
                    break;
                }
                case 'gcpStatus': {
                    updateGcpBadge(msg.gcpStatus);
                    break;
                }
                case 'skillSuggestions': {
                    renderSuggestions(msg.suggestions);
                    break;
                }
            }
        });

        function updateGcpBadge(status) {
            if (status.authenticated && status.projectId) {
                projectBadge.className = 'project-badge connected';
                projectLabel.textContent = 'PROJECT ID: ' + status.projectId;
                projectBadge.title = 'Connected: ' + status.projectId + ' (' + (status.account || 'ADC') + ')';
            } else {
                projectBadge.className = 'project-badge disconnected';
                projectLabel.textContent = 'PROJECT ID: None';
                projectBadge.title = status.error || 'Click to configure Project ID';
            }
        }

        function renderSuggestions(suggestions) {
            if (!suggestions || suggestions.length === 0) {
                autoDropdown.style.display = 'none';
                return;
            }
            autoDropdown.innerHTML = '';
            suggestions.forEach(s => {
                const item = document.createElement('div');
                item.className = 'autocomplete-item';
                item.innerHTML = '<span class="name">/' + s.name + '</span><span class="desc">' + s.description + '</span>';
                item.addEventListener('click', () => {
                    promptInput.value = '/' + s.name + ' ';
                    autoDropdown.style.display = 'none';
                    promptInput.focus();
                });
                autoDropdown.appendChild(item);
            });
            autoDropdown.style.display = 'flex';
        }
    </script>
</body>
</html>`;
    }
}

function deactivate() {
    if (rpcClient) {
        rpcClient.dispose();
    }
}

module.exports = {
    activate,
    deactivate
};
