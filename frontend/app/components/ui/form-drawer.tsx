"use client";

import { ArrowLeft } from "lucide-react";

interface FormDrawerProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  description?: string;
  children: React.ReactNode;
  className?: string;
}

export function FormDrawer({
  open,
  onOpenChange,
  title,
  description,
  children,
  className,
}: FormDrawerProps) {
  if (!open) return null;

  return (
    <div className={className}>
      <div className="flex items-center gap-3 pb-4 mb-4 border-b border-[#f1f5f9]">
        <button
          type="button"
          onClick={() => onOpenChange(false)}
          className="inline-flex items-center justify-center rounded-md text-sm font-medium h-8 w-8 hover:bg-gray-100 transition-colors"
        >
          <ArrowLeft className="w-4 h-4" />
        </button>
        <div>
          <h2 className="text-lg font-semibold">{title}</h2>
          {description && <p className="text-sm text-gray-500 mt-0.5">{description}</p>}
        </div>
      </div>
      <div className="form-drawer-body">
        {children}
      </div>
    </div>
  );
}
