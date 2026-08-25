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
            clients.push(client);
        }
        Storage.set('clients', clients);
        return client;
    },

    delete(id) {
        const clients = this.getAll().filter(c => c.id !== id);
        Storage.set('clients', clients);
        ReminderStore.deleteByClient(id);
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
