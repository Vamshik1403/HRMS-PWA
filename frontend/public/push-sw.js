/* Push + home-screen icon badge (Badging API — required on iOS PWA) */
"use strict";

var BADGE_CACHE = "openhrm-badge-v1";
var BADGE_CACHE_KEY = "https://openhrm.internal/badge-count";

function absoluteUrl(path) {
  try {
    return new URL(path || "/", self.location.origin).href;
  } catch (e) {
    return self.location.origin + "/";
  }
}

function readBadgeCount() {
  return caches.open(BADGE_CACHE).then(function (cache) {
    return cache.match(BADGE_CACHE_KEY).then(function (res) {
      if (!res) return 0;
      return res.text().then(function (text) {
        var n = parseInt(text, 10);
        return Number.isFinite(n) && n > 0 ? n : 0;
      });
    });
  });
}

function writeBadgeCount(count) {
  var safe = Math.max(0, Math.floor(count));
  return caches.open(BADGE_CACHE).then(function (cache) {
    return cache.put(BADGE_CACHE_KEY, new Response(String(safe)));
  });
}

function bumpBadgeCount(delta) {
  return readBadgeCount().then(function (current) {
    var next = Math.max(0, current + (delta || 1));
    return writeBadgeCount(next).then(function () {
      return next;
    });
  });
}

function applyAppBadge(count) {
  if (!("setAppBadge" in navigator)) return Promise.resolve();
  if (count > 0) return navigator.setAppBadge(count);
  return navigator.clearAppBadge();
}

self.addEventListener("install", function () {
  self.skipWaiting();
});

self.addEventListener("activate", function (event) {
  event.waitUntil(self.clients.claim());
});

self.addEventListener("push", function (event) {
  var data = {};
  try {
    data = event.data ? event.data.json() : {};
  } catch (e) {
    data = { title: "OpenHRM", body: event.data ? event.data.text() : "" };
  }
  var title = data.title || "OpenHRM";
  var inner = data.data || {};
  var options = {
    body: data.body || "You have a new notification",
    icon: "/icons/icon-192.png",
    badge: "/icons/icon-192.png",
    data: { url: inner.url || "/" },
    renotify: true,
  };
  if (inner.tag) {
    options.tag = String(inner.tag);
  } else {
    options.tag = "openhrm-" + Date.now();
  }

  var badgePromise;
  if (typeof inner.badgeCount === "number" && inner.badgeCount >= 0) {
    badgePromise = writeBadgeCount(inner.badgeCount).then(applyAppBadge);
  } else {
    badgePromise = bumpBadgeCount(1).then(applyAppBadge);
  }

  event.waitUntil(
    Promise.all([
      badgePromise,
      self.registration.showNotification(title, options),
      clients.matchAll({ type: "window", includeUncontrolled: true }).then(function (list) {
        list.forEach(function (client) {
          client.postMessage({
            type: "PUSH_NOTIFICATION",
            title: title,
            body: options.body,
            url: options.data.url,
            kind: inner.kind || "general",
            event: inner.event || "",
            memoId: inner.memoId != null ? inner.memoId : undefined,
            taskId: inner.taskId != null ? inner.taskId : undefined,
            tag: inner.tag || options.tag || "",
            subjectEmployeeId:
              inner.subjectEmployeeId != null ? inner.subjectEmployeeId : undefined,
            isTeamNotification: !!inner.isTeamNotification,
          });
        });
      }),
    ]),
  );
});

self.addEventListener("message", function (event) {
  var msg = event.data;
  if (!msg || msg.type !== "SET_BADGE_COUNT") return;
  var count = Number(msg.count);
  if (!Number.isFinite(count)) return;
  event.waitUntil(
    writeBadgeCount(count).then(function () {
      return applyAppBadge(count);
    }),
  );
});

self.addEventListener("notificationclick", function (event) {
  event.notification.close();
  var path = (event.notification.data && event.notification.data.url) || "/";
  var target = absoluteUrl(path);
  event.waitUntil(
    clients.matchAll({ type: "window", includeUncontrolled: true }).then(function (list) {
      for (var i = 0; i < list.length; i++) {
        var client = list[i];
        if (client.url.indexOf(path) >= 0 && "focus" in client) {
          return client.focus();
        }
      }
      if (clients.openWindow) {
        return clients.openWindow(target);
      }
    }),
  );
});
