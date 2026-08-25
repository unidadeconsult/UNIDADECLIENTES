const CalendarModule = {
    currentDate: new Date(),

    init() {
        document.getElementById('calPrev').addEventListener('click', () => this.prevMonth());
        document.getElementById('calNext').addEventListener('click', () => this.nextMonth());
        this.render();
    },

    render() {
        const year = this.currentDate.getFullYear();
        const month = this.currentDate.getMonth();

        const monthNames = ['Janeiro', 'Fevereiro', 'Marco', 'Abril', 'Maio', 'Junho',
            'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro'];
        document.getElementById('calMonth').textContent = `${monthNames[month]} ${year}`;

        const firstDay = new Date(year, month, 1).getDay();
        const daysInMonth = new Date(year, month + 1, 0).getDate();
        const today = new Date().toISOString().split('T')[0];

        const reminders = ReminderStore.getAll().filter(r => !r.completed);
        const financials = FinancialStore.getAll().filter(f => f.status !== 'pago');

        const grid = document.getElementById('calGrid');
        let html = '';

        const dayNames = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sab'];
        html += dayNames.map(d => `<div class="cal-day-name">${d}</div>`).join('');

        for (let i = 0; i < firstDay; i++) {
            html += '<div class="cal-day empty"></div>';
        }

        for (let day = 1; day <= daysInMonth; day++) {
            const dateStr = `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
            const isToday = dateStr === today;
            const dayReminders = reminders.filter(r => r.date === dateStr);
            const dayFinancials = financials.filter(f => f.dueDate === dateStr);
            const hasEvents = dayReminders.length > 0 || dayFinancials.length > 0;

            let dots = '';
            if (dayReminders.length > 0) dots += '<span class="cal-dot reminder-dot"></span>';
            if (dayFinancials.length > 0) dots += '<span class="cal-dot financial-dot"></span>';

            html += `<div class="cal-day ${isToday ? 'today' : ''} ${hasEvents ? 'has-events' : ''}"
                          onclick="CalendarModule.showDayDetail('${dateStr}')">
                <span class="cal-day-num">${day}</span>
                <div class="cal-dots">${dots}</div>
                ${dayReminders.length > 0 ? `<span class="cal-event-count">${dayReminders.length + dayFinancials.length}</span>` : ''}
            </div>`;
        }

        grid.innerHTML = html;
        this.renderDayDetail(today);
    },

    showDayDetail(dateStr) {
        document.querySelectorAll('.cal-day.selected').forEach(el => el.classList.remove('selected'));
        const dayEl = document.querySelector(`.cal-day[onclick*="${dateStr}"]`);
        if (dayEl) dayEl.classList.add('selected');
        this.renderDayDetail(dateStr);
    },

    renderDayDetail(dateStr) {
        const container = document.getElementById('calDayDetail');
        const reminders = ReminderStore.getAll().filter(r => r.date === dateStr && !r.completed);
        const financials = FinancialStore.getAll().filter(f => f.dueDate === dateStr && f.status !== 'pago');

        let html = `<h4>Eventos em ${ClientsModule.formatDate(dateStr)}</h4>`;

        if (reminders.length === 0 && financials.length === 0) {
            html += '<p class="empty-state">Nenhum evento neste dia.</p>';
        } else {
            reminders.forEach(r => {
                const client = r.clientId ? ClientStore.getById(r.clientId) : null;
                html += `<div class="cal-event-item">
                    <span class="reminder-type-badge type-${r.type}">${RemindersModule.typeLabel(r.type)}</span>
                    <div class="cal-event-info">
                        ${client ? `<strong>${ClientsModule.escapeHtml(client.name)}</strong> - ` : ''}
                        ${ClientsModule.escapeHtml(r.message)}
                    </div>
                    <button class="btn-icon" onclick="RemindersModule.toggleComplete('${r.id}'); CalendarModule.render();" title="Concluir">&#9745;</button>
                </div>`;
            });

            financials.forEach(f => {
                const client = f.clientId ? ClientStore.getById(f.clientId) : null;
                html += `<div class="cal-event-item financial-event">
                    <span class="reminder-type-badge type-pagamento">R$</span>
                    <div class="cal-event-info">
                        ${client ? `<strong>${ClientsModule.escapeHtml(client.name)}</strong> - ` : ''}
                        ${ClientsModule.escapeHtml(f.description)} - R$ ${FinancialModule.formatCurrency(f.amount)}
                    </div>
                    <button class="btn btn-success btn-sm" onclick="FinancialModule.markPaid('${f.id}'); CalendarModule.render();">Pago</button>
                </div>`;
            });
        }

        container.innerHTML = html;
    },

    prevMonth() {
        this.currentDate.setMonth(this.currentDate.getMonth() - 1);
        this.render();
    },

    nextMonth() {
        this.currentDate.setMonth(this.currentDate.getMonth() + 1);
        this.render();
    }
};
