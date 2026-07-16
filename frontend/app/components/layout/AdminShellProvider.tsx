"use client";

import { useEffect } from "react";
import { usePathname, useRouter } from "next/navigation";
import { HrmsAppShell } from "@/app/components/layout/HrmsAppShell";
import { EmpPortalDesktopBridge } from "@/app/components/layout/EmpPortalDesktopBridge";
import { getAccessToken } from "@/lib/auth";
import { isJwtExpired } from "@/lib/jwtUtils";

/** PWA employee app routes — camelCase after /emp (not /employee-* admin routes). */
const PWA_ROUTE = /^\/emp(dashboard|[A-Z])/;

function shouldUseAdminShell(pathname: string | null): boolean {
  if (!pathname || pathname === "/") return false;
  if (pathname === "/login" || pathname.startsWith("/login/")) return false;
  if (PWA_ROUTE.test(pathname)) return false;
  return true;
}

export function AdminShellProvider({
  children,
}: {
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  const router = useRouter();

  useEffect(() => {
    if (!shouldUseAdminShell(pathname)) return;
    document.documentElement.classList.add("hrms-admin-shell");
    return () => document.documentElement.classList.remove("hrms-admin-shell");
  }, [pathname]);

  useEffect(() => {
    if (!shouldUseAdminShell(pathname)) return;
    const token = getAccessToken();
    if (!token || isJwtExpired(token)) {
      localStorage.removeItem("accessToken");
      localStorage.removeItem("token");
      document.cookie = "accessToken=; path=/; max-age=0";
      router.replace("/login");
    }
  }, [pathname, router]);

  if (!shouldUseAdminShell(pathname)) {
    return <EmpPortalDesktopBridge>{children}</EmpPortalDesktopBridge>;
  }

  return <HrmsAppShell>{children}</HrmsAppShell>;
}
