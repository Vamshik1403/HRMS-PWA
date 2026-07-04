"use client";

import type { ReactNode } from "react";
import { Label } from "./label";
import { cn } from "@/app/utils/cn";

interface FormFieldProps {
  label: string;
  htmlFor?: string;
  required?: boolean;
  description?: string;
  error?: string;
  className?: string;
  children: ReactNode;
}

export function FormField({
  label,
  htmlFor,
  required,
  description,
  error,
  className,
  children,
}: FormFieldProps) {
  return (
    <div className={cn("space-y-2.5", className)}>
      <Label htmlFor={htmlFor} className="text-sm font-medium text-foreground">
        {label}
        {required && <span className="text-red-500 ml-0.5" aria-hidden="true">*</span>}
      </Label>
      {children}
      {description && !error && (
        <p className="text-xs text-muted-foreground leading-relaxed">{description}</p>
      )}
      {error && <p className="text-xs text-destructive">{error}</p>}
    </div>
  );
}
