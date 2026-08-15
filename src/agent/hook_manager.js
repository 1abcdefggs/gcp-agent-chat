/**
 * Hook Manager
 * PreToolUse security verification before tool/prompt execution.
 * References guardrail concepts from antigravity-agent-lifecycle (MIT License, Copyright (c) 2026 Figueroa, Carlos Luciano).
 */

class HookManager {
    /**
     * PreToolUse security verification before tool/prompt execution.
     * Prevents .env secret leaks and destructive commands.
     */
    verifyPreToolUse(prompt) {
        if (!prompt || typeof prompt !== 'string') {
            return { allowed: true };
        }

        // Rule A: Block access to .env files
        if (/\.env(\.local|\.development|\.production|\.test)?/i.test(prompt)) {
            return {
                allowed: false,
                reason: '[Security Guardrail] Access to .env files is blocked by security policy.'
            };
        }

        // Rule B: Block export of sensitive environment variables
        if (/export\s+(GITHUB_TOKEN|OPENAI_API_KEY|GEMINI_API_KEY|GOOGLE_API_KEY|AWS_ACCESS_KEY_ID)=/i.test(prompt)) {
            return {
                allowed: false,
                reason: '[Security Guardrail] Exporting sensitive tokens/keys to shell is prohibited.'
            };
        }

        // Rule C: Block destructive removal commands
        if (/rm\s+-rf\s+(\/|~|\.\.|\/\*)/i.test(prompt)) {
            return {
                allowed: false,
                reason: '[Security Guardrail] Destructive file deletion command targeting system roots is blocked.'
            };
        }

        // Rule D: Block forced git push
        if (/git\s+push\s+.*(--force|-f)/i.test(prompt)) {
            return {
                allowed: false,
                reason: '[Security Guardrail] Forced git push (--force) is prohibited to protect commit history.'
            };
        }

        return { allowed: true };
    }
}

module.exports = { HookManager };
