importScripts('/push-notification-routing.js');

self.addEventListener('push', function (event) {
  var data = {};
  try {
    data = event.data ? event.data.json() : {};
  } catch (e) {
    data = { title: 'OpenHRM', body: event.data ? event.data.text() : '' };
  }
  var title = data.title || 'OpenHRM';
  var inner = data.data || {};
  var clickData = buildNotificationClickData(inner);
  var options = {
    body: data.body || 'You have a new notification',
    icon: '/icons/icon-192.png',
    badge: '/icons/icon-192.png',
    data: clickData,
    requireInteraction: false,
  };
  if (inner.tag) {
    options.tag = String(inner.tag);
  }
  event.waitUntil(self.registration.showNotification(title, options));
});

self.addEventListener('notificationclick', function (event) {
  event.notification.close();
  var inner = event.notification.data || {};
  var path = resolveNotificationPath(inner);
  event.waitUntil(navigateToNotificationPath(path));
});
