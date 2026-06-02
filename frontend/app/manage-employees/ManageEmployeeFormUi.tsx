"use client";

import type { ReactNode } from "react";
import { ChevronDown, ChevronUp } from "lucide-react";
import { cn } from "../../lib/utils";

export type EmpFormSectionId = "basic" | "employment" | "attendance" | "additional";

export const EMPLOYEE_FORM_SECTIONS: { id: EmpFormSectionId; label: string }[] = [
  { id: "basic", label: "Basic Information" },
  { id: "employment", label: "Employment Information" },
  { id: "attendance", label: "Attendance & Selfcare Setup" },
  { id: "additional", label: "Additional Information" },
];

export function EmployeeFormSectionNav({
  active,
  onChange,
  sections = EMPLOYEE_FORM_SECTIONS,
}: {
  active: EmpFormSectionId;
  onChange: (id: EmpFormSectionId) => void;
  sections?: { id: EmpFormSectionId; label: string }[];
}) {
  return (
    <div className="mb-4 w-full rounded-lg border border-gray-200 bg-[#f1f5f9] p-1">
      <div
        className="flex w-full min-w-0 gap-1 overflow-x-auto scrollbar-thin"
        role="tablist"
        aria-label="Employee form sections"
      >
        {sections.map((s) => {
          const isActive = active === s.id;
          return (
            <button
              key={s.id}
              type="button"
              role="tab"
              aria-selected={isActive}
              onClick={() => onChange(s.id)}
              className={cn(
                "shrink-0 rounded-md px-3 py-2.5 text-xs font-medium transition-all sm:px-4 sm:text-sm",
                isActive
                  ? "bg-white text-blue-800 shadow-sm ring-1 ring-blue-200"
                  : "text-gray-600 hover:bg-white/60 hover:text-gray-900",
              )}
            >
              {s.label}
            </button>
          );
        })}
      </div>
    </div>
  );
}

export function CollapsibleFormGroup({
  title,
  expanded,
  onToggle,
  children,
}: {
  title?: string;
  expanded: boolean;
  onToggle: () => void;
  children: ReactNode;
}) {
  return (
    <div className="rounded-lg border border-gray-200 bg-gray-50/50">
      <button
        type="button"
        onClick={onToggle}
        className="flex w-full items-center justify-between gap-2 px-3 py-2.5 text-left hover:bg-gray-100/80"
        aria-expanded={expanded}
      >
        <span className="text-sm font-medium text-gray-800">{title}</span>
        <span
          className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-md border border-gray-200 bg-white text-gray-600 shadow-sm"
          aria-hidden
        >
          {expanded ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
        </span>
      </button>
      {expanded ? <div className="space-y-4 border-t border-gray-200 bg-white p-4">{children}</div> : null}
    </div>
  );
}
