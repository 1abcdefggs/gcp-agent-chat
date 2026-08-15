/**
 * Skill Manager
 * Discovers and injects external agent skills.
 * References skill architectures from antigravity-agent-lifecycle (MIT License, Copyright (c) 2026 Figueroa, Carlos Luciano).
 */

const fs = require('fs');
const path = require('path');
const os = require('os');

class SkillManager {
    constructor() {
        this.skills = [];
        this.loadSkills();
    }

    /** Scan skills from cloned repo and local configuration roots */
    loadSkills() {
        this.skills = [];
        const homeDir = os.homedir();
        const candidatePaths = [
            'C:\\antigravity-agent-lifecycle\\skills',
            path.join(homeDir, '.agent', 'skills'),
            path.join(homeDir, '.gemini', 'config', 'skills')
        ];

        for (const basePath of candidatePaths) {
            if (!fs.existsSync(basePath)) continue;

            try {
                const entries = fs.readdirSync(basePath, { withFileTypes: true });
                for (const entry of entries) {
                    if (entry.isDirectory()) {
                        const skillFile = path.join(basePath, entry.name, 'SKILL.md');
                        if (fs.existsSync(skillFile)) {
                            const content = fs.readFileSync(skillFile, 'utf-8');
                            this.skills.push({
                                name: entry.name,
                                description: this._extractDescription(content),
                                content,
                                path: skillFile
                            });
                        }
                    }
                }
                if (this.skills.length > 0) {
                    console.log(`[SkillManager] Loaded ${this.skills.length} skills from ${basePath}`);
                    break;
                }
            } catch (e) {
                console.error('[SkillManager] Error reading skills from:', basePath, e);
            }
        }
    }

    _extractDescription(content) {
        const match = content.match(/description:\s*(?:>-\s*|\s*["']?)([^"'\n\r]+)/i);
        return match ? match[1].trim() : 'No description provided';
    }

    _cleanQuery(str) {
        return (str || '').replace(/^\//, '').trim().toLowerCase();
    }

    /** Get slash command autocomplete suggestions */
    getSuggestions(query) {
        const q = this._cleanQuery(query);
        if (!q) {
            return this.skills.slice(0, 15);
        }
        return this.skills
            .filter(s => s.name.toLowerCase().includes(q) || s.description.toLowerCase().includes(q))
            .slice(0, 15);
    }

    /** Find skill by name */
    getSkill(name) {
        const cleanName = this._cleanQuery(name);
        return this.skills.find(s => s.name.toLowerCase() === cleanName);
    }
}

module.exports = { SkillManager };
