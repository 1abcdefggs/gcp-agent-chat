const vscode = require('vscode');
const { execFile } = require('child_process');
const path = require('path');
const fs = require('fs');

function activate(context) {
    const provider = new AgentPlatformChatViewProvider(context.extensionUri);

    context.subscriptions.push(
        vscode.window.registerWebviewViewProvider('agent-platform-chat-view', provider)
    );

    context.subscriptions.push(
        vscode.window.registerWebviewViewProvider('agent-platform-chat-view-secondary', provider)
    );
}

class AgentPlatformChatViewProvider {
    constructor(extensionUri) {
        this._extensionUri = extensionUri;
    }

    resolveWebviewView(webviewView, context, _token) {
        this._view = webviewView;

        webviewView.webview.options = {
            enableScripts: true,
            localResourceRoots: [this._extensionUri]
        };

        webviewView.webview.html = this._getHtmlForWebview(webviewView.webview);

        webviewView.webview.onDidReceiveMessage(async (data) => {
            switch (data.type) {
                case 'sendMessage': {
                    this._handleUserMessage(data.prompt, data.model, data.language);
                    break;
                }
                case 'openSettings': {
                    vscode.commands.executeCommand('workbench.action.openSettings', 'agentPlatform');
                    break;
                }
                case 'checkStatus': {
                    this._checkGcpStatus();
                    break;
                }
            }
        });

        // Auto-check GCP connection status on load
        this._checkGcpStatus();
    }

