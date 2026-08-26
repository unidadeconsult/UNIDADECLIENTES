const App = {
    init() {
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
    }
};

document.addEventListener('DOMContentLoaded', () => App.init());
