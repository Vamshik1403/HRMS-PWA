"use client";

import { useEffect, useState, useCallback } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Icon } from "@iconify/react";
import EmpMobileLayout from "../components/layout/EmpMobileLayout";
import { getPageCache, setPageCache } from "../utils/pageCache";
import { clearLegacyEmpPhoto, resolveEmpPhoto } from "../utils/empPhotoCache";
import { EmpNotificationsPanel } from "../components/emp/EmpNotificationsPanel";
import { EmpTodayStatusCard } from "../components/emp/EmpTodayStatusCard";
import {
  countUnseenLeaveBadge,
  countUnseenReimbursementBadge,
} from "../utils/empHomeSeen";
import type { TodayStatus } from "../hooks/useEmpPunch";
import { taskFetch } from "../utils/taskApi";
import { syncAppBadge } from "@/lib/appBadge";
import { TASK_MANAGEMENT_ENABLED } from "../config/featureFlags";
import { isDesktopBrowser, isDesktopManagerFlagSet } from "@/lib/desktopManager";
import { Dialog, DialogContent, DialogTitle, DialogHeader } from "../components/ui/dialog";
import { Button } from "../components/ui/button";
import { Input } from "../components/ui/input";
import { Label } from "../components/ui/label";

// ─── Ambient Greeting Accent ───────────────────────────────────────────────────
const _ambientCss = `
  @keyframes _amb_twinkle { 0%,100%{ opacity:.15; } 50%{ opacity:.55; } }
  @keyframes _amb_pulse { 0%,100%{ opacity:.2; } 50%{ opacity:.35; } }
`;

const HORIZON_BOTTOM = 6;
const SKY_W = 88;
const SKY_H = 52;
const ARC_HEIGHT = 22;

function celestialPosition(progress: number, radius: number) {
  const arc = Math.sin(Math.max(0, Math.min(1, progress)) * Math.PI);
  const centerY = arc * ARC_HEIGHT;
  const bodyBottom = centerY - radius;
  const clipHeight = centerY + radius + 4;
  return { arc, centerY, bodyBottom, clipHeight };
}

function CrescentMoon({ size, bottom, left }: { size: number; bottom: number; left: number }) {
  return (
    <svg
      aria-hidden
      width={size}
      height={size}
      viewBox="0 0 24 24"
      style={{ position: "absolute", left, bottom, overflow: "visible" }}
    >
      <defs>
        <linearGradient id="moonSurface" x1="15%" y1="5%" x2="90%" y2="95%">
          <stop offset="0%" stopColor="#fffbeb" />
          <stop offset="45%" stopColor="#fde68a" />
          <stop offset="100%" stopColor="#d97706" />
        </linearGradient>
        <filter id="moonGlow" x="-50%" y="-50%" width="200%" height="200%">
          <feDropShadow dx="0" dy="1" stdDeviation="1.5" floodColor="#78350f" floodOpacity="0.45" />
        </filter>
      </defs>
      <path
        filter="url(#moonGlow)"
        fill="url(#moonSurface)"
        stroke="#92400e"
        strokeWidth="0.55"
        strokeLinejoin="round"
        d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"
      />
      <circle cx="14.5" cy="10" r="0.85" fill="rgba(120,53,15,0.22)" />
      <circle cx="12.8" cy="14.2" r="0.5" fill="rgba(120,53,15,0.18)" />
    </svg>
  );
}

function HorizonLine() {
  return (
    <div style={{
      position: "absolute", left: 8, bottom: HORIZON_BOTTOM,
      width: SKY_W - 16, height: 1,
      background: "linear-gradient(to right, transparent, rgba(148,163,184,0.45) 15%, rgba(148,163,184,0.45) 85%, transparent)",
      borderRadius: 1,
    }} />
  );
}

