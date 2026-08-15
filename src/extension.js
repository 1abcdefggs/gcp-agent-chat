const vscode = require('vscode');
const path = require('path');
const { ChatStateManager } = require('./state/chat_state_manager');
const { HookManager } = require('./agent/hook_manager');
const { SkillManager } = require('./agent/skill_manager');
const { CostTracker } = require('./cost/cost_tracker');
const { SessionStorage } = require('./storage/session_storage');
const { AuthManager } = require('./auth/auth_manager');
const { RpcClient } = require('./bridge/rpc_client');
const { AgentPlatformChatViewProvider } = require('./editor/chat_view_provider');

let stateManager = null;
let hookManager = null;
let skillManager = null;
let costTracker = null;
let sessionStorage = null;
let rpcClient = null;

function activate(context) {
    stateManager = new ChatStateManager();
    hookManager = new HookManager();
    skillManager = new SkillManager();
    costTracker = new CostTracker(stateManager, context.globalState);

    const workspaceRoot = vscode.workspace.workspaceFolders?.[0]?.uri.fsPath || __dirname;
    const globalStoragePath = context.globalStorageUri?.fsPath || path.join(context.extensionPath, '.storage');
    sessionStorage = new SessionStorage(null, globalStoragePath, workspaceRoot);

    // Resolve path to python bridge script
    const bridgeScript = path.join(__dirname, 'chat_bridge.py');
    const customEnv = getEnv();

    // Initialize persistent JSON-RPC client
    rpcClient = new RpcClient(bridgeScript, {
        cwd: workspaceRoot,
        env: customEnv
    });

    const provider = new AgentPlatformChatViewProvider(
        context.extensionUri,
        stateManager,
        rpcClient,
        hookManager,
        skillManager,
        costTracker,
        sessionStorage,
        checkGcpStatus
    );

    // Register WebviewViewProvider for Activity Bar and Bottom/Secondary Panel
    context.subscriptions.push(
        vscode.window.registerWebviewViewProvider('agent-platform-chat-view', provider),
        vscode.window.registerWebviewViewProvider('agent-platform-chat-view-panel', provider)
    );

    // Register Commands
    context.subscriptions.push(
        vscode.commands.registerCommand('agent-platform.openChat', () => {
            vscode.commands.executeCommand('workbench.view.extension.agent-platform-sidebar');
        }),
        vscode.commands.registerCommand('agent-platform.openSettings', async () => {
            try {
                await vscode.commands.executeCommand('workbench.action.openSettings', 'agentPlatform');
            } catch (e) {
                await vscode.commands.executeCommand('workbench.action.openSettings');
            }
        }),
        vscode.commands.registerCommand('agent-platform.askAboutCode', async () => {
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

            await vscode.commands.executeCommand('workbench.view.extension.agent-platform-sidebar');
            stateManager.broadcast({ type: 'fillPrompt', prompt });
        })
    );

    // Initial GCP connection status verification
    checkGcpStatus();

    // Refresh environment when settings change
    context.subscriptions.push(
        vscode.workspace.onDidChangeConfiguration(e => {
            if (e.affectsConfiguration('agentPlatform')) {
                const config = vscode.workspace.getConfiguration('agentPlatform');
                if (e.affectsConfiguration('agentPlatform.model')) {
                    const m = config.get('model');
                    if (m) stateManager.selectedModel = m;
                }
                if (e.affectsConfiguration('agentPlatform.language')) {
                    const l = config.get('language');
                    if (l) stateManager.targetLanguage = l;
                }
                checkGcpStatus();
                costTracker.broadcastCurrentCost();
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
    const config = vscode.workspace.getConfiguration('agentPlatform');
    const projectId = config.get('projectId') || process.env.GOOGLE_CLOUD_PROJECT || '';
    const location = config.get('location') || process.env.GOOGLE_CLOUD_LOCATION || 'global';
    const auth = await AuthManager.resolveCredentials();

    try {
        const result = await rpcClient.call('gcp/checkStatus', {
            projectId,
            location,
            token: auth.token,
            account: auth.account,
            authMode: auth.mode
        });
        stateManager.updateGcpStatus({
            authenticated: result.authenticated,
            projectId: result.project_id || projectId,
            location: result.location || location,
            account: result.account || auth.account,
            authMode: result.auth_mode || auth.mode,
            error: result.error
        });
    } catch (err) {
        stateManager.updateGcpStatus({
            authenticated: false,
            projectId: projectId || null,
            error: err.message || 'Failed to check GCP status'
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
