/**
 * Chief Agent Orchestrator (Google Cloud ADK-compliant Multi-Agent Team Engine)
 * Decomposes complex user goals and coordinates Architect, Coder, and Reviewer sub-tasks in threads.
 * 100% English-based codebase conforming to repository standards.
 */

class ChiefOrchestrator {
    /**
     * @param {Object} options
     * @param {import('./persona_registry').PersonaManager} options.personaManager
     * @param {Function} options.sendRpcPrompt - Callback to send prompt to Gemini/Vertex AI
     */
    constructor({ personaManager, sendRpcPrompt }) {
        this.personaManager = personaManager;
        this.sendRpcPrompt = sendRpcPrompt;
    }

    /**
     * Determine if a user prompt should trigger multi-agent team orchestration
     * @param {string} prompt 
     * @returns {boolean}
     */
    shouldOrchestrate(prompt) {
        if (!prompt || typeof prompt !== 'string') return false;
        const triggerKeywords = [
            'team', 'orchestrate', 'multi-agent', 'design and implement',
            'review', 'from design', 'planning'
        ];
        const lower = prompt.toLowerCase();
        return triggerKeywords.some(kw => lower.includes(kw.toLowerCase()));
    }

    /**
     * Run team workflow: Chief -> Architect -> Reviewer -> Chief Summary
     * @param {Object} params
     * @param {string} params.userPrompt
     * @param {import('../tree/message_tree').MessageTree} params.messageTree
     * @param {Function} [params.onMessageCreated] Callback when a node is added/updated (for UI update)
     */
    async executeTeamWorkflow({ userPrompt, messageTree, onMessageCreated }) {
        if (!messageTree) {
            throw new Error('MessageTree instance is required for team workflow execution.');
        }

        const roles = this.personaManager.getActiveTemplate();

        // 1. Chief initial acknowledgment
        const chiefIntroNode = messageTree.addMessage({
            sender: 'chief',
            text: `Acknowledged, **${roles.userRole}**. I will coordinate with the specialist team (${roles.architectRole} & ${roles.reviewerRole}) to execute your request.`,
            status: 'complete',
            metadata: {
                roleTitle: roles.chiefRole,
                isTeamLead: true
            }
        });
        if (onMessageCreated) onMessageCreated(chiefIntroNode);

        // 2. Architect design step (Thread child of chiefIntroNode)
        const architectPrompt = `You are the [${roles.architectRole}]. Based on the following user requirements, create a robust, clean architecture design, module structure, and data flow specification.\n\n[Requirements]:\n${userPrompt}`;

        const architectPendingNode = messageTree.addMessage({
            parentId: chiefIntroNode.id,
            sender: 'architect',
            text: `[Architect] Designing architecture and modular structure...`,
            status: 'thinking',
            metadata: { roleTitle: roles.architectRole }
        });
        if (onMessageCreated) onMessageCreated(architectPendingNode);

        let architectResponseText = '';
        try {
            architectResponseText = await this.sendRpcPrompt({
                prompt: architectPrompt,
                systemInstruction: `You are an experienced ${roles.architectRole}. Adhere strictly to SOLID principles, KISS design, and secure cloud architecture.`
            });
            architectPendingNode.text = architectResponseText || '(Architecture design generation completed)';
            architectPendingNode.status = 'complete';
        } catch (err) {
            architectPendingNode.text = `Architecture design generation error: ${err.message}`;
            architectPendingNode.status = 'error';
            if (onMessageCreated) onMessageCreated(architectPendingNode);
            return;
        }
        if (onMessageCreated) onMessageCreated(architectPendingNode);

        // 3. Reviewer step (Thread child of architectPendingNode)
        const reviewerPrompt = `You are the [${roles.reviewerRole}]. Strictly audit the following architecture specification for security vulnerabilities (XSS, CSRF, auth issues), performance bottlenecks, and edge cases. Provide actionable recommendations.\n\n[Architecture Blueprint]:\n${architectResponseText}`;

        const reviewerPendingNode = messageTree.addMessage({
            parentId: architectPendingNode.id,
            sender: 'reviewer',
            text: `[Reviewer] Auditing security and design quality...`,
            status: 'thinking',
            metadata: { roleTitle: roles.reviewerRole }
        });
        if (onMessageCreated) onMessageCreated(reviewerPendingNode);

        let reviewerResponseText = '';
        try {
            reviewerResponseText = await this.sendRpcPrompt({
                prompt: reviewerPrompt,
                systemInstruction: `You are a strict ${roles.reviewerRole}. Enforce security standards according to ${roles.securityLabel}.`
            });
            reviewerPendingNode.text = reviewerResponseText || '(Quality audit completed)';
            reviewerPendingNode.status = 'complete';
        } catch (err) {
            reviewerPendingNode.text = `Audit execution error: ${err.message}`;
            reviewerPendingNode.status = 'error';
            if (onMessageCreated) onMessageCreated(reviewerPendingNode);
            return;
        }
        if (onMessageCreated) onMessageCreated(reviewerPendingNode);

        // 4. Chief conclusion
        const chiefConclusionNode = messageTree.addMessage({
            parentId: chiefIntroNode.id,
            sender: 'chief',
            text: `**Report from ${roles.chiefRole}**:\nArchitecture design by ${roles.architectRole} and quality audit by ${roles.reviewerRole} have completed. Please review the thread above to proceed with implementation.`,
            status: 'complete',
            metadata: {
                roleTitle: roles.chiefRole,
                isConclusion: true
            }
        });
        if (onMessageCreated) onMessageCreated(chiefConclusionNode);
    }
}

module.exports = { ChiefOrchestrator };
