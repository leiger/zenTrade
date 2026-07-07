/* Service Worker for X Monitor push notifications */

self.addEventListener('push', (event) => {
  if (!event.data) return;

  let payload;
  try {
    payload = event.data.json();
  } catch {
    return;
  }

  const title = `[${payload.strategy_name || payload.strategy_type || 'X Monitor'}]`;
  const options = {
    body: payload.message || 'New alert',
    icon: '/favicon.ico',
    badge: '/favicon.ico',
    tag: payload.tag || 'xmonitor',
    renotify: true,
    data: {
      alert_id: payload.alert_id,
      polymarket_url: payload.polymarket_url,
    },
  };

  event.waitUntil(self.registration.showNotification(title, options));
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();

  const data = event.notification.data || {};
  const alertId = data.alert_id;
  // quant 预警跳 Musk Quant 页，其余跳 X Monitor
  const base = (event.notification.tag || '').startsWith('quant') ? '/musk-quant' : '/x-monitor';
  const url = alertId && base === '/x-monitor' ? `${base}?alert=${alertId}` : base;

  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then((windowClients) => {
      for (const client of windowClients) {
        if (client.url.includes(base) && 'focus' in client) {
          client.navigate(url);
          return client.focus();
        }
      }
      return clients.openWindow(url);
    })
  );
});
