const vscode = require('vscode');

class EditorBridge {
    /** Insert code directly at the cursor position in the active editor */
    static async insertToActiveEditor(code) {
        const editor = vscode.window.activeTextEditor;
        if (!editor) {
            vscode.window.showWarningMessage('There are no editors open. Open the file where you want to insert the code.');
            return false;
        }

        const success = await editor.edit(editBuilder => {
            const selection = editor.selection;
            if (selection.isEmpty) {
                editBuilder.insert(selection.active, code);
            } else {
                editBuilder.replace(selection, code);
            }
        });

        if (success) {
            vscode.window.showInformationMessage('I have inserted the code in the editor.');
        }
        return success;
    }

    /** Create a new untitled document and deploy the code */
    static async createNewDocument(code, language = 'javascript') {
        try {
            const doc = await vscode.workspace.openTextDocument({ content: code, language });
            await vscode.window.showTextDocument(doc);
            return true;
        } catch (err) {
            vscode.window.showErrorMessage(`Failed to create new file: ${err.message}`);
            return false;
        }
    }

    /** Copy to clipboard */
    static async copyToClipboard(text) {
        await vscode.env.clipboard.writeText(text);
        vscode.window.showInformationMessage('I have copied the text to the clipboard.');
    }
}

module.exports = { EditorBridge };
