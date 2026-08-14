"use client";

import { Handle, Position, type NodeProps } from "@xyflow/react";
import {
  Briefcase,
  ChevronDown,
  Cpu,
  HeartPulse,
  Shield,
  Sparkles,
  Wallet,
} from "lucide-react";
import { cn } from "@/app/utils/cn";
import type { DepartmentNodeData } from "./types";

const PALETTE = [
  { wrap: "bg-teal-500", text: "text-teal-700", chip: "bg-teal-50" },
  { wrap: "bg-blue-600", text: "text-blue-700", chip: "bg-blue-50" },
  { wrap: "bg-lime-500", text: "text-lime-700", chip: "bg-lime-50" },
  { wrap: "bg-violet-500", text: "text-violet-700", chip: "bg-violet-50" },
  { wrap: "bg-orange-500", text: "text-orange-700", chip: "bg-orange-50" },
] as const;

function deptIcon(name: string) {
  const n = name.toLowerCase();
  if (n.includes("eng") || n.includes("tech") || n.includes("it")) return Cpu;
  if (n.includes("people") || n.includes("hr") || n.includes("human")) return HeartPulse;
  if (n.includes("finance") || n.includes("account") || n.includes("payroll")) return Wallet;
  if (n.includes("product") || n.includes("design")) return Sparkles;
  if (n.includes("security") || n.includes("admin")) return Shield;
  return Briefcase;
}

export function DepartmentNode({ id, data }: NodeProps) {
  const node = data as unknown as DepartmentNodeData;
  const { department, colorIndex, selected, highlighted, hasChildren, expanded, onToggle, onOpen } = node;
  const palette = PALETTE[Math.abs(colorIndex) % PALETTE.length];
  const Icon = deptIcon(department.name);

  return (
    <div className="nopan nodrag relative pointer-events-auto">
      <Handle type="target" position={Position.Top} className="!opacity-0" />
      <button
        type="button"
        onClick={() => {
          if (hasChildren) onToggle(id);
        }}
        className={cn(
          "nodrag nopan pointer-events-auto flex h-[70px] w-[248px] cursor-pointer items-center gap-3 rounded-full border bg-white px-2.5 text-left shadow-[0_1px_3px_rgba(15,23,42,0.07)] transition-all",
          selected || highlighted
            ? "border-amber-400 shadow-[0_8px_20px_rgba(201,150,42,0.18)]"
            : "border-slate-200 hover:-translate-y-0.5 hover:border-slate-300 hover:shadow-md",
        )}
        aria-label={`${department.name} department, ${department.employeeCount} employees`}
      >
        <span className={cn("flex size-11 shrink-0 items-center justify-center rounded-full text-white", palette.wrap)}>
          <Icon className="size-5" aria-hidden />
        </span>
        <span className="min-w-0 flex-1">
          <span className="block truncate text-[13px] font-semibold text-[#0F1C3F]">{department.name}</span>
          <span className={cn("mt-0.5 inline-block rounded-full px-1.5 py-0.5 text-[11px] italic", palette.chip, palette.text)}>
            {department.employeeCount} {department.employeeCount === 1 ? "Employee" : "Employees"}
          </span>
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
          aria-label={expanded ? `Collapse ${department.name}` : `Expand ${department.name}`}
          aria-expanded={expanded}
        >
          <ChevronDown className={cn("size-3.5 transition-transform", expanded && "rotate-180")} />
        </button>
      ) : null}
      <Handle type="source" position={Position.Bottom} className="!opacity-0" />
    </div>
  );
}
