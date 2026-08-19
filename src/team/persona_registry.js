/**
 * Persona Registry & Manager
 * Provides theme-based role mapping for Virtual AI Development Teams (Office, Guild, Cockpit).
 * Uses standard VS Code Codicons (e.g. $(organization), $(tools), $(rocket)) instead of emojis.
 */

const PERSONA_TEMPLATES = {
    office: {
        id: 'office',
        title: 'Office (Default)',
        icon: 'organization',
        codicon: '$(organization)',
        userRole: 'CEO / Product Owner',
        chiefRole: 'Chief Engineer / PM',
        architectRole: 'Software Architect',
        coderRole: 'Cloud & Backend Engineer',
        reviewerRole: 'Security & Quality Auditor',
        securityLabel: 'Corporate Security Gate'
    },
    guild: {
        id: 'guild',
        title: 'Guild / Atelier',
        icon: 'tools',
        codicon: '$(tools)',
        userRole: 'Guild Master / Client',
        chiefRole: 'Master Craftsman',
        architectRole: 'Blueprint Artisan',
        coderRole: 'Forge Specialist',
        reviewerRole: 'Inspector & Polisher',
        securityLabel: 'Guild Protective Ward'
    },
    cockpit: {
        id: 'cockpit',
        title: 'Cockpit / Mission Control',
        icon: 'rocket',
        codicon: '$(rocket)',
        userRole: 'Commander / Captain',
        chiefRole: 'First Officer / Lead Specialist',
        architectRole: 'Navigation & Systems Architect',
        coderRole: 'Engine Room Operator',
        reviewerRole: 'Shield & Safety Controller',
        securityLabel: 'Vessel Shield Protocol'
    }
};

class PersonaManager {
    /**
     * @param {string} [templateId='office']
     */
    constructor(templateId = 'office') {
        this.currentTemplateId = PERSONA_TEMPLATES[templateId] ? templateId : 'office';
    }

    /**
     * Set active persona template
     * @param {string} templateId 
     * @returns {boolean}
     */
    setTemplate(templateId) {
        if (PERSONA_TEMPLATES[templateId]) {
            this.currentTemplateId = templateId;
            return true;
        }
        return false;
    }

    /**
     * Get active persona roles
     * @returns {typeof PERSONA_TEMPLATES['office']}
     */
    getActiveTemplate() {
        return PERSONA_TEMPLATES[this.currentTemplateId];
    }

    /**
     * Get all available template options for UI dropdown
     * @returns {Array<{ id: string, title: string, icon: string, codicon: string }>}
     */
    static getAvailableTemplates() {
        return Object.values(PERSONA_TEMPLATES).map(t => ({
            id: t.id,
            title: t.title,
            icon: t.icon,
            codicon: t.codicon
        }));
    }
}

module.exports = { PERSONA_TEMPLATES, PersonaManager };
