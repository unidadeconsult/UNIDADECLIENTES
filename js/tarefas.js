const TarefaStore = {
    getAll() {
        return Storage.get('tarefas') || [];
    },
    save(tarefa) {
        const tarefas = this.getAll();
        const idx = tarefas.findIndex(t => t.id === tarefa.id);
        if (idx >= 0) {
            tarefas[idx] = { ...tarefas[idx], ...tarefa, updatedAt: new Date().toISOString() };
        } else {
            tarefa.id = Storage.generateId();
            tarefa.createdAt = new Date().toISOString();
            tarefa.updatedAt = new Date().toISOString();
            tarefa.done = false;
            tarefas.push(tarefa);
        }
        Storage.set('tarefas', tarefas);
        return tarefa;
    },
    delete(id) {
        Storage.set('tarefas', this.getAll().filter(t => t.id !== id));
    },
    toggle(id) {
        const tarefas = this.getAll();
        const idx = tarefas.findIndex(t => t.id === id);
        if (idx >= 0) {
            tarefas[idx].done = !tarefas[idx].done;
            tarefas[idx].updatedAt = new Date().toISOString();
            Storage.set('tarefas', tarefas);
        }
    }
};

const TarefasModule = {
    init() {
        this.render();
    },

    render() {
        const tarefas = TarefaStore.getAll();
        const pending = tarefas.filter(t => !t.done);
        const done = tarefas.filter(t => t.done);
        const container = document.getElementById('tarefasContent');
        if (!container) return;

        const pendingCount = pending.length;
        const doneCount = done.length;

        container.innerHTML = `
            <div class="caderno">
                <div class="caderno-header">
                    <div class="caderno-titulo">Minhas Tarefas</div>
                    <div class="caderno-stats">
                        <span class="caderno-stat">${pendingCount} pendente${pendingCount !== 1 ? 's' : ''}</span>
                        <span class="caderno-stat done">${doneCount} concluida${doneCount !== 1 ? 's' : ''}</span>
                    </div>
                </div>
                <div class="caderno-input-row">
                    <input type="text" id="tarefaInput" class="caderno-input" placeholder="Escreva uma nova tarefa..." onkeydown="if(event.key==='Enter')TarefasModule.add()">
                    <button class="btn btn-primary btn-sm" onclick="TarefasModule.add()">+ Adicionar</button>
                </div>
                <div class="caderno-linhas">
                    ${pending.map(t => this.renderLinha(t)).join('')}
                    ${done.length > 0 ? `
                        <div class="caderno-separator">
                            <span>Concluidas</span>
                        </div>
                        ${done.map(t => this.renderLinha(t)).join('')}
                    ` : ''}
                    ${tarefas.length === 0 ? '<div class="caderno-vazio">Nenhuma tarefa anotada. Comece escrevendo acima!</div>' : ''}
                </div>
            </div>
        `;
    },

    renderLinha(tarefa) {
        const checked = tarefa.done ? 'checked' : '';
        const doneClass = tarefa.done ? 'linha-done' : '';
        const date = tarefa.createdAt ? ClientsModule.formatDate(tarefa.createdAt.split('T')[0]) : '';
        return `
            <div class="caderno-linha ${doneClass}">
                <label class="caderno-check">
                    <input type="checkbox" ${checked} onchange="TarefasModule.toggle('${tarefa.id}')">
                    <span class="caderno-checkmark"></span>
                </label>
                <span class="caderno-texto">${ClientsModule.escapeHtml(tarefa.text)}</span>
                <span class="caderno-data">${date}</span>
                <button class="btn-icon caderno-delete" onclick="TarefasModule.remove('${tarefa.id}')" title="Excluir">&#128465;</button>
            </div>
        `;
    },

    add() {
        const input = document.getElementById('tarefaInput');
        const text = input.value.trim();
        if (!text) return;
        TarefaStore.save({ text });
        input.value = '';
        this.render();
        App.toast('Tarefa anotada!', 'success');
    },

    toggle(id) {
        TarefaStore.toggle(id);
        this.render();
    },

    remove(id) {
        TarefaStore.delete(id);
        this.render();
        App.toast('Tarefa removida.', 'warning');
    }
};
