"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from "react";

export type AdminPageHeader = {
  title: string;
  subtitle?: string;
};

type AdminPageHeaderContextValue = {
  header: AdminPageHeader | null;
  setHeader: (header: AdminPageHeader | null) => void;
};

const AdminPageHeaderContext = createContext<AdminPageHeaderContextValue | null>(null);

export function AdminPageHeaderProvider({ children }: { children: ReactNode }) {
  const [header, setHeaderState] = useState<AdminPageHeader | null>(null);
  const setHeader = useCallback((next: AdminPageHeader | null) => {
    setHeaderState(next);
  }, []);
  const value = useMemo(() => ({ header, setHeader }), [header, setHeader]);
  return (
    <AdminPageHeaderContext.Provider value={value}>
      {children}
    </AdminPageHeaderContext.Provider>
  );
}

export function useOptionalAdminPageHeaderContext() {
  return useContext(AdminPageHeaderContext);
}

/** Sync page title into the admin topbar while this component is mounted. */
export function useAdminPageHeader(header: AdminPageHeader | null) {
  const setHeader = useContext(AdminPageHeaderContext)?.setHeader;
  useEffect(() => {
    if (!setHeader) return;
    setHeader(header);
    return () => setHeader(null);
  }, [setHeader, header?.title, header?.subtitle]);
}
