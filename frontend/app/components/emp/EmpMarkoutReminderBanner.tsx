"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { Icon } from "@iconify/react";

const BACKEND = process.env.NEXT_PUBLIC_BACKEND_URL || "/backend";

function todayDismissKey() {
  return `_markout_reminder_dismissed_${new Date().toISOString().slice(0, 10)}`;
}

export function EmpMarkoutReminderBanner() {
  const [message, setMessage] = useState<string | null>(null);
  const [dismissed, setDismissed] = useState(false);

  const load = useCallback(async () => {
    if (typeof window === "undefined") return;
    if (sessionStorage.getItem(todayDismissKey()) === "1") {
      setDismissed(true);
      return;
    }
    const token =
      localStorage.getItem("token") || localStorage.getItem("accessToken") || "";
    if (!token) return;
    try {
      const res = await fetch(`${BACKEND}/emp-location-attendance/markout-reminder`, {
        headers: { Authorization: `Bearer ${token}` },
        cache: "no-store",
      });
      if (!res.ok) {
        setMessage(null);
        return;
      }
      const data = await res.json();
      setMessage(data?.show ? String(data.message || "") : null);
    } catch {
      setMessage(null);
    }
  }, []);

  useEffect(() => {
    void load();
    const onVisible = () => {
      if (document.visibilityState === "visible") void load();
    };
    document.addEventListener("visibilitychange", onVisible);
    return () => document.removeEventListener("visibilitychange", onVisible);
  }, [load]);

  if (!message || dismissed) return null;

  return (
    <div className="mx-4 mt-3 mb-1 rounded-xl border border-amber-200 bg-amber-50 px-3 py-2.5 flex items-start gap-2.5">
      <Icon
        icon="solar:bell-bing-bold-duotone"
        className="w-5 h-5 text-amber-600 shrink-0 mt-0.5"
      />
      <div className="min-w-0 flex-1">
        <p className="text-[12px] font-semibold text-amber-900 leading-snug">{message}</p>
        <Link
          href="/empAttendance"
          className="inline-block mt-1.5 text-[11px] font-bold text-[#4f46e5]"
        >
          Go to Attendance →
        </Link>
      </div>
      <button
        type="button"
        onClick={() => {
          sessionStorage.setItem(todayDismissKey(), "1");
          setDismissed(true);
        }}
        className="text-amber-500 hover:text-amber-700 shrink-0 p-0.5"
        aria-label="Dismiss"
      >
        <Icon icon="solar:close-circle-linear" className="w-5 h-5" />
      </button>
    </div>
  );
}
