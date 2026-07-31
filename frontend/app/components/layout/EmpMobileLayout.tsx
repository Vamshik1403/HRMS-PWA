"use client";

import { Suspense, useEffect, useState, useRef, useCallback } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import EmpPortalShell, { useEmpPortalLayout } from "./EmpPortalShell";
import { useInsideEmpPortalShell } from "./EmpPortalShellContext";
import { Icon } from "@iconify/react";
import {
  registerPushSubscription,
  resetPushClientStateIfNeeded,
} from "@/lib/pushSubscribe";
import { refreshHomeScreenBadge } from "@/lib/empNotificationBadge";
import {
  appendInAppNotification,
  pushPayloadToInAppNotification,
  upsertInAppNotification,
} from "../../utils/empInAppNotifications";
import { empPayoutHrefForPeriod } from "../../utils/empPayslipApi";
import PushNotificationPrompt from "../PushNotificationPrompt";
import { EmpMarkoutReminderBanner } from "../emp/EmpMarkoutReminderBanner";
import { toast } from "sonner";
import { TASK_MANAGEMENT_ENABLED } from "@/app/config/featureFlags";
import { ensureFetchRefreshPatch } from "@/app/utils/patchFetchForRefresh";
import { applyEmpTheme, readStoredEmpTheme } from "@/app/utils/empTheme";

interface EmpMobileLayoutProps {
  children: React.ReactNode;
  /** Hide bottom tab bar (e.g. full-screen task chat) */
  hideBottomNav?: boolean;
}

/** Returns true when the app is running as an installed PWA (standalone mode). */
function isRunningStandalone(): boolean {
  if (typeof window === "undefined") return false;
  const nav = window.navigator as Navigator & { standalone?: boolean };
  if (nav.standalone === true) return true;
  try {
    if (window.matchMedia("(display-mode: standalone)").matches) return true;
    if (window.matchMedia("(display-mode: fullscreen)").matches) return true;
    if (window.matchMedia("(display-mode: minimal-ui)").matches) return true;
  } catch {
    /* ignore */
  }
  return false;
}

function isIOSDevice(): boolean {
  if (typeof navigator === "undefined") return false;
  return /iPad|iPhone|iPod/.test(navigator.userAgent);
}

const navItems = [
  { label: "Home",         icon: "solar:home-2-bold-duotone",    outlineIcon: "solar:home-2-linear",         href: "/empdashboard" },
  { label: "Attendance",   icon: "solar:map-point-bold-duotone", outlineIcon: "solar:map-point-linear",      href: "/empAttendance" },
  { label: "Leave",        icon: "solar:calendar-bold-duotone",  outlineIcon: "solar:calendar-linear",       href: "/empLeaveApplication" },
  { label: "Reimbursement", icon: "solar:wallet-bold-duotone",   outlineIcon: "solar:wallet-linear",         href: "/empReimbursement" },
  { label: "Payout",       icon: "solar:bill-bold-duotone",      outlineIcon: "solar:bill-linear",           href: "/empPayout" },
  ...(TASK_MANAGEMENT_ENABLED
    ? [{ label: "Tasks", icon: "solar:checklist-bold-duotone", outlineIcon: "solar:checklist-linear", href: "/empMyTasks" }]
    : []),
];

export default function EmpMobileLayout({ children, hideBottomNav = false }: EmpMobileLayoutProps) {
  const insidePortalShell = useInsideEmpPortalShell();
  const { desktop: isPortalDesktop, ready } = useEmpPortalLayout();
  if (!ready) {
    return <div className="min-h-screen bg-[#f1f5f9]" />;
  }
  if (isPortalDesktop) {
    if (insidePortalShell) {
      return <>{children}</>;
    }
    return (
      <Suspense fallback={<div className="min-h-screen bg-[#f1f5f9]" />}>
        <EmpPortalShell hideBottomNav={hideBottomNav}>{children}</EmpPortalShell>
      </Suspense>
    );
  }
  return <EmpMobileLayoutInner hideBottomNav={hideBottomNav}>{children}</EmpMobileLayoutInner>;
}

