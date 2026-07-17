"use client";

import Link from "next/link";
import { cn } from "@/app/utils/cn";

export type EmpProfileWorkspaceTab = {
  id: string;
  label: string;
  href: string;
};

export function EmpProfileWorkspaceTabNav({
  tabs,
  activeTab,
}: {
  tabs: EmpProfileWorkspaceTab[];
  activeTab: string;
}) {
  return (
    <div className="rounded-xl border border-border bg-card shadow-sm overflow-hidden">
      <div className="flex gap-0.5 overflow-x-auto border-b border-border px-2">
        {tabs.map((tab) => {
          const active = activeTab === tab.id;
          return (
            <Link
              key={tab.id}
              href={tab.href}
              className={cn(
                "px-4 py-3 text-sm font-medium whitespace-nowrap border-b-2 transition-colors -mb-px",
                active
                  ? "border-primary text-primary"
                  : "border-transparent text-muted-foreground hover:text-foreground hover:border-border",
              )}
            >
              {tab.label}
            </Link>
          );
        })}
      </div>
    </div>
  );
}

export function profileTabHref(tabId: string): string {
  if (tabId === "profile") return "/empProfile";
  return `/empProfile?tab=${tabId}`;
}

export function resolveProfileWorkspaceTab(searchParams: URLSearchParams): string {
  const tab = searchParams.get("tab");
  const allowed = ["profile", "approvals", "leave", "attendance", "promotions", "delegation"];
  if (tab && allowed.includes(tab)) return tab;
  return "profile";
}
