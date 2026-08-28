const AutomationModule = {
    rules: [
        {
            id: 'prospect-no-response-3d',
            label: 'Prospect sem resposta ha 3 dias',
            check(client) {
                if (client.status !== 'prospecto') return false;
                return ClientsModule.daysSinceContact(client.lastContact) >= 3 &&
                       ClientsModule.daysSinceContact(client.lastContact) < 7;
            },
            action(client) {
                return {
                    type: 'follow-up',
                    message: 'Prospect sem resposta ha 3+ dias - fazer follow-up com ' + client.name
                };
            }
        },
        {
            id: 'proposal-no-response-7d',
            label: 'Proposta enviada sem resposta ha 7 dias',
            check(client) {
                if (client.stage !== 'proposta') return false;
                return ClientsModule.daysSinceContact(client.lastContact) >= 7;
            },
            action(client) {
                return {
                    type: 'follow-up',
                    message: 'Proposta enviada ha 7+ dias sem resposta - retomar contato com ' + client.name
                };
            }
        },
        {
            id: 'no-contact-30d',
            label: 'Cliente ativo sem contato ha 30 dias',
            check(client) {
                if (client.status !== 'ativo') return false;
                return ClientsModule.daysSinceContact(client.lastContact) >= 30 &&
                       ClientsModule.daysSinceContact(client.lastContact) < 45;
            },
            action(client) {
                return {
                    type: 'follow-up',
                    message: 'Cliente ativo sem contato ha 30+ dias - agendar contato com ' + client.name
                };
            }
        },
        {
            id: 'payment-overdue-3d',
            label: 'Pagamento atrasado ha 3 dias',
            check(client) {
                const today = new Date().toISOString().split('T')[0];
                const financials = FinancialStore.getByClient(client.id);
                return financials.some(f => {
                    if (f.status === 'pago') return false;
                    const diff = Math.floor((new Date(today) - new Date(f.dueDate)) / 86400000);
                    return diff >= 3 && diff < 7;
                });
            },
            action(client) {
                return {
                    type: 'pagamento',
                    message: 'Pagamento atrasado ha 3+ dias - enviar lembrete de cobranca para ' + client.name
                };
            }
        },
        {
            id: 'registered-upsell',
            label: 'Marca registrada - oportunidade de novas classes',
            check(client) {
                if (client.status !== 'ativo') return false;
                if (client.stage !== 'registrado' && client.stage !== 'monitoramento') return false;
                if (!client.classes || client.classes.length === 0) return false;
                return client.classes.length < 3;
            },
            action(client) {
                return {
                    type: 'follow-up',
                    message: 'Oportunidade: ' + client.name + ' tem marca registrada com ' +
                             client.classes.length + ' classe(s) - avaliar protecao em classes adicionais'
                };
            }
        }
    ],

    run() {
        const today = new Date().toISOString().split('T')[0];
        const lastRun = Storage.get('automation_last_run');
        if (lastRun === today) return;

        const clients = ClientStore.getAll().filter(c => c.status !== 'inativo' && c.status !== 'perdido');
        const existingReminders = ReminderStore.getAll().filter(r => !r.completed);
        let created = 0;

        clients.forEach(client => {
            this.rules.forEach(rule => {
                if (!rule.check(client)) return;

                const action = rule.action(client);
                const alreadyExists = existingReminders.some(r =>
                    r.clientId === client.id &&
                    r.type === action.type &&
                    r.message === action.message
                );

                if (!alreadyExists) {
                    ReminderStore.save({
                        clientId: client.id,
                        date: today,
                        type: action.type,
                        message: action.message,
                        automated: true
                    });
                    created++;
                }
            });
        });

        Storage.set('automation_last_run', today);
        if (created > 0) {
            App.toast(created + ' lembrete(s) automatico(s) criado(s)!', 'info');
        }
    }
};

