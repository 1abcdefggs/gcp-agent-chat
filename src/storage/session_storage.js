const fs = require('fs');
const path = require('path');
const os = require('os');
const vscode = require('vscode');

class SessionStorage {
    constructor(sessionId, globalStoragePath, workspaceRoot) {
        this.sessionId = sessionId || `session_${Date.now()}`;
        this.workspaceRoot = workspaceRoot || process.cwd();
        this.globalStoragePath = globalStoragePath || path.join(os.homedir(), '.gemini', 'gcp-agent-chat');

        const config = vscode.workspace.getConfiguration('gcpAgentChat');
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

    newSession(sessionId = null) {
        this.sessionId = sessionId || `session_${Date.now()}`;
        this.jsonlPath = path.join(this.sessionDir, `${this.sessionId}.jsonl`);
        this._ensureDirectory();
        return this.sessionId;
    }

    /** List all stored sessions with metadata */
    listSessions() {
        try {
            if (!fs.existsSync(this.sessionDir)) return [];
            const files = fs.readdirSync(this.sessionDir).filter(f => f.endsWith('.jsonl'));
            const sessions = [];

            for (const file of files) {
                const filePath = path.join(this.sessionDir, file);
                const stat = fs.statSync(filePath);
                const sid = file.replace('.jsonl', '');
                let preview = 'Empty conversation';
                let messageCount = 0;

                try {
                    const content = fs.readFileSync(filePath, 'utf8');
                    const lines = content.trim().split('\n').filter(Boolean);
                    messageCount = lines.length;
                    if (lines.length > 0) {
                        const firstMsg = JSON.parse(lines[0]);
                        preview = (firstMsg.text || '').replace(/\s+/g, ' ').slice(0, 60);
                        if (firstMsg.text && firstMsg.text.length > 60) preview += '...';
                    }
                } catch { }

                sessions.push({
                    sessionId: sid,
                    filename: file,
                    filePath,
                    preview,
                    messageCount,
                    updatedAt: stat.mtime
                });
            }

            return sessions.sort((a, b) => b.updatedAt - a.updatedAt);
        } catch (err) {
            console.error('Failed to list sessions:', err);
            return [];
        }
    }

    /** Load all messages from a specific session file */
    loadSession(sessionId) {
        try {
            const targetPath = path.join(this.sessionDir, `${sessionId}.jsonl`);
            if (!fs.existsSync(targetPath)) return [];
            const content = fs.readFileSync(targetPath, 'utf8');
            const lines = content.trim().split('\n').filter(Boolean);
            const messages = [];

            for (const line of lines) {
                try {
                    messages.push(JSON.parse(line));
                } catch { }
            }

            this.sessionId = sessionId;
            this.jsonlPath = targetPath;
            return messages;
        } catch (err) {
            console.error(`Failed to load session ${sessionId}:`, err);
            return [];
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

            let content = `# GCP Agent Chat Chat Session Export\n`;
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
