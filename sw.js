const CACHE_NAME = 'unidade-consult-v3';
const ASSETS = [
    './',
    'index.html',
    'css/styles.css',
    'js/storage.js',
    'js/templates-data.js',
    'js/clients.js',
    'js/templates.js',
    'js/reminders.js',
    'js/interactions.js',
    'js/pipeline.js',
    'js/financial.js',
    'js/automation.js',
    'js/calendar.js',
    'js/reports.js',
    'js/batch.js',
    'js/dashboard.js',
    'js/ai.js',
    'js/auth.js',
    'js/app.js'
];

self.addEventListener('install', event => {
    event.waitUntil(
        caches.open(CACHE_NAME).then(cache => cache.addAll(ASSETS))
    );
    self.skipWaiting();
});

self.addEventListener('activate', event => {
    event.waitUntil(
        caches.keys().then(keys =>
            Promise.all(keys.filter(k => k !== CACHE_NAME).map(k => caches.delete(k)))
        )
    );
    self.clients.claim();
});

self.addEventListener('fetch', event => {
    if (event.request.method !== 'GET') return;

    event.respondWith(
        fetch(event.request)
            .then(response => {
                const clone = response.clone();
                caches.open(CACHE_NAME).then(cache => cache.put(event.request, clone));
                return response;
            })
            .catch(() => caches.match(event.request))
    );
});
