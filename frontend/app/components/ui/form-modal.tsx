"use client";

import { ArrowLeft } from "lucide-react";
import { Button } from "./button";
import { cn } from "@/app/utils/cn";
import { listCardClass } from "../app/list-ui-styles";

export interface FormModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  description?: string;
  children: React.ReactNode;
  size?: "sm" | "md" | "lg" | "xl";
  closeLabel?: string;
  showBackButton?: boolean;
  backLabel?: string;
  showCloseButton?: boolean;
  className?: string;
}

/** Inline in-page form shell — full width like FormDrawer. */
export function FormModal({
  open,
  onOpenChange,
  title,
  description,
  children,
  size: _size = "md",
  closeLabel = "Close",
  showBackButton = false,
  backLabel = "Back",
  showCloseButton = false,
  className,
}: FormModalProps) {
  if (!open) return null;

  return (
    <div className={cn(listCardClass, "p-6 w-full max-w-none", className)}>
      <div className="mb-5 flex min-h-[52px] items-center justify-between gap-3 border-b border-border pb-4">
        <div className="flex min-w-0 flex-1 items-center gap-3">
          {showBackButton && (
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="shrink-0"
              onClick={() => onOpenChange(false)}
            >
              <ArrowLeft className="h-4 w-4 mr-1.5" />
              {backLabel}
            </Button>
          )}
          <div className="min-w-0 flex-1">
            <h2 className="text-base font-semibold leading-tight text-foreground sm:text-lg">{title}</h2>
            {description ? (
              <p className="mt-0.5 text-xs leading-snug text-muted-foreground sm:text-sm">{description}</p>
            ) : null}
          </div>
        </div>
        {showCloseButton ? (
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="shrink-0"
            onClick={() => onOpenChange(false)}
          >
            {closeLabel}
          </Button>
        ) : null}
      </div>
      <div className="form-drawer-body">{children}</div>
    </div>
  );
}
