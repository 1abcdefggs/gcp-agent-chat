(function () {
    const ICONS = {
        copy: '<svg viewBox="0 0 16 16"><path d="M4 1.5H3a2 2 0 0 0-2 2V14a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V3.5a2 2 0 0 0-2-2h-1v1h1a1 1 0 0 1 1 1V14a1 1 0 0 1-1 1H3a1 1 0 0 1-1-1V3.5a1 1 0 0 1 1-1h1v-1z"/><path d="M9.5 1a.5.5 0 0 1 .5.5v1a.5.5 0 0 1-.5.5h-3a.5.5 0 0 1-.5-.5v-1a.5.5 0 0 1 .5-.5h3zm-3-1A1.5 1.5 0 0 0 5 1.5v1A1.5 1.5 0 0 0 6.5 4h3A1.5 1.5 0 0 0 11 2.5v-1A1.5 1.5 0 0 0 9.5 0h-3z"/></svg>',
        insert: '<svg viewBox="0 0 16 16"><path fill-rule="evenodd" d="M1 8a.5.5 0 0 1 .5-.5h11.793l-3.147-3.146a.5.5 0 0 1 .708-.708l4 4a.5.5 0 0 1 0 .708l-4 4a.5.5 0 0 1-.708-.708L13.293 8.5H1.5A.5.5 0 0 1 1 8z"/></svg>',
        newFile: '<svg viewBox="0 0 16 16"><path d="M14 4.5V14a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V2a2 2 0 0 1 2-2h5.5L14 4.5zm-3 0A1.5 1.5 0 0 1 9.5 3V1H4a1 1 0 0 0-1 1v12a1 1 0 0 1 1 1h8a1 1 0 0 0 1-1V4.5h-2z"/></svg>'
    };

    function formatMarkdown(text) {
        if (!text) return '';
        let html = text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
            .replace(/^### (.*$)/gim, '<h4 class="md-h4">$1</h4>')
            .replace(/^## (.*$)/gim, '<h3 class="md-h3">$1</h3>')
            .replace(/^# (.*$)/gim, '<h2 class="md-h2">$1</h2>')
            .replace(/^---$/gim, '<hr class="md-hr">')
            .replace(/\*\*\*(.*?)\*\*\*/gim, '<strong><em>$1</em></strong>')
            .replace(/\*\*(.*?)\*\*/gim, '<strong>$1</strong>')
            .replace(/\*(.*?)\*/gim, '<em>$1</em>')
            .replace(/`([^`]+)`/gim, '<code class="md-inline-code">$1</code>')
            .replace(/^\s*[-*+]\s+(.*$)/gim, '<li class="md-li">$1</li>')
            .replace(/(<li class="md-li">[\s\S]*?<\/li>)/gim, '<ul class="md-ul">$1</ul>')
            .replace(/<\/ul>\s*<ul class="md-ul">/gim, '')
            .replace(/^\s*(\d+)\.\s+(.*$)/gim, '<li class="md-oli" value="$1">$2</li>')
            .replace(/(<li class="md-oli">[\s\S]*?<\/li>)/gim, '<ol class="md-ol">$1</ol>')
            .replace(/<\/ol>\s*<ol class="md-ol">/gim, '')
            .replace(/\n\n+/g, '</p><p class="md-p">').replace(/\n/g, '<br>');
        return `<div class="md-content"><p class="md-p">${html}</p></div>`
            .replace(/<p class="md-p"><\/p>/g, '')
            .replace(/<p class="md-p"><(h[234]|hr|ul|ol)/gim, '<$1')
            .replace(/<\/(h[234]|hr|ul|ol)><\/p>/gim, '</$1>');
    }

    function createCodeBtn(icon, label, onClick) {
        const btn = document.createElement('button');
        btn.className = 'code-btn';
        btn.innerHTML = `${icon} ${label}`;
        btn.onclick = onClick;
        return btn;
    }

    function appendMd(el, text) {
        if (!text?.trim()) return;
        const div = document.createElement('div');
        div.innerHTML = formatMarkdown(text);
        el.appendChild(div);
    }

    function createMessageNode(text, sender, status, id, vscode) {
        const el = document.createElement('div');
        if (id) el.id = id;
        el.className = `message ${sender}${status ? ' ' + status : ''}`;
        if (sender === 'user') {
            el.textContent = text;
            return el;
        }

        if (text?.includes('```')) {
            text.split(/(```[\s\S]*?```)/g).forEach(part => {
                if (part.startsWith('```') && part.endsWith('```')) {
                    const firstNL = part.indexOf('\n');
                    const lang = part.substring(3, firstNL).trim() || 'plaintext';
                    const code = part.substring(firstNL + 1, part.length - 3);

                    const pre = document.createElement('pre');
                    const hdr = document.createElement('div');
                    hdr.className = 'code-header';
                    hdr.appendChild(createCodeBtn(ICONS.copy, 'Copy', () => vscode.postMessage({ type: 'copyText', text: code })));
                    hdr.appendChild(createCodeBtn(ICONS.insert, 'Insert', () => vscode.postMessage({ type: 'insertCode', code })));
                    hdr.appendChild(createCodeBtn(ICONS.newFile, 'New File', () => vscode.postMessage({ type: 'createFile', code, language: lang })));

                    const codeEl = document.createElement('code');
                    codeEl.textContent = code;
                    pre.append(hdr, codeEl);
                    el.appendChild(pre);
                } else {
                    appendMd(el, part);
                }
            });
        } else {
            appendMd(el, text);
        }
        return el;
    }

    window.MarkdownRenderer = {
        format: formatMarkdown,
        createMessageNode: createMessageNode
    };
})();
