const ClientsModule = {
    init() {
        this.bindEvents();
        this.render();
    },

    bindEvents() {
        document.getElementById('btnAddClient').addEventListener('click', () => this.openForm());
        document.getElementById('closeClientModal').addEventListener('click', () => this.closeForm());
        document.getElementById('cancelClient').addEventListener('click', () => this.closeForm());
        document.getElementById('clientForm').addEventListener('submit', (e) => this.handleSubmit(e));
        document.getElementById('clientSearch').addEventListener('input', () => this.render());
        document.getElementById('clientFilter').addEventListener('change', () => this.render());
        document.getElementById('closeClientDetail').addEventListener('click', () => this.closeDetail());
    },

    render() {
        const search = document.getElementById('clientSearch').value.toLowerCase();
        const filter = document.getElementById('clientFilter').value;
        let clients = ClientStore.getAll();

        if (filter !== 'all') {
            clients = clients.filter(c => c.status === filter);
        }
        if (search) {
            clients = clients.filter(c =>
                c.name.toLowerCase().includes(search) ||
                (c.company && c.company.toLowerCase().includes(search)) ||
                (c.phone && c.phone.includes(search)) ||
                (c.email && c.email.toLowerCase().includes(search)) ||
                (c.process && c.process.toLowerCase().includes(search))
            );
        }

        clients.sort((a, b) => (b.updatedAt || '').localeCompare(a.updatedAt || ''));

        const tbody = document.getElementById('clientsTableBody');
        if (clients.length === 0) {
            tbody.innerHTML = '<tr><td colspan="6" class="empty-state">Nenhum cliente encontrado.</td></tr>';
            return;
        }

        tbody.innerHTML = clients.map(c => {
            const days = this.daysSinceContact(c.lastContact);
            const daysClass = days > 60 ? 'days-danger' : days > 30 ? 'days-warning' : 'days-ok';
            const daysText = c.lastContact
                ? `<span class="${daysClass}">${days} dias atras</span>`
                : '<span class="days-warning">Sem registro</span>';

            return `<tr>
                <td>
                    <strong>${this.escapeHtml(c.name)}</strong>
                    ${c.company ? `<br><small style="color:var(--text-light)">${this.escapeHtml(c.company)}</small>` : ''}
                </td>
                <td>${this.escapeHtml(c.phone || '-')}</td>
                <td><span class="badge badge-${c.type || 'outro'}">${this.typeLabel(c.type)}</span></td>
                <td><span class="badge badge-${c.status || 'ativo'}">${this.statusLabel(c.status)}</span></td>
                <td>${daysText}</td>
                <td>
                    <button class="btn-icon" onclick="ClientsModule.openDetail('${c.id}')" title="Ver detalhes">&#128065;</button>
                    <button class="btn-icon" onclick="ClientsModule.openForm('${c.id}')" title="Editar">&#9998;</button>
                    <button class="btn-icon" onclick="ClientsModule.markContact('${c.id}')" title="Registrar contato">&#9742;</button>
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
            document.getElementById('clientProcess').value = client.process || '';
            document.getElementById('clientLastContact').value = client.lastContact || '';
            document.getElementById('clientNotes').value = client.notes || '';
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

    handleSubmit(e) {
        e.preventDefault();
        const id = document.getElementById('clientId').value;
        const client = {
            name: document.getElementById('clientName').value.trim(),
            email: document.getElementById('clientEmail').value.trim(),
            phone: document.getElementById('clientPhone').value.trim(),
            company: document.getElementById('clientCompany').value.trim(),
            document: document.getElementById('clientDocument').value.trim(),
            type: document.getElementById('clientType').value,
            status: document.getElementById('clientStatus').value,
            process: document.getElementById('clientProcess').value.trim(),
            lastContact: document.getElementById('clientLastContact').value,
            notes: document.getElementById('clientNotes').value.trim()
        };

        if (id) client.id = id;

        ClientStore.save(client);
        this.closeForm();
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

        const reminders = ReminderStore.getAll()
            .filter(r => r.clientId === id && !r.completed)
            .sort((a, b) => a.date.localeCompare(b.date));

        const reminderHtml = reminders.length > 0
            ? reminders.map(r => `<div style="padding:4px 0;border-bottom:1px solid var(--border)">
                <span class="reminder-type-badge type-${r.type}">${r.type}</span>
                <strong>${this.formatDate(r.date)}</strong> - ${this.escapeHtml(r.message)}
            </div>`).join('')
            : '<p style="color:var(--text-light)">Nenhum lembrete pendente.</p>';

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
                    <span class="detail-label">Numero do processo</span>
                    <span class="detail-value">${this.escapeHtml(client.process || '-')}</span>
                </div>
                <div class="detail-field">
                    <span class="detail-label">Ultimo contato</span>
                    <span class="detail-value">
                        ${client.lastContact ? this.formatDate(client.lastContact) : 'Sem registro'}
                        <span class="${daysClass}">(${days} dias)</span>
                    </span>
                </div>
                <div class="detail-field full-width">
                    <span class="detail-label">Observacoes</span>
                    <span class="detail-value">${this.escapeHtml(client.notes || 'Nenhuma observacao.')}</span>
                </div>
                <div class="detail-field full-width">
                    <span class="detail-label">Lembretes pendentes</span>
                    ${reminderHtml}
                </div>
            </div>
            <div class="detail-actions">
                <button class="btn btn-primary btn-sm" onclick="ClientsModule.openForm('${id}'); ClientsModule.closeDetail();">Editar</button>
                <button class="btn btn-success btn-sm" onclick="ClientsModule.markContact('${id}'); ClientsModule.closeDetail();">Registrar Contato</button>
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
        const labels = { ativo: 'Ativo', inativo: 'Inativo', prospecto: 'Prospecto' };
        return labels[status] || status || 'N/A';
    },

    escapeHtml(str) {
        const div = document.createElement('div');
        div.textContent = str;
        return div.innerHTML;
    }
};
