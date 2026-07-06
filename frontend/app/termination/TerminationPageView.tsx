"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { getSidebarContext } from "../utils/sidebarContext";
import { Button } from "../components/ui/button";
import { Input } from "../components/ui/input";
import { Label } from "../components/ui/label";
import { Badge } from "../components/ui/badge";
import { FormDrawer } from "../components/ui/form-drawer";
import { FormField } from "../components/ui/form-field";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "../components/ui/select";
import {
  Plus,
  X,
  Save,
  CheckCircle2,
  UserCog,
} from "lucide-react";
import { NoticeBanner } from "../components/ui/notice-banner";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "../components/ui/dialog";
import { useCurrentUser } from "../hooks/useCurrentUser";
import { PageHeader } from "../components/app/page-header";
import { FilterBar, FilterSelect } from "../components/app/filter-bar";
import { EntityListShell } from "../components/app/entity-list-shell";
import type { DataTableColumn } from "../components/app/data-table";
import { useClientTable, sortRows } from "../hooks/use-client-table";

type ID = number;

interface Employee {
  id: ID;
  employeeFirstName?: string;
  employeeLastName?: string;
  employeeID?: string;
  lifecycleStatus: "ACTIVE" | "EXITED" | "INACTIVE";

  serviceProviderID?: ID | null;
  companyID?: ID | null;
  branchesID?: ID | null;
  departmentNameID?: ID | null;

  branches?: {
    id: ID;
    branchName?: string | null;
  } | null;

  departments?: {
    id: ID;
    departmentName?: string | null;
  } | null;
}

interface Branch {
  id: ID;
  branchName?: string | null;
  companyID?: ID | null;
  serviceProviderID?: ID | null;
}

interface Department {
  id: ID;
  departmentName?: string | null;
  branchesID?: ID | null;
  companyID?: ID | null;
  serviceProviderID?: ID | null;
}

interface Termination {
  id: ID;
  employeeId: ID;
  exitType: string;
  exitStatus: string;
  reasonCategory?: string;
  lastWorkingDay?: string;
  resignationDate?: string;
  noticeStartDate?: string;
  noticeDays?: number;
  createdAt: string;
  employee?: Employee;
}

const API = {
  employees: "/backend/manage-emp/list",
  terminations: "/backend/termination",
  branches: "/backend/branches",
  departments: "/backend/departments",
};

const EXIT_TYPES_WITHOUT_NOTICE = new Set(["TERMINATION", "DEATH", "ABSCONDING"]);

function exitTypeRequiresNotice(exitType: string) {
  return Boolean(exitType) && !EXIT_TYPES_WITHOUT_NOTICE.has(exitType);
}

