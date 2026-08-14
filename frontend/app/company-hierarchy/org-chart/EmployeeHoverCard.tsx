"use client";

import type { Employee } from "./types";

function initials(name: string) {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (!parts.length) return "?";
  return ((parts[0][0] || "") + (parts[1]?.[0] || "")).toUpperCase();
}

export function EmployeeHoverCard({
  employee,
  reports,
}: {
  employee: Employee;
  reports: Employee[];
}) {
  const code = employee.employeeCode || employee.id;
  return (
    <div
      className="nodrag nopan pointer-events-auto absolute left-0 top-[calc(100%+10px)] z-[80] w-[320px] rounded-2xl border border-slate-200 bg-white p-3 text-left shadow-[0_12px_32px_rgba(15,23,42,0.14)]"
      role="tooltip"
    >
      <div className="flex items-start gap-3">
        {employee.avatar ? (
          <img src={employee.avatar} alt="" className="size-14 shrink-0 rounded-xl object-cover" />
        ) : (
          <span className="flex size-14 shrink-0 items-center justify-center rounded-xl bg-[#0F1C3F] text-sm font-semibold text-white">
            {initials(employee.name)}
          </span>
        )}
        <div className="min-w-0">
          <p className="truncate text-[13px] font-semibold text-[#0F1C3F]">
            {code} - {employee.name}
          </p>
          <p className="mt-0.5 truncate text-[12px] text-slate-500">{employee.email || "—"}</p>
          <p className="mt-1 truncate text-[12px] text-slate-600">{employee.title || "—"}</p>
          <p className="truncate text-[12px] text-slate-500">{employee.department || "—"}</p>
        </div>
      </div>
      <div className="mt-3 border-t border-slate-100 pt-2">
        <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-400">
          Reportees ({reports.length})
        </p>
        {reports.length === 0 ? (
          <p className="mt-1 text-[12px] text-slate-400">No direct reports</p>
        ) : (
          <ul className="mt-1 space-y-0.5">
            {reports.slice(0, 6).map((r) => (
              <li key={r.id} className="truncate text-[12px] text-[#0F1C3F]">
                {r.name}
                {r.title ? <span className="text-slate-400"> · {r.title}</span> : null}
              </li>
            ))}
            {reports.length > 6 ? (
              <li className="text-[11px] text-slate-400">+{reports.length - 6} more</li>
            ) : null}
          </ul>
        )}
      </div>
    </div>
  );
}
