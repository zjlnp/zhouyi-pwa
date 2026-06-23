// Service Worker — 金钱卦 PWA 离线缓存
const CACHE_NAME = 'zhouyi-v3';

// 需要预缓存的核心文件
const PRECACHE = [
  './index.html',
  './app.js',
  './data.js',
  './ganzhi.js',
  './style.css',
  './data/hexagrams.json',
  './manifest.json'
];

// 安装时预缓存核心文件
self.addEventListener('install', function(event) {
  event.waitUntil(
    caches.open(CACHE_NAME).then(function(cache) {
      return Promise.all(PRECACHE.map(function(url) {
        return cache.add(url).catch(function(err) {
          console.warn('预缓存失败: ' + url, err);
        });
      }));
    }).then(function() {
      return self.skipWaiting();
    })
  );
});

// 激活时清理旧缓存
self.addEventListener('activate', function(event) {
  event.waitUntil(
    caches.keys().then(function(names) {
      return Promise.all(
        names.filter(function(n) { return n !== CACHE_NAME; })
          .map(function(n) { return caches.delete(n); })
      );
    }).then(function() {
      return self.clients.claim();
    })
  );
});

// 缓存策略：缓存优先（静态资源），网络回退
self.addEventListener('fetch', function(event) {
  // 跳过非 GET 请求
  if (event.request.method !== 'GET') return;

  event.respondWith(
    caches.match(event.request).then(function(cached) {
      if (cached) return cached;

      return fetch(event.request).then(function(response) {
        // 只缓存成功的 GET 响应
        if (!response || response.status !== 200 || response.type !== 'basic') {
          return response;
        }

        var clone = response.clone();
        caches.open(CACHE_NAME).then(function(cache) {
          cache.put(event.request, clone);
        });

        return response;
      }).catch(function() {
        // 离线时返回缓存（如果有的话），否则返回离线页
        return cached || new Response('离线状态下不可用', { status: 503 });
      });
    })
  );
});
