const AIModule = {
    getKey(provider) {
        return Storage.get('apikey_' + provider) || '';
    },

    setKey(provider, key) {
        Storage.set('apikey_' + provider, key);
    },

    hasKeys() {
        return !!(this.getKey('openai') || this.getKey('grok'));
    },

    getProvider() {
        if (this.getKey('openai')) return 'openai';
        if (this.getKey('grok')) return 'grok';
        return null;
    },

    async callAPI(messages, options = {}) {
        const provider = options.provider || this.getProvider();
        if (!provider) {
            throw new Error('Nenhuma API key configurada. Va em Configuracoes.');
        }

        const key = this.getKey(provider);
        if (!key) {
            throw new Error('API key nao encontrada para ' + provider);
        }

        const config = {
            openai: {
                url: 'https://api.openai.com/v1/chat/completions',
                model: options.model || 'gpt-4o-mini',
                headers: { 'Authorization': 'Bearer ' + key }
            },
            grok: {
                url: 'https://api.x.ai/v1/chat/completions',
                model: options.model || 'grok-3-mini',
                headers: { 'Authorization': 'Bearer ' + key }
            }
        };

        const cfg = config[provider];
        const body = {
            model: cfg.model,
            messages,
            max_tokens: options.maxTokens || 1500,
            temperature: options.temperature ?? 0.7
        };

        const response = await fetch(cfg.url, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                ...cfg.headers
            },
            body: JSON.stringify(body)
        });

        if (!response.ok) {
            const err = await response.text();
            if (response.status === 401) throw new Error('API key invalida. Verifique em Configuracoes.');
            if (response.status === 429) throw new Error('Limite de requisicoes excedido. Aguarde um momento.');
            throw new Error('Erro na API (' + response.status + '): ' + err.substring(0, 200));
        }

        const data = await response.json();
        return data.choices[0].message.content;
    },

    buildClientContext(clientId) {
        const client = ClientStore.getById(clientId);
        if (!client) return '';

        const days = ClientsModule.daysSinceContact(client.lastContact);
        const stageInfo = PIPELINE_STAGES.find(s => s.id === (client.stage || 'protocolo'));
        const interactions = InteractionStore.getByClient(clientId).slice(0, 10);
        const reminders = ReminderStore.getAll().filter(r => r.clientId === clientId && !r.completed);
        const financials = FinancialStore.getByClient(clientId).filter(f => f.status !== 'pago');

        let ctx = `DADOS DO CLIENTE:
- Nome: ${client.name}
- Empresa: ${client.company || 'Nao informada'}
- Telefone: ${client.phone || 'Nao informado'}
- Email: ${client.email || 'Nao informado'}
- Tipo de servico: ${ClientsModule.typeLabel(client.type)}
- Status: ${ClientsModule.statusLabel(client.status)}
- Numero do processo: ${client.process || 'Sem processo'}
- Etapa atual: ${stageInfo ? stageInfo.label : 'Nao definida'}
- Classes NICE: ${(client.classes || []).join(', ') || 'Nenhuma'}
- Ultimo contato: ${client.lastContact ? ClientsModule.formatDate(client.lastContact) + ' (' + days + ' dias atras)' : 'Sem registro'}
- Etiquetas: ${(client.tags || []).join(', ') || 'Nenhuma'}
- Observacoes: ${client.notes || 'Nenhuma'}`;

        if (client.status === 'perdido') {
            ctx += `\n- Motivo da perda: ${ClientsModule.lossReasonLabel(client.lossReason)}`;
            if (client.lossNotes) ctx += `\n- Detalhes da perda: ${client.lossNotes}`;
        }

        if (client.proposalValue) {
            ctx += `\n- Valor da proposta: R$ ${FinancialModule.formatCurrency(client.proposalValue)}`;
        }

        if (interactions.length > 0) {
            ctx += '\n\nULTIMAS INTERACOES:';
            interactions.forEach(i => {
                ctx += `\n- ${ClientsModule.formatDate(i.date)} (${InteractionsModule.typeLabel(i.type)}): ${i.description}`;
            });
        }

        if (reminders.length > 0) {
            ctx += '\n\nLEMBRETES PENDENTES:';
            reminders.forEach(r => {
                ctx += `\n- ${ClientsModule.formatDate(r.date)} [${RemindersModule.typeLabel(r.type)}]: ${r.message}`;
            });
        }

        if (financials.length > 0) {
            ctx += '\n\nVALORES PENDENTES:';
            financials.forEach(f => {
                ctx += `\n- R$ ${FinancialModule.formatCurrency(f.amount)} - ${f.description} - Venc: ${ClientsModule.formatDate(f.dueDate)}`;
            });
        }

        return ctx;
    },

    systemPrompt() {
        return `Voce e o assistente IA da UNIDADE CONSULT, um escritorio especializado em registro de marcas e patentes junto ao INPI (Instituto Nacional da Propriedade Industrial) no Brasil.

Voce ajuda a equipe do escritorio com:
- Resumos executivos de clientes
- Redacao de mensagens personalizadas para clientes
- Sugestoes de proximos passos no relacionamento
- Classificacao de classes NICE para registros de marca
- Analise de riscos e oportunidades
- Estrategias de follow-up e retencao

Responda sempre em portugues do Brasil. Seja direto, pratico e profissional. Use tom cordial mas objetivo.
Quando sugerir mensagens para enviar ao cliente, formate para WhatsApp (sem HTML, use *negrito* e _italico_ quando necessario).
Data de hoje: ${new Date().toLocaleDateString('pt-BR')}.`;
    },

    async askAboutClient(clientId, question) {
        const context = this.buildClientContext(clientId);
        const messages = [
            { role: 'system', content: this.systemPrompt() },
            { role: 'user', content: context + '\n\n---\n\nPERGUNTA DO ATENDENTE: ' + question }
        ];
        return await this.callAPI(messages);
    },

    async generateMessage(clientId, intent) {
        const context = this.buildClientContext(clientId);
        const messages = [
            { role: 'system', content: this.systemPrompt() },
            { role: 'user', content: context + '\n\n---\n\nGere uma mensagem de WhatsApp para este cliente com o seguinte objetivo: ' + intent + '\n\nA mensagem deve ser profissional, cordial, e pronta para enviar. Nao use HTML. Assine como UNIDADE CONSULT - Marcas e Patentes.' }
        ];
        return await this.callAPI(messages, { temperature: 0.8 });
    },

    async suggestNICE(businessDescription) {
        const messages = [
            { role: 'system', content: this.systemPrompt() + '\n\nVoce e especialista na Classificacao Internacional de Nice para registro de marcas. Conhece todas as 45 classes e suas especificacoes.' },
            { role: 'user', content: 'Com base na descricao do negocio abaixo, sugira as classes NICE mais adequadas para registro de marca. Para cada classe, explique brevemente por que e relevante.\n\nDESCRICAO DO NEGOCIO: ' + businessDescription }
        ];
        return await this.callAPI(messages, { temperature: 0.3 });
    },

    async summarizeClient(clientId) {
        const context = this.buildClientContext(clientId);
        const messages = [
            { role: 'system', content: this.systemPrompt() },
            { role: 'user', content: context + '\n\n---\n\nFaca um resumo executivo deste cliente em 3-5 pontos. Inclua: situacao atual, riscos, proximas acoes recomendadas, e oportunidades. Seja direto e pratico.' }
        ];
        return await this.callAPI(messages, { temperature: 0.4 });
    },

    openChat(clientId) {
        const client = ClientStore.getById(clientId);
        if (!client) return;

        if (!this.hasKeys()) {
            App.toast('Configure suas API keys em Configuracoes.', 'warning');
            App.navigate('settings');
            return;
        }

        document.getElementById('aiChatTitle').textContent = 'IA - ' + client.name;
        document.getElementById('aiChatClientId').value = clientId;
        document.getElementById('aiChatMessages').innerHTML = '';
        document.getElementById('aiChatInput').value = '';
        document.getElementById('aiChatModal').classList.remove('hidden');

        this.addBotMessage('Ola! Sou o assistente IA da UNIDADE CONSULT. Posso ajudar com:\n\n' +
            '• **Resumo** do cliente\n' +
            '• **Redigir mensagem** (cobranca, follow-up, atualizacao...)\n' +
            '• **Sugerir classes NICE** para registro\n' +
            '• **Proximos passos** recomendados\n' +
            '• Qualquer **pergunta** sobre este cliente\n\n' +
            'O que precisa?');
    },

    closeChat() {
        document.getElementById('aiChatModal').classList.add('hidden');
    },

    addBotMessage(text) {
        const container = document.getElementById('aiChatMessages');
        const div = document.createElement('div');
        div.className = 'ai-msg ai-bot';
        div.innerHTML = '<div class="ai-msg-content">' + this.formatMessage(text) + '</div>';
        container.appendChild(div);
        container.scrollTop = container.scrollHeight;
    },

    addUserMessage(text) {
        const container = document.getElementById('aiChatMessages');
        const div = document.createElement('div');
        div.className = 'ai-msg ai-user';
        div.innerHTML = '<div class="ai-msg-content">' + ClientsModule.escapeHtml(text) + '</div>';
        container.appendChild(div);
        container.scrollTop = container.scrollHeight;
    },

    addLoadingMessage() {
        const container = document.getElementById('aiChatMessages');
        const div = document.createElement('div');
        div.className = 'ai-msg ai-bot ai-loading';
        div.innerHTML = '<div class="ai-msg-content"><span class="ai-dots">Pensando</span></div>';
        container.appendChild(div);
        container.scrollTop = container.scrollHeight;
        return div;
    },

    formatMessage(text) {
        let html = ClientsModule.escapeHtml(text);
        html = html.replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>');
        html = html.replace(/\*(.+?)\*/g, '<strong>$1</strong>');
        html = html.replace(/\n/g, '<br>');
        return html;
    },

    async sendChat() {
        const input = document.getElementById('aiChatInput');
        const question = input.value.trim();
        if (!question) return;

        const clientId = document.getElementById('aiChatClientId').value;
        input.value = '';
        input.disabled = true;

        this.addUserMessage(question);
        const loading = this.addLoadingMessage();

        try {
            let response;
            const lower = question.toLowerCase();

            if (lower.includes('resum')) {
                response = await this.summarizeClient(clientId);
            } else if (lower.includes('mensagem') || lower.includes('redigir') || lower.includes('escrever') || lower.includes('whatsapp')) {
                response = await this.generateMessage(clientId, question);
            } else if (lower.includes('nice') || lower.includes('classe')) {
                const client = ClientStore.getById(clientId);
                const desc = client.company || client.notes || question;
                response = await this.suggestNICE(desc);
            } else {
                response = await this.askAboutClient(clientId, question);
            }

            loading.remove();
            this.addBotMessage(response);
        } catch (err) {
            loading.remove();
            this.addBotMessage('Erro: ' + err.message);
        }

        input.disabled = false;
        input.focus();
    },

    openNICEHelper() {
        if (!this.hasKeys()) {
            App.toast('Configure suas API keys em Configuracoes.', 'warning');
            App.navigate('settings');
            return;
        }

        document.getElementById('niceModal').classList.remove('hidden');
        document.getElementById('niceResult').innerHTML = '';
        document.getElementById('niceDesc').value = '';
    },

    closeNICE() {
        document.getElementById('niceModal').classList.add('hidden');
    },

    async searchNICE() {
        const desc = document.getElementById('niceDesc').value.trim();
        if (!desc) {
            App.toast('Descreva o negocio do cliente.', 'warning');
            return;
        }

        const resultEl = document.getElementById('niceResult');
        resultEl.innerHTML = '<p class="ai-thinking">Analisando classes NICE...</p>';

        try {
            const response = await this.suggestNICE(desc);
            resultEl.innerHTML = '<div class="ai-nice-result">' + this.formatMessage(response) + '</div>';
        } catch (err) {
            resultEl.innerHTML = '<p style="color:var(--danger)">Erro: ' + ClientsModule.escapeHtml(err.message) + '</p>';
        }
    },

    async searchNICEInline() {
        const desc = document.getElementById('niceDescInline').value.trim();
        if (!desc) {
            App.toast('Descreva o negocio do cliente.', 'warning');
            return;
        }

        if (!this.hasKeys()) {
            App.toast('Configure suas API keys acima primeiro.', 'warning');
            return;
        }

        const resultEl = document.getElementById('niceResultInline');
        resultEl.innerHTML = '<p class="ai-thinking">Analisando classes NICE...</p>';

        try {
            const response = await this.suggestNICE(desc);
            resultEl.innerHTML = '<div class="ai-nice-result">' + this.formatMessage(response) + '</div>';
        } catch (err) {
            resultEl.innerHTML = '<p style="color:var(--danger)">Erro: ' + ClientsModule.escapeHtml(err.message) + '</p>';
        }
    }
};

