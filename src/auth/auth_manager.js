const vscode = require('vscode');
const cp = require('child_process');

class AuthManager {
    /**
     * Resolve the active Google Cloud credentials and token based on user configuration.
     * @returns {Promise<{ mode: string, token?: string, account?: string, error?: string }>}
     */
    static async resolveCredentials() {
        const config = vscode.workspace.getConfiguration('gcpAgentChat');
        const authMode = config.get('authMode') || 'auto';

        // 1. Try IDE Google Authentication if mode is 'auto' or 'ide'
        if (authMode === 'auto' || authMode === 'ide') {
            try {
                const session = await vscode.authentication.getSession(
                    'google',
                    [
                        'https://www.googleapis.com/auth/cloud-platform',
                        'https://www.googleapis.com/auth/userinfo.email'
                    ],
                    { createIfNone: false }
                );

                if (session && session.accessToken) {
                    return {
                        mode: 'ide',
                        token: session.accessToken,
                        account: session.account?.label || 'Antigravity IDE User'
                    };
                }
            } catch (err) {
                // If IDE auth session is not found or not permitted, fall through if mode is 'auto'
                if (authMode === 'ide') {
                    return {
                        mode: 'ide',
                        error: `IDE Google login not found: ${err.message}`
                    };
                }
            }
        }

        // 2. If mode is 'gcloud', 'serviceAccount', or 'auto' fallback
        return {
            mode: authMode === 'ide' ? 'ide' : (authMode === 'serviceAccount' ? 'serviceAccount' : 'gcloud'),
            token: undefined,
            account: undefined
        };
    }

