// Custom service worker handlers included by next-pwa (compiled to worker-push.js)
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

  if (isTaskRequestNotification(inner)) {
    options.actions = [
      { action: 'accept', title: 'Accept' },
      { action: 'reschedule', title: 'Reschedule' },
    ];
  }
  event.waitUntil(self.registration.showNotification(title, options));
});

self.addEventListener('notificationclick', function (event) {
  event.notification.close();
  var inner = event.notification.data || {};
  var path = resolveTaskRequestClickPath(inner, event.action);
  event.waitUntil(navigateToNotificationPath(path));
});
