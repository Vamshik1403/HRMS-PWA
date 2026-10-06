"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { taskFetch } from "../../../utils/taskApi";
import { fetchGPSOnUserGesture } from "../../../utils/empGeolocation";
import { uploadPunchPhoto } from "../../../hooks/useEmpPunch";
import { visitComplianceCopy } from "../../../utils/taskSiteVisit";
import { EmpPhotoPunchCapture, type EmpPhotoPunchCaptureHandle } from "../../emp/EmpPhotoPunchCapture";
import type { CurrentUserLike } from "../../../utils/taskApi";

const BACKEND = process.env.NEXT_PUBLIC_BACKEND_URL || "/backend";

const FIELD_REASONS = [
  "Office Work",
  "Remote Work",
  "Manager Did Not Assign Visit",
  "Emergency Work",
  "Training",
  "Other",
] as const;

type VisitKind = "checkin" | "checkout" | "day_signout";

type DayVisit = {
  taskId: number;
  taskName: string;
  visitSequence: number | null;
  scheduledArrival?: string | null;
  complianceStatus?: string | null;
  exceptionStatus?: string | null;
  signOutForTheDay?: boolean;
  daySignOutSelfieRequired?: boolean;
  customerName?: string | null;
  siteName?: string | null;
  checkInAt?: string | null;
  checkOutAt?: string | null;
};

type GpsBody = {
  latitude: number;
  longitude: number;
  accuracyMeters?: number;
  addressText?: string;
  selfieUrl?: string;
  exceptionRequested?: boolean;
  reason?: string;
};

function fmtWhen(iso?: string | null) {
  if (!iso) return "—";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "—";
  return d.toLocaleString("en-IN", {
    timeZone: "Asia/Kolkata",
    day: "2-digit",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
    hour12: true,
  });
}

function deviceInfo() {
  if (typeof navigator === "undefined") return undefined;
  return { userAgent: navigator.userAgent };
}

async function resolveAddress(latitude: number, longitude: number) {
  try {
    const res = await fetch(
      `${BACKEND}/devices/resolve-address?latitude=${encodeURIComponent(String(latitude))}&longitude=${encodeURIComponent(String(longitude))}`,
      { cache: "no-store" },
    );
    const json = res.ok ? await res.json() : {};
    return typeof json.address === "string" ? json.address : "";
  } catch {
    return "";
  }
}

