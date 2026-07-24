"use client";

import { Moon, Sun } from "lucide-react";
import { cn } from "@/app/utils/cn";

export function EmpThemeToggle({
  theme,
  onToggle,
  className,
  monochrome = false,
}: {
  theme: "light" | "dark";
  onToggle: () => void;
  className?: string;
  monochrome?: boolean;
}) {
  const isDark = theme === "dark";

  return (
    <button
      type="button"
      aria-label={isDark ? "Switch to light mode" : "Switch to dark mode"}
      onClick={onToggle}
      className={cn(
        "inline-flex size-10 shrink-0 items-center justify-center rounded-[10px] transition-colors duration-150",
        monochrome
          ? "text-[#111827] hover:bg-[#F3F4F6]"
          : "border border-border bg-muted/60 text-foreground hover:bg-muted",
        className,
      )}
    >
      <span className="relative size-5">
        <Sun
          className={cn(
            "absolute inset-0 size-5 transition-all duration-300",
            monochrome ? "text-[#111827]" : "text-amber-500",
            isDark ? "scale-0 rotate-90 opacity-0" : "scale-100 rotate-0 opacity-100",
          )}
          strokeWidth={1.75}
        />
        <Moon
          className={cn(
            "absolute inset-0 size-5 transition-all duration-300",
            monochrome ? "text-[#111827]" : "text-slate-300",
            isDark ? "scale-100 rotate-0 opacity-100" : "scale-0 -rotate-90 opacity-0",
          )}
          strokeWidth={1.75}
        />
      </span>
    </button>
  );
}