const SettingsModule = {
    init() {
        this.render();
    },

    render() {
        const openaiKey = AIModule.getKey('openai');
        const grokKey = AIModule.getKey('grok');

        document.getElementById('settingsOpenAI').value = openaiKey ? '••••••••' + openaiKey.slice(-8) : '';
        document.getElementById('settingsGrok').value = grokKey ? '••••••••' + grokKey.slice(-8) : '';

        document.getElementById('settingsOpenAI').placeholder = openaiKey ? 'Chave configurada' : 'sk-...';
        document.getElementById('settingsGrok').placeholder = grokKey ? 'Chave configurada' : 'xai-...';

        this.updateStatus();
    },

    updateStatus() {
        const el = document.getElementById('aiStatus');
        if (AIModule.hasKeys()) {
            const providers = [];
            if (AIModule.getKey('openai')) providers.push('OpenAI');
            if (AIModule.getKey('grok')) providers.push('Grok');
            el.innerHTML = '<span style="color:var(--success);font-weight:600">Conectado: ' + providers.join(' + ') + '</span>';
        } else {
            el.innerHTML = '<span style="color:var(--danger)">Nenhuma API configurada</span>';
        }
    },

    saveKey(provider) {
        const inputId = provider === 'openai' ? 'settingsOpenAI' : 'settingsGrok';
        const value = document.getElementById(inputId).value.trim();

        if (!value || value.startsWith('••••')) {
            App.toast('Digite a chave completa.', 'warning');
            return;
        }

        Storage.set('apikey_' + provider, value);
        App.toast('Chave ' + provider.toUpperCase() + ' salva com seguranca!', 'success');
        this.render();
    },

    removeKey(provider) {
        if (confirm('Remover a chave ' + provider.toUpperCase() + '?')) {
            Storage.set('apikey_' + provider, '');
            App.toast('Chave removida.', 'warning');
            this.render();
        }
    },

    async testKey(provider) {
        const key = AIModule.getKey(provider);
        if (!key) {
            App.toast('Configure a chave primeiro.', 'warning');
            return;
        }

        App.toast('Testando conexao...', 'info');

        try {
            const response = await AIModule.callAPI(
                [{ role: 'user', content: 'Responda apenas: OK' }],
                { provider, maxTokens: 10, temperature: 0 }
            );
            App.toast(provider.toUpperCase() + ' funcionando! Resposta: ' + response.substring(0, 30), 'success');
        } catch (err) {
            App.toast('Erro: ' + err.message, 'error');
        }
    }
};
