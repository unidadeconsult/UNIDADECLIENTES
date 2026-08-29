const PipelineModule = {
    init() {
        this.render();
    },

    render() {
        const clients = ClientStore.getAll().filter(c => c.status !== 'inativo' && c.status !== 'perdido');
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
                         ondrop="PipelineModule.handleDrop(event)">
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
                    <button class="btn-icon" onclick="PipelineModule.openStageSelector('${client.id}')" title="Mover etapa">&#9654;</button>
                </div>
            </div>
        `;
    },

    handleDragStart(e, clientId) {
        e.dataTransfer.setData('text/plain', clientId);
        e.target.classList.add('dragging');
    },

    handleDragOver(e) {
        e.preventDefault();
        e.currentTarget.classList.add('drag-over');
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
        const options = PIPELINE_STAGES
            .filter(s => s.id !== currentStage)
            .map(s => s.label)
            .join('\n');

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