export default function TerminationManagement() {
  const user = useCurrentUser();
  const canManage = user?.role === "SUPERADMIN" || user?.role === "SERVICE_PROVIDER" || user?.role === "COMPANY_ADMIN" || user?.role === "BRANCH_ADMIN" || user?.role === "ADMIN";

  const [terminations, setTerminations] = useState<Termination[]>([]);
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [isAdding, setIsAdding] = useState(false);
  const table = useClientTable("employee");
  const [branchFilter, setBranchFilter] = useState("ALL");
  const [departmentFilter, setDepartmentFilter] = useState("ALL");

  // Employee autocomplete
  const [empSearch, setEmpSearch] = useState("");
  const [empList, setEmpList] = useState<Employee[]>([]);
 const [empLoading, setEmpLoading] = useState(false);

const [branchList, setBranchList] = useState<Branch[]>([]);
const [departmentList, setDepartmentList] = useState<Department[]>([]);
const [selectedBranchID, setSelectedBranchID] = useState("");
const [selectedDepartmentID, setSelectedDepartmentID] = useState("");

const empRef = useRef<HTMLDivElement>(null);

  const empTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const [approveModalOpen, setApproveModalOpen] = useState(false);
  const [selectedTermination, setSelectedTermination] =
    useState<Termination | null>(null);

  const [approvalForm, setApprovalForm] = useState({
    lastWorkingDay: "",
    noticeDays: "",
    disableLoginOn: "",
  });

  const [form, setForm] = useState({
    employeeId: "",
    exitType: "",
    reasonCategory: "",
    resignationDate: "",
    initiatedOn: new Date().toISOString().split("T")[0],
    noticePeriod: "",
  });

  // -------------------
  // Load Data
  // -------------------

    const getActiveCompanyID = () => {
    const ctx = getSidebarContext();
    return ctx?.companyID ?? user?.companyID ?? null;
  };

  const getActiveServiceProviderID = () => {
    const ctx = getSidebarContext();
    return ctx?.serviceProviderID ?? user?.serviceProviderID ?? null;
  };

  const fetchBranchAndDepartmentLookups = async () => {
    try {
      const [brRes, deptRes] = await Promise.all([
        fetch(API.branches),
        fetch(API.departments),
      ]);

      const brRaw = await brRes.json();
      const deptRaw = await deptRes.json();

      let branches: Branch[] = Array.isArray(brRaw) ? brRaw : brRaw?.data ?? [];
      let departments: Department[] = Array.isArray(deptRaw)
        ? deptRaw
        : deptRaw?.data ?? [];

      const companyID = getActiveCompanyID();

      if (companyID) {
        branches = branches.filter(
          (b) => Number(b.companyID) === Number(companyID)
        );
        departments = departments.filter(
          (d) => Number(d.companyID) === Number(companyID)
        );
      }

      if (user?.role === "BRANCH_ADMIN" && user?.branchesID) {
        branches = branches.filter(
          (b) => Number(b.id) === Number(user.branchesID)
        );
        departments = departments.filter(
          (d) => Number(d.branchesID) === Number(user.branchesID)
        );
        setSelectedBranchID(String(user.branchesID));
        setBranchFilter(String(user.branchesID));
      }

      setBranchList(branches);
      setDepartmentList(departments);
    } catch (e) {
      console.error("Failed to load branch/department lookup", e);
      setBranchList([]);
      setDepartmentList([]);
    }
  };

  const visibleDepartments = useMemo(() => {
    if (!selectedBranchID) return [];

    return departmentList.filter(
      (d) => Number(d.branchesID) === Number(selectedBranchID)
    );
  }, [departmentList, selectedBranchID]);

  const visibleEmployeesForTermination = useMemo(() => {
    const activeTerminatedIds = new Set(
      terminations
        .filter(
          (t) =>
            t.exitStatus === "DRAFT" ||
            t.exitStatus === "APPROVED" ||
            t.exitStatus === "NOTICE_RUNNING"
        )
        .map((t) => t.employeeId)
    );

    return employees.filter((e) => {
      if (activeTerminatedIds.has(e.id)) return false;

      const matchesBranch =
        selectedBranchID &&
        Number(e.branchesID ?? e.branches?.id) === Number(selectedBranchID);

      const matchesDepartment =
        selectedDepartmentID &&
        Number(e.departmentNameID ?? e.departments?.id) ===
          Number(selectedDepartmentID);

      return Boolean(matchesBranch && matchesDepartment);
    });
  }, [employees, terminations, selectedBranchID, selectedDepartmentID]);


  const fetchData = async () => {
    try {
      setLoading(true);

      const empRes = await fetch(`${API.employees}?status=ACTIVE`);
      const empRaw = await empRes.json();
      let empData = Array.isArray(empRaw) ? empRaw : empRaw?.data ?? [];
      // Filter by company from sidebar context
      const ctx = getSidebarContext();
      const companyID = ctx?.companyID ?? user?.companyID;
     if (companyID) {
  empData = empData.filter((e: any) => Number(e.companyID) === Number(companyID));
}

if (user?.role === "BRANCH_ADMIN" && user?.branchesID) {
  empData = empData.filter(
    (e: any) => Number(e.branchesID) === Number(user.branchesID)
  );
}

      setEmployees(empData);

      const termRes = await fetch(API.terminations);
      const raw = await termRes.json();
      let termData = Array.isArray(raw) ? raw : raw?.data ?? [];
      if (companyID) {
        termData = termData.filter((t: any) => t.employee?.companyID === companyID || t.companyID === companyID);
      }
      setTerminations(termData);
    } catch (e) {
      console.error("Load error", e);
    } finally {
      setLoading(false);
    }
  };


  const closeTerminationPagePanels = () => {
  setIsAdding(false);

  setEmpSearch("");
  setEmpList([]);

  setSelectedDepartmentID("");

  if (user?.role !== "BRANCH_ADMIN") {
    setSelectedBranchID("");
  }

  setForm({
    employeeId: "",
    exitType: "",
    reasonCategory: "",
    resignationDate: "",
    initiatedOn: new Date().toISOString().split("T")[0],
    noticePeriod: "",
  });

  setApproveModalOpen(false);
  setSelectedTermination(null);
  setApprovalForm({
    lastWorkingDay: "",
    noticeDays: "",
    disableLoginOn: "",
  });
};

useEffect(() => {
  const load = () => {
    if (user) {
      fetchData();
      fetchBranchAndDepartmentLookups();
    }
  };

  load();

  const sidebarPageClickHandler = (e: any) => {
    if (e.detail?.path === "/termination") {
      closeTerminationPagePanels();
      load();
    }
  };

  window.addEventListener("sidebar-main-page-click", sidebarPageClickHandler);
  window.addEventListener("sidebar-context-changed", load);
  window.addEventListener("app-data-refresh", load);

  return () => {
    window.removeEventListener("sidebar-main-page-click", sidebarPageClickHandler);
    window.removeEventListener("sidebar-context-changed", load);
    window.removeEventListener("app-data-refresh", load);
  };
}, [user]);

  const runFetchEmp = (q: string) => {
  if (empTimerRef.current) clearTimeout(empTimerRef.current);

  empTimerRef.current = setTimeout(() => {
    if (!selectedBranchID || !selectedDepartmentID) {
      setEmpList([]);
      return;
    }

    const ql = q.toLowerCase();

    const filtered = visibleEmployeesForTermination.filter((e) => {
      const name = `${e.employeeFirstName ?? ""} ${e.employeeLastName ?? ""}`.toLowerCase();
      const eid = (e.employeeID ?? "").toLowerCase();

      if (!ql) return true;

      return name.includes(ql) || eid.includes(ql);
    });

    setEmpList(filtered.slice(0, 20));
  }, 150);
};

  useEffect(() => {
    const onClick = (e: MouseEvent) => {
      if (empRef.current && !empRef.current.contains(e.target as Node)) setEmpList([]);
    };
    document.addEventListener("mousedown", onClick);
    return () => document.removeEventListener("mousedown", onClick);
  }, []);

  // -------------------
  // Initiate Exit
  // -------------------
  const handleCreate = async (e: any) => {
    e.preventDefault();
    setSaving(true);

    try {
      const requiresNotice = exitTypeRequiresNotice(form.exitType);
      const createRes = await fetch(API.terminations, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
       body: JSON.stringify({
  employeeId: Number(form.employeeId),
  serviceProviderID: getActiveServiceProviderID(),
  companyID: getActiveCompanyID(),
  branchesID: Number(selectedBranchID),
  exitType: form.exitType,
          reasonCategory: form.reasonCategory,
          resignationDate: form.resignationDate || undefined,
          noticeStartDate: form.initiatedOn || undefined,
          noticeDays:
            requiresNotice && form.noticePeriod
              ? Number(form.noticePeriod)
              : undefined,
        }),
      });

      const created = await createRes.json();

      // For admin roles, auto-approve immediately — no separate approval step needed
      if (canManage && created?.id) {
        let lastWorkingDay: string;
        if (requiresNotice && form.noticePeriod) {
          const noticeDays = Number(form.noticePeriod);
          const startDate = form.initiatedOn
            ? new Date(form.initiatedOn)
            : new Date();
          startDate.setDate(startDate.getDate() + noticeDays);
          lastWorkingDay = startDate.toISOString().split("T")[0];
        } else {
          lastWorkingDay =
            form.initiatedOn || new Date().toISOString().split("T")[0];
        }

        await fetch(`${API.terminations}/${created.id}/approve`, {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ lastWorkingDay }),
        });
      }

     setIsAdding(false);
