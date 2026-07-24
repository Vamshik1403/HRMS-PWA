"use client";

import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import type { LucideIcon } from "lucide-react";

export type EmpPortalNavbarSearch = {
  placeholder: string;
  value: string;
  onChange: (value: string) => void;
};

export type EmpPortalPageHeader = {
  icon: LucideIcon;
  title: string;
  subtitle: string;
  navbarSearch?: EmpPortalNavbarSearch;
  messageBadgeCount?: number;
  primaryAction?: {
    label: string;
    onClick: () => void;
  };
};

type EmpPortalPageContextValue = {
  header: EmpPortalPageHeader | null;
  setHeader: (header: EmpPortalPageHeader | null) => void;
};

const EmpPortalPageContext = createContext<EmpPortalPageContextValue | null>(null);

export function EmpPortalPageProvider({ children }: { children: ReactNode }) {
  const [header, setHeader] = useState<EmpPortalPageHeader | null>(null);
  const value = useMemo(() => ({ header, setHeader }), [header]);
  return <EmpPortalPageContext.Provider value={value}>{children}</EmpPortalPageContext.Provider>;
}

export function useEmpPortalPageContext() {
  const ctx = useContext(EmpPortalPageContext);
  if (!ctx) {
    throw new Error("useEmpPortalPageContext must be used within EmpPortalPageProvider");
  }
  return ctx;
}

/** Returns null when rendered outside EmpPortalPageProvider (e.g. mobile shell). */
export function useOptionalEmpPortalPageContext() {
  return useContext(EmpPortalPageContext);
}

export function useEmpPortalPageHeader(header: EmpPortalPageHeader | null) {
  const ctx = useOptionalEmpPortalPageContext();
  const setHeader = ctx?.setHeader;
  useEffect(() => {
    if (!setHeader) return;
    setHeader(header);
    return () => setHeader(null);
  }, [header, setHeader]);
}
