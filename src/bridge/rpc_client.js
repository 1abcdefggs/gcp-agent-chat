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

        const rl = readline.createInterface({ input: this.process.stdout });
        rl.on('line', (line) => this._handleLine(line));

        this.process.stderr.on('data', (data) => {
            console.error('[Python Bridge stderr]:', data.toString());
        });

        this.process.on('close', (code) => {
            if (!this.isDisposed) {
                console.warn(`[Python Bridge] Process closed with code ${code}. Auto-restarting in 1s...`);
                setTimeout(() => this._initProcess(), 1000);
            }
        });

        this.process.on('error', (err) => {
            console.error('[Python Bridge spawn error]:', err);
        });
    }

    _handleLine(line) {
        if (!line.trim()) return;
        try {
            const response = JSON.parse(line.trim());
            if (response.id !== undefined && this.pendingRequests.has(response.id)) {
                const { resolve, reject } = this.pendingRequests.get(response.id);
                this.pendingRequests.delete(response.id);
                if (response.error) {
                    reject(new Error(response.error.message || 'RPC Error'));
                } else {
                    resolve(response.result);
                }
            }
        } catch (e) {
            console.error('[RPC Parse Error]', e, 'Raw line:', line);
        }
    }

    /** Call a JSON-RPC 2.0 method */
    call(method, params = {}) {
        return new Promise((resolve, reject) => {
            if (!this.process || !this.process.stdin.writable) {
                reject(new Error('Python bridge process is not running or stdin is closed'));
                return;
            }

            const id = ++this.requestId;
            const payload = JSON.stringify({ jsonrpc: '2.0', id, method, params }) + '\n';
            this.pendingRequests.set(id, { resolve, reject });
            this.process.stdin.write(payload);
        });
    }

    dispose() {
        this.isDisposed = true;
        if (this.process) {
            this.process.kill();
            this.process = null;
        }
    }
}

module.exports = { RpcClient };
