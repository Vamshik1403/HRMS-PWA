"use client";

import { useEffect, useState, useCallback } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Icon } from "@iconify/react";
import EmpMobileLayout from "../components/layout/EmpMobileLayout";
import { getPageCache, setPageCache } from "../utils/pageCache";
import { clearLegacyEmpPhoto, resolveEmpPhoto } from "../utils/empPhotoCache";
import { buildDaySummary, type PunchRecord } from "../utils/attendanceDuration";

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

  // Day: 5:00 AM → 8:00 PM  |  Night: 8:00 PM → 5:00 AM
  const isDay = h >= 5 && h < 20;

  // Sun arc — rises from horizon at 5 AM, peaks ~12:30 PM, sets at 8 PM
  const SUN_R = 11;
  const dayProgress = Math.max(0, Math.min(1, (totalMin - 300) / 900));
  const sun = celestialPosition(dayProgress, SUN_R);
  const sunClipW = SUN_R * 2 + 24;

  // Moon arc — rises from horizon at 8 PM, peaks ~12:30 AM, sets at 5 AM
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
// ───────────────────────────────────────────────────────────────────────────────

const BACKEND = process.env.NEXT_PUBLIC_BACKEND_URL || "/backend";

interface AttendanceRecord extends PunchRecord {
  id: number;
  accuracy: number | null;
}
interface TodayStatus {
  isCheckedIn: boolean;
  isCheckedOut: boolean;
  punchState?: 'OUT' | 'IN' | 'ON_BREAK';
  canCheckIn?: boolean;
  canCheckOut?: boolean;
  canBreakIn?: boolean;
  canBreakOut?: boolean;
  checkIn: AttendanceRecord | null;
  checkOut: AttendanceRecord | null;
  allToday: AttendanceRecord[];
  workMinutes?: number;
  breakMinutes?: number;
  workSeconds?: number;
  breakSeconds?: number;
  sessionCount?: number;
}
interface DayRow {
  date: string;
  checkIn: string | null;
  checkOut: string | null;
  workLabel: string;
  breakLabel: string;
}

function fmt(iso: string) {
  return new Date(iso).toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit", hour12: true });
}
function fmtDate(iso: string) {
  return new Date(iso).toLocaleDateString("en-IN", { weekday: "short", day: "numeric", month: "short" });
}
function calcHrs(inIso: string, outIso: string) {
  const diff = (new Date(outIso).getTime() - new Date(inIso).getTime()) / 3600000;
  return diff > 0 ? `${diff.toFixed(2)}h` : null;
}
function greeting() {
  const h = new Date().getHours();
  if (h >= 5 && h < 12) return "Good morning";
  if (h >= 12 && h < 17) return "Good afternoon";
  if (h >= 17 && h < 20) return "Good evening";
  return "Good night";
}

const quickLinks = [
  { label: "Request Leave",    icon: "solar:document-add-bold-duotone",    color: "bg-blue-50",    iconColor: "text-blue-600",    href: "/empLeaveApplication" },
  { label: "History",          icon: "solar:clock-circle-bold-duotone",color: "bg-violet-50",  iconColor: "text-violet-600",  href: "/empHistory" },
  { label: "Reimbursement",    icon: "solar:wallet-bold-duotone",      color: "bg-emerald-50", iconColor: "text-emerald-600", href: "/empReimbursement" },
  { label: "Pay Slips",        icon: "solar:bill-bold-duotone",        color: "bg-pink-50",    iconColor: "text-pink-600",    href: "/empGenerateSalary" },
  { label: "Notice Board",     icon: "solar:bell-bold-duotone",        color: "bg-amber-50",   iconColor: "text-amber-600",   href: "/empNoticeboard" },
  { label: "Tasks",            icon: "solar:checklist-bold-duotone",   color: "bg-cyan-50",    iconColor: "text-cyan-600",    href: "/empMyTasks" },
];