    /**
     * Display the interactive Authentication Manager menu (QuickPick).
     */
    static async showAuthQuickPick(currentStatus, onRefresh) {
        const config = vscode.workspace.getConfiguration('gcpAgentChat');
        const currentMode = config.get('authMode') || 'auto';
        const currentProject = currentStatus?.projectId || config.get('projectId') || '(Not configured)';
        const isAuth = currentStatus?.authenticated;
        const currentAccount = currentStatus?.account || 'None';

        const items = [];

        // Header separator / info item
        items.push({
            label: `$(shield) GCP Connection: ${isAuth ? '$(check) Connected' : '$(x) Disconnected'}`,
            description: `Project: ${currentProject}`,
            detail: `Account: ${currentAccount} | Mode: ${currentMode}`,
            action: 'info'
        });

        // 1. IDE Login Option
        items.push({
            label: '$(account) Sign in with Antigravity IDE (Google Account)',
            description: 'Use IDE session token (No gcloud CLI required)',
            action: 'loginIde'
        });

        // 2. gcloud CLI Login Option
        items.push({
            label: '$(terminal) Sign in with gcloud CLI (application-default login)',
            description: 'Authenticate dedicated/external GCP account via browser (Google Auth Library)',
            action: 'loginGcloud'
        });

        // 3. Switch Auth Mode Option
        items.push({
            label: '$(sync) Switch Authentication Mode...',
            description: `Current mode: ${currentMode}`,
            action: 'switchMode'
        });

        // 4. Logout / Revoke Option
        if (isAuth) {
            items.push({
                label: '$(sign-out) Logout / Revoke Credentials',
                description: 'Clear active session or revoke gcloud ADC token',
                action: 'logout'
            });
        }

        // 5. Toggle Masking Option
        const isMasked = config.get('maskProjectId', true);
        items.push({
            label: isMasked ? '$(eye) Reveal Project ID in UI' : '$(eye-closed) Mask / Hide Project ID in UI',
            description: isMasked ? 'Currently masked (••••••) for privacy' : 'Currently visible in UI status badges',
            action: 'toggleMask'
        });

        // 6. Set / Edit Project ID Option
        items.push({
            label: '$(edit) Set / Edit Google Cloud Project ID...',
            description: `Configured: ${config.get('projectId') || '(Auto-detected: ' + currentProject + ')'}`,
            action: 'setProjectId'
        });

        // 7. Open Settings Option
        items.push({
            label: '$(gear) Configure All Settings...',
            description: 'Open gcpAgentChat VS Code settings',
            action: 'settings'
        });

        const selected = await vscode.window.showQuickPick(items, {
            placeHolder: 'Google Cloud Authentication & Account Manager'
        });

        if (!selected) return;

        switch (selected.action) {
            case 'loginIde': {
                try {
                    const session = await vscode.authentication.getSession(
                        'google',
                        [
                            'https://www.googleapis.com/auth/cloud-platform',
                            'https://www.googleapis.com/auth/userinfo.email'
                        ],
                        { createIfNone: true }
                    );
                    if (session) {
                        vscode.window.showInformationMessage(`Signed in as ${session.account.label} via Antigravity IDE.`);
                        if (currentMode !== 'auto' && currentMode !== 'ide') {
                            await config.update('authMode', 'auto', vscode.ConfigurationTarget.Global);
                        }
                        if (onRefresh) onRefresh();
                    }
                } catch (e) {
                    vscode.window.showErrorMessage(`IDE sign-in failed: ${e.message}`);
                }
                break;
            }

            case 'loginGcloud': {
                const terminal = vscode.window.createTerminal('Google Cloud Auth');
                terminal.show();
                terminal.sendText('gcloud auth application-default login');
                vscode.window.showInformationMessage(
                    'Running "gcloud auth application-default login". Complete the browser authorization. (Note: Google will send an official security email stating "Google Auth Library access granted" - this is expected and normal).',
                    'Got it'
                );
                break;
            }

            case 'switchMode': {
                const modeItems = [
                    { label: '$(sparkle) auto (Recommended)', description: 'Use IDE Google login if available, fallback to gcloud ADC', value: 'auto' },
                    { label: '$(account) ide', description: 'Always use Antigravity IDE Google Account', value: 'ide' },
                    { label: '$(terminal) gcloud', description: 'Use separate Google Cloud account via gcloud ADC', value: 'gcloud' },
                    { label: '$(key) serviceAccount', description: 'Use GOOGLE_APPLICATION_CREDENTIALS key file', value: 'serviceAccount' }
                ];
                const modeSelected = await vscode.window.showQuickPick(modeItems, {
                    placeHolder: 'Select Authentication Mode'
                });
                if (modeSelected) {
                    await config.update('authMode', modeSelected.value, vscode.ConfigurationTarget.Global);
                    vscode.window.showInformationMessage(`Authentication mode set to: ${modeSelected.value}`);
                    if (onRefresh) onRefresh();
                }
                break;
            }

            case 'logout': {
                const confirm = await vscode.window.showWarningMessage(
                    'Do you want to revoke Google Cloud credentials (gcloud auth application-default revoke)?',
                    'Revoke Credentials',
                    'Cancel'
                );
                if (confirm === 'Revoke Credentials') {
                    cp.exec('gcloud auth application-default revoke --quiet', (err) => {
                        if (err) {
                            vscode.window.showWarningMessage(`Credentials revoked locally.`);
                        } else {
                            vscode.window.showInformationMessage(`Google Cloud ADC credentials revoked successfully.`);
                        }
                        if (onRefresh) onRefresh();
                    });
                }
                break;
            }

            case 'toggleMask': {
                const currentMask = config.get('maskProjectId', true);
                await config.update('maskProjectId', !currentMask, vscode.ConfigurationTarget.Global);
                vscode.window.showInformationMessage(`Project ID is now ${!currentMask ? 'masked (hidden)' : 'visible'} in UI.`);
                if (onRefresh) onRefresh();
                break;
            }

            case 'setProjectId': {
                const defaultVal = config.get('projectId') || (currentStatus?.projectId && currentStatus.projectId !== '(Not configured)' ? currentStatus.projectId : '');
                const input = await vscode.window.showInputBox({
                    prompt: 'Enter Google Cloud Project ID (e.g., my-gcp-project)',
                    value: defaultVal,
                    placeHolder: 'my-gcp-project'
                });
                if (input !== undefined) {
                    await config.update('projectId', input.trim(), vscode.ConfigurationTarget.Global);
                    vscode.window.showInformationMessage(`Google Cloud Project ID updated to: ${input.trim() || '(Auto-detected)'}`);
                    if (onRefresh) onRefresh();
                }
                break;
            }

            case 'settings': {
                try {
                    await vscode.commands.executeCommand('workbench.action.openSettings', 'gcpAgentChat');
                } catch (e) {
                    await vscode.commands.executeCommand('workbench.action.openSettings');
                }
                break;
            }
        }
    }
}

module.exports = { AuthManager };
