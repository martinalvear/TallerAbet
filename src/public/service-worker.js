self.addEventListener('install', event => {
  event.waitUntil(
    caches.open('wst-cache').then(cache => {
      return cache.addAll([
        '/dashboard',
        '/styles/main.css',
        '/scripts/main.js',
        '/materiales',
        '/sedes',
        '/empleados',
        '/tickets',
        '/clientes',
        '/icons/android-chrome-192x192.png',
        '/icons/android-chrome-512x512.png'
      ]).catch(error => {
        console.error('Failed to cache resources:', error);
      });
    })
  );
  self.skipWaiting();
});

self.addEventListener('fetch', event => {
  event.respondWith(
    fetch(event.request).then(fetchResponse => {
      return caches.open('wst-cache').then(cache => {
        cache.put(event.request, fetchResponse.clone());
        return fetchResponse;
      });
    }).catch(() => {
      return caches.match(event.request).then(response => {
        return response || caches.match('/offline.html'); // Reemplaza con tu página de fallback si es necesario
      });
    })
  );
});

self.addEventListener('push', e => {
  const data = e.data.json();
  console.log('Push Received...', data);
  
  const options = {
    body: data.message,
    icon: '/icons/android-chrome-512x512.png',
    vibrate: [200, 100, 200, 100, 200, 100, 200],
    tag: "vibration-sample",
    data: {
      url: data.url // URL dinámica desde el payload
    }
  };

  e.waitUntil(
    self.registration.showNotification(data.title, options)
  );
});

self.addEventListener('notificationclick', function(event) {
  event.notification.close(); // Cierra la notificación

  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then(function(clientList) {
      if (clientList.length > 0) {
        let client = clientList[0];
        for (let i = 0; i < clientList.length; i++) {
          if (clientList[i].focused) {
            client = clientList[i];
          }
        }
        return client.focus().then(() => {
          client.navigate(event.notification.data.url);
        });
      }
      return clients.openWindow(event.notification.data.url);
    })
  );
});
