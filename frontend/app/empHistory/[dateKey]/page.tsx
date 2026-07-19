"use client";

import { Icon } from "@iconify/react";
import EmpMobileLayout from "../../components/layout/EmpMobileLayout";
import { EmpDesktopWorkspaceGate } from "../../components/emp/EmpDesktopWorkspaceGate";
import { EmpDesktopAttendanceDayDetail } from "../../components/emp/desktop/EmpDesktopAttendanceDayDetail";
import {
  formatLocationLines,
  formatPunchTime,
  punchTypeLabel,
} from "../../utils/empAttendanceHistory";
import { useEmpAttendanceDayDetail } from "../../hooks/useEmpAttendanceDayDetail";

function EmpAttendanceDayDetailMobile() {
  const { dayTitle, loading, records, siteVisits, summary, dayPunches, router } =
    useEmpAttendanceDayDetail();

  return (
    <div className="px-4 pt-4 pb-8">
      <button
        type="button"
        onClick={() => router.back()}
        className="flex items-center gap-1 text-[13px] font-semibold text-[#2563eb] mb-3"
      >
        <Icon icon="solar:arrow-left-linear" className="w-5 h-5" />
        Back
      </button>

      <h1 className="text-[20px] font-bold text-gray-900 mb-1">{dayTitle}</h1>
      {summary && (
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-4 mb-5 space-y-2">
          <div className="grid grid-cols-2 gap-2 text-[12px]">
            <div>
              <span className="text-gray-400 text-[10px] font-bold uppercase">Mark IN</span>
              <p className="font-semibold text-gray-900">
                {formatPunchTime(dayPunches.checkIn?.checkinTime)}
              </p>
            </div>
            <div>
              <span className="text-gray-400 text-[10px] font-bold uppercase">Mark OUT</span>
              <p className="font-semibold text-gray-900">
                {formatPunchTime(dayPunches.checkOut?.checkinTime)}
              </p>
            </div>
            <div>
              <span className="text-gray-400 text-[10px] font-bold uppercase">Break IN</span>
              <p className="font-semibold text-amber-600">
                {formatPunchTime(dayPunches.breakIn?.checkinTime)}
              </p>
            </div>
            <div>
              <span className="text-gray-400 text-[10px] font-bold uppercase">Break OUT</span>
              <p className="font-semibold text-emerald-600">
                {formatPunchTime(dayPunches.breakOut?.checkinTime)}
              </p>
            </div>
          </div>
          <p className="text-[12px] text-gray-500 pt-1 border-t border-gray-100">
            Work {summary.workLabel} · Break {summary.breakLabel}
          </p>
          <div className="text-[11px] text-gray-500 space-y-2 pt-1 border-t border-gray-100">
            <LocationDetail label="Mark IN location" punch={dayPunches.checkIn} />
            <LocationDetail label="Mark OUT location" punch={dayPunches.checkOut} />
          </div>
        </div>
      )}

      {loading ? (
        <div className="py-12 flex justify-center">
          <Icon icon="solar:refresh-bold-duotone" className="w-8 h-8 text-blue-400 animate-spin" />
        </div>
      ) : (
        <>
          <section className="mb-6">
            <h2 className="text-[13px] font-bold text-gray-400 uppercase tracking-wider mb-2">
              Attendance punches
            </h2>
            {records.length === 0 ? (
              <p className="text-[13px] text-gray-400 bg-white rounded-2xl border border-gray-100 p-4">
                No punches recorded this day
              </p>
            ) : (
              <div className="space-y-2">
                {records.map((r) => (
                  <div
                    key={r.id}
                    className="bg-white rounded-2xl border border-gray-100 shadow-sm px-4 py-3"
                  >
                    <div className="flex items-center justify-between gap-2">
                      <p className="text-[14px] font-bold text-gray-900">
                        {punchTypeLabel(r.checkType)}
                      </p>
                      <p className="text-[13px] font-semibold text-gray-700">
                        {formatPunchTime(r.checkinTime)}
                      </p>
                    </div>
                    {r.accuracy != null && (
                      <p className="text-[11px] text-gray-400 mt-1">GPS ±{Math.round(r.accuracy)}m</p>
                    )}
                    {(() => {
                      const { address, coordinates } = formatLocationLines(r);
                      if (!address && !coordinates) return null;
                      return (
                        <div className="mt-0.5 space-y-0.5">
                          {address ? (
                            <p className="text-[11px] text-gray-500 flex items-start gap-1">
                              <Icon
                                icon="solar:map-point-bold-duotone"
                                className="w-3.5 h-3.5 text-gray-400 shrink-0 mt-px"
                              />
                              <span className="min-w-0">{address}</span>
                            </p>
                          ) : null}
                          {coordinates ? (
                            <p className="text-[10px] font-mono text-gray-400 pl-5">{coordinates}</p>
                          ) : null}
                        </div>
                      );
                    })()}
                  </div>
                ))}
              </div>
            )}
          </section>

          <section>
            <h2 className="text-[13px] font-bold text-gray-400 uppercase tracking-wider mb-2">
              Site visits
            </h2>
            {siteVisits.length === 0 ? (
              <p className="text-[13px] text-gray-400 bg-white rounded-2xl border border-gray-100 p-4">
                No site visit tasks scheduled this day
              </p>
            ) : (
              <div className="space-y-2">
                {siteVisits.map((t) => (
                  <div
                    key={t.id}
                    className="bg-white rounded-2xl border border-gray-100 shadow-sm px-4 py-3"
                  >
                    <p className="text-[14px] font-bold text-gray-900">{t.taskName}</p>
                    <p className="text-[12px] text-gray-500 mt-0.5">
                      {t.site?.branchName || t.site?.city || "Site"} · {t.status}
                    </p>
                    {t.scheduleDateTime && (
                      <p className="text-[12px] text-[#2563eb] font-semibold mt-1">
                        Scheduled {formatPunchTime(t.scheduleDateTime)}
                      </p>
                    )}
                    <div className="mt-3 pt-3 border-t border-gray-100 grid grid-cols-2 gap-2">
                      <div>
                        <p className="text-[10px] font-bold text-gray-400 uppercase">Site mark IN</p>
                        {t.punchesLoading ? (
                          <p className="text-[12px] text-gray-300 animate-pulse mt-0.5">Loading…</p>
                        ) : (
                          <p className="text-[13px] font-semibold text-gray-900 mt-0.5">
                            {t.markIn ? formatPunchTime(t.markIn) : "—"}
                          </p>
                        )}
                      </div>
                      <div>
                        <p className="text-[10px] font-bold text-gray-400 uppercase">Site mark OUT</p>
                        {t.punchesLoading ? (
                          <p className="text-[12px] text-gray-300 animate-pulse mt-0.5">Loading…</p>
                        ) : (
                          <p className="text-[13px] font-semibold text-gray-900 mt-0.5">
                            {t.markOut ? formatPunchTime(t.markOut) : "—"}
                          </p>
                        )}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </section>
        </>
      )}
    </div>
  );
}

function LocationDetail({
  label,
  punch,
}: {
  label: string;
  punch: { latitude?: number | null; longitude?: number | null; address?: string | null } | null;
}) {
  const { address, coordinates } = formatLocationLines(punch);
  return (
    <div>
      <p className="font-semibold text-gray-600">{label}</p>
      {address ? <p className="text-gray-600 mt-0.5">{address}</p> : <p className="text-gray-400 mt-0.5">—</p>}
      {coordinates ? <p className="font-mono text-[10px] text-gray-500 mt-0.5">{coordinates}</p> : null}
    </div>
  );
}

export default function EmpHistoryDayPage() {
  return (
    <EmpMobileLayout>
      <EmpDesktopWorkspaceGate
        workspace={<EmpDesktopAttendanceDayDetail />}
        mobile={<EmpAttendanceDayDetailMobile />}
      />
    </EmpMobileLayout>
  );
}
