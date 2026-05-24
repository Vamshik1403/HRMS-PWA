"use client";
import { useEffect, useState, useRef, useCallback } from "react";
import { Icon } from "@iconify/react";
import EmpMobileLayout from "../components/layout/EmpMobileLayout";
import { getPageCache, setPageCache } from "../utils/pageCache";

const BACKEND = process.env.NEXT_PUBLIC_BACKEND_URL || "/backend";

interface LocationCoords { latitude: number; longitude: number; accuracy: number; capturedAt: string; }
interface TodayStatus {
  isCheckedIn: boolean;
  isCheckedOut: boolean;
  punchState?: 'OUT' | 'IN' | 'ON_BREAK';
  canCheckIn?: boolean;
  canCheckOut?: boolean;
  canBreakIn?: boolean;
  canBreakOut?: boolean;
  checkIn: any;
  checkOut: any;
  allToday: any[];
  workMinutes?: number;
  breakMinutes?: number;
  workSeconds?: number;
  breakSeconds?: number;
  sessionCount?: number;
}

function accuracyLabel(acc: number) {
  if (acc <= 15) return { text: "EXCELLENT", color: "text-emerald-600 bg-emerald-50 border-emerald-100" };
  if (acc <= 30) return { text: "GOOD", color: "text-blue-600 bg-blue-50 border-blue-100" };
  if (acc <= 60) return { text: "FAIR", color: "text-amber-600 bg-amber-50 border-amber-100" };
  return { text: "POOR", color: "text-red-500 bg-red-50 border-red-100" };
}

