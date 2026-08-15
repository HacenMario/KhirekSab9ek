self.addEventListener('push', event => {
  let payload = { title: 'تنبيه', body: '', data: {} };
  if (event.data) {
    try { payload = event.data.json(); } catch(e) { payload.body = event.data.text(); }
  }
  const { title, body, data } = payload;
  event.waitUntil(
    self.registration.showNotification(title, {
      body,
      icon: '/icon-192.png',
      badge: '/badge-72.png',
      vibrate: [200, 100, 200],
      tag: 'KhirekSab9ek',
      data: data || {}
    })
  );
});

self.addEventListener('notificationclick', event => {
  event.notification.close();
  let url = '/';
  if (event.notification.data && event.notification.data.adId) {
    url = `/#/chat/${event.notification.data.adId}`;
  }
  event.waitUntil(clients.openWindow(url));
});