export default function EmpDashboardPage() {
  const router = useRouter();
  const [empUser, setEmpUser] = useState<any>(null);
  const [photoUrl, setPhotoUrl] = useState<string | null>(null);
  const [todayStatus, setTodayStatus] = useState<TodayStatus | null>(() => getPageCache<TodayStatus>("todayAttendance"));
  const [recentHistory, setRecentHistory] = useState<DayRow[]>(() => getPageCache<DayRow[]>("recentAttendance") ?? []);
  const [loadingStatus, setLoadingStatus] = useState(() => getPageCache<TodayStatus>("todayAttendance") === null);
  const [noticeBadge, setNoticeBadge] = useState(0);
  const [reimbBadge, setReimbBadge] = useState(0);
  const [payslipBadge, setPayslipBadge] = useState(0);
  const [leaveBadge, setLeaveBadge] = useState(0);

  useEffect(() => {
    clearLegacyEmpPhoto();
    try {
      const s = localStorage.getItem("user");
      if (s) {
        const u = JSON.parse(s);
        setEmpUser(u);
        const empId = u?.employee?.id;
        setPhotoUrl(resolveEmpPhoto(empId, u?.employee?.employeePhotoUrl));
      }
    } catch {}
  }, []);

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

    fetch(`${BACKEND}/reimbursement`, { headers })
      .then((r) => r.json())
      .then((data: any[]) => {
        if (!Array.isArray(data)) return;
        const lastViewed = parseInt(localStorage.getItem("_reimb_last_viewed") || "0", 10);
        const unread = data.filter((r: any) => {
          if (r.manageEmployeeID !== eid) return false;
          if (r.status !== "Approved") return false;
          const ts = r.updatedAt ? new Date(r.updatedAt).getTime() : 0;
          return ts > lastViewed;
        });
        setReimbBadge(unread.length);
      })
      .catch(() => {});

    fetch(`${BACKEND}/generate-salary`, { headers })
      .then((r) => r.json())
      .then((data: any[]) => {
        if (!Array.isArray(data)) return;
        const lastViewed = parseInt(localStorage.getItem("_payslip_last_viewed") || "0", 10);
        const unread = data.filter((s: any) => {
          if (s.manageEmployeeID !== eid) return false;
          const ts = s.createdAt ? new Date(s.createdAt).getTime() : 0;
          return ts > lastViewed;
        });
        setPayslipBadge(unread.length);
      })
      .catch(() => {});

    fetch(`${BACKEND}/leave-application`, { headers })
      .then((r) => r.json())
      .then((data: any[]) => {
        if (!Array.isArray(data)) return;
        const lastViewed = parseInt(localStorage.getItem("_leave_last_viewed") || "0", 10);
        const unread = data.filter((l: any) => {
          if (l.manageEmployeeID !== eid) return false;
          if (l.status !== "Approved") return false;
          const ts = l.updatedAt ? new Date(l.updatedAt).getTime() : 0;
          return ts > lastViewed;
        });
        setLeaveBadge(unread.length);
      })
      .catch(() => {});
  }, [empUser]);

  // Fetch notice board badge count
  useEffect(() => {
    if (!empUser?.employee?.id) return;
    fetchBadges();

    // Poll every 30 s + refresh on visibility change
    const interval = setInterval(() => {
      if (document.visibilityState === "visible") fetchBadges();
    }, 30000);
    const onVisible = () => {
      if (document.visibilityState === "visible") fetchBadges();
    };
    document.addEventListener("visibilitychange", onVisible);

    return () => {
      clearInterval(interval);
      document.removeEventListener("visibilitychange", onVisible);
    };
  }, [empUser, fetchBadges]);

  const fetchAttendance = useCallback(() => {
    const token = localStorage.getItem("token");
    if (!token) { router.replace("/login"); return; }
    const headers = { Authorization: `Bearer ${token}` };

    fetch(`${BACKEND}/emp-location-attendance/today`, { headers })
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

    fetch(`${BACKEND}/emp-location-attendance/my`, { headers })
      .then((r) => {
        if (!r.ok) {
          if (r.status === 401) { localStorage.removeItem("token"); localStorage.removeItem("accessToken"); router.replace("/login"); }
          return Promise.reject(r.status);
        }
        return r.json();
      })
      .then((data: AttendanceRecord[]) => {
        if (!Array.isArray(data)) return;
        const byDate: Record<string, AttendanceRecord[]> = {};
        data.forEach((r) => {
          const key = new Date(r.checkinTime).toDateString();
          if (!byDate[key]) byDate[key] = [];
          byDate[key].push(r);
        });
        const rows: DayRow[] = Object.entries(byDate)
          .sort(([a], [b]) => new Date(b).getTime() - new Date(a).getTime())
          .slice(0, 5)
          .map(([, recs]) => {
            const summary = buildDaySummary(recs);
            return {
              date: summary.date,
              checkIn: summary.checkIn,
              checkOut: summary.checkOut,
              workLabel: summary.workLabel,
              breakLabel: summary.breakLabel,
            };
          });
        setRecentHistory(rows);
        setPageCache("recentAttendance", rows);
      })
      .catch(() => {});
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

  const punchState = todayStatus?.punchState ?? (todayStatus?.isCheckedIn ? "IN" : "OUT");
  const canCheckIn = todayStatus?.canCheckIn ?? punchState === "OUT";
  const canCheckOut = todayStatus?.canCheckOut ?? punchState === "IN";
  const isOnBreak = punchState === "ON_BREAK";
  const { checkIn, checkOut } = todayStatus || {};
  const workedHrs = todayStatus?.workSeconds != null
    ? (() => {
        const totalSec = todayStatus.workSeconds;
        const h = Math.floor(totalSec / 3600);
        const m = Math.floor((totalSec % 3600) / 60);
        if (h > 0) return `${h}h ${m}m`;
        if (m > 0) return `${m}m`;
        return `${totalSec}s`;
      })()
    : (todayStatus?.workMinutes != null
      ? (() => { const h = Math.floor(todayStatus.workMinutes / 60); const m = todayStatus.workMinutes % 60; return h > 0 ? `${h}h ${m}m` : `${m}m`; })()
      : (checkIn && checkOut ? calcHrs(checkIn.checkinTime, checkOut.checkinTime) : null));
  const breakHrs = todayStatus?.breakSeconds != null
    ? (() => {
        const totalSec = todayStatus.breakSeconds;
        const m = Math.floor(totalSec / 60);
        const s = totalSec % 60;
        if (m > 0) return s > 0 ? `${m}m ${s}s` : `${m}m`;
        return totalSec > 0 ? `${s}s` : "0m";
      })()
    : (todayStatus?.breakMinutes != null ? `${todayStatus.breakMinutes}m` : null);

  return (
    <EmpMobileLayout>
      <div className="px-4 pt-5 pb-2">
        {/* Header */}
        <div className="flex items-start justify-between mb-5">
          <div>
            <AmbientAccent />
            <p className="text-sm text-gray-500 font-medium mt-1">{greeting()}</p>
            <h1 className="text-2xl font-bold text-gray-900 tracking-tight">{empName}</h1>
          </div>
          <Link href="/empProfile">
            <div className="w-11 h-11 rounded-full overflow-hidden bg-[#2563eb] flex items-center justify-center shadow-md cursor-pointer">
              {empPhoto ? (
                <img src={empPhoto} alt={empFullName} className="w-full h-full object-cover" />
              ) : (
                <span className="text-white font-bold text-base">{empInitials}</span>
              )}
            </div>
          </Link>
        </div>

        {/* Today's Status card */}
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-4 mb-4">
          <div className="flex items-center justify-between mb-3">
            <p className="text-[11px] font-bold tracking-widest text-gray-400 uppercase">Today&apos;s Status</p>
            {loadingStatus ? (
              <span className="text-[10px] font-semibold text-gray-300 bg-gray-50 px-2.5 py-1 rounded-full">Loading…</span>
            ) : isOnBreak ? (
                <span className="text-[10px] font-bold text-amber-700 bg-amber-50 border border-amber-100 px-2.5 py-1 rounded-full uppercase tracking-wide">On Break</span>
              ) : punchState === "IN" ? (
                <span className="text-[10px] font-bold text-blue-700 bg-blue-50 border border-blue-100 px-2.5 py-1 rounded-full uppercase tracking-wide">Checked In</span>
              ) : (
              <span className="text-[10px] font-bold text-red-500 bg-red-50 border border-red-100 px-2.5 py-1 rounded-full uppercase tracking-wide">Not Punched In</span>
            )}
          </div>

          <div className="grid grid-cols-3 gap-2 mb-4">
            <div className="flex flex-col items-center">
              <p className="text-[10px] font-bold tracking-widest text-gray-400 uppercase mb-1">Check In</p>
              <p className={`text-base font-bold tabular-nums ${checkIn ? "text-gray-900" : "text-gray-300"}`}>
                {checkIn ? fmt(checkIn.checkinTime) : "--:--"}
              </p>
            </div>
            <div className="flex flex-col items-center border-x border-gray-100">
              <p className="text-[10px] font-bold tracking-widest text-gray-400 uppercase mb-1">Check Out</p>
              <p className={`text-base font-bold tabular-nums ${checkOut ? "text-gray-900" : "text-gray-300"}`}>
                {checkOut ? fmt((checkOut as AttendanceRecord).checkinTime) : "--:--"}
              </p>
            </div>
            <div className="flex flex-col items-center">
              <p className="text-[10px] font-bold tracking-widest text-gray-400 uppercase mb-1">Hours</p>
              <p className={`text-base font-bold tabular-nums ${workedHrs ? "text-emerald-600" : "text-gray-300"}`}>
                {workedHrs || "—"}
              </p>
            </div>
          </div>

          {canCheckIn && !loadingStatus && (
            <Link href="/empAttendance">
              <button className="w-full py-3 rounded-xl bg-[#2563eb] text-white font-bold text-sm flex items-center justify-center gap-2 shadow-md shadow-blue-200 active:scale-[0.98] transition-transform">
                <Icon icon="solar:fingerprint-bold-duotone" className="w-5 h-5" />
                Mark In
              </button>
            </Link>
          )}
          {canCheckOut && !loadingStatus && (
            <Link href="/empAttendance">
              <button className="w-full py-3 rounded-xl bg-[#2563eb] text-white font-bold text-sm flex items-center justify-center gap-2 shadow-md shadow-blue-200 active:scale-[0.98] transition-transform">
                <Icon icon="solar:fingerprint-bold-duotone" className="w-5 h-5" />
                {isOnBreak ? "End Break / Mark Out" : "Mark Out"}
              </button>
            </Link>
          )}
        </div>

        {/* Quick Shortcuts */}
        <div className="mb-4">
          <div className="grid grid-cols-2 gap-3">
            {quickLinks.map((ql) => {
              const isNoticeBoard = ql.label === "Notice Board";
              const isReimbursement = ql.label === "Reimbursement";
              const isPaySlips = ql.label === "Pay Slips";
              const isLeave = ql.label === "Leave Application" || ql.label === "Request Leave";
              const badge = isNoticeBoard ? noticeBadge
                : isReimbursement ? reimbBadge
                : isPaySlips ? payslipBadge
                : isLeave ? leaveBadge
                : 0;
              return (
                <Link
                  key={ql.label}
                  href={ql.href}
                  onClick={() => {
                    if (isNoticeBoard) { localStorage.setItem("_notice_last_viewed", Date.now().toString()); setNoticeBadge(0); }
                    if (isReimbursement) { localStorage.setItem("_reimb_last_viewed", Date.now().toString()); setReimbBadge(0); }
                    if (isPaySlips) { localStorage.setItem("_payslip_last_viewed", Date.now().toString()); setPayslipBadge(0); }
                    if (isLeave) { localStorage.setItem("_leave_last_viewed", Date.now().toString()); setLeaveBadge(0); }
                  }}
                >
                  <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-4 flex items-center gap-3 active:scale-[0.97] transition-transform relative">
                    <div className={`w-10 h-10 rounded-xl ${ql.color} flex items-center justify-center shrink-0`}>
                      <Icon icon={ql.icon} className={`w-5 h-5 ${ql.iconColor}`} />
                    </div>
                    <span className="text-[13px] font-bold text-gray-800 leading-tight">{ql.label}</span>
                    {badge > 0 && (
                      <span className="absolute top-2 right-2 min-w-[18px] h-[18px] bg-red-500 text-white text-[10px] font-bold rounded-full flex items-center justify-center px-1 shadow">
                        {badge > 99 ? "99+" : badge}
                      </span>
                    )}
                  </div>
                </Link>
              );
            })}
          </div>
        </div>

        {/* Recent Activity */}
        <div className="mb-2">
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-[15px] font-bold text-gray-900">Recent Activity</h2>
            <Link href="/empHistory" className="text-sm font-bold text-[#2563eb]">See all</Link>
          </div>
          {recentHistory.length === 0 ? (
            <div className="bg-white rounded-2xl border border-gray-100 p-6 flex flex-col items-center gap-2">
              <Icon icon="solar:calendar-bold-duotone" className="w-8 h-8 text-gray-200" />
              <p className="text-[12px] text-gray-400">No recent attendance</p>
            </div>
          ) : (
            <div className="space-y-2.5">
              {recentHistory.map((day, i) => (
                <div key={i} className="bg-white rounded-2xl border border-gray-100 shadow-sm px-4 py-3.5 flex items-center justify-between">
                  <div>
                    <p className="text-[13px] font-bold text-gray-900">{fmtDate(day.date)}</p>
                    <p className="text-[11px] text-gray-500 mt-0.5">
                      {day.checkIn ? fmt(day.checkIn) : "--:--"} – {day.checkOut ? fmt(day.checkOut) : "--:--"}
                    </p>
                    <p className="text-[11px] mt-0.5">
                      <span className="font-semibold text-gray-700">Work {day.workLabel}</span>
                      <span className="text-gray-400"> · </span>
                      <span className="font-semibold text-amber-600">Break {day.breakLabel}</span>
                    </p>
                  </div>
                  <span className="text-[10px] font-bold text-emerald-700 bg-emerald-50 border border-emerald-100 px-2.5 py-1 rounded-full uppercase tracking-wide">
                    Present
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </EmpMobileLayout>
  );
}
