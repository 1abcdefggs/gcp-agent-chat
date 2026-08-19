/**
 * Rule & Skill Generator
 * Automatically creates standardized rule documents (.agents/rules/*.md)
 * and skill packages (.agents/skills/[skillName]/SKILL.md) with privacy abstraction.
 * 100% English-based, emoji-free templates conforming to repository standards.
 */

const fs = require('fs');
const path = require('path');

class RuleGenerator {
    /**
     * Sanitize and abstract project-specific absolute paths, keys, and user details
     * @param {string} text 
     * @returns {string}
     */
    static sanitizeForRules(text) {
        if (!text || typeof text !== 'string') return '';
        return text
            .replace(/([a-zA-Z]:\\[^\s"'<>]+|\/[a-zA-Z0-9_.-]+\/[^\s"'<>]+)/g, '<PROJECT_ROOT>/...')
            .replace(/(AIzaSy[a-zA-Z0-9_-]{33}|ghp_[a-zA-Z0-9]{36})/g, '[REDACTED_API_KEY]');
    }

    /**
     * Generate a rule markdown file in workspace `.agents/rules/`
     * @param {string} workspaceRoot 
     * @param {Object} options
     * @param {string} options.ruleFileName
     * @param {string} options.title
     * @param {string} options.description
     * @param {string} [options.instruction]
     * @returns {{ success: boolean, filePath: string, error?: string }}
     */
    static generateRuleFile(workspaceRoot, { ruleFileName, title, description, instruction = '' }) {
        try {
            if (!workspaceRoot || typeof workspaceRoot !== 'string') {
                throw new Error('Workspace root directory is not defined.');
            }

            const rulesDir = path.join(workspaceRoot, '.agents', 'rules');
            if (!fs.existsSync(rulesDir)) {
                fs.mkdirSync(rulesDir, { recursive: true });
            }

            const safeFileName = ruleFileName.endsWith('.md') ? ruleFileName : `${ruleFileName}.md`;
            const targetPath = path.join(rulesDir, safeFileName);

            const content = `# Auto-Generated Rule: ${title}

> **Summary**: ${description}
> **Generated At**: ${new Date().toISOString()}

---

## Applicability
Must be adhered to during all code generation, refactoring, and review within this workspace.

## Rule Specification
${instruction ? instruction : `- **Core Principle**: ${description}\n- **Compliance**: Adhere strictly to the guidelines above to maintain codebase consistency.`}

## Quality & Security Verification
- Ensure automated tests and linting passes before committing changes.
- Verify adherence during code review.
`;

            fs.writeFileSync(targetPath, content, 'utf-8');
            return { success: true, filePath: targetPath };
        } catch (err) {
            return { success: false, filePath: '', error: err.message };
        }
    }

    /**
     * Generate a skill package in `.agents/skills/<skillName>/SKILL.md`
     * @param {string} workspaceRoot 
     * @param {Object} options
     * @param {string} options.skillName
     * @param {string} options.title
     * @param {string} options.description
     * @returns {{ success: boolean, filePath: string, error?: string }}
     */
    static generateSkillFile(workspaceRoot, { skillName, title, description }) {
        try {
            if (!workspaceRoot || typeof workspaceRoot !== 'string') {
                throw new Error('Workspace root directory is not defined.');
            }

            const skillDir = path.join(workspaceRoot, '.agents', 'skills', skillName);
            if (!fs.existsSync(skillDir)) {
                fs.mkdirSync(skillDir, { recursive: true });
            }

            const targetPath = path.join(skillDir, 'SKILL.md');
            const content = `---
name: ${skillName}
description: "${description}"
---

# Skill Definition: ${title}

## Description
${description}

## Workflow
1. Inspect target files and relevant dependencies.
2. Apply changes conforming to best practices and rules.
3. Validate correctness by running linters and tests.
`;

            fs.writeFileSync(targetPath, content, 'utf-8');
            return { success: true, filePath: targetPath };
        } catch (err) {
            return { success: false, filePath: '', error: err.message };
        }
    }
}

module.exports = { RuleGenerator };
