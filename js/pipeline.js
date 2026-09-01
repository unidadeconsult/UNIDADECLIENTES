const PipelineModule = {
    _view: 'expanded',
    _mode: 'pipeline',

    init() {
        this.render();
    },

    switchMode(mode, btn) {
        this._mode = mode;
        document.querySelectorAll('.pipeline-tab').forEach(t => t.classList.remove('active'));
        if (btn) btn.classList.add('active');
        const filterBar = document.querySelector('.pipeline-filter-bar');
        if (filterBar) filterBar.style.display = mode === 'aguardando' ? 'none' : '';
        this.render();
    },

    render() {
        if (this._mode === 'aguardando') {
            this.renderAguardando();
            return;
        }
        const typeFilter = document.getElementById('pipelineTypeFilter');
        const tagFilter = document.getElementById('pipelineTagFilter');
        const daysFilter = document.getElementById('pipelineDaysFilter');

        const typeVal = typeFilter ? typeFilter.value : 'all';
        const tagVal = tagFilter ? tagFilter.value : 'all';
        const daysVal = daysFilter ? daysFilter.value : 'all';

        let clients = ClientStore.getAll().filter(c => c.status !== 'inativo' && c.status !== 'perdido');

        if (typeVal !== 'all') {
            clients = clients.filter(c => c.type === typeVal);
        }
        if (tagVal !== 'all') {
            clients = clients.filter(c => (c.tags || []).includes(tagVal));
        }
        if (daysVal !== 'all') {
            const minDays = parseInt(daysVal);
            clients = clients.filter(c => ClientsModule.daysSinceContact(c.lastContact) >= minDays);
        }

        this.updateTagFilter();

        const container = document.getElementById('pipelineBoard');
        container.innerHTML = PIPELINE_STAGES.map(stage => {
            const stageClients = clients.filter(c => (c.stage || 'protocolo') === stage.id);
            return `
                <div class="pipeline-column" data-stage="${stage.id}">
                    <div class="pipeline-header" style="border-top: 3px solid ${stage.color}">
                        <span class="pipeline-title">${stage.label}</span>
                        <span class="pipeline-count">${stageClients.length}</span>
                    </div>
                    <div class="pipeline-cards" data-stage="${stage.id}"
                         ondragover="PipelineModule.handleDragOver(event)"
                         ondrop="PipelineModule.handleDrop(event)"
                         ondragleave="PipelineModule.handleDragLeave(event)">
                        ${stageClients.length === 0
                            ? '<p class="pipeline-empty">Nenhum processo</p>'
                            : stageClients.map(c => this.renderCard(c)).join('')}
                    </div>
                </div>
            `;
        }).join('');
    },

    renderCard(client) {
        const days = ClientsModule.daysSinceContact(client.lastContact);
        const daysClass = days > 60 ? 'danger' : days > 30 ? 'warning' : 'ok';
        const isCompact = this._view === 'compact';

        if (isCompact) {
            return `
                <div class="pipeline-card compact" draggable="true"
                     ondragstart="PipelineModule.handleDragStart(event, '${client.id}')"
                     data-client-id="${client.id}">
                    <div class="pipeline-card-name">${ClientsModule.escapeHtml(client.name)}</div>
                    <div class="pipeline-card-footer">
                        <span class="badge badge-${client.type || 'outro'}">${ClientsModule.typeLabel(client.type)}</span>
                        <span class="days-badge days-${daysClass}">${days}d</span>
                    </div>
                </div>
            `;
        }

        const tags = (client.tags || []).map(t =>
            `<span class="tag-chip">${ClientsModule.escapeHtml(t)}</span>`
        ).join('');

        const lastInteraction = InteractionStore.getByClient(client.id)[0];
        let interactionHtml = '';
        if (lastInteraction) {
            const icon = InteractionsModule.typeIcon(lastInteraction.type);
            const desc = lastInteraction.description.length > 40
                ? lastInteraction.description.substring(0, 40) + '...'
                : lastInteraction.description;
            interactionHtml = `<div class="pipeline-card-interaction" title="${ClientsModule.escapeHtml(lastInteraction.description)}">
                <span class="pipeline-interaction-icon">${icon}</span>
                <span class="pipeline-interaction-text">${ClientsModule.escapeHtml(desc)}</span>
                <span class="pipeline-interaction-date">${ClientsModule.formatDate(lastInteraction.date)}</span>
            </div>`;
        }

        const whatsappBtn = client.phone
            ? `<button class="btn-icon btn-whatsapp" onclick="PipelineModule.openWhatsApp('${client.id}')" title="WhatsApp">&#128172;</button>`
            : '';

        return `
            <div class="pipeline-card" draggable="true"
                 ondragstart="PipelineModule.handleDragStart(event, '${client.id}')"
                 data-client-id="${client.id}">
                <div class="pipeline-card-name">${ClientsModule.escapeHtml(client.name)}</div>
                <div class="pipeline-card-process">${ClientsModule.escapeHtml(client.process || client.company || '')}</div>
                ${tags ? `<div class="pipeline-card-tags">${tags}</div>` : ''}
                ${interactionHtml}
                <div class="pipeline-card-footer">
                    <span class="badge badge-${client.type || 'outro'}">${ClientsModule.typeLabel(client.type)}</span>
                    <span class="days-badge days-${daysClass}">${days}d</span>
                </div>
                <div class="pipeline-card-actions">
                    <button class="btn-icon" onclick="ClientsModule.openDetail('${client.id}')" title="Detalhes">&#128065;</button>
                    <button class="btn-icon" onclick="InteractionsModule.openLog('${client.id}')" title="Historico">&#128221;</button>
                    ${whatsappBtn}
                    <button class="btn-icon" onclick="PipelineModule.openStageSelector('${client.id}')" title="Mover etapa">&#9654;</button>
                </div>
            </div>
        `;
    },

    renderAguardando() {
        const TAG = 'Aguardando Definição';
        const TAG_ALT = 'Aguardando Definicao';
        const allClients = ClientStore.getAll().filter(c =>
            c.status !== 'inativo' && c.status !== 'perdido' &&
            (c.tags || []).some(t => t === TAG || t === TAG_ALT || t.toLowerCase().includes('aguardando defini'))
        );

        const container = document.getElementById('pipelineBoard');

        if (allClients.length === 0) {
            container.innerHTML = `
                <div style="text-align:center;padding:48px 24px;color:var(--text-light)">
                    <div style="font-size:48px;margin-bottom:12px">&#9203;</div>
                    <h3 style="margin-bottom:8px;color:var(--text)">Nenhum cliente aguardando definicao</h3>
                    <p>Clientes com a etiqueta "Aguardando Definicao" aparecerão aqui.</p>
                </div>`;
            return;
        }

        const grouped = {};
        PIPELINE_STAGES.forEach(s => {
            const sc = allClients.filter(c => (c.stage || 'protocolo') === s.id);
            if (sc.length > 0) grouped[s.id] = { stage: s, clients: sc };
        });

        container.innerHTML = `
            <div class="aguardando-view">
                <div class="aguardando-summary">
                    <span class="aguardando-count">${allClients.length}</span>
                    <span>cliente${allClients.length !== 1 ? 's' : ''} aguardando definicao</span>
                </div>
                ${Object.values(grouped).map(g => `
                    <div class="aguardando-group">
                        <div class="aguardando-group-header" style="border-left:4px solid ${g.stage.color}">
                            <span class="aguardando-group-title">${g.stage.label}</span>
                            <span class="pipeline-count">${g.clients.length}</span>
                        </div>
                        <div class="aguardando-cards">
                            ${g.clients.map(c => this.renderAguardandoCard(c)).join('')}
                        </div>
                    </div>
                `).join('')}
            </div>`;
    },

    renderAguardandoCard(client) {
        const days = ClientsModule.daysSinceContact(client.lastContact);
        const daysClass = days > 60 ? 'danger' : days > 30 ? 'warning' : 'ok';
        const lastInteraction = InteractionStore.getByClient(client.id)[0];
        const lastNote = lastInteraction
            ? `${ClientsModule.formatDate(lastInteraction.date)} - ${lastInteraction.description.length > 50 ? lastInteraction.description.substring(0, 50) + '...' : lastInteraction.description}`
            : 'Sem interacoes';

        const whatsappBtn = client.phone
            ? `<button class="btn-icon btn-whatsapp" onclick="PipelineModule.openWhatsApp('${client.id}')" title="WhatsApp">&#128172;</button>`
            : '';

        return `
            <div class="aguardando-card">
                <div class="aguardando-card-main">
                    <div class="aguardando-card-name">${ClientsModule.escapeHtml(client.name)}</div>
                    <div class="aguardando-card-company">${ClientsModule.escapeHtml(client.company || client.process || '')}</div>
                    <div class="aguardando-card-note">${ClientsModule.escapeHtml(lastNote)}</div>
                </div>
                <div class="aguardando-card-side">
                    <span class="days-badge days-${daysClass}">${days}d</span>
                    <div class="aguardando-card-actions">
                        <button class="btn-icon" onclick="ClientsModule.openDetail('${client.id}')" title="Detalhes">&#128065;</button>
                        <button class="btn-icon" onclick="InteractionsModule.openLog('${client.id}')" title="Historico">&#128221;</button>
                        ${whatsappBtn}
                    </div>
                </div>
            </div>`;
    },

    openWhatsApp(clientId) {
        const client = ClientStore.getById(clientId);
        if (!client || !client.phone) return;
        const digits = client.phone.replace(/\D/g, '');
        const number = digits.startsWith('55') ? digits : '55' + digits;
        window.open('https://wa.me/' + number, '_blank');
    },

    setView(mode) {
        this._view = mode;
        const btnExp = document.getElementById('pipelineViewExpanded');
        const btnComp = document.getElementById('pipelineViewCompact');
        if (btnExp && btnComp) {
            btnExp.classList.toggle('active', mode === 'expanded');
            btnComp.classList.toggle('active', mode === 'compact');
        }
        this.render();
    },

    updateTagFilter() {
        const select = document.getElementById('pipelineTagFilter');
        if (!select) return;
        const tags = ClientStore.getAllTags();
        const current = select.value;
        select.innerHTML = '<option value="all">Todas etiquetas</option>' +
            tags.map(t => `<option value="${t}">${ClientsModule.escapeHtml(t)}</option>`).join('');
        if (current && tags.includes(current)) select.value = current;
    },

    handleDragStart(e, clientId) {
        e.dataTransfer.setData('text/plain', clientId);
        e.target.classList.add('dragging');
    },

    handleDragOver(e) {
        e.preventDefault();
        e.currentTarget.classList.add('drag-over');
    },

    handleDragLeave(e) {
        e.currentTarget.classList.remove('drag-over');
    },

    handleDrop(e) {
        e.preventDefault();
        e.currentTarget.classList.remove('drag-over');
        const clientId = e.dataTransfer.getData('text/plain');
        const newStage = e.currentTarget.dataset.stage;

        document.querySelectorAll('.dragging').forEach(el => el.classList.remove('dragging'));
        document.querySelectorAll('.drag-over').forEach(el => el.classList.remove('drag-over'));

        const client = ClientStore.getById(clientId);
        if (!client) return;

        const oldStage = client.stage || 'protocolo';
        if (oldStage === newStage) return;

        ClientStore.updateStage(clientId, newStage);
        this.createAutoReminders(client, newStage);
        this.render();
        App.toast(`Processo movido para "${PIPELINE_STAGES.find(s => s.id === newStage).label}"`, 'success');
    },

    openStageSelector(clientId) {
        const client = ClientStore.getById(clientId);
        if (!client) return;

        const currentStage = client.stage || 'protocolo';
        const choice = prompt(
            `Mover "${client.name}" para qual etapa?\n\nOpcoes:\n${PIPELINE_STAGES.map((s, i) =>
                `${i + 1}. ${s.label}${s.id === currentStage ? ' (atual)' : ''}`
            ).join('\n')}\n\nDigite o numero:`,
            ''
        );

        if (!choice) return;
        const idx = parseInt(choice) - 1;
        if (idx < 0 || idx >= PIPELINE_STAGES.length) return;

        const newStage = PIPELINE_STAGES[idx].id;
        if (newStage === currentStage) return;

        ClientStore.updateStage(clientId, newStage);
        this.createAutoReminders(client, newStage);
        this.render();
        App.toast(`Processo movido para "${PIPELINE_STAGES[idx].label}"`, 'success');
    },

    createAutoReminders(client, newStage) {
        const today = new Date();
        const autoReminders = INPI_AUTO_REMINDERS.filter(r => r.stage === newStage);

        autoReminders.forEach(ar => {
            const reminderDate = new Date(today);
            reminderDate.setDate(reminderDate.getDate() + ar.offsetDays);

            const message = ar.message.replace(/\{processo\}/g, client.process || '');

            ReminderStore.save({
                clientId: client.id,
                date: reminderDate.toISOString().split('T')[0],
                type: ar.type || 'prazo',
                message
            });
        });

        if (autoReminders.length > 0) {
            App.toast(`${autoReminders.length} lembrete(s) automatico(s) criado(s)!`, 'info');
        }
    }
};
