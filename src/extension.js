const vscode = require('vscode');
const path = require('path');
const { ChatStateManager } = require('./state/chat_state_manager');
const { HookManager } = require('./agent/hook_manager');
const { SkillManager } = require('./agent/skill_manager');
const { CostTracker } = require('./cost/cost_tracker');
const { SessionStorage } = require('./storage/session_storage');
const { AuthManager } = require('./auth/auth_manager');
const { RpcClient } = require('./bridge/rpc_client');
const { GeminiClient } = require('./bridge/gemini_client');
const { PersonaManager } = require('./team/persona_registry');
const { ChiefOrchestrator } = require('./team/chief_orchestrator');
const { AgentPlatformChatViewProvider } = require('./editor/chat_view_provider');

let stateManager = null;
let hookManager = null;
let skillManager = null;
let costTracker = null;
let sessionStorage = null;
let rpcClient = null;
let geminiClient = null;
let orchestrator = null;

function activate(context) {
    stateManager = new ChatStateManager();
    hookManager = new HookManager();
    skillManager = new SkillManager();
    costTracker = new CostTracker(stateManager, context.globalState);

    const workspaceRoot = vscode.workspace.workspaceFolders?.[0]?.uri.fsPath || __dirname;
    const globalStoragePath = context.globalStorageUri?.fsPath || path.join(context.extensionPath, '.storage');
    sessionStorage = new SessionStorage(null, globalStoragePath, workspaceRoot);

    // Initialize Native Node.js Gemini Client
    geminiClient = new GeminiClient({ cwd: workspaceRoot });

    // Initialize Multi-Agent Persona & Orchestrator (Phase 3)
    const personaManager = new PersonaManager('office');
    orchestrator = new ChiefOrchestrator({
        personaManager,
        sendRpcPrompt: async ({ prompt }) => {
            const res = await geminiClient.sendMessage({ prompt });
            return res.text;
        }
    });

    const provider = new AgentPlatformChatViewProvider(
        context.extensionUri,
        stateManager,
        rpcClient,
        hookManager,
        skillManager,
        costTracker,
        sessionStorage,
        checkGcpStatus,
        geminiClient,
        orchestrator
    );

    // Register WebviewViewProvider for Activity Bar and Bottom/Secondary Panel
    context.subscriptions.push(
        vscode.window.registerWebviewViewProvider('gcp-agent-chat-chat-view', provider),
        vscode.window.registerWebviewViewProvider('gcp-agent-chat-chat-view-panel', provider)
    );

    // Register Commands
    context.subscriptions.push(
        vscode.commands.registerCommand('gcp-agent-chat.openChat', () => {
            vscode.commands.executeCommand('workbench.view.extension.gcp-agent-chat-sidebar');
        }),
        vscode.commands.registerCommand('gcp-agent-chat.openSettings', async () => {
            try {
                await vscode.commands.executeCommand('workbench.action.openSettings', 'gcpAgentChat');
            } catch (e) {
                await vscode.commands.executeCommand('workbench.action.openSettings');
            }
        }),
        vscode.commands.registerCommand('gcp-agent-chat.askAboutCode', async () => {
            const editor = vscode.window.activeTextEditor;
            if (!editor) {
                vscode.window.showWarningMessage('There are no editors open. Please open a file and try again.');
                return;
            }
            const selectedText = editor.document.getText(editor.selection);
            if (!selectedText) {
                vscode.window.showWarningMessage('No code is selected. Please select the code you want to ask about.');
                return;
            }
            const filename = path.basename(editor.document.fileName);
            const prompt = `Please explain/review the following code (${filename}):\n\`\`\`${editor.document.languageId}\n${selectedText}\n\`\`\``;

            await vscode.commands.executeCommand('workbench.view.extension.gcp-agent-chat-sidebar');
            stateManager.broadcast({ type: 'fillPrompt', prompt });
        })
    );

    // Initial GCP connection status verification
    checkGcpStatus();

    // Refresh environment when settings change
    context.subscriptions.push(
        vscode.workspace.onDidChangeConfiguration(e => {
            if (e.affectsConfiguration('gcpAgentChat')) {
                const cfg = vscode.workspace.getConfiguration('gcpAgentChat');
                if (e.affectsConfiguration('gcpAgentChat.model')) {
                    const m = cfg.get('model');
                    if (m) {
                        stateManager.selectedModel = m;
                        stateManager.broadcast({ type: 'selectModel', model: m });
                    }
                }
                if (e.affectsConfiguration('gcpAgentChat.language')) {
                    const l = cfg.get('language');
                    if (l) stateManager.targetLanguage = l;
                }
                if (e.affectsConfiguration('gcpAgentChat.pythonPath')) {
                    const p = cfg.get('pythonPath');
                    if (rpcClient) {
                        rpcClient.updatePythonPath(p);
                    }
                }
                if (e.affectsConfiguration('gcpAgentChat.enableRichAnimations')) {
                    const rich = cfg.get('enableRichAnimations', true);
                    stateManager.broadcast({ type: 'setRichAnimations', enabled: rich });
                }
                if (e.affectsConfiguration('gcpAgentChat.maskProjectId')) {
                    const masked = cfg.get('maskProjectId', true);
                    stateManager.broadcast({ type: 'setMaskProjectId', masked });
                }
                checkGcpStatus();
                costTracker.broadcastCurrentCost();
            }
        })
    );
}

function getEnv() {
    const config = vscode.workspace.getConfiguration('gcpAgentChat');
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
    stateManager.updateGcpStatus({ loading: true, error: null });
    const config = vscode.workspace.getConfiguration('gcpAgentChat');
    const projectId = config.get('projectId') || process.env.GOOGLE_CLOUD_PROJECT || '';
    const location = config.get('location') || process.env.GOOGLE_CLOUD_LOCATION || 'global';
    const auth = await AuthManager.resolveCredentials();

    try {
        let result;
        if (geminiClient) {
            result = await geminiClient.checkStatus({
                projectId,
                location,
                token: auth.token,
                account: auth.account,
                authMode: auth.mode
            });
        } else if (rpcClient) {
            result = await rpcClient.call('gcp/checkStatus', {
                projectId,
                location,
                token: auth.token,
                account: auth.account,
                authMode: auth.mode
            });
        } else {
            throw new Error('No status verification client available');
        }

        stateManager.updateGcpStatus({
            authenticated: result.authenticated,
            projectId: result.project_id || projectId,
            location: result.location || location,
            account: result.account || auth.account,
            authMode: result.auth_mode || auth.mode,
            error: result.error,
            loading: false
        });
    } catch (err) {
        stateManager.updateGcpStatus({
            authenticated: false,
            projectId: projectId || null,
            error: err.message || 'Failed to check GCP status',
            loading: false
        });
    }
}

function deactivate() {
    if (rpcClient) {
        rpcClient.dispose();
        rpcClient = null;
    }
}

module.exports = {
    activate,
    deactivate
};
