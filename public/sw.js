const CACHE_VERSION = 'v4';
const CACHE_NAME = `gold-ledger-cache-${CACHE_VERSION}`;

// فقط چیزهایی که برای اولین نمایشِ برنامه لازم‌اند از پیش کش می‌شوند.
// تصاویر حالت خالی و آیکون ۵۱۲ اینجا نیستند چون همیشه لازم نمی‌شوند؛
// همان بار اولی که مرورگر بخواهدشان، هندلر پایین‌تر خودش کششان می‌کند.
const urlsToCache = [
  '/',
  '/index.html',
  '/manifest.json',
  '/favicon.ico',
  '/icons/icon-192.png',
  '/brand/logo.png',
  '/brand/login-bg.webp',
  '/jalalidatepicker.min.css',
  '/jalalidatepicker.min.js'
];

self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then(cache => cache.addAll(urlsToCache))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys()
      .then(keys => Promise.all(
        keys
          .filter(key => key.startsWith('gold-ledger-cache-') && key !== CACHE_NAME)
          .map(key => caches.delete(key))
      ))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', event => {
  const request = event.request;
  const url = new URL(request.url);

  if (request.method !== 'GET' || url.origin !== self.location.origin) {
    return;
  }

  // درخواست‌های API هرگز کش نمی‌شوند و از سرویس‌ورکر رد می‌شوند.
  //
  // این پاسخ‌ها وابسته به نشست کاربرند: اگر /api/auth کش شود، پاسخِ «کاربری
  // وارد نشده» برای همیشه تکرار می‌شود و کاربر با هر رفرش به صفحه‌ی ورود
  // پرت می‌شود، حتی وقتی کوکی نشستش معتبر است. /api/data هم به همین دلیل
  // نباید کش شود، وگرنه داده‌ی قدیمی یا داده‌ی کاربر دیگری نمایش داده می‌شود.
  if (url.pathname.startsWith('/api/')) {
    return;
  }

  if (request.mode === 'navigate') {
    event.respondWith(
      fetch(request)
        .then(response => {
          const copy = response.clone();
          caches.open(CACHE_NAME).then(cache => cache.put('/index.html', copy));
          return response;
        })
        .catch(() => caches.match('/index.html'))
    );
    return;
  }

  if (url.pathname.startsWith('/assets/')) {
    event.respondWith(
      caches.match(request)
        .then(cached => {
          if (cached) {
            return cached;
          }

          return fetch(request).then(response => {
            if (response.ok) {
              const copy = response.clone();
              caches.open(CACHE_NAME).then(cache => cache.put(request, copy));
            }

            return response;
          });
        })
    );
    return;
  }

  event.respondWith(
    caches.match(request)
      .then(cached => {
        if (cached) {
          return cached;
        }

        return fetch(request).then(response => {
          if (response.ok) {
            const copy = response.clone();
            caches.open(CACHE_NAME).then(cache => cache.put(request, copy));
          }

          return response;
        });
      })
  );
});
