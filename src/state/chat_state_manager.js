const EventEmitter = require('events');

class ChatStateManager extends EventEmitter {
    constructor() {
        super();
        this.messages = [];
        this.selectedModel = 'gemini-3.7-flash';
        this.targetLanguage = 'auto';
        this.gcpStatus = {
            authenticated: false,
            projectId: null,
            location: 'global',
            account: null,
            error: null
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
            gcpStatus: this.gcpStatus
        });
    }

    unregisterWebview(webview) {
        this._activeWebviews.delete(webview);
    }

    /** Add message and broadcast to all active webviews */
    addMessage(sender, text, extra = {}) {
        const message = {
            id: 'msg-' + Date.now() + '-' + Math.random().toString(36).substr(2, 5),
            sender,
            text,
            timestamp: Date.now(),
            ...extra
        };
        this.messages.push(message);
        this.broadcast({ type: 'addMessage', message });
        return message;
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
