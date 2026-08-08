"use client";

import { useCallback, useEffect, useState } from "react";
import { getSidebarContext } from "@/app/utils/sidebarContext";
import { authHeaders } from "@/lib/auth";

const BACKEND = process.env.NEXT_PUBLIC_BACKEND_URL || "/backend";

export type CompanyBranch = {
  id: number;
  branchName?: string | null;
  companyID?: number | null;
};

function dedupeBranches(list: CompanyBranch[]): CompanyBranch[] {
  const byId = new Map<number, CompanyBranch>();
  for (const b of list) {
    const id = Number(b?.id);
    if (!Number.isFinite(id) || id <= 0) continue;
    if (!byId.has(id)) byId.set(id, { ...b, id });
  }
  // Collapse same company + same branch name (duplicate rows in DB).
  const byName = new Map<string, CompanyBranch>();
  for (const b of byId.values()) {
    const key = `${Number(b.companyID) || 0}::${String(b.branchName || "")
      .trim()
      .toLowerCase()}`;
    if (!byName.has(key)) byName.set(key, b);
  }
  return Array.from(byName.values());
}

/**
 * Loads branches for the active (or provided) company and exposes
 * single-branch auto-select helpers.
 * When a company has exactly one branch, forms should pre-fill / hide the picker.
 */
export function useCompanyBranches(companyID?: number | null) {
  const [branches, setBranches] = useState<CompanyBranch[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const ctx = getSidebarContext();
      const scopedCompanyID =
        companyID != null && Number(companyID) > 0
          ? Number(companyID)
          : ctx?.companyID != null
            ? Number(ctx.companyID)
            : null;

      const res = await fetch(`${BACKEND}/branches`, {
        headers: authHeaders(),
        cache: "no-store",
      });
      if (!res.ok) {
        setBranches([]);
        return;
      }
      const data = await res.json();
      let list: CompanyBranch[] = Array.isArray(data) ? data : data?.data ?? [];
      if (scopedCompanyID != null) {
        list = list.filter(
          (b) =>
            b.companyID == null || Number(b.companyID) === Number(scopedCompanyID),
        );
      }
      setBranches(dedupeBranches(list));
    } catch {
      setBranches([]);
    } finally {
      setLoading(false);
    }
  }, [companyID]);

  useEffect(() => {
    void load();
  }, [load]);

  const singleBranch = branches.length === 1 ? branches[0] : null;

  return {
    branches,
    loading,
    singleBranch,
    isSingleBranch: branches.length === 1,
    autoBranchId: singleBranch?.id ?? null,
    autoBranchName: singleBranch?.branchName ?? null,
    reload: load,
  };
}
