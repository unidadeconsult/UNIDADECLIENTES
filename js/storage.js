const Storage = {
    get(key) {
        try {
            const data = localStorage.getItem('uc_' + key);
            return data ? JSON.parse(data) : null;
        } catch {
            return null;
        }
    },

    set(key, value) {
        try {
            localStorage.setItem('uc_' + key, JSON.stringify(value));
        } catch {
            // storage full or unavailable
        }
    },

    generateId() {
        return Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
    },

    exportAll() {
        const data = {
            clients: ClientStore.getAll(),
            reminders: ReminderStore.getAll(),
            templates: TemplateStore.getAll(),
            interactions: InteractionStore.getAll(),
            financials: FinancialStore.getAll(),
            proposals: ProposalStore.getAll(),
            tarefas: TarefaStore.getAll(),
            exportDate: new Date().toISOString()
        };
        return JSON.stringify(data, null, 2);
    },

    importAll(jsonStr) {
        const data = JSON.parse(jsonStr);
        if (data.clients) Storage.set('clients', data.clients);
        if (data.reminders) Storage.set('reminders', data.reminders);
        if (data.templates) Storage.set('templates', data.templates);
        if (data.interactions) Storage.set('interactions', data.interactions);
        if (data.financials) Storage.set('financials', data.financials);
        if (data.proposals) Storage.set('proposals', data.proposals);
        if (data.tarefas) Storage.set('tarefas', data.tarefas);
    },

    exportCSV(items, fields) {
        const header = fields.map(f => f.label).join(';');
        const rows = items.map(item =>
            fields.map(f => {
                let val = item[f.key] || '';
                if (Array.isArray(val)) val = val.join(', ');
                return '"' + String(val).replace(/"/g, '""') + '"';
            }).join(';')
        );
        return '﻿' + header + '\n' + rows.join('\n');
    }
};

const ClientStore = {
    getAll() {
        return Storage.get('clients') || [];
    },

    save(client) {
        const clients = this.getAll();
        const idx = clients.findIndex(c => c.id === client.id);
        if (idx >= 0) {
            clients[idx] = { ...clients[idx], ...client, updatedAt: new Date().toISOString() };
        } else {
            client.id = Storage.generateId();
            client.createdAt = new Date().toISOString();
            client.updatedAt = new Date().toISOString();
            if (!client.tags) client.tags = [];
            if (!client.stage) client.stage = 'protocolo';
            clients.push(client);
        }
        Storage.set('clients', clients);
        return client;
    },

    delete(id) {
        const clients = this.getAll().filter(c => c.id !== id);
        Storage.set('clients', clients);
        ReminderStore.deleteByClient(id);
        InteractionStore.deleteByClient(id);
        FinancialStore.deleteByClient(id);
        ProposalStore.deleteByClient(id);
    },

    getById(id) {
        return this.getAll().find(c => c.id === id) || null;
    },

    updateLastContact(id, date) {
        const clients = this.getAll();
        const idx = clients.findIndex(c => c.id === id);
        if (idx >= 0) {
            clients[idx].lastContact = date || new Date().toISOString().split('T')[0];
            clients[idx].updatedAt = new Date().toISOString();
            Storage.set('clients', clients);
        }
    },

    updateStage(id, stage) {
        const clients = this.getAll();
        const idx = clients.findIndex(c => c.id === id);
        if (idx >= 0) {
            clients[idx].stage = stage;
            clients[idx].updatedAt = new Date().toISOString();
            Storage.set('clients', clients);
        }
    },

    addTag(id, tag) {
        const clients = this.getAll();
        const idx = clients.findIndex(c => c.id === id);
        if (idx >= 0) {
            if (!clients[idx].tags) clients[idx].tags = [];
            if (!clients[idx].tags.includes(tag)) {
                clients[idx].tags.push(tag);
                Storage.set('clients', clients);
            }
        }
    },

    removeTag(id, tag) {
        const clients = this.getAll();
        const idx = clients.findIndex(c => c.id === id);
        if (idx >= 0 && clients[idx].tags) {
            clients[idx].tags = clients[idx].tags.filter(t => t !== tag);
            Storage.set('clients', clients);
        }
    },

    getAllTags() {
        const clients = this.getAll();
        const tags = new Set();
        clients.forEach(c => (c.tags || []).forEach(t => tags.add(t)));
        return Array.from(tags).sort();
    }
};

const TemplateStore = {
    getAll() {
        let templates = Storage.get('templates');
        if (!templates || templates.length === 0) {
            templates = DEFAULT_TEMPLATES;
            Storage.set('templates', templates);
        }
        return templates;
    },

    save(template) {
        const templates = this.getAll();
        const idx = templates.findIndex(t => t.id === template.id);
        if (idx >= 0) {
            templates[idx] = { ...templates[idx], ...template };
        } else {
            template.id = Storage.generateId();
            templates.push(template);
        }
        Storage.set('templates', templates);
        return template;
    },

    delete(id) {
        const templates = this.getAll().filter(t => t.id !== id);
        Storage.set('templates', templates);
    }
};

const ReminderStore = {
    getAll() {
        return Storage.get('reminders') || [];
    },

    save(reminder) {
        const reminders = this.getAll();
        const idx = reminders.findIndex(r => r.id === reminder.id);
        if (idx >= 0) {
            reminders[idx] = { ...reminders[idx], ...reminder };
        } else {
            reminder.id = Storage.generateId();
            reminder.completed = false;
            reminder.createdAt = new Date().toISOString();
            reminders.push(reminder);
        }
        Storage.set('reminders', reminders);
        return reminder;
    },

    delete(id) {
        const reminders = this.getAll().filter(r => r.id !== id);
        Storage.set('reminders', reminders);
    },

    deleteByClient(clientId) {
        const reminders = this.getAll().filter(r => r.clientId !== clientId);
        Storage.set('reminders', reminders);
    },

    toggleComplete(id) {
        const reminders = this.getAll();
        const idx = reminders.findIndex(r => r.id === id);
        if (idx >= 0) {
            reminders[idx].completed = !reminders[idx].completed;
            if (reminders[idx].completed) {
                reminders[idx].completedAt = new Date().toISOString();
            } else {
                delete reminders[idx].completedAt;
            }
            Storage.set('reminders', reminders);
        }
    }
};

const InteractionStore = {
    getAll() {
        return Storage.get('interactions') || [];
    },

    getByClient(clientId) {
        return this.getAll()
            .filter(i => i.clientId === clientId)
            .sort((a, b) => (b.date + b.createdAt).localeCompare(a.date + a.createdAt));
    },

    save(interaction) {
        const interactions = this.getAll();
        const idx = interactions.findIndex(i => i.id === interaction.id);
        if (idx >= 0) {
            interactions[idx] = { ...interactions[idx], ...interaction };
        } else {
            interaction.id = Storage.generateId();
            interaction.createdAt = new Date().toISOString();
            interactions.push(interaction);
        }
        Storage.set('interactions', interactions);
        ClientStore.updateLastContact(interaction.clientId, interaction.date);
        return interaction;
    },

    delete(id) {
        const interactions = this.getAll().filter(i => i.id !== id);
        Storage.set('interactions', interactions);
    },

    deleteByClient(clientId) {
        const interactions = this.getAll().filter(i => i.clientId !== clientId);
        Storage.set('interactions', interactions);
    }
};

const FinancialStore = {
    getAll() {
        return Storage.get('financials') || [];
    },

    getByClient(clientId) {
        return this.getAll()
            .filter(f => f.clientId === clientId)
            .sort((a, b) => a.dueDate.localeCompare(b.dueDate));
    },

    save(entry) {
        const entries = this.getAll();
        const idx = entries.findIndex(e => e.id === entry.id);
        if (idx >= 0) {
            entries[idx] = { ...entries[idx], ...entry };
        } else {
            entry.id = Storage.generateId();
            entry.createdAt = new Date().toISOString();
            entries.push(entry);
        }
        Storage.set('financials', entries);
        return entry;
    },

    delete(id) {
        const entries = this.getAll().filter(e => e.id !== id);
        Storage.set('financials', entries);
    },

    deleteByClient(clientId) {
        const entries = this.getAll().filter(e => e.clientId !== clientId);
        Storage.set('financials', entries);
    },

    markPaid(id) {
        const entries = this.getAll();
        const idx = entries.findIndex(e => e.id === id);
        if (idx >= 0) {
            entries[idx].status = 'pago';
            entries[idx].paidDate = new Date().toISOString().split('T')[0];
            Storage.set('financials', entries);
        }
    }
};

const PIPELINE_STAGES = [
    { id: 'prospeccao', label: 'Prospeccao', color: '#8e44ad', group: 'comercial' },
    { id: 'proposta', label: 'Proposta Enviada', color: '#2980b9', group: 'comercial' },
    { id: 'protocolo', label: 'Protocolo', color: '#3498db', group: 'operacao' },
    { id: 'exame-formal', label: 'Exame Formal', color: '#9b59b6', group: 'operacao' },
    { id: 'publicacao-rpi', label: 'Publicacao RPI', color: '#e67e22', group: 'operacao' },
    { id: 'oposicao', label: 'Oposicao (60 dias)', color: '#e74c3c', group: 'operacao' },
    { id: 'exame-merito', label: 'Exame de Merito', color: '#f39c12', group: 'operacao' },
    { id: 'deferido', label: 'Deferido', color: '#27ae60', group: 'operacao' },
    { id: 'indeferido', label: 'Indeferido', color: '#95a5a6', group: 'operacao' },
    { id: 'registrado', label: 'Registrado', color: '#2ecc71', group: 'pos-registro' },
    { id: 'monitoramento', label: 'Monitoramento', color: '#16a085', group: 'pos-registro' },
    { id: 'prorrogacao-pendente', label: 'Prorrogacao Pendente', color: '#d35400', group: 'pos-registro' }
];

const INPI_AUTO_REMINDERS = [
    { stage: 'protocolo', offsetDays: 30, type: 'prazo', message: 'Verificar andamento do exame formal do processo {processo}' },
    { stage: 'publicacao-rpi', offsetDays: 0, type: 'prazo', message: 'Inicio do prazo de oposicao (60 dias) - processo {processo}' },
    { stage: 'publicacao-rpi', offsetDays: 55, type: 'prazo', message: 'ATENCAO: Prazo de oposicao encerra em 5 dias - processo {processo}' },
    { stage: 'deferido', offsetDays: 0, type: 'pagamento', message: 'Providenciar pagamento da retribuicao de concessao - processo {processo}' },
    { stage: 'deferido', offsetDays: 50, type: 'prazo', message: 'URGENTE: Prazo de pagamento da concessao encerra em 10 dias - processo {processo}' },
    { stage: 'registrado', offsetDays: 0, type: 'follow-up', message: 'Marca registrada - avaliar oportunidades de novas classes e monitoramento - processo {processo}' },
    { stage: 'registrado', offsetDays: 3285, type: 'prorrogacao', message: 'Marca completa 9 anos - iniciar processo de prorrogacao - processo {processo}' },
    { stage: 'registrado', offsetDays: 3600, type: 'prorrogacao', message: 'URGENTE: Ultimo ano para prorrogacao da marca - processo {processo}' },
    { stage: 'monitoramento', offsetDays: 90, type: 'follow-up', message: 'Revisao trimestral de monitoramento da marca - processo {processo}' },
    { stage: 'prorrogacao-pendente', offsetDays: 30, type: 'prazo', message: 'Prorrogacao pendente ha 30 dias - verificar urgencia - processo {processo}' }
];

const ProposalStore = {
    getAll() {
        return Storage.get('proposals') || [];
    },
    getByClient(clientId) {
        return this.getAll()
            .filter(p => p.clientId === clientId)
            .sort((a, b) => (b.date || '').localeCompare(a.date || ''));
    },
    save(proposal) {
        const proposals = this.getAll();
        const idx = proposals.findIndex(p => p.id === proposal.id);
        if (idx >= 0) {
            proposals[idx] = { ...proposals[idx], ...proposal, updatedAt: new Date().toISOString() };
        } else {
            proposal.id = Storage.generateId();
            proposal.createdAt = new Date().toISOString();
            proposals.push(proposal);
        }
        Storage.set('proposals', proposals);
        return proposal;
    },
    delete(id) {
        Storage.set('proposals', this.getAll().filter(p => p.id !== id));
    },
    deleteByClient(clientId) {
        Storage.set('proposals', this.getAll().filter(p => p.clientId !== clientId));
    }
};

const DOCUMENT_CHECKLIST = [
    { id: 'procuracao', label: 'Procuracao' },
    { id: 'comprovantes', label: 'Comprovantes (endereco / identidade)' },
    { id: 'logomarcas', label: 'Logomarcas / Artes' },
    { id: 'cnpj', label: 'CNPJ / Contrato Social' },
    { id: 'contrato', label: 'Contrato de Servico' }
];

const LOSS_REASONS = [
    { id: 'preco', label: 'Preco' },
    { id: 'desistiu', label: 'Desistiu' },
    { id: 'concorrente', label: 'Registrou com concorrente' },
    { id: 'nao-respondeu', label: 'Nao respondeu' },
    { id: 'desnecessario', label: 'Achou desnecessario' },
    { id: 'sem-orcamento', label: 'Sem orcamento' },
    { id: 'futuro', label: 'Vai decidir futuramente' },
    { id: 'outro', label: 'Outro' }
];

const CLIENT_ORIGINS = [
    { id: 'instagram', label: 'Instagram' },
    { id: 'google', label: 'Google' },
    { id: 'indicacao', label: 'Indicacao' },
    { id: 'site', label: 'Site' },
    { id: 'whatsapp', label: 'WhatsApp' },
    { id: 'parceiro', label: 'Parceiro' },
    { id: 'outbound', label: 'Outbound' },
    { id: 'cliente-antigo', label: 'Cliente antigo' },
    { id: 'outro', label: 'Outro' }
];
