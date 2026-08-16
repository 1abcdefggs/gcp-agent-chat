const vscode = require('vscode');
const fs = require('fs');
const path = require('path');
const { EditorBridge } = require('./editor_bridge');
const { ImageHandler } = require('../media/image_handler');
const { AuthManager } = require('../auth/auth_manager');

class AgentPlatformChatViewProvider {
    constructor(extensionUri, state, rpc, hooks, skills, cost, storage, checkGcpStatusFn) {
        this._extensionUri = extensionUri;
        this._state = state;
        this._rpc = rpc;
        this._hooks = hooks;
        this._skills = skills;
        this._cost = cost;
        this._storage = storage;
        this._checkGcpStatus = checkGcpStatusFn;
        this._view = null;
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
                case 'ready': {
                    webviewView.webview.postMessage({
                        type: 'syncState',
                        messages: this._state.messages,
                        model: this._state.selectedModel,
                        language: this._state.targetLanguage,
                        gcpStatus: this._state.gcpStatus,
                        availableModels: this._state.availableModels,
                        availableLanguages: this._state.availableLanguages
                    });
                    if (this._cost) this._cost.broadcastCurrentCost();
                    if (this._checkGcpStatus) await this._checkGcpStatus();
                    break;
                }
                case 'sendMessage': {
                    await this._handleUserMessage(data.prompt, data.model, data.language, data.images);
                    break;
                }
                case 'checkStatus': {
                    await AuthManager.showAuthQuickPick(this._state.gcpStatus, () => {
                        if (this._checkGcpStatus) this._checkGcpStatus();
                    });
                    break;
                }
                case 'openSettings': {
                    try {
                        await vscode.commands.executeCommand('workbench.action.openSettings', 'gcpAgentChat');
                    } catch (e) {
                        await vscode.commands.executeCommand('workbench.action.openSettings');
                    }
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
                case 'insertCode': {
                    await EditorBridge.insertToActiveEditor(data.code);
                    break;
                }
                case 'createFile': {
                    await EditorBridge.createNewDocument(data.code, data.language || 'javascript');
                    break;
                }
                case 'copyText': {
                    await EditorBridge.copyToClipboard(data.text);
                    break;
                }
                case 'exportMarkdown': {
                    this._storage.exportToMarkdown(this._state.messages);
                    break;
                }
                case 'newSession': {
                    this._storage.newSession();
                    this._state.clearMessages();
                    vscode.window.showInformationMessage('Started a new chat session.');
                    break;
                }
                case 'openSessionHistory': {
                    const sessions = this._storage.listSessions();
                    if (!sessions || sessions.length === 0) {
                        vscode.window.showInformationMessage('No saved chat sessions found.');
                        break;
                    }
                    const items = sessions.map(s => ({
                        label: `$(comment-discussion) ${s.preview}`,
                        description: `${s.messageCount} msgs`,
                        detail: `Session: ${s.sessionId} | ${new Date(s.updatedAt).toLocaleString()}`,
                        sessionId: s.sessionId
                    }));

                    const selected = await vscode.window.showQuickPick(items, {
                        placeHolder: 'Select a past session to resume...'
                    });

                    if (selected && selected.sessionId) {
                        const msgs = this._storage.loadSession(selected.sessionId);
                        this._state.setMessages(msgs);
                        vscode.window.showInformationMessage(`Loaded session: ${selected.sessionId}`);
                    }
                    break;
                }
            }
        });
    }

    async _handleUserMessage(prompt, model, language, images = []) {
        if (!prompt || !prompt.trim()) return;

        // Check budget limit
        if (this._cost && !this._cost.canSendRequest()) {
            this._state.addMessage('system', '[Warning] Your monthly budget limit has been reached, so the request has been blocked for safety. You can change the limit in the VS Code settings (gcpAgentChat.monthlyBudgetLimit).');
            return;
        }

        // 1. Add user message to StateManager and broadcast immediately
        const userMsg = this._state.addMessage('user', prompt, { hasImages: images && images.length > 0 });
        this._storage.appendMessage(userMsg);

        // 2. PreToolUse security verification via HookManager
        const hookCheck = this._hooks.verifyPreToolUse(prompt);
        if (!hookCheck.allowed) {
            const sysMsg = this._state.addMessage('system', hookCheck.reason);
            this._storage.appendMessage(sysMsg);
            return;
        }

        // 3. Slash command (Skill) detection and prompt injection
        let effectivePrompt = prompt;
        if (prompt.startsWith('/')) {
            const skillName = prompt.split(' ')[0].replace('/', '');
            const activeSkill = this._skills.getSkill(skillName);
            if (activeSkill) {
                effectivePrompt = `[Applied Skill: ${activeSkill.name}]\n${activeSkill.content}\n\n[User Instruction]:\n${prompt}`;
            }
        }

        // Process images if attached
        const processedImages = [];
        if (images && images.length > 0) {
            for (const imgUrl of images) {
                try {
                    const img = ImageHandler.processUploadedImage(imgUrl);
                    processedImages.push({
                        mimeType: img.mimeType,
                        data: img.base64Data
                    });
                } catch (e) {
                    console.error('Image processing error:', e);
                }
            }
        }

        // 4. Add loading agent message
        const agentMsg = this._state.addMessage('agent', '...', { status: 'loading' });

        try {
            const config = vscode.workspace.getConfiguration('gcpAgentChat');
            const projectId = config.get('projectId') || process.env.GOOGLE_CLOUD_PROJECT || '';
            const location = config.get('location') || process.env.GOOGLE_CLOUD_LOCATION || 'global';

            const targetLangId = language || this._state.targetLanguage;
            const langObj = require('../config/constants').SUPPORTED_LANGUAGES.find(l => l.id === targetLangId);
            const targetLangName = langObj ? langObj.name : 'Auto';

            const auth = await AuthManager.resolveCredentials();

            const response = await this._rpc.call('chat/sendMessage', {
                prompt: effectivePrompt,
                model: model || this._state.selectedModel,
                language: targetLangId,
                languageName: targetLangName,
                images: processedImages,
                projectId,
                location,
                token: auth.token,
                account: auth.account,
                authMode: auth.mode
            });

            if (!response || !response.success) {
                this._state.updateMessage(agentMsg.id, {
                    text: `Error: ${response?.error || 'Failed to receive a valid response.'}`,
                    status: 'error'
                });
                return;
            }

            // Track token usage and costs
            if (response.usage && this._cost) {
                this._cost.recordUsage(model || this._state.selectedModel, response.usage);
            }

            const finalMsg = {
                text: response.text || '(No text returned)',
                status: 'complete',
                usage: response.usage
            };

            this._state.updateMessage(agentMsg.id, finalMsg);
            this._storage.appendMessage(Object.assign({}, agentMsg, finalMsg));
        } catch (err) {
            this._state.updateMessage(agentMsg.id, {
                text: `Error: ${err.message || 'Unknown RPC Error'}`,
                status: 'error'
            });
        }
    }

    _getHtmlForWebview(webview) {
        const mediaPath = path.join(this._extensionUri.fsPath, 'src', 'media');
        const assetPath = path.join(this._extensionUri.fsPath, 'asset');
        const styleUri = webview.asWebviewUri(vscode.Uri.file(path.join(mediaPath, 'chat.css')));
        const markdownScriptUri = webview.asWebviewUri(vscode.Uri.file(path.join(mediaPath, 'markdown_renderer.js')));
        const scriptUri = webview.asWebviewUri(vscode.Uri.file(path.join(mediaPath, 'chat.js')));
        const logoUri = webview.asWebviewUri(vscode.Uri.file(path.join(assetPath, 'icon.png')));
        const htmlTemplatePath = path.join(mediaPath, 'chat.html');

        let html = fs.readFileSync(htmlTemplatePath, 'utf-8');
        html = html
            .replace(/\{\{cspSource\}\}/g, webview.cspSource)
            .replace(/\{\{styleUri\}\}/g, styleUri.toString())
            .replace(/\{\{markdownScriptUri\}\}/g, markdownScriptUri.toString())
            .replace(/\{\{scriptUri\}\}/g, scriptUri.toString())
            .replace(/\{\{logoUri\}\}/g, logoUri.toString());

        return html;
    }
}

module.exports = { AgentPlatformChatViewProvider };