const LeadScoringModule = {
    weights: {
        origin: {
            indicacao: 30,
            'cliente-antigo': 25,
            parceiro: 20,
            site: 15,
            google: 12,
            instagram: 10,
            whatsapp: 10,
            outbound: 5,
            outro: 5
        },
        responseTime: [
            { maxDays: 3, points: 25 },
            { maxDays: 7, points: 15 },
            { maxDays: 14, points: 8 },
            { maxDays: 30, points: 3 }
        ],
        proposalValue: [
            { min: 3000, points: 25 },
            { min: 2000, points: 20 },
            { min: 1000, points: 15 },
            { min: 500, points: 8 }
        ],
        classesCount: [
            { min: 3, points: 20 },
            { min: 2, points: 15 },
            { min: 1, points: 10 }
        ]
    },

    score(client) {
        let total = 0;
        const breakdown = {};

        const originPoints = this.weights.origin[client.origin] || 5;
        total += originPoints;
        breakdown.origin = originPoints;

        const days = ClientsModule.daysSinceContact(client.lastContact);
        let responsePoints = 0;
        for (const tier of this.weights.responseTime) {
            if (days <= tier.maxDays) { responsePoints = tier.points; break; }
        }
        total += responsePoints;
        breakdown.response = responsePoints;

        const value = client.proposalValue || 0;
        let valuePoints = 0;
        for (const tier of this.weights.proposalValue) {
            if (value >= tier.min) { valuePoints = tier.points; break; }
        }
        total += valuePoints;
        breakdown.value = valuePoints;

        const classCount = (client.classes || []).length;
        let classPoints = 0;
        for (const tier of this.weights.classesCount) {
            if (classCount >= tier.min) { classPoints = tier.points; break; }
        }
        total += classPoints;
        breakdown.classes = classPoints;

        const autoTotal = total;
        const hasOverride = client.scoreOverride != null && client.scoreOverride !== '';
        if (hasOverride) {
            total = parseInt(client.scoreOverride) || total;
        }

        return { total, autoTotal, breakdown, label: this.label(total), hasOverride };
    },

    editScore(clientId) {
        const client = ClientStore.getById(clientId);
        if (!client) return;

        const current = this.score(client);
        const input = prompt(
            `Editar pontuacao de "${client.name}"\n\n` +
            `Pontuacao automatica: ${current.autoTotal} pts\n` +
            `  Origem: ${current.breakdown.origin} | Resposta: ${current.breakdown.response} | Valor: ${current.breakdown.value} | Classes: ${current.breakdown.classes}\n\n` +
            (current.hasOverride ? `Pontuacao manual atual: ${current.total} pts\n\n` : '') +
            `Digite a nova pontuacao (0-100) ou deixe vazio para usar automatica:`,
            current.hasOverride ? String(current.total) : ''
        );

        if (input === null) return;

        const trimmed = input.trim();
        if (trimmed === '') {
            delete client.scoreOverride;
            ClientStore.save(client);
            App.toast(`Pontuacao de "${client.name}" voltou para automatica (${current.autoTotal} pts)`, 'info');
        } else {
            const val = parseInt(trimmed);
            if (isNaN(val) || val < 0 || val > 100) {
                App.toast('Pontuacao invalida. Use um valor entre 0 e 100.', 'warning');
                return;
            }
            client.scoreOverride = val;
            ClientStore.save(client);
            App.toast(`Pontuacao de "${client.name}" alterada para ${val} pts`, 'success');
        }

        DashboardModule.refresh();
        if (document.getElementById('clientDetailModal') && !document.getElementById('clientDetailModal').classList.contains('hidden')) {
            ClientsModule.openDetail(clientId);
        }
    },

    label(score) {
        if (score >= 60) return { text: 'Quente', class: 'hot', icon: '\u{1F525}' };
        if (score >= 35) return { text: 'Morno', class: 'warm', icon: '\u{1F321}\u{FE0F}' };
        return { text: 'Frio', class: 'cold', icon: '\u{2744}\u{FE0F}' };
    },

    getHotLeads(limit) {
        return ClientStore.getAll()
            .filter(c => c.status === 'prospecto' || (c.status === 'ativo' && (c.stage === 'prospeccao' || c.stage === 'proposta')))
            .map(c => ({ client: c, score: this.score(c) }))
            .sort((a, b) => b.score.total - a.score.total)
            .slice(0, limit || 10);
    }
};

