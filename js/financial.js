const FinancialModule = {
    init() {
        this.bindEvents();
        this.render();
    },

    bindEvents() {
        document.getElementById('btnAddFinancial').addEventListener('click', () => this.openForm());
        document.getElementById('closeFinancialModal').addEventListener('click', () => this.closeForm());
        document.getElementById('cancelFinancial').addEventListener('click', () => this.closeForm());
        document.getElementById('financialForm').addEventListener('submit', (e) => this.handleSubmit(e));
        document.getElementById('financialFilter').addEventListener('change', () => this.render());
    },

    render() {
        const filter = document.getElementById('financialFilter').value;
        const today = new Date().toISOString().split('T')[0];
        let entries = FinancialStore.getAll();

        entries.forEach(e => {
            if (e.status !== 'pago' && e.dueDate < today) {
                e.status = 'atrasado';
            }
        });

        if (filter === 'pendente') {
            entries = entries.filter(e => e.status === 'pendente');
        } else if (filter === 'atrasado') {
            entries = entries.filter(e => e.status === 'atrasado');
        } else if (filter === 'pago') {
            entries = entries.filter(e => e.status === 'pago');
        }

        entries.sort((a, b) => {
            if (a.status === 'atrasado' && b.status !== 'atrasado') return -1;
            if (a.status !== 'atrasado' && b.status === 'atrasado') return 1;
            return a.dueDate.localeCompare(b.dueDate);
        });

        this.renderSummary();
        this.renderList(entries);
    },

    renderSummary() {
        const entries = FinancialStore.getAll();
        const today = new Date().toISOString().split('T')[0];

        let totalReceived = 0, totalPending = 0, totalOverdue = 0;
        let byCategory = { honorario: 0, gru: 0, outro: 0 };
        entries.forEach(e => {
            const amount = parseFloat(e.amount) || 0;
            const cat = e.category || 'honorario';
            if (e.status === 'pago') {
                totalReceived += amount;
                byCategory[cat] = (byCategory[cat] || 0) + amount;
            } else if (e.dueDate < today) {
                totalOverdue += amount;
            } else {
                totalPending += amount;
            }
        });

        document.getElementById('finReceived').textContent = this.formatCurrency(totalReceived);
        document.getElementById('finPending').textContent = this.formatCurrency(totalPending);
        document.getElementById('finOverdue').textContent = this.formatCurrency(totalOverdue);

        const extEl = document.getElementById('finExtendedSummary');
        if (extEl) {
            extEl.innerHTML = `
                <div class="fin-summary-extended">
                    <div class="fin-cat-item">
                        <span class="financial-category fin-cat-honorario">Honorarios</span>
                        <span>R$ ${this.formatCurrency(byCategory.honorario)}</span>
                    </div>
                    <div class="fin-cat-item">
                        <span class="financial-category fin-cat-gru">GRU / INPI</span>
                        <span>R$ ${this.formatCurrency(byCategory.gru)}</span>
                    </div>
                    <div class="fin-cat-item">
                        <span class="financial-category fin-cat-outro">Outros</span>
                        <span>R$ ${this.formatCurrency(byCategory.outro)}</span>
                    </div>
                </div>`;
        }
    },

    categoryLabel(cat) {
        const labels = { honorario: 'Honorarios', gru: 'GRU/INPI', outro: 'Outro' };
        return labels[cat] || cat || 'Honorarios';
    },

    renderList(entries) {
        const container = document.getElementById('financialList');
        if (entries.length === 0) {
            container.innerHTML = '<p class="empty-state">Nenhum lancamento encontrado.</p>';
            return;
        }

        container.innerHTML = entries.map(e => {
            const client = e.clientId ? ClientStore.getById(e.clientId) : null;
            const statusClass = e.status === 'pago' ? 'success' : e.status === 'atrasado' ? 'danger' : 'warning';
            const statusLabel = e.status === 'pago' ? 'PAGO' : e.status === 'atrasado' ? 'ATRASADO' : 'PENDENTE';

            const catClass = e.category === 'gru' ? 'fin-cat-gru' : e.category === 'outro' ? 'fin-cat-outro' : 'fin-cat-honorario';

            return `<div class="financial-item ${e.status === 'pago' ? 'paid' : ''}">
                <div class="financial-status">
                    <span class="badge badge-fin-${statusClass}">${statusLabel}</span>
                    <span class="financial-category ${catClass}" style="font-size:10px;margin-top:4px">${this.categoryLabel(e.category)}</span>
                </div>
                <div class="financial-info">
                    ${client ? `<div class="financial-client">${ClientsModule.escapeHtml(client.name)}</div>` : ''}
                    <div class="financial-desc">${ClientsModule.escapeHtml(e.description)}</div>
                </div>
                <div class="financial-amount">R$ ${this.formatCurrency(e.amount)}</div>
                <div class="financial-date">
                    Venc: ${ClientsModule.formatDate(e.dueDate)}
                    ${e.paidDate ? `<br>Pago: ${ClientsModule.formatDate(e.paidDate)}` : ''}
                </div>
                <div class="financial-actions">
                    ${e.status !== 'pago' ? `<button class="btn btn-success btn-sm" onclick="FinancialModule.markPaid('${e.id}')">Pago</button>` : ''}
                    <button class="btn-icon" onclick="FinancialModule.openForm('${e.id}')" title="Editar">&#9998;</button>
                    <button class="btn-icon" onclick="FinancialModule.confirmDelete('${e.id}')" title="Excluir">&#128465;</button>
                </div>
            </div>`;
        }).join('');
    },

    openForm(id) {
        const modal = document.getElementById('financialModal');
        const form = document.getElementById('financialForm');
        form.reset();
        this.populateClientSelect();

        const installmentGroup = document.getElementById('installmentGroup');
        if (installmentGroup) installmentGroup.style.display = '';

        if (id) {
            const entry = FinancialStore.getAll().find(e => e.id === id);
            if (!entry) return;
            document.getElementById('financialModalTitle').textContent = 'Editar Lancamento';
            document.getElementById('financialId').value = entry.id;
            document.getElementById('financialClient').value = entry.clientId || '';
            document.getElementById('financialDesc').value = entry.description || '';
            document.getElementById('financialAmount').value = entry.amount || '';
            document.getElementById('financialDue').value = entry.dueDate || '';
            document.getElementById('financialStatus').value = entry.status || 'pendente';
            document.getElementById('financialCategory').value = entry.category || 'honorario';
            if (installmentGroup) installmentGroup.style.display = 'none';
        } else {
            document.getElementById('financialModalTitle').textContent = 'Novo Lancamento';
            document.getElementById('financialId').value = '';
            document.getElementById('financialCategory').value = 'honorario';
        }

        modal.classList.remove('hidden');
    },

    closeForm() {
        document.getElementById('financialModal').classList.add('hidden');
    },

    handleSubmit(e) {
        e.preventDefault();
        const id = document.getElementById('financialId').value;
        const category = document.getElementById('financialCategory').value;
        const entry = {
            clientId: document.getElementById('financialClient').value || null,
            description: document.getElementById('financialDesc').value.trim(),
            amount: parseFloat(document.getElementById('financialAmount').value) || 0,
            dueDate: document.getElementById('financialDue').value,
            status: document.getElementById('financialStatus').value,
            category: category || 'honorario'
        };

        if (id) entry.id = id;
        if (entry.status === 'pago' && !entry.paidDate) {
            entry.paidDate = new Date().toISOString().split('T')[0];
        }

        const installments = parseInt(document.getElementById('financialInstallments').value) || 1;
        if (!id && installments > 1) {
            this.generateInstallments(entry, installments);
            this.closeForm();
            this.render();
            App.toast(installments + ' parcelas criadas!', 'success');
            return;
        }

        FinancialStore.save(entry);
        this.closeForm();
        this.render();
        App.toast(id ? 'Lancamento atualizado!' : 'Lancamento criado!', 'success');
    },

    generateInstallments(baseEntry, count) {
        const installmentAmount = Math.round((baseEntry.amount / count) * 100) / 100;
        const baseDate = new Date(baseEntry.dueDate);

        for (let i = 0; i < count; i++) {
            const dueDate = new Date(baseDate);
            dueDate.setMonth(dueDate.getMonth() + i);
            FinancialStore.save({
                clientId: baseEntry.clientId,
                description: baseEntry.description + ' (' + (i + 1) + '/' + count + ')',
                amount: installmentAmount,
                dueDate: dueDate.toISOString().split('T')[0],
                status: 'pendente',
                category: baseEntry.category
            });
        }
    },

    markPaid(id) {
        FinancialStore.markPaid(id);
        this.render();
        App.toast('Pagamento registrado!', 'success');
    },

    confirmDelete(id) {
        if (confirm('Excluir este lancamento?')) {
            FinancialStore.delete(id);
            this.render();
        }
    },

    populateClientSelect() {
        const select = document.getElementById('financialClient');
        const clients = ClientStore.getAll().sort((a, b) => a.name.localeCompare(b.name));
        select.innerHTML = '<option value="">-- Sem cliente --</option>' +
            clients.map(c => `<option value="${c.id}">${ClientsModule.escapeHtml(c.name)}</option>`).join('');
    },

    formatCurrency(value) {
        return parseFloat(value || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
    }
};
