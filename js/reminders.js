const RemindersModule = {
    init() {
        this.bindEvents();
        this.render();
    },

    bindEvents() {
        document.getElementById('btnAddReminder').addEventListener('click', () => this.openForm());
        document.getElementById('closeReminderModal').addEventListener('click', () => this.closeForm());
        document.getElementById('cancelReminder').addEventListener('click', () => this.closeForm());
        document.getElementById('reminderForm').addEventListener('submit', (e) => this.handleSubmit(e));
        document.getElementById('reminderFilter').addEventListener('change', () => this.render());
    },

    render() {
        const filter = document.getElementById('reminderFilter').value;
        let reminders = ReminderStore.getAll();

        if (filter === 'pending') {
            reminders = reminders.filter(r => !r.completed);
        } else if (filter === 'completed') {
            reminders = reminders.filter(r => r.completed);
        }

        reminders.sort((a, b) => {
            if (a.completed !== b.completed) return a.completed ? 1 : -1;
            return a.date.localeCompare(b.date);
        });

        const container = document.getElementById('remindersList');
        if (reminders.length === 0) {
            container.innerHTML = '<p class="empty-state">Nenhum lembrete encontrado.</p>';
            return;
        }

        const today = new Date().toISOString().split('T')[0];

        container.innerHTML = reminders.map(r => {
            const client = r.clientId ? ClientStore.getById(r.clientId) : null;
            const isOverdue = !r.completed && r.date < today;
            const isToday = !r.completed && r.date === today;
            let statusClass = r.completed ? 'completed' : '';
            if (isOverdue) statusClass += ' overdue';
            if (isToday) statusClass += ' today';

            return `<div class="reminder-item ${statusClass}">
                <span class="reminder-type-badge type-${r.type}">${this.typeLabel(r.type)}</span>
                <div class="reminder-info">
                    ${client ? `<div class="reminder-client-name">${this.escapeHtml(client.name)}</div>` : ''}
                    <div class="reminder-message">${this.escapeHtml(r.message)}</div>
                </div>
                <div class="reminder-date">
                    ${isOverdue ? '<strong style="color:var(--danger)">ATRASADO</strong> - ' : ''}
                    ${isToday ? '<strong style="color:var(--warning)">HOJE</strong> - ' : ''}
                    ${this.formatDate(r.date)}
                </div>
                <div class="reminder-actions">
                    <button class="btn-icon" onclick="RemindersModule.toggleComplete('${r.id}')" title="${r.completed ? 'Reabrir' : 'Concluir'}">
                        ${r.completed ? '&#9723;' : '&#9745;'}
                    </button>
                    <button class="btn-icon" onclick="RemindersModule.openForm('${r.id}')" title="Editar">&#9998;</button>
                    <button class="btn-icon" onclick="RemindersModule.confirmDelete('${r.id}')" title="Excluir">&#128465;</button>
                    ${client && client.phone ? `<button class="btn-icon" onclick="RemindersModule.callClient('${r.clientId}')" title="Ligar / WhatsApp">&#9742;</button>` : ''}
                </div>
            </div>`;
        }).join('');
    },

    openForm(id) {
        const modal = document.getElementById('reminderModal');
        const title = document.getElementById('reminderModalTitle');
        const form = document.getElementById('reminderForm');
        form.reset();

        this.populateClientSelect();

        if (id) {
            const reminder = ReminderStore.getAll().find(r => r.id === id);
            if (!reminder) return;
            title.textContent = 'Editar Lembrete';
            document.getElementById('reminderId').value = reminder.id;
            document.getElementById('reminderClient').value = reminder.clientId || '';
            document.getElementById('reminderDate').value = reminder.date || '';
            document.getElementById('reminderType').value = reminder.type || 'geral';
            document.getElementById('reminderMessage').value = reminder.message || '';
        } else {
            title.textContent = 'Novo Lembrete';
            document.getElementById('reminderId').value = '';
            document.getElementById('reminderDate').value = new Date().toISOString().split('T')[0];
        }

        modal.classList.remove('hidden');
    },

    openFormForClient(clientId) {
        this.openForm();
        document.getElementById('reminderClient').value = clientId;
        App.navigate('reminders');
    },

    closeForm() {
        document.getElementById('reminderModal').classList.add('hidden');
    },

    handleSubmit(e) {
        e.preventDefault();
        const id = document.getElementById('reminderId').value;
        const reminder = {
            clientId: document.getElementById('reminderClient').value || null,
            date: document.getElementById('reminderDate').value,
            type: document.getElementById('reminderType').value,
            message: document.getElementById('reminderMessage').value.trim()
        };

        if (id) reminder.id = id;

        ReminderStore.save(reminder);
        this.closeForm();
        this.render();
        DashboardModule.refresh();
        App.toast(id ? 'Lembrete atualizado!' : 'Lembrete criado!', 'success');
    },

    toggleComplete(id) {
        ReminderStore.toggleComplete(id);
        this.render();
        DashboardModule.refresh();
    },

    confirmDelete(id) {
        if (confirm('Excluir este lembrete?')) {
            ReminderStore.delete(id);
            this.render();
            DashboardModule.refresh();
            App.toast('Lembrete excluido.', 'warning');
        }
    },

    callClient(clientId) {
        const client = ClientStore.getById(clientId);
        if (!client || !client.phone) return;
        let phone = client.phone.replace(/\D/g, '');
        if (phone.length <= 11) phone = '55' + phone;
        window.open(`https://wa.me/${phone}`, '_blank');
        ClientStore.updateLastContact(clientId);
        ClientsModule.render();
        DashboardModule.refresh();
    },

    populateClientSelect() {
        const select = document.getElementById('reminderClient');
        const clients = ClientStore.getAll().sort((a, b) => a.name.localeCompare(b.name));
        select.innerHTML = '<option value="">-- Sem cliente vinculado --</option>' +
            clients.map(c => `<option value="${c.id}">${this.escapeHtml(c.name)}${c.company ? ' (' + this.escapeHtml(c.company) + ')' : ''}</option>`).join('');
    },

    typeLabel(type) {
        const labels = {
            'follow-up': 'Follow-up',
            'prazo': 'Prazo',
            'pagamento': 'Pagamento',
            'reuniao': 'Reuniao',
            'documento': 'Documento',
            'retorno': 'Retorno',
            'geral': 'Geral'
        };
        return labels[type] || type;
    },

    formatDate(dateStr) {
        if (!dateStr) return '-';
        const parts = dateStr.split('-');
        if (parts.length === 3) return `${parts[2]}/${parts[1]}/${parts[0]}`;
        return dateStr;
    },

    escapeHtml(str) {
        const div = document.createElement('div');
        div.textContent = str;
        return div.innerHTML;
    }
};
