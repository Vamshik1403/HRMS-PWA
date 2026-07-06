"use client";

import type { ReactNode } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "./dialog";
import { cn } from "@/app/utils/cn";

interface FormDrawerProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  description?: string;
  children: ReactNode;
  className?: string;
  showBackButton?: boolean;
  showHeaderCancel?: boolean;
  cancelLabel?: string;
}

/** Centered popup modal for add/edit/view forms (replaces side slider). */
export function FormDrawer({
  open,
  onOpenChange,
  title,
  description,
  children,
  className,
}: FormDrawerProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        className={cn(
          "flex max-h-[92vh] w-[calc(100vw-2rem)] max-w-5xl flex-col gap-0 overflow-hidden p-0 sm:rounded-xl",
          className,
        )}
      >
        <DialogHeader className="shrink-0 space-y-1 border-b border-border px-6 py-4 pr-12">
          <DialogTitle>{title}</DialogTitle>
          {description ? <DialogDescription>{description}</DialogDescription> : null}
        </DialogHeader>
        <div className="form-drawer-body min-h-0 flex-1 overflow-y-auto px-6 py-5">
          {children}
        </div>
      </DialogContent>
    </Dialog>
  );
}
