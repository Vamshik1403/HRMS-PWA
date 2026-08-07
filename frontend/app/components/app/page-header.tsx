"use client";

import { useMemo, type ReactNode } from "react";
import { LayoutGrid, type LucideIcon } from "lucide-react";
import { cn } from "@/app/utils/cn";
import {
  useAdminPageHeader,
  useOptionalAdminPageHeaderContext,
} from "@/app/components/layout/admin-page-header-context";
import {
  useEmpPortalPageHeader,
  useOptionalEmpPortalPageContext,
} from "@/app/components/layout/emp-portal-page-context";
import { useRegisterListToolbarActions } from "@/app/components/layout/list-toolbar-actions-context";

interface PageHeaderProps {
  icon?: LucideIcon;
  title: string;
  description?: ReactNode;
  actions?: ReactNode;
  className?: string;
  /** Keep the large in-content title even when topbar sync is active. */
  keepInContentTitle?: boolean;
}

export function PageHeader({
  icon: Icon,
  title,
  description,
  actions,
  className,
  keepInContentTitle = false,
}: PageHeaderProps) {
  const inPortal = Boolean(useOptionalEmpPortalPageContext());
  const hasAdminHeaderCtx = Boolean(useOptionalAdminPageHeaderContext());
  const subtitle = typeof description === "string" ? description : "";
  const PageIcon = Icon ?? LayoutGrid;

  const portalHeader = useMemo(() => {
    if (!inPortal || !title) return null;
    return { icon: PageIcon, title, subtitle };
  }, [inPortal, title, subtitle, PageIcon]);

  const adminHeader = useMemo(() => {
    if (inPortal || !hasAdminHeaderCtx || !title) return null;
    return { title, subtitle: subtitle || undefined };
  }, [inPortal, hasAdminHeaderCtx, title, subtitle]);

  useEmpPortalPageHeader(portalHeader);
  useAdminPageHeader(adminHeader);

  const syncedToTopbar = Boolean(portalHeader || adminHeader);
  const showInContentTitle = keepInContentTitle || !syncedToTopbar;

  // When title is in the navbar, Add/actions render on the FilterBar row.
  useRegisterListToolbarActions(syncedToTopbar && !keepInContentTitle ? actions ?? null : null);

  if (!showInContentTitle) {
    return null;
  }

  return (
    <div
      data-hrms-page-header
      className={cn(
        "flex flex-col gap-5 sm:flex-row sm:items-start sm:justify-between",
        className,
      )}
    >
      <div className="min-w-0">
        <div className="flex items-start gap-3">
          {Icon ? (
            <span
              className="mt-1 flex size-11 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary"
              aria-hidden="true"
            >
              <Icon className="size-5" />
            </span>
          ) : null}

          <div className="min-w-0">
            <h1 className="font-display text-[28px] font-bold leading-tight tracking-[-0.5px] text-foreground sm:text-[36px] lg:text-[40px]">
              {title}
            </h1>
            {description ? (
              <p className="mt-2 max-w-3xl text-[15px] leading-6 text-muted-foreground">
                {description}
              </p>
            ) : null}
          </div>
        </div>
      </div>

      {actions ? (
        <div className="flex shrink-0 flex-wrap items-center gap-3 sm:pt-1 [&_button]:h-[46px] [&_button]:rounded-xl [&_button]:px-6">
          {actions}
        </div>
      ) : null}
    </div>
  );
}