setEmpSearch("");
setEmpList([]);
setSelectedDepartmentID("");
if (user?.role !== "BRANCH_ADMIN") {
  setSelectedBranchID("");
}
setForm({
        employeeId: "",
        exitType: "",
        reasonCategory: "",
        resignationDate: "",
        initiatedOn: new Date().toISOString().split("T")[0],
        noticePeriod: "",
      });
      fetchData();
    } catch {
      alert("Failed to initiate termination");
    } finally {
      setSaving(false);
    }
  };

  // -------------------
  // Approval Modal Logic
  // -------------------
  const openApproveModal = (termination: Termination) => {
    setSelectedTermination(termination);
    setApproveModalOpen(true);
  };

  const confirmApprove = async () => {
    if (!approvalForm.lastWorkingDay) {
      alert("Last working day required");
      return;
    }

    await fetch(`${API.terminations}/${selectedTermination?.id}/approve`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        lastWorkingDay: approvalForm.lastWorkingDay,
        noticeDays: approvalForm.noticeDays
          ? Number(approvalForm.noticeDays)
          : undefined,
        disableLoginOn:
          approvalForm.disableLoginOn || approvalForm.lastWorkingDay,
      }),
    });

    setApproveModalOpen(false);
    setSelectedTermination(null);
    setApprovalForm({
      lastWorkingDay: "",
      noticeDays: "",
      disableLoginOn: "",
    });

    fetchData();
  };

  const handleCancel = async (id: ID) => {
    await fetch(`${API.terminations}/${id}/cancel`, {
      method: "PUT",
    });
    fetchData();
  };

  const handleFinal = async (id: ID) => {
    await fetch(`${API.terminations}/${id}/final-settle`, {
      method: "PUT",
    });
    fetchData();
  };

  // -------------------
  // Search
  // -------------------

  const employeeStatusBadge = (t: Termination) => {
    if (t.exitStatus === "FINAL_SETTLED" || t.exitStatus === "APPROVED") {
      return <Badge className="bg-red-100 text-red-700">Inactive</Badge>;
    }
    if (t.exitStatus === "CANCELLED" || t.exitStatus === "WITHDRAWN") {
      return <Badge className="bg-green-100 text-green-700">Active</Badge>;
    }
    if (t.noticeStartDate && t.noticeDays) {
      const end = new Date(t.noticeStartDate);
      end.setDate(end.getDate() + t.noticeDays);
      if (new Date() >= end) {
        return <Badge className="bg-red-100 text-red-700">Inactive</Badge>;
      }
      return <Badge className="bg-orange-100 text-orange-700">Notice Period</Badge>;
    }
    return <Badge className="bg-green-100 text-green-700">Active</Badge>;
  };

  const exitStatusBadge = (status: string) => (
    <Badge
      className={
        status === "DRAFT"
          ? "bg-yellow-100 text-yellow-700"
          : status === "APPROVED"
          ? "bg-red-100 text-red-700"
          : "bg-green-100 text-green-700"
      }
    >
      {status}
    </Badge>
  );

  const filterDepartmentOptions = useMemo(() => {
    const depts =
      branchFilter === "ALL"
        ? departmentList
        : departmentList.filter(
            (d) => String(d.branchesID) === branchFilter
          );
    return [
      { value: "ALL", label: "All departments" },
      ...depts.map((d) => ({
        value: String(d.id),
        label: d.departmentName || `Department #${d.id}`,
      })),
    ];
  }, [departmentList, branchFilter]);

  const branchFilterOptions = useMemo(
    () => [
      { value: "ALL", label: "All branches" },
      ...branchList.map((b) => ({
        value: String(b.id),
        label: b.branchName || `Branch #${b.id}`,
      })),
    ],
    [branchList],
  );

  const filtered = useMemo(() => {
    if (!Array.isArray(terminations)) return [];

    const q = table.search.trim().toLowerCase();

    let list = terminations.filter((t) => {
      const branchId = String(t.employee?.branchesID ?? t.employee?.branches?.id ?? "");
      const departmentId = String(
        t.employee?.departmentNameID ?? t.employee?.departments?.id ?? ""
      );

      const matchesBranch =
        branchFilter === "ALL" || branchFilter === branchId;

      const matchesDepartment =
        departmentFilter === "ALL" || departmentFilter === departmentId;

      const matchesSearch =
        !q ||
        [
          t.employee?.employeeFirstName,
          t.employee?.employeeLastName,
          t.employee?.employeeID,
          t.employee?.branches?.branchName,
          t.employee?.departments?.departmentName,
          t.exitType,
          t.exitStatus,
          t.reasonCategory,
        ]
          .filter(Boolean)
          .some((x) => String(x).toLowerCase().includes(q));

      return matchesBranch && matchesDepartment && matchesSearch;
    });

    return sortRows(list, table.sortBy, table.sortDir, (row, key) => {
      const t = row as Termination;
      if (key === "employee") {
        return `${t.employee?.employeeFirstName ?? ""} ${t.employee?.employeeLastName ?? ""}`.trim();
      }
      if (key === "exitType") return t.exitType ?? "";
      if (key === "exitStatus") return t.exitStatus ?? "";
      if (key === "noticeStartDate") return t.noticeStartDate ?? "";
      if (key === "noticeDays") return t.noticeDays ?? 0;
      if (key === "lastWorkingDay") return t.lastWorkingDay ?? "";
      return "";
    });
  }, [
    table.search,
    table.sortBy,
    table.sortDir,
    terminations,
    branchFilter,
    departmentFilter,
  ]);

  const terminationColumns = useMemo((): DataTableColumn<Termination>[] => [
    {
      key: "employee",
      header: "Employee",
      sortable: true,
      colSpan: 3,
      cell: (t) => (
        <span className="font-medium">
          {t.employee?.employeeFirstName} {t.employee?.employeeLastName}
        </span>
      ),
    },
    {
      key: "exitType",
      header: "Exit Type",
      sortable: true,
      colSpan: 2,
      cell: (t) => t.exitType,
    },
    {
      key: "exitStatus",
      header: "Status",
      sortable: true,
      colSpan: 2,
      cell: (t) => exitStatusBadge(t.exitStatus),
    },
    {
      key: "noticeStartDate",
      header: "Initiated On",
      sortable: true,
      colSpan: 2,
      cell: (t) =>
        t.noticeStartDate
          ? new Date(t.noticeStartDate).toLocaleDateString()
          : "—",
    },
    {
      key: "noticeDays",
      header: "Notice Period",
      sortable: true,
      colSpan: 2,
      cell: (t) => (t.noticeDays != null ? `${t.noticeDays} days` : "—"),
    },
    {
      key: "lastWorkingDay",
      header: "Last Working Day",
      sortable: true,
      colSpan: 2,
      cell: (t) =>
        t.lastWorkingDay
          ? new Date(t.lastWorkingDay).toLocaleDateString()
          : "—",
    },
    {
      key: "employeeStatus",
      header: "Employee Status",
      colSpan: 2,
      cell: (t) => employeeStatusBadge(t),
    },
    {
      key: "actions",
      header: "Actions",
      colSpan: 3,
      align: "right",
      cell: (t) => (
        <div className="flex justify-end gap-2 flex-wrap">
          {t.exitStatus === "DRAFT" && !canManage && (
            <>
              <Button
                size="sm"
                className="bg-red-600 hover:bg-red-700"
                onClick={() => openApproveModal(t)}
              >
                Approve
              </Button>
              <Button
                size="sm"
                variant="outline"
                onClick={() => handleCancel(t.id)}
              >
                Cancel
              </Button>
            </>
          )}
          {t.exitStatus === "DRAFT" && canManage && (
            <Button
              size="sm"
              variant="outline"
              onClick={() => handleCancel(t.id)}
            >
              Cancel
            </Button>
          )}
          {t.exitStatus === "APPROVED" && (
            <Button size="sm" onClick={() => handleFinal(t.id)}>
              Final Settle
            </Button>
          )}
        </div>
      ),
    },
  ], [canManage]);

  return (
    <div className="space-y-6 w-full max-w-none animate-fade-in page-content-enter">

      <PageHeader
        icon={UserCog}
        title="Off Boarding"
        description="Manage employee exit and termination records"
        actions={
          canManage && !isAdding ? (
            <Button onClick={() => setIsAdding(true)}>
              <Plus className="w-4 h-4 mr-1" />
              Initiate Off Boarding
            </Button>
          ) : null
        }
      />

      {/* Create Form - Drawer */}
      <FormDrawer
        open={isAdding}
        onOpenChange={(v) => { if (!v) closeTerminationPagePanels(); }}
        title="Initiate Exit"
        showHeaderCancel
      >
        <form onSubmit={handleCreate} className="space-y-6">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <FormField label="Branch" required>
              <Select
                value={selectedBranchID || undefined}
                disabled={user?.role === "BRANCH_ADMIN"}
                onValueChange={(branchID) => {
                  setSelectedBranchID(branchID);
                  setSelectedDepartmentID("");
                  setEmpSearch("");
                  setEmpList([]);
                  setForm({ ...form, employeeId: "" });
                }}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select branch" />
                </SelectTrigger>
                <SelectContent>
                  {branchList.map((b) => (
                    <SelectItem key={b.id} value={String(b.id)}>
                      {b.branchName || "Unnamed Branch"}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </FormField>

            <FormField label="Department" required>
              <Select
                value={selectedDepartmentID || undefined}
                disabled={!selectedBranchID}
                onValueChange={(departmentID) => {
                  setSelectedDepartmentID(departmentID);
                  setEmpSearch("");
                  setEmpList([]);
                  setForm({ ...form, employeeId: "" });
                }}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select department" />
                </SelectTrigger>
                <SelectContent>
                  {visibleDepartments.map((d) => (
                    <SelectItem key={d.id} value={String(d.id)}>
                      {d.departmentName || "Unnamed Department"}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </FormField>
          </div>

          <div ref={empRef} className="relative">
            <FormField label="Employee" required>
              <Input
                value={empSearch}
                onChange={(e) => {
                  setEmpSearch(e.target.value);
                  setForm({ ...form, employeeId: "" });
                  runFetchEmp(e.target.value);
                }}
                onFocus={(e) => runFetchEmp(e.target.value)}
                placeholder={
                  !selectedBranchID
                    ? "Select branch first"
                    : !selectedDepartmentID
                      ? "Select department first"
                      : "Type employee name or ID…"
                }
                autoComplete="off"
                disabled={!selectedBranchID || !selectedDepartmentID}
                required={!form.employeeId}
              />
            </FormField>

            {empList.length > 0 && (
              <div className="absolute z-10 mt-1 w-full overflow-hidden rounded-xl border border-border bg-popover shadow-lg max-h-48 overflow-y-auto">
                {empList.map((e) => (
                  <div
                    key={e.id}
                    className="cursor-pointer px-3 py-2.5 text-sm transition-colors hover:bg-muted"
                    onMouseDown={(ev) => ev.preventDefault()}
                    onClick={() => {
                      setForm({ ...form, employeeId: String(e.id) });
                      setEmpSearch(
                        `${e.employeeFirstName ?? ""} ${e.employeeLastName ?? ""} - ${
                          e.employeeID ?? ""
                        }`.trim()
                      );
                      setEmpList([]);
                    }}
                  >
                    <div className="font-medium">
                      {e.employeeFirstName ?? ""} {e.employeeLastName ?? ""} -{" "}
                      {e.employeeID ?? ""}
                    </div>
                    <div className="text-xs text-muted-foreground">
                      {e.branches?.branchName || "Branch"} /{" "}
                      {e.departments?.departmentName || "Department"}
                    </div>
                  </div>
                ))}
              </div>
            )}

            {selectedBranchID &&
              selectedDepartmentID &&
              visibleEmployeesForTermination.length === 0 && (
                <p className="text-xs text-destructive mt-1">
                  No active employees found for selected branch and department.
                </p>
              )}
          </div>

          <FormField label="Exit Type" required>
            <Select
              value={form.exitType || undefined}
              onValueChange={(exitType) => {
                setForm((prev) => ({
                  ...prev,
                  exitType,
                  noticePeriod: EXIT_TYPES_WITHOUT_NOTICE.has(exitType)
                    ? ""
                    : prev.noticePeriod,
                }));
              }}
            >
              <SelectTrigger>
                <SelectValue placeholder="Select type" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="RESIGNATION">Resignation</SelectItem>
                <SelectItem value="TERMINATION">Termination</SelectItem>
                <SelectItem value="RETRENCHMENT">Retrenchment</SelectItem>
                <SelectItem value="RETIREMENT">Retirement</SelectItem>
                <SelectItem value="DEATH">Death</SelectItem>
                <SelectItem value="ABSCONDING">Absconding</SelectItem>
                <SelectItem value="CONTRACT_END">Contract End</SelectItem>
              </SelectContent>
            </Select>
          </FormField>

          <FormField label="Reason">
            <Input
              value={form.reasonCategory}
              onChange={(e) =>
                setForm({ ...form, reasonCategory: e.target.value })
              }
              placeholder="Optional reason or category"
            />
          </FormField>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <FormField label="Initiated On">
              <Input
                type="date"
                value={form.initiatedOn}
                min={new Date().toISOString().split("T")[0]}
                onChange={(e) =>
                  setForm({ ...form, initiatedOn: e.target.value })
                }
              />
            </FormField>

            {exitTypeRequiresNotice(form.exitType) && (
              <FormField label="Notice Period (Days)">
                <Input
                  type="number"
                  min="0"
                  value={form.noticePeriod}
                  onChange={(e) =>
                    setForm({ ...form, noticePeriod: e.target.value })
                  }
                  placeholder="e.g. 30"
                />
              </FormField>
            )}
          </div>

          <div className="flex justify-end gap-2 border-t border-border pt-5">
            <Button type="button" variant="outline" onClick={closeTerminationPagePanels}>
              <X className="w-4 h-4 mr-1" />
              Cancel
            </Button>
            <Button type="submit" disabled={saving}>
              <Save className="w-4 h-4 mr-1" />
              {saving ? "Saving..." : "Submit"}
            </Button>
          </div>
        </form>
      </FormDrawer>

      {!isAdding && (
        <>
          <FilterBar
            search={{
              value: table.search,
              onChange: table.setSearch,
              placeholder: "Search termination records…",
            }}
            filters={
              <>
                <FilterSelect
                  id="termination-branch"
                  value={branchFilter}
                  onChange={(v) => {
                    setBranchFilter(v);
                    setDepartmentFilter("ALL");
                  }}
                  options={branchFilterOptions}
                  width="w-56"
                  ariaLabel="Filter by branch"
                />
                <FilterSelect
                  id="termination-department"
                  value={departmentFilter}
                  onChange={setDepartmentFilter}
                  options={filterDepartmentOptions}
                  width="w-56"
                  ariaLabel="Filter by department"
                />
              </>
            }
          />

          <EntityListShell
            title="Termination records"
            columns={terminationColumns}
            rows={filtered}
            rowKey={(t) => String(t.id)}
            isLoading={loading}
            sortBy={table.sortBy}
            sortDir={table.sortDir}
            onSort={table.setSort}
            emptyIcon={UserCog}
            emptyTitle="No termination records found"
            emptyDescription="Off-boarding records will appear here once initiated."
            emptyAction={
              canManage ? (
                <Button onClick={() => setIsAdding(true)}>
                  <Plus className="w-4 h-4 mr-1" /> Initiate Off Boarding
                </Button>
              ) : undefined
            }
          />
        </>
      )}

      {/* Approval Modal */}
      <Dialog open={approveModalOpen} onOpenChange={setApproveModalOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-red-600">
              <CheckCircle2 className="w-5 h-5" />
              Approve Termination
            </DialogTitle>
          </DialogHeader>

          <div className="space-y-4 mt-4">
            <div>
              <Label>Last Working Day *</Label>
              <Input
                type="date"
                value={approvalForm.lastWorkingDay}
                onChange={(e) =>
                  setApprovalForm({
                    ...approvalForm,
                    lastWorkingDay: e.target.value,
                  })
                }
              />
            </div>

            <div>
              <Label>Notice Days</Label>
              <Input
                type="number"
                value={approvalForm.noticeDays}
                onChange={(e) =>
                  setApprovalForm({
                    ...approvalForm,
                    noticeDays: e.target.value,
                  })
                }
              />
            </div>

            <div>
              <Label>Disable Login On</Label>
              <Input
                type="date"
                value={approvalForm.disableLoginOn}
                onChange={(e) =>
                  setApprovalForm({
                    ...approvalForm,
                    disableLoginOn: e.target.value,
                  })
                }
              />
            </div>

            <NoticeBanner variant="warning" compact>
              Approving will disable login and mark employee as EXITED.
            </NoticeBanner>
          </div>

          <DialogFooter className="mt-6">
            <Button type="button" variant="outline" onClick={closeTerminationPagePanels}>
  <X className="w-4 h-4 mr-1" />
  Cancel
</Button>
            <Button
              className="bg-red-600 hover:bg-red-700"
              onClick={confirmApprove}
            >
              Confirm Approval
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