const INPIDeadlineCalculator = {
    deadlines: [
        { stage: 'publicacao-rpi', field: 'rpiDate', offsets: [
            { days: 0, label: 'Publicacao na RPI', type: 'prazo' },
            { days: 60, label: 'Fim do prazo de oposicao', type: 'prazo' },
            { days: 55, label: 'ATENCAO: 5 dias para fim da oposicao', type: 'prazo' }
        ]},
        { stage: 'deferido', field: 'grantDate', offsets: [
            { days: 0, label: 'Deferimento do pedido', type: 'prazo' },
            { days: 60, label: 'Prazo para pagamento da concessao', type: 'pagamento' },
            { days: 50, label: 'URGENTE: 10 dias para pagar concessao', type: 'pagamento' }
        ]},
        { stage: 'registrado', field: 'registrationDate', offsets: [
            { days: 0, label: 'Registro concedido', type: 'follow-up' },
            { days: 3285, label: 'Marca completa 9 anos - iniciar prorrogacao', type: 'prorrogacao' },
            { days: 3600, label: 'URGENTE: Ultimo ano para prorrogacao', type: 'prorrogacao' },
            { days: 3650, label: 'CRITICO: Prorrogacao vence em 15 dias', type: 'prorrogacao' }
        ]}
    ],

    calculateForClient(client) {
        const results = [];
        const today = new Date();
        const todayStr = today.toISOString().split('T')[0];

        this.deadlines.forEach(group => {
            const baseDate = client[group.field];
            if (!baseDate) return;

            group.offsets.forEach(offset => {
                const deadlineDate = new Date(baseDate);
                deadlineDate.setDate(deadlineDate.getDate() + offset.days);
                const deadlineStr = deadlineDate.toISOString().split('T')[0];
                const daysRemaining = Math.floor((deadlineDate - today) / 86400000);

                results.push({
                    date: deadlineStr,
                    label: offset.label,
                    type: offset.type,
                    daysRemaining,
                    overdue: daysRemaining < 0,
                    soon: daysRemaining >= 0 && daysRemaining <= 7,
                    process: client.process || ''
                });
            });
        });

        return results.sort((a, b) => a.date.localeCompare(b.date));
    },

    createRemindersFromDate(client, stage, dateStr) {
        const group = this.deadlines.find(d => d.stage === stage);
        if (!group || !dateStr) return 0;

        const existingReminders = ReminderStore.getAll().filter(r =>
            r.clientId === client.id && !r.completed
        );
        let created = 0;

        group.offsets.forEach(offset => {
            const deadlineDate = new Date(dateStr);
            deadlineDate.setDate(deadlineDate.getDate() + offset.days);
            const deadlineDateStr = deadlineDate.toISOString().split('T')[0];

            if (deadlineDateStr < new Date().toISOString().split('T')[0]) return;

            const message = offset.label + ' - processo ' + (client.process || '');
            const alreadyExists = existingReminders.some(r =>
                r.message === message && r.date === deadlineDateStr
            );

            if (!alreadyExists) {
                ReminderStore.save({
                    clientId: client.id,
                    date: deadlineDateStr,
                    type: offset.type,
                    message
                });
                created++;
            }
        });

        return created;
    },

    renderForClient(clientId) {
        const client = ClientStore.getById(clientId);
        if (!client) return '';

        const deadlines = this.calculateForClient(client);
        if (deadlines.length === 0) return '';

        return deadlines.map(d => {
            const cls = d.overdue ? 'overdue' : d.soon ? 'soon' : '';
            const countdown = d.overdue
                ? '<span style="color:var(--danger)">' + Math.abs(d.daysRemaining) + 'd atrasado</span>'
                : d.daysRemaining === 0
                    ? '<span style="color:var(--warning)">HOJE</span>'
                    : '<span>' + d.daysRemaining + 'd</span>';

            return '<div class="deadline-item ' + cls + '">' +
                '<span class="deadline-date">' + ClientsModule.formatDate(d.date) + '</span>' +
                '<span class="deadline-desc">' + ClientsModule.escapeHtml(d.label) + '</span>' +
                '<span class="deadline-countdown">' + countdown + '</span>' +
                '</div>';
        }).join('');
    }
};

