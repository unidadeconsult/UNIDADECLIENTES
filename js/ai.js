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
            max_tokens: options.maxTokens || 2500,
            temperature: options.temperature ?? 0.7
        };

        let response;
        try {
            response = await fetch(cfg.url, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    ...cfg.headers
                },
                body: JSON.stringify(body)
            });
        } catch (networkErr) {
            throw new Error('Erro de conexao. A IA precisa acessar APIs externas, o que nao funciona no modo embutido. Va em Configuracoes e clique "Baixar UNIDADE CONSULT" para usar no navegador.');
        }

        if (!response.ok) {
            const err = await response.text();
            if (response.status === 401) throw new Error('API key invalida. Verifique em Configuracoes.');
            if (response.status === 429) throw new Error('Limite de requisicoes excedido. Aguarde um momento.');
            if (response.status === 403) throw new Error('Acesso negado pela API. Verifique se sua chave tem permissao para o modelo ' + cfg.model + '.');
            throw new Error('Erro na API (' + response.status + '): ' + err.substring(0, 200));
        }

        let data;
        try {
            data = await response.json();
        } catch (parseErr) {
            throw new Error('Resposta invalida da API. Tente novamente.');
        }

        if (!data.choices || !data.choices[0] || !data.choices[0].message) {
            throw new Error('Resposta inesperada da API. Tente novamente.');
        }

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
- Origem: ${ClientsModule.originLabel(client.origin)}
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

        const score = LeadScoringModule.score(client);
        ctx += `\n- Lead Score: ${score.total} pontos (${score.label.text})`;
        ctx += `\n  Breakdown: Origem=${score.breakdown.origin}, Tempo resposta=${score.breakdown.response}, Valor=${score.breakdown.value}, Classes=${score.breakdown.classes}`;

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

    buildPortfolioContext() {
        const clients = ClientStore.getAll();
        const reminders = ReminderStore.getAll();
        const financials = FinancialStore.getAll();
        const today = new Date().toISOString().split('T')[0];

        const active = clients.filter(c => c.status !== 'inativo');
        const prospects = clients.filter(c => c.status === 'prospecto');
        const lost = clients.filter(c => c.status === 'perdido');
        const activeProcesses = clients.filter(c => c.status !== 'inativo' && c.status !== 'perdido' && c.process);

        let ctx = `RESUMO DA CARTEIRA (${new Date().toLocaleDateString('pt-BR')}):
- Total de clientes: ${clients.length}
- Ativos: ${clients.filter(c => c.status === 'ativo').length}
- Prospectos: ${prospects.length}
- Perdidos: ${lost.length}
- Inativos: ${clients.filter(c => c.status === 'inativo').length}
- Processos em andamento: ${activeProcesses.length}

LEMBRETES PENDENTES: ${reminders.filter(r => !r.completed).length} total
- Atrasados: ${reminders.filter(r => !r.completed && r.date < today).length}
- Para hoje: ${reminders.filter(r => !r.completed && r.date === today).length}
- Futuros: ${reminders.filter(r => !r.completed && r.date > today).length}

FINANCEIRO PENDENTE:
- Valores em aberto: ${financials.filter(f => f.status !== 'pago').length}
- Total em aberto: R$ ${FinancialModule.formatCurrency(financials.filter(f => f.status !== 'pago').reduce((s, f) => s + (parseFloat(f.amount) || 0), 0))}
- Valores atrasados: ${financials.filter(f => f.status !== 'pago' && f.dueDate < today).length}`;

        ctx += '\n\n---\nDETALHE POR CLIENTE (ordenado por urgencia):\n';

        const clientsWithScore = active
            .filter(c => c.status !== 'inativo')
            .map(c => {
                const days = ClientsModule.daysSinceContact(c.lastContact);
                const score = LeadScoringModule.score(c);
                const stageInfo = PIPELINE_STAGES.find(s => s.id === (c.stage || 'protocolo'));
                const clientReminders = reminders.filter(r => r.clientId === c.id && !r.completed);
                const clientFinancials = financials.filter(f => f.clientId === c.id && f.status !== 'pago');
                const overdueReminders = clientReminders.filter(r => r.date < today);
                const overduePayments = clientFinancials.filter(f => f.dueDate < today);
                const interactions = InteractionStore.getByClient(c.id).slice(0, 3);

                let urgency = 0;
                if (overdueReminders.length > 0) urgency += 30;
                if (overduePayments.length > 0) urgency += 20;
                if (days >= 60) urgency += 25;
                else if (days >= 30) urgency += 15;
                if (c.status === 'prospecto' && days >= 3) urgency += 10;

                return { client: c, days, score, stageInfo, clientReminders, clientFinancials, overdueReminders, overduePayments, interactions, urgency };
            })
            .sort((a, b) => b.urgency - a.urgency);

        clientsWithScore.forEach(({ client: c, days, score, stageInfo, clientReminders, clientFinancials, overdueReminders, overduePayments, interactions }) => {
            ctx += `\n[${score.label.text.toUpperCase()}] ${c.name}`;
            if (c.company) ctx += ` (${c.company})`;
            ctx += `\n  Status: ${ClientsModule.statusLabel(c.status)} | Etapa: ${stageInfo ? stageInfo.label : '-'} | Score: ${score.total}pts`;
            ctx += `\n  Processo: ${c.process || 'Sem processo'} | Origem: ${ClientsModule.originLabel(c.origin)}`;
            ctx += `\n  Ultimo contato: ${days} dias atras`;
            if (c.proposalValue) ctx += ` | Valor proposta: R$ ${FinancialModule.formatCurrency(c.proposalValue)}`;

            if (overdueReminders.length > 0) {
                ctx += `\n  ATRASADO: ${overdueReminders.map(r => r.message).join('; ')}`;
            }
            if (overduePayments.length > 0) {
                ctx += `\n  PAGAMENTO ATRASADO: ${overduePayments.map(f => f.description + ' R$' + FinancialModule.formatCurrency(f.amount)).join('; ')}`;
            }
            if (clientReminders.length > 0) {
                ctx += `\n  Lembretes: ${clientReminders.map(r => ClientsModule.formatDate(r.date) + ' - ' + r.message).join('; ')}`;
            }
            if (interactions.length > 0) {
                ctx += `\n  Ultimas interacoes: ${interactions.map(i => ClientsModule.formatDate(i.date) + ' (' + InteractionsModule.typeLabel(i.type) + '): ' + i.description.substring(0, 60)).join('; ')}`;
            }
            if (c.notes) ctx += `\n  Obs: ${c.notes.substring(0, 100)}`;
            if (c.status === 'perdido') {
                ctx += `\n  Motivo perda: ${ClientsModule.lossReasonLabel(c.lossReason)}`;
                if (c.lossNotes) ctx += ` - ${c.lossNotes.substring(0, 80)}`;
            }
            ctx += '\n';
        });

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

    consultantPrompt() {
        return `Voce e o CONSULTOR ESTRATEGICO da UNIDADE CONSULT, um escritorio especializado em registro de marcas e patentes junto ao INPI.

Seu papel e analisar a carteira de clientes e dar conselhos estrategicos de gestao comercial. Voce atua como um socio consultor que:

1. CLASSIFICA clientes em QUENTE/MORNO/FRIO com base em:
   - Tempo desde ultimo contato
   - Fase no pipeline (prospeccao vs registrado)
   - Valor da proposta
   - Frequencia e qualidade das interacoes
   - Origem do lead (indicacao vale mais que outbound)

2. RECOMENDA TIMING de contato:
   - FALAR AGORA: prospect sem resposta 2-5 dias, proposta pendente, prazo se aproximando
   - DAR TEMPO: acabou de enviar proposta (<2 dias), cliente pediu tempo, acabou de fazer follow-up
   - URGENTE: 30+ dias sem contato em cliente ativo, prazo INPI se esgotando, pagamento atrasado
   - RESGATAR: cliente perdido com motivo "vai decidir futuramente" apos 30-60 dias

3. IDENTIFICA RISCOS:
   - Clientes que podem se perder (sem contato prolongado)
   - Prazos INPI que estao proximos
   - Pagamentos atrasados que podem virar inadimplencia
   - Prospectos esfriando sem follow-up

4. SUGERE ACOES CONCRETAS com datas:
   - "Ligar para [cliente] em [data]"
   - "Enviar mensagem de follow-up para [cliente] sobre [assunto]"
   - "Cobrar pagamento de [cliente] vencido ha [X] dias"
   - "Verificar andamento do processo [numero] no INPI"

5. CRIA LEMBRETES sugeridos no formato:
   Quando sugerir criar um lembrete, use exatamente este formato (um por linha):
   [LEMBRETE] data=YYYY-MM-DD | cliente=Nome do Cliente | tipo=follow-up/prazo/pagamento/documento/prorrogacao | msg=Descricao da acao

Regras de timing do mercado de marcas e patentes:
- Prospect novo: primeiro contato em ate 24h, follow-up em 3 dias se sem resposta
- Proposta enviada: dar 2-3 dias, follow-up em 5-7 dias
- Cliente ativo com processo: contato mensal minimo para atualizacao
- Prazo INPI de oposicao: 60 dias corridos, avisar com 10 dias de antecedencia
- Concessao apos deferimento: 60 dias para pagar, avisar com 15 dias de antecedencia
- Prorrogacao: iniciar no 9o ano (entre ultimo ano e penultimo ano)
- Cliente perdido "vai decidir futuramente": tentar novamente em 45-60 dias
- Cliente perdido "preco": tentar em 90 dias com condicao especial

Responda sempre em portugues do Brasil. Seja direto, pratico e estrategico.
Use formatacao com **negrito** para destaques.
Data de hoje: ${new Date().toLocaleDateString('pt-BR')}.`;
    },

    async askAboutClient(clientId, question) {
        const context = this.buildClientContext(clientId);
        const messages = [
            { role: 'system', content: this.consultantPrompt() },
            { role: 'user', content: context + '\n\n---\n\nPERGUNTA DO ATENDENTE: ' + question }
        ];
        return await this.callAPI(messages, { maxTokens: 2000 });
    },

    async generateMessage(clientId, intent) {
        const context = this.buildClientContext(clientId);
        const messages = [
            { role: 'system', content: this.systemPrompt() },
            { role: 'user', content: context + '\n\n---\n\nGere uma mensagem de WhatsApp para este cliente com o seguinte objetivo: ' + intent + '\n\nA mensagem deve ser profissional, cordial, e pronta para enviar. Nao use HTML. Assine como UNIDADE CONSULT - Marcas e Patentes.' }
        ];
        return await this.callAPI(messages, { temperature: 0.8, maxTokens: 1500 });
    },

    async suggestNICE(businessDescription) {
        const messages = [
            { role: 'system', content: this.systemPrompt() + '\n\nVoce e especialista na Classificacao Internacional de Nice para registro de marcas. Conhece todas as 45 classes e suas especificacoes.' },
            { role: 'user', content: 'Com base na descricao do negocio abaixo, sugira as classes NICE mais adequadas para registro de marca. Para cada classe, explique brevemente por que e relevante.\n\nDESCRICAO DO NEGOCIO: ' + businessDescription }
        ];
        return await this.callAPI(messages, { temperature: 0.3, maxTokens: 1500 });
    },

    async summarizeClient(clientId) {
        const context = this.buildClientContext(clientId);
        const messages = [
            { role: 'system', content: this.consultantPrompt() },
            { role: 'user', content: context + '\n\n---\n\nFaca um resumo executivo deste cliente em 3-5 pontos. Inclua: situacao atual, classificacao (quente/morno/frio), riscos, proximas acoes recomendadas com datas, e oportunidades. Sugira lembretes se necessario.' }
        ];
        return await this.callAPI(messages, { temperature: 0.4, maxTokens: 2000 });
    },

    async analyzePortfolio() {
        const context = this.buildPortfolioContext();
        const messages = [
            { role: 'system', content: this.consultantPrompt() },
            { role: 'user', content: context + '\n\n---\n\nAnalise toda a carteira e me de:\n\n1. **VISAO GERAL** - Saude da carteira em poucas palavras\n2. **CLIENTES QUENTES** - Quem precisa de atencao AGORA e por que\n3. **CLIENTES MORNOS** - Quem precisa de follow-up esta semana\n4. **CLIENTES FRIOS** - Quem pode esperar ou precisa de estrategia de resgate\n5. **ALERTAS** - Prazos, pagamentos, riscos iminentes\n6. **AGENDA SUGERIDA** - O que fazer hoje, esta semana, este mes\n7. **LEMBRETES** - Sugira lembretes concretos para as acoes mais importantes\n\nSeja direto e pratico. Priorize por urgencia.' }
        ];
        return await this.callAPI(messages, { temperature: 0.4, maxTokens: 3000 });
    },

    async analyzeTimings() {
        const context = this.buildPortfolioContext();
        const messages = [
            { role: 'system', content: this.consultantPrompt() },
            { role: 'user', content: context + '\n\n---\n\nFoque exclusivamente em TIMING de contato. Para cada cliente ativo e prospecto, diga:\n\n- FALAR AGORA (urgente, nao pode esperar)\n- FALAR ESTA SEMANA (importante mas nao urgente)\n- DAR TEMPO (acabou de contatar, esperar)\n- RESGATAR (perdido mas com potencial de retorno)\n\nExplique brevemente o motivo de cada classificacao e sugira a melhor abordagem (ligacao, WhatsApp, email). Sugira lembretes para cada acao.' }
        ];
        return await this.callAPI(messages, { temperature: 0.3, maxTokens: 2500 });
    },

    async analyzeDates() {
        const context = this.buildPortfolioContext();
        const messages = [
            { role: 'system', content: this.consultantPrompt() },
            { role: 'user', content: context + '\n\n---\n\nFoque nas OBRIGACOES E DATAS importantes:\n\n1. **PRAZOS VENCIDOS** - O que ja deveria ter sido feito\n2. **PRAZOS ESTA SEMANA** - O que vence nos proximos 7 dias\n3. **PRAZOS ESTE MES** - O que vence nos proximos 30 dias\n4. **PAGAMENTOS PENDENTES** - Cobranças a fazer\n5. **DATAS INPI** - Oposicoes, concessoes, prorrogacoes\n\nSugira lembretes para cada obrigacao importante. Priorize por urgencia e risco.' }
        ];
        return await this.callAPI(messages, { temperature: 0.3, maxTokens: 2500 });
    },

    parseReminders(text) {
        const reminders = [];
        const regex = /\[LEMBRETE\]\s*data=(\d{4}-\d{2}-\d{2})\s*\|\s*cliente=(.+?)\s*\|\s*tipo=(follow-up|prazo|pagamento|documento|prorrogacao)\s*\|\s*msg=(.+)/g;
        let match;
        while ((match = regex.exec(text)) !== null) {
            const clientName = match[2].trim();
            const client = ClientStore.getAll().find(c =>
                c.name.toLowerCase().includes(clientName.toLowerCase())
            );
            reminders.push({
                date: match[1],
                clientName,
                clientId: client ? client.id : null,
                type: match[3],
                message: match[4].trim()
            });
        }
        return reminders;
    },

    createSuggestedReminders(reminders) {
        let created = 0;
        reminders.forEach(r => {
            if (!r.clientId) return;
            const existing = ReminderStore.getAll().filter(er =>
                er.clientId === r.clientId && !er.completed && er.message === r.message
            );
            if (existing.length === 0) {
                ReminderStore.save({
                    clientId: r.clientId,
                    date: r.date,
                    type: r.type,
                    message: r.message,
                    automated: true,
                    aiSuggested: true
                });
                created++;
            }
        });
        return created;
    },

    chatMode: 'client',
    chatHistory: [],

    openChat(clientId) {
        const client = ClientStore.getById(clientId);
        if (!client) return;

        if (!this.hasKeys()) {
            App.toast('Configure suas API keys em Configuracoes.', 'warning');
            App.navigate('settings');
            return;
        }

        this.chatMode = 'client';
        this.chatHistory = [];
        document.getElementById('aiChatTitle').textContent = 'IA - ' + client.name;
        document.getElementById('aiChatClientId').value = clientId;
        document.getElementById('aiChatMessages').innerHTML = '';
        document.getElementById('aiChatInput').value = '';
        document.getElementById('aiChatInput').placeholder = 'Pergunte algo sobre este cliente...';

        this.updateQuickActions('client');
        document.getElementById('aiChatModal').classList.remove('hidden');

        this.addBotMessage('Ola! Sou o assistente IA da UNIDADE CONSULT. Posso ajudar com:\n\n' +
            '- **Resumo** do cliente\n' +
            '- **Redigir mensagem** (cobranca, follow-up, atualizacao...)\n' +
            '- **Sugerir classes NICE** para registro\n' +
            '- **Proximos passos** recomendados\n' +
            '- **Quando falar** ou dar tempo ao cliente\n' +
            '- Qualquer **pergunta** sobre este cliente\n\n' +
            'O que precisa?');
    },

    openGlobalChat() {
        if (!this.hasKeys()) {
            App.toast('Configure suas API keys em Configuracoes.', 'warning');
            App.navigate('settings');
            return;
        }

        this.chatMode = 'portfolio';
        this.chatHistory = [];
        document.getElementById('aiChatTitle').textContent = 'Consultor IA - Carteira Completa';
        document.getElementById('aiChatClientId').value = '';
        document.getElementById('aiChatMessages').innerHTML = '';
        document.getElementById('aiChatInput').value = '';
        document.getElementById('aiChatInput').placeholder = 'Pergunte sobre sua carteira de clientes...';

        this.updateQuickActions('portfolio');
        document.getElementById('aiChatModal').classList.remove('hidden');

        const clients = ClientStore.getAll();
        const active = clients.filter(c => c.status !== 'inativo' && c.status !== 'perdido');
        const hotLeads = LeadScoringModule.getHotLeads(3);

        let greeting = 'Ola! Sou seu **consultor estrategico**. Tenho acesso a toda sua carteira:\n\n';
        greeting += `- **${active.length}** clientes ativos/prospectos\n`;
        greeting += `- **${clients.filter(c => c.status === 'prospecto').length}** prospectos aguardando\n`;
        if (hotLeads.length > 0) {
            greeting += `- **${hotLeads.length}** leads quentes agora\n`;
        }
        const overdueReminders = ReminderStore.getAll().filter(r => !r.completed && r.date < new Date().toISOString().split('T')[0]);
        if (overdueReminders.length > 0) {
            greeting += `- **${overdueReminders.length}** lembretes atrasados\n`;
        }
        greeting += '\nPosso analisar:\n';
        greeting += '- **Carteira completa** - visao estrategica\n';
        greeting += '- **Quem contatar agora** vs dar tempo\n';
        greeting += '- **Prazos e obrigacoes** pendentes\n';
        greeting += '- **Qualquer cliente** especifico\n\n';
        greeting += 'O que quer saber?';

        this.addBotMessage(greeting);
    },

    updateQuickActions(mode) {
        const container = document.getElementById('aiQuickActions');
        if (!container) return;

        if (mode === 'portfolio') {
            container.innerHTML =
                '<button class="btn btn-sm btn-secondary" onclick="AIModule.quickAction(\'portfolio\')">Analise da Carteira</button>' +
                '<button class="btn btn-sm btn-secondary" onclick="AIModule.quickAction(\'timing\')">Quem contatar agora?</button>' +
                '<button class="btn btn-sm btn-secondary" onclick="AIModule.quickAction(\'dates\')">Prazos e obrigacoes</button>' +
                '<button class="btn btn-sm btn-secondary" onclick="AIModule.quickAction(\'hot\')">Leads quentes</button>' +
                '<button class="btn btn-sm btn-secondary" onclick="AIModule.quickAction(\'rescue\')">Clientes para resgatar</button>';
        } else {
            container.innerHTML =
                '<button class="btn btn-sm btn-secondary" onclick="AIModule.quickAction(\'summary\')">Resumo</button>' +
                '<button class="btn btn-sm btn-secondary" onclick="AIModule.quickAction(\'followup\')">Follow-up</button>' +
                '<button class="btn btn-sm btn-secondary" onclick="AIModule.quickAction(\'cobranca\')">Cobranca</button>' +
                '<button class="btn btn-sm btn-secondary" onclick="AIModule.quickAction(\'nextsteps\')">Proximos passos</button>' +
                '<button class="btn btn-sm btn-secondary" onclick="AIModule.quickAction(\'nice\')">Classes NICE</button>';
        }
    },

    async quickAction(action) {
        const prompts = {
            portfolio: 'Faca uma analise completa da minha carteira de clientes',
            timing: 'Com quem devo falar agora e com quem devo dar tempo?',
            dates: 'Quais sao meus prazos e obrigacoes pendentes?',
            hot: 'Quais sao meus leads mais quentes e o que fazer com cada um?',
            rescue: 'Quais clientes perdidos tem potencial de resgate e qual a melhor estrategia?',
            summary: 'Faca um resumo deste cliente',
            followup: 'Redija uma mensagem de follow-up',
            cobranca: 'Redija uma mensagem de cobranca',
            nextsteps: 'Quais os proximos passos recomendados?',
            nice: 'Sugira classes NICE para este cliente'
        };

        const input = document.getElementById('aiChatInput');
        input.value = prompts[action] || '';
        await this.sendChat();
    },

    closeChat() {
        document.getElementById('aiChatModal').classList.add('hidden');
        this.chatHistory = [];
    },

    addBotMessage(text) {
        const container = document.getElementById('aiChatMessages');
        const div = document.createElement('div');
        div.className = 'ai-msg ai-bot';

        let content = '<div class="ai-msg-content">' + this.formatMessage(text) + '</div>';

        const suggestedReminders = this.parseReminders(text);
        if (suggestedReminders.length > 0) {
            content += '<div class="ai-reminders-suggestion">';
            content += '<div class="ai-reminder-header">Lembretes sugeridos:</div>';
            suggestedReminders.forEach((r, i) => {
                const found = r.clientId ? 'found' : 'not-found';
                content += `<div class="ai-reminder-item ${found}">`;
                content += `<span class="ai-reminder-date">${ClientsModule.formatDate(r.date)}</span>`;
                content += `<span class="ai-reminder-client">${ClientsModule.escapeHtml(r.clientName)}</span>`;
                content += `<span class="ai-reminder-msg">${ClientsModule.escapeHtml(r.message)}</span>`;
                if (!r.clientId) {
                    content += '<span class="ai-reminder-warn">Cliente nao encontrado</span>';
                }
                content += '</div>';
            });
            const validCount = suggestedReminders.filter(r => r.clientId).length;
            if (validCount > 0) {
                content += `<button class="btn btn-sm btn-primary ai-create-reminders" onclick="AIModule.handleCreateReminders(this)" data-reminders='${ClientsModule.escapeHtml(JSON.stringify(suggestedReminders.filter(r => r.clientId)))}'>Criar ${validCount} lembrete${validCount > 1 ? 's' : ''}</button>`;
            }
            content += '</div>';
        }

        div.innerHTML = content;
        container.appendChild(div);
        container.scrollTop = container.scrollHeight;
    },

    handleCreateReminders(btn) {
        try {
            const reminders = JSON.parse(btn.dataset.reminders);
            const created = this.createSuggestedReminders(reminders);
            if (created > 0) {
                App.toast(created + ' lembrete(s) criado(s) com sucesso!', 'success');
                btn.textContent = 'Criados!';
                btn.disabled = true;
                btn.classList.remove('btn-primary');
                btn.classList.add('btn-secondary');
            } else {
                App.toast('Lembretes ja existem no sistema.', 'info');
                btn.textContent = 'Ja existem';
                btn.disabled = true;
            }
        } catch (e) {
            App.toast('Erro ao criar lembretes.', 'error');
        }
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
        div.innerHTML = '<div class="ai-msg-content"><span class="ai-dots">Analisando seus dados</span></div>';
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

            if (this.chatMode === 'portfolio') {
                if (lower.includes('carteira') || lower.includes('analise completa') || lower.includes('visao geral')) {
                    response = await this.analyzePortfolio();
                } else if (lower.includes('contatar') || lower.includes('falar') || lower.includes('timing') || lower.includes('dar tempo')) {
                    response = await this.analyzeTimings();
                } else if (lower.includes('prazo') || lower.includes('obrigac') || lower.includes('venc') || lower.includes('data')) {
                    response = await this.analyzeDates();
                } else if (lower.includes('quente') || lower.includes('hot') || lower.includes('lead')) {
                    const context = this.buildPortfolioContext();
                    const messages = [
                        { role: 'system', content: this.consultantPrompt() },
                        { role: 'user', content: context + '\n\n---\n\nAnalise os leads quentes da carteira. Para cada um, diga por que e quente, qual a melhor acao agora, e quando fazer. Sugira lembretes.' }
                    ];
                    response = await this.callAPI(messages, { temperature: 0.4, maxTokens: 2500 });
                } else if (lower.includes('resgat') || lower.includes('perdid') || lower.includes('recuper')) {
                    const context = this.buildPortfolioContext();
                    const messages = [
                        { role: 'system', content: this.consultantPrompt() },
                        { role: 'user', content: context + '\n\n---\n\nAnalise os clientes perdidos. Quais tem potencial de resgate? Considere o motivo da perda e quanto tempo faz. Sugira estrategia e timing para cada um. Sugira lembretes para as acoes.' }
                    ];
                    response = await this.callAPI(messages, { temperature: 0.4, maxTokens: 2500 });
                } else {
                    const context = this.buildPortfolioContext();
                    this.chatHistory.push({ role: 'user', content: question });
                    const messages = [
                        { role: 'system', content: this.consultantPrompt() },
                        { role: 'user', content: context + '\n\n---\n\n' + question }
                    ];
                    if (this.chatHistory.length > 2) {
                        messages.splice(1, 0, ...this.chatHistory.slice(-4, -1));
                    }
                    response = await this.callAPI(messages, { maxTokens: 2500 });
                    this.chatHistory.push({ role: 'assistant', content: response });
                }
            } else {
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
