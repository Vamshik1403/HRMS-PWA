"use client";

import { ArrowLeft } from "lucide-react";
import { Button } from "./button";

interface FormDrawerProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  description?: string;
  children: React.ReactNode;
  className?: string;
  showHeaderCancel?: boolean;
}

export function FormDrawer({
  open,
  onOpenChange,
  title,
  description,
  children,
  className,
  showHeaderCancel = false,
}: FormDrawerProps) {
  if (!open) return null;

  return (
    <div className={className}>
      <div className="flex items-center justify-between gap-3 pb-4 mb-4 border-b border-[#f1f5f9]">
        <div className="flex items-center gap-3 min-w-0">
          <button
            type="button"
            onClick={() => onOpenChange(false)}
            className="inline-flex items-center justify-center rounded-md text-sm font-medium h-8 w-8 hover:bg-gray-100 transition-colors shrink-0"
            aria-label="Go back"
          >
            <ArrowLeft className="w-4 h-4" />
          </button>
          <div className="min-w-0">
            <h2 className="text-lg font-semibold truncate">{title}</h2>
            {description && <p className="text-sm text-gray-500 mt-0.5">{description}</p>}
          </div>
        </div>
        {showHeaderCancel && (
          <Button type="button" variant="outline" size="sm" onClick={() => onOpenChange(false)} className="shrink-0">
            Cancel
          </Button>
        )}
      </div>
      <div className="form-drawer-body">
        {children}
      </div>
    </div>
  );
}
