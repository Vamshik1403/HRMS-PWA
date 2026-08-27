"use client";

import { useEffect, useMemo, useState } from "react";
import { Boxes } from "lucide-react";
import { toast } from "sonner";

import { PageHeader } from "../components/app/page-header";
import {
  FilterBar,
  FilterSelect,
} from "../components/app/filter-bar";
import { EntityListShell } from "../components/app/entity-list-shell";
import { EntityRowActions } from "../components/app/entity-row-actions";
import { DetailCard } from "../components/app/detail-card";
import {
  EntityDetailHero,
  EntityDetailLayout,
} from "../components/app/entity-detail-layout";

import { FormDrawer } from "../components/ui/form-drawer";

import type { DataTableColumn } from "../components/app/data-table";
import {
  sortRows,
  useClientTable,
} from "../hooks/use-client-table";

type ID = number;

interface CompanyModuleRead {
  id: ID;
  moduleKey?: string | null;
  moduleName: string;
  moduleDescription?: string | null;
  moduleStatus?: boolean | null;
  createdAt?: string | null;
  updatedAt?: string | null;
}

const API = {
  companyModules: "/backend/company-modules",
};

async function fetchJSONSafe<T>(
  url: string,
  options?: RequestInit,
): Promise<T> {
  const response = await fetch(url, {
    ...options,
    headers: {
      Accept: "application/json",
      ...(options?.body
        ? { "Content-Type": "application/json" }
        : {}),
      ...options?.headers,
    },
    cache: "no-store",
  });

  const contentType = response.headers.get("content-type") || "";
  const responseText = await response.text();

  let responseBody: any = null;

  if (responseText) {
    if (contentType.includes("application/json")) {
      try {
        responseBody = JSON.parse(responseText);
      } catch {
        responseBody = null;
      }
    }
  }

  if (!response.ok) {
    const message =
      Array.isArray(responseBody?.message)
        ? responseBody.message.join(", ")
        : responseBody?.message ||
          responseBody?.error ||
          (responseText.startsWith("<!DOCTYPE")
            ? `API returned an HTML page instead of JSON. Check API URL: ${url}`
            : responseText) ||
          `${response.status} ${response.statusText}`;

    throw new Error(message);
  }

  if (!contentType.includes("application/json")) {
    throw new Error(
      `Expected JSON but received "${contentType || "unknown content type"}" from ${url}`,
    );
  }

  if (!responseText) {
    return undefined as T;
  }

  return (responseBody?.data ?? responseBody) as T;
}


function moduleFeatures(row: CompanyModuleRead): string {
  const key = String(row.moduleKey || row.moduleName || "").toUpperCase();
  const catalog: Record<string, string> = {
    EMPLOYEES: "Employee master, documents, selfcare flags, org mapping",
    EMPLOYEE: "Employee master, documents, selfcare flags, org mapping",
    ATTENDANCE: "Punches, roster, regularisation, attendance policy",
    LEAVE: "Leave policy, applications, balances, holidays",
    PAYROLL: "Salary cycle, paygrade, run payroll, payslips",
    REIMBURSEMENT: "Claims, approvals, payout tracking",
    BRANCHES: "Locations and branch mapping",
    DEPARTMENTS: "Department hierarchy and branch mapping",
    DESIGNATIONS: "Designation hierarchy by department",
    WORKFLOW: "Sequential approvals by branch, department and designation",
    TASKS: "Projects, customers, sites and assignments",
  };
  for (const [match, text] of Object.entries(catalog)) {
    if (key.includes(match)) return text;
  }
  return row.moduleDescription?.trim() || "Core HRMS module capabilities";
}