function AmbientAccent() {
  const [now, setNow] = useState(() => new Date());
  useEffect(() => {
    const id = setInterval(() => setNow(new Date()), 30_000);
    return () => clearInterval(id);
  }, []);

  const h = now.getHours();
  const m = now.getMinutes();
  const totalMin = h * 60 + m + now.getSeconds() / 60;
  const isDay = h >= 5 && h < 20;

  const SUN_R = 11;
  const dayProgress = Math.max(0, Math.min(1, (totalMin - 300) / 900));
  const sun = celestialPosition(dayProgress, SUN_R);
  const sunClipW = SUN_R * 2 + 24;

  const MOON_R = 9;
  const nightMin = h >= 20 ? totalMin - 1200 : totalMin + 240;
  const nightProgress = Math.max(0, Math.min(1, nightMin / 540));
  const moon = celestialPosition(nightProgress, MOON_R);
  const moonClipW = MOON_R * 2 + 8;

  if (isDay) {
    return (
      <>
        <style>{_ambientCss}</style>
        <div aria-hidden style={{ position: "relative", width: SKY_W, height: SKY_H, marginBottom: 2 }}>
          <div style={{
            position: "absolute",
            left: SKY_W / 2 - sunClipW / 2,
            bottom: HORIZON_BOTTOM,
            width: sunClipW,
            height: sun.clipHeight,
            overflow: "hidden",
          }}>
            <div style={{
              position: "absolute",
              left: sunClipW / 2 - SUN_R,
              bottom: sun.bodyBottom,
              width: SUN_R * 2,
              height: SUN_R * 2,
              borderRadius: "50%",
              background: "linear-gradient(145deg, rgba(253,224,71,0.95) 0%, rgba(251,191,36,0.75) 100%)",
              boxShadow: "0 0 10px rgba(251,191,36,0.35)",
            }} />
            {[0, 45, 90, 135, 180, 225, 270, 315].map((deg, i) => {
              const rad = (deg * Math.PI) / 180;
              const d = SUN_R + 4;
              const rx = d * Math.cos(rad);
              const ry = d * Math.sin(rad);
              return (
                <div key={i} style={{
                  position: "absolute",
                  left: sunClipW / 2 + rx - 3,
                  bottom: sun.centerY + ry - 1,
                  width: 6,
                  height: 2,
                  borderRadius: 1,
                  background: "rgba(251,191,36,0.55)",
                  transform: `rotate(${-deg}deg)`,
                  opacity: sun.arc > 0.15 ? 1 : 0.35,
                }} />
              );
            })}
          </div>
          <HorizonLine />
        </div>
      </>
    );
  }

  return (
    <>
      <style>{_ambientCss}</style>
      <div aria-hidden style={{ position: "relative", width: SKY_W, height: SKY_H, marginBottom: 2 }}>
        <div style={{
          position: "absolute",
          left: SKY_W / 2 - moonClipW / 2,
          bottom: HORIZON_BOTTOM,
          width: moonClipW,
          height: moon.clipHeight,
          overflow: "hidden",
        }}>
          <CrescentMoon
            size={MOON_R * 2}
            left={moonClipW / 2 - MOON_R}
            bottom={moon.bodyBottom}
          />
        </div>
        <HorizonLine />
      </div>
    </>
  );
}

const BACKEND = process.env.NEXT_PUBLIC_BACKEND_URL || "/backend";

function greeting() {
  const h = new Date().getHours();
  if (h >= 5 && h < 12) return "Good morning";
  if (h >= 12 && h < 17) return "Good afternoon";
  if (h >= 17 && h < 20) return "Good evening";
  return "Good night";
}

const menuCards = [
  { key: "payroll", label: "Payroll", sub: "View pay slips", icon: "solar:document-text-bold-duotone", color: "bg-indigo-50", iconColor: "text-indigo-600", href: "/empGenerateSalary" },
  ...(TASK_MANAGEMENT_ENABLED
    ? [{ key: "tasks", label: "Tasks", sub: "Open & WIP", icon: "solar:checklist-bold-duotone", color: "bg-violet-50", iconColor: "text-violet-600", href: "/empMyTasks" }]
    : []),
  { key: "notice", label: "IM", sub: "Internal messages", icon: "solar:bell-bold-duotone", color: "bg-amber-50", iconColor: "text-amber-600", href: "/empNoticeboard" },
  { key: "reimb", label: "Reimbursement", sub: "Pending approval", icon: "solar:wallet-bold-duotone", color: "bg-emerald-50", iconColor: "text-emerald-600", href: "/empReimbursement" },
  { key: "holidays", label: "Holiday list", sub: "Company public holidays", icon: "solar:calendar-mark-bold-duotone", color: "bg-rose-50", iconColor: "text-rose-600", href: "/empHolidays" },
  { key: "leave", label: "Leaves", sub: "Pending approval", icon: "solar:calendar-bold-duotone", color: "bg-blue-50", iconColor: "text-blue-600", href: "/empLeaveApplication" },
];

