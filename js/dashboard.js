const DashboardModule = {
    init() {
        this.refresh();
    },

    refresh() {
        const clients = ClientStore.getAll();
        const reminders = ReminderStore.getAll();
        const today = new Date().toISOString().split('T')[0];

        const inactiveClients = clients.filter(c =>
            c.status !== 'inativo' && ClientsModule.daysSinceContact(c.lastContact) >= 30
        );
        const criticalClients = clients.filter(c =>
            c.status !== 'inativo' && ClientsModule.daysSinceContact(c.lastContact) >= 60
        );
        const todayReminders = reminders.filter(r => !r.completed && r.date === today);
        const overdueReminders = reminders.filter(r => !r.completed && r.date < today);
        const upcomingReminders = reminders
            .filter(r => !r.completed && r.date > today)
            .sort((a, b) => a.date.localeCompare(b.date))
            .slice(0, 8);

        document.getElementById('statTotal').textContent = clients.length;
        document.getElementById('statInactive').textContent = inactiveClients.length;
        document.getElementById('statCritical').textContent = criticalClients.length;
        document.getElementById('statReminders').textContent = todayReminders.length + overdueReminders.length;

        this.renderDate();
        this.renderInactiveClients(inactiveClients);
        this.renderTodayReminders(todayReminders, overdueReminders);
        this.renderUpcomingReminders(upcomingReminders);
    },

    renderDate() {
        const now = new Date();
        const options = { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' };
        document.getElementById('currentDate').textContent = now.toLocaleDateString('pt-BR', options);
    },

    renderInactiveClients(clients) {
        const container = document.getElementById('inactiveClientsList');
        if (clients.length === 0) {
            container.innerHTML = '<p class="empty-state">Todos os clientes estao em dia!</p>';
            return;
        }

        clients.sort((a, b) => ClientsModule.daysSinceContact(b.lastContact) - ClientsModule.daysSinceContact(a.lastContact));

        container.innerHTML = clients.slice(0, 10).map(c => {
            const days = ClientsModule.daysSinceContact(c.lastContact);
            const severity = days >= 60 ? 'danger' : 'warning';

            return `<div class="alert-item">
                <div class="alert-info">
                    <div class="alert-name">${this.escapeHtml(c.name)}</div>
                    <div class="alert-detail">${c.phone || ''} ${c.company ? '- ' + c.company : ''}</div>
                </div>
                <span class="alert-days ${severity}">${days} dias</span>
                <button class="btn btn-sm btn-primary" onclick="App.navigate('clients'); ClientsModule.openDetail('${c.id}');" style="margin-left:8px">Ver</button>
            </div>`;
        }).join('');
    },

    renderTodayReminders(today, overdue) {
        const container = document.getElementById('todayRemindersList');
        const all = [...overdue, ...today];

        if (all.length === 0) {
            container.innerHTML = '<p class="empty-state">Nenhum lembrete pendente para hoje.</p>';
            return;
        }

        container.innerHTML = all.map(r => {
            const client = r.clientId ? ClientStore.getById(r.clientId) : null;
            const isOverdue = overdue.includes(r);

            return `<div class="reminder-item ${isOverdue ? 'overdue' : 'today'}" style="box-shadow:none;margin:0;border-radius:0;padding:8px 0">
                <span class="reminder-type-badge type-${r.type}">${RemindersModule.typeLabel(r.type)}</span>
                <div class="reminder-info">
                    ${client ? `<div class="reminder-client-name">${this.escapeHtml(client.name)}</div>` : ''}
                    <div class="reminder-message">${this.escapeHtml(r.message)}</div>
                </div>
                ${isOverdue ? '<span style="color:var(--danger);font-size:11px;font-weight:600">ATRASADO</span>' : ''}
                <button class="btn-icon" onclick="RemindersModule.toggleComplete('${r.id}')" title="Concluir">&#9745;</button>
            </div>`;
        }).join('');
    },

    renderUpcomingReminders(reminders) {
        const container = document.getElementById('upcomingRemindersList');

        if (reminders.length === 0) {
            container.innerHTML = '<p class="empty-state">Nenhum lembrete futuro.</p>';
            return;
        }

        container.innerHTML = reminders.map(r => {
            const client = r.clientId ? ClientStore.getById(r.clientId) : null;

            return `<div class="reminder-item" style="box-shadow:none;margin:0;border-radius:0;padding:8px 0">
                <span class="reminder-type-badge type-${r.type}">${RemindersModule.typeLabel(r.type)}</span>
                <div class="reminder-info">
                    ${client ? `<div class="reminder-client-name">${this.escapeHtml(client.name)}</div>` : ''}
                    <div class="reminder-message">${this.escapeHtml(r.message)}</div>
                </div>
                <span class="reminder-date">${ClientsModule.formatDate(r.date)}</span>
            </div>`;
        }).join('');
    },

    escapeHtml(str) {
        const div = document.createElement('div');
        div.textContent = str;
        return div.innerHTML;
    }
};