const DocumentValidator = {
    validateCPF(cpf) {
        cpf = cpf.replace(/\D/g, '');
        if (cpf.length !== 11) return false;
        if (/^(\d)\1{10}$/.test(cpf)) return false;

        let sum = 0;
        for (let i = 0; i < 9; i++) sum += parseInt(cpf.charAt(i)) * (10 - i);
        let remainder = (sum * 10) % 11;
        if (remainder === 10) remainder = 0;
        if (remainder !== parseInt(cpf.charAt(9))) return false;

        sum = 0;
        for (let i = 0; i < 10; i++) sum += parseInt(cpf.charAt(i)) * (11 - i);
        remainder = (sum * 10) % 11;
        if (remainder === 10) remainder = 0;
        return remainder === parseInt(cpf.charAt(10));
    },

    validateCNPJ(cnpj) {
        cnpj = cnpj.replace(/\D/g, '');
        if (cnpj.length !== 14) return false;
        if (/^(\d)\1{13}$/.test(cnpj)) return false;

        const weights1 = [5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2];
        const weights2 = [6, 5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2];

        let sum = 0;
        for (let i = 0; i < 12; i++) sum += parseInt(cnpj.charAt(i)) * weights1[i];
        let remainder = sum % 11;
        const digit1 = remainder < 2 ? 0 : 11 - remainder;
        if (parseInt(cnpj.charAt(12)) !== digit1) return false;

        sum = 0;
        for (let i = 0; i < 13; i++) sum += parseInt(cnpj.charAt(i)) * weights2[i];
        remainder = sum % 11;
        const digit2 = remainder < 2 ? 0 : 11 - remainder;
        return parseInt(cnpj.charAt(13)) === digit2;
    },

    validate(doc) {
        if (!doc) return { valid: false, type: null, message: '' };
        const digits = doc.replace(/\D/g, '');

        if (digits.length === 11) {
            const valid = this.validateCPF(digits);
            return { valid, type: 'CPF', message: valid ? 'CPF valido' : 'CPF invalido' };
        }
        if (digits.length === 14) {
            const valid = this.validateCNPJ(digits);
            return { valid, type: 'CNPJ', message: valid ? 'CNPJ valido' : 'CNPJ invalido' };
        }

        return { valid: false, type: null, message: 'Formato invalido (use CPF ou CNPJ)' };
    },

    formatDocument(doc) {
        const digits = doc.replace(/\D/g, '');
        if (digits.length === 11) {
            return digits.replace(/(\d{3})(\d{3})(\d{3})(\d{2})/, '$1.$2.$3-$4');
        }
        if (digits.length === 14) {
            return digits.replace(/(\d{2})(\d{3})(\d{3})(\d{4})(\d{2})/, '$1.$2.$3/$4-$5');
        }
        return doc;
    },

    bindValidation(inputId) {
        const input = document.getElementById(inputId);
        if (!input) return;

        let msgEl = input.parentElement.querySelector('.validation-msg');
        if (!msgEl) {
            msgEl = document.createElement('div');
            msgEl.className = 'validation-msg';
            input.parentElement.appendChild(msgEl);
        }

        input.addEventListener('blur', () => {
            const value = input.value.trim();
            if (!value) {
                input.classList.remove('validation-ok', 'validation-error');
                msgEl.textContent = '';
                return;
            }

            const result = this.validate(value);
            input.classList.toggle('validation-ok', result.valid);
            input.classList.toggle('validation-error', !result.valid);
            msgEl.className = 'validation-msg ' + (result.valid ? 'ok' : 'error');
            msgEl.textContent = result.message;

            if (result.valid) {
                input.value = this.formatDocument(value);
            }
        });
    }
};