export default function EmpDashboardPage() {
  const router = useRouter();

  useEffect(() => {
    if (isDesktopManagerFlagSet() && isDesktopBrowser()) {
      router.replace("/dashboard");
    }
  }, [router]);

  const [empUser, setEmpUser] = useState<any>(null);
  const [mustChangePassword, setMustChangePassword] = useState(false);
  const [photoUrl, setPhotoUrl] = useState<string | null>(null);
  const [todayStatus, setTodayStatus] = useState<TodayStatus | null>(() => getPageCache<TodayStatus>("todayAttendance"));
  const [loadingStatus, setLoadingStatus] = useState(() => getPageCache<TodayStatus>("todayAttendance") === null);
  const [taskBadge, setTaskBadge] = useState(0);
  const [noticeBadge, setNoticeBadge] = useState(0);
  const [reimbBadge, setReimbBadge] = useState(0);
  const [leaveBadge, setLeaveBadge] = useState(0);

  const [forcePasswordModalOpen, setForcePasswordModalOpen] = useState(false);
  const [passwordSaving, setPasswordSaving] = useState(false);
  const [passwordForm, setPasswordForm] = useState({
    currentPassword: "",
    newPassword: "",
    confirmPassword: "",
  });

  useEffect(() => {
    clearLegacyEmpPhoto();
    try {
      const s = localStorage.getItem("user");
      if (s) {
        const u = JSON.parse(s);
        setEmpUser(u);

        // Check if mustChangePassword exists in the user object
        const mustChange = u?.mustChangePassword === true;
        console.log("mustChangePassword from user object:", mustChange);

        if (mustChange) {
          setMustChangePassword(true);
          setForcePasswordModalOpen(true);
        }

        const empId = u?.employee?.id;
        setPhotoUrl(resolveEmpPhoto(empId, u?.employee?.employeePhotoUrl));
      }
    } catch (error) {
      console.error("Error loading user data:", error);
    }
  }, []);

  // Fetch employee credentials separately to check mustChangePassword
  useEffect(() => {
    const fetchEmployeeCredentials = async () => {
      try {
        const token = localStorage.getItem("token");
        if (!token) return;

        const empId = empUser?.employee?.id || empUser?.id;
        if (!empId) return;

        const response = await fetch(`${BACKEND}/manage-emp/${empId}`, {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        });

        if (response.ok) {
          const data = await response.json();
          console.log("Employee data from API:", data);
          
          const mustChange = data?.employeeCredentials?.mustChangePassword === true;
          console.log("mustChangePassword from API:", mustChange);

          if (mustChange) {
            setMustChangePassword(true);
            setForcePasswordModalOpen(true);
          }
        }
      } catch (error) {
        console.error("Error fetching employee credentials:", error);
      }
    };

    if (empUser) {
      fetchEmployeeCredentials();
    }
  }, [empUser]);

  // Fetch badge counts — wrapped in useCallback so polling can reuse it
  const fetchBadges = useCallback(() => {
    if (!empUser?.employee?.id) return;
    const token = localStorage.getItem("token");
    if (!token) return;
    const eid = empUser.employee.id;
    const headers = { Authorization: `Bearer ${token}` };

    fetch(`${BACKEND}/employee-memo?employeeID=${eid}`, { headers })
      .then((r) => r.json())
      .then((memos: any[]) => {
        if (!Array.isArray(memos)) return;
        const lastViewed = parseInt(localStorage.getItem("_notice_last_viewed") || "0", 10);
        const unread = memos.filter((m: any) => {
          const ts = m.createdAt ? new Date(m.createdAt).getTime() : 0;
          return ts > lastViewed && m.employeeID === eid;
        });
        setNoticeBadge(unread.length);
      })
      .catch(() => {});

    if (TASK_MANAGEMENT_ENABLED) {
      const userForTask = empUser;
      taskFetch<{ items: { status: string }[] }>("/task-projects", userForTask, undefined, { limit: 100 })
        .then((data) => {
          const items = data.items || [];
          setTaskBadge(items.filter((t) => t.status === "Open" || t.status === "WIP" || t.status === "Reopen").length);
        })
        .catch(() => setTaskBadge(0));
    } else {
      setTaskBadge(0);
    }

    fetch(`${BACKEND}/reimbursement/employee/${eid}`, { headers })
      .then((r) => r.json())
      .then((data: any[]) => {
        if (!Array.isArray(data)) return;
        setReimbBadge(
          countUnseenReimbursementBadge(
            data.map((r: any) => ({ id: r.id, status: r.status })),
          ),
        );
      })
      .catch(() => setReimbBadge(0));

    fetch(`${BACKEND}/leave-application/employee/${eid}`, { headers })
      .then((r) => r.json())
      .then((data: any[]) => {
        if (!Array.isArray(data)) return;
        setLeaveBadge(
          countUnseenLeaveBadge(
            data.map((l: any) => ({ id: l.id, status: l.status })),
          ),
        );
      })
      .catch(() => {
        fetch(`${BACKEND}/leave-application`, { headers })
          .then((r) => r.json())
          .then((data: any[]) => {
            if (!Array.isArray(data)) return;
            setLeaveBadge(
              countUnseenLeaveBadge(
                data
                  .filter((l: any) => l.manageEmployeeID === eid)
                  .map((l: any) => ({ id: l.id, status: l.status })),
              ),
            );
          })
          .catch(() => setLeaveBadge(0));
      });
  }, [empUser]);

  useEffect(() => {
    const total =
      (TASK_MANAGEMENT_ENABLED ? taskBadge : 0) + noticeBadge + reimbBadge + leaveBadge;
    void syncAppBadge(total);
  }, [taskBadge, noticeBadge, reimbBadge, leaveBadge]);

  // Fetch notice board badge count
  useEffect(() => {
    if (!empUser?.employee?.id) return;
    fetchBadges();

    const interval = setInterval(() => {
      if (document.visibilityState === "visible") fetchBadges();
    }, 30000);
    const onVisible = () => {
      if (document.visibilityState === "visible") fetchBadges();
    };
    document.addEventListener("visibilitychange", onVisible);
    const onBadgesChanged = () => fetchBadges();
    window.addEventListener("emp-home-badges-changed", onBadgesChanged);

    return () => {
      clearInterval(interval);
      document.removeEventListener("visibilitychange", onVisible);
      window.removeEventListener("emp-home-badges-changed", onBadgesChanged);
    };
  }, [empUser, fetchBadges]);

  const fetchAttendance = useCallback(() => {
    const token = localStorage.getItem("token");
    if (!token) { router.replace("/login"); return; }
    const headers = { Authorization: `Bearer ${token}` };

    fetch(`${BACKEND}/emp-location-attendance/today?_=${Date.now()}`, {
      headers,
      cache: "no-store",
    })
      .then((r) => {
        if (!r.ok) {
          if (r.status === 401) { localStorage.removeItem("token"); localStorage.removeItem("accessToken"); router.replace("/login"); }
          return Promise.reject(r.status);
        }
        return r.json();
      })
      .then((d) => { setTodayStatus(d); setPageCache("todayAttendance", d); })
      .catch(() => {})
      .finally(() => setLoadingStatus(false));

  }, [router]);

  useEffect(() => {
    fetchAttendance();
    const onVisible = () => { if (document.visibilityState === "visible") fetchAttendance(); };
    document.addEventListener("visibilitychange", onVisible);
    return () => document.removeEventListener("visibilitychange", onVisible);
  }, [fetchAttendance]);

  const empName = empUser?.employee
    ? `${empUser.employee.firstName || ""}`.trim() || empUser.username || "there"
    : empUser?.username || "there";
  const empFullName = empUser?.employee
    ? `${empUser.employee.firstName || ""} ${empUser.employee.lastName || ""}`.trim() || empUser.username || "Employee"
    : empUser?.username || "Employee";
  const empInitials = empFullName.split(" ").filter(Boolean).slice(0, 2)
    .map((w: string) => w[0].toUpperCase()).join("") || "E";
  const empPhoto = photoUrl || resolveEmpPhoto(empUser?.employee?.id, empUser?.employee?.employeePhotoUrl) || null;

  const badgeFor = (key: string) => {
    if (key === "tasks") return taskBadge;
    if (key === "notice") return noticeBadge;
    if (key === "reimb") return reimbBadge;
    if (key === "leave") return leaveBadge;
    return 0;
  };

  const submitPasswordChange = async () => {
    const currentPassword = passwordForm.currentPassword.trim();
    const newPassword = passwordForm.newPassword.trim();
    const confirmPassword = passwordForm.confirmPassword.trim();

    if (!currentPassword || !newPassword || !confirmPassword) {
      alert("All password fields are required");
      return;
    }

    if (newPassword.length < 8) {
      alert("New password must be at least 8 characters");
      return;
    }

    if (!/[A-Z]/.test(newPassword) || !/[a-z]/.test(newPassword) || !/[0-9]/.test(newPassword) || !/[^A-Za-z0-9]/.test(newPassword)) {
      alert("Password must contain uppercase, lowercase, number and special character");
      return;
    }

    if (newPassword !== confirmPassword) {
      alert("New password and confirm password do not match");
      return;
    }

    if (currentPassword === newPassword) {
      alert("New password cannot be same as current password");
      return;
    }

    try {
      setPasswordSaving(true);

      const token = localStorage.getItem("token") || localStorage.getItem("accessToken");
      const empId = empUser?.employee?.id || empUser?.id;

      console.log("Changing password for employee ID:", empId);

      const res = await fetch(`${BACKEND}/manage-emp/${empId}/change-password`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          oldPassword: currentPassword,
          newPassword,
        }),
      });

      if (!res.ok) {
        const msg = await res.text();
        throw new Error(msg || "Password change failed");
      }

      // Update user data in localStorage to reflect mustChangePassword = false
      const userStr = localStorage.getItem("user");
      if (userStr) {
        const userData = JSON.parse(userStr);
        // Update both possible locations
        userData.mustChangePassword = false;
        if (userData.employeeCredentials) {
          userData.employeeCredentials.mustChangePassword = false;
        }
        localStorage.setItem("user", JSON.stringify(userData));
        setEmpUser(userData);
        setMustChangePassword(false);
      }

      // Close modal
      setForcePasswordModalOpen(false);
      
      alert("Password changed successfully! Please login again.");
      
      // Clear tokens and redirect to login
      localStorage.removeItem("token");
      localStorage.removeItem("accessToken");
      router.replace("/login");
      
    } catch (e: any) {
      alert(e?.message || "Password change failed");
    } finally {
      setPasswordSaving(false);
    }
  };

  return (
    <EmpMobileLayout>
      {/* Force Password Change Modal */}
      <Dialog 
        open={forcePasswordModalOpen} 
        onOpenChange={(open) => {
          // Prevent closing the modal if mustChangePassword is true
          if (!open && mustChangePassword) {
            return;
          }
          setForcePasswordModalOpen(open);
        }}
      >
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle className="text-xl font-bold">Change Password Required</DialogTitle>
          </DialogHeader>

          <div className="space-y-4 py-4">
            <p className="text-sm text-gray-600">
              You must change your temporary password before using the employee portal.
            </p>

            <div className="space-y-2">
              <Label className="text-sm font-medium">Current Password</Label>
              <Input
                type="password"
                placeholder="Enter current password"
                value={passwordForm.currentPassword}
                onChange={(e) => setPasswordForm((p) => ({ ...p, currentPassword: e.target.value }))}
                autoComplete="current-password"
              />
            </div>

            <div className="space-y-2">
              <Label className="text-sm font-medium">New Password</Label>
              <Input
                type="password"
                placeholder="Enter new password"
                value={passwordForm.newPassword}
                onChange={(e) => setPasswordForm((p) => ({ ...p, newPassword: e.target.value }))}
                autoComplete="new-password"
              />
            </div>

            <div className="space-y-2">
              <Label className="text-sm font-medium">Confirm New Password</Label>
              <Input
                type="password"
                placeholder="Confirm new password"
                value={passwordForm.confirmPassword}
                onChange={(e) => setPasswordForm((p) => ({ ...p, confirmPassword: e.target.value }))}
                autoComplete="new-password"
              />
            </div>

            <Button
              type="button"
              className="w-full bg-blue-600 hover:bg-blue-700 text-white"
              disabled={passwordSaving}
              onClick={submitPasswordChange}
            >
              {passwordSaving ? "Updating..." : "Update Password"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      <div className="px-4 pt-4 pb-2">
        {/* Header — greeting block and avatar share one vertical center line */}
        <div className="flex items-center justify-between gap-3 mb-3">
          <div className="flex items-center gap-2.5 min-w-0 flex-1">
            <div
              className="shrink-0 flex h-11 w-[50px] items-center justify-center overflow-hidden"
              aria-hidden
            >
              <div className="origin-center scale-[0.58]">
                <AmbientAccent />
              </div>
            </div>
            <div className="min-w-0">
              <p className="text-sm text-gray-500 font-medium leading-tight">{greeting()}</p>
              <h1 className="text-xl font-bold text-gray-900 tracking-tight leading-tight mt-0.5">
                {empName}
              </h1>
            </div>
          </div>
          <Link href="/empProfile" className="shrink-0">
            <div className="w-11 h-11 rounded-full overflow-hidden bg-[#2563eb] flex items-center justify-center shadow-md cursor-pointer">
              {empPhoto ? (
                <img src={empPhoto} alt={empFullName} className="w-full h-full object-cover" />
              ) : (
                <span className="text-white font-bold text-base">{empInitials}</span>
              )}
            </div>
          </Link>
        </div>

        <EmpTodayStatusCard
          todayStatus={todayStatus}
          loading={loadingStatus}
          onStatusUpdate={(d) => {
            setTodayStatus(d);
            setPageCache("todayAttendance", d);
          }}
        />

        {/* Menu grid */}
        <div className="grid grid-cols-2 gap-3 mb-4">
          {menuCards.map((card) => {
            const badge = badgeFor(card.key);
            return (
              <Link
                key={card.key}
                href={card.href}
                onClick={() => {
                  if (card.key === "notice") {
                    localStorage.setItem("_notice_last_viewed", Date.now().toString());
                    setNoticeBadge(0);
                  }
                }}
              >
                <div className="bg-white rounded-[20px] border border-gray-100 shadow-[0_2px_12px_rgba(15,23,42,0.06)] p-4 min-h-[100px] flex flex-col justify-between active:scale-[0.97] transition-transform relative">
                  <div className={`w-11 h-11 rounded-2xl ${card.color} flex items-center justify-center`}>
                    <Icon icon={card.icon} className={`w-6 h-6 ${card.iconColor}`} />
                  </div>
                  <div className="mt-3">
                    <p className="text-[15px] font-bold text-gray-900">{card.label}</p>
                    <p className="text-[11px] text-gray-500 mt-0.5">
                      {card.key === "tasks" && badge > 0 ? `${badge} active` : card.sub}
                    </p>
                  </div>
                  {badge > 0 && (
                    <span className="absolute top-3 right-3 min-w-[20px] h-5 px-1.5 bg-red-500 text-white text-[10px] font-bold rounded-full flex items-center justify-center">
                      {badge > 99 ? "99+" : badge}
                    </span>
                  )}
                </div>
              </Link>
            );
          })}
        </div>

        <EmpNotificationsPanel />
      </div>
    </EmpMobileLayout>
  );
}