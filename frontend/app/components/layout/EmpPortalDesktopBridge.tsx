"use client";

import { Suspense } from "react";
import { usePathname } from "next/navigation";
import EmpPortalShell, { useEmpPortalLayout } from "./EmpPortalShell";
import { EmpPortalShellProvider } from "./EmpPortalShellContext";
import { isDesktopBrowser } from "@/lib/desktopManager";

const EMP_PWA_ROUTE = /^\/emp(dashboard|[A-Z])/;

function isEmpPwaRoute(pathname: string | null): boolean {
  return !!pathname && EMP_PWA_ROUTE.test(pathname);
}

function EmpPortalDesktopBridgeInner({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const { desktop, ready } = useEmpPortalLayout();

  if (!isEmpPwaRoute(pathname)) {
    return <>{children}</>;
  }

  if (!ready) {
    return <div className="min-h-screen bg-[#f1f5f9]" />;
  }

  if (!desktop) {
    return <>{children}</>;
  }

  return (
    <EmpPortalShellProvider active>
      <Suspense fallback={null}>
        <EmpPortalShell>{children}</EmpPortalShell>
      </Suspense>
    </EmpPortalShellProvider>
  );
}

/** Keeps the desktop employee portal shell mounted across PWA route navigations. */
export function EmpPortalDesktopBridge({ children }: { children: React.ReactNode }) {
  if (typeof window !== "undefined" && !isDesktopBrowser()) {
    return <>{children}</>;
  }

  return <EmpPortalDesktopBridgeInner>{children}</EmpPortalDesktopBridgeInner>;
}
