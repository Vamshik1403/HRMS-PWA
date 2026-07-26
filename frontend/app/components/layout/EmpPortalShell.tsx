"use client";

import { useCallback, useEffect, useLayoutEffect, useRef, useState } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { Eye, EyeOff } from "lucide-react";
import {
  registerPushSubscription,
  resetPushClientStateIfNeeded,
} from "@/lib/pushSubscribe";
import { refreshHomeScreenBadge } from "@/lib/empNotificationBadge";
import {
  appendInAppNotification,
  pushPayloadToInAppNotification,
  upsertInAppNotification,
} from "@/app/utils/empInAppNotifications";
import { empPayoutHrefForPeriod } from "@/app/utils/empPayslipApi";
import { EmpMarkoutReminderBanner } from "@/app/components/emp/EmpMarkoutReminderBanner";
import { toast } from "sonner";
import { ensureFetchRefreshPatch } from "@/app/utils/patchFetchForRefresh";
import { useEmpManagerScope } from "@/app/hooks/useEmpManagerScope";
import { isDesktopBrowser } from "@/lib/desktopManager";
import { resolveEmpPhoto } from "@/app/utils/empPhotoCache";
import { getPageCache } from "@/app/utils/pageCache";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/app/components/ui/dialog";
import { Button } from "@/app/components/ui/button";
import { Input } from "@/app/components/ui/input";
import { Label } from "@/app/components/ui/label";
import {
  resolveModuleWorkspace,
  visibleModuleTabs,
} from "./emp-portal-workspaces";
import { EmpSidebar } from "./EmpSidebar";
import { EmpWorkspaceTabNav } from "../emp/EmpWorkspaceTabNav";
import { EmpPortalTopbar } from "./EmpPortalTopbar";
import { EmpPortalPageProvider } from "./emp-portal-page-context";
import { applyEmpTheme, readStoredEmpTheme } from "@/app/utils/empTheme";
import {
  EMP_COMPANY_TABS,
  resolvePortalZone,
} from "./emp-portal-navigation";

interface EmpPortalShellProps {
  children: React.ReactNode;
  hideBottomNav?: boolean;
}

function isRunningStandalone(): boolean {
  if (typeof window === "undefined") return false;
  return (
    window.matchMedia("(display-mode: standalone)").matches ||
    (window.navigator as Navigator & { standalone?: boolean }).standalone === true
  );
}

export function useEmpPortalLayout(): { desktop: boolean; ready: boolean } {
  const [desktop, setDesktop] = useState(() =>
    typeof window !== "undefined" ? isDesktopBrowser() : false,
  );
  const [ready, setReady] = useState(() => typeof window !== "undefined");

  useLayoutEffect(() => {
    setDesktop(isDesktopBrowser());
    setReady(true);
  }, []);

  useEffect(() => {
    const check = () => setDesktop(isDesktopBrowser());
    window.addEventListener("resize", check);
    return () => window.removeEventListener("resize", check);
  }, []);

  return { desktop, ready };
}

export function useEmpPortalDesktop(): boolean {
  return useEmpPortalLayout().desktop;
}

function NavTabLink({
  href,
  active,
  children,
}: {
  href: string;
  active: boolean;
  children: React.ReactNode;
}) {
  return (
    <Link
      href={href}
      className={`px-4 py-2.5 text-sm font-medium whitespace-nowrap border-b-2 transition-colors ${
        active
          ? "border-primary text-primary"
          : "border-transparent text-muted-foreground hover:text-foreground hover:border-border"
      }`}
    >
      {children}
    </Link>
  );
}

