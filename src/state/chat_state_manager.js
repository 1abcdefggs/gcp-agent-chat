const EventEmitter = require('events');
let vscode = null;
try {
    vscode = require('vscode');
} catch (e) {
    // vscode is injected at runtime in VS Code extension host
}
const { SUPPORTED_MODELS, SUPPORTED_LANGUAGES, DEFAULT_CONFIG } = require('../config/constants');

class ChatStateManager extends EventEmitter {
    constructor() {
        super();
        this.messages = [];
        const config = vscode?.workspace?.getConfiguration ? vscode.workspace.getConfiguration('gcpAgentChat') : null;
        this.selectedModel = (config && config.get('model')) || DEFAULT_CONFIG.model;
        this.targetLanguage = (config && config.get('language')) || DEFAULT_CONFIG.language;
        this.availableModels = SUPPORTED_MODELS;
        this.availableLanguages = SUPPORTED_LANGUAGES;
        this.gcpStatus = {
            authenticated: false,
            projectId: null,
            location: 'global',
            account: null,
            error: null,
            loading: false
        };
        this._activeWebviews = new Set();
    }

    /** Register Webview and synchronize initial state (hydration) */
    registerWebview(webview) {
        this._activeWebviews.add(webview);
        webview.postMessage({
            type: 'syncState',
            messages: this.messages,
            model: this.selectedModel,
            language: this.targetLanguage,
            gcpStatus: this.gcpStatus,
            availableModels: this.availableModels,
            availableLanguages: this.availableLanguages
        });
    }

    unregisterWebview(webview) {
        this._activeWebviews.delete(webview);
    }

    /** Add message and broadcast to all active webviews */
    addMessage(sender, text, extra = {}) {
        const message = {
            id: 'msg-' + Date.now() + '-' + Math.random().toString(36).slice(2, 7),
            sender,
            text,
            timestamp: Date.now(),
            ...extra
        };
        this.messages.push(message);
        this.broadcast({ type: 'addMessage', message });
        return message;
    }

    /** Clear all messages (new session) and sync webviews */
    clearMessages() {
        this.messages = [];
        this.broadcast({ type: 'syncState', messages: [] });
    }

    /** Replace messages (load session) and sync webviews */
    setMessages(messages) {
        this.messages = Array.isArray(messages) ? messages : [];
        this.broadcast({ type: 'syncState', messages: this.messages });
    }

    /** Update message status (loading, complete, error, etc.) */
    updateMessage(id, updates) {
        const msg = this.messages.find(m => m.id === id);
        if (msg) {
            Object.assign(msg, updates);
            this.broadcast({ type: 'updateMessage', message: msg });
        }
    }

    /** Update selected model */
    setModel(model) {
        this.selectedModel = model;
        this.broadcast({ type: 'modelChanged', model });
    }

    /** Update target language */
    setLanguage(language) {
        this.targetLanguage = language;
        this.broadcast({ type: 'languageChanged', language });
    }

    /** Update GCP status and notify webviews */
    updateGcpStatus(status) {
        this.gcpStatus = Object.assign({}, this.gcpStatus, status);
        this.broadcast({ type: 'gcpStatus', gcpStatus: this.gcpStatus });
    }

    /** Broadcast data payload to all active webviews */
    broadcast(payload) {
        for (const webview of this._activeWebviews) {
            try {
                webview.postMessage(payload);
            } catch (err) {
                this._activeWebviews.delete(webview);
            }
        }
    }
}

module.exports = { ChatStateManager };
