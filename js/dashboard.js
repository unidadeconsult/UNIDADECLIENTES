const DashboardModule = {
    init() {
        this.refresh();
    },

    refresh() {
        const clients = ClientStore.getAll();
        const reminders = ReminderStore.getAll();
        const financials = FinancialStore.getAll();
        const today = new Date().toISOString().split('T')[0];

        this.renderGreeting();
        this.renderDate();
        this.renderAttentionSummary(clients, reminders, financials, today);
        this.renderExecutiveCommercial(clients, financials, today);
        this.renderExecutiveOperation(clients);
        this.renderExecutiveAlerts(clients, reminders, financials, today);
        this.renderHotLeads();
        this.populateQuickNoteClients();
        this.renderActionsList(clients, reminders, financials, today);
        this.renderTodayReminders(
            reminders.filter(r => !r.completed && r.date === today),
            reminders.filter(r => !r.completed && r.date < today)
        );
        this.renderUpcomingReminders(
            reminders.filter(r => !r.completed && r.date > today)
                .sort((a, b) => a.date.localeCompare(b.date)).slice(0, 8)
        );
    },

    renderHotLeads() {
        const container = document.getElementById('hotLeadsList');
        if (!container) return;

        const hotLeads = LeadScoringModule.getHotLeads(5);
        if (hotLeads.length === 0) {
            container.innerHTML = '<p class="empty-state">Nenhum lead quente no momento.</p>';
            return;
        }

        container.innerHTML = hotLeads.map(({ client, score }) => `
            <div class="hot-lead-item">
                <div style="flex:1">
                    <strong>${ClientsModule.escapeHtml(client.name)}</strong>
                    ${client.company ? `<small style="color:var(--text-light);margin-left:6px">${ClientsModule.escapeHtml(client.company)}</small>` : ''}
                </div>
                <span class="lead-score score-${score.label.class}">${score.label.icon} ${score.total} pts${score.hasOverride ? ' *' : ''}</span>
                <button class="btn-icon" onclick="LeadScoringModule.editScore('${client.id}')" title="Editar pontuacao">&#9998;</button>
                <button class="btn-icon" onclick="App.navigate('clients'); ClientsModule.openDetail('${client.id}');" title="Ver">&#128065;</button>
            </div>
        `).join('');
    },

    renderGreeting() {
        const hour = new Date().getHours();
        let greeting;
        if (hour < 12) greeting = 'Bom dia!';
        else if (hour < 18) greeting = 'Boa tarde!';
        else greeting = 'Boa noite!';
        document.getElementById('greetingText').textContent = greeting;
    },

    renderDate() {
        const now = new Date();
        const options = { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' };
        document.getElementById('currentDate').textContent = now.toLocaleDateString('pt-BR', options);
    },

    renderAttentionSummary(clients, reminders, financials, today) {
        const items = [];
        const activeClients = clients.filter(c => c.status !== 'inativo' && c.status !== 'perdido');

        const followups = reminders.filter(r => !r.completed && r.date <= today && r.type === 'follow-up');
        if (followups.length > 0) items.push({ icon: '\u{1F525}', text: `${followups.length} follow-up${followups.length > 1 ? 's' : ''} comercia${followups.length > 1 ? 'is' : 'l'}`, priority: 1 });

        const deadlines = reminders.filter(r => !r.completed && r.date <= today && r.type === 'prazo');
        if (deadlines.length > 0) items.push({ icon: '\u{1F6A8}', text: `${deadlines.length} prazo${deadlines.length > 1 ? 's' : ''} importante${deadlines.length > 1 ? 's' : ''}`, priority: 0 });

        const docReminders = reminders.filter(r => !r.completed && r.date <= today && r.type === 'documento');
        if (docReminders.length > 0) items.push({ icon: '\u{1F4C4}', text: `${docReminders.length} cliente${docReminders.length > 1 ? 's' : ''} aguardando documentos`, priority: 2 });

        const paymentReminders = reminders.filter(r => !r.completed && r.date <= today && r.type === 'pagamento');
        const overdueFinancials = financials.filter(f => f.status !== 'pago' && f.dueDate < today);
        const paymentCount = paymentReminders.length + overdueFinancials.length;
        if (paymentCount > 0) items.push({ icon: '\u{1F4B0}', text: `${paymentCount} pagamento${paymentCount > 1 ? 's' : ''} pendente${paymentCount > 1 ? 's' : ''}`, priority: 3 });

        const noContact = activeClients.filter(c => ClientsModule.daysSinceContact(c.lastContact) >= 30);
        if (noContact.length > 0) items.push({ icon: '\u{1F4E8}', text: `${noContact.length} cliente${noContact.length > 1 ? 's' : ''} sem contato (30+ dias)`, priority: 4 });

        const opportunities = this.findOpportunities(clients);
        if (opportunities.length > 0) items.push({ icon: '\u{2B50}', text: `${opportunities.length} oportunidade${opportunities.length > 1 ? 's' : ''} de nova classe`, priority: 5 });

        items.sort((a, b) => a.priority - b.priority);

        const container = document.getElementById('attentionSummary');
        if (items.length === 0) {
            container.innerHTML = '<div class="attention-item attention-ok">Tudo em dia! Nenhuma acao urgente pendente.</div>';
        } else {
            container.innerHTML = items.map(i =>
                `<div class="attention-item">${i.icon} ${i.text}</div>`
            ).join('');
        }

        this.renderTopPriority(reminders, financials, clients, today);
    },

    renderTopPriority(reminders, financials, clients, today) {
        const container = document.getElementById('attentionPriority');
        const overdueDeadlines = reminders
            .filter(r => !r.completed && r.date <= today && r.type === 'prazo')
            .sort((a, b) => a.date.localeCompare(b.date));

        if (overdueDeadlines.length > 0) {
            const r = overdueDeadlines[0];
            const client = r.clientId ? ClientStore.getById(r.clientId) : null;
            container.innerHTML = `<div class="priority-banner">
                <strong>Prioridade #1:</strong>
                ${client ? ClientsModule.escapeHtml(client.name) + ' &mdash; ' : ''}
                ${ClientsModule.escapeHtml(r.message)}
                <button class="btn btn-sm btn-primary" onclick="RemindersModule.toggleComplete('${r.id}'); DashboardModule.refresh();" style="margin-left:12px">Concluir</button>
            </div>`;
            return;
        }

        const overduePayments = financials.filter(f => f.status !== 'pago' && f.dueDate < today)
            .sort((a, b) => a.dueDate.localeCompare(b.dueDate));
        if (overduePayments.length > 0) {
            const f = overduePayments[0];
            const client = f.clientId ? ClientStore.getById(f.clientId) : null;
            container.innerHTML = `<div class="priority-banner">
                <strong>Prioridade #1:</strong>
                ${client ? ClientsModule.escapeHtml(client.name) + ' &mdash; ' : ''}
                ${ClientsModule.escapeHtml(f.description)} - R$ ${FinancialModule.formatCurrency(f.amount)}
                <button class="btn btn-sm btn-success" onclick="FinancialModule.markPaid('${f.id}'); DashboardModule.refresh();" style="margin-left:12px">Pago</button>
            </div>`;
            return;
        }

        const critical = clients.filter(c => c.status !== 'inativo' && c.status !== 'perdido' && ClientsModule.daysSinceContact(c.lastContact) >= 60)
            .sort((a, b) => ClientsModule.daysSinceContact(b.lastContact) - ClientsModule.daysSinceContact(a.lastContact));
        if (critical.length > 0) {
            const c = critical[0];
            const days = ClientsModule.daysSinceContact(c.lastContact);
            container.innerHTML = `<div class="priority-banner">
                <strong>Prioridade #1:</strong>
                ${ClientsModule.escapeHtml(c.name)} &mdash; ${days} dias sem contato
                <button class="btn btn-sm btn-primary" onclick="App.navigate('clients'); ClientsModule.openDetail('${c.id}');" style="margin-left:12px">Ver</button>
            </div>`;
            return;
        }

        container.innerHTML = '';
    },

    renderExecutiveCommercial(clients, financials, today) {
        const monthStart = today.slice(0, 7) + '-01';
        const prospects = clients.filter(c => c.status === 'prospecto');
        const newLeads = prospects.filter(c => c.createdAt && c.createdAt >= monthStart);
        const proposals = clients.filter(c => (c.stage === 'proposta' || c.stage === 'prospeccao') && c.status === 'prospecto');
        const followupsToday = ReminderStore.getAll().filter(r => !r.completed && r.date === today && r.type === 'follow-up');

        const convertedThisMonth = clients.filter(c =>
            c.status === 'ativo' && c.createdAt && c.createdAt >= monthStart &&
            c.stage && c.stage !== 'prospeccao' && c.stage !== 'proposta'
        );

        const totalProspects = prospects.length + convertedThisMonth.length;
        const conversionRate = totalProspects > 0 ? Math.round((convertedThisMonth.length / totalProspects) * 100) : 0;

        const paidThisMonth = financials.filter(f => f.status === 'pago' && f.paidDate && f.paidDate >= monthStart);
        const totalRevenue = paidThisMonth.reduce((sum, f) => sum + (parseFloat(f.amount) || 0), 0);
        const avgTicket = paidThisMonth.length > 0 ? totalRevenue / paidThisMonth.length : 0;

        document.getElementById('execLeads').textContent = newLeads.length;
        document.getElementById('execProposals').textContent = proposals.length;
        document.getElementById('execFollowups').textContent = followupsToday.length;
        document.getElementById('execSales').textContent = convertedThisMonth.length;
        document.getElementById('execConversion').textContent = conversionRate + '%';
        document.getElementById('execTicket').textContent = 'R$ ' + FinancialModule.formatCurrency(avgTicket);
    },

    renderExecutiveOperation(clients) {
        const active = clients.filter(c => c.status !== 'inativo' && c.status !== 'perdido' && c.process);
        const byStage = (stageId) => active.filter(c => (c.stage || 'protocolo') === stageId).length;

        const awaitingDocs = ReminderStore.getAll().filter(r => !r.completed && r.type === 'documento').length;
        const readyProtocol = clients.filter(c => c.status === 'ativo' && !c.process && c.stage !== 'prospeccao' && c.stage !== 'proposta').length;

        document.getElementById('execInProgress').textContent = active.length;
        document.getElementById('execAwaitingDocs').textContent = awaitingDocs;
        document.getElementById('execReadyProtocol').textContent = readyProtocol;
        document.getElementById('execProtocoled').textContent = byStage('protocolo') + byStage('exame-formal');
        document.getElementById('execOpposition').textContent = byStage('oposicao');
        document.getElementById('execRequirement').textContent = byStage('exame-merito');
        document.getElementById('execApproved').textContent = byStage('deferido');
        document.getElementById('execGranted').textContent = byStage('registrado') + byStage('monitoramento');
    },

    renderExecutiveAlerts(clients, reminders, financials, today) {
        const weekEnd = new Date();
        weekEnd.setDate(weekEnd.getDate() + 7);
        const weekEndStr = weekEnd.toISOString().split('T')[0];
        const activeClients = clients.filter(c => c.status !== 'inativo' && c.status !== 'perdido');

        document.getElementById('execDeadlinesToday').textContent = reminders.filter(r => !r.completed && r.date === today && r.type === 'prazo').length;
        document.getElementById('execDeadlinesWeek').textContent = reminders.filter(r => !r.completed && r.date > today && r.date <= weekEndStr && r.type === 'prazo').length;
        document.getElementById('execNoContact').textContent = activeClients.filter(c => ClientsModule.daysSinceContact(c.lastContact) >= 30).length;
        document.getElementById('execRenewals').textContent = reminders.filter(r => !r.completed && r.type === 'prorrogacao').length;
        document.getElementById('execOpportunities').textContent = this.findOpportunities(clients).length;

        const weekAgo = new Date(Date.now() - 7 * 86400000).toISOString().split('T')[0];
        const recentInteractions = InteractionStore.getAll().filter(i => i.date >= weekAgo);
        document.getElementById('execMovements').textContent = new Set(recentInteractions.map(i => i.clientId)).size;
    },

    findOpportunities(clients) {
        return clients.filter(c => {
            if (c.status === 'inativo' || c.status === 'perdido') return false;
            if (!c.classes || c.classes.length === 0) return false;
            const stage = c.stage || 'protocolo';
            return stage === 'registrado' || stage === 'monitoramento';
        });
    },

    populateQuickNoteClients() {
        const select = document.getElementById('quickNoteClient');
        const clients = ClientStore.getAll().sort((a, b) => a.name.localeCompare(b.name));
        const current = select.value;
        select.innerHTML = '<option value="">-- Selecione o cliente --</option>' +
            clients.map(c => `<option value="${c.id}">${ClientsModule.escapeHtml(c.name)}${c.company ? ' (' + ClientsModule.escapeHtml(c.company) + ')' : ''}</option>`).join('');
        if (current) select.value = current;
    },

    renderActionsList(clients, reminders, financials, today) {
        const container = document.getElementById('actionsList');
        const actions = [];
        const activeClients = clients.filter(c => c.status !== 'inativo' && c.status !== 'perdido');

        reminders.filter(r => !r.completed && r.date < today)
            .sort((a, b) => a.date.localeCompare(b.date))
            .slice(0, 5).forEach(r => {
                const client = r.clientId ? ClientStore.getById(r.clientId) : null;
                actions.push({
                    severity: 'danger',
                    label: 'ATRASADO',
                    name: client ? client.name : 'Sem cliente',
                    detail: r.message,
                    action: `RemindersModule.toggleComplete('${r.id}'); DashboardModule.refresh();`
                });
            });

        activeClients
            .filter(c => ClientsModule.daysSinceContact(c.lastContact) >= 60)
            .sort((a, b) => ClientsModule.daysSinceContact(b.lastContact) - ClientsModule.daysSinceContact(a.lastContact))
            .slice(0, 5).forEach(c => {
                const days = ClientsModule.daysSinceContact(c.lastContact);
                actions.push({
                    severity: 'danger',
                    label: days + ' dias',
                    name: c.name,
                    detail: c.phone || c.company || '',
                    action: `App.navigate('clients'); ClientsModule.openDetail('${c.id}');`
                });
            });

        financials.filter(f => f.status !== 'pago' && f.dueDate < today)
            .sort((a, b) => a.dueDate.localeCompare(b.dueDate))
            .slice(0, 3).forEach(f => {
                const client = f.clientId ? ClientStore.getById(f.clientId) : null;
                actions.push({
                    severity: 'warning',
                    label: 'R$ ' + FinancialModule.formatCurrency(f.amount),
                    name: client ? client.name : 'Sem cliente',
                    detail: f.description,
                    action: `FinancialModule.markPaid('${f.id}'); DashboardModule.refresh();`
                });
            });

        if (actions.length === 0) {
            container.innerHTML = '<p class="empty-state">Nenhuma acao pendente. Tudo em dia!</p>';
            return;
        }

        container.innerHTML = actions.map(a => `
            <div class="alert-item">
                <div class="alert-info">
                    <div class="alert-name">${ClientsModule.escapeHtml(a.name)}</div>
                    <div class="alert-detail">${ClientsModule.escapeHtml(a.detail)}</div>
                </div>
                <span class="alert-days ${a.severity}">${a.label}</span>
                <button class="btn btn-sm btn-primary" onclick="${a.action}" style="margin-left:8px">Agir</button>
            </div>
        `).join('');
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
                    ${client ? `<div class="reminder-client-name">${ClientsModule.escapeHtml(client.name)}</div>` : ''}
                    <div class="reminder-message">${ClientsModule.escapeHtml(r.message)}</div>
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
                    ${client ? `<div class="reminder-client-name">${ClientsModule.escapeHtml(client.name)}</div>` : ''}
                    <div class="reminder-message">${ClientsModule.escapeHtml(r.message)}</div>
                </div>
                <span class="reminder-date">${ClientsModule.formatDate(r.date)}</span>
            </div>`;
        }).join('');
    }
};
