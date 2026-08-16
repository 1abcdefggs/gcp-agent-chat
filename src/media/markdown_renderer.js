(function () {
    const ICONS = {
        copy: '<svg viewBox="0 0 24 24"><path d="M16 1H4c-1.1 0-2 .9-2 2v14h2V3h12V1zm3 4H8c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h11c1.1 0 2-.9 2-2V7c0-1.1-.9-2-2-2zm0 16H8V7h11v14z"/></svg>',
        insert: '<svg viewBox="0 0 24 24"><path d="M12 4l-1.41 1.41L16.17 11H4v2h12.17l-5.58 5.59L12 20l8-8z"/></svg>',
        newFile: '<svg viewBox="0 0 24 24"><path d="M14 2H6c-1.1 0-1.99.9-1.99 2L4 20c0 1.1.89 2 1.99 2H18c1.1 0 2-.9 2-2V8l-6-6zm2 14h-3v3h-2v-3H8v-2h3v-3h2v3h3v2zm-3-7V3.5L18.5 9H13z"/></svg>'
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

    function createThinkingIndicator() {
        const wrap = document.createElement('div');
        wrap.className = 'bouncing-thinking-indicator';
        wrap.innerHTML = `
            <div class="thinking-avatar-wrap">
                <img class="thinking-avatar-img" src="${window.LOGO_URI || ''}" alt="AI" />
            </div>
            <div class="bouncing-dots-container">
                <div class="bounce-dot dot-1"></div>
                <div class="bounce-dot dot-2"></div>
                <div class="bounce-dot dot-3"></div>
                <div class="bounce-dot dot-4"></div>
            </div>
            <span class="thinking-label">Thinking...</span>
        `;
        return wrap;
    }

    function createMessageNode(text, sender, status, id, vscode) {
        const row = document.createElement('div');
        if (id) row.id = id;
        row.className = `message-row ${sender}${status ? ' ' + status : ''}`;

        if (sender === 'user') {
            const bubble = document.createElement('div');
            bubble.className = 'bubble user';
            bubble.textContent = text;
            row.appendChild(bubble);
            return row;
        }

        if (sender === 'system' || sender === 'error') {
            const msg = document.createElement('div');
            msg.className = `message ${sender}`;
            msg.textContent = text;
            row.appendChild(msg);
            return row;
        }

        // Agent / AI Message with Animated Glowing Border Wrapper & Robot Avatar
        const aiWrapper = document.createElement('div');
        const isGenerating = status === 'thinking' || status === 'generating';
        aiWrapper.className = `ai-wrapper ${isGenerating ? 'generating' : 'finished'}`;

        const bubble = document.createElement('div');
        bubble.className = 'bubble ai';

        // Add Agent Header with Robot Avatar Icon
        const agentHeader = document.createElement('div');
        agentHeader.className = 'agent-msg-header';

        const avatarWrap = document.createElement('div');
        avatarWrap.className = 'agent-avatar-wrap';

        const avatarImg = document.createElement('img');
        avatarImg.className = 'agent-avatar-img';
        avatarImg.src = window.LOGO_URI || '';
        avatarImg.alt = 'Gemini Agent';
        avatarWrap.appendChild(avatarImg);

        const agentName = document.createElement('span');
        agentName.className = 'agent-name';
        agentName.textContent = 'Gemini Agent';

        agentHeader.append(avatarWrap, agentName);

        if (isGenerating) {
            const statusTag = document.createElement('span');
            statusTag.className = 'agent-status-tag';
            statusTag.textContent = 'Generating...';
            agentHeader.appendChild(statusTag);
        }

        bubble.appendChild(agentHeader);

        if (status === 'thinking' && (!text || text.trim() === 'Thinking...')) {
            bubble.appendChild(createThinkingIndicator());
        } else if (text?.includes('```')) {
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
                    bubble.appendChild(pre);
                } else {
                    appendMd(bubble, part);
                }
            });
        } else {
            appendMd(bubble, text);
        }

        aiWrapper.appendChild(bubble);
        row.appendChild(aiWrapper);
        return row;
    }

    window.MarkdownRenderer = {
        format: formatMarkdown,
        createMessageNode: createMessageNode
    };
})();
