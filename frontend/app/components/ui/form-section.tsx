"use client";

import type { ReactNode } from "react";
import { cn } from "@/app/utils/cn";

interface FormSectionProps {
  title: string;
  description?: string;
  children: ReactNode;
  className?: string;
}

export function FormSection({ title, description, children, className }: FormSectionProps) {
  return (
    <section className={cn("space-y-5", className)}>
      <div className="space-y-1 pb-1 border-b border-border/80">
        <h3 className="text-sm font-semibold text-foreground tracking-tight">{title}</h3>
        {description && (
          <p className="text-xs text-muted-foreground leading-relaxed">{description}</p>
        )}
      </div>
      <div className="space-y-5">{children}</div>
    </section>
  );
}
