"use client";

import { cn } from "@/app/utils/cn";

export function OrgChartToolbar({
  view,
  onView,
}: {
  view: "employees" | "departments";
  onView: (view: "employees" | "departments") => void;
}) {
  return (
    <div className="flex shrink-0 items-center">
      <div className="inline-flex rounded-full border border-slate-200 bg-white p-0.5 text-xs font-semibold">
        <button
          type="button"
          onClick={() => onView("employees")}
          className={cn(
            "rounded-full px-3 py-1.5",
            view === "employees" ? "bg-sky-600 text-white" : "text-slate-600 hover:bg-slate-50",
          )}
          aria-pressed={view === "employees"}
        >
          Employee tree
        </button>
        <button
          type="button"
          onClick={() => onView("departments")}
          className={cn(
            "rounded-full px-3 py-1.5",
            view === "departments" ? "bg-sky-600 text-white" : "text-slate-600 hover:bg-slate-50",
          )}
          aria-pressed={view === "departments"}
        >
          Department tree
        </button>
      </div>
    </div>
  );
}
