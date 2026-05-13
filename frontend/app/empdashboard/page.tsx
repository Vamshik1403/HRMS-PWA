"use client";

import { useEffect, useState, useCallback } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Icon } from "@iconify/react";
import EmpMobileLayout from "../components/layout/EmpMobileLayout";
import { getPageCache, setPageCache } from "../utils/pageCache";

const BACKEND = process.env.NEXT_PUBLIC_BACKEND_URL || "/backend";

interface AttendanceRecord {
  id: number;
  checkType: "CHECK_IN" | "CHECK_OUT";
  checkinTime: string;
  accuracy: number | null;
}
interface TodayStatus {
  isCheckedIn: boolean;
  isCheckedOut: boolean;
  checkIn: AttendanceRecord | null;
  checkOut: AttendanceRecord | null;
  allToday: AttendanceRecord[];
}
interface DayRow {
  date: string;
  checkIn: string | null;
  checkOut: string | null;
  totalHours: string | null;
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
  if (h < 12) return "Good morning";
  if (h < 17) return "Good afternoon";
  return "Good evening";
}

const quickLinks = [
  { label: "Request Leave",    icon: "solar:document-add-bold-duotone",    color: "bg-blue-50",    iconColor: "text-blue-600",    href: "/empLeaveApplication" },
  { label: "History",          icon: "solar:clock-circle-bold-duotone",color: "bg-violet-50",  iconColor: "text-violet-600",  href: "/empHistory" },
  { label: "Reimbursement",    icon: "solar:wallet-bold-duotone",      color: "bg-emerald-50", iconColor: "text-emerald-600", href: "/empReimbursement" },
  { label: "Pay Slips",        icon: "solar:bill-bold-duotone",        color: "bg-pink-50",    iconColor: "text-pink-600",    href: "/empGenerateSalary" },
  { label: "Notice Board",     icon: "solar:bell-bold-duotone",        color: "bg-amber-50",   iconColor: "text-amber-600",   href: "/empNoticeboard" },
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
    try {
      const s = localStorage.getItem("user");
      if (s) setEmpUser(JSON.parse(s));
    } catch {}
    // Read cached photo URL saved by the profile page
    const cached = localStorage.getItem("_emp_photo");
    if (cached) setPhotoUrl(cached);
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

  useEffect(() => {
    const token = localStorage.getItem("token");
    if (!token) return;
    const headers = { Authorization: `Bearer ${token}` };

    fetch(`${BACKEND}/emp-location-attendance/today`, { headers })
      .then((r) => r.json())
      .then((d) => { setTodayStatus(d); setPageCache("todayAttendance", d); })
      .catch(() => {})
      .finally(() => setLoadingStatus(false));

    fetch(`${BACKEND}/emp-location-attendance/my`, { headers })
      .then((r) => r.json())
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
            const ci = recs.find((r) => r.checkType === "CHECK_IN") || null;
            const co = recs.find((r) => r.checkType === "CHECK_OUT") || null;
            return {
              date: ci?.checkinTime || co?.checkinTime || "",
              checkIn: ci?.checkinTime || null,
              checkOut: co?.checkinTime || null,
              totalHours: ci && co ? calcHrs(ci.checkinTime, co.checkinTime) : null,
            };
          });
        setRecentHistory(rows);
        setPageCache("recentAttendance", rows);
      })
      .catch(() => {});
  }, []);

  const empName = empUser?.employee
    ? `${empUser.employee.firstName || ""}`.trim() || empUser.username || "there"
    : empUser?.username || "there";
  const empFullName = empUser?.employee
    ? `${empUser.employee.firstName || ""} ${empUser.employee.lastName || ""}`.trim() || empUser.username || "Employee"
    : empUser?.username || "Employee";
  const empInitials = empFullName.split(" ").filter(Boolean).slice(0, 2)
    .map((w: string) => w[0].toUpperCase()).join("") || "E";
  const empPhoto = photoUrl || empUser?.employee?.employeePhotoUrl || null;

  const { isCheckedIn, isCheckedOut, checkIn, checkOut } = todayStatus || {};
  const workedHrs = checkIn && checkOut ? calcHrs(checkIn.checkinTime, checkOut.checkinTime) : null;

  return (
    <EmpMobileLayout>
      <div className="px-4 pt-5 pb-2">
        {/* Header */}
        <div className="flex items-start justify-between mb-5">
          <div>
            <p className="text-sm text-gray-500 font-medium">{greeting()}</p>
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
            ) : isCheckedIn ? (
              isCheckedOut ? (
                <span className="text-[10px] font-bold text-emerald-700 bg-emerald-50 border border-emerald-100 px-2.5 py-1 rounded-full uppercase tracking-wide">Completed</span>
              ) : (
                <span className="text-[10px] font-bold text-blue-700 bg-blue-50 border border-blue-100 px-2.5 py-1 rounded-full uppercase tracking-wide">Checked In</span>
              )
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

          {!isCheckedIn && !loadingStatus && (
            <Link href="/empAttendance">
              <button className="w-full py-3 rounded-xl bg-[#2563eb] text-white font-bold text-sm flex items-center justify-center gap-2 shadow-md shadow-blue-200 active:scale-[0.98] transition-transform">
                <Icon icon="solar:fingerprint-bold-duotone" className="w-5 h-5" />
                Mark In
              </button>
            </Link>
          )}
          {isCheckedIn && !isCheckedOut && !loadingStatus && (
            <Link href="/empAttendance">
              <button className="w-full py-3 rounded-xl bg-[#2563eb] text-white font-bold text-sm flex items-center justify-center gap-2 shadow-md shadow-blue-200 active:scale-[0.98] transition-transform">
                <Icon icon="solar:fingerprint-bold-duotone" className="w-5 h-5" />
                Mark Out
              </button>
            </Link>
          )}
          {isCheckedIn && isCheckedOut && !loadingStatus && (
            <div className="w-full py-3 rounded-xl bg-emerald-50 border border-emerald-100 text-emerald-700 font-bold text-sm flex items-center justify-center gap-2">
              <Icon icon="solar:check-circle-bold-duotone" className="w-5 h-5" />
              Attendance Completed
            </div>
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
                      {day.totalHours ? ` · ${day.totalHours}` : ""}
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
