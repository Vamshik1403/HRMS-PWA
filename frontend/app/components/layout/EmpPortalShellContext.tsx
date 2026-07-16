"use client";

import { createContext, useContext } from "react";

const EmpPortalShellContext = createContext(false);

export function useInsideEmpPortalShell(): boolean {
  return useContext(EmpPortalShellContext);
}

export function EmpPortalShellProvider({
  children,
  active = true,
}: {
  children: React.ReactNode;
  active?: boolean;
}) {
  return (
    <EmpPortalShellContext.Provider value={active}>
      {children}
    </EmpPortalShellContext.Provider>
  );
}
