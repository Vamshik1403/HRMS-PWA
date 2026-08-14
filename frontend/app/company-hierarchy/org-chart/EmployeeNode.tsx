"use client";

import { useState } from "react";
import { Handle, Position, type NodeProps } from "@xyflow/react";
import { ChevronDown } from "lucide-react";
import { cn } from "@/app/utils/cn";
import { EmployeeHoverCard } from "./EmployeeHoverCard";
import type { EmployeeNodeData } from "./types";

function initials(name: string) {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (!parts.length) return "?";
  return ((parts[0][0] || "") + (parts[1]?.[0] || "")).toUpperCase();
}

export function EmployeeNode({ id, data }: NodeProps) {
  const node = data as unknown as EmployeeNodeData;
  const { employee, highlighted, hasChildren, expanded, onToggle, onOpen, reports } = node;
  const [hover, setHover] = useState(false);

  return (
    <div
      className="nopan nodrag relative pointer-events-auto"
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
    >
      <Handle type="target" position={Position.Top} className="!opacity-0" />
      <button
        type="button"
        onClick={(e) => {
          e.stopPropagation();
          onOpen(id);
        }}
        className={cn(
          "nodrag nopan pointer-events-auto flex h-[84px] w-[312px] cursor-pointer items-center gap-3 rounded-full border bg-white pl-2 pr-3 text-left shadow-[0_1px_3px_rgba(15,23,42,0.07)] transition-all",
          hover || highlighted
            ? "border-sky-400 shadow-[0_8px_18px_rgba(14,165,233,0.16)]"
            : "border-slate-200 hover:-translate-y-0.5 hover:border-slate-300 hover:shadow-lg",
        )}
        aria-label={`Open profile for ${employee.name}`}
      >
        {employee.avatar ? (
          <img
            src={employee.avatar}
            alt=""
            className="size-[52px] shrink-0 rounded-full object-cover ring-2 ring-white"
          />
        ) : (
          <span className="flex size-[52px] shrink-0 items-center justify-center rounded-full bg-[#0F1C3F] text-[13px] font-semibold text-white ring-2 ring-white">
            {initials(employee.name)}
          </span>
        )}
        <span className="min-w-0 flex-1">
          <span className="block truncate text-[13px] font-semibold leading-tight text-[#0F1C3F]">
            {employee.name}
          </span>
          <span className="mt-0.5 block truncate text-[11px] italic text-slate-500">
            {employee.title}
          </span>
        </span>
        <span className="flex shrink-0 flex-col items-end gap-1">
          <span className="text-[11px] font-semibold tabular-nums text-amber-700">
            {employee.employeeCode || employee.id}
          </span>
          {employee.directReportCount > 0 ? (
            <span className="text-[10px] text-slate-400">{employee.directReportCount} reports</span>
          ) : (
            <span
              className={cn(
                "rounded-full px-1.5 py-0.5 text-[10px] font-medium",
                employee.status === "active" ? "bg-emerald-50 text-emerald-700" : "bg-slate-100 text-slate-500",
              )}
            >
              {employee.status}
            </span>
          )}
        </span>
      </button>
      {hasChildren ? (
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            onToggle(id);
          }}
          className={cn(
            "nodrag nopan pointer-events-auto absolute -bottom-3 left-1/2 z-10 flex size-6 -translate-x-1/2 items-center justify-center rounded-full border bg-white text-slate-600 shadow-sm",
            expanded ? "border-amber-300 text-amber-700" : "border-slate-200",
          )}
          aria-label={expanded ? `Collapse reports of ${employee.name}` : `Expand reports of ${employee.name}`}
          aria-expanded={expanded}
        >
          <ChevronDown className={cn("size-3.5 transition-transform", expanded && "rotate-180")} />
        </button>
      ) : null}
      {hover ? <EmployeeHoverCard employee={employee} reports={reports} /> : null}
      <Handle type="source" position={Position.Bottom} className="!opacity-0" />
    </div>
  );
}
