"use client";

import { Suspense } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { EmpProfileMessagingPanel } from "./EmpProfileMessagingPanel";
import { EmpMobileSimpleProfile } from "./EmpMobileSimpleProfile";
import { Icon } from "@iconify/react";

function EmpProfileMobileWorkspaceInner() {
  const searchParams = useSearchParams();
  const tab = searchParams.get("tab");
  const isMessaging = tab === "messaging";

  // Mobile / PWA IM — same WhatsApp-style panel as desktop (compact list ↔ chat).
  if (isMessaging) {
    return (
      <div
        className="flex min-h-0 flex-col overflow-hidden bg-white"
        style={{
          height:
            "calc(100dvh - env(safe-area-inset-top, 0px) - 56px - env(safe-area-inset-bottom, 0px))",
        }}
      >
        <div className="flex shrink-0 items-center gap-2 border-b border-border px-3 py-2.5">
          <Link
            href="/empdashboard"
            className="inline-flex size-9 items-center justify-center rounded-xl text-muted-foreground active:bg-muted"
            aria-label="Back to Home"
          >
            <Icon icon="solar:arrow-left-linear" className="size-5" />
          </Link>
          <div className="min-w-0">
            <h1 className="truncate text-[17px] font-bold text-foreground">Messages</h1>
            <p className="truncate text-[11px] text-muted-foreground">Internal Messaging</p>
          </div>
        </div>
        <div className="min-h-0 min-w-0 flex-1 overflow-hidden">
          <EmpProfileMessagingPanel active />
        </div>
      </div>
    );
  }

  // Mobile / PWA profile is a single simple screen (no desktop tab strip).
  return <EmpMobileSimpleProfile />;
}

export function EmpProfileMobileWorkspace() {
  return (
    <Suspense
      fallback={
        <div className="px-4 pt-6 pb-8 flex justify-center py-16">
          <Icon icon="solar:refresh-bold-duotone" className="w-8 h-8 text-blue-400 animate-spin" />
        </div>
      }
    >
      <EmpProfileMobileWorkspaceInner />
    </Suspense>
  );
}
