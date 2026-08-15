const { spawn } = require('child_process');
const readline = require('readline');
const EventEmitter = require('events');

class RpcClient extends EventEmitter {
    constructor(pythonScriptPath, options = {}) {
        super();
        this.scriptPath = pythonScriptPath;
        this.cwd = options.cwd || process.cwd();
        this.customEnv = options.env || process.env;
        this.process = null;
        this._rl = null;
        this.requestId = 0;
        this.pendingRequests = new Map();
        this.isDisposed = false;
        this._initProcess();
    }

    _initProcess() {
        if (this.isDisposed) return;

        const env = Object.assign({}, this.customEnv, {
            PYTHONIOENCODING: 'utf-8',
            PYTHONUNBUFFERED: '1'
        });

        this.process = spawn('python', [this.scriptPath, '--daemon'], {
            cwd: this.cwd,
            env
        });

        this._rl = readline.createInterface({ input: this.process.stdout });
        this._rl.on('line', (line) => this._handleLine(line));

        this.process.stderr.on('data', (data) => {
            console.error('[Python Bridge stderr]:', data.toString());
        });

        this.process.on('close', (code) => {
            this._rejectAllPending(`Python bridge process closed unexpectedly with code ${code}`);
            if (this._rl) {
                this._rl.close();
                this._rl = null;
            }
            if (!this.isDisposed) {
                console.warn(`[Python Bridge] Process closed with code ${code}. Auto-restarting in 1s...`);
                this.emit('restart', code);
                setTimeout(() => this._initProcess(), 1000);
            }
        });

        this.process.on('error', (err) => {
            console.error('[Python Bridge spawn error]:', err);
            this._rejectAllPending(`Python bridge spawn error: ${err.message}`);
            this.emit('error', err);
        });
    }

    _rejectAllPending(reason) {
        for (const [id, req] of this.pendingRequests.entries()) {
            if (req.timer) clearTimeout(req.timer);
            req.reject(new Error(reason));
        }
        this.pendingRequests.clear();
    }

    _handleLine(line) {
        if (!line.trim()) return;
        try {
            const response = JSON.parse(line.trim());
            if (response.id !== undefined && this.pendingRequests.has(response.id)) {
                const req = this.pendingRequests.get(response.id);
                this.pendingRequests.delete(response.id);
                if (req.timer) clearTimeout(req.timer);

                if (response.error) {
                    req.reject(new Error(response.error.message || 'RPC Error'));
                } else {
                    req.resolve(response.result);
                }
            }
        } catch (e) {
            console.error('[RPC Parse Error]', e, 'Raw line:', line);
        }
    }

    /** Call a JSON-RPC 2.0 method with optional timeout */
    call(method, params = {}, timeoutMs = 60000) {
        return new Promise((resolve, reject) => {
            if (!this.process || !this.process.stdin.writable) {
                reject(new Error('Python bridge process is not running or stdin is closed'));
                return;
            }

            const id = ++this.requestId;
            const payload = JSON.stringify({ jsonrpc: '2.0', id, method, params }) + '\n';

            let timer = null;
            if (timeoutMs > 0) {
                timer = setTimeout(() => {
                    if (this.pendingRequests.has(id)) {
                        this.pendingRequests.delete(id);
                        reject(new Error(`RPC request ${method} (id=${id}) timed out after ${timeoutMs}ms`));
                    }
                }, timeoutMs);
            }

            this.pendingRequests.set(id, { resolve, reject, timer });
            this.process.stdin.write(payload);
        });
    }

    dispose() {
        this.isDisposed = true;
        this._rejectAllPending('RpcClient has been disposed.');
        if (this._rl) {
            this._rl.close();
            this._rl = null;
        }
        if (this.process) {
            this.process.kill();
            this.process = null;
        }
    }
}

module.exports = { RpcClient };
