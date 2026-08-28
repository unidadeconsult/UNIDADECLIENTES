const App = {
    _initialized: false,
    init() {
        if (this._initialized) return;
        this._initialized = true;
        this.bindNavigation();
        DashboardModule.init();
        ClientsModule.init();
        TemplatesModule.init();
        RemindersModule.init();
        PipelineModule.init();
        FinancialModule.init();
        CalendarModule.init();
        ReportsModule.init();
        SettingsModule.init();
        AutomationModule.run();
        DocumentValidator.bindValidation('clientDocument');
        this.registerServiceWorker();
        this.initDownload();
    },

    registerServiceWorker() {
        if ('serviceWorker' in navigator) {
            navigator.serviceWorker.register('sw.js').catch(() => {});
        }
    },

    bindNavigation() {
        document.querySelectorAll('.nav-btn').forEach(btn => {
            btn.addEventListener('click', () => {
                const section = btn.dataset.section;
                this.navigate(section);
            });
        });
    },

    navigate(sectionId) {
        document.querySelectorAll('.section').forEach(s => s.classList.remove('active'));
        document.querySelectorAll('.nav-btn').forEach(b => b.classList.remove('active'));

        const section = document.getElementById(sectionId);
        const btn = document.querySelector(`.nav-btn[data-section="${sectionId}"]`);

        if (section) section.classList.add('active');
        if (btn) btn.classList.add('active');

        if (sectionId === 'dashboard') DashboardModule.refresh();
        if (sectionId === 'clients') ClientsModule.render();
        if (sectionId === 'pipeline') PipelineModule.render();
        if (sectionId === 'templates') TemplatesModule.render();
        if (sectionId === 'reminders') RemindersModule.render();
        if (sectionId === 'financial') FinancialModule.render();
        if (sectionId === 'calendar') CalendarModule.render();
        if (sectionId === 'reports') ReportsModule.render();
        if (sectionId === 'settings') SettingsModule.render();
    },

    toast(message, type = '') {
        const toast = document.getElementById('toast');
        toast.textContent = message;
        toast.className = 'toast ' + type;

        setTimeout(() => {
            toast.classList.add('hidden');
        }, 3000);
    },

    async initDownload() {
        if (typeof claude === 'undefined' || !claude.use) return;
        const downloads = await claude.use('downloads');
        if (!downloads) return;
        this._downloads = downloads;
        const card = document.getElementById('downloadCard');
        if (card) card.style.display = '';
    },

    async downloadHTML() {
        if (!this._downloads) {
            this.toast('Download nao disponivel neste modo.', 'warning');
            return;
        }
        try {
            const html = '<!DOCTYPE html>\n<html>\n<head><meta charset="UTF-8"></head>\n<body>\n' +
                document.documentElement.outerHTML + '\n</body>\n</html>';
            await this._downloads.save({ filename: 'unidade-consult.html', data: html });
            this.toast('Download iniciado!', 'success');
        } catch (err) {
            if (err && err.code === 'declined') return;
            this.toast('Erro no download: ' + (err.message || err.code || ''), 'error');
        }
    }
};

document.addEventListener('DOMContentLoaded', () => AuthModule.init());
