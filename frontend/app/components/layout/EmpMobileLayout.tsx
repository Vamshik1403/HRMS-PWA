"use client";

import { useEffect, useState, useRef, useCallback } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { Icon } from "@iconify/react";

interface EmpMobileLayoutProps {
  children: React.ReactNode;
}

function urlBase64ToUint8Array(base64String: string): Uint8Array<ArrayBuffer> {
  const padding = "=".repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, "+").replace(/_/g, "/");
  const rawData = window.atob(base64);
  const outputArray = new Uint8Array(rawData.length);
  for (let i = 0; i < rawData.length; ++i) {
    outputArray[i] = rawData.charCodeAt(i);
  }
  return outputArray;
}

/** Returns true when the app is running as an installed PWA (standalone mode). */
function isRunningStandalone(): boolean {
  if (typeof window === "undefined") return false;
  return (
    window.matchMedia("(display-mode: standalone)").matches ||
    (window.navigator as any).standalone === true
  );
}

const navItems = [
  { label: "Home",       icon: "solar:home-2-bold-duotone",        outlineIcon: "solar:home-2-linear",           href: "/empdashboard" },
  { label: "Attendance", icon: "solar:map-point-bold-duotone",     outlineIcon: "solar:map-point-linear",        href: "/empAttendance" },
  { label: "History",    icon: "solar:clock-circle-bold-duotone",  outlineIcon: "solar:clock-circle-linear",     href: "/empHistory" },
  { label: "Leave",      icon: "solar:calendar-bold-duotone",      outlineIcon: "solar:calendar-linear",         href: "/empLeaveApplication" },
  { label: "Tasks",      icon: "solar:checklist-bold-duotone",     outlineIcon: "solar:checklist-linear",        href: "/empMyTasks" },
  { label: "Profile",    icon: "solar:user-bold-duotone",          outlineIcon: "solar:user-linear",             href: "/empProfile" },
];

export default function EmpMobileLayout({ children }: EmpMobileLayoutProps) {
  const pathname = usePathname();
  const router = useRouter();
  const [showInstallBanner, setShowInstallBanner] = useState(false);
  const [showNotifButton, setShowNotifButton] = useState(false);
  const subscribeAttempted = useRef(false);

  // Auth guard
  useEffect(() => {
    const token = localStorage.getItem("token") || localStorage.getItem("accessToken");
    if (!token) router.replace("/login");
  }, [router]);

  const doSubscribe = useCallback(async () => {
    try {
      if (!("serviceWorker" in navigator) || !("PushManager" in window)) return;
      const userRaw = localStorage.getItem("user");
      if (!userRaw) return;
      const user = JSON.parse(userRaw);
      const employeeID = user?.employee?.id;
      if (!employeeID) return;

      // Request permission (must be called within a user gesture on iOS)
      const permission = await Notification.requestPermission();
      if (permission !== "granted") return;

      const reg = await navigator.serviceWorker.ready;
      const keyRes = await fetch("/backend/push-notifications/vapid-public-key");
      if (!keyRes.ok) return;
      const { publicKey } = await keyRes.json();

      const appServerKey = urlBase64ToUint8Array(publicKey);
      const subscription = await reg.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: appServerKey,
      });

      await fetch("/backend/push-notifications/subscribe", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ employeeID, subscription }),
      });

      // Remember that we've subscribed so we don't show the button again
      localStorage.setItem("_push_subscribed", "1");
      setShowNotifButton(false);
    } catch {
      // Non-critical
    }
  }, []);

  // Push notification setup
  useEffect(() => {
    const setup = async () => {
      if (!("Notification" in window) || !("serviceWorker" in navigator) || !("PushManager" in window)) return;
      if (subscribeAttempted.current) return;
      subscribeAttempted.current = true;

      const standalone = isRunningStandalone();
      // iOS requires standalone (Add to Home Screen) for push to work.
      // Detect iOS by checking for standalone property on navigator (only exists on iOS Safari).
      const isIOS = typeof (window.navigator as any).standalone !== "undefined";

      if (!standalone && isIOS) {
        // iOS not in standalone mode — push won't work, show install prompt
        setShowInstallBanner(true);
        return;
      }

      // Already subscribed this session — skip
      if (localStorage.getItem("_push_subscribed") === "1") return;

      const permState = Notification.permission;

      if (permState === "granted") {
        // Already granted — re-subscribe silently (handles app reinstalls / new SW)
        await doSubscribe();
      } else if (permState === "default") {
        // Show enable button so user can grant permission via gesture
        setShowNotifButton(true);
      }
      // If "denied" — nothing we can do
    };

    setup();
  }, [doSubscribe]);

  const isActive = (href: string) => pathname === href || pathname.startsWith(href + "/");

  return (
    <div className="bg-[#f2f4f7]" style={{ position: 'fixed', inset: 0, display: 'flex', flexDirection: 'column', overscrollBehavior: 'none' }}>
      {/* Top safe-area spacer — prevents content going under notch/status bar */}
      <div style={{ height: 'env(safe-area-inset-top)', background: '#f2f4f7', flexShrink: 0 }} />

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
      {showNotifButton && (
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
      <main className="flex-1 overflow-y-auto overscroll-none" style={{ paddingBottom: 'calc(72px + env(safe-area-inset-bottom))', WebkitOverflowScrolling: 'touch', overscrollBehavior: 'none' }}>
        {children}
      </main>

      {/* Bottom nav bar */}
      <nav className="fixed bottom-0 inset-x-0 z-50 bg-white border-t border-gray-100 shadow-[0_-4px_24px_rgba(0,0,0,0.07)]" style={{ paddingBottom: 'env(safe-area-inset-bottom)' }}>
        <div className="flex items-center justify-around h-[60px] px-3">
          {navItems.map((item) => {
            const active = isActive(item.href);
            return (
              <Link
                key={item.href}
                href={item.href}
                className="flex flex-col items-center justify-center gap-0.5 min-w-[48px] py-1 group"
              >
                <div className={`w-8 h-8 rounded-xl flex items-center justify-center transition-all duration-200 ${
                  active ? "bg-blue-50" : ""
                }`}>
                  <Icon
                    icon={active ? item.icon : item.outlineIcon}
                    className={`w-[22px] h-[22px] transition-colors duration-200 ${
                      active ? "text-[#2563eb]" : "text-gray-400 group-hover:text-gray-600"
                    }`}
                  />
                </div>
                <span className={`text-[10px] font-semibold tracking-tight transition-colors duration-200 ${
                  active ? "text-[#2563eb]" : "text-gray-400 group-hover:text-gray-500"
                }`}>
                  {item.label}
                </span>
              </Link>
            );
          })}
        </div>
      </nav>
    </div>
  );
}
