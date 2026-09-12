/* Shared push notification deep-link routing for push-sw.js and worker-push.js */
"use strict";

function absoluteNotificationUrl(path) {
  try {
    return new URL(path || "/empdashboard", self.location.origin).href;
  } catch (e) {
    return self.location.origin + "/empdashboard";
  }
}

function normalizeNotificationPath(path) {
  if (!path || typeof path !== "string") return "/empdashboard";
  var trimmed = path.trim();
  if (!trimmed) return "/empdashboard";
  return trimmed.charAt(0) === "/" ? trimmed : "/" + trimmed;
}

/** Resolve employee PWA path from push payload (url takes precedence, then kind). */
function resolveNotificationPath(inner) {
  inner = inner || {};
  if (inner.url && typeof inner.url === "string" && inner.url.trim()) {
    return normalizeNotificationPath(inner.url);
  }

  var kind = String(inner.kind || "").toLowerCase();
  switch (kind) {
    case "memo":
      return "/empProfile?tab=messaging";
    case "attendance":
      return "/empdashboard";
    case "leave":
      return "/empLeaveApplication";
    case "reimbursement":
      return "/empReimbursement";
    case "payslip":
      return "/empPayout";
    case "task":
      return "/empMyTasks";
    case "holiday":
      return "/empHolidays";
    case "birthday":
      return "/empdashboard";
    default:
      return "/empdashboard";
  }
}

function isTaskRequestNotification(inner) {
  inner = inner || {};
  if (String(inner.event || "") === "task-request") return true;
  var tag = String(inner.tag || "");
  return tag.indexOf("task-request-") === 0;
}

function resolveTaskRequestClickPath(inner, action) {
  inner = inner || {};
  var taskId = inner.taskId;
  if (isTaskRequestNotification(inner) && taskId != null && String(taskId) !== "") {
    if (action === "accept") {
      return "/empMyTasks?tab=Requests&acceptTask=" + encodeURIComponent(String(taskId));
    }
    return "/empMyTasks?tab=Requests&rescheduleTask=" + encodeURIComponent(String(taskId));
  }
  return resolveNotificationPath(inner);
}

function buildNotificationClickData(inner) {
  inner = inner || {};
  var path = resolveNotificationPath(inner);
  return {
    url: path,
    kind: inner.kind || "general",
    event: inner.event || "",
    memoId: inner.memoId != null ? inner.memoId : undefined,
    taskId: inner.taskId != null ? inner.taskId : undefined,
    tag: inner.tag || "",
  };
}

function navigateToNotificationPath(path) {
  var normalized = normalizeNotificationPath(path);
  var target = absoluteNotificationUrl(normalized);

  return clients.matchAll({ type: "window", includeUncontrolled: true }).then(function (list) {
    for (var i = 0; i < list.length; i++) {
      var client = list[i];
      if (!("focus" in client)) continue;

      if ("navigate" in client) {
        return client.focus().then(function () {
          return client.navigate(target);
        });
      }

      client.postMessage({ type: "NOTIFICATION_CLICK", url: normalized });
      return client.focus();
    }

    if (clients.openWindow) {
      return clients.openWindow(target);
    }
  });
}
