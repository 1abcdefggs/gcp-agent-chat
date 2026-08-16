const vscode = require('vscode');
const { MODEL_PRICING, DEFAULT_CONFIG } = require('../config/constants');

class CostTracker {
    constructor(stateManager, globalState = null) {
        this.state = stateManager;
        this.globalState = globalState;
        this.totalCost = this.globalState ? (this.globalState.get('gcpAgentChat.totalCost') || 0.0) : 0.0;
        this.sessionCost = 0.0;
    }

    getMonthlyBudget() {
        const config = vscode.workspace.getConfiguration('gcpAgentChat');
        return config.get('monthlyBudgetLimit') || DEFAULT_CONFIG.monthlyBudgetLimit;
    }

    /** Calculate and store charges from usage_metadata of API response */
    recordUsage(model, usage) {
        if (!usage) return 0;

        const pricing = MODEL_PRICING[model] || MODEL_PRICING['gemini-3.7-flash'];
        const inputCost = ((usage.prompt_tokens || 0) / 1000000) * pricing.inputPer1M;
        const outputCost = ((usage.candidates_tokens || 0) / 1000000) * pricing.outputPer1M;
        const total = inputCost + outputCost;

        this.sessionCost += total;
        this.totalCost += total;

        if (this.globalState) {
            this.globalState.update('gcpAgentChat.totalCost', this.totalCost);
        }

        this.broadcastCurrentCost(total);
        return total;
    }

    /** Broadcast current cost to all Webviews */
    broadcastCurrentCost(lastCost = 0) {
        const budget = this.getMonthlyBudget();
        const isOverBudget = this.totalCost >= budget;

        this.state.broadcast({
            type: 'costUpdate',
            lastCost,
            sessionCost: this.sessionCost,
            dailyCost: this.totalCost,
            totalCost: this.totalCost,
            budgetLimit: budget,
            isOverBudget
        });
    }

    /** Budget limit check */
    canSendRequest() {
        const budget = this.getMonthlyBudget();
        return this.totalCost < budget;
    }

    resetSession() {
        this.sessionCost = 0.0;
    }

    resetTotalCost() {
        this.totalCost = 0.0;
        if (this.globalState) {
            this.globalState.update('gcpAgentChat.totalCost', 0.0);
        }
        this.broadcastCurrentCost();
    }
}

module.exports = { CostTracker, MODEL_PRICING };
