"use client";

import { usePathname } from "next/navigation";
import { PageLayout } from "@/app/components/layout/PageLayout";

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

  if (!shouldUseAdminShell(pathname)) {
    return <>{children}</>;
  }

  return <PageLayout>{children}</PageLayout>;
}
