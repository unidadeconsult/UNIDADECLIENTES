const ReportsModule = {
    init() {
        document.getElementById('reportMonth').value = new Date().toISOString().slice(0, 7);
        document.getElementById('reportMonth').addEventListener('change', () => this.render());
        document.getElementById('btnExportJSON').addEventListener('click', () => this.exportJSON());
        document.getElementById('btnExportCSV').addEventListener('click', () => this.exportCSV());
        document.getElementById('btnImportData').addEventListener('click', () => document.getElementById('importFile').click());
        document.getElementById('importFile').addEventListener('change', (e) => this.importData(e));
        this.render();
    },

    render() {
        const monthStr = document.getElementById('reportMonth').value;
        if (!monthStr) return;

        const [year, month] = monthStr.split('-').map(Number);
        const startDate = `${monthStr}-01`;
        const endDate = `${year}-${String(month + 1).padStart(2, '0')}-01`;

        const clients = ClientStore.getAll();
        const reminders = ReminderStore.getAll();
        const interactions = InteractionStore.getAll();
        const financials = FinancialStore.getAll();

        const newClients = clients.filter(c => c.createdAt && c.createdAt >= startDate && c.createdAt < endDate);
        const monthInteractions = interactions.filter(i => i.date >= startDate && i.date < endDate);
        const monthReminders = reminders.filter(r => r.date >= startDate && r.date < endDate);
        const completedReminders = monthReminders.filter(r => r.completed);
        const monthFinancials = financials.filter(f => f.dueDate >= startDate && f.dueDate < endDate);
        const paidFinancials = monthFinancials.filter(f => f.status === 'pago');
        const overdueFinancials = monthFinancials.filter(f => f.status !== 'pago' && f.dueDate < new Date().toISOString().split('T')[0]);

        const totalReceived = paidFinancials.reduce((sum, f) => sum + (parseFloat(f.amount) || 0), 0);
        const totalPending = monthFinancials.filter(f => f.status !== 'pago').reduce((sum, f) => sum + (parseFloat(f.amount) || 0), 0);

        const inactiveClients = clients.filter(c => c.status !== 'inativo' && c.status !== 'perdido' && ClientsModule.daysSinceContact(c.lastContact) >= 30);

        const interactionTypes = {};
        monthInteractions.forEach(i => {
            interactionTypes[i.type] = (interactionTypes[i.type] || 0) + 1;
        });

        const stageDistribution = {};
        clients.filter(c => c.process).forEach(c => {
            const stage = c.stage || 'protocolo';
            stageDistribution[stage] = (stageDistribution[stage] || 0) + 1;
        });

        const originStats = {};
        clients.forEach(c => {
            if (c.origin) {
                if (!originStats[c.origin]) originStats[c.origin] = { leads: 0, converted: 0 };
                originStats[c.origin].leads++;
                if (c.status === 'ativo') originStats[c.origin].converted++;
            }
        });

        const lossStats = {};
        clients.filter(c => c.status === 'perdido' && c.lossReason).forEach(c => {
            lossStats[c.lossReason] = (lossStats[c.lossReason] || 0) + 1;
        });
        const totalLost = clients.filter(c => c.status === 'perdido').length;

        const container = document.getElementById('reportContent');
        container.innerHTML = `
            <div class="report-section">
                <h3>Resumo do Mes</h3>
                <div class="report-stats">
                    <div class="report-stat">
                        <div class="report-stat-number">${newClients.length}</div>
                        <div class="report-stat-label">Novos clientes</div>
                    </div>
                    <div class="report-stat">
                        <div class="report-stat-number">${monthInteractions.length}</div>
                        <div class="report-stat-label">Interacoes realizadas</div>
                    </div>
                    <div class="report-stat">
                        <div class="report-stat-number">${completedReminders.length}/${monthReminders.length}</div>
                        <div class="report-stat-label">Lembretes concluidos</div>
                    </div>
                    <div class="report-stat">
                        <div class="report-stat-number">${inactiveClients.length}</div>
                        <div class="report-stat-label">Clientes inativos</div>
                    </div>
                </div>
            </div>

            <div class="report-section">
                <h3>Financeiro do Mes</h3>
                <div class="report-stats">
                    <div class="report-stat stat-success">
                        <div class="report-stat-number">R$ ${FinancialModule.formatCurrency(totalReceived)}</div>
                        <div class="report-stat-label">Recebido</div>
                    </div>
                    <div class="report-stat stat-warning">
                        <div class="report-stat-number">R$ ${FinancialModule.formatCurrency(totalPending)}</div>
                        <div class="report-stat-label">Pendente</div>
                    </div>
                    <div class="report-stat stat-danger">
                        <div class="report-stat-number">${overdueFinancials.length}</div>
                        <div class="report-stat-label">Pagamentos atrasados</div>
                    </div>
                    <div class="report-stat">
                        <div class="report-stat-number">${paidFinancials.length}/${monthFinancials.length}</div>
                        <div class="report-stat-label">Pagamentos realizados</div>
                    </div>
                </div>
            </div>

            <div class="report-columns">
                <div class="report-section">
                    <h3>Origem dos Clientes</h3>
                    ${Object.keys(originStats).length > 0
                        ? Object.entries(originStats)
                            .sort((a, b) => b[1].leads - a[1].leads)
                            .map(([origin, data]) => {
                                const originInfo = CLIENT_ORIGINS.find(o => o.id === origin);
                                const label = originInfo ? originInfo.label : origin;
                                const maxLeads = Math.max(...Object.values(originStats).map(d => d.leads));
                                return `<div class="report-bar-item">
                                    <span class="report-bar-label">${label}</span>
                                    <div class="report-bar">
                                        <div class="report-bar-fill" style="width: ${Math.min(100, data.leads / maxLeads * 100)}%; background: var(--info)"></div>
                                    </div>
                                    <span class="report-bar-value">${data.leads} &rarr; ${data.converted}</span>
                                </div>`;
                            }).join('')
                        : '<p class="empty-state">Nenhuma origem registrada.</p>'}
                </div>

                <div class="report-section">
                    <h3>Motivos de Perda${totalLost > 0 ? ` (${totalLost})` : ''}</h3>
                    ${Object.keys(lossStats).length > 0
                        ? Object.entries(lossStats)
                            .sort((a, b) => b[1] - a[1])
                            .map(([reason, count]) => {
                                const reasonInfo = LOSS_REASONS.find(r => r.id === reason);
                                const label = reasonInfo ? reasonInfo.label : reason;
                                const pct = totalLost > 0 ? Math.round(count / totalLost * 100) : 0;
                                const maxCount = Math.max(...Object.values(lossStats));
                                return `<div class="report-bar-item">
                                    <span class="report-bar-label">${label}</span>
                                    <div class="report-bar">
                                        <div class="report-bar-fill" style="width: ${Math.min(100, count / maxCount * 100)}%; background: var(--danger)"></div>
                                    </div>
                                    <span class="report-bar-value">${pct}% (${count})</span>
                                </div>`;
                            }).join('')
                        : '<p class="empty-state">Nenhuma perda registrada.</p>'}
                </div>
            </div>

            <div class="report-columns">
                <div class="report-section">
                    <h3>Interacoes por Tipo</h3>
                    ${Object.keys(interactionTypes).length > 0
                        ? Object.entries(interactionTypes).map(([type, count]) => `
                            <div class="report-bar-item">
                                <span class="report-bar-label">${InteractionsModule.typeLabel(type)}</span>
                                <div class="report-bar">
                                    <div class="report-bar-fill" style="width: ${Math.min(100, count / Math.max(...Object.values(interactionTypes)) * 100)}%"></div>
                                </div>
                                <span class="report-bar-value">${count}</span>
                            </div>
                        `).join('')
                        : '<p class="empty-state">Nenhuma interacao no periodo.</p>'}
                </div>

                <div class="report-section">
                    <h3>Processos por Etapa</h3>
                    ${Object.keys(stageDistribution).length > 0
                        ? PIPELINE_STAGES.filter(s => stageDistribution[s.id]).map(s => `
                            <div class="report-bar-item">
                                <span class="report-bar-label">${s.label}</span>
                                <div class="report-bar">
                                    <div class="report-bar-fill" style="width: ${Math.min(100, stageDistribution[s.id] / Math.max(...Object.values(stageDistribution)) * 100)}%; background: ${s.color}"></div>
                                </div>
                                <span class="report-bar-value">${stageDistribution[s.id]}</span>
                            </div>
                        `).join('')
                        : '<p class="empty-state">Nenhum processo cadastrado.</p>'}
                </div>
            </div>

            <div class="report-section">
                <h3>Funil de Conversao</h3>
                ${this.renderConversionFunnel(clients)}
            </div>

            <div class="report-columns">
                <div class="report-section">
                    <h3>Receita por Categoria</h3>
                    ${this.renderFinancialByCategory(financials)}
                </div>
                <div class="report-section">
                    <h3>Top Leads (Score)</h3>
                    ${this.renderTopLeads()}
                </div>
            </div>

            <div class="report-section">
                <h3>Totais Gerais</h3>
                <div class="report-stats">
                    <div class="report-stat">
                        <div class="report-stat-number">${clients.length}</div>
                        <div class="report-stat-label">Total de clientes</div>
                    </div>
                    <div class="report-stat">
                        <div class="report-stat-number">${clients.filter(c => c.status === 'ativo').length}</div>
                        <div class="report-stat-label">Clientes ativos</div>
                    </div>
                    <div class="report-stat">
                        <div class="report-stat-number">${clients.filter(c => c.status === 'perdido').length}</div>
                        <div class="report-stat-label">Clientes perdidos</div>
                    </div>
                    <div class="report-stat">
                        <div class="report-stat-number">${clients.filter(c => c.process).length}</div>
                        <div class="report-stat-label">Processos em andamento</div>
                    </div>
                </div>
            </div>
        `;
    },

    renderConversionFunnel(clients) {
        const stages = [
            { id: 'prospeccao', label: 'Prospeccao', color: '#6c5ce7' },
            { id: 'proposta', label: 'Proposta', color: '#0984e3' },
            { id: 'protocolo', label: 'Protocolo', color: '#00b894' },
            { id: 'registrado', label: 'Registrado', color: '#fdcb6e' }
        ];

        const active = clients.filter(c => c.status !== 'inativo');
        const prospeccao = active.filter(c => c.status === 'prospecto' && (c.stage === 'prospeccao' || !c.stage)).length;
        const proposta = active.filter(c => c.stage === 'proposta').length;
        const protocolo = active.filter(c => ['protocolo', 'exame-formal', 'publicacao-rpi', 'oposicao', 'exame-merito', 'deferido'].includes(c.stage)).length;
        const registrado = active.filter(c => c.stage === 'registrado' || c.stage === 'monitoramento').length;
        const perdido = clients.filter(c => c.status === 'perdido').length;

        const counts = [prospeccao, proposta, protocolo, registrado];
        const maxCount = Math.max(...counts, 1);

        let html = '<div class="funnel-chart">';
        stages.forEach((s, i) => {
            const width = Math.max(20, (counts[i] / maxCount) * 100);
            html += `<div class="funnel-step">
                <span class="funnel-label">${s.label}</span>
                <div class="funnel-bar" style="width:${width}%;background:${s.color}">${counts[i]}</div>
            </div>`;
        });

        if (perdido > 0) {
            const width = Math.max(20, (perdido / maxCount) * 100);
            html += `<div class="funnel-step">
                <span class="funnel-label">Perdidos</span>
                <div class="funnel-bar" style="width:${width}%;background:var(--danger)">${perdido}</div>
            </div>`;
        }

        html += '</div>';

        const totalIn = prospeccao + proposta + protocolo + registrado;
        if (totalIn > 0) {
            const convRate = totalIn > 0 ? Math.round((registrado / totalIn) * 100) : 0;
            html += `<p style="text-align:center;margin-top:8px;font-size:13px;color:var(--text-light)">Taxa de conversao geral: <strong>${convRate}%</strong></p>`;
        }
        return html;
    },

    renderFinancialByCategory(financials) {
        const byCategory = { honorario: 0, gru: 0, outro: 0 };
        const total = { honorario: 0, gru: 0, outro: 0 };
        financials.forEach(f => {
            const cat = f.category || 'honorario';
            const amount = parseFloat(f.amount) || 0;
            total[cat] = (total[cat] || 0) + amount;
            if (f.status === 'pago') byCategory[cat] = (byCategory[cat] || 0) + amount;
        });

        const labels = { honorario: 'Honorarios', gru: 'GRU / INPI', outro: 'Outros' };
        const colors = { honorario: 'var(--primary)', gru: 'var(--warning)', outro: 'var(--text-light)' };
        const grandTotal = Object.values(total).reduce((a, b) => a + b, 0);
        if (grandTotal === 0) return '<p class="empty-state">Nenhum lancamento financeiro.</p>';

        return Object.entries(labels).map(([key, label]) => {
            const pct = grandTotal > 0 ? Math.round((total[key] / grandTotal) * 100) : 0;
            return `<div class="report-bar-item">
                <span class="report-bar-label">${label}</span>
                <div class="report-bar">
                    <div class="report-bar-fill" style="width:${pct}%;background:${colors[key]}"></div>
                </div>
                <span class="report-bar-value">R$ ${FinancialModule.formatCurrency(byCategory[key])} (${pct}%)</span>
            </div>`;
        }).join('');
    },

    renderTopLeads() {
        const hotLeads = LeadScoringModule.getHotLeads(5);
        if (hotLeads.length === 0) return '<p class="empty-state">Nenhum lead para avaliar.</p>';

        return hotLeads.map(({ client, score }) => `
            <div class="report-bar-item">
                <span class="report-bar-label">${ClientsModule.escapeHtml(client.name)}</span>
                <div class="report-bar">
                    <div class="report-bar-fill" style="width:${score.total}%;background:${score.label.class === 'hot' ? 'var(--danger)' : score.label.class === 'warm' ? 'var(--warning)' : 'var(--info)'}"></div>
                </div>
                <span class="report-bar-value">${score.label.icon} ${score.total} pts</span>
            </div>
        `).join('');
    },

    exportJSON() {
        const data = Storage.exportAll();
        this.downloadFile(data, 'unidade-consult-backup.json', 'application/json');
        App.toast('Backup exportado!', 'success');
    },

    exportCSV() {
        const clients = ClientStore.getAll();
        const fields = [
            { key: 'name', label: 'Nome' },
            { key: 'email', label: 'E-mail' },
            { key: 'phone', label: 'Telefone' },
            { key: 'company', label: 'Empresa' },
            { key: 'document', label: 'CNPJ/CPF' },
            { key: 'type', label: 'Tipo' },
            { key: 'status', label: 'Status' },
            { key: 'origin', label: 'Origem' },
            { key: 'process', label: 'Processo' },
            { key: 'stage', label: 'Etapa' },
            { key: 'proposalValue', label: 'Valor Proposta' },
            { key: 'classes', label: 'Classes' },
            { key: 'lastContact', label: 'Ultimo Contato' },
            { key: 'lossReason', label: 'Motivo Perda' },
            { key: 'tags', label: 'Etiquetas' },
            { key: 'notes', label: 'Observacoes' }
        ];
        const csv = Storage.exportCSV(clients, fields);
        this.downloadFile(csv, 'clientes-unidade-consult.csv', 'text/csv;charset=utf-8');
        App.toast('CSV exportado!', 'success');
    },

    importData(e) {
        const file = e.target.files[0];
        if (!file) return;

        const reader = new FileReader();
        reader.onload = (ev) => {
            try {
                if (file.name.endsWith('.json')) {
                    Storage.importAll(ev.target.result);
                    App.toast('Dados importados com sucesso! Recarregue a pagina.', 'success');
                    setTimeout(() => location.reload(), 1500);
                } else if (file.name.endsWith('.csv')) {
                    this.importCSV(ev.target.result);
                    App.toast('Clientes importados do CSV!', 'success');
                } else {
                    App.toast('Formato nao suportado. Use .json ou .csv', 'error');
                }
            } catch (err) {
                App.toast('Erro ao importar: ' + err.message, 'error');
            }
        };
        reader.readAsText(file);
        e.target.value = '';
    },

    importCSV(csvText) {
        const lines = csvText.split('\n').filter(l => l.trim());
        if (lines.length < 2) return;

        const headers = lines[0].replace('﻿', '').split(';').map(h => h.replace(/"/g, '').trim().toLowerCase());
        const fieldMap = {
            'nome': 'name', 'name': 'name',
            'e-mail': 'email', 'email': 'email',
            'telefone': 'phone', 'phone': 'phone', 'whatsapp': 'phone',
            'empresa': 'company', 'company': 'company',
            'cnpj/cpf': 'document', 'cnpj': 'document', 'cpf': 'document', 'document': 'document',
            'tipo': 'type', 'type': 'type',
            'status': 'status',
            'origem': 'origin', 'origin': 'origin',
            'processo': 'process', 'process': 'process',
            'observacoes': 'notes', 'notes': 'notes', 'obs': 'notes'
        };

        for (let i = 1; i < lines.length; i++) {
            const values = lines[i].split(';').map(v => v.replace(/^"|"$/g, '').trim());
            const client = { status: 'ativo', type: 'marca', tags: [], stage: 'protocolo' };

            headers.forEach((h, idx) => {
                const field = fieldMap[h];
                if (field && values[idx]) {
                    client[field] = values[idx];
                }
            });

            if (client.name) {
                client.lastContact = new Date().toISOString().split('T')[0];
                ClientStore.save(client);
            }
        }
    },

    downloadFile(content, filename, type) {
        const blob = new Blob([content], { type });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = filename;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
    }
};
