// public/sw.js - Service Worker for caching and performance
const CACHE_NAME = 'language-learner-v1';
const STATIC_CACHE = 'static-v1';
const DYNAMIC_CACHE = 'dynamic-v1';

// Assets to cache immediately
const STATIC_ASSETS = [
  '/',
  '/static/js/bundle.js',
  '/static/css/main.css',
  '/manifest.json',
  '/favicon.ico'
];

// API routes to cache
const API_CACHE_PATTERNS = [
  /\/api\/v1\/vocab/,
  /\/api\/v1\/srs/,
  /\/api\/v1\/auth\/refresh/
];

// Install event - cache static assets
self.addEventListener('install', (event) => {
  console.log('[SW] Installing...');
  
  event.waitUntil(
    caches.open(STATIC_CACHE)
      .then((cache) => {
        console.log('[SW] Caching static assets');
        return cache.addAll(STATIC_ASSETS);
      })
      .then(() => self.skipWaiting())
  );
});

// Activate event - clean up old caches
self.addEventListener('activate', (event) => {
  console.log('[SW] Activating...');
  
  event.waitUntil(
    caches.keys()
      .then((cacheNames) => {
        return Promise.all(
          cacheNames.map((cacheName) => {
            if (cacheName !== STATIC_CACHE && cacheName !== DYNAMIC_CACHE) {
              console.log('[SW] Deleting old cache:', cacheName);
              return caches.delete(cacheName);
            }
          })
        );
      })
      .then(() => self.clients.claim())
  );
});

// Fetch event - implement caching strategies
self.addEventListener('fetch', (event) => {
  const { request } = event;
  const url = new URL(request.url);

  // Skip non-GET requests
  if (request.method !== 'GET') {
    return;
  }

  // Handle different types of requests
  if (isStaticAsset(request)) {
    // Cache first for static assets
    event.respondWith(cacheFirst(request, STATIC_CACHE));
  } else if (isAPIRequest(request)) {
    // Network first with cache fallback for API requests
    event.respondWith(networkFirstWithFallback(request, DYNAMIC_CACHE));
  } else if (isImageRequest(request)) {
    // Cache first for images
    event.respondWith(cacheFirst(request, DYNAMIC_CACHE));
  } else {
    // Network first for other requests
    event.respondWith(networkFirst(request, DYNAMIC_CACHE));
  }
});

// Cache first strategy
async function cacheFirst(request, cacheName) {
  const cachedResponse = await caches.match(request);
  
  if (cachedResponse) {
    console.log('[SW] Serving from cache:', request.url);
    return cachedResponse;
  }
  
  try {
    const networkResponse = await fetch(request);
    
    if (networkResponse.ok) {
      const cache = await caches.open(cacheName);
      cache.put(request, networkResponse.clone());
      console.log('[SW] Cached new resource:', request.url);
    }
    
    return networkResponse;
  } catch (error) {
    console.error('[SW] Fetch failed:', error);
    throw error;
  }
}

// Network first strategy
async function networkFirst(request, cacheName) {
  try {
    const networkResponse = await fetch(request);
    
    if (networkResponse.ok) {
      const cache = await caches.open(cacheName);
      cache.put(request, networkResponse.clone());
      console.log('[SW] Updated cache from network:', request.url);
    }
    
    return networkResponse;
  } catch (error) {
    console.log('[SW] Network failed, trying cache:', request.url);
    const cachedResponse = await caches.match(request);
    
    if (cachedResponse) {
      return cachedResponse;
    }
    
    throw error;
  }
}

// Network first with fallback for API requests
async function networkFirstWithFallback(request, cacheName) {
  try {
    const networkResponse = await fetch(request);
    
    // Only cache successful API responses
    if (networkResponse.ok && networkResponse.status < 400) {
      const cache = await caches.open(cacheName);
      
      // Set cache expiration for API responses (5 minutes)
      const responseToCache = new Response(networkResponse.clone().body, {
        status: networkResponse.status,
        statusText: networkResponse.statusText,
        headers: {
          ...networkResponse.headers,
          'sw-cached-at': Date.now().toString()
        }
      });
      
      cache.put(request, responseToCache);
      console.log('[SW] Cached API response:', request.url);
    }
    
    return networkResponse;
  } catch (error) {
    console.log('[SW] API request failed, trying cache:', request.url);
    const cachedResponse = await caches.match(request);
    
    if (cachedResponse) {
      // Check if cached API response is still valid (5 minutes)
      const cachedAt = cachedResponse.headers.get('sw-cached-at');
      const now = Date.now();
      
      if (cachedAt && (now - parseInt(cachedAt)) < 5 * 60 * 1000) {
        console.log('[SW] Serving fresh cached API response');
        return cachedResponse;
      } else {
        console.log('[SW] Cached API response expired');
        caches.delete(request);
      }
    }
    
    // Return offline page for navigation requests
    if (request.mode === 'navigate') {
      return caches.match('/offline.html');
    }
    
    throw error;
  }
}

// Helper functions
function isStaticAsset(request) {
  return request.url.includes('/static/') || 
         request.url.endsWith('.js') || 
         request.url.endsWith('.css') ||
         request.url.endsWith('.woff2') ||
         request.url.endsWith('.woff');
}

function isAPIRequest(request) {
  return request.url.includes('/api/');
}

function isImageRequest(request) {
  const url = request.url;
  return url.endsWith('.jpg') || 
         url.endsWith('.jpeg') || 
         url.endsWith('.png') || 
         url.endsWith('.gif') || 
         url.endsWith('.webp') ||
         url.endsWith('.svg');
}

// Background sync for offline actions
self.addEventListener('sync', (event) => {
  console.log('[SW] Background sync:', event.tag);
  
  if (event.tag === 'background-sync') {
    event.waitUntil(doBackgroundSync());
  }
});

async function doBackgroundSync() {
  try {
    // Handle offline actions stored in IndexedDB
    console.log('[SW] Performing background sync');
    // Implementation would sync offline actions when online
  } catch (error) {
    console.error('[SW] Background sync failed:', error);
  }
}

// Push notifications
self.addEventListener('push', (event) => {
  if (event.data) {
    const data = event.data.json();
    
    event.waitUntil(
      self.registration.showNotification(data.title, {
        body: data.body,
        icon: '/icon-192x192.png',
        badge: '/badge-72x72.png',
        tag: data.tag,
        actions: data.actions
      })
    );
  }
});

// Notification click handling
self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  
  event.waitUntil(
    clients.openWindow(event.notification.data?.url || '/')
  );
});