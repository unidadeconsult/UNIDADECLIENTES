const InteractionsModule = {
    openLog(clientId) {
        const client = ClientStore.getById(clientId);
        if (!client) return;

        const interactions = InteractionStore.getByClient(clientId);
        const modal = document.getElementById('interactionLogModal');
        document.getElementById('interactionLogTitle').textContent = 'Historico - ' + client.name;
        document.getElementById('interactionClientId').value = clientId;
        document.getElementById('interactionDate').value = new Date().toISOString().split('T')[0];
        document.getElementById('interactionDesc').value = '';

        this.renderLog(interactions);
        modal.classList.remove('hidden');
    },

    renderLog(interactions) {
        const container = document.getElementById('interactionTimeline');
        if (interactions.length === 0) {
            container.innerHTML = '<p class="empty-state">Nenhuma interacao registrada.</p>';
            return;
        }

        container.innerHTML = interactions.map(i => `
            <div class="timeline-item">
                <div class="timeline-icon type-icon-${i.type}">${this.typeIcon(i.type)}</div>
                <div class="timeline-content">
                    <div class="timeline-header">
                        <span class="timeline-type">${this.typeLabel(i.type)}</span>
                        <span class="timeline-date">${ClientsModule.formatDate(i.date)}</span>
                        <button class="btn-icon" onclick="InteractionsModule.deleteInteraction('${i.id}', '${i.clientId}')" title="Excluir">&#128465;</button>
                    </div>
                    <p class="timeline-desc">${ClientsModule.escapeHtml(i.description)}</p>
                </div>
            </div>
        `).join('');
    },

    addInteraction(e) {
        e.preventDefault();
        const clientId = document.getElementById('interactionClientId').value;
        const interaction = {
            clientId,
            date: document.getElementById('interactionDate').value,
            type: document.getElementById('interactionType').value,
            description: document.getElementById('interactionDesc').value.trim()
        };

        if (!interaction.description) return;

        InteractionStore.save(interaction);
        document.getElementById('interactionDesc').value = '';
        this.renderLog(InteractionStore.getByClient(clientId));
        ClientsModule.render();
        DashboardModule.refresh();
        App.toast('Interacao registrada!', 'success');
    },

    deleteInteraction(id, clientId) {
        if (confirm('Excluir esta interacao?')) {
            InteractionStore.delete(id);
            this.renderLog(InteractionStore.getByClient(clientId));
        }
    },

    addQuickNote() {
        const clientId = document.getElementById('quickNoteClient').value;
        const note = document.getElementById('quickNoteText').value.trim();
        if (!clientId || !note) {
            App.toast('Selecione um cliente e escreva a nota.', 'warning');
            return;
        }

        InteractionStore.save({
            clientId,
            date: new Date().toISOString().split('T')[0],
            type: 'nota',
            description: note
        });

        document.getElementById('quickNoteText').value = '';
        document.getElementById('quickNoteClient').value = '';
        DashboardModule.refresh();
        App.toast('Nota salva!', 'success');
    },

    closeLog() {
        document.getElementById('interactionLogModal').classList.add('hidden');
    },

    typeIcon(type) {
        const icons = { whatsapp: '&#128172;', ligacao: '&#9742;', email: '&#9993;', reuniao: '&#128197;', nota: '&#128221;' };
        return icons[type] || '&#128221;';
    },

    typeLabel(type) {
        const labels = { whatsapp: 'WhatsApp', ligacao: 'Ligacao', email: 'E-mail', reuniao: 'Reuniao', nota: 'Nota' };
        return labels[type] || type;
    }
};
