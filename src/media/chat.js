(function () {
    const vscode = acquireVsCodeApi();
    const $ = id => document.getElementById(id);

    const chatContainer = $('chatContainer'), promptInput = $('promptInput'), sendBtn = $('sendBtn');
    const modelSelect = $('modelSelect'), langSelect = $('langSelect'), settingsBtn = $('settingsBtn');
    const newChatBtn = $('newChatBtn'), historyBtn = $('historyBtn'), exportBtn = $('exportBtn');
    const statusBadge = $('statusBadge'), statusText = $('statusText'), costBadge = $('costBadge'), costText = $('costText');
    const fileInput = $('fileInput'), attachBtn = $('attachBtn'), previewBar = $('imagePreviewBar');
    const spectrumOrb = $('spectrumOrb'), toggleEffectsBtn = $('toggleEffectsBtn'), inputWrapper = $('inputWrapper');

    let attachedImages = [];
    let currentGcpStatus = null;
    let isRichUi = true;

    // ── Restore State & Effects Toggle ──
    const savedState = vscode.getState() || {};
    if (savedState.richUi !== undefined) {
        isRichUi = savedState.richUi;
    }

    const setRichUi = enabled => {
        isRichUi = enabled;
        document.body.classList.toggle('rich-ui', enabled);
        if (toggleEffectsBtn) {
            toggleEffectsBtn.classList.toggle('active', enabled);
            toggleEffectsBtn.title = enabled ? 'Gemini Visual Effects: ON (Click to disable)' : 'Gemini Visual Effects: OFF (Click to enable)';
        }
        vscode.setState({ ...vscode.getState(), richUi: enabled });
    };

    setRichUi(isRichUi);

    // ── Spectrum Orb Intelligence State ──
    const setOrbState = state => {
        if (!spectrumOrb) return;
        spectrumOrb.className = `spectrum-orb state-${state}`;
    };

    const adjustHeight = () => {
        promptInput.style.height = 'auto';
        const h = promptInput.scrollHeight;
        promptInput.style.height = (h > 180 ? 180 : Math.max(h, 32)) + 'px';
        promptInput.style.overflowY = h > 180 ? 'auto' : 'hidden';
        const hasContent = promptInput.value.trim().length > 0 || attachedImages.length > 0;
        sendBtn.disabled = !hasContent;
        if (inputWrapper) {
            inputWrapper.classList.toggle('active', hasContent);
        }
    };

    const updateGcpStatusUI = st => {
        currentGcpStatus = st;
        const isLoading = st?.loading;
        const isOk = st?.authenticated && st?.projectId;

        // Header status badge
        if (isLoading) {
            statusBadge.className = 'badge clickable loading';
            statusText.textContent = 'GCP : Connecting...';
            statusBadge.title = 'Verifying Google Cloud connection...';
            setOrbState('thinking');
        } else if (isOk) {
            statusBadge.className = 'badge clickable connected';
            statusText.textContent = 'GCP : Connected';
            statusBadge.title = `GCP : Connected (${st.projectId})\nClick for account details`;
            setOrbState('connected');
        } else {
            statusBadge.className = 'badge clickable disconnected';
            statusText.textContent = 'GCP : Disconnected';
            statusBadge.title = `${st?.error || 'Project ID not configured'} (Click to connect)`;
            setOrbState('disconnected');
        }

        // Welcome card wrapper & status box
        const welcomeWrapper = $('welcomeCardWrapper');
        if (welcomeWrapper) {
            welcomeWrapper.className = `welcome-card-wrapper ${isLoading ? 'connecting' : (isOk ? 'connected' : 'disconnected')}`;
        }

        const statusBox = $('welcomeStatusBox');
        if (statusBox) {
            if (isLoading) {
                statusBox.innerHTML = `
                    <div class="welcome-status-pill loading">
                        <span class="spinner-dot"></span>
                        <span>Connecting to Google Cloud...</span>
                    </div>
                `;
            } else if (isOk) {
                statusBox.innerHTML = `
                    <div class="welcome-status-pill connected clickable" id="welcomeStatusPill" title="Connected: ${st.projectId}">
                        <span class="status-dot"></span>
                        <span>GCP : Connected (${st.projectId})</span>
                    </div>
                `;
                const pill = $('welcomeStatusPill');
                if (pill) pill.onclick = () => vscode.postMessage({ type: 'checkStatus' });
            } else {
                statusBox.innerHTML = `
                    <div class="welcome-status-pill disconnected">
                        <span class="status-dot"></span>
                        <span>GCP : Disconnected</span>
                    </div>
                    <button class="welcome-login-btn" id="welcomeLoginBtn" title="Sign in with IDE Google Login or gcloud">
                        <svg viewBox="0 0 24 24" width="14" height="14"><path d="M12.65 10C11.83 7.67 9.61 6 7 6c-3.31 0-6 2.69-6 6s2.69 6 6 6c2.61 0 4.83-1.67 5.65-4H17v4h4v-4h2v-4H12.65zM7 14c-1.1 0-2-.9-2-2s.9-2 2-2 2 .9 2 2-.9 2-2 2z"/></svg>
                        <span>Connect & Sign In to GCP</span>
                    </button>
                `;
                const btn = $('welcomeLoginBtn');
                if (btn) btn.onclick = () => vscode.postMessage({ type: 'checkStatus' });
            }
        }
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
            const isLoading = currentGcpStatus?.loading;
            const isOk = currentGcpStatus?.authenticated && currentGcpStatus?.projectId;
            const stateClass = isLoading ? 'connecting' : (isOk ? 'connected' : 'disconnected');

            const welcomeWrapper = document.createElement('div');
            welcomeWrapper.id = 'welcomeCardWrapper';
            welcomeWrapper.className = `welcome-card-wrapper ${stateClass}`;
            welcomeWrapper.innerHTML = `
                <div class="welcome-card">
                    <div class="welcome-icon-wrap">
                        <img class="welcome-logo-img" src="${window.LOGO_URI || ''}" alt="GCP Agent Chat Logo" />
                    </div>
                    <div class="welcome-title">GCP Agent Chat</div>
                    <div class="welcome-desc">Google Cloud Vertex AI & Gemini powered coding assistant. Ask questions, inspect workspace files, or generate code.</div>
                    <div class="welcome-status-box" id="welcomeStatusBox"></div>
                </div>
            `;
            chatContainer.appendChild(welcomeWrapper);
            if (currentGcpStatus) {
                updateGcpStatusUI(currentGcpStatus);
            }
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
        if (inputWrapper) inputWrapper.classList.remove('active');

        const images = [...attachedImages];
        attachedImages = [];
        renderPreviews();

        setOrbState('thinking');

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
    promptInput.addEventListener('focus', () => { if (inputWrapper) inputWrapper.classList.add('active'); });
    promptInput.addEventListener('blur', () => {
        if (inputWrapper && !promptInput.value.trim() && attachedImages.length === 0) {
            inputWrapper.classList.remove('active');
        }
    });
    promptInput.addEventListener('keydown', e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); send(); } });
    sendBtn.addEventListener('click', send);
    if (toggleEffectsBtn) toggleEffectsBtn.addEventListener('click', () => setRichUi(!isRichUi));
    newChatBtn.addEventListener('click', () => {
        setOrbState('idle');
        vscode.postMessage({ type: 'newSession' });
    });
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
                if (msg.enableRichAnimations !== undefined && savedState.richUi === undefined) {
                    setRichUi(msg.enableRichAnimations);
                }
                break;
            case 'setRichAnimations':
                setRichUi(msg.enabled);
                break;
            case 'addMessage':
                appendMessage(msg.message.text, msg.message.sender, msg.message.status, msg.message.id);
                if (msg.message.sender === 'agent') {
                    setOrbState(msg.message.status === 'generating' ? 'replying' : 'idle');
                }
                break;
            case 'updateMessage': {
                const m = msg.message;
                if (!m) break;
                const target = (m.id ? $(m.id) : null) || chatContainer.lastElementChild;
                if (target) {
                    chatContainer.replaceChild(window.MarkdownRenderer.createMessageNode(m.text, m.sender, m.status, m.id, vscode), target);
                    chatContainer.scrollTop = chatContainer.scrollHeight;
                }
                if (m.sender === 'agent') {
                    setOrbState(m.status === 'generating' ? 'replying' : 'idle');
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