function parseUA(ua: string) {
  let browser = "Unknown", os = "Unknown";
  if (/Edg\//i.test(ua)) browser = "Edge";
  else if (/Chrome/i.test(ua)) browser = "Chrome";
  else if (/Firefox/i.test(ua)) browser = "Firefox";
  else if (/Safari/i.test(ua) && !/Chrome/i.test(ua)) browser = "Safari";
  if (/Windows/i.test(ua)) os = "Windows";
  else if (/Android/i.test(ua)) os = "Android";
  else if (/iPhone|iPad/i.test(ua)) os = "iOS";
  else if (/Mac OS/i.test(ua)) os = "macOS";
  else if (/Linux/i.test(ua)) os = "Linux";
  const deviceType = /Mobi|Android/i.test(ua) ? "Mobile" : "Desktop";
  return { browser, os, deviceType };
}

export default function EmpAttendancePage() {
  const [time, setTime] = useState(new Date());
  const [coords, setCoords] = useState<LocationCoords | null>(null);
  const [locationLoading, setLocationLoading] = useState(false);
  const [locationError, setLocationError] = useState<string | null>(null);
  const [todayStatus, setTodayStatus] = useState<TodayStatus | null>(() => getPageCache<TodayStatus>("todayAttendance"));
  const [punchLoading, setPunchLoading] = useState(false);
  const [punchSuccess, setPunchSuccess] = useState<string | null>(null);
  const [punchError, setPunchError] = useState<string | null>(null);
  const [checkInAddress, setCheckInAddress] = useState<string | null>(null);
  const [loadingAddress, setLoadingAddress] = useState(false);

  // Live clock
  useEffect(() => {
    const id = setInterval(() => setTime(new Date()), 1000);
    return () => clearInterval(id);
  }, []);

  const getToken = () => (typeof window !== "undefined" ? localStorage.getItem("token") || localStorage.getItem("accessToken") || "" : "");

  const loadStatus = useCallback(async () => {
    const token = getToken();
    if (!token) return;
    try {
      const res = await fetch(`${BACKEND}/emp-location-attendance/today`, {
        headers: { Authorization: `Bearer ${token}` },
        cache: "no-store",
      });
      if (res.ok) {
        const data = await res.json();
        setTodayStatus(data);
        setPageCache("todayAttendance", data);
      }
    } catch {}
  }, []);

  useEffect(() => { loadStatus(); }, [loadStatus]);

  // Keep work/break timers live while on this page
  useEffect(() => {
    const id = setInterval(() => loadStatus(), 30_000);
    return () => clearInterval(id);
  }, [loadStatus]);

  // Fetch reverse-geocoded address when checked in
  useEffect(() => {
    const lat = todayStatus?.checkIn?.latitude;
    const lon = todayStatus?.checkIn?.longitude;
    if (!todayStatus?.isCheckedIn || !lat || !lon) return;
    setLoadingAddress(true);
    fetch(`https://nominatim.openstreetmap.org/reverse?format=json&lat=${lat}&lon=${lon}`, {
      headers: { "Accept-Language": "en" },
    })
      .then((r) => r.json())
      .then((d) => setCheckInAddress(d?.display_name || null))
      .catch(() => {})
      .finally(() => setLoadingAddress(false));
  }, [todayStatus?.isCheckedIn, todayStatus?.checkIn?.latitude, todayStatus?.checkIn?.longitude]);

  const fetchGPS = () => new Promise<LocationCoords>((resolve, reject) => {
    if (!navigator.geolocation) { reject(new Error("Geolocation not supported")); return; }
    navigator.geolocation.getCurrentPosition(
      (pos) => resolve({
        latitude: pos.coords.latitude,
        longitude: pos.coords.longitude,
        accuracy: pos.coords.accuracy,
        capturedAt: new Date().toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit", second: "2-digit", hour12: true }),
      }),
      (err) => {
        if (err.code === 1) reject(new Error("Location permission denied. Please allow access."));
        else if (err.code === 2) reject(new Error("Location unavailable."));
        else reject(new Error("Location timed out. Try again."));
      },
      { enableHighAccuracy: true, timeout: 15000, maximumAge: 0 }
    );
  });

  const refreshGPS = async () => {
    setLocationError(null);
    setLocationLoading(true);
    try {
      const c = await fetchGPS();
      setCoords(c);
    } catch (e: any) {
      setLocationError(e.message);
    } finally {
      setLocationLoading(false);
    }
  };

  useEffect(() => { refreshGPS(); }, []);

  const handlePunch = async (checkType: "CHECK_IN" | "CHECK_OUT" | "BREAK_IN" | "BREAK_OUT") => {
    setPunchError(null);
    setPunchSuccess(null);
    setPunchLoading(true);
    try {
      let location = coords;
      if (!location) {
        setLocationLoading(true);
        location = await fetchGPS().finally(() => setLocationLoading(false));
        setCoords(location);
      }
      const ua = navigator.userAgent;
      const { browser, os, deviceType } = parseUA(ua);
      const token = getToken();
      const res = await fetch(`${BACKEND}/emp-location-attendance/punch`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({
          checkType,
          latitude: location.latitude,
          longitude: location.longitude,
          accuracy: location.accuracy,
          browser, operatingSystem: os, deviceType,
          userAgent: ua.slice(0, 500),
        }),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => null);
        throw new Error(body?.message || "Failed to record attendance");
      }
      setPunchSuccess(
        checkType === "CHECK_IN" ? "Checked in successfully!"
        : checkType === "CHECK_OUT" ? "Checked out successfully!"
        : checkType === "BREAK_IN" ? "Break started!"
        : "Break ended!"
      );
      await loadStatus();
    } catch (e: any) {
      setPunchError(e.message);
    } finally {
      setPunchLoading(false);
    }
  };

  const punchState = todayStatus?.punchState ?? (todayStatus?.isCheckedIn ? "IN" : "OUT");
  const canCheckIn = todayStatus?.canCheckIn ?? punchState === "OUT";
  const canCheckOut = todayStatus?.canCheckOut ?? punchState === "IN";
  const canBreakIn = todayStatus?.canBreakIn ?? punchState === "IN";
  const canBreakOut = todayStatus?.canBreakOut ?? punchState === "ON_BREAK";
  const isOnBreak = punchState === "ON_BREAK";
  const isActiveSession = punchState === "IN" || punchState === "ON_BREAK";

  const formatDuration = (minutes?: number, seconds?: number) => {
    const totalSec = seconds ?? ((minutes ?? 0) * 60);
    if (totalSec <= 0) return "0m";
    const h = Math.floor(totalSec / 3600);
    const m = Math.floor((totalSec % 3600) / 60);
    const s = totalSec % 60;
    if (h > 0) return `${h}h ${m}m`;
    if (m > 0) return s > 0 ? `${m}m ${s}s` : `${m}m`;
    return `${s}s`;
  };

  const hh = time.getHours().toString().padStart(2, "0");
  const mm = time.getMinutes().toString().padStart(2, "0");
  const ss = time.getSeconds().toString().padStart(2, "0");
  const dateLabel = time.toLocaleDateString("en-IN", { weekday: "long", day: "numeric", month: "long", year: "numeric" });

  // When checked in, GPS card shows check-in location; otherwise shows fresh GPS
  const displayAccuracy = isActiveSession && todayStatus?.checkIn?.accuracy != null
    ? Number(todayStatus.checkIn.accuracy)
    : coords?.accuracy ?? null;
  const accLabel = displayAccuracy != null ? accuracyLabel(displayAccuracy) : null;

  return (
    <EmpMobileLayout>
      <div className="px-4 pt-6 pb-4">
        {/* Title */}
        <h1 className="text-[22px] font-bold text-gray-900 mb-1">Mark Attendance</h1>
        <p className="text-[13px] text-gray-500 mb-5">We use your GPS location to verify on-site attendance.</p>

        {/* Current Time Card */}
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5 mb-4 flex flex-col items-center">
          <p className="text-[10px] font-bold tracking-widest text-gray-400 uppercase mb-2">Current Time</p>
          <div className="text-[48px] font-bold tabular-nums text-gray-900 leading-none tracking-tight">
            {hh}<span className="text-gray-300 mx-0.5">:</span>{mm}<span className="text-gray-300 mx-0.5">:</span>{ss}
          </div>
          <p className="text-[13px] text-gray-500 mt-2">{dateLabel}</p>
        </div>

        {/* GPS Location Card */}
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-4 mb-4">
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2">
              <Icon icon="solar:map-point-bold-duotone" className="w-5 h-5 text-gray-700" />
              <span className="text-[14px] font-bold text-gray-900">GPS Location</span>
            </div>
            {accLabel && coords && (
              <span className={`text-[10px] font-bold border px-2.5 py-1 rounded-full uppercase tracking-wide ${accLabel.color}`}>
                {accLabel.text} · ±{Math.round(coords.accuracy)}M
              </span>
            )}
            {locationLoading && (
              <span className="text-[10px] font-semibold text-blue-500 animate-pulse">Fetching…</span>
            )}
          </div>

          {locationError && !isActiveSession && (
            <p className="text-[12px] text-red-500 mb-2">{locationError}</p>
          )}

          {/* Address shown when checked in */}
          {isActiveSession && (
            <div className="mb-2">
              {loadingAddress ? (
                <p className="text-[12px] text-gray-400 animate-pulse">Fetching address…</p>
              ) : checkInAddress ? (
                <p className="text-[12px] text-gray-600 leading-snug">{checkInAddress}</p>
              ) : null}
            </div>
          )}

          {/* Coordinates: check-in location when checked in, fresh GPS otherwise */}
          {isActiveSession && todayStatus?.checkIn ? (
            <div className="mb-3 space-y-0.5">
              <p className="text-[13px] text-gray-600">Latitude: <span className="font-mono font-semibold text-gray-800">{Number(todayStatus.checkIn.latitude).toFixed(6)}</span></p>
              <p className="text-[13px] text-gray-600">Longitude: <span className="font-mono font-semibold text-gray-800">{Number(todayStatus.checkIn.longitude).toFixed(6)}</span></p>
              <p className="text-[13px] text-gray-500">Checked in at {new Date(todayStatus.checkIn.checkinTime).toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit", hour12: true })}</p>
            </div>
          ) : coords ? (
            <div className="mb-3 space-y-0.5">
              <p className="text-[13px] text-gray-600">Latitude: <span className="font-mono font-semibold text-gray-800">{coords.latitude.toFixed(6)}</span></p>
              <p className="text-[13px] text-gray-600">Longitude: <span className="font-mono font-semibold text-gray-800">{coords.longitude.toFixed(6)}</span></p>
              <p className="text-[13px] text-gray-500">Captured at {coords.capturedAt}</p>
            </div>
          ) : null}

          {!isActiveSession && (
            <button
              onClick={refreshGPS}
              disabled={locationLoading}
              className="flex items-center gap-1.5 text-[13px] font-semibold text-gray-700 border border-gray-200 rounded-xl px-3 py-1.5 active:scale-[0.97] transition-transform disabled:opacity-50"
            >
              <Icon icon={locationLoading ? "solar:refresh-bold-duotone" : "solar:refresh-linear"} className={`w-4 h-4 ${locationLoading ? "animate-spin" : ""}`} />
              Refresh
            </button>
          )}
        </div>

        {/* Today's status indicator */}
        {todayStatus && (todayStatus.allToday?.length > 0 || todayStatus.sessionCount) && (
          <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-4 mb-4 space-y-3">
            <div className="flex flex-wrap items-center gap-3">
              {todayStatus.checkIn && (
                <div className="flex items-center gap-2 text-emerald-600">
                  <div className="w-2 h-2 rounded-full bg-emerald-500" />
                  <span className="text-[12px] font-semibold">
                    First In: {new Date(todayStatus.checkIn.checkinTime).toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit", hour12: true })}
                  </span>
                </div>
              )}
              {todayStatus.checkOut && (
                <div className="flex items-center gap-2 text-blue-600">
                  <div className="w-2 h-2 rounded-full bg-blue-500" />
                  <span className="text-[12px] font-semibold">
                    Last Out: {new Date(todayStatus.checkOut.checkinTime).toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit", hour12: true })}
                  </span>
                </div>
              )}
              {isOnBreak && (
                <div className="flex items-center gap-2 text-amber-600">
                  <div className="w-2 h-2 rounded-full bg-amber-500 animate-pulse" />
                  <span className="text-[12px] font-semibold">On Break</span>
                </div>
              )}
            </div>
            <div className="grid grid-cols-3 gap-2 pt-1 border-t border-gray-100">
              <div className="text-center">
                <p className="text-[10px] font-bold text-gray-400 uppercase">Work</p>
                <p className="text-[14px] font-bold text-emerald-600">{formatDuration(todayStatus.workMinutes, todayStatus.workSeconds)}</p>
              </div>
              <div className="text-center border-x border-gray-100">
                <p className="text-[10px] font-bold text-gray-400 uppercase">Break</p>
                <p className="text-[14px] font-bold text-amber-600">{formatDuration(todayStatus.breakMinutes, todayStatus.breakSeconds)}</p>
              </div>
              <div className="text-center">
                <p className="text-[10px] font-bold text-gray-400 uppercase">Sessions</p>
                <p className="text-[14px] font-bold text-gray-800">{todayStatus.sessionCount ?? 0}</p>
              </div>
            </div>
          </div>
        )}

        {/* Feedback */}
        {punchSuccess && (
          <div className="bg-emerald-50 border border-emerald-100 rounded-2xl px-4 py-3 mb-4 flex items-center gap-2">
            <Icon icon="solar:check-circle-bold-duotone" className="w-5 h-5 text-emerald-600 shrink-0" />
            <p className="text-[13px] font-semibold text-emerald-700">{punchSuccess}</p>
          </div>
        )}
        {punchError && (
          <div className="bg-red-50 border border-red-100 rounded-2xl px-4 py-3 mb-4 flex items-center gap-2">
            <Icon icon="solar:close-circle-bold-duotone" className="w-5 h-5 text-red-500 shrink-0" />
            <p className="text-[13px] font-semibold text-red-600">{punchError}</p>
          </div>
        )}

        {/* Punch actions */}
        <div className="space-y-3">
          {canCheckIn && (
            <button
              onClick={() => handlePunch("CHECK_IN")}
              disabled={punchLoading || locationLoading}
              className="w-full py-5 rounded-2xl bg-[#2563eb] text-white flex flex-col items-center gap-2 shadow-lg shadow-blue-200 active:scale-[0.98] transition-all disabled:opacity-60"
            >
              {punchLoading ? (
                <Icon icon="solar:refresh-bold-duotone" className="w-10 h-10 animate-spin" />
              ) : (
                <Icon icon="solar:login-bold-duotone" className="w-10 h-10" />
              )}
              <p className="text-[18px] font-bold">{punchLoading ? "Submitting…" : "Mark IN"}</p>
            </button>
          )}

          {(canCheckOut || canBreakIn || canBreakOut) && (
            <div className={`grid gap-3 ${canCheckOut && (canBreakIn || canBreakOut) ? "grid-cols-2" : "grid-cols-1"}`}>
              {canCheckOut && (
                <button
                  onClick={() => handlePunch("CHECK_OUT")}
                  disabled={punchLoading || locationLoading}
                  className="py-4 rounded-2xl bg-[#2563eb] text-white flex flex-col items-center gap-1 shadow-lg shadow-blue-200 active:scale-[0.98] transition-all disabled:opacity-60"
                >
                  <Icon icon="solar:logout-bold-duotone" className="w-8 h-8" />
                  <p className="text-[15px] font-bold">Mark OUT</p>
                </button>
              )}
              {canBreakIn && (
                <button
                  onClick={() => handlePunch("BREAK_IN")}
                  disabled={punchLoading || locationLoading}
                  className="py-4 rounded-2xl bg-amber-500 text-white flex flex-col items-center gap-1 shadow-lg shadow-amber-200 active:scale-[0.98] transition-all disabled:opacity-60"
                >
                  <Icon icon="solar:cup-hot-bold-duotone" className="w-8 h-8" />
                  <p className="text-[15px] font-bold">Break IN</p>
                </button>
              )}
              {canBreakOut && (
                <button
                  onClick={() => handlePunch("BREAK_OUT")}
                  disabled={punchLoading || locationLoading}
                  className="py-4 rounded-2xl bg-emerald-600 text-white flex flex-col items-center gap-1 shadow-lg shadow-emerald-200 active:scale-[0.98] transition-all disabled:opacity-60 col-span-full"
                >
                  <Icon icon="solar:play-bold-duotone" className="w-8 h-8" />
                  <p className="text-[15px] font-bold">Break OUT</p>
                </button>
              )}
            </div>
          )}
        </div>
      </div>
    </EmpMobileLayout>
  );
}
