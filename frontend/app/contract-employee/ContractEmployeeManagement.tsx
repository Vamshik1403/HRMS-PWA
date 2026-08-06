"use client";

import { useCallback, useEffect, useState } from "react";
import { Briefcase } from "lucide-react";
import { toast } from "sonner";
import { PageHeader } from "../components/app/page-header";
import { FilterBar } from "../components/app/filter-bar";
import { EntityListShell } from "../components/app/entity-list-shell";
import type { DataTableColumn } from "../components/app/data-table";
import { useCurrentUser } from "../hooks/useCurrentUser";
import { getSidebarContext } from "../utils/sidebarContext";
import { authHeaders, getAccessToken } from "@/lib/auth";

const BACKEND = process.env.NEXT_PUBLIC_BACKEND_URL || "/backend";

interface ContractEmployeeRow {
  id: number;
  name: string;
  employeeID: string;
  designation: string;
  contractor: string;
  contact: string;
}

const columns: Array<DataTableColumn<ContractEmployeeRow>> = [
  { key: "employeeID", header: "Employee ID", cell: (row) => row.employeeID || "—" },
  { key: "name", header: "Name", cell: (row) => row.name },
  { key: "designation", header: "Designation", cell: (row) => row.designation || "—" },
  { key: "contractor", header: "Contractor", cell: (row) => row.contractor || "—" },
  { key: "contact", header: "Contact", cell: (row) => row.contact || "—" },
];

/**
 * Lists employees whose "Salary Payout" is set to Contractor in the
 * employee management form — i.e. their salary is routed through a
 * contractor rather than paid directly by the company.
 */
export function ContractEmployeeManagement() {
  const user = useCurrentUser();
  const [search, setSearch] = useState("");
  const [rows, setRows] = useState<ContractEmployeeRow[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  const load = useCallback(async () => {
    if (!getAccessToken()) {
      setIsLoading(false);
      return;
    }
    setIsLoading(true);
    try {
      const ctx = getSidebarContext();
      const activeCompanyID = ctx?.companyID ?? user?.companyID ?? null;

      const res = await fetch(`${BACKEND}/manage-employee/list`, {
        headers: authHeaders(),
        cache: "no-store",
      });
      if (!res.ok) throw new Error(await res.text());
      const data = await res.json();
      const list = Array.isArray(data) ? data : [];

      const filtered = list.filter((r: any) => {
        if (r.salaryPayoutTo !== "Contractor") return false;
        if (activeCompanyID && r.companyID != null && Number(r.companyID) !== Number(activeCompanyID)) {
          return false;
        }
        return true;
      });

      setRows(
        filtered.map((r: any) => ({
          id: r.id,
          name: `${r.employeeFirstName ?? ""} ${r.employeeLastName ?? ""}`.trim() || `#${r.id}`,
          employeeID: r.employeeID ?? "",
          designation: r.designations?.designation ?? r.empDesignation?.[0]?.designation ?? "",
          contractor: r.contractor?.contractorName ?? "",
          contact: r.businessEmail ?? r.personalPhoneNo ?? "",
        }))
      );
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : "Could not load contract employees");
      setRows([]);
    } finally {
      setIsLoading(false);
    }
  }, [user]);

  useEffect(() => {
    void load();
  }, [load]);

  const visibleRows = rows.filter((r) => {
    if (!search.trim()) return true;
    const q = search.trim().toLowerCase();
    return (
      r.name.toLowerCase().includes(q) ||
      r.employeeID.toLowerCase().includes(q) ||
      r.designation.toLowerCase().includes(q) ||
      r.contractor.toLowerCase().includes(q)
    );
  });

  return (
    <div className="w-full max-w-none animate-fade-in page-content-enter space-y-6">
      <PageHeader
        icon={Briefcase}
        title="Contract Employee"
        description="Employees whose salary payout is routed through a contractor."
      />

      <FilterBar
        search={{
          value: search,
          onChange: setSearch,
          placeholder: "Search contract employees…",
        }}
      />

      <EntityListShell
        title="All contract employees"
        columns={columns}
        rows={visibleRows}
        rowKey={(row) => String(row.id)}
        isLoading={isLoading}
        sortBy={null}
        sortDir="asc"
        onSort={() => {}}
        emptyIcon={Briefcase}
        emptyTitle="No contract employees yet"
        emptyDescription="Employees with Salary Payout set to Contractor will appear here."
      />
    </div>
  );
}
