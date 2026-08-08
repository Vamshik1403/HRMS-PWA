"use client";

import { ArrowLeft } from "lucide-react";
import { Button } from "./button";
import { cn } from "@/app/utils/cn";
import { listCardClass } from "../app/list-ui-styles";

interface FormDrawerProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  description?: string;
  children: React.ReactNode;
  className?: string;
  showBackButton?: boolean;
  showHeaderCancel?: boolean;
  cancelLabel?: string;
}

/** Inline in-page form shell — list is hidden while open; not a centered popup. */
export function FormDrawer({
  open,
  onOpenChange,
  title,
  description,
  children,
  className,
  showBackButton = false,
  showHeaderCancel = false,
  cancelLabel = "Cancel",
}: FormDrawerProps) {
  if (!open) return null;

  return (
    <div className={cn(listCardClass, "p-6", className)}>
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
              Back
            </Button>
          )}
          <div className="min-w-0 flex-1">
            <h2 className="text-base font-semibold leading-tight text-foreground sm:text-lg">{title}</h2>
            {description ? (
              <p className="mt-0.5 text-xs leading-snug text-muted-foreground sm:text-sm">{description}</p>
            ) : null}
          </div>
        </div>
        {showHeaderCancel && (
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="shrink-0"
            onClick={() => onOpenChange(false)}
          >
            {cancelLabel}
          </Button>
        )}
      </div>
      <div className="form-drawer-body max-h-[calc(100dvh-14rem)] overflow-y-auto pr-1">{children}</div>
    </div>
  );
}
