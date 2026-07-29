"use client";

import { useEffect, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import { HrmsAppShell } from "@/app/components/layout/HrmsAppShell";
import { EmpPortalDesktopBridge } from "@/app/components/layout/EmpPortalDesktopBridge";
import { getAccessToken } from "@/lib/auth";
import { isJwtExpired } from "@/lib/jwtUtils";
import { hasCompanyAccessFlag } from "@/lib/companyAccess";

/** PWA employee app routes — camelCase after /emp (not /employee-* admin routes). */
const PWA_ROUTE = /^\/emp(dashboard|[A-Z])/;

function isEmployeeSession(): boolean {
  if (typeof window === "undefined") return false;
  try {
    const user = JSON.parse(localStorage.getItem("user") || "{}");
    return user?.type === "employee" || String(user?.role || "").toUpperCase() === "EMPLOYEE";
  } catch {
    return false;
  }
}

/** Employees with company rights keep the emp portal chrome on admin CRUD pages. */
function isCompanyOperatorInEmpPortal(): boolean {
  return isEmployeeSession() && hasCompanyAccessFlag();
}

function shouldUseAdminShell(pathname: string | null): boolean {
  if (!pathname || pathname === "/") return false;
  if (pathname === "/login" || pathname.startsWith("/login/")) return false;
  if (PWA_ROUTE.test(pathname)) return false;
  if (isCompanyOperatorInEmpPortal()) return false;
  return true;
}

export function AdminShellProvider({
  children,
}: {
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  const router = useRouter();
  const [ready, setReady] = useState(false);

  // Re-evaluate shell after mount so localStorage company-access is available.
  useEffect(() => {
    setReady(true);
  }, [pathname]);

  useEffect(() => {
    if (!shouldUseAdminShell(pathname)) return;
    document.documentElement.classList.add("hrms-admin-shell");
    return () => document.documentElement.classList.remove("hrms-admin-shell");
  }, [pathname, ready]);

  useEffect(() => {
    if (!shouldUseAdminShell(pathname)) {
      document.documentElement.classList.remove("hrms-admin-shell");
      return;
    }
    const token = getAccessToken();
    if (!token || isJwtExpired(token)) {
      localStorage.removeItem("accessToken");
      localStorage.removeItem("token");
      document.cookie = "accessToken=; path=/; max-age=0";
      router.replace("/login");
    }
  }, [pathname, router, ready]);

  if (!ready) {
    // Avoid flashing the wrong shell before we can read company-access flags.
    if (pathname && PWA_ROUTE.test(pathname)) {
      return <EmpPortalDesktopBridge>{children}</EmpPortalDesktopBridge>;
    }
    return <div className="min-h-screen bg-[#f1f5f9]" />;
  }

  if (!shouldUseAdminShell(pathname)) {
    return <EmpPortalDesktopBridge>{children}</EmpPortalDesktopBridge>;
  }

  return <HrmsAppShell>{children}</HrmsAppShell>;
}
