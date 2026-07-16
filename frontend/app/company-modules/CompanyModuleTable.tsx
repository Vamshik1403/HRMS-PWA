"use client";

import { useEffect, useMemo, useState } from "react";
import {
  Boxes,
  CheckCircle2,
  Eye,
  Plus,
  Save,
  XCircle,
} from "lucide-react";
import { toast } from "sonner";

import { Button } from "../components/ui/button";
import { Input } from "../components/ui/input";
import { Label } from "../components/ui/label";
import { Textarea } from "../components/ui/textarea";
import { Switch } from "../components/ui/switch";
import { Badge } from "../components/ui/badge";

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
import { NoticeBanner } from "../components/ui/notice-banner";

import type { DataTableColumn } from "../components/app/data-table";
import {
  sortRows,
  useClientTable,
} from "../hooks/use-client-table";
import { useCurrentUser } from "../hooks/useCurrentUser";

type ID = number;

interface CompanyModuleRead {
  id: ID;
  moduleName: string;
  moduleDescription?: string | null;
  moduleStatus?: boolean | null;
  createdAt?: string | null;
  updatedAt?: string | null;
}

interface CompanyModuleForm {
  moduleName: string;
  moduleDescription: string;
  moduleStatus: boolean;
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


const INITIAL_FORM: CompanyModuleForm = {
  moduleName: "",
  moduleDescription: "",
  moduleStatus: true,
};

export function CompanyModulesManagement() {
  const user = useCurrentUser();

  const canManage =
    user?.role === "SUPERADMIN" ||
    user?.role === "SERVICE_PROVIDER";

  const table = useClientTable("moduleName");

  const [rows, setRows] = useState<CompanyModuleRead[]>([]);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [deletingID, setDeletingID] = useState<ID | null>(null);

  const [statusFilter, setStatusFilter] = useState("ALL");

  const [isFormOpen, setIsFormOpen] = useState(false);
  const [isViewing, setIsViewing] = useState(false);

  const [editing, setEditing] =
    useState<CompanyModuleRead | null>(null);

  const [viewRow, setViewRow] =
    useState<CompanyModuleRead | null>(null);

  const [formData, setFormData] =
    useState<CompanyModuleForm>(INITIAL_FORM);

  const [error, setError] = useState<string | null>(null);

  const fetchRows = async () => {
    try {
      setLoading(true);
      setError(null);

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

  const resetForm = () => {
    setFormData(INITIAL_FORM);
    setEditing(null);
    setError(null);
  };

  const openCreateForm = () => {
    resetForm();
    setIsViewing(false);
    setViewRow(null);
    setIsFormOpen(true);
  };

  const handleEdit = (row: CompanyModuleRead) => {
    setEditing(row);
    setViewRow(null);
    setIsViewing(false);
    setError(null);

    setFormData({
      moduleName: row.moduleName ?? "",
      moduleDescription: row.moduleDescription ?? "",
      moduleStatus: row.moduleStatus !== false,
    });

    setIsFormOpen(true);
  };

  const handleView = (row: CompanyModuleRead) => {
    setViewRow(row);
    setIsViewing(true);
    setIsFormOpen(false);
  };

  const closePanels = () => {
    resetForm();
    setIsFormOpen(false);
    setIsViewing(false);
    setViewRow(null);
  };

  const handleSubmit = async (
    event: React.FormEvent<HTMLFormElement>,
  ) => {
    event.preventDefault();

    const moduleName = formData.moduleName.trim();

    if (!moduleName) {
      toast.error("Module name is required");
      return;
    }

    const payload = {
      moduleName,
      moduleDescription:
        formData.moduleDescription.trim() || undefined,
      moduleStatus: formData.moduleStatus,
    };

    try {
      setSaving(true);
      setError(null);

      if (editing) {
        await fetchJSONSafe<CompanyModuleRead>(
          `${API.companyModules}/${editing.id}`,
          {
            method: "PATCH",
            body: JSON.stringify(payload),
          },
        );

        toast.success("Company module updated successfully");
      } else {
        await fetchJSONSafe<CompanyModuleRead>(
          API.companyModules,
          {
            method: "POST",
            body: JSON.stringify(payload),
          },
        );

        toast.success("Company module created successfully");
      }

      await fetchRows();
      closePanels();
    } catch (err: any) {
      const message =
        err?.message || "Failed to save company module";

      setError(message);
      toast.error(message);
    } finally {
      setSaving(false);
    }
  };

  const handleStatusChange = async (
    row: CompanyModuleRead,
    moduleStatus: boolean,
  ) => {
    try {
      await fetchJSONSafe<CompanyModuleRead>(
        `${API.companyModules}/${row.id}/status`,
        {
          method: "PATCH",
          body: JSON.stringify({ moduleStatus }),
        },
      );

      setRows((currentRows) =>
        currentRows.map((item) =>
          item.id === row.id
            ? { ...item, moduleStatus }
            : item,
        ),
      );

      toast.success(
        moduleStatus
          ? "Module activated successfully"
          : "Module deactivated successfully",
      );
    } catch (err: any) {
      toast.error(
        err?.message || "Failed to update module status",
      );
    }
  };

  const handleDelete = async (row: CompanyModuleRead) => {
    const confirmed = window.confirm(
      `Delete "${row.moduleName}"? This action cannot be undone.`,
    );

    if (!confirmed) return;

    try {
      setDeletingID(row.id);

      await fetchJSONSafe(
        `${API.companyModules}/${row.id}`,
        {
          method: "DELETE",
        },
      );

      setRows((currentRows) =>
        currentRows.filter((item) => item.id !== row.id),
      );

      toast.success("Company module deleted successfully");
    } catch (err: any) {
      toast.error(
        err?.message || "Failed to delete company module",
      );
    } finally {
      setDeletingID(null);
    }
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
        colSpan: 4,
        cell: (row) => (
          <span className="line-clamp-2 text-sm text-gray-600">
            {row.moduleDescription || "No description"}
          </span>
        ),
      },
      {
        key: "moduleStatus",
        header: "Status",
        sortable: true,
        colSpan: 2,
        cell: (row) => {
          const active = row.moduleStatus !== false;

          return (
            <div className="flex items-center gap-3">
              <Badge
                variant={active ? "default" : "secondary"}
                className={
                  active
                    ? "bg-emerald-50 text-emerald-700 hover:bg-emerald-50"
                    : "bg-gray-100 text-gray-600 hover:bg-gray-100"
                }
              >
                {active ? (
                  <CheckCircle2 className="mr-1 h-3.5 w-3.5" />
                ) : (
                  <XCircle className="mr-1 h-3.5 w-3.5" />
                )}

                {active ? "Active" : "Inactive"}
              </Badge>

              {canManage && (
                <Switch
                  checked={active}
                  onCheckedChange={(checked) =>
                    handleStatusChange(row, checked)
                  }
                  aria-label={`Change status for ${row.moduleName}`}
                />
              )}
            </div>
          );
        },
      },
      {
        key: "actions",
        header: "Actions",
        colSpan: 3,
        align: "right",
        cell: (row) => (
          <EntityRowActions
            onView={() => handleView(row)}
            onEdit={
              canManage ? () => handleEdit(row) : undefined
            }
            onDelete={
              canManage && deletingID !== row.id
                ? () => handleDelete(row)
                : undefined
            }
          />
        ),
      },
    ],
    [canManage, deletingID],
  );

  return (
    <div className="page-content-enter w-full max-w-none animate-fade-in space-y-6">
      <PageHeader
        icon={Boxes}
        title="Company Modules"
        description="Manage the master list of modules available across the HRMS platform."
        actions={
          !isFormOpen && !isViewing && canManage ? (
            <Button onClick={openCreateForm}>
              <Plus className="mr-1 h-4 w-4" />
              Add Module
            </Button>
          ) : null
        }
      />

      <FormDrawer
        open={isFormOpen}
        onOpenChange={(open) => {
          if (!open) closePanels();
        }}
        title={
          editing
            ? "Edit Company Module"
            : "Add Company Module"
        }
      >
        {error && (
          <NoticeBanner
            variant="error"
            compact
            className="mb-4"
          >
            {error}
          </NoticeBanner>
        )}

        <form
          onSubmit={handleSubmit}
          className="space-y-5"
        >
          <div className="space-y-2">
            <Label htmlFor="moduleName">
              Module Name *
            </Label>

            <Input
              id="moduleName"
              value={formData.moduleName}
              onChange={(event) =>
                setFormData((current) => ({
                  ...current,
                  moduleName: event.target.value,
                }))
              }
              placeholder="For example, Attendance Management"
              maxLength={150}
              required
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="moduleDescription">
              Module Description
            </Label>

            <Textarea
              id="moduleDescription"
              value={formData.moduleDescription}
              onChange={(event) =>
                setFormData((current) => ({
                  ...current,
                  moduleDescription:
                    event.target.value,
                }))
              }
              placeholder="Describe what this module provides..."
              rows={5}
              maxLength={1000}
              className="resize-none"
            />

            <div className="text-right text-xs text-gray-500">
              {formData.moduleDescription.length}/1000
            </div>
          </div>

          <div className="flex items-center justify-between rounded-lg border border-gray-200 p-4">
            <div>
              <Label
                htmlFor="moduleStatus"
                className="cursor-pointer"
              >
                Module Status
              </Label>

              <p className="mt-1 text-sm text-gray-500">
                Inactive modules remain stored but cannot
                be assigned or used.
              </p>
            </div>

            <Switch
              id="moduleStatus"
              checked={formData.moduleStatus}
              onCheckedChange={(checked) =>
                setFormData((current) => ({
                  ...current,
                  moduleStatus: checked,
                }))
              }
            />
          </div>

          <div className="flex justify-end gap-2 border-t border-gray-200 pt-4">
            <Button
              type="button"
              variant="outline"
              onClick={closePanels}
              disabled={saving}
            >
              Cancel
            </Button>

            <Button type="submit" disabled={saving}>
              <Save className="mr-1 h-4 w-4" />

              {saving
                ? "Saving..."
                : editing
                  ? "Update Module"
                  : "Add Module"}
            </Button>
          </div>
        </form>
      </FormDrawer>

      <FormDrawer
        open={Boolean(isViewing && viewRow)}
        onOpenChange={(open) => {
          if (!open) closePanels();
        }}
        title="Company Module Details"
        showHeaderCancel
        cancelLabel="Close"
      >
        {viewRow && (
          <EntityDetailLayout
            hero={
              <EntityDetailHero
                title={viewRow.moduleName || "Module"}
                subtitle={
                  <div className="mt-2">
                    <Badge
                      variant={
                        viewRow.moduleStatus !== false
                          ? "default"
                          : "secondary"
                      }
                      className={
                        viewRow.moduleStatus !== false
                          ? "bg-emerald-50 text-emerald-700 hover:bg-emerald-50"
                          : "bg-gray-100 text-gray-600 hover:bg-gray-100"
                      }
                    >
                      {viewRow.moduleStatus !== false
                        ? "Active"
                        : "Inactive"}
                    </Badge>
                  </div>
                }
              />
            }
            columns={1}
          >
            <DetailCard
              title="Module Information"
              subtitle="Master module configuration"
              rows={[
                {
                  label: "Module ID",
                  value: viewRow.id,
                },
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
                  label: "Status",
                  value:
                    viewRow.moduleStatus !== false
                      ? "Active"
                      : "Inactive",
                },
                {
                  label: "Created At",
                  value: viewRow.createdAt
                    ? new Date(
                        viewRow.createdAt,
                      ).toLocaleString()
                    : "—",
                },
                {
                  label: "Last Updated",
                  value: viewRow.updatedAt
                    ? new Date(
                        viewRow.updatedAt,
                      ).toLocaleString()
                    : "—",
                },
              ]}
            />
          </EntityDetailLayout>
        )}
      </FormDrawer>

      {!isFormOpen && !isViewing && (
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
            title="All company modules"
            columns={columns}
            rows={filteredRows}
            rowKey={(row) => String(row.id)}
            isLoading={loading}
            sortBy={table.sortBy}
            sortDir={table.sortDir}
            onSort={table.setSort}
            emptyIcon={Boxes}
            emptyTitle="No company modules found"
            emptyDescription={
              table.search || statusFilter !== "ALL"
                ? "No modules match the selected filters."
                : "Create the first module available within the HRMS platform."
            }
            emptyAction={
              canManage &&
              !table.search &&
              statusFilter === "ALL" ? (
                <Button onClick={openCreateForm}>
                  <Plus className="mr-1 h-4 w-4" />
                  Add Module
                </Button>
              ) : undefined
            }
          />
        </>
      )}
    </div>
  );
}