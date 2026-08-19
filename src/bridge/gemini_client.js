/**
 * Native Node.js Gemini & Vertex AI Client
 * GCP Agent Chat Platform
 * 
 * Communicates directly with Google GenAI / Vertex AI inside the VS Code runtime.
 * Provides autonomous tool execution with security guardrails.
 */

const { GoogleGenAI } = require('@google/genai');
let vscode = null;
try {
    vscode = require('vscode');
} catch (e) {
    // vscode is injected at runtime inside the VS Code extension host
}

const fs = require('fs');
const path = require('path');
const cp = require('child_process');

class GeminiClient {
    /**
     * @param {Object} [options]
     * @param {string} [options.cwd] Workspace root directory
     */
    constructor(options = {}) {
        this.cwd = options.cwd || (vscode?.workspace?.workspaceFolders?.[0]?.uri.fsPath || process.cwd());
    }

    /**
     * Resolve environment parameters and settings
     * @param {Object} [customParams]
     * @returns {{ projectId: string, location: string, model: string, language: string }}
     */
    _getEnvironmentParams(customParams = {}) {
        const config = vscode?.workspace?.getConfiguration ? vscode.workspace.getConfiguration('gcpAgentChat') : null;
        const projectId = customParams.projectId || config?.get('projectId') || process.env.GOOGLE_CLOUD_PROJECT || '';
        const location = customParams.location || config?.get('location') || process.env.GOOGLE_CLOUD_LOCATION || 'global';
        const model = customParams.model || config?.get('model') || 'gemini-3.7-flash';
        const language = customParams.language || config?.get('language') || 'auto';

        return { projectId, location, model, language };
    }

    /**
     * Create an initialized GoogleGenAI instance
     * @param {Object} params
     * @returns {GoogleGenAI}
     */
    _createGenAIClient(params) {
        const { projectId, location } = this._getEnvironmentParams(params);
        const apiKey = params.apiKey || process.env.GEMINI_API_KEY || process.env.GOOGLE_API_KEY;

        const clientOptions = {};
        if (apiKey) {
            clientOptions.apiKey = apiKey;
        } else if (projectId) {
            clientOptions.vertexAI = {
                project: projectId,
                location: location || 'global'
            };
        }

        return new GoogleGenAI(clientOptions);
    }

    /**
     * Check GCP authentication and project configuration status
     * @param {Object} [params]
     * @returns {Promise<{ success: boolean, authenticated: boolean, project_id: string|null, location: string, account: string, auth_mode: string, error?: string }>}
     */
    async checkStatus(params = {}) {
        const { projectId, location } = this._getEnvironmentParams(params);
        const token = params.token;
        const authMode = params.authMode || 'auto';

        let resolvedProject = projectId;
        if (!resolvedProject) {
            try {
                const res = cp.execSync('gcloud config get-value project', { encoding: 'utf-8', timeout: 3000 });
                const p = res.trim();
                if (p && p !== '(unset)' && !p.startsWith('ERROR')) {
                    resolvedProject = p;
                }
            } catch (e) {
                // Ignore gcloud lookup error if gcloud is not installed
            }
        }

        if (!resolvedProject && !params.apiKey && !process.env.GEMINI_API_KEY) {
            return {
                success: false,
                authenticated: false,
                project_id: null,
                location,
                account: 'Not Authenticated',
                auth_mode: authMode,
                error: 'Google Cloud Project ID is not configured. Click Settings to set gcpAgentChat.projectId.'
            };
        }

        return {
            success: true,
            authenticated: true,
            project_id: resolvedProject,
            location,
            account: token ? (params.account || 'Antigravity IDE User') : 'Google Cloud Authenticated',
            auth_mode: authMode
        };
    }

