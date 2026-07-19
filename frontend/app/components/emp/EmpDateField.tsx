"use client";

import { useCallback, useRef } from "react";
import { Calendar } from "lucide-react";
import { useEmpPortalDesktop } from "../layout/EmpPortalShell";
import { Input } from "../ui/input";
import { Label } from "../ui/label";
import { EmpMobileDateField } from "./EmpMobileDateField";
import { cn } from "@/app/utils/cn";

function formatDateDisplay(value: string) {
  if (!value) return "";
  const [y, m, d] = value.split("-").map(Number);
  if (!y || !m || !d) return value;
  return `${String(d).padStart(2, "0")}-${String(m).padStart(2, "0")}-${y}`;
}

/** Date field — native visible picker on desktop, mobile-friendly overlay on PWA. */
export function EmpDateField(props: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  min?: string;
  max?: string;
  className?: string;
}) {
  const isDesktop = useEmpPortalDesktop();
  const inputRef = useRef<HTMLInputElement>(null);

  const openPicker = useCallback(() => {
    const el = inputRef.current;
    if (!el) return;
    el.focus({ preventScroll: true });
    if (typeof el.showPicker === "function") {
      try {
        el.showPicker();
        return;
      } catch {
        /* fall through */
      }
    }
    el.click();
  }, []);

  if (!isDesktop) {
    return <EmpMobileDateField {...props} />;
  }

  return (
    <div className={cn("min-w-[200px]", props.className)}>
      <Label className="text-xs font-medium text-muted-foreground">{props.label}</Label>
      <div className="relative mt-1.5">
        <input
          ref={inputRef}
          type="date"
          value={props.value}
          min={props.min}
          max={props.max}
          onChange={(e) => props.onChange(e.target.value)}
          className="sr-only"
          tabIndex={-1}
          aria-hidden
        />
        <Input
          type="text"
          readOnly
          value={formatDateDisplay(props.value)}
          placeholder="dd-mm-yyyy"
          onClick={openPicker}
          onKeyDown={(e) => {
            if (e.key === "Enter" || e.key === " ") {
              e.preventDefault();
              openPicker();
            }
          }}
          className="h-12 pr-10 cursor-pointer"
          aria-label={props.label}
          role="button"
        />
        <button
          type="button"
          onClick={(e) => {
            e.preventDefault();
            e.stopPropagation();
            openPicker();
          }}
          className="absolute right-2 top-1/2 z-10 -translate-y-1/2 rounded-md p-1.5 text-primary hover:bg-muted transition-colors"
          aria-label={`Open ${props.label} calendar`}
        >
          <Calendar className="size-4" />
        </button>
      </div>
    </div>
  );
}
