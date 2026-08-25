const TemplatesModule = {
    init() {
        this.bindEvents();
        this.render();
    },

    bindEvents() {
        document.getElementById('btnAddTemplate').addEventListener('click', () => this.openForm());
        document.getElementById('closeTemplateModal').addEventListener('click', () => this.closeForm());
        document.getElementById('cancelTemplate').addEventListener('click', () => this.closeForm());
        document.getElementById('templateForm').addEventListener('submit', (e) => this.handleSubmit(e));
        document.getElementById('templateCategory').addEventListener('change', () => this.render());
        document.getElementById('closeTemplatePreview').addEventListener('click', () => this.closePreview());
        document.getElementById('copyMessage').addEventListener('click', () => this.copyMessage());
        document.getElementById('openWhatsApp').addEventListener('click', () => this.openWhatsApp());
        document.getElementById('previewClient').addEventListener('change', () => this.updatePreview());
    },

    render() {
        const filter = document.getElementById('templateCategory').value;
        let templates = TemplateStore.getAll();

        if (filter !== 'all') {
            templates = templates.filter(t => t.category === filter);
        }

        const container = document.getElementById('templatesList');
        if (templates.length === 0) {
            container.innerHTML = '<p class="empty-state">Nenhum modelo encontrado.</p>';
            return;
        }

        container.innerHTML = templates.map(t => `
            <div class="template-card">
                <div class="template-card-header">
                    <span class="template-card-title">${this.escapeHtml(t.title)}</span>
                    <span class="template-card-category">${this.categoryLabel(t.category)}</span>
                </div>
                <div class="template-card-body">${this.escapeHtml(t.content)}</div>
                <div class="template-card-actions">
                    <button class="btn btn-primary btn-sm" onclick="TemplatesModule.openPreview('${t.id}')">Usar</button>
                    <button class="btn btn-secondary btn-sm" onclick="TemplatesModule.openForm('${t.id}')">Editar</button>
                    <button class="btn btn-sm" style="color:var(--danger)" onclick="TemplatesModule.confirmDelete('${t.id}')">Excluir</button>
                </div>
            </div>
        `).join('');
    },

    openForm(id) {
        const modal = document.getElementById('templateModal');
        const title = document.getElementById('templateModalTitle');
        const form = document.getElementById('templateForm');
        form.reset();

        if (id) {
            const tpl = TemplateStore.getAll().find(t => t.id === id);
            if (!tpl) return;
            title.textContent = 'Editar Modelo';
            document.getElementById('templateId').value = tpl.id;
            document.getElementById('templateTitle').value = tpl.title || '';
            document.getElementById('templateCat').value = tpl.category || 'geral';
            document.getElementById('templateContent').value = tpl.content || '';
        } else {
            title.textContent = 'Novo Modelo de Mensagem';
            document.getElementById('templateId').value = '';
        }

        modal.classList.remove('hidden');
    },

    closeForm() {
        document.getElementById('templateModal').classList.add('hidden');
    },

    handleSubmit(e) {
        e.preventDefault();
        const id = document.getElementById('templateId').value;
        const template = {
            title: document.getElementById('templateTitle').value.trim(),
            category: document.getElementById('templateCat').value,
            content: document.getElementById('templateContent').value.trim()
        };

        if (id) template.id = id;

        TemplateStore.save(template);
        this.closeForm();
        this.render();
        App.toast(id ? 'Modelo atualizado!' : 'Modelo criado!', 'success');
    },

    confirmDelete(id) {
        if (confirm('Excluir este modelo de mensagem?')) {
            TemplateStore.delete(id);
            this.render();
            App.toast('Modelo excluido.', 'warning');
        }
    },

    openPreview(templateId) {
        const tpl = TemplateStore.getAll().find(t => t.id === templateId);
        if (!tpl) return;

        this.currentTemplate = tpl;
        this.populateClientSelect('previewClient');
        document.getElementById('previewContent').value = tpl.content;
        document.getElementById('templatePreviewModal').classList.remove('hidden');
    },

    openPreviewForClient(clientId) {
        const templates = TemplateStore.getAll();
        if (templates.length === 0) return;

        this.currentTemplate = templates[0];
        this.populateClientSelect('previewClient');
        document.getElementById('previewClient').value = clientId;
        this.updatePreview();
        document.getElementById('templatePreviewModal').classList.remove('hidden');

        App.navigate('templates');
    },

    closePreview() {
        document.getElementById('templatePreviewModal').classList.add('hidden');
    },

    updatePreview() {
        if (!this.currentTemplate) return;
        const clientId = document.getElementById('previewClient').value;
        let content = this.currentTemplate.content;

        if (clientId) {
            const client = ClientStore.getById(clientId);
            if (client) {
                content = content.replace(/\{nome\}/g, client.name || '');
                content = content.replace(/\{empresa\}/g, client.company || '');
                content = content.replace(/\{processo\}/g, client.process || '');
                content = content.replace(/\{data\}/g, new Date().toLocaleDateString('pt-BR'));
            }
        }

        document.getElementById('previewContent').value = content;
    },

    copyMessage() {
        const content = document.getElementById('previewContent').value;
        navigator.clipboard.writeText(content).then(() => {
            App.toast('Mensagem copiada!', 'success');

            const clientId = document.getElementById('previewClient').value;
            if (clientId) {
                ClientStore.updateLastContact(clientId);
                ClientsModule.render();
                DashboardModule.refresh();
            }
        }).catch(() => {
            const textarea = document.getElementById('previewContent');
            textarea.select();
            document.execCommand('copy');
            App.toast('Mensagem copiada!', 'success');
        });
    },

    openWhatsApp() {
        const clientId = document.getElementById('previewClient').value;
        const content = document.getElementById('previewContent').value;

        let phone = '';
        if (clientId) {
            const client = ClientStore.getById(clientId);
            if (client && client.phone) {
                phone = client.phone.replace(/\D/g, '');
                if (phone.length <= 11) phone = '55' + phone;
            }
        }

        const encoded = encodeURIComponent(content);
        const url = phone
            ? `https://wa.me/${phone}?text=${encoded}`
            : `https://wa.me/?text=${encoded}`;

        window.open(url, '_blank');

        if (clientId) {
            ClientStore.updateLastContact(clientId);
            ClientsModule.render();
            DashboardModule.refresh();
        }

        App.toast('WhatsApp aberto!', 'success');
    },

    populateClientSelect(selectId) {
        const select = document.getElementById(selectId);
        const clients = ClientStore.getAll().sort((a, b) => a.name.localeCompare(b.name));
        const currentVal = select.value;

        select.innerHTML = '<option value="">-- Selecione --</option>' +
            clients.map(c => `<option value="${c.id}">${this.escapeHtml(c.name)}${c.company ? ' (' + this.escapeHtml(c.company) + ')' : ''}</option>`).join('');

        if (currentVal) select.value = currentVal;
    },

    categoryLabel(cat) {
        const labels = {
            'boas-vindas': 'Boas-vindas',
            'atualizacao': 'Atualizacao',
            'prazo': 'Prazos',
            'cobranca': 'Cobranca',
            'follow-up': 'Follow-up',
            'certificado': 'Certificado',
            'oposicao': 'Oposicao',
            'prorrogacao': 'Prorrogacao',
            'geral': 'Geral'
        };
        return labels[cat] || cat;
    },

    escapeHtml(str) {
        const div = document.createElement('div');
        div.textContent = str;
        return div.innerHTML;
    }
};
