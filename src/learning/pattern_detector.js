/**
 * Proactive Pattern Detector
 * Analyzes conversational modification patterns and detects repeated directives for autonomous rule/skill creation.
 * 100% English-based codebase conforming to repository standards.
 */

const DEFAULT_WINDOW_SIZE = 6;
const DEFAULT_THRESHOLD = 2;

const BUILTIN_PATTERNS = [
    {
        key: 'encoding',
        aliases: ['corrupted encoding', 'mojibake', 'utf-8', 'utf8'],
        topic: 'EncodingStandard',
        title: 'Encoding & UTF-8 Standardization Rule',
        desc: 'Enforces UTF-8 encoding and avoids character corruption across terminal and file outputs',
        ruleFileName: 'encoding_standard.md',
        skillName: 'skill_fix_encoding'
    },
    {
        key: 'solid',
        aliases: ['solid principles', 'clean code', 'single responsibility'],
        topic: 'SolidDesignPrinciples',
        title: 'SOLID Design Principles',
        desc: 'Enforces single responsibility, dependency inversion, and clean architecture standards',
        ruleFileName: 'solid_principles.md',
        skillName: 'skill_solid_refactor'
    },
    {
        key: 'error handling',
        aliases: ['exception handling', 'try-catch', 'robust error'],
        topic: 'ErrorHandlingStandard',
        title: 'Error & Exception Handling Standards',
        desc: 'Robust try-catch patterns, fallback handling, and clear error diagnostics',
        ruleFileName: 'error_handling_standard.md',
        skillName: 'skill_robust_error_handling'
    },
    {
        key: 'type safety',
        aliases: ['zero any', 'strict types', 'typescript types', 'type definition'],
        topic: 'TypeScriptStrictTypes',
        title: 'Strict TypeScript & Zero Any Standards',
        desc: 'Prohibits any types and enforces strict interfaces and generics',
        ruleFileName: 'type_safety_rules.md',
        skillName: 'skill_type_safety_audit'
    },
    {
        key: 'xss',
        aliases: ['dom xss', 'security vulnerability', 'innerhtml'],
        topic: 'DomXssPrevention',
        title: 'Webview DOM-based XSS Prevention',
        desc: 'Eliminates innerHTML and enforces textContent / createElement DOM construction',
        ruleFileName: 'xss_prevention_rules.md',
        skillName: 'skill_secure_dom_construction'
    }
];

class PatternDetector {
    /**
     * @param {Object} [options]
     * @param {number} [options.windowSize=6]
     * @param {number} [options.threshold=2]
     */
    constructor({ windowSize = DEFAULT_WINDOW_SIZE, threshold = DEFAULT_THRESHOLD } = {}) {
        this.windowSize = windowSize;
        this.threshold = threshold;
        /** @type {Array<{text: string, timestamp: number}>} */
        this.history = [];
        this.patternDefinitions = [...BUILTIN_PATTERNS];
    }

    /**
     * Register a custom pattern definition
     * @param {Object} pattern
     */
    addPatternDefinition(pattern) {
        if (pattern && pattern.key && pattern.topic) {
            this.patternDefinitions.push(pattern);
        }
    }

    /**
     * Record a prompt and check for repeated patterns
     * @param {string} text 
     * @returns {{ shouldSuggest: boolean, pattern?: Object }}
     */
    recordPrompt(text) {
        if (!text || typeof text !== 'string') {
            return { shouldSuggest: false };
        }

        this.history.push({ text, timestamp: Date.now() });
        if (this.history.length > this.windowSize) {
            this.history.shift();
        }

        return this.detectPatterns();
    }

    /**
     * Analyze recent history for repetition
     * @returns {{ shouldSuggest: boolean, pattern?: Object }}
     */
    detectPatterns() {
        for (const pattern of this.patternDefinitions) {
            const allKeys = [pattern.key, ...(pattern.aliases || [])].map(k => k.toLowerCase());
            const matches = this.history.filter(h => {
                const lowerText = h.text.toLowerCase();
                return allKeys.some(k => lowerText.includes(k));
            });

            if (matches.length >= this.threshold) {
                return {
                    shouldSuggest: true,
                    pattern: {
                        topic: pattern.topic,
                        title: pattern.title,
                        description: pattern.desc,
                        ruleFileName: pattern.ruleFileName,
                        skillName: pattern.skillName,
                        keyword: pattern.key,
                        matchCount: matches.length
                    }
                };
            }
        }
        return { shouldSuggest: false };
    }

    /**
     * Clear recorded pattern history
     */
    clear() {
        this.history = [];
    }
}

module.exports = { PatternDetector, BUILTIN_PATTERNS };
