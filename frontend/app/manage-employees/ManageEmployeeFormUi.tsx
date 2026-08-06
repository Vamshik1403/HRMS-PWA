"use client";

import type { ReactNode } from "react";
import { ChevronDown, ChevronUp } from "lucide-react";
import { FormSectionNav, type FormSectionTab } from "../components/app/form-section-nav";

export type EmpFormSectionId = "basic" | "employment" | "documents" | "additional" | "attendance" | "roles&permissions";

export const EMPLOYEE_FORM_SECTIONS: FormSectionTab[] = [
  { id: "basic", label: "Basic Information" },
  { id: "employment", label: "Employment Information" },
  { id: "documents", label: "Documents" },
  { id: "additional", label: "Additional Information" },
  { id: "attendance", label: "Attendance & Selfcare Setup" },
  { id: "roles&permissions", label: "Rights & Permissions" },
];

export function EmployeeFormSectionNav({
  active,
  onChange,
  sections = EMPLOYEE_FORM_SECTIONS,
}: {
  active: EmpFormSectionId;
  onChange: (id: EmpFormSectionId) => void;
  sections?: FormSectionTab[];
}) {
  return (
    <FormSectionNav
      active={active}
      onChange={(id) => onChange(id as EmpFormSectionId)}
      sections={sections}
      ariaLabel="Employee form sections"
    />
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
    <div className="rounded-lg border border-border bg-muted/30">
      <button
        type="button"
        onClick={onToggle}
        className="flex w-full items-center justify-between gap-2 px-3 py-2.5 text-left hover:bg-muted/50"
        aria-expanded={expanded}
      >
        <span className="text-sm font-medium text-foreground">{title}</span>
        <span
          className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-md border border-border bg-background text-muted-foreground shadow-sm"
          aria-hidden
        >
          {expanded ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
        </span>
      </button>
      {expanded ? <div className="border-t border-border px-3 py-3">{children}</div> : null}
    </div>
  );
}
