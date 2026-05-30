"use client";

import { useCallback, useState } from "react";
import { fetchGPSOnUserGesture, type LocationCoords } from "../utils/empGeolocation";
import { setPageCache } from "../utils/pageCache";

const BACKEND = process.env.NEXT_PUBLIC_BACKEND_URL || "/backend";

export interface TodayStatus {
  isCheckedIn: boolean;
  isCheckedOut: boolean;
  isAbsentToday?: boolean;
  punchState?: "OUT" | "IN" | "ON_BREAK";
  canCheckIn?: boolean;
  canCheckOut?: boolean;
  canBreakIn?: boolean;
  canBreakOut?: boolean;
  canMarkAbsent?: boolean;
  checkIn: any;
  checkOut: any;
  allToday?: any[];
  workMinutes?: number;
  breakMinutes?: number;
  workSeconds?: number;
  breakSeconds?: number;
  sessionCount?: number;
  absentDeclaration?: { leaveType?: string; reason?: string };
}

function parseUA(ua: string) {
  let browser = "Unknown", os = "Unknown";
  if (/Edg\//i.test(ua)) browser = "Edge";
  else if (/Chrome/i.test(ua)) browser = "Chrome";
  else if (/Firefox/i.test(ua)) browser = "Firefox";
  else if (/Safari/i.test(ua) && !/Chrome/i.test(ua)) browser = "Safari";
  if (/Android/i.test(ua)) os = "Android";
  else if (/iPhone|iPad/i.test(ua)) os = "iOS";
  else if (/Windows/i.test(ua)) os = "Windows";
  const deviceType = /Mobi|Android/i.test(ua) ? "Mobile" : "Desktop";
  return { browser, os, deviceType };
}

function getToken() {
  return typeof window !== "undefined"
    ? localStorage.getItem("token") || localStorage.getItem("accessToken") || ""
    : "";
}

export function useEmpPunch(onStatusChange?: (s: TodayStatus) => void) {
  const [punchLoading, setPunchLoading] = useState(false);
  const [punchError, setPunchError] = useState<string | null>(null);
  const [punchSuccess, setPunchSuccess] = useState<string | null>(null);
  const [locationLoading, setLocationLoading] = useState(false);

  const loadStatus = useCallback(async (): Promise<TodayStatus | null> => {
    const token = getToken();
    if (!token) return null;
    try {
      const res = await fetch(`${BACKEND}/emp-location-attendance/today`, {
        headers: { Authorization: `Bearer ${token}` },
        cache: "no-store",
      });
      if (!res.ok) return null;
      const data = await res.json();
      setPageCache("todayAttendance", data);
      onStatusChange?.(data);
      return data;
    } catch {
      return null;
    }
  }, [onStatusChange]);

  const punch = useCallback(
    async (checkType: "CHECK_IN" | "CHECK_OUT" | "BREAK_IN" | "BREAK_OUT") => {
      setPunchError(null);
      setPunchSuccess(null);
      setPunchLoading(true);
      setLocationLoading(true);
      try {
        const location: LocationCoords = await fetchGPSOnUserGesture();
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
            browser,
            operatingSystem: os,
            deviceType,
            userAgent: ua.slice(0, 500),
          }),
        });
        if (!res.ok) {
          const body = await res.json().catch(() => null);
          throw new Error(body?.message || "Failed to record attendance");
        }
        const labels: Record<string, string> = {
          CHECK_IN: "Checked in successfully!",
          CHECK_OUT: "Checked out successfully!",
          BREAK_IN: "Break started!",
          BREAK_OUT: "Break ended!",
        };
        setPunchSuccess(labels[checkType]);
        await loadStatus();
      } catch (e: any) {
        setPunchError(e.message);
      } finally {
        setPunchLoading(false);
        setLocationLoading(false);
      }
    },
    [loadStatus],
  );

  const markAbsent = useCallback(
    async (reason: string) => {
      setPunchError(null);
      setPunchSuccess(null);
      setPunchLoading(true);
      try {
        const token = getToken();
        const res = await fetch(`${BACKEND}/emp-location-attendance/mark-absent`, {
          method: "POST",
          headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
          body: JSON.stringify({ reason }),
        });
        if (!res.ok) {
          const body = await res.json().catch(() => null);
          throw new Error(body?.message || "Failed to mark absent");
        }
        setPunchSuccess("Absent marked. Leave request sent to your manager.");
        await loadStatus();
      } catch (e: any) {
        setPunchError(e.message);
      } finally {
        setPunchLoading(false);
      }
    },
    [loadStatus],
  );

  const requestLocationAccess = useCallback(async () => {
    setPunchError(null);
    setLocationLoading(true);
    try {
      await fetchGPSOnUserGesture();
      setPunchSuccess("Location access granted. You can mark attendance now.");
    } catch (e: any) {
      setPunchError(e.message);
    } finally {
      setLocationLoading(false);
    }
  }, []);

  return {
    punch,
    markAbsent,
    loadStatus,
    requestLocationAccess,
    punchLoading,
    locationLoading,
    punchError,
    punchSuccess,
    setPunchError,
    setPunchSuccess,
  };
}
