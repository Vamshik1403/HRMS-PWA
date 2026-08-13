"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { Icon } from "@iconify/react";
import { cn } from "@/app/utils/cn";
import { EmpDesktopPage } from "./desktop/EmpDesktopPage";
import { CompanyInfoViewModal } from "./CompanyInfoViewModal";
import type { LucideIcon } from "lucide-react";
import {
  getVisibleSetupTabs,
  type EmpSetupTab,
  type EmpSetupTabItem,
} from "@/app/components/layout/emp-setup-tabs-registry";
import { resolveSetupTabParam } from "./EmpSetupCategoryTabNav";

/** Items that open a view modal in place, instead of navigating to a page. */
const MODAL_ITEM_IDS = new Set(["company-info"]);

function ModuleCard({
  item,
  index,
  onModalOpen,
}: {
  item: EmpSetupTabItem;
  index: number;
  onModalOpen: (id: string) => void;
}) {
  const cardClassName = cn(
    "group relative flex w-[104px] flex-col items-center gap-2 outline-none",
    "transition-transform duration-200 ease-out hover:-translate-y-0.5",
  );
  const cardStyle = { animationDelay: `${Math.min(index, 12) * 35}ms` };
  const inner = (
    <>
      <div
        className={cn(
          "relative flex aspect-square w-full items-center justify-center rounded-2xl",
          "bg-[#F3F4F6] transition-colors duration-200 group-hover:bg-[#E8ECF1]",
        )}
      >
        <Icon icon={item.icon} className={cn("size-11", item.iconClassName || "text-primary")} />
      </div>
      <p className="w-full text-center text-[12px] font-medium leading-snug text-foreground">
        {item.label}
      </p>
    </>
  );

  if (MODAL_ITEM_IDS.has(item.id)) {
    return (
      <button type="button" className={cardClassName} style={cardStyle} onClick={() => onModalOpen(item.id)}>
        {inner}
      </button>
    );
  }

  return (
    <Link href={item.href} className={cardClassName} style={cardStyle}>
      {inner}
    </Link>
  );
}

export function EmpSetupTabsGrid({
  title,
  description,
  icon,
  tabs,
}: {
  title: string;
  description: string;
  icon: LucideIcon;
  tabs: EmpSetupTab[];
}) {
  const searchParams = useSearchParams();
  const [openModalId, setOpenModalId] = useState<string | null>(null);

  const visibleTabs = useMemo(() => getVisibleSetupTabs(tabs), [tabs]);
  const active = resolveSetupTabParam(
    searchParams,
    visibleTabs.map((t) => t.key),
  );
  const activeTab = visibleTabs.find((t) => t.key === active) || visibleTabs[0];

  // Close any in-page view/form modal when switching setup category tabs
  // (Company Setup, Policy Setup, Payroll Setup, Statutory Reports, etc.).
  useEffect(() => {
    setOpenModalId(null);
  }, [active]);

  return (
    <EmpDesktopPage title={title} description={description} icon={icon}>
      {visibleTabs.length === 0 ? (
        <div className="flex flex-col items-center justify-center rounded-2xl border border-dashed border-border bg-muted/30 px-6 py-16 text-center">
          <p className="text-sm font-semibold text-foreground">No modules available.</p>
          <p className="mt-1 text-xs text-muted-foreground">Ask your admin for access.</p>
        </div>
      ) : activeTab ? (
        <div key={activeTab.key} className="animate-fade-in flex flex-wrap gap-x-8 gap-y-8">
          {activeTab.items.map((item, index) => (
            <ModuleCard key={item.id} item={item} index={index} onModalOpen={setOpenModalId} />
          ))}
        </div>
      ) : null}

      <CompanyInfoViewModal
        open={openModalId === "company-info"}
        onOpenChange={(v) => setOpenModalId(v ? "company-info" : null)}
      />
    </EmpDesktopPage>
  );
}
