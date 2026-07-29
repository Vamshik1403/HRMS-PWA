"use client";

import { Suspense } from "react";
import { usePathname } from "next/navigation";
import EmpPortalShell, { useEmpPortalLayout } from "./EmpPortalShell";
import { EmpPortalShellProvider } from "./EmpPortalShellContext";
import { isDesktopBrowser } from "@/lib/desktopManager";
import { hasCompanyAccessFlag } from "@/lib/companyAccess";

const EMP_PWA_ROUTE = /^\/emp(dashboard|[A-Z])/;

function isEmployeeSession(): boolean {
  if (typeof window === "undefined") return false;
  try {
    const user = JSON.parse(localStorage.getItem("user") || "{}");
    return user?.type === "employee" || String(user?.role || "").toUpperCase() === "EMPLOYEE";
  } catch {
    return false;
  }
}

/** Emp PWA routes, plus admin CRUD pages when the employee has company rights. */
function shouldWrapWithEmpPortal(pathname: string | null): boolean {
  if (!pathname) return false;
  if (pathname === "/login" || pathname.startsWith("/login/")) return false;
  if (EMP_PWA_ROUTE.test(pathname)) return true;
  if (isEmployeeSession() && hasCompanyAccessFlag()) {
    // Keep emp chrome for company-admin modules opened from More.
    return true;
  }
  return false;
}

function EmpPortalDesktopBridgeInner({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const { desktop, ready } = useEmpPortalLayout();

  if (!shouldWrapWithEmpPortal(pathname)) {
    return <>{children}</>;
  }

  if (!ready) {
    return <div className="min-h-screen bg-[#f1f5f9]" />;
  }

  if (!desktop) {
    // Mobile: EmpMobileLayout on PWA pages handles chrome; admin pages get a simple wrap.
    if (EMP_PWA_ROUTE.test(pathname || "")) {
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

  return (
    <EmpPortalShellProvider active>
      <Suspense fallback={null}>
        <EmpPortalShell>{children}</EmpPortalShell>
      </Suspense>
    </EmpPortalShellProvider>
  );
}

/** Keeps the desktop employee portal shell mounted across PWA + company-admin navigations. */
export function EmpPortalDesktopBridge({ children }: { children: React.ReactNode }) {
  if (typeof window !== "undefined" && !isDesktopBrowser()) {
    // Still wrap company-access admin routes on mobile so chrome stays consistent.
    return <EmpPortalDesktopBridgeInner>{children}</EmpPortalDesktopBridgeInner>;
  }

  return <EmpPortalDesktopBridgeInner>{children}</EmpPortalDesktopBridgeInner>;
}
