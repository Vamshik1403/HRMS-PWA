"use client";

import Link from "next/link";
import { Icon } from "@iconify/react";
import { LayoutDashboard } from "lucide-react";
import { EmpDesktopPage } from "./EmpDesktopPage";
import { actionTileClass, gridGap } from "../../../dashboard/components/dashboard-ui";

type MenuCard = {
  key: string;
  label: string;
  sub: string;
  icon: string;
  color: string;
  iconColor: string;
  href: string;
};

export function EmpDesktopHomeDashboard({
  menuCards,
  badgeFor,
  onNoticeClick,
}: {
  menuCards: MenuCard[];
  badgeFor: (key: string) => number;
  onNoticeClick?: () => void;
}) {
  return (
    <EmpDesktopPage
      title="Dashboard"
      description="Shortcuts to payroll, leave, tasks, and more"
      icon={LayoutDashboard}
    >
      <div className={`grid sm:grid-cols-2 lg:grid-cols-3 ${gridGap}`}>
        {menuCards.map((card) => {
          const badge = badgeFor(card.key);
          return (
            <Link
              key={card.key}
              href={card.href}
              className={`${actionTileClass} relative`}
              onClick={card.key === "notice" ? onNoticeClick : undefined}
            >
              <span className={`size-10 rounded-md flex items-center justify-center shrink-0 ${card.color}`}>
                <Icon icon={card.icon} className={`w-5 h-5 ${card.iconColor}`} />
              </span>
              <span className="flex-1 min-w-0">
                <span className="block font-semibold">{card.label}</span>
                <span className="text-xs text-muted-foreground">
                  {card.key === "tasks" && badge > 0 ? `${badge} active` : card.sub}
                </span>
              </span>
              {badge > 0 ? (
                <span className="absolute top-3 right-3 min-w-[20px] h-5 px-1.5 bg-destructive text-destructive-foreground text-[10px] font-bold rounded-full flex items-center justify-center">
                  {badge > 99 ? "99+" : badge}
                </span>
              ) : null}
            </Link>
          );
        })}
      </div>
    </EmpDesktopPage>
  );
}