const PDFReportModule = {
    generateClientReport(clientId) {
        const client = ClientStore.getById(clientId);
        if (!client) return;

        const stageInfo = PIPELINE_STAGES.find(s => s.id === (client.stage || 'protocolo'));
        const interactions = InteractionStore.getByClient(clientId).slice(0, 20);
        const reminders = ReminderStore.getAll().filter(r => r.clientId === clientId && !r.completed);
        const financials = FinancialStore.getByClient(clientId);

        const win = window.open('', '_blank');
        win.document.write('<!DOCTYPE html><html><head><meta charset="UTF-8"><title>Relatorio - ' +
            client.name + '</title>' +
            '<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=DM+Sans:wght@300;400;500;600;700&display=swap">' +
            '<style>' +
            'body{font-family:"DM Sans",sans-serif;color:#2c3e50;margin:0;padding:20px;background:#f5f6fa}' +
            '.pdf-preview{background:white;padding:40px;max-width:800px;margin:0 auto;box-shadow:0 2px 20px rgba(0,0,0,0.1)}' +
            '.pdf-header{text-align:center;border-bottom:2px solid #1a3a5c;padding-bottom:16px;margin-bottom:24px}' +
            '.pdf-header h1{font-size:24px;color:#1a3a5c;letter-spacing:3px;margin:0}' +
            '.pdf-subtitle{color:#d4a843;font-size:14px;letter-spacing:5px}' +
            '.pdf-date{color:#7f8c9b;font-size:12px;margin-top:8px}' +
            '.pdf-section{margin-bottom:24px}' +
            '.pdf-section h3{color:#1a3a5c;border-bottom:1px solid #e1e5eb;padding-bottom:4px;margin:0 0 12px}' +
            '.pdf-grid{display:grid;grid-template-columns:1fr 1fr;gap:8px 24px}' +
            '.pdf-field label{font-size:11px;color:#7f8c9b;text-transform:uppercase;letter-spacing:0.5px}' +
            '.pdf-field p{margin:2px 0 8px;font-size:14px}' +
            '.pdf-table{width:100%;border-collapse:collapse;font-size:13px}' +
            '.pdf-table th,.pdf-table td{padding:6px 8px;text-align:left;border-bottom:1px solid #e1e5eb}' +
            '.pdf-table th{background:#f5f6fa;font-weight:600}' +
            '.stage-badge{display:inline-block;padding:2px 10px;border-radius:12px;font-size:12px;font-weight:600;color:white}' +
            '.btn-print{display:block;margin:20px auto;padding:10px 30px;background:#1a3a5c;color:white;border:none;border-radius:8px;font-size:14px;cursor:pointer;font-family:inherit}' +
            '@media print{.btn-print{display:none!important}.pdf-preview{box-shadow:none;padding:20px}body{background:white;padding:0}}' +
            '</style></head><body>');

        win.document.write('<div class="pdf-preview">');
        win.document.write('<div class="pdf-header"><h1>UNIDADE CONSULT</h1>' +
            '<div class="pdf-subtitle">MARCAS E PATENTES</div>' +
            '<div class="pdf-date">Relatorio gerado em ' + new Date().toLocaleDateString('pt-BR') + '</div></div>');

        win.document.write('<div class="pdf-section"><h3>Dados do Cliente</h3><div class="pdf-grid">');
        const fields = [
            ['Nome', client.name],
            ['Empresa', client.company || '-'],
            ['Telefone', client.phone || '-'],
            ['E-mail', client.email || '-'],
            ['CNPJ/CPF', client.document || '-'],
            ['Origem', ClientsModule.originLabel(client.origin)],
            ['Tipo', ClientsModule.typeLabel(client.type)],
            ['Status', ClientsModule.statusLabel(client.status)]
        ];
        fields.forEach(([label, value]) => {
            win.document.write('<div class="pdf-field"><label>' + label + '</label><p>' +
                ClientsModule.escapeHtml(value) + '</p></div>');
        });
        win.document.write('</div></div>');

        if (client.process) {
            win.document.write('<div class="pdf-section"><h3>Processo</h3><div class="pdf-grid">' +
                '<div class="pdf-field"><label>Numero</label><p>' + ClientsModule.escapeHtml(client.process) + '</p></div>' +
                '<div class="pdf-field"><label>Etapa Atual</label><p><span class="stage-badge" style="background:' +
                (stageInfo ? stageInfo.color : '#999') + '">' + (stageInfo ? stageInfo.label : '-') + '</span></p></div>' +
                '<div class="pdf-field"><label>Classes NICE</label><p>' +
                ((client.classes || []).join(', ') || '-') + '</p></div>' +
                '<div class="pdf-field"><label>Valor Proposta</label><p>' +
                (client.proposalValue ? 'R$ ' + FinancialModule.formatCurrency(client.proposalValue) : '-') + '</p></div>' +
                '</div></div>');
        }

        if (interactions.length > 0) {
            win.document.write('<div class="pdf-section"><h3>Historico de Interacoes</h3>' +
                '<table class="pdf-table"><thead><tr><th>Data</th><th>Tipo</th><th>Descricao</th></tr></thead><tbody>');
            interactions.forEach(i => {
                win.document.write('<tr><td>' + ClientsModule.formatDate(i.date) + '</td>' +
                    '<td>' + InteractionsModule.typeLabel(i.type) + '</td>' +
                    '<td>' + ClientsModule.escapeHtml(i.description) + '</td></tr>');
            });
            win.document.write('</tbody></table></div>');
        }

        if (reminders.length > 0) {
            win.document.write('<div class="pdf-section"><h3>Proximos Passos</h3>' +
                '<table class="pdf-table"><thead><tr><th>Data</th><th>Tipo</th><th>Descricao</th></tr></thead><tbody>');
            reminders.forEach(r => {
                win.document.write('<tr><td>' + ClientsModule.formatDate(r.date) + '</td>' +
                    '<td>' + RemindersModule.typeLabel(r.type) + '</td>' +
                    '<td>' + ClientsModule.escapeHtml(r.message) + '</td></tr>');
            });
            win.document.write('</tbody></table></div>');
        }

        const pendingFin = financials.filter(f => f.status !== 'pago');
        const paidFin = financials.filter(f => f.status === 'pago');
        if (financials.length > 0) {
            win.document.write('<div class="pdf-section"><h3>Financeiro</h3>' +
                '<table class="pdf-table"><thead><tr><th>Descricao</th><th>Valor</th><th>Vencimento</th><th>Status</th></tr></thead><tbody>');
            financials.forEach(f => {
                const st = f.status === 'pago' ? 'Pago' : f.dueDate < new Date().toISOString().split('T')[0] ? 'Atrasado' : 'Pendente';
                win.document.write('<tr><td>' + ClientsModule.escapeHtml(f.description) + '</td>' +
                    '<td>R$ ' + FinancialModule.formatCurrency(f.amount) + '</td>' +
                    '<td>' + ClientsModule.formatDate(f.dueDate) + '</td>' +
                    '<td>' + st + '</td></tr>');
            });
            win.document.write('</tbody></table></div>');
        }

        if (client.notes) {
            win.document.write('<div class="pdf-section"><h3>Observacoes</h3><p>' +
                ClientsModule.escapeHtml(client.notes) + '</p></div>');
        }

        win.document.write('<div style="text-align:center;margin-top:32px;padding-top:16px;border-top:1px solid #e1e5eb;font-size:11px;color:#7f8c9b">' +
            'UNIDADE CONSULT - Marcas e Patentes<br>Documento confidencial</div>');

        win.document.write('</div>');
        win.document.write('<button class="btn-print" onclick="window.print()">Imprimir / Salvar PDF</button>');
        win.document.write('</body></html>');
        win.document.close();
    }
};
