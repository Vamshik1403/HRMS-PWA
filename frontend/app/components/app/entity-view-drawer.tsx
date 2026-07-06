"use client";

import type { ReactNode } from "react";
import { FormDrawer } from "@/app/components/ui/form-drawer";

interface EntityViewDrawerProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  children: ReactNode;
}

/** Read-only detail drawer — matches employee view shell. */
export function EntityViewDrawer({ open, onOpenChange, title, children }: EntityViewDrawerProps) {
  return (
    <FormDrawer
      open={open}
      onOpenChange={onOpenChange}
      title={title}
      showHeaderCancel
      cancelLabel="Close"
    >
      {children}
    </FormDrawer>
  );
}
