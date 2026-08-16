(function () {
    const vscode = acquireVsCodeApi();
    const $ = id => document.getElementById(id);

    const chatContainer = $('chatContainer'), promptInput = $('promptInput'), sendBtn = $('sendBtn');
    const modelPillContainer = $('modelPillContainer'), langSelect = $('langSelect'), settingsBtn = $('settingsBtn');
    const newChatBtn = $('newChatBtn'), historyBtn = $('historyBtn'), exportBtn = $('exportBtn');
    const statusBadge = $('statusBadge'), statusText = $('statusText'), costBadge = $('costBadge'), costText = $('costText');
    const fileInput = $('fileInput'), attachBtn = $('attachBtn'), previewBar = $('imagePreviewBar');
    const spectrumOrb = $('spectrumOrb'), toggleEffectsBtn = $('toggleEffectsBtn'), inputWrapper = $('inputWrapper');
    const maskToggleBtn = $('maskToggleBtn');

    let attachedImages = [];
    let currentGcpStatus = null;
    let isRichUi = true;
    let isMasked = true;
    let selectedModel = 'gemini-3.7-flash';
    let availableModelsList = [];

    // ── Restore State & Effects Toggle ──
    const savedState = vscode.getState() || {};
    if (savedState.richUi !== undefined) isRichUi = savedState.richUi;
    if (savedState.isMasked !== undefined) isMasked = savedState.isMasked;

    const setRichUi = enabled => {
        isRichUi = enabled;
        document.body.classList.toggle('rich-ui', enabled);
        if (toggleEffectsBtn) {
            toggleEffectsBtn.classList.toggle('active', enabled);
            toggleEffectsBtn.title = enabled ? 'Gemini Visual Effects: ON (Click to disable)' : 'Gemini Visual Effects: OFF (Click to enable)';
        }
        vscode.setState({ ...vscode.getState(), richUi: enabled });
    };

    const setMasked = masked => {
        isMasked = masked;
        if (maskToggleBtn) {
            maskToggleBtn.title = masked ? 'Show Project ID (Currently Hidden)' : 'Hide Project ID (Currently Visible)';
            const icon = $('eyeIcon');
            if (icon) {
                icon.innerHTML = masked
                    ? '<path d="M12 4.5C7 4.5 2.73 7.61 1 12c1.73 4.39 6 7.5 11 7.5s9.27-3.11 11-7.5c-1.73-4.39-6-7.5-11-7.5zM12 17c-2.76 0-5-2.24-5-5s2.24-5 5-5 5 2.24 5 5-2.24 5-5 5zm0-8c-1.66 0-3 1.34-3 3s1.34 3 3 3 3-1.34 3-3-1.34-3-3-3z"/>'
                    : '<path d="M12 7c2.76 0 5 2.24 5 5 0 .65-.13 1.26-.36 1.83l2.92 2.92c1.51-1.26 2.7-2.89 3.43-4.75-1.73-4.39-6-7.5-11-7.5-1.4 0-2.74.25-3.98.7l2.16 2.16C10.74 7.13 11.35 7 12 7zM2 4.27l2.28 2.28.46.46C3.08 8.3 1.78 10.02 1 12c1.73 4.39 6 7.5 11 7.5 1.55 0 3.03-.3 4.38-.84l.42.42L19.73 22 21 20.73 3.27 3 2 4.27zM7.53 9.8l1.55 1.55c-.05.21-.08.43-.08.65 0 1.66 1.34 3 3 3 .22 0 .44-.03.65-.08l1.55 1.55c-.67.33-1.41.53-2.2.53-2.76 0-5-2.24-5-5 0-.79.2-1.53.53-2.2zm4.31-.78l3.15 3.15.02-.16c0-1.66-1.34-3-3-3l-.17.01z"/>';
            }
        }
        vscode.setState({ ...vscode.getState(), isMasked: masked });
        if (currentGcpStatus) updateGcpStatusUI(currentGcpStatus);
    };

    setRichUi(isRichUi);
    setMasked(isMasked);

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
        const displayProj = isMasked ? '••••••' : st?.projectId;

        // Header status badge
        if (isLoading) {
            statusBadge.className = 'badge clickable loading';
            statusText.textContent = 'GCP : Connecting...';
            statusBadge.title = 'Verifying Google Cloud connection...';
            setOrbState('thinking');
        } else if (isOk) {
            statusBadge.className = 'badge clickable connected';
            statusText.textContent = isMasked ? 'GCP : Connected' : `GCP : ${st.projectId}`;
            statusBadge.title = `GCP : Connected (${st.projectId})\nClick for account details & options`;
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
            statusBox.replaceChildren();
            if (isLoading) {
                const pill = document.createElement('div');
                pill.className = 'welcome-status-pill loading';

                const dot = document.createElement('span');
                dot.className = 'spinner-dot';

                const label = document.createElement('span');
                label.textContent = 'Connecting to Google Cloud...';

                pill.append(dot, label);
                statusBox.appendChild(pill);
            } else if (isOk) {
                const pill = document.createElement('div');
                pill.className = 'welcome-status-pill connected clickable';
                pill.id = 'welcomeStatusPill';
                pill.title = `Connected: ${st.projectId}`;
                pill.onclick = () => vscode.postMessage({ type: 'checkStatus' });

                const dot = document.createElement('span');
                dot.className = 'status-dot';

                const label = document.createElement('span');
                label.textContent = `GCP : Connected (${displayProj})`;

                pill.append(dot, label);
                statusBox.appendChild(pill);
            } else {
                const pill = document.createElement('div');
                pill.className = 'welcome-status-pill disconnected';

                const dot = document.createElement('span');
                dot.className = 'status-dot';

                const label = document.createElement('span');
                label.textContent = 'GCP : Disconnected';

                pill.append(dot, label);

                const btn = document.createElement('button');
                btn.className = 'welcome-login-btn';
                btn.id = 'welcomeLoginBtn';
                btn.title = 'Sign in with IDE Google Login or gcloud';
                btn.onclick = () => vscode.postMessage({ type: 'checkStatus' });

                const btnText = document.createElement('span');
                btnText.textContent = 'Connect & Sign In to GCP';

                btn.innerHTML = '<svg viewBox="0 0 24 24" width="14" height="14"><path d="M12.65 10C11.83 7.67 9.61 6 7 6c-3.31 0-6 2.69-6 6s2.69 6 6 6c2.61 0 4.83-1.67 5.65-4H17v4h4v-4h2v-4H12.65zM7 14c-1.1 0-2-.9-2-2s.9-2 2-2 2 .9 2 2-.9 2-2 2z"/></svg>';
                btn.appendChild(btnText);

                statusBox.append(pill, btn);
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

    // ── 🌟 Model Pill Buttons Generator ──
    const populateModelPills = (items, currentVal) => {
        if (!items?.length || !modelPillContainer) return;
        availableModelsList = items;
        if (currentVal) selectedModel = currentVal;

        modelPillContainer.innerHTML = '';
        items.forEach(item => {
            const btn = document.createElement('button');
            const modelId = String(item.id ?? '');
            const modelName = String(item.name || item.id || '');
            const isSelected = modelId === selectedModel;

            btn.className = `model-pill ${isSelected ? 'active' : ''}`;
            btn.textContent = modelName.replace('gemini-', '');
            btn.title = `Switch to model: ${modelId}`;
            btn.onclick = () => {
                selectedModel = modelId;
                Array.from(modelPillContainer.children).forEach(c => c.classList.remove('active'));
                btn.classList.add('active');
                vscode.postMessage({ type: 'selectModel', model: modelId });
            };
            modelPillContainer.appendChild(btn);
        });
    };

    const populateSelect = (el, items, val) => {
        if (!items?.length || !el) return;
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
        previewBar.replaceChildren();
        attachedImages.forEach((imgSrc, i) => {
            const wrap = document.createElement('div');
            wrap.className = 'preview-thumb-container';

            const img = document.createElement('img');
            img.className = 'preview-thumb';
            img.src = imgSrc;

            const btn = document.createElement('button');
            btn.className = 'remove-thumb-btn';
            btn.textContent = '×';
            btn.onclick = () => {
                attachedImages.splice(i, 1);
                renderPreviews();
            };

            wrap.append(img, btn);
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
            model: selectedModel,
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
    if (maskToggleBtn) maskToggleBtn.addEventListener('click', () => setMasked(!isMasked));
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
                if (msg.availableModels) populateModelPills(msg.availableModels, msg.model);
                if (msg.availableLanguages) populateSelect(langSelect, msg.availableLanguages, msg.language);
                if (msg.messages !== undefined) renderMessages(msg.messages);
                if (msg.gcpStatus) updateGcpStatusUI(msg.gcpStatus);
                if (msg.maskProjectId !== undefined && savedState.isMasked === undefined) {
                    setMasked(msg.maskProjectId);
                }
                if (msg.enableRichAnimations !== undefined && savedState.richUi === undefined) {
                    setRichUi(msg.enableRichAnimations);
                }
                break;
            case 'setRichAnimations':
                setRichUi(msg.enabled);
                break;
            case 'setMaskProjectId':
                setMasked(msg.masked);
                break;
            case 'selectModel':
                if (msg.model) populateModelPills(availableModelsList, msg.model);
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