    _getEnv() {
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

    _getBridgeScript(workspaceFolder) {
        const candidates = [
            path.join(__dirname, 'chat_bridge.py'),
            path.join(workspaceFolder, 'src', 'chat_bridge.py'),
            path.join(workspaceFolder, 'chat_bridge.py')
        ];
        return candidates.find(p => fs.existsSync(p)) || candidates[0];
    }

    _checkGcpStatus() {
        const workspaceFolder = vscode.workspace.workspaceFolders?.[0]?.uri.fsPath || __dirname;
        const bridgeScript = this._getBridgeScript(workspaceFolder);
        const customEnv = this._getEnv();

        execFile('python', [bridgeScript, '--status'], { cwd: workspaceFolder, env: customEnv }, (error, stdout) => {
            if (error) {
                this._view?.webview.postMessage({
                    type: 'gcpStatus',
                    authenticated: false,
                    projectId: customEnv.GOOGLE_CLOUD_PROJECT || null,
                    error: 'Bridge script error'
                });
                return;
            }

            try {
                const result = JSON.parse(stdout.trim());
                this._view?.webview.postMessage({
                    type: 'gcpStatus',
                    authenticated: result.authenticated,
                    projectId: result.project_id,
                    account: result.account,
                    error: result.error
                });
            } catch (e) {
                this._view?.webview.postMessage({
                    type: 'gcpStatus',
                    authenticated: false,
                    projectId: customEnv.GOOGLE_CLOUD_PROJECT || null,
                    error: 'Parsing status error'
                });
            }
        });
    }

    _handleUserMessage(prompt, model, language) {
        const workspaceFolder = vscode.workspace.workspaceFolders?.[0]?.uri.fsPath || __dirname;
        const bridgeScript = this._getBridgeScript(workspaceFolder);
        const config = vscode.workspace.getConfiguration('agentPlatform');
        const defaultLang = config.get('language') || 'auto';
        const targetLang = language || defaultLang;

        const customEnv = this._getEnv();

        execFile('python', [bridgeScript, prompt, model, targetLang], { cwd: workspaceFolder, env: customEnv }, (error, stdout, stderr) => {
            if (error) {
                this._view?.webview.postMessage({
                    type: 'addResponse',
                    success: false,
                    error: stderr || error.message || 'Execution error'
                });
                return;
            }

            try {
                const result = JSON.parse(stdout.trim());
                this._view?.webview.postMessage({
                    type: 'addResponse',
                    success: result.success,
                    text: result.text,
                    error: result.error
                });
            } catch (e) {
                this._view?.webview.postMessage({
                    type: 'addResponse',
                    success: false,
                    error: 'Failed to parse JSON response: ' + stdout
                });
            }
        });
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
        }

        body {
            font-family: var(--vscode-font-family, 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif);
            background-color: var(--vscode-sideBar-background, var(--bg-color));
            color: var(--vscode-sideBar-foreground, var(--text-color));
            margin: 0;
            padding: 12px;
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
            margin-bottom: 10px;
        }

        .top-row {
            display: flex;
            justify-content: space-between;
            align-items: center;
        }

        .title-container {
            display: flex;
            align-items: center;
            gap: 6px;
        }

        .title-container h3 {
            margin: 0;
            font-size: 0.95rem;
            font-weight: 600;
        }

        .actions-container {
            display: flex;
            align-items: center;
            gap: 6px;
        }

        .status-badge {
            display: inline-flex;
            align-items: center;
            gap: 5px;
            padding: 3px 8px;
            border-radius: 12px;
            font-size: 0.72rem;
            font-weight: 500;
            background: rgba(255, 255, 255, 0.06);
            border: 1px solid var(--border-color);
            cursor: pointer;
            user-select: none;
            transition: background 0.2s;
        }

        .status-badge:hover {
            background: rgba(255, 255, 255, 0.12);
        }

        .status-dot {
            width: 7px;
            height: 7px;
            border-radius: 50%;
            background-color: #888;
        }

        .status-badge.connected .status-dot {
            background-color: var(--success-color);
            box-shadow: 0 0 6px var(--success-color);
        }

        .status-badge.disconnected .status-dot {
            background-color: var(--error-color);
            box-shadow: 0 0 6px var(--error-color);
        }

        .icon-button {
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
            transition: opacity 0.2s, background 0.2s;
        }

        .icon-button:hover {
            opacity: 1;
            background: rgba(255, 255, 255, 0.1);
        }

        .icon-button svg {
            width: 16px;
            height: 16px;
            fill: currentColor;
        }

        .controls-row {
            display: flex;
            gap: 4px;
            width: 100%;
        }

        select {
            flex: 1;
            background: var(--vscode-dropdown-background, #313244);
            color: var(--vscode-dropdown-foreground, #cdd6f4);
            border: 1px solid var(--border-color);
            padding: 4px 6px;
            border-radius: 4px;
            font-size: 0.8rem;
            outline: none;
        }

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
            line-height: 1.4;
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

        .message.error {
            align-self: center;
            background: rgba(243, 139, 168, 0.15);
            color: #f38ba8;
            border: 1px solid #f38ba8;
            font-size: 0.8rem;
        }

        .input-area {
            display: flex;
            gap: 6px;
            margin-top: 10px;
            padding-top: 8px;
            border-top: 1px solid var(--border-color);
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

        textarea:focus {
            border-color: var(--primary-accent);
        }

        button.send-btn {
            background: #89b4fa;
            color: #11111b;
            border: none;
            border-radius: 6px;
            padding: 0 12px;
            font-weight: bold;
            cursor: pointer;
            transition: opacity 0.2s;
        }

        button.send-btn:hover {
            opacity: 0.85;
        }

        button.send-btn:disabled {
            opacity: 0.4;
            cursor: not-allowed;
        }

        .loading {
            font-size: 0.8rem;
            color: var(--muted-text);
            font-style: italic;
            margin-left: 6px;
        }
    </style>
</head>
<body>
    <div class="header">
        <div class="top-row">
            <div class="title-container">
                <h3>☁️ Agent Platform</h3>
            </div>
            <div class="actions-container">
                <div class="status-badge disconnected" id="statusBadge" title="Click to refresh GCP Connection Status">
                    <span class="status-dot"></span>
                    <span id="statusText">Connecting...</span>
                </div>
                <button class="icon-button" id="settingsBtn" title="Open Settings">
                    <svg viewBox="0 0 16 16" fill="currentColor">
                        <path d="M9.1 0.1c-.2-.1-.5-.1-.7 0l-.8.4c-.2.1-.4.3-.5.5L6.8 2c-.3.1-.6.3-.9.4l-.8-.3c-.3-.1-.6 0-.8.2L3.5 3.1c-.2.2-.3.5-.2.8l.3.8c-.2.3-.4.6-.5.9l-.8.3c-.3.1-.5.3-.5.6v1c0 .3.2.5.5.6l.8.3c.1.3.3.6.5.9l-.3.8c-.1.3 0 .6.2.8l.8.8c.2.2.5.3.8.2l.8-.3c.3.2.6.4.9.5l.3.8c.1.3.3.5.6.5h1c.3 0 .5-.2.6-.5l.3-.8c.3-.1.6-.3.9-.5l.8.3c.3.1.6 0 .8-.2l.8-.8c.2-.2.3-.5.2-.8l-.3-.8c.2-.3.4-.6.5-.9l.8-.3c.3-.1.5-.3.5-.6v-1c0-.3-.2-.5-.5-.6l-.8-.3c-.1-.3-.3-.6-.5-.9l.3-.8c.1-.3 0-.6-.2-.8l-.8-.8c-.2-.2-.5-.3-.8-.2l-.8.3c-.3-.2-.6-.4-.9-.5l-.3-.8c-.1-.2-.3-.4-.5-.5l-.8-.4zM8 10.5c-1.4 0-2.5-1.1-2.5-2.5s1.1-2.5 2.5-2.5 2.5 1.1 2.5 2.5-1.1 2.5-2.5 2.5z"/>
                    </svg>
                </button>
            </div>
        </div>
        <div class="controls-row">
            <select id="langSelect" title="Language">
                <option value="auto" selected>🌐 Auto</option>
                <option value="ja">🇯🇵 日本語</option>
                <option value="en">🇺🇸 English</option>
                <option value="es">🇪🇸 Español</option>
                <option value="zh">🇨🇳 中文</option>
                <option value="de">🇩🇪 Deutsch</option>
                <option value="fr">🇫🇷 Français</option>
                <option value="it">🇮🇹 Italiano</option>
                <option value="pt">🇵🇹 Português</option>
                <option value="ru">🇷🇺 Русский</option>
                <option value="ko">🇰🇷 한국어</option>
                <option value="ar">🇸🇦 العربية</option>
                <option value="hi">🇮🇳 हिन्दी</option>
                <option value="nl">🇳🇱 Nederlands</option>
            </select>
            <select id="modelSelect" title="Model">
                <option value="gemini-2.5-flash">gemini-2.5-flash</option>
                <option value="gemini-3.5-flash">gemini-3.5-flash</option>
                <option value="gemini-3.6-flash">gemini-3.6-flash</option>
                <option value="gemini-3.7-flash" selected>gemini-3.7-flash</option>
            </select>
        </div>
    </div>

    <div class="chat-container" id="chatContainer">
        <div class="message agent">Hello! Connected to Google Cloud Agent Platform. How can I assist you today?</div>
    </div>

    <div class="input-area">
        <textarea id="promptInput" placeholder="Type a message... (Press Enter to send)"></textarea>
        <button class="send-btn" id="sendBtn">Send</button>
    </div>

    <script>
        const vscode = acquireVsCodeApi();
        const chatContainer = document.getElementById('chatContainer');
        const promptInput = document.getElementById('promptInput');
        const sendBtn = document.getElementById('sendBtn');
        const modelSelect = document.getElementById('modelSelect');
        const langSelect = document.getElementById('langSelect');
        const settingsBtn = document.getElementById('settingsBtn');
        const statusBadge = document.getElementById('statusBadge');
        const statusText = document.getElementById('statusText');

        function sendMessage() {
            const prompt = promptInput.value.trim();
            if (!prompt) return;

            addMessage(prompt, 'user');
            promptInput.value = '';
            sendBtn.disabled = true;

            const loadingDiv = document.createElement('div');
            loadingDiv.className = 'loading';
            loadingDiv.id = 'loadingIndicator';
            loadingDiv.textContent = 'Agent thinking...';
            chatContainer.appendChild(loadingDiv);
            chatContainer.scrollTop = chatContainer.scrollHeight;

            vscode.postMessage({
                type: 'sendMessage',
                prompt: prompt,
                model: modelSelect.value,
                language: langSelect.value
            });
        }

        function addMessage(text, sender) {
            const msgDiv = document.createElement('div');
            msgDiv.className = 'message ' + sender;
            msgDiv.textContent = text;
            chatContainer.appendChild(msgDiv);
            chatContainer.scrollTop = chatContainer.scrollHeight;
        }

        sendBtn.addEventListener('click', sendMessage);

        settingsBtn.addEventListener('click', () => {
            vscode.postMessage({ type: 'openSettings' });
        });

        statusBadge.addEventListener('click', () => {
            statusText.textContent = 'Checking...';
            vscode.postMessage({ type: 'checkStatus' });
        });

        promptInput.addEventListener('keydown', (e) => {
            if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                sendMessage();
            }
        });

        window.addEventListener('message', event => {
            const message = event.data;
            if (message.type === 'addResponse') {
                const loading = document.getElementById('loadingIndicator');
                if (loading) loading.remove();
                sendBtn.disabled = false;

                if (message.success) {
                    addMessage(message.text, 'agent');
                } else {
                    addMessage('An error occurred: ' + (message.error || 'Unknown error'), 'error');
                }
            } else if (message.type === 'gcpStatus') {
                if (message.authenticated && message.projectId) {
                    statusBadge.className = 'status-badge connected';
                    statusText.textContent = message.projectId;
                    statusBadge.title = 'Connected to GCP Project: ' + message.projectId + ' (' + (message.account || 'ADC') + '). Click to refresh.';
                } else {
                    statusBadge.className = 'status-badge disconnected';
                    statusText.textContent = 'Unconfigured';
                    statusBadge.title = (message.error || 'GCP Project ID not configured') + '. Click to refresh or click Settings to configure.';
                }
            }
        });
    </script>
</body>
</html>`;
    }
}

function deactivate() {}

module.exports = {
    activate,
    deactivate
};
