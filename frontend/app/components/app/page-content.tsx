"use client";

import type { ReactNode } from "react";
import { cn } from "@/app/utils/cn";

/** Consistent full-width page shell for all HRMS list sections. */
export function PageContent({
  children,
  className,
}: {
  children: ReactNode;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "page-content-enter w-full max-w-none animate-fade-in space-y-6",
        className,
      )}
    >
      {children}
    </div>
  );
}