function EmpMobileLayoutInner({ children, hideBottomNav = false }: EmpMobileLayoutProps) {
  const pathname = usePathname();
  const router = useRouter();
  const [showInstallBanner, setShowInstallBanner] = useState(false);
  const [showNotifButton, setShowNotifButton] = useState(false);
  const [pushModalOpen, setPushModalOpen] = useState(false);
  const [theme, setTheme] = useState<"light" | "dark">("light");
  const syncInFlight = useRef(false);

  useEffect(() => {
    ensureFetchRefreshPatch();
  }, []);

  useEffect(() => {
    const applyStoredTheme = () => {
      const next = readStoredEmpTheme();
      setTheme(next);
      applyEmpTheme(next);
    };

    applyStoredTheme();
    window.addEventListener("emp-theme-change", applyStoredTheme);
    window.addEventListener("storage", applyStoredTheme);
    return () => {
      window.removeEventListener("emp-theme-change", applyStoredTheme);
      window.removeEventListener("storage", applyStoredTheme);
    };
  }, []);

  // Auth guard
  useEffect(() => {
    const token = localStorage.getItem("token") || localStorage.getItem("accessToken");
    if (!token) router.replace("/login");
  }, [router]);

  const syncPushSubscription = useCallback(async (requestPermission = false) => {
    if (syncInFlight.current) return;
    syncInFlight.current = true;
    try {
      const result = await registerPushSubscription(requestPermission);
      if (result.ok) {
        setShowNotifButton(false);
        if (requestPermission) toast.success("Notifications enabled");
      } else {
        console.warn("[push]", result.reason);
        localStorage.removeItem("_push_subscribed");
        if (result.reason.includes("denied")) {
          toast.error("Notifications blocked in browser settings");
        } else if (
          Notification.permission === "default" ||
          Notification.permission === "granted"
        ) {
          setShowNotifButton(true);
        }
      }
    } finally {
      syncInFlight.current = false;
    }
  }, []);

  const doSubscribe = useCallback(async () => {
    await syncPushSubscription(true);
  }, [syncPushSubscription]);

  // Push: reset stale flags after reinstall; layout only syncs when permission already granted
  useEffect(() => {
    resetPushClientStateIfNeeded();

    const setup = async () => {
      if (!("Notification" in window) || !("serviceWorker" in navigator) || !("PushManager" in window)) {
        return;
      }

      const standalone = isRunningStandalone();
      const isIOS = isIOSDevice();

      if (!standalone && isIOS) {
        setShowInstallBanner(true);
        return;
      }

      if (Notification.permission === "granted") {
        await syncPushSubscription(false);
      } else if (Notification.permission === "default") {
        setShowNotifButton(true);
      }
    };

    void setup();
  }, [syncPushSubscription]);

  useEffect(() => {
    const refresh = () => {
      if (document.visibilityState === "visible") {
        void refreshHomeScreenBadge();
      }
    };
    void refreshHomeScreenBadge();
    document.addEventListener("visibilitychange", refresh);
    const interval = setInterval(() => {
      if (document.visibilityState === "visible") void refreshHomeScreenBadge();
    }, 60000);
    return () => {
      document.removeEventListener("visibilitychange", refresh);
      clearInterval(interval);
    };
  }, []);

  useEffect(() => {
    if (!("serviceWorker" in navigator)) return;
    const onMessage = (event: MessageEvent) => {
      const data = event.data;
      if (!data) return;
      if (data.type === "NOTIFICATION_CLICK" && typeof data.url === "string") {
        const path = data.url.startsWith("/") ? data.url : `/${data.url}`;
        router.push(path);
        return;
      }
      if (data.type !== "PUSH_NOTIFICATION") return;
      const title = String(data.title || "OpenHRM");
      const body = String(data.body || "");
      if (data.kind === "task" && data.event === "chat" && data.taskId != null) {
        upsertInAppNotification({
          id: `task-chat-${data.taskId}`,
          kind: "task",
          title,
          body,
          emoji: "💬",
          at: new Date().toISOString(),
          href: "/empMyTasks",
          ...(data.isTeamNotification
            ? { isTeamItem: true, subjectEmployeeId: data.subjectEmployeeId }
            : {}),
        });
      } else {
        const row = pushPayloadToInAppNotification({
          title,
          body,
          url: data.url,
          kind: data.kind,
          memoId: data.memoId != null ? Number(data.memoId) : undefined,
          isTeamNotification: data.isTeamNotification,
          subjectEmployeeId: data.subjectEmployeeId,
        });
        if (row.kind === "payslip" && data.isTeamNotification) {
          void refreshHomeScreenBadge();
          return;
        }
        if (
          row.kind === "payslip" &&
          row.href === "/empPayout" &&
          typeof body === "string"
        ) {
          const periodMatch = body.match(/for (.+?) is ready/i);
          if (periodMatch?.[1]) {
            row.href = empPayoutHrefForPeriod(periodMatch[1].trim());
          }
        }
        const isPaid =
          data.event === "paid" || /salary paid|marked as paid/i.test(title);
        if (isPaid) row.emoji = "💰";
        appendInAppNotification(row);
      }
      void refreshHomeScreenBadge();
    };
    navigator.serviceWorker.addEventListener("message", onMessage);
    return () => navigator.serviceWorker.removeEventListener("message", onMessage);
  }, [router]);

  const isActive = (href: string) => pathname === href || pathname.startsWith(href + "/");

  return (
    <div className="emp-pwa-shell emp-pwa-page-bg" data-theme={theme} style={{ position: 'fixed', inset: 0, display: 'flex', flexDirection: 'column', overscrollBehavior: 'none' }}>
      <PushNotificationPrompt
        onSubscribed={() => setShowNotifButton(false)}
        onModalOpenChange={setPushModalOpen}
      />
      {/* Top safe-area spacer — prevents content going under notch/status bar */}
      <div className="emp-pwa-safe-top shrink-0" style={{ height: 'env(safe-area-inset-top)' }} />

      {/* iOS install-to-homescreen banner */}
      {showInstallBanner && (
        <div className="flex items-center justify-between gap-2 px-4 py-2 bg-blue-600 text-white text-xs" style={{ flexShrink: 0 }}>
          <span>Add to Home Screen to enable notifications</span>
          <button
            onClick={() => { setShowInstallBanner(false); localStorage.setItem("_push_banner_dismissed", "1"); }}
            className="text-white/80 hover:text-white font-bold text-sm leading-none"
            aria-label="Dismiss"
          >
            ✕
          </button>
        </div>
      )}

      {/* Enable notifications button (standalone, permission not yet requested) */}
      {showNotifButton && !pushModalOpen && (
        <div className="flex items-center justify-between gap-2 px-4 py-2 bg-blue-600 text-white text-xs" style={{ flexShrink: 0 }}>
          <span>Enable push notifications</span>
          <button
            onClick={doSubscribe}
            className="bg-white text-blue-600 font-semibold rounded-full px-3 py-0.5 text-xs"
          >
            Enable
          </button>
        </div>
      )}

      {/* Main scrollable content */}
      <main
        className="flex-1 overflow-y-auto overscroll-none"
        style={{
          paddingBottom: hideBottomNav ? 'env(safe-area-inset-bottom)' : 'calc(56px + env(safe-area-inset-bottom))',
          WebkitOverflowScrolling: 'touch',
          overscrollBehavior: 'none',
        }}
      >
        {!hideBottomNav && <EmpMarkoutReminderBanner />}
        {children}
      </main>

      {/* Bottom nav bar */}
      {!hideBottomNav && (
      <nav className="emp-pwa-bottom-nav fixed bottom-0 inset-x-0 z-50 bg-white/95 backdrop-blur-md border-t border-gray-100/80 shadow-[0_-2px_16px_rgba(0,0,0,0.06)]" style={{ paddingBottom: 'env(safe-area-inset-bottom)' }}>
        <div className="flex items-center justify-around h-[56px] px-2">
          {navItems.map((item) => {
            const active = isActive(item.href);
            return (
              <Link
                key={item.href}
                href={item.href}
                className="flex flex-col items-center justify-center gap-0.5 min-w-[48px] py-1 group"
              >
                <div className={`w-7 h-7 rounded-lg flex items-center justify-center transition-all duration-200 ${
                  active ? "bg-[#4f46e5]/10" : ""
                }`}>
                  <Icon
                    icon={active ? item.icon : item.outlineIcon}
                    className={`w-[20px] h-[20px] transition-colors duration-200 ${
                      active ? "text-[#4f46e5]" : "text-gray-400 group-active:text-gray-600"
                    }`}
                  />
                </div>
                <span className={`text-[9px] font-semibold tracking-tight transition-colors duration-200 ${
                  active ? "text-[#4f46e5]" : "text-gray-400 group-active:text-gray-500"
                }`}>
                  {item.label}
                </span>
              </Link>
            );
          })}
        </div>
      </nav>
      )}
    </div>
  );
}
