"use client";

import {
  dueVsActualLabel,
  firstCheckInVisit,
  googleMapsLink,
  lastCheckOutVisit,
  taskSiteAddress,
  visitCoords,
  visitPlaceName,
  type TaskWithSiteVisits,
} from "../../../utils/taskSiteVisit";

function fmtWhen(iso?: string | null) {
  if (!iso) return "—";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "—";
  return d.toLocaleString("en-IN", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    hour12: true,
  });
}

function GpsLine({
  label,
  at,
  lat,
  lng,
  address,
}: {
  label: string;
  at?: string | null;
  lat?: number | null;
  lng?: number | null;
  address?: string | null;
}) {
  const maps = lat != null && lng != null ? googleMapsLink(lat, lng) : null;
  const place = (address || "").trim();
  return (
    <div className="space-y-0.5">
      <p>
        <span className="text-gray-400">{label}:</span> {fmtWhen(at)}
      </p>
      {place && maps ? (
        <p>
          <a href={maps} target="_blank" rel="noreferrer" className="text-[#2563eb] underline">
            {place}
          </a>
        </p>
      ) : place ? (
        <p className="text-gray-700">{place}</p>
      ) : (
        <p className="text-gray-400">—</p>
      )}
    </div>
  );
}

export function TaskSiteVisitSummary({
  task,
  compact = false,
  onCheckIn,
  onCheckOut,
  sending,
  allowActions,
  visitHeading,
  scheduledText,
  complianceLabel,
  complianceNote,
  checkInLabel = "Site check in",
  checkOutLabel = "Site check out",
}: {
  task: TaskWithSiteVisits;
  compact?: boolean;
  onCheckIn?: () => void;
  onCheckOut?: () => void;
  sending?: boolean;
  allowActions?: boolean;
  visitHeading?: string | null;
  scheduledText?: string | null;
  complianceLabel?: string | null;
  complianceNote?: string | null;
  checkInLabel?: string;
  checkOutLabel?: string;
}) {
  const due = task.dueAt || task.dueDateTime;
  const firstIn = firstCheckInVisit(task);
  const lastOut = lastCheckOutVisit(task);
  const inCoords = visitCoords(firstIn);
  const outCoords = visitCoords(lastOut);
  const vsDue = dueVsActualLabel(task);
  const siteLabel = taskSiteAddress(task);
  const wrap = compact
    ? "text-[12px] text-gray-700 space-y-1"
    : "rounded-2xl bg-white border border-gray-100 shadow-sm p-4 space-y-2 text-[13px]";

  return (
    <div className={wrap}>
      {due ? (
        <p>
          <span className="text-gray-400">Due date & time:</span> {fmtWhen(String(due))}
        </p>
      ) : null}
      {siteLabel ? (
        <p>
          <span className="text-gray-400">Site address:</span> {siteLabel}
        </p>
      ) : null}
      {visitHeading ? <p className="font-semibold text-gray-900">{visitHeading}</p> : null}
      {scheduledText ? (
        <p>
          <span className="text-gray-400">Scheduled:</span> {scheduledText}
        </p>
      ) : null}
      {complianceLabel ? (
        <p>
          <span className="text-gray-400">Status:</span> {complianceLabel}
          {complianceNote ? <span className="font-semibold text-amber-700"> · {complianceNote}</span> : null}
        </p>
      ) : null}
      <GpsLine
        label="First check-in"
        at={firstIn?.at || firstIn?.createdAt}
        lat={inCoords?.lat}
        lng={inCoords?.lng}
        address={visitPlaceName(firstIn)}
      />
      <GpsLine
        label="Last check-out"
        at={lastOut?.at || lastOut?.createdAt}
        lat={outCoords?.lat}
        lng={outCoords?.lng}
        address={visitPlaceName(lastOut)}
      />
      {vsDue ? (
        <p>
          <span className="text-gray-400">Actual vs due:</span> {vsDue}
        </p>
      ) : null}
      {allowActions && (onCheckIn || onCheckOut) ? (
        <div className={compact ? "flex gap-2 pt-1" : "flex gap-2 pt-2"}>
          {onCheckIn ? (
            <button
              type="button"
              disabled={sending}
              onClick={onCheckIn}
              className="flex-1 rounded-xl bg-[#2563eb] text-white font-semibold text-sm py-2.5 disabled:opacity-60"
            >
              {checkInLabel}
            </button>
          ) : null}
          {onCheckOut ? (
            <button
              type="button"
              disabled={sending}
              onClick={onCheckOut}
              className="flex-1 rounded-xl border border-gray-200 bg-white text-gray-800 font-semibold text-sm py-2.5 disabled:opacity-60"
            >
              {checkOutLabel}
            </button>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}
