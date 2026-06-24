"use client";

import { ArrowLeft, X } from "lucide-react";
import { Button } from "./button";
import { cn } from "@/app/utils/cn";

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

export function FormDrawer({
  open,
  onOpenChange,
  title,
  description,
  children,
  className,
  showBackButton = true,
  showHeaderCancel = true,
  cancelLabel = "Cancel",
}: FormDrawerProps) {
  if (!open) return null;

  return (
    <div className={className}>
      <div
        className={cn(
          "mb-4 flex min-h-[52px] items-center justify-between gap-3 border-b border-[#f1f5f9] pb-4",
        )}
      >
        <div className="flex min-w-0 flex-1 items-center gap-3">
          <div className={cn("min-w-0 flex-1", showBackButton && "border-l border-gray-100 pl-3")}>
            <h2 className="text-base font-semibold leading-tight text-gray-900 sm:text-lg">{title}</h2>
            {description ? (
              <p className="mt-0.5 text-xs leading-snug text-gray-500 sm:text-sm">{description}</p>
            ) : null}
          </div>
        </div>
      </div>
      <div className="form-drawer-body">{children}</div>
    </div>
  );
}
