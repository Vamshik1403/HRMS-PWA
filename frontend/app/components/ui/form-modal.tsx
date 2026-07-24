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
  appearance?: "default" | "aether";
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
  appearance = "default",
}: FormModalProps) {
  if (!open) return null;

  const isAether = appearance === "aether";

  return (
    <div
      className={cn(
        isAether
          ? "aether-form-modal rounded-xl border border-[#e5eeff] bg-white p-6 shadow-[0px_4px_20px_rgba(0,0,0,0.05)]"
          : listCardClass,
        "w-full max-w-none p-6",
        className,
      )}
    >
      <div
        className={cn(
          "mb-5 flex min-h-[52px] items-center justify-between gap-3 border-b pb-4",
          isAether ? "border-gray-100" : "border-border",
        )}
      >
        <div className="flex min-w-0 flex-1 items-center gap-3">
          {showBackButton && (
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="shrink-0"
              onClick={() => onOpenChange(false)}
            >
              <ArrowLeft className="mr-1.5 h-4 w-4" />
              {backLabel}
            </Button>
          )}
          <div className="min-w-0 flex-1">
            <h2
              className={cn(
                "text-base font-semibold leading-tight sm:text-lg",
                isAether ? "font-bold text-[#121c28]" : "text-foreground",
              )}
            >
              {title}
            </h2>
            {description ? (
              <p
                className={cn(
                  "mt-0.5 text-xs leading-snug sm:text-sm",
                  isAether ? "text-[#5b5f61]" : "text-muted-foreground",
                )}
              >
                {description}
              </p>
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
