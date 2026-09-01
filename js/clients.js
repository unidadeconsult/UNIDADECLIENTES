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

            let scoreHtml = '';
            if (c.status === 'prospecto' || (c.status === 'ativo' && (c.stage === 'prospeccao' || c.stage === 'proposta'))) {
                const s = LeadScoringModule.score(c);
                scoreHtml = `<span class="lead-score score-${s.label.class}" title="Score: ${s.total}${s.hasOverride ? ' (manual)' : ''}" style="cursor:pointer" onclick="event.stopPropagation(); LeadScoringModule.editScore('${c.id}')">${s.label.icon} ${s.label.text}${s.hasOverride ? '*' : ''}</span>`;
            }

            return `<tr>
                <td>
                    <strong>${this.escapeHtml(c.name)}</strong>
                    ${c.company ? `<br><small style="color:var(--text-light)">${this.escapeHtml(c.company)}</small>` : ''}
                    ${scoreHtml}
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
            const linksEl = document.getElementById('clientLinks');
            if (linksEl) linksEl.value = (client.links || []).join('\n');
            const rpiEl = document.getElementById('clientRpiDate');
            const grantEl = document.getElementById('clientGrantDate');
            const regEl = document.getElementById('clientRegistrationDate');
            if (rpiEl) rpiEl.value = client.rpiDate || '';
            if (grantEl) grantEl.value = client.grantDate || '';
            if (regEl) regEl.value = client.registrationDate || '';
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

        const rpiEl = document.getElementById('clientRpiDate');
        const grantEl = document.getElementById('clientGrantDate');
        const regEl = document.getElementById('clientRegistrationDate');

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
            notes: document.getElementById('clientNotes').value.trim(),
            links: (document.getElementById('clientLinks') ? document.getElementById('clientLinks').value : '').split('\n').map(l => l.trim()).filter(l => l),
            rpiDate: rpiEl ? rpiEl.value : '',
            grantDate: grantEl ? grantEl.value : '',
            registrationDate: regEl ? regEl.value : ''
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

        const tagsHtml = (client.tags || []).map(t =>
            `<span class="tag-chip">${this.escapeHtml(t)}</span>`
        ).join(' ') || 'Nenhuma etiqueta';

        const classesHtml = (client.classes || []).length > 0
            ? client.classes.map(c => `<span class="tag-chip" style="background:var(--info)">${this.escapeHtml(c)}</span>`).join(' ')
            : '-';

        let scoreHtml = '';
        if (client.status === 'prospecto' || (client.status === 'ativo' && (client.stage === 'prospeccao' || client.stage === 'proposta'))) {
            const s = LeadScoringModule.score(client);
            scoreHtml = `<div class="detail-field full-width">
                <span class="detail-label">Lead Score</span>
                <span class="detail-value" style="display:flex;align-items:center;gap:8px;flex-wrap:wrap">
                    <span class="lead-score score-${s.label.class}" style="font-size:14px">${s.label.icon} ${s.label.text} (${s.total} pts)${s.hasOverride ? ' <small style="opacity:0.7">[manual]</small>' : ''}</span>
                    <span style="font-size:12px;color:var(--text-light)">Auto: ${s.autoTotal} pts (Origem: ${s.breakdown.origin} | Resposta: ${s.breakdown.response} | Valor: ${s.breakdown.value} | Classes: ${s.breakdown.classes})</span>
                    <button class="btn btn-sm btn-secondary" onclick="LeadScoringModule.editScore('${id}')" style="margin-left:auto;font-size:12px">&#9998; Editar pontuacao</button>
                </span>
            </div>`;
        }

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

        const linksHtml = (client.links || []).length > 0
            ? `<div class="links-list">${client.links.map(l => `<div class="link-item"><a href="${this.escapeHtml(l)}" target="_blank" rel="noopener">${this.escapeHtml(l)}</a></div>`).join('')}</div>`
            : '<p style="color:var(--text-light)">Nenhum link cadastrado.</p>';

        const reminders = ReminderStore.getAll()
            .filter(r => r.clientId === id && !r.completed)
            .sort((a, b) => a.date.localeCompare(b.date));
        const reminderHtml = reminders.length > 0
            ? reminders.map(r => `<div style="padding:4px 0;border-bottom:1px solid var(--border)">
                <span class="reminder-type-badge type-${r.type}">${r.type}</span>
                <strong>${this.formatDate(r.date)}</strong> - ${this.escapeHtml(r.message)}
            </div>`).join('')
            : '<p style="color:var(--text-light)">Nenhum lembrete pendente.</p>';

        const recentInteractions = InteractionStore.getByClient(id).slice(0, 10);
        const interactionsHtml = recentInteractions.length > 0
            ? recentInteractions.map(i => `<div style="padding:4px 0;border-bottom:1px solid var(--border);font-size:13px">
                <strong>${this.formatDate(i.date)}</strong> (${InteractionsModule.typeLabel(i.type)}) - ${this.escapeHtml(i.description)}
            </div>`).join('')
            : '<p style="color:var(--text-light)">Nenhuma interacao registrada.</p>';

        const financials = FinancialStore.getByClient(id);
        const pendingFin = financials.filter(f => f.status !== 'pago');
        const paidFin = financials.filter(f => f.status === 'pago');
        const finPendingHtml = pendingFin.length > 0
            ? pendingFin.map(f => `<div style="padding:4px 0;border-bottom:1px solid var(--border);font-size:13px">
                <strong>R$ ${FinancialModule.formatCurrency(f.amount)}</strong> - ${this.escapeHtml(f.description)} - Venc: ${this.formatDate(f.dueDate)}
                <span style="color:${f.dueDate < new Date().toISOString().split('T')[0] ? 'var(--danger)' : 'var(--warning)'};font-weight:600;margin-left:4px">${f.dueDate < new Date().toISOString().split('T')[0] ? 'ATRASADO' : 'PENDENTE'}</span>
            </div>`).join('')
            : '<p style="color:var(--text-light)">Nenhum valor pendente.</p>';
        const finPaidHtml = paidFin.length > 0
            ? paidFin.slice(0, 5).map(f => `<div style="padding:4px 0;border-bottom:1px solid var(--border);font-size:13px;opacity:0.7">
                <strong>R$ ${FinancialModule.formatCurrency(f.amount)}</strong> - ${this.escapeHtml(f.description)} - Pago: ${this.formatDate(f.paidDate || '')}
            </div>`).join('')
            : '';
        const totalPaid = paidFin.reduce((s, f) => s + (parseFloat(f.amount) || 0), 0);
        const totalPending = pendingFin.reduce((s, f) => s + (parseFloat(f.amount) || 0), 0);

        const deadlinesHtml = INPIDeadlineCalculator.renderForClient(id);

        const tabDados = `
            <div class="client-detail-grid">
                ${scoreHtml}
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
                    <span class="detail-label">Links / Documentos</span>
                    ${linksHtml}
                </div>
            </div>`;

        const tabProcesso = `
            <div class="client-detail-grid">
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
                    <span class="detail-label">Valor da proposta</span>
                    <span class="detail-value">${client.proposalValue ? 'R$ ' + FinancialModule.formatCurrency(client.proposalValue) : '-'}</span>
                </div>
                <div class="detail-field full-width">
                    <span class="detail-label">Lembretes pendentes</span>
                    ${reminderHtml}
                </div>
                ${deadlinesHtml ? `<div class="detail-field full-width">
                    <span class="detail-label">Prazos INPI (calculados)</span>
                    <div class="deadline-calculator">${deadlinesHtml}</div>
                </div>` : ''}
            </div>`;

        const tabFinanceiro = `
            <div class="client-detail-grid">
                <div class="detail-field">
                    <span class="detail-label">Total pago</span>
                    <span class="detail-value" style="color:var(--success);font-weight:600">R$ ${FinancialModule.formatCurrency(totalPaid)}</span>
                </div>
                <div class="detail-field">
                    <span class="detail-label">Total pendente</span>
                    <span class="detail-value" style="color:var(--warning);font-weight:600">R$ ${FinancialModule.formatCurrency(totalPending)}</span>
                </div>
                <div class="detail-field full-width">
                    <span class="detail-label">Valores pendentes</span>
                    ${finPendingHtml}
                </div>
                ${finPaidHtml ? `<div class="detail-field full-width">
                    <span class="detail-label">Ultimos pagamentos</span>
                    ${finPaidHtml}
                </div>` : ''}
            </div>`;

        const tabHistorico = `
            <div class="client-detail-grid">
                <div class="detail-field full-width">
                    <span class="detail-label">Interacoes recentes</span>
                    ${interactionsHtml}
                </div>
            </div>`;

        const checklist = client.checklist || {};
        const tabDocumentos = `
            <div class="checklist-section">
                <p style="color:var(--text-light);font-size:13px;margin-bottom:12px">Marque os documentos ja recebidos do cliente:</p>
                ${DOCUMENT_CHECKLIST.map(doc => {
                    const checked = checklist[doc.id] ? 'checked' : '';
                    return `<label class="checklist-item ${checked ? 'checklist-done' : ''}">
                        <input type="checkbox" ${checked} onchange="ClientsModule.toggleChecklist('${id}', '${doc.id}', this.checked)">
                        <span class="checklist-mark"></span>
                        <span class="checklist-label">${doc.label}</span>
                        ${checklist[doc.id] ? '<span class="checklist-status">Recebido</span>' : '<span class="checklist-status pending">Pendente</span>'}
                    </label>`;
                }).join('')}
                <div class="checklist-summary">
                    ${Object.values(checklist).filter(v => v).length} de ${DOCUMENT_CHECKLIST.length} documentos recebidos
                </div>
            </div>`;

        const proposals = ProposalStore.getByClient(id);
        const acceptedProposals = proposals.filter(p => p.status === 'aceita');
        const pendingProposals = proposals.filter(p => p.status === 'pendente');
        const totalProposalValue = proposals.reduce((s, p) => s + (parseFloat(p.value) || 0), 0);
        const avgTicket = proposals.length > 0 ? totalProposalValue / proposals.length : 0;
        const conversionRate = proposals.length > 0 ? Math.round((acceptedProposals.length / proposals.length) * 100) : 0;

        const tabPropostas = `
            <div class="client-detail-grid">
                <div class="detail-field">
                    <span class="detail-label">Total de propostas</span>
                    <span class="detail-value">${proposals.length}</span>
                </div>
                <div class="detail-field">
                    <span class="detail-label">Taxa de conversao</span>
                    <span class="detail-value">${conversionRate}%</span>
                </div>
                <div class="detail-field">
                    <span class="detail-label">Ticket medio</span>
                    <span class="detail-value">R$ ${FinancialModule.formatCurrency(avgTicket)}</span>
                </div>
                <div class="detail-field">
                    <span class="detail-label">Pendentes</span>
                    <span class="detail-value" style="color:var(--warning)">${pendingProposals.length}</span>
                </div>
            </div>
            <div style="margin:12px 0">
                <button class="btn btn-primary btn-sm" onclick="ClientsModule.addProposal('${id}')">+ Nova Proposta</button>
            </div>
            ${proposals.length > 0 ? `<div class="proposals-list">
                ${proposals.map(p => {
                    const statusColors = { aceita: 'var(--success)', recusada: 'var(--danger)', pendente: 'var(--warning)' };
                    const statusLabels = { aceita: 'Aceita', recusada: 'Recusada', pendente: 'Pendente' };
                    return `<div class="proposal-item">
                        <div class="proposal-info">
                            <strong>R$ ${FinancialModule.formatCurrency(p.value)}</strong>
                            <span style="color:var(--text-light);font-size:12px">${this.formatDate(p.date)}</span>
                            ${p.description ? `<div style="font-size:13px;margin-top:2px">${this.escapeHtml(p.description)}</div>` : ''}
                        </div>
                        <div class="proposal-actions">
                            <span class="proposal-status" style="color:${statusColors[p.status] || 'var(--text-light)'}">${statusLabels[p.status] || p.status}</span>
                            ${p.status === 'pendente' ? `
                                <button class="btn-icon" onclick="ClientsModule.updateProposalStatus('${id}','${p.id}','aceita')" title="Aceitar" style="color:var(--success)">&#10004;</button>
                                <button class="btn-icon" onclick="ClientsModule.updateProposalStatus('${id}','${p.id}','recusada')" title="Recusar" style="color:var(--danger)">&#10008;</button>
                            ` : ''}
                            <button class="btn-icon" onclick="ClientsModule.deleteProposal('${id}','${p.id}')" title="Excluir">&#128465;</button>
                        </div>
                    </div>`;
                }).join('')}
            </div>` : '<p class="empty-state">Nenhuma proposta registrada.</p>'}`;

        document.getElementById('clientDetailContent').innerHTML = `
            <div class="detail-tabs">
                <button class="detail-tab active" onclick="ClientsModule.switchTab(this, 'detailTabDados')">Dados</button>
                <button class="detail-tab" onclick="ClientsModule.switchTab(this, 'detailTabProcesso')">Processo</button>
                <button class="detail-tab" onclick="ClientsModule.switchTab(this, 'detailTabDocumentos')">Documentos</button>
                <button class="detail-tab" onclick="ClientsModule.switchTab(this, 'detailTabPropostas')">Propostas</button>
                <button class="detail-tab" onclick="ClientsModule.switchTab(this, 'detailTabFinanceiro')">Financeiro</button>
                <button class="detail-tab" onclick="ClientsModule.switchTab(this, 'detailTabHistorico')">Historico</button>
                <button class="detail-tab" onclick="ClientsModule.switchTab(this, 'detailTabIA')">IA</button>
            </div>
            <div id="detailTabDados" class="detail-tab-panel active">${tabDados}</div>
            <div id="detailTabProcesso" class="detail-tab-panel">${tabProcesso}</div>
            <div id="detailTabDocumentos" class="detail-tab-panel">${tabDocumentos}</div>
            <div id="detailTabPropostas" class="detail-tab-panel">${tabPropostas}</div>
            <div id="detailTabFinanceiro" class="detail-tab-panel">${tabFinanceiro}</div>
            <div id="detailTabHistorico" class="detail-tab-panel">${tabHistorico}</div>
            <div id="detailTabIA" class="detail-tab-panel">
                <div style="text-align:center;padding:24px">
                    <p style="margin-bottom:12px;color:var(--text-light)">Use a inteligencia artificial para analisar este cliente.</p>
                    <button class="btn btn-ai" onclick="AIModule.openChat('${id}'); ClientsModule.closeDetail();">&#129302; Abrir chat IA</button>
                </div>
            </div>
            <div class="detail-actions">
                <button class="btn btn-primary btn-sm" onclick="ClientsModule.openForm('${id}'); ClientsModule.closeDetail();">Editar</button>
                <button class="btn btn-success btn-sm" onclick="InteractionsModule.openLog('${id}'); ClientsModule.closeDetail();">Historico</button>
                <button class="btn btn-warning btn-sm" onclick="RemindersModule.openFormForClient('${id}'); ClientsModule.closeDetail();">Criar Lembrete</button>
                <button class="btn btn-secondary btn-sm" onclick="TemplatesModule.openPreviewForClient('${id}'); ClientsModule.closeDetail();">Enviar Mensagem</button>
                <button class="btn btn-sm" style="background:var(--info);color:white" onclick="PDFReportModule.generateClientReport('${id}');">Relatorio PDF</button>
                <button class="btn btn-sm" style="background:#6c5ce7;color:white" onclick="ClientsModule.duplicateClient('${id}');">&#128203; Duplicar</button>
            </div>
        `;

        document.getElementById('clientDetailModal').classList.remove('hidden');
    },

    switchTab(btn, panelId) {
        btn.closest('.detail-tabs').querySelectorAll('.detail-tab').forEach(t => t.classList.remove('active'));
        btn.classList.add('active');
        const container = btn.closest('#clientDetailContent') || document.getElementById('clientDetailContent');
        container.querySelectorAll('.detail-tab-panel').forEach(p => p.classList.remove('active'));
        document.getElementById(panelId).classList.add('active');
    },

    toggleChecklist(clientId, docId, checked) {
        const client = ClientStore.getById(clientId);
        if (!client) return;
        if (!client.checklist) client.checklist = {};
        client.checklist[docId] = checked;
        ClientStore.save(client);
        this.openDetail(clientId);
    },

    addProposal(clientId) {
        const valueStr = prompt('Valor da proposta (R$):');
        if (!valueStr) return;
        const value = parseFloat(valueStr.replace(',', '.'));
        if (isNaN(value) || value <= 0) {
            App.toast('Valor invalido.', 'warning');
            return;
        }
        const desc = prompt('Descricao (opcional):', '');
        if (desc === null) return;

        ProposalStore.save({
            clientId,
            value,
            description: desc || '',
            date: new Date().toISOString().split('T')[0],
            status: 'pendente'
        });
        App.toast('Proposta registrada!', 'success');
        this.openDetail(clientId);
    },

    updateProposalStatus(clientId, proposalId, status) {
        const proposal = ProposalStore.getAll().find(p => p.id === proposalId);
        if (!proposal) return;
        proposal.status = status;
        ProposalStore.save(proposal);
        App.toast('Proposta atualizada!', 'success');
        this.openDetail(clientId);
    },

    deleteProposal(clientId, proposalId) {
        if (!confirm('Excluir esta proposta?')) return;
        ProposalStore.delete(proposalId);
        this.openDetail(clientId);
    },

    duplicateClient(id) {
        const client = ClientStore.getById(id);
        if (!client) return;
        const copy = { ...client };
        delete copy.id;
        delete copy.createdAt;
        delete copy.updatedAt;
        copy.name = client.name + ' (copia)';
        copy.tags = [...(client.tags || [])];
        copy.classes = [...(client.classes || [])];
        copy.links = [...(client.links || [])];
        ClientStore.save(copy);
        this.closeDetail();
        this.render();
        DashboardModule.refresh();
        App.toast('Cliente duplicado com sucesso!', 'success');
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
