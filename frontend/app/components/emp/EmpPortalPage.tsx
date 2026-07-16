"use client";

import { useEmpPortalDesktop } from "../layout/EmpPortalShell";

type EmpPortalPageProps = {
  children: React.ReactNode;
  className?: string;
};

/** Wraps employee portal page content with desktop-friendly layout when on laptop/desktop. */
export function EmpPortalPage({ children, className = "" }: EmpPortalPageProps) {
  const isDesktop = useEmpPortalDesktop();
  if (!isDesktop) return <>{children}</>;
  return <div className={`emp-portal-inner ${className}`.trim()}>{children}</div>;
}

export function empListClass(isDesktop: boolean): string {
  return isDesktop ? "emp-portal-card-grid" : "space-y-2";
}

export function empPageRootClass(isDesktop: boolean): string {
  return isDesktop ? "emp-portal-inner" : "flex flex-col min-h-full pb-24";
}
