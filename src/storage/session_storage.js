const fs = require('fs');
const path = require('path');
const os = require('os');
const vscode = require('vscode');

class SessionStorage {
    constructor(sessionId, globalStoragePath, workspaceRoot) {
        this.sessionId = sessionId || `session_${Date.now()}`;
        this.workspaceRoot = workspaceRoot || process.cwd();
        this.globalStoragePath = globalStoragePath || path.join(os.homedir(), '.gemini', 'agent-platform');

        const config = vscode.workspace.getConfiguration('agentPlatform');
        const locationSetting = config.get('sessionStorageLocation') || 'global';

        if (locationSetting === 'workspace') {
            this.sessionDir = path.join(this.workspaceRoot, '.agents', 'sessions');
        } else {
            this.sessionDir = path.join(this.globalStoragePath, 'sessions');
        }

        this.jsonlPath = path.join(this.sessionDir, `${this.sessionId}.jsonl`);
        this._ensureDirectory();
    }

    _ensureDirectory() {
        try {
            if (!fs.existsSync(this.sessionDir)) {
                fs.mkdirSync(this.sessionDir, { recursive: true });
            }
        } catch (err) {
            console.error('Failed to create session directory:', err);
        }
    }

    /** JSONL append (Managed Artifact) */
    appendMessage(message) {
        try {
            const line = JSON.stringify(message) + '\n';
            fs.appendFileSync(this.jsonlPath, line, 'utf8');
        } catch (err) {
            console.error('Failed to append message to JSONL:', err);
        }
    }

    /** Export conversation as Markdown (Managed Artifact) */
    exportToMarkdown(messages) {
        try {
            const now = new Date();
            const dateStr = now.toISOString().replace(/[:.]/g, '-').slice(0, 19);
            const exportDir = path.join(this.workspaceRoot, '.agents', 'artifacts');
            if (!fs.existsSync(exportDir)) {
                fs.mkdirSync(exportDir, { recursive: true });
            }

            const filename = `chat_${dateStr}.md`;
            const filePath = path.join(exportDir, filename);

            let content = `# Google Cloud Agent Chat Session Export\n`;
            content += `> **Date:** ${now.toLocaleString()} | **Session ID:** \`${this.sessionId}\`\n\n---\n\n`;

            for (const msg of messages) {
                const role = msg.sender === 'user' ? '**User**' : '**Agent**';
                content += `### ${role} (${new Date(msg.timestamp || Date.now()).toLocaleTimeString()})\n\n`;
                content += `${msg.text}\n\n---\n\n`;
            }

            fs.writeFileSync(filePath, content, 'utf8');
            vscode.window.showInformationMessage(`Session exported to Markdown: ${filename}`);
            return filePath;
        } catch (err) {
            vscode.window.showErrorMessage(`Markdown export failed: ${err.message}`);
            return null;
        }
    }
}

module.exports = { SessionStorage };
