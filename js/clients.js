const ClientsModule = {
    init() {
        this.bindEvents();
        this.updateTagFilter();
        this.render();
    },

    bindEvents() {
        document.getElementById('btnAddClient').addEventListener('click', () => this.openForm());
        document.getElementById('closeClientModal').addEventListener('click', () => this.closeForm());
        document.getElementById('cancelClient').addEventListener('click', () => this.closeForm());
        document.getElementById('clientForm').addEventListener('submit', (e) => this.handleSubmit(e));
        document.getElementById('clientSearch').addEventListener('input', () => this.render());
        document.getElementById('clientFilter').addEventListener('change', () => this.render());
        document.getElementById('clientTagFilter').addEventListener('change', () => this.render());
        document.getElementById('closeClientDetail').addEventListener('click', () => this.closeDetail());
    },

    updateTagFilter() {
        const select = document.getElementById('clientTagFilter');
        const tags = ClientStore.getAllTags();
        const current = select.value;
        select.innerHTML = '<option value="all">Todas etiquetas</option>' +
            tags.map(t => `<option value="${t}">${this.escapeHtml(t)}</option>`).join('');
        if (current && tags.includes(current)) select.value = current;
    },

    render() {
        const search = document.getElementById('clientSearch').value.toLowerCase();
        const filter = document.getElementById('clientFilter').value;
        const tagFilter = document.getElementById('clientTagFilter').value;
        let clients = ClientStore.getAll();

        if (filter !== 'all') {
            clients = clients.filter(c => c.status === filter);
        }
        if (tagFilter !== 'all') {
            clients = clients.filter(c => (c.tags || []).includes(tagFilter));
        }
        if (search) {
            clients = clients.filter(c =>
                c.name.toLowerCase().includes(search) ||
                (c.company && c.company.toLowerCase().includes(search)) ||
                (c.phone && c.phone.includes(search)) ||
                (c.email && c.email.toLowerCase().includes(search)) ||
                (c.process && c.process.toLowerCase().includes(search)) ||
                (c.tags || []).some(t => t.toLowerCase().includes(search))
            );
        }

        clients.sort((a, b) => (b.updatedAt || '').localeCompare(a.updatedAt || ''));

        const tbody = document.getElementById('clientsTableBody');
        if (clients.length === 0) {
            tbody.innerHTML = '<tr><td colspan="7" class="empty-state">Nenhum cliente encontrado.</td></tr>';
            return;
        }

        tbody.innerHTML = clients.map(c => {
            const days = this.daysSinceContact(c.lastContact);
            const daysClass = days > 60 ? 'days-danger' : days > 30 ? 'days-warning' : 'days-ok';
            const daysText = c.lastContact
                ? `<span class="${daysClass}">${days} dias atras</span>`
                : '<span class="days-warning">Sem registro</span>';

            const tagsHtml = (c.tags || []).map(t =>
                `<span class="tag-chip">${this.escapeHtml(t)}</span>`
            ).join('');

            return `<tr>
                <td>
                    <strong>${this.escapeHtml(c.name)}</strong>
                    ${c.company ? `<br><small style="color:var(--text-light)">${this.escapeHtml(c.company)}</small>` : ''}
                </td>
                <td>${this.escapeHtml(c.phone || '-')}</td>
                <td><span class="badge badge-${c.type || 'outro'}">${this.typeLabel(c.type)}</span></td>
                <td><span class="badge badge-${c.status || 'ativo'}">${this.statusLabel(c.status)}</span></td>
                <td><div class="tags-cell">${tagsHtml || '-'}</div></td>
                <td>${daysText}</td>
                <td>
                    <button class="btn-icon" onclick="ClientsModule.openDetail('${c.id}')" title="Ver detalhes">&#128065;</button>
                    <button class="btn-icon" onclick="ClientsModule.openForm('${c.id}')" title="Editar">&#9998;</button>
                    <button class="btn-icon" onclick="InteractionsModule.openLog('${c.id}')" title="Historico">&#128221;</button>
                    <button class="btn-icon" onclick="ClientsModule.confirmDelete('${c.id}')" title="Excluir">&#128465;</button>
                </td>
            </tr>`;
        }).join('');
    },

    openForm(id) {
        const modal = document.getElementById('clientModal');
        const title = document.getElementById('clientModalTitle');
        const form = document.getElementById('clientForm');
        form.reset();
        document.getElementById('lossReasonGroup').style.display = 'none';
        document.getElementById('lossNotesGroup').style.display = 'none';

        if (id) {
            const client = ClientStore.getById(id);
            if (!client) return;
            title.textContent = 'Editar Cliente';
            document.getElementById('clientId').value = client.id;
            document.getElementById('clientName').value = client.name || '';
            document.getElementById('clientEmail').value = client.email || '';
            document.getElementById('clientPhone').value = client.phone || '';
            document.getElementById('clientCompany').value = client.company || '';
            document.getElementById('clientDocument').value = client.document || '';
            document.getElementById('clientType').value = client.type || 'marca';
            document.getElementById('clientStatus').value = client.status || 'ativo';
            document.getElementById('clientOrigin').value = client.origin || '';
            document.getElementById('clientProcess').value = client.process || '';
            document.getElementById('clientStage').value = client.stage || 'protocolo';
            document.getElementById('clientLastContact').value = client.lastContact || '';
            document.getElementById('clientProposalValue').value = client.proposalValue || '';
            document.getElementById('clientClasses').value = (client.classes || []).join(', ');
            document.getElementById('clientTags').value = (client.tags || []).join(', ');
            document.getElementById('clientNotes').value = client.notes || '';
            if (client.status === 'perdido') {
                document.getElementById('lossReasonGroup').style.display = '';
                document.getElementById('lossNotesGroup').style.display = '';
                document.getElementById('clientLossReason').value = client.lossReason || '';
                document.getElementById('clientLossNotes').value = client.lossNotes || '';
            }
        } else {
            title.textContent = 'Novo Cliente';
            document.getElementById('clientId').value = '';
            document.getElementById('clientLastContact').value = new Date().toISOString().split('T')[0];
        }

        modal.classList.remove('hidden');
    },

    closeForm() {
        document.getElementById('clientModal').classList.add('hidden');
    },

    toggleLossFields() {
        const status = document.getElementById('clientStatus').value;
        const show = status === 'perdido';
        document.getElementById('lossReasonGroup').style.display = show ? '' : 'none';
        document.getElementById('lossNotesGroup').style.display = show ? '' : 'none';
    },

    handleSubmit(e) {
        e.preventDefault();
        const id = document.getElementById('clientId').value;
        const tagsRaw = document.getElementById('clientTags').value;
        const tags = tagsRaw ? tagsRaw.split(',').map(t => t.trim()).filter(t => t) : [];
        const classesRaw = document.getElementById('clientClasses').value;
        const classes = classesRaw ? classesRaw.split(',').map(c => c.trim()).filter(c => c) : [];

        const client = {
            name: document.getElementById('clientName').value.trim(),
            email: document.getElementById('clientEmail').value.trim(),
            phone: document.getElementById('clientPhone').value.trim(),
            company: document.getElementById('clientCompany').value.trim(),
            document: document.getElementById('clientDocument').value.trim(),
            type: document.getElementById('clientType').value,
            status: document.getElementById('clientStatus').value,
            origin: document.getElementById('clientOrigin').value,
            process: document.getElementById('clientProcess').value.trim(),
            stage: document.getElementById('clientStage').value,
            lastContact: document.getElementById('clientLastContact').value,
            proposalValue: parseFloat(document.getElementById('clientProposalValue').value) || 0,
            classes,
            tags,
            notes: document.getElementById('clientNotes').value.trim()
        };

        if (client.status === 'perdido') {
            client.lossReason = document.getElementById('clientLossReason').value;
            client.lossNotes = document.getElementById('clientLossNotes').value.trim();
            const existing = id ? ClientStore.getById(id) : null;
            if (!existing || existing.status !== 'perdido') {
                client.lossDate = new Date().toISOString().split('T')[0];
            }
        }

        if (id) client.id = id;

        ClientStore.save(client);
        this.closeForm();
        this.updateTagFilter();
        this.render();
        DashboardModule.refresh();
        App.toast(id ? 'Cliente atualizado!' : 'Cliente adicionado!', 'success');
    },

    openDetail(id) {
        const client = ClientStore.getById(id);
        if (!client) return;

        document.getElementById('clientDetailName').textContent = client.name;
        const days = this.daysSinceContact(client.lastContact);
        const daysClass = days > 60 ? 'days-danger' : days > 30 ? 'days-warning' : 'days-ok';

        const stageInfo = PIPELINE_STAGES.find(s => s.id === (client.stage || 'protocolo'));
        const originInfo = CLIENT_ORIGINS.find(o => o.id === client.origin);

        const reminders = ReminderStore.getAll()
            .filter(r => r.clientId === id && !r.completed)
            .sort((a, b) => a.date.localeCompare(b.date));

        const reminderHtml = reminders.length > 0
            ? reminders.map(r => `<div style="padding:4px 0;border-bottom:1px solid var(--border)">
                <span class="reminder-type-badge type-${r.type}">${r.type}</span>
                <strong>${this.formatDate(r.date)}</strong> - ${this.escapeHtml(r.message)}
            </div>`).join('')
            : '<p style="color:var(--text-light)">Nenhum lembrete pendente.</p>';

        const recentInteractions = InteractionStore.getByClient(id).slice(0, 5);
        const interactionsHtml = recentInteractions.length > 0
            ? recentInteractions.map(i => `<div style="padding:4px 0;border-bottom:1px solid var(--border);font-size:13px">
                <strong>${this.formatDate(i.date)}</strong> (${InteractionsModule.typeLabel(i.type)}) - ${this.escapeHtml(i.description)}
            </div>`).join('')
            : '<p style="color:var(--text-light)">Nenhuma interacao registrada.</p>';

        const tagsHtml = (client.tags || []).map(t =>
            `<span class="tag-chip">${this.escapeHtml(t)}</span>`
        ).join(' ') || 'Nenhuma etiqueta';

        const financials = FinancialStore.getByClient(id).filter(f => f.status !== 'pago');
        const finHtml = financials.length > 0
            ? financials.map(f => `<div style="padding:4px 0;border-bottom:1px solid var(--border);font-size:13px">
                <strong>R$ ${FinancialModule.formatCurrency(f.amount)}</strong> - ${this.escapeHtml(f.description)} - Venc: ${this.formatDate(f.dueDate)}
                <span class="badge-fin-${f.dueDate < new Date().toISOString().split('T')[0] ? 'danger' : 'warning'}" style="margin-left:4px">${f.dueDate < new Date().toISOString().split('T')[0] ? 'ATRASADO' : 'PENDENTE'}</span>
            </div>`).join('')
            : '<p style="color:var(--text-light)">Nenhum valor pendente.</p>';

        const lossHtml = client.status === 'perdido' ? `
            <div class="detail-field">
                <span class="detail-label">Motivo da perda</span>
                <span class="detail-value">${this.lossReasonLabel(client.lossReason)}</span>
            </div>
            <div class="detail-field">
                <span class="detail-label">Data da perda</span>
                <span class="detail-value">${this.formatDate(client.lossDate) || '-'}</span>
            </div>
            ${client.lossNotes ? `<div class="detail-field full-width">
                <span class="detail-label">Detalhes da perda</span>
                <span class="detail-value">${this.escapeHtml(client.lossNotes)}</span>
            </div>` : ''}
        ` : '';

        const classesHtml = (client.classes || []).length > 0
            ? client.classes.map(c => `<span class="tag-chip" style="background:var(--info)">${this.escapeHtml(c)}</span>`).join(' ')
            : '-';

        document.getElementById('clientDetailContent').innerHTML = `
            <div class="client-detail-grid">
                <div class="detail-field">
                    <span class="detail-label">Telefone / WhatsApp</span>
                    <span class="detail-value">${this.escapeHtml(client.phone || '-')}</span>
                </div>
                <div class="detail-field">
                    <span class="detail-label">E-mail</span>
                    <span class="detail-value">${this.escapeHtml(client.email || '-')}</span>
                </div>
                <div class="detail-field">
                    <span class="detail-label">Empresa</span>
                    <span class="detail-value">${this.escapeHtml(client.company || '-')}</span>
                </div>
                <div class="detail-field">
                    <span class="detail-label">CNPJ / CPF</span>
                    <span class="detail-value">${this.escapeHtml(client.document || '-')}</span>
                </div>
                <div class="detail-field">
                    <span class="detail-label">Tipo de servico</span>
                    <span class="detail-value"><span class="badge badge-${client.type}">${this.typeLabel(client.type)}</span></span>
                </div>
                <div class="detail-field">
                    <span class="detail-label">Status</span>
                    <span class="detail-value"><span class="badge badge-${client.status}">${this.statusLabel(client.status)}</span></span>
                </div>
                <div class="detail-field">
                    <span class="detail-label">Origem</span>
                    <span class="detail-value">${originInfo ? originInfo.label : '-'}</span>
                </div>
                <div class="detail-field">
                    <span class="detail-label">Valor da proposta</span>
                    <span class="detail-value">${client.proposalValue ? 'R$ ' + FinancialModule.formatCurrency(client.proposalValue) : '-'}</span>
                </div>
                <div class="detail-field">
                    <span class="detail-label">Numero do processo</span>
                    <span class="detail-value">${this.escapeHtml(client.process || '-')}</span>
                </div>
                <div class="detail-field">
                    <span class="detail-label">Etapa do processo</span>
                    <span class="detail-value" style="color:${stageInfo ? stageInfo.color : 'inherit'};font-weight:600">${stageInfo ? stageInfo.label : '-'}</span>
                </div>
                <div class="detail-field">
                    <span class="detail-label">Classes NICE</span>
                    <span class="detail-value">${classesHtml}</span>
                </div>
                <div class="detail-field">
                    <span class="detail-label">Ultimo contato</span>
                    <span class="detail-value">
                        ${client.lastContact ? this.formatDate(client.lastContact) : 'Sem registro'}
                        <span class="${daysClass}">(${days} dias)</span>
                    </span>
                </div>
                ${lossHtml}
                <div class="detail-field full-width">
                    <span class="detail-label">Etiquetas</span>
                    <span class="detail-value">${tagsHtml}</span>
                </div>
                <div class="detail-field full-width">
                    <span class="detail-label">Observacoes</span>
                    <span class="detail-value">${this.escapeHtml(client.notes || 'Nenhuma observacao.')}</span>
                </div>
                <div class="detail-field full-width">
                    <span class="detail-label">Ultimas interacoes</span>
                    ${interactionsHtml}
                </div>
                <div class="detail-field full-width">
                    <span class="detail-label">Valores pendentes</span>
                    ${finHtml}
                </div>
                <div class="detail-field full-width">
                    <span class="detail-label">Lembretes pendentes</span>
                    ${reminderHtml}
                </div>
            </div>
            <div class="detail-actions">
                <button class="btn btn-ai btn-sm" onclick="AIModule.openChat('${id}'); ClientsModule.closeDetail();">&#129302; Perguntar a IA</button>
                <button class="btn btn-primary btn-sm" onclick="ClientsModule.openForm('${id}'); ClientsModule.closeDetail();">Editar</button>
                <button class="btn btn-success btn-sm" onclick="InteractionsModule.openLog('${id}'); ClientsModule.closeDetail();">Historico</button>
                <button class="btn btn-warning btn-sm" onclick="RemindersModule.openFormForClient('${id}'); ClientsModule.closeDetail();">Criar Lembrete</button>
                <button class="btn btn-secondary btn-sm" onclick="TemplatesModule.openPreviewForClient('${id}'); ClientsModule.closeDetail();">Enviar Mensagem</button>
            </div>
        `;

        document.getElementById('clientDetailModal').classList.remove('hidden');
    },

    closeDetail() {
        document.getElementById('clientDetailModal').classList.add('hidden');
    },

    markContact(id) {
        ClientStore.updateLastContact(id);
        this.render();
        DashboardModule.refresh();
        App.toast('Contato registrado!', 'success');
    },

    confirmDelete(id) {
        const client = ClientStore.getById(id);
        if (!client) return;
        if (confirm(`Tem certeza que deseja excluir o cliente "${client.name}"?`)) {
            ClientStore.delete(id);
            this.render();
            DashboardModule.refresh();
            App.toast('Cliente excluido.', 'warning');
        }
    },

    daysSinceContact(lastContact) {
        if (!lastContact) return 999;
        const last = new Date(lastContact);
        const now = new Date();
        return Math.floor((now - last) / (1000 * 60 * 60 * 24));
    },

    formatDate(dateStr) {
        if (!dateStr) return '-';
        const parts = dateStr.split('-');
        if (parts.length === 3) return `${parts[2]}/${parts[1]}/${parts[0]}`;
        return dateStr;
    },

    typeLabel(type) {
        const labels = { marca: 'Marca', patente: 'Patente', ambos: 'Marca e Patente', outro: 'Outro' };
        return labels[type] || type || 'N/A';
    },

    statusLabel(status) {
        const labels = { ativo: 'Ativo', inativo: 'Inativo', prospecto: 'Prospecto', perdido: 'Perdido' };
        return labels[status] || status || 'N/A';
    },

    lossReasonLabel(reason) {
        const r = LOSS_REASONS.find(l => l.id === reason);
        return r ? r.label : reason || '-';
    },

    originLabel(origin) {
        const o = CLIENT_ORIGINS.find(x => x.id === origin);
        return o ? o.label : origin || '-';
    },

    escapeHtml(str) {
        const div = document.createElement('div');
        div.textContent = str;
        return div.innerHTML;
    }
};
