/**
 * Thread Controller
 * Manages active thread focus, thread metadata, and branch navigation.
 */

class ThreadController {
    /**
     * @param {import('./message_tree').MessageTree} messageTree 
     */
    constructor(messageTree) {
        this.tree = messageTree;
        /** @type {string|null} Active thread parent message ID */
        this.activeThreadId = null;
    }

    /**
     * Set the currently focused thread
     * @param {string|null} parentId 
     */
    setActiveThread(parentId) {
        if (parentId && !this.tree.getNode(parentId)) {
            throw new Error(`Parent node with ID "${parentId}" does not exist in message tree.`);
        }
        this.activeThreadId = parentId;
    }

    /**
     * Close the active thread view and return to main chat root
     */
    closeActiveThread() {
        this.activeThreadId = null;
    }

    /**
     * Get active thread details
     * @returns {Object|null}
     */
    getActiveThreadInfo() {
        if (!this.activeThreadId) {
            return null;
        }
        const parentNode = this.tree.getNode(this.activeThreadId);
        if (!parentNode) {
            this.activeThreadId = null;
            return null;
        }
        return {
            parentId: parentNode.id,
            parentSender: parentNode.sender,
            parentText: parentNode.text,
            childCount: parentNode.children.length,
            children: parentNode.children.map(c => c.toJSON())
        };
    }

    /**
     * Get list of all available threads with preview
     * @returns {Array<{ id: string, sender: string, previewText: string, replyCount: number, latestTimestamp: number }>}
     */
    getAllThreads() {
        const threads = [];
        for (const root of this.tree.rootNodes) {
            if (root.children.length > 0) {
                threads.push({
                    id: root.id,
                    sender: root.sender,
                    previewText: root.text.slice(0, 80),
                    replyCount: root.children.length,
                    latestTimestamp: root.children[root.children.length - 1].timestamp
                });
            }
        }
        return threads;
    }
}

module.exports = { ThreadController };