    /**
     * Workspace Tool: read_file
     * @param {string} filepath
     * @returns {string}
     */
    toolReadFile(filepath) {
        if (!filepath || typeof filepath !== 'string') {
            return 'Error: Invalid filepath provided.';
        }
        if (/\.env(\.local|\.development|\.production|\.test)?/i.test(filepath)) {
            return '[Security Guardrail Error] Access to .env files is blocked by security policy.';
        }
        try {
            const cleanPath = filepath.replace(/^['"]|['"]$/g, '').trim();
            const fullPath = path.isAbsolute(cleanPath) ? cleanPath : path.join(this.cwd, cleanPath);
            const content = fs.readFileSync(fullPath, 'utf-8');
            if (content.length > 12000) {
                return content.slice(0, 12000) + '\n\n...[Truncated remainder of file]...';
            }
            return content || '(File is empty)';
        } catch (err) {
            return `Error reading file '${filepath}': ${err.message}`;
        }
    }

    /**
     * Workspace Tool: list_files
     * @param {string} [dirpath='.']
     * @returns {string}
     */
    toolListFiles(dirpath = '.') {
        try {
            const cleanDir = (dirpath || '.').replace(/^['"]|['"]$/g, '').trim();
            const fullPath = path.isAbsolute(cleanDir) ? cleanDir : path.join(this.cwd, cleanDir);
            const entries = fs.readdirSync(fullPath, { withFileTypes: true });
            const formatted = entries.map(e => {
                const prefix = e.isDirectory() ? '[DIR] ' : '[FILE]';
                return `${prefix} ${e.name}`;
            });
            return formatted.length > 0 ? formatted.join('\n') : '(Empty directory)';
        } catch (err) {
            return `Error listing directory '${dirpath}': ${err.message}`;
        }
    }

    /**
     * Workspace Tool: run_command
     * @param {string} command
     * @returns {string}
     */
    toolRunCommand(command) {
        if (!command || typeof command !== 'string') {
            return 'Error: Invalid command string provided.';
        }
        if (/\.env/i.test(command)) {
            return '[Security Guardrail Error] Commands accessing .env files are blocked.';
        }
        if (/rm\s+-rf\s+(\/|~|\.\.|\/\*)/i.test(command)) {
            return '[Security Guardrail Error] Destructive deletion commands are blocked.';
        }
        if (/git\s+push\s+.*(--force|-f)/i.test(command)) {
            return '[Security Guardrail Error] Forced git push is blocked.';
        }

        try {
            const output = cp.execSync(command, {
                cwd: this.cwd,
                encoding: 'utf-8',
                timeout: 15000,
                stdio: ['ignore', 'pipe', 'pipe']
            });
            return output.trim() || '(Command completed with no output)';
        } catch (err) {
            const stderr = err.stderr ? `\n[stderr]: ${err.stderr.toString()}` : '';
            return `Command execution error: ${err.message}${stderr}`;
        }
    }

    /**
     * Execute chat message with tool support and autonomous multi-turn loops
     * @param {Object} params
     * @param {string} params.prompt
     * @param {string} [params.model]
     * @param {string} [params.language]
     * @param {string} [params.languageName]
     * @param {Array<{data: string, mimeType: string}>} [params.images]
     * @param {Function} [onChunk] Optional token streaming callback
     * @returns {Promise<{ text: string, usage_metadata: { prompt_tokens: number, candidates_tokens: number } }>}
     */
    async sendMessage(params, onChunk = null) {
        const { projectId, location, model, language } = this._getEnvironmentParams(params);
        const prompt = params.prompt || '';
        const languageName = params.languageName || 'Auto';

        const baseLang = (language === 'auto' || languageName === 'Auto')
            ? "Respond in the same language as the user's input."
            : `You MUST respond in ${languageName}.`;

        const systemInstruction = (
            `You are a helpful and autonomous AI Agent on GCP Agent Chat Platform. ${baseLang} ` +
            `You have full access to workspace inspection tools: \`read_file\`, \`list_files\`, and \`run_command\`. ` +
            `When the user asks about the workspace, repository, files, status, or code, ALWAYS use these tools to inspect the real files before answering. ` +
            `CRITICAL RULE: If the user explicitly asks in natural language to switch language, ` +
            `you MUST immediately switch your response language to that requested language.`
        );

        const ai = this._createGenAIClient({ projectId, location });

        // Tool declarations
        const tools = [
            {
                functionDeclarations: [
                    {
                        name: 'read_file',
                        description: 'Read the text content of a file in the workspace or project repository.',
                        parameters: {
                            type: 'OBJECT',
                            properties: {
                                filepath: { type: 'STRING', description: 'Relative or absolute path to the file' }
                            },
                            required: ['filepath']
                        }
                    },
                    {
                        name: 'list_files',
                        description: 'List files and subdirectories in a workspace directory.',
                        parameters: {
                            type: 'OBJECT',
                            properties: {
                                dirpath: { type: 'STRING', description: 'Directory path relative to workspace root. Defaults to .' }
                            }
                        }
                    },
                    {
                        name: 'run_command',
                        description: 'Execute a non-destructive shell command in the workspace directory.',
                        parameters: {
                            type: 'OBJECT',
                            properties: {
                                command: { type: 'STRING', description: 'The command line string to run' }
                            },
                            required: ['command']
                        }
                    }
                ]
            }
        ];

        const contents = [{ role: 'user', parts: [{ text: prompt }] }];

        // Handle attached images
        if (params.images && params.images.length > 0) {
            for (const img of params.images) {
                if (img.data) {
                    contents[0].parts.push({
                        inlineData: {
                            mimeType: img.mimeType || 'image/png',
                            data: img.data
                        }
                    });
                }
            }
        }

        let accumulatedUsage = { prompt_tokens: 0, candidates_tokens: 0 };
        let finalResponseText = '';
        const maxTurns = 5;

        for (let turn = 0; turn < maxTurns; turn++) {
            const response = await ai.models.generateContent({
                model,
                contents,
                config: {
                    systemInstruction,
                    tools
                }
            });

            if (response.usageMetadata) {
                accumulatedUsage.prompt_tokens += (response.usageMetadata.promptTokenCount || 0);
                accumulatedUsage.candidates_tokens += (response.usageMetadata.candidatesTokenCount || 0);
            }

            const candidates = response.candidates || [];
            const firstCandidate = candidates[0];
            const candidateContent = firstCandidate?.content;
            const functionCalls = response.functionCalls || [];

            if (functionCalls && functionCalls.length > 0) {
                if (candidateContent) {
                    contents.push(candidateContent);
                }

                const responseParts = [];
                for (const fc of functionCalls) {
                    const fnName = fc.name;
                    const fnArgs = fc.args || {};
                    let result = '';

                    if (fnName === 'read_file') {
                        result = this.toolReadFile(fnArgs.filepath);
                    } else if (fnName === 'list_files') {
                        result = this.toolListFiles(fnArgs.dirpath);
                    } else if (fnName === 'run_command') {
                        result = this.toolRunCommand(fnArgs.command);
                    } else {
                        result = `Unknown tool: ${fnName}`;
                    }

                    responseParts.push({
                        functionResponse: {
                            name: fnName,
                            response: { result: String(result) }
                        }
                    });
                }

                contents.push({ role: 'tool', parts: responseParts });
            } else {
                finalResponseText = response.text || '';
                if (onChunk && finalResponseText) {
                    onChunk(finalResponseText);
                }
                break;
            }
        }

        return {
            text: finalResponseText,
            usage_metadata: accumulatedUsage
        };
    }
}

module.exports = { GeminiClient };