export default function EmpPortalShell({ children, hideBottomNav = false }: EmpPortalShellProps) {
  const pathname = usePathname();
  const router = useRouter();
  const { isManagerView } = useEmpManagerScope();
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [theme, setTheme] = useState<"light" | "dark">("light");
  const [empUser, setEmpUser] = useState<any>(null);
  const [showChangePassword, setShowChangePassword] = useState(false);
  const [pwdForm, setPwdForm] = useState({ oldPassword: "", newPassword: "", confirmPassword: "" });
  const [pwdLoading, setPwdLoading] = useState(false);
  const [showOldPwd, setShowOldPwd] = useState(false);
  const [showNewPwd, setShowNewPwd] = useState(false);
  const [showConfirmPwd, setShowConfirmPwd] = useState(false);
  const syncInFlight = useRef(false);

  const activeZone = resolvePortalZone(pathname);
  const activeModule = resolveModuleWorkspace(pathname);

  const moduleTabs = activeModule
    ? visibleModuleTabs(activeModule, isManagerView)
    : [];

  const companyTabs = EMP_COMPANY_TABS;
  const showCompanyTabs = isManagerView && activeZone === "company";

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

  useEffect(() => {
    const token = localStorage.getItem("token") || localStorage.getItem("accessToken");
    if (!token) router.replace("/login");
  }, [router]);

  useEffect(() => {
    const syncUserFromStorage = () => {
      try {
        const stored = localStorage.getItem("user");
        if (!stored) return;
        const u = JSON.parse(stored);
        const empId = u?.employee?.id;
        const cached = getPageCache<any>("empProfileData");
        const apiPhoto =
          cached?.id === empId && cached?.employeePhotoUrl
            ? cached.employeePhotoUrl
            : u?.employee?.employeePhotoUrl;
        if (apiPhoto && u.employee) {
          u.employee.employeePhotoUrl = resolveEmpPhoto(empId, apiPhoto) ?? apiPhoto;
        }
        setEmpUser(u);
      } catch {
        /* ignore */
      }
    };
    syncUserFromStorage();
    window.addEventListener("emp-photo-updated", syncUserFromStorage);
    window.addEventListener("storage", syncUserFromStorage);
    return () => {
      window.removeEventListener("emp-photo-updated", syncUserFromStorage);
      window.removeEventListener("storage", syncUserFromStorage);
    };
  }, []);

  const syncPushSubscription = useCallback(async (requestPermission = false) => {
    if (syncInFlight.current) return;
    syncInFlight.current = true;
    try {
      const result = await registerPushSubscription(requestPermission);
      if (result.ok && requestPermission) toast.success("Notifications enabled");
    } finally {
      syncInFlight.current = false;
    }
  }, []);

  useEffect(() => {
    resetPushClientStateIfNeeded();
    if (Notification.permission === "granted") void syncPushSubscription(false);
  }, [syncPushSubscription]);

  useEffect(() => {
    const refresh = () => {
      if (document.visibilityState === "visible") void refreshHomeScreenBadge();
    };
    void refreshHomeScreenBadge();
    document.addEventListener("visibilitychange", refresh);
    return () => document.removeEventListener("visibilitychange", refresh);
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
        if (row.kind === "payslip" && row.href === "/empPayout" && typeof body === "string") {
          const periodMatch = body.match(/for (.+?) is ready/i);
          if (periodMatch?.[1]) row.href = empPayoutHrefForPeriod(periodMatch[1].trim());
        }
        appendInAppNotification(row);
      }
      void refreshHomeScreenBadge();
    };
    navigator.serviceWorker.addEventListener("message", onMessage);
    return () => navigator.serviceWorker.removeEventListener("message", onMessage);
  }, [router]);

  const empDisplayName = empUser?.employee
    ? `${empUser.employee.firstName || ""} ${empUser.employee.lastName || ""}`.trim() || empUser.username || "Employee"
    : empUser?.username || "Employee";
  const empInitials =
    empDisplayName
      .split(" ")
      .filter(Boolean)
      .slice(0, 2)
      .map((w: string) => w[0].toUpperCase())
      .join("") || "E";
  const headerPhotoUrl = resolveEmpPhoto(
    empUser?.employee?.id,
    empUser?.employee?.employeePhotoUrl,
  );

  const toggleTheme = () => {
    const next = theme === "dark" ? "light" : "dark";
    setTheme(next);
    localStorage.setItem("_emp_appearance", next);
    applyEmpTheme(next);
    window.dispatchEvent(new Event("emp-theme-change"));
  };

  const handleChangePassword = async () => {
    if (!pwdForm.oldPassword || !pwdForm.newPassword) {
      toast.error("All fields are required");
      return;
    }
    if (pwdForm.newPassword !== pwdForm.confirmPassword) {
      toast.error("Passwords do not match");
      return;
    }
    try {
      setPwdLoading(true);
      const empId = empUser?.employee?.id;
      if (!empId) {
        toast.error("Employee not found");
        return;
      }
      const res = await fetch(`/backend/manage-emp/${empId}/change-password`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ oldPassword: pwdForm.oldPassword, newPassword: pwdForm.newPassword }),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => null);
        throw new Error(err?.message || "Failed to change password");
      }
      toast.success("Password changed successfully");
      setShowChangePassword(false);
      setPwdForm({ oldPassword: "", newPassword: "", confirmPassword: "" });
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : "Failed to change password");
    } finally {
      setPwdLoading(false);
    }
  };

  const handleSidebarRefresh = useCallback(() => {
    router.refresh();
    void refreshHomeScreenBadge();
  }, [router]);

  return (
    <EmpPortalPageProvider>
    <div className="emp-pwa-shell emp-portal-desktop flex h-dvh max-h-dvh overflow-hidden bg-background" data-theme={theme}>

      <EmpSidebar
        collapsed={sidebarCollapsed}
        onToggle={() => setSidebarCollapsed((v) => !v)}
        onRefresh={handleSidebarRefresh}
      />

      {/* Main column */}
      <div className="flex-1 flex flex-col min-w-0 min-h-0">
        <div className="relative z-50 shrink-0">
        {/* Top navbar */}
        <EmpPortalTopbar
          theme={theme}
          onToggleTheme={toggleTheme}
          empDisplayName={empDisplayName}
          empInitials={empInitials}
          headerPhotoUrl={headerPhotoUrl}
          onChangePassword={() => setShowChangePassword(true)}
          onLogout={() => {
            localStorage.removeItem("accessToken");
            localStorage.removeItem("token");
            localStorage.removeItem("user");
            document.cookie = "accessToken=; path=/; max-age=0";
            window.location.href = "/login";
          }}
        />

        {showCompanyTabs && (
          <div className="shrink-0 bg-background border-b border-border px-4 flex gap-0.5 overflow-x-auto">
            {companyTabs.map((tab) => (
              <NavTabLink key={tab.id} href={tab.href} active={tab.match(pathname)}>
                {tab.label}
              </NavTabLink>
            ))}
          </div>
        )}

        {/* Module workspace tabs (Attendance, Leave, Payroll, etc.) */}
        {activeModule && activeModule.id !== "home" && activeModule.id !== "profile" && moduleTabs.length > 1 && (
          <EmpWorkspaceTabNav workspace={activeModule} tabs={moduleTabs} />
        )}
        </div>

        {!hideBottomNav && <EmpMarkoutReminderBanner />}

        <main className="emp-portal-main relative z-0 min-h-0 flex-1 overflow-y-auto overscroll-y-contain bg-background">
          <div className="hrms-admin-content emp-workspace-shell mx-auto w-full max-w-[1400px] px-8 py-6">
            {children}
          </div>
        </main>
      </div>

      <Dialog open={showChangePassword} onOpenChange={setShowChangePassword}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Change Password</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label>Current Password</Label>
              <div className="relative">
                <Input
                  type={showOldPwd ? "text" : "password"}
                  value={pwdForm.oldPassword}
                  onChange={(e) => setPwdForm({ ...pwdForm, oldPassword: e.target.value })}
                  className="pr-10"
                />
                <button
                  type="button"
                  onClick={() => setShowOldPwd((v) => !v)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400"
                  tabIndex={-1}
                >
                  {showOldPwd ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>
            <div>
              <Label>New Password</Label>
              <div className="relative">
                <Input
                  type={showNewPwd ? "text" : "password"}
                  value={pwdForm.newPassword}
                  onChange={(e) => setPwdForm({ ...pwdForm, newPassword: e.target.value })}
                  className="pr-10"
                />
                <button
                  type="button"
                  onClick={() => setShowNewPwd((v) => !v)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400"
                  tabIndex={-1}
                >
                  {showNewPwd ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>
            <div>
              <Label>Confirm New Password</Label>
              <div className="relative">
                <Input
                  type={showConfirmPwd ? "text" : "password"}
                  value={pwdForm.confirmPassword}
                  onChange={(e) => setPwdForm({ ...pwdForm, confirmPassword: e.target.value })}
                  className="pr-10"
                />
                <button
                  type="button"
                  onClick={() => setShowConfirmPwd((v) => !v)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400"
                  tabIndex={-1}
                >
                  {showConfirmPwd ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>
            <Button onClick={handleChangePassword} disabled={pwdLoading} className="w-full">
              {pwdLoading ? "Changing..." : "Change Password"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
    </EmpPortalPageProvider>
  );
}