export function FieldVisitDayPanel({ user }: { user: CurrentUserLike | null | undefined }) {
  const photoRef = useRef<EmpPhotoPunchCaptureHandle>(null);
  const pendingRef = useRef<{ visit: DayVisit; kind: VisitKind } | null>(null);
  const pendingField = useRef<(typeof FIELD_REASONS)[number] | null>(null);
  const [visits, setVisits] = useState<DayVisit[]>([]);
  const [hasVisitToday, setHasVisitToday] = useState(false);
  const [loaded, setLoaded] = useState(false);
  const [sending, setSending] = useState(false);
  const [reason, setReason] = useState<(typeof FIELD_REASONS)[number] | "">("");
  const [fieldStatus, setFieldStatus] = useState<string | null>(null);
  const [exception, setException] = useState<(GpsBody & { visit: DayVisit; kind: VisitKind }) | null>(null);
  const [exceptionReason, setExceptionReason] = useState("");

  const load = useCallback(async () => {
    if (!user) return;
    try {
      const data = await taskFetch<{ hasVisitToday: boolean; visits: DayVisit[] }>("/task-projects/my-day", user);
      setHasVisitToday(!!data.hasVisitToday);
      setVisits(data.visits || []);
    } catch {
      setHasVisitToday(false);
      setVisits([]);
    } finally {
      setLoaded(true);
    }
  }, [user]);

  useEffect(() => {
    void load();
  }, [load]);

  const postVisit = async (visit: DayVisit, kind: VisitKind, gps: GpsBody) => {
    await taskFetch(`/task-projects/${visit.taskId}/site-visit`, user, {
      method: "POST",
      body: JSON.stringify({
        kind,
        latitude: gps.latitude,
        longitude: gps.longitude,
        accuracyMeters: gps.accuracyMeters,
        addressText: gps.addressText || undefined,
        selfieUrl: gps.selfieUrl || undefined,
        deviceInfo: deviceInfo(),
        exceptionRequested: gps.exceptionRequested || undefined,
        reason: gps.reason || undefined,
        at: new Date().toISOString(),
      }),
    });
  };

  const finishVisit = (kind: VisitKind, exceptionRequested?: boolean) => {
    if (exceptionRequested) toast.success("Pending Approval");
    else if (kind === "day_signout") toast.success("Signed out for the day");
    else toast.success(kind === "checkin" ? "Check-in recorded" : "Check-out recorded");
    setException(null);
    setExceptionReason("");
    void load();
  };

  const runVisit = async (visit: DayVisit, kind: VisitKind, gps?: GpsBody) => {
    if (!user) return;
    const needsSelfie =
      (kind === "checkin" && visit.visitSequence === 1) ||
      (kind === "day_signout" && visit.daySignOutSelfieRequired);
    if (needsSelfie && !gps?.selfieUrl) {
      pendingField.current = null;
      pendingRef.current = { visit, kind };
      photoRef.current?.startFromGesture(kind === "day_signout" ? "CHECK_OUT" : "CHECK_IN");
      return;
    }
    setSending(true);
    try {
      let body = gps;
      if (!body) {
        const coords = await fetchGPSOnUserGesture();
        const address = await resolveAddress(coords.latitude, coords.longitude);
        body = {
          latitude: coords.latitude,
          longitude: coords.longitude,
          accuracyMeters: coords.accuracy,
          addressText: address || undefined,
        };
      }
      await postVisit(visit, kind, body);
      finishVisit(kind, body.exceptionRequested);
    } catch (err: unknown) {
      const error = err as Error & { code?: string };
      if (error.code === "OUTSIDE_GEOFENCE" && kind === "checkin" && gps?.selfieUrl) {
        setException({ visit, kind, ...gps });
        return;
      }
      toast.error(error.message || "Could not record the visit");
    } finally {
      setSending(false);
    }
  };

  const onPhoto = async (
    _checkType: "CHECK_IN" | "CHECK_OUT",
    file: File,
    location: { latitude: number; longitude: number; accuracy: number },
  ) => {
    const pending = pendingRef.current;
    pendingRef.current = null;
    if (!pending) return true;
    setSending(true);
    let selfieUrl = "";
    try {
      selfieUrl = await uploadPunchPhoto(file);
      const address = await resolveAddress(location.latitude, location.longitude);
      const gps: GpsBody = {
        latitude: location.latitude,
        longitude: location.longitude,
        accuracyMeters: location.accuracy,
        addressText: address || undefined,
        selfieUrl,
      };
      await postVisit(pending.visit, pending.kind, gps);
      finishVisit(pending.kind);
    } catch (err: unknown) {
      const error = err as Error & { code?: string };
      if (error.code === "OUTSIDE_GEOFENCE" && pending.kind === "checkin" && selfieUrl) {
        setException({
          visit: pending.visit,
          kind: pending.kind,
          latitude: location.latitude,
          longitude: location.longitude,
          accuracyMeters: location.accuracy,
          selfieUrl,
        });
      } else {
        toast.error(error.message || "Could not record the visit");
      }
    } finally {
      setSending(false);
    }
    return true;
  };

  const submitException = async () => {
    if (!exception) return;
    const text = exceptionReason.trim();
    if (!text) {
      toast.error("A reason is required");
      return;
    }
    setSending(true);
    try {
      await postVisit(exception.visit, exception.kind, {
        ...exception,
        exceptionRequested: true,
        reason: text,
      });
      finishVisit(exception.kind, true);
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : "Could not request an exception");
    } finally {
      setSending(false);
    }
  };

  const submitField = async () => {
    if (!user) return;
    if (!reason) {
      toast.error("Choose a reason");
      return;
    }
    pendingRef.current = null;
    pendingField.current = reason;
    photoRef.current?.startFromGesture("CHECK_IN");
  };

  const onPhotoOrField = async (
    checkType: "CHECK_IN" | "CHECK_OUT",
    file: File,
    location: { latitude: number; longitude: number; accuracy: number },
  ) => {
    if (pendingField.current) {
      const chosen = pendingField.current;
      pendingField.current = null;
      setSending(true);
      try {
        const selfieUrl = await uploadPunchPhoto(file);
        await taskFetch("/task-projects/field-attendance", user, {
          method: "POST",
          body: JSON.stringify({
            latitude: location.latitude,
            longitude: location.longitude,
            accuracyMeters: location.accuracy,
            selfieUrl,
            deviceInfo: deviceInfo(),
            reason: chosen,
            at: new Date().toISOString(),
          }),
        });
        setFieldStatus("Pending Approval");
        toast.success("Pending Approval");
      } catch (err: unknown) {
        toast.error(err instanceof Error ? err.message : "Could not check in");
      } finally {
        setSending(false);
      }
      return true;
    }
    return onPhoto(checkType, file, location);
  };

  if (!loaded || !user) return null;

  return (
    <>
      <div className="px-3 pt-3 space-y-2">
        {hasVisitToday
          ? visits.map((visit, index) => {
              const compliance = visitComplianceCopy(visit.complianceStatus);
              const sequence = visit.visitSequence || index + 1;
              const outLabel = visit.signOutForTheDay ? "Sign Out for the Day" : "Check-out";
              return (
                <div key={`${visit.taskId}-${sequence}`} className="rounded-2xl bg-white border border-gray-100 shadow-sm p-3 space-y-1 text-[13px]">
                  <p className="font-semibold text-gray-900">Visit {sequence}</p>
                  <p className="text-gray-700">{visit.taskName}</p>
                  <p>
                    <span className="text-gray-400">Scheduled:</span> {fmtWhen(visit.scheduledArrival)}
                  </p>
                  {(visit.customerName || visit.siteName) ? (
                    <p className="text-gray-600">{[visit.customerName, visit.siteName].filter(Boolean).join(" · ")}</p>
                  ) : null}
                  <p>
                    <span className="text-gray-400">Check-in:</span> {fmtWhen(visit.checkInAt)}
                  </p>
                  <p>
                    <span className="text-gray-400">Check-out:</span> {fmtWhen(visit.checkOutAt)}
                  </p>
                  {compliance ? (
                    <p>
                      <span className="font-semibold">{compliance.label}</span>
                      {compliance.note ? <span className="text-amber-700"> · {compliance.note}</span> : null}
                    </p>
                  ) : null}
                  {visit.exceptionStatus ? <p className="text-gray-600">{visit.exceptionStatus}</p> : null}
                  <div className="flex gap-2 pt-2">
                    <button
                      type="button"
                      disabled={sending}
                      onClick={() => void runVisit(visit, "checkin")}
                      className="flex-1 rounded-xl bg-[#2563eb] text-white font-semibold text-sm py-2.5 disabled:opacity-60"
                    >
                      Check-in
                    </button>
                    <button
                      type="button"
                      disabled={sending}
                      onClick={() => void runVisit(visit, visit.signOutForTheDay ? "day_signout" : "checkout")}
                      className="flex-1 rounded-xl border border-gray-200 bg-white text-gray-800 font-semibold text-sm py-2.5 disabled:opacity-60"
                    >
                      {outLabel}
                    </button>
                  </div>
                </div>
              );
            })
          : (
            <div className="rounded-2xl bg-white border border-gray-100 shadow-sm p-3">
              <p className="font-semibold text-gray-900">No site visit today</p>
              <p className="text-[12px] text-gray-500 mt-1">Use Mark In on Home when you are at the office. Site Check-in appears here only for an assigned visit.</p>
            </div>
          )}
      </div>
      {exception ? (
        <>
          <div className="fixed inset-0 z-50 bg-black/40" onClick={() => setException(null)} />
          <div className="fixed inset-x-4 top-[18%] z-50 bg-white rounded-2xl shadow-xl p-5">
            <h3 className="text-[17px] font-bold text-gray-900 mb-1">Request Exception</h3>
            <p className="text-[12px] text-gray-500 mb-3">You are outside the visit location. Add a reason to send the same location and selfie for approval.</p>
            <textarea
              value={exceptionReason}
              onChange={(e) => setExceptionReason(e.target.value)}
              rows={3}
              placeholder="Reason"
              className="w-full rounded-xl border border-gray-200 px-3 py-2 text-[14px] mb-3 resize-none"
            />
            <button
              type="button"
              disabled={sending || exceptionReason.trim().length < 1}
              onClick={() => void submitException()}
              className="w-full h-11 rounded-xl bg-[#2563eb] text-white font-semibold disabled:opacity-50"
            >
              Request Exception
            </button>
          </div>
        </>
      ) : null}
      <EmpPhotoPunchCapture ref={photoRef} submitting={sending} onSubmit={onPhotoOrField} onError={(message) => toast.error(message)} />
    </>
  );
}