export function CompanyModulesManagement() {
  const table = useClientTable("moduleName");

  const [rows, setRows] = useState<CompanyModuleRead[]>([]);
  const [loading, setLoading] = useState(false);
  const [statusFilter, setStatusFilter] = useState("ALL");
  const [isViewing, setIsViewing] = useState(false);
  const [viewRow, setViewRow] =
    useState<CompanyModuleRead | null>(null);

  const fetchRows = async () => {
    try {
      setLoading(true);

      const data = await fetchJSONSafe<CompanyModuleRead[]>(
        API.companyModules,
      );

      setRows(Array.isArray(data) ? data : []);
    } catch (err: any) {
      console.error("Failed to load company modules:", err);
      setRows([]);
      toast.error(
        err?.message || "Failed to load company modules",
      );
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchRows();

    const reload = () => {
      fetchRows();
    };

    const sidebarPageClickHandler = (event: any) => {
      if (event.detail?.path === "/company-modules") {
        closePanels();
        fetchRows();
      }
    };

    window.addEventListener("app-data-refresh", reload);
    window.addEventListener(
      "sidebar-main-page-click",
      sidebarPageClickHandler,
    );

    return () => {
      window.removeEventListener("app-data-refresh", reload);
      window.removeEventListener(
        "sidebar-main-page-click",
        sidebarPageClickHandler,
      );
    };
  }, []);

  const handleView = (row: CompanyModuleRead) => {
    setViewRow(row);
    setIsViewing(true);
  };

  const closePanels = () => {
    setIsViewing(false);
    setViewRow(null);
  };

  const filteredRows = useMemo(() => {
    const search = table.search.trim().toLowerCase();

    const filtered = rows.filter((row) => {
      const currentStatus = row.moduleStatus !== false;

      const matchesStatus =
        statusFilter === "ALL" ||
        (statusFilter === "ACTIVE" && currentStatus) ||
        (statusFilter === "INACTIVE" && !currentStatus);

      const matchesSearch =
        !search ||
        row.moduleName
          ?.toLowerCase()
          .includes(search) ||
        row.moduleDescription
          ?.toLowerCase()
          .includes(search);

      return matchesStatus && matchesSearch;
    });

    return sortRows(
      filtered,
      table.sortBy,
      table.sortDir,
      (row, key) => {
        if (key === "moduleName") {
          return row.moduleName ?? "";
        }

        if (key === "moduleDescription") {
          return row.moduleDescription ?? "";
        }

        if (key === "moduleStatus") {
          return row.moduleStatus !== false ? 1 : 0;
        }

        return "";
      },
    );
  }, [
    rows,
    statusFilter,
    table.search,
    table.sortBy,
    table.sortDir,
  ]);

  const statusOptions = [
    { value: "ALL", label: "All statuses" },
    { value: "ACTIVE", label: "Active" },
    { value: "INACTIVE", label: "Inactive" },
  ];

  const columns = useMemo(
    (): DataTableColumn<CompanyModuleRead>[] => [
      {
        key: "moduleName",
        header: "Module Name",
        sortable: true,
        colSpan: 3,
        cell: (row) => (
          <div className="min-w-0">
            <div className="font-medium text-gray-900">
              {row.moduleName || "—"}
            </div>
          </div>
        ),
      },
      {
        key: "moduleDescription",
        header: "Description",
        sortable: true,
        colSpan: 5,
        cell: (row) => (
          <span className="line-clamp-2 text-sm text-gray-600">
            {row.moduleDescription || "No description"}
          </span>
        ),
      },
      {
        key: "actions",
        header: "Action (View)",
        colSpan: 2,
        align: "right",
        cell: (row) => (
          <EntityRowActions
            onView={() => handleView(row)}
          />
        ),
      },
    ],
    [],
  );

  return (
    <div className="page-content-enter w-full max-w-none animate-fade-in space-y-6">
      <PageHeader
        icon={Boxes}
        title="Application Modules"
        description="Hardcoded application modules. View only — modules cannot be added or deleted."
        actions={null}
      />

      <FormDrawer
        open={Boolean(isViewing && viewRow)}
        onOpenChange={(open) => {
          if (!open) closePanels();
        }}
        title="Application Module"
        showHeaderCancel
        cancelLabel="Close"
      >
        {viewRow && (
          <EntityDetailLayout
            hero={
              <EntityDetailHero
                title={viewRow.moduleName || "Module"}
                subtitle="Application module"
              />
            }
            columns={1}
          >
            <DetailCard
              title="Module Information"
              subtitle="Hardcoded module catalogue"
              rows={[
                {
                  label: "Module Name",
                  value: viewRow.moduleName,
                },
                {
                  label: "Description",
                  value:
                    viewRow.moduleDescription ||
                    "No description provided",
                },
                {
                  label: "Features",
                  value: moduleFeatures(viewRow),
                },
              ]}
            />
          </EntityDetailLayout>
        )}
      </FormDrawer>

      {!isViewing && (
        <>
          <FilterBar
            search={{
              value: table.search,
              onChange: table.setSearch,
              placeholder:
                "Search module name or description…",
            }}
            filters={
              <FilterSelect
                id="company-modules-status"
                value={statusFilter}
                onChange={setStatusFilter}
                options={statusOptions}
                width="w-48"
                ariaLabel="Filter modules by status"
              />
            }
          />

          <EntityListShell
            title="Application modules"
            columns={columns}
            rows={filteredRows}
            rowKey={(row) => String(row.id)}
            isLoading={loading}
            sortBy={table.sortBy}
            sortDir={table.sortDir}
            onSort={table.setSort}
            emptyIcon={Boxes}
            emptyTitle="No application modules found"
            emptyDescription={
              table.search || statusFilter !== "ALL"
                ? "No modules match the selected filters."
                : "Application modules are hardcoded and can only be viewed."
            }
            emptyAction={undefined}
          />
        </>
      )}
    </div>
  );
}