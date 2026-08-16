(function () {
    const vscode = acquireVsCodeApi();
    const $ = id => document.getElementById(id);

    const chatContainer = $('chatContainer'), promptInput = $('promptInput'), sendBtn = $('sendBtn');
    const modelSelect = $('modelSelect'), langSelect = $('langSelect'), settingsBtn = $('settingsBtn');
    const newChatBtn = $('newChatBtn'), historyBtn = $('historyBtn'), exportBtn = $('exportBtn');
    const statusBadge = $('statusBadge'), statusText = $('statusText'), costBadge = $('costBadge'), costText = $('costText');
    const fileInput = $('fileInput'), attachBtn = $('attachBtn'), previewBar = $('imagePreviewBar');

    let attachedImages = [];

    const adjustHeight = () => {
        promptInput.style.height = 'auto';
        const h = promptInput.scrollHeight;
        promptInput.style.height = (h > 180 ? 180 : Math.max(h, 32)) + 'px';
        promptInput.style.overflowY = h > 180 ? 'auto' : 'hidden';
        sendBtn.disabled = !promptInput.value.trim() && attachedImages.length === 0;
    };

    const updateGcpStatusUI = st => {
        const isOk = st?.authenticated && st?.projectId;
        statusBadge.className = `badge clickable ${isOk ? 'connected' : 'disconnected'}`;
        statusText.textContent = isOk ? 'GCP : Connected' : 'GCP : Disconnected';
        statusBadge.title = isOk ? 'GCP : Connected (Click for account/project details)' : `${st?.error || 'Project ID not configured'} (Click to connect)`;
    };

    const appendMessage = (text, sender, status, id) => {
        chatContainer.appendChild(window.MarkdownRenderer.createMessageNode(text, sender, status, id, vscode));
        chatContainer.scrollTop = chatContainer.scrollHeight;
    };

    const renderMessages = messages => {
        chatContainer.innerHTML = '';
        if (messages?.length) {
            messages.forEach(m => appendMessage(m.text, m.sender, m.status, m.id));
        } else {
            appendMessage('Connected to GCP Agent Chat Platform. Feel free to inspect workspace files, generate code, or ask questions.', 'agent', 'complete');
        }
    };

    const populateSelect = (el, items, val) => {
        if (!items?.length) return;
        el.replaceChildren();
        items.forEach(item => {
            const option = document.createElement('option');
            option.value = String(item.id ?? '');
            option.textContent = String(item.name || item.id || '');
            option.selected = item.id === val;
            el.appendChild(option);
        });
        if (val) el.value = val;
    };

    const renderPreviews = () => {
        previewBar.innerHTML = '';
        attachedImages.forEach((img, i) => {
            const wrap = document.createElement('div');
            wrap.className = 'preview-thumb-container';
            wrap.innerHTML = `<img class="preview-thumb" src="${img}"><button class="remove-thumb-btn">×</button>`;
            wrap.querySelector('button').onclick = () => {
                attachedImages.splice(i, 1);
                renderPreviews();
            };
            previewBar.appendChild(wrap);
        });
        adjustHeight();
    };

    const addImage = file => {
        if (!file?.type?.startsWith('image/')) return;
        const r = new FileReader();
        r.onload = e => { attachedImages.push(e.target.result); renderPreviews(); };
        r.readAsDataURL(file);
    };

    const send = () => {
        const prompt = promptInput.value.trim();
        if (!prompt && !attachedImages.length) return;

        promptInput.value = '';
        promptInput.style.height = '32px';
        promptInput.style.overflowY = 'hidden';
        sendBtn.disabled = true;

        const images = [...attachedImages];
        attachedImages = [];
        renderPreviews();

        vscode.postMessage({
            type: 'sendMessage',
            prompt: prompt || '(Image Attachment)',
            model: modelSelect.value,
            language: langSelect.value,
            images
        });
    };

    // Event Bindings
    promptInput.addEventListener('input', adjustHeight);
    promptInput.addEventListener('keydown', e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); send(); } });
    sendBtn.addEventListener('click', send);
    newChatBtn.addEventListener('click', () => vscode.postMessage({ type: 'newSession' }));
    historyBtn.addEventListener('click', () => vscode.postMessage({ type: 'openSessionHistory' }));
    settingsBtn.addEventListener('click', () => vscode.postMessage({ type: 'openSettings' }));
    if (costBadge) costBadge.addEventListener('click', () => vscode.postMessage({ type: 'openSettings' }));
    exportBtn.addEventListener('click', () => vscode.postMessage({ type: 'exportMarkdown' }));
    statusBadge.addEventListener('click', () => vscode.postMessage({ type: 'checkStatus' }));
    attachBtn.onclick = () => fileInput.click();
    fileInput.onchange = e => { if (e.target.files?.[0]) { addImage(e.target.files[0]); fileInput.value = ''; } };

    window.addEventListener('paste', e => {
        const items = (e.clipboardData || e.originalEvent?.clipboardData)?.items;
        if (items) {
            for (const it of items) if (it.type?.includes('image')) addImage(it.getAsFile());
        }
    });

    window.addEventListener('message', ({ data: msg }) => {
        switch (msg.type) {
            case 'syncState':
                if (msg.availableModels) populateSelect(modelSelect, msg.availableModels, msg.model);
                if (msg.availableLanguages) populateSelect(langSelect, msg.availableLanguages, msg.language);
                if (msg.messages !== undefined) renderMessages(msg.messages);
                if (msg.gcpStatus) updateGcpStatusUI(msg.gcpStatus);
                break;
            case 'addMessage':
                appendMessage(msg.message.text, msg.message.sender, msg.message.status, msg.message.id);
                break;
            case 'updateMessage': {
                const m = msg.message;
                if (!m) break;
                const target = (m.id ? $(m.id) : null) || chatContainer.lastElementChild;
                if (target) {
                    chatContainer.replaceChild(window.MarkdownRenderer.createMessageNode(m.text, m.sender, m.status, m.id, vscode), target);
                    chatContainer.scrollTop = chatContainer.scrollHeight;
                }
                break;
            }
            case 'gcpStatus':
                updateGcpStatusUI(msg.gcpStatus);
                break;
            case 'costUpdate': {
                if (costText && costBadge) {
                    const cost = (msg.totalCost !== undefined ? msg.totalCost : (msg.dailyCost || 0)).toFixed(4);
                    const budget = (msg.budgetLimit !== undefined ? msg.budgetLimit : 10.0).toFixed(2);
                    costText.textContent = `~$${cost} / $${budget}`;
                    costBadge.title = `【Approximate cost】 ~$${cost} / budget: $${budget}\n※Estimated usage fees based on Vertex AI token unit prices. Different from actual Cloud Billing charges.(Click to set budget)`;
                    costBadge.style.color = msg.isOverBudget ? 'var(--error-color)' : '';
                }
                break;
            }
            case 'fillPrompt':
                promptInput.value = msg.prompt;
                adjustHeight();
                promptInput.focus();
                break;
        }
    });

    vscode.postMessage({ type: 'ready' });
})();

