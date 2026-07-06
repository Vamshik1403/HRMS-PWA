"use client";

import type { ReactNode } from "react";
import { displayValue } from "@/app/utils/display";

export interface DetailRow {
  label: string;
  value: unknown;
  /** Optional link for URLs / file paths */
  href?: string;
}

interface DetailCardProps {
  title: string;
  subtitle?: string;
  rows?: DetailRow[];
  children?: ReactNode;
  className?: string;
}

export function DetailCard({ title, subtitle, rows = [], children, className }: DetailCardProps) {
  return (
    <div className={`rounded-2xl border border-border bg-card p-6 shadow-sm ${className || ""}`}>
      <div className="mb-6">
        <h3 className="font-display text-lg font-semibold text-foreground">{title}</h3>
        {subtitle ? <p className="mt-1 text-sm text-muted-foreground">{subtitle}</p> : null}
      </div>

      {rows.length > 0 && (
        <div className="divide-y divide-border">
          {rows.map((row) => (
            <div key={row.label} className="grid grid-cols-2 gap-4 py-2.5 text-sm">
              <div className="text-muted-foreground">{row.label}</div>
              <div className="font-medium text-foreground break-words">
                {row.href ? (
                  <a
                    href={row.href}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-primary underline-offset-2 hover:underline"
                  >
                    {displayValue(row.value)}
                  </a>
                ) : (
                  displayValue(row.value)
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      {children}
    </div>
  );
}
