const BatchModule = {
    selectedClients: new Set(),

    openBatchModal() {
        const modal = document.getElementById('batchModal');
        this.selectedClients.clear();

        const clients = ClientStore.getAll().filter(c => c.status !== 'inativo');
        const templates = TemplateStore.getAll();

        document.getElementById('batchTemplate').innerHTML =
            templates.map(t => `<option value="${t.id}">${ClientsModule.escapeHtml(t.title)}</option>`).join('');

        const container = document.getElementById('batchClientsList');
        container.innerHTML = clients.map(c => `
            <label class="batch-client-item">
                <input type="checkbox" value="${c.id}" onchange="BatchModule.toggleClient('${c.id}', this.checked)">
                <span>${ClientsModule.escapeHtml(c.name)}</span>
                ${c.phone ? `<span class="batch-phone">${ClientsModule.escapeHtml(c.phone)}</span>` : '<span class="batch-phone" style="color:var(--danger)">Sem telefone</span>'}
            </label>
        `).join('');

        document.getElementById('batchCount').textContent = '0';
        modal.classList.remove('hidden');
    },

    toggleClient(id, checked) {
        if (checked) {
            this.selectedClients.add(id);
        } else {
            this.selectedClients.delete(id);
        }
        document.getElementById('batchCount').textContent = this.selectedClients.size;
    },

    selectAll() {
        const checkboxes = document.querySelectorAll('#batchClientsList input[type="checkbox"]');
        checkboxes.forEach(cb => {
            cb.checked = true;
            this.selectedClients.add(cb.value);
        });
        document.getElementById('batchCount').textContent = this.selectedClients.size;
    },

    selectNone() {
        const checkboxes = document.querySelectorAll('#batchClientsList input[type="checkbox"]');
        checkboxes.forEach(cb => { cb.checked = false; });
        this.selectedClients.clear();
        document.getElementById('batchCount').textContent = '0';
    },

    selectInactive(days) {
        this.selectNone();
        const checkboxes = document.querySelectorAll('#batchClientsList input[type="checkbox"]');
        checkboxes.forEach(cb => {
            const client = ClientStore.getById(cb.value);
            if (client && ClientsModule.daysSinceContact(client.lastContact) >= days) {
                cb.checked = true;
                this.selectedClients.add(cb.value);
            }
        });
        document.getElementById('batchCount').textContent = this.selectedClients.size;
    },

    generateMessages() {
        if (this.selectedClients.size === 0) {
            App.toast('Selecione pelo menos um cliente.', 'warning');
            return;
        }

        const templateId = document.getElementById('batchTemplate').value;
        const template = TemplateStore.getAll().find(t => t.id === templateId);
        if (!template) return;

        const results = [];
        this.selectedClients.forEach(clientId => {
            const client = ClientStore.getById(clientId);
            if (!client) return;

            let content = template.content;
            content = content.replace(/\{nome\}/g, client.name || '');
            content = content.replace(/\{empresa\}/g, client.company || '');
            content = content.replace(/\{processo\}/g, client.process || '');
            content = content.replace(/\{data\}/g, new Date().toLocaleDateString('pt-BR'));

            results.push({ client, content });
        });

        const resultContainer = document.getElementById('batchResults');
        resultContainer.innerHTML = results.map(r => {
            const phone = r.client.phone ? r.client.phone.replace(/\D/g, '') : '';
            const fullPhone = phone.length <= 11 ? '55' + phone : phone;
            const encoded = encodeURIComponent(r.content);

            return `<div class="batch-result-item">
                <div class="batch-result-header">
                    <strong>${ClientsModule.escapeHtml(r.client.name)}</strong>
                    <span>${ClientsModule.escapeHtml(r.client.phone || 'Sem telefone')}</span>
                </div>
                <div class="batch-result-preview">${ClientsModule.escapeHtml(r.content).substring(0, 120)}...</div>
                <div class="batch-result-actions">
                    <button class="btn btn-sm btn-secondary" onclick="BatchModule.copyOne(\`${r.content.replace(/`/g, '\\`').replace(/\\/g, '\\\\')}\`)">Copiar</button>
                    ${phone ? `<button class="btn btn-sm btn-success" onclick="window.open('https://wa.me/${fullPhone}?text=${encoded}', '_blank'); ClientStore.updateLastContact('${r.client.id}');">WhatsApp</button>` : ''}
                </div>
            </div>`;
        }).join('');

        document.getElementById('batchResultsSection').classList.remove('hidden');
    },

    copyOne(text) {
        navigator.clipboard.writeText(text).then(() => {
            App.toast('Mensagem copiada!', 'success');
        }).catch(() => App.toast('Erro ao copiar.', 'error'));
    },

    closeBatch() {
        document.getElementById('batchModal').classList.add('hidden');
        document.getElementById('batchResultsSection').classList.add('hidden');
    }
};
