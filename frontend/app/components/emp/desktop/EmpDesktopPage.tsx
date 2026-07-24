"use client";

import { useMemo, type ReactNode } from "react";
import type { LucideIcon } from "lucide-react";
import { LayoutGrid } from "lucide-react";
import { PageHeader } from "../../app/page-header";
import {
  useEmpPortalPageHeader,
  useOptionalEmpPortalPageContext,
} from "../../layout/emp-portal-page-context";
import { cn } from "@/app/utils/cn";

export function EmpDesktopPage({
  children,
  className,
  title,
  description,
  icon,
  actions,
}: {
  children: ReactNode;
  className?: string;
  title?: string;
  description?: ReactNode;
  icon?: LucideIcon;
  actions?: ReactNode;
}) {
  const inPortal = Boolean(useOptionalEmpPortalPageContext());
  const subtitle = typeof description === "string" ? description : "";
  const PageIcon = icon ?? LayoutGrid;

  const portalHeader = useMemo(() => {
    if (!inPortal || !title) return null;
    return {
      icon: PageIcon,
      title,
      subtitle,
    };
  }, [inPortal, title, PageIcon, subtitle]);

  useEmpPortalPageHeader(portalHeader);

  const showInContentHeader = Boolean(title) && !inPortal;

  return (
    <div className={cn("space-y-6 w-full max-w-none animate-fade-in page-content-enter", className)}>
      {showInContentHeader ? (
        <PageHeader icon={icon} title={title!} description={description} actions={actions} />
      ) : actions ? (
        <div className="flex justify-end">{actions}</div>
      ) : null}
      {children}
    </div>
  );
}
