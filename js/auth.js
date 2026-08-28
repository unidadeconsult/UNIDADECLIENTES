const AuthModule = {
    users: [
        { login: 'dhanilo', hash: '4135746a14808e1d5b90ae373f8feee30ffcb3ec360921d2d9dad70c40ae4da8', name: 'Dhanilo' },
        { login: 'jane', hash: '4135746a14808e1d5b90ae373f8feee30ffcb3ec360921d2d9dad70c40ae4da8', name: 'Jane' }
    ],

    async sha256(text) {
        const data = new TextEncoder().encode(text);
        const buf = await crypto.subtle.digest('SHA-256', data);
        return Array.from(new Uint8Array(buf)).map(b => b.toString(16).padStart(2, '0')).join('');
    },

    isLoggedIn() {
        const session = Storage.get('auth_session');
        return session && session.login && session.ts;
    },

    currentUser() {
        const session = Storage.get('auth_session');
        if (!session) return null;
        return this.users.find(u => u.login === session.login) || null;
    },

    async login(login, password) {
        const user = this.users.find(u => u.login === login.toLowerCase().trim());
        if (!user) return { ok: false, msg: 'Usuario nao encontrado.' };

        const hash = await this.sha256(password);
        if (hash !== user.hash) return { ok: false, msg: 'Senha incorreta.' };

        Storage.set('auth_session', { login: user.login, name: user.name, ts: Date.now() });
        return { ok: true };
    },

    logout() {
        Storage.set('auth_session', null);
        App._initialized = false;
        this.showLogin();
    },

    showLogin() {
        document.getElementById('loginScreen').style.display = '';
        document.getElementById('app').style.display = 'none';
        document.getElementById('loginUser').value = '';
        document.getElementById('loginPass').value = '';
        document.getElementById('loginError').textContent = '';
        const btn = document.getElementById('loginBtn');
        btn.disabled = false;
        btn.textContent = 'Entrar';
        document.getElementById('loginUser').focus();
    },

    showApp() {
        document.getElementById('loginScreen').style.display = 'none';
        document.getElementById('app').style.display = '';
        const user = this.currentUser();
        const el = document.getElementById('loggedUserName');
        if (el && user) el.textContent = user.name;
    },

    async handleLogin(e) {
        if (e) e.preventDefault();
        const login = document.getElementById('loginUser').value;
        const pass = document.getElementById('loginPass').value;
        const errorEl = document.getElementById('loginError');
        const btn = document.getElementById('loginBtn');

        if (!login || !pass) {
            errorEl.textContent = 'Preencha login e senha.';
            return;
        }

        btn.disabled = true;
        btn.textContent = 'Entrando...';

        const result = await this.login(login, pass);

        if (result.ok) {
            this.showApp();
            App.init();
        } else {
            errorEl.textContent = result.msg;
            btn.disabled = false;
            btn.textContent = 'Entrar';
        }
    },

    init() {
        if (this.isLoggedIn()) {
            this.showApp();
            App.init();
        } else {
            this.showLogin();
        }
    }
};
