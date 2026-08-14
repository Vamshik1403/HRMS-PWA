"use client";

import { Handle, Position, type NodeProps } from "@xyflow/react";
import { Building2, ChevronDown, ChevronUp } from "lucide-react";
import { cn } from "@/app/utils/cn";
import type { CompanyNodeData } from "./types";

export function CompanyNode({ id, data }: NodeProps) {
  const node = data as unknown as CompanyNodeData;
  const { company, selected, highlighted, hasChildren, expanded, onToggle } = node;

  return (
    <div className="nopan nodrag relative pointer-events-auto">
      <Handle type="target" position={Position.Top} className="!opacity-0" />
      <button
        type="button"
        onClick={() => hasChildren && onToggle(id)}
        className={cn(
          "nodrag nopan pointer-events-auto flex h-[56px] w-[228px] cursor-pointer items-center gap-2.5 rounded-2xl border bg-white px-3 text-left shadow-[0_1px_2px_rgba(15,23,42,0.06)] transition-all",
          selected || highlighted
            ? "border-amber-400 shadow-[0_8px_20px_rgba(201,150,42,0.18)]"
            : "border-slate-200 hover:-translate-y-0.5 hover:border-slate-300 hover:shadow-md",
        )}
        aria-label={`${company.name} company node`}
      >
        {company.logoUrl ? (
          <img src={company.logoUrl} alt="" className="size-8 rounded-lg object-cover" />
        ) : (
          <span className="flex size-8 items-center justify-center rounded-lg bg-[#0F1C3F] text-white">
            <Building2 className="size-4" aria-hidden />
          </span>
        )}
        <span className="min-w-0 flex-1">
          <span className="block truncate text-[13px] font-semibold tracking-tight text-[#0F1C3F]">
            {company.name}
          </span>
          <span className="block text-[11px] italic text-slate-500">Organisation</span>
        </span>
        {hasChildren ? (
          expanded ? <ChevronUp className="size-3.5 text-slate-400" /> : <ChevronDown className="size-3.5 text-slate-400" />
        ) : null}
      </button>
      <Handle type="source" position={Position.Bottom} className="!opacity-0" />
    </div>
  );
}
