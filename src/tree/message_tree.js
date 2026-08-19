/**
 * Message Tree & TreeNode Data Structures
 * Supports nested threaded replies, branch management, and collapsing.
 */

class TreeNode {
    /**
     * @param {Object} message 
     * @param {string} [message.id]
     * @param {string|null} [message.parentId]
     * @param {string} message.sender
     * @param {string} message.text
     * @param {string} [message.status]
     * @param {number} [message.timestamp]
     * @param {Object} [message.metadata]
     */
    constructor(message) {
        this.id = message.id || `node-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`;
        this.parentId = message.parentId || null;
        this.sender = message.sender || 'user';
        this.text = message.text || '';
        this.status = message.status || 'complete';
        this.timestamp = message.timestamp || Date.now();
        this.metadata = message.metadata || {};
        this.children = [];
        this.isCollapsed = false;
    }

    /**
     * Append a child node to this TreeNode
     * @param {TreeNode} childNode 
     */
    addChild(childNode) {
        if (childNode instanceof TreeNode) {
            childNode.parentId = this.id;
            this.children.push(childNode);
        }
    }

    /**
     * Remove a child node by ID
     * @param {string} childId 
     * @returns {TreeNode|null}
     */
    removeChild(childId) {
        const idx = this.children.findIndex(c => c.id === childId);
        if (idx !== -1) {
            return this.children.splice(idx, 1)[0];
        }
        return null;
    }

    /**
     * Serialize to plain JSON
     */
    toJSON() {
        return {
            id: this.id,
            parentId: this.parentId,
            sender: this.sender,
            text: this.text,
            status: this.status,
            timestamp: this.timestamp,
            metadata: this.metadata,
            isCollapsed: this.isCollapsed,
            children: this.children.map(c => c.toJSON())
        };
    }
}

class MessageTree {
    constructor() {
        /** @type {TreeNode[]} */
        this.rootNodes = [];
        /** @type {Map<string, TreeNode>} */
        this.nodeMap = new Map();
    }

    /**
     * Add a message node to the tree
     * @param {Object} message 
     * @param {string|null} [parentId] 
     * @returns {TreeNode}
     */
    addMessage(message, parentId = null) {
        const targetParentId = parentId || message.parentId || null;
        const node = new TreeNode({ ...message, parentId: targetParentId });
        this.nodeMap.set(node.id, node);

        if (targetParentId && this.nodeMap.has(targetParentId)) {
            const parent = this.nodeMap.get(targetParentId);
            parent.addChild(node);
        } else {
            this.rootNodes.push(node);
        }

        return node;
    }

    /**
     * Get a node by ID
     * @param {string} nodeId 
     * @returns {TreeNode|undefined}
     */
    getNode(nodeId) {
        return this.nodeMap.get(nodeId);
    }

    /**
     * Get all child nodes for a specific parent
     * @param {string} parentId 
     * @returns {TreeNode[]}
     */
    getChildren(parentId) {
        const parent = this.nodeMap.get(parentId);
        return parent ? parent.children : [];
    }

    /**
     * Toggle collapse state of a node
     * @param {string} nodeId 
     * @returns {boolean} New collapsed state
     */
    toggleCollapse(nodeId) {
        const node = this.nodeMap.get(nodeId);
        if (node) {
            node.isCollapsed = !node.isCollapsed;
            return node.isCollapsed;
        }
        return false;
    }

    /**
     * Delete node and all its descendants
     * @param {string} nodeId 
     */
    deleteNode(nodeId) {
        const node = this.nodeMap.get(nodeId);
        if (!node) return;

        // Recursive removal from nodeMap
        const removeDescendants = (n) => {
            for (const child of n.children) {
                removeDescendants(child);
            }
            this.nodeMap.delete(n.id);
        };
        removeDescendants(node);

        if (node.parentId && this.nodeMap.has(node.parentId)) {
            this.nodeMap.get(node.parentId).removeChild(nodeId);
        } else {
            const idx = this.rootNodes.findIndex(r => r.id === nodeId);
            if (idx !== -1) {
                this.rootNodes.splice(idx, 1);
            }
        }
    }

    /**
     * Clear all nodes
     */
    clear() {
        this.rootNodes = [];
        this.nodeMap.clear();
    }

    /**
     * Serialize full tree to JSON
     * @returns {Object[]}
     */
    toJSON() {
        return this.rootNodes.map(r => r.toJSON());
    }

    /**
     * Reconstruct tree from serialized data
     * @param {Object[]} rawTree 
     * @returns {MessageTree}
     */
    static fromJSON(rawTree) {
        const tree = new MessageTree();
        if (!Array.isArray(rawTree)) return tree;

        const importNode = (data, parentId = null) => {
            const node = tree.addMessage(data, parentId);
            node.isCollapsed = !!data.isCollapsed;
            if (Array.isArray(data.children)) {
                for (const child of data.children) {
                    importNode(child, node.id);
                }
            }
        };

        for (const root of rawTree) {
            importNode(root, null);
        }

        return tree;
    }
}

module.exports = { TreeNode, MessageTree };
