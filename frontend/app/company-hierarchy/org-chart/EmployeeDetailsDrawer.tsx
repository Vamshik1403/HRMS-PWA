"use client";

import { Mail, MapPin, Phone, User, Users } from "lucide-react";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/app/components/ui/sheet";
import { cn } from "@/app/utils/cn";
import type { Employee } from "./types";

function initials(name: string) {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (!parts.length) return "?";
  return ((parts[0][0] || "") + (parts[1]?.[0] || "")).toUpperCase();
}

function formatDate(value: string) {
  if (!value) return "—";
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return value;
  return d.toLocaleDateString(undefined, { day: "numeric", month: "short", year: "numeric" });
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="grid grid-cols-[110px_1fr] gap-2 py-2 text-sm">
      <dt className="text-slate-400">{label}</dt>
      <dd className="font-medium text-[#0F1C3F]">{value || "—"}</dd>
    </div>
  );
}

export function EmployeeDetailsDrawer({
  employee,
  managerName,
  reports,
  open,
  onOpenChange,
  isMobile,
}: {
  employee: Employee | null;
  managerName: string | null;
  reports: Employee[];
  open: boolean;
  onOpenChange: (open: boolean) => void;
  isMobile: boolean;
}) {
  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent
        side={isMobile ? "bottom" : "right"}
        className={cn(
          "overflow-y-auto border-slate-200 bg-white p-0",
          isMobile ? "h-[85vh] rounded-t-2xl sm:max-w-none" : "w-full sm:max-w-md",
        )}
      >
        {employee ? (
          <>
            <SheetHeader className="border-b border-slate-100 px-6 pb-5 pt-8 text-left">
              <div className="flex items-center gap-4">
                {employee.avatar ? (
                  <img src={employee.avatar} alt="" className="size-16 rounded-full object-cover" />
                ) : (
                  <span className="flex size-16 items-center justify-center rounded-full bg-[#0F1C3F] text-lg font-semibold text-white">
                    {initials(employee.name)}
                  </span>
                )}
                <div className="min-w-0">
                  <SheetTitle className="text-lg text-[#0F1C3F]">{employee.name}</SheetTitle>
                  <SheetDescription className="italic">{employee.title}</SheetDescription>
                </div>
              </div>
            </SheetHeader>
            <div className="px-6 py-4">
              <dl className="divide-y divide-slate-100">
                <Row label="Employee ID" value={employee.employeeCode || employee.id} />
                <Row label="Department" value={employee.department} />
                <Row label="Manager" value={managerName || "—"} />
                <Row label="Location" value={employee.location} />
                <Row label="Email" value={employee.email} />
                <Row label="Phone" value={employee.phone} />
                <Row label="Joined" value={formatDate(employee.joinedDate)} />
                <Row label="Status" value={employee.status} />
              </dl>
              <div className="mt-5 space-y-2">
                <p className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-slate-400">
                  <Users className="size-3.5" /> Direct reports ({reports.length})
                </p>
                {reports.length === 0 ? (
                  <p className="text-sm text-slate-400">No direct reports</p>
                ) : (
                  <ul className="space-y-1.5">
                    {reports.map((r) => (
                      <li key={r.id} className="rounded-xl border border-slate-100 px-3 py-2 text-sm">
                        <p className="font-medium text-[#0F1C3F]">{r.name}</p>
                        <p className="text-xs italic text-slate-500">{r.title}</p>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
              <div className="mt-6 grid grid-cols-3 gap-2 text-[11px] text-slate-500">
                <span className="inline-flex items-center gap-1"><Mail className="size-3" /> Email</span>
                <span className="inline-flex items-center gap-1"><Phone className="size-3" /> Phone</span>
                <span className="inline-flex items-center gap-1"><MapPin className="size-3" /> Location</span>
                <span className="col-span-3 inline-flex items-center gap-1">
                  <User className="size-3" /> Reporting line from manager field
                </span>
              </div>
            </div>
          </>
        ) : null}
      </SheetContent>
    </Sheet>
  );
}
