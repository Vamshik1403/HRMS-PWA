"use client";

import * as React from "react";
import * as DialogPrimitive from "@radix-ui/react-dialog";
import { ArrowLeft, X } from "lucide-react";
import { cn } from "@/app/utils/cn";
import { Button } from "./button";

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
}

const sizeClass = {
  sm: "max-w-md",
  md: "max-w-lg",
  lg: "max-w-2xl",
  xl: "max-w-3xl",
};

/** Centered popup modal — does not collapse or alter the app sidebar. */
export function FormModal({
  open,
  onOpenChange,
  title,
  description,
  children,
  size = "md",
  closeLabel = "Close",
  showBackButton = true,
  backLabel = "Back",
}: FormModalProps) {
  return (
    <DialogPrimitive.Root open={open} onOpenChange={onOpenChange}>
      <DialogPrimitive.Portal>
        <DialogPrimitive.Overlay
          className={cn(
            "fixed inset-0 z-50 bg-black/40 backdrop-blur-[2px]",
            "data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0",
          )}
        />
        <DialogPrimitive.Content
          className={cn(
            "fixed left-1/2 top-1/2 z-50 flex w-[calc(100%-1.5rem)] -translate-x-1/2 -translate-y-1/2 flex-col overflow-hidden rounded-xl border border-gray-200 bg-white shadow-2xl",
            "max-h-[min(90vh,880px)]",
            "data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0 data-[state=closed]:zoom-out-95 data-[state=open]:zoom-in-95",
            sizeClass[size],
          )}
          onOpenAutoFocus={(e) => e.preventDefault()}
        >
          <div className="flex shrink-0 items-center justify-between gap-3 border-b border-gray-100 bg-white px-4 py-3.5 sm:px-5">
            <div className="flex min-w-0 flex-1 items-center gap-3">
              {showBackButton && (
                <button
                  type="button"
                  onClick={() => onOpenChange(false)}
                  className="inline-flex shrink-0 items-center gap-1.5 rounded-lg border border-gray-200 bg-white px-2.5 py-2 text-sm font-medium text-gray-700 shadow-sm transition-colors hover:border-gray-300 hover:bg-gray-50"
                  aria-label="Go back"
                >
                  <ArrowLeft className="h-4 w-4" />
                  <span className="hidden sm:inline">{backLabel}</span>
                </button>
              )}
              <div className={cn("min-w-0 flex-1", showBackButton && "border-l border-gray-100 pl-3")}>
                <DialogPrimitive.Title className="text-base font-semibold leading-tight text-gray-900 sm:text-lg">
                  {title}
                </DialogPrimitive.Title>
                {description ? (
                  <DialogPrimitive.Description className="mt-0.5 line-clamp-2 text-xs text-gray-500 sm:text-sm">
                    {description}
                  </DialogPrimitive.Description>
                ) : null}
              </div>
            </div>
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="h-9 shrink-0"
              onClick={() => onOpenChange(false)}
            >
              <X className="mr-1.5 h-4 w-4" />
              {closeLabel}
            </Button>
          </div>
          <div className="min-h-0 flex-1 overflow-y-auto px-4 py-4 sm:px-5">{children}</div>
        </DialogPrimitive.Content>
      </DialogPrimitive.Portal>
    </DialogPrimitive.Root>
  );
}
