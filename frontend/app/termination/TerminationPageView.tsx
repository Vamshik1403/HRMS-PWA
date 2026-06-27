"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { getSidebarContext } from "../utils/sidebarContext";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "../components/ui/card";
import { Button } from "../components/ui/button";
import { Input } from "../components/ui/input";
import { Label } from "../components/ui/label";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "../components/ui/table";
import { Badge } from "../components/ui/badge";
import {
  Plus,
  Search,
  X,
  Save,
  CheckCircle2,
  AlertTriangle,
  RotateCcw,
  Filter,
} from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "../components/ui/dialog";
import { useCurrentUser } from "../hooks/useCurrentUser";
import { TableBodySkeleton } from "../components/ui/TableBodySkeleton";

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
  const [search, setSearch] = useState("");

  // Employee autocomplete
  const [empSearch, setEmpSearch] = useState("");
  const [empList, setEmpList] = useState<Employee[]>([]);
 const [empLoading, setEmpLoading] = useState(false);

const [branchList, setBranchList] = useState<Branch[]>([]);
const [departmentList, setDepartmentList] = useState<Department[]>([]);
const [selectedBranchID, setSelectedBranchID] = useState("");
const [selectedDepartmentID, setSelectedDepartmentID] = useState("");

const [selectedFilterBranchIds, setSelectedFilterBranchIds] = useState<string[]>([]);
const [selectedFilterDepartmentIds, setSelectedFilterDepartmentIds] = useState<string[]>([]);
const [showFilterModal, setShowFilterModal] = useState(false);

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

  setShowFilterModal(false);
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

    const toggleFilterBranch = (branchId: string) => {
    setSelectedFilterBranchIds((prev) => {
      const next = prev.includes(branchId)
        ? prev.filter((id) => id !== branchId)
        : [...prev, branchId];

      if (next.length > 0) {
        setSelectedFilterDepartmentIds((deptPrev) =>
          deptPrev.filter((deptId) => {
            const dept = departmentList.find(
              (d) => String(d.id) === String(deptId)
            );
            return dept && next.includes(String(dept.branchesID));
          })
        );
      }

      return next;
    });
  };

  const toggleFilterDepartment = (departmentId: string) => {
    setSelectedFilterDepartmentIds((prev) =>
      prev.includes(departmentId)
        ? prev.filter((id) => id !== departmentId)
        : [...prev, departmentId]
    );
  };

  const selectAllFilterBranches = () => {
    setSelectedFilterBranchIds(branchList.map((b) => String(b.id)));
  };

  const selectAllFilterDepartments = () => {
    setSelectedFilterDepartmentIds(
      visibleFilterDepartments.map((d) => String(d.id))
    );
  };

  const clearAllFilters = () => {
    if (user?.role === "BRANCH_ADMIN" && user?.branchesID) {
      setSelectedFilterBranchIds([String(user.branchesID)]);
      setSelectedFilterDepartmentIds([]);
      return;
    }

    setSelectedFilterBranchIds([]);
    setSelectedFilterDepartmentIds([]);
  };

  const visibleFilterDepartments = departmentList.filter((d) => {
    return (
      selectedFilterBranchIds.length === 0 ||
      selectedFilterBranchIds.includes(String(d.branchesID))
    );
  });


   const filtered = useMemo(() => {
    if (!Array.isArray(terminations)) return [];

    const q = search.trim().toLowerCase();

    return terminations.filter((t) => {
      const branchId = String(t.employee?.branchesID ?? t.employee?.branches?.id ?? "");
      const departmentId = String(
        t.employee?.departmentNameID ?? t.employee?.departments?.id ?? ""
      );

      const matchesBranch =
        selectedFilterBranchIds.length === 0 ||
        selectedFilterBranchIds.includes(branchId);

      const matchesDepartment =
        selectedFilterDepartmentIds.length === 0 ||
        selectedFilterDepartmentIds.includes(departmentId);

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
  }, [
    search,
    terminations,
    selectedFilterBranchIds,
    selectedFilterDepartmentIds,
  ]);

  return (
    <div className="space-y-6 w-full max-w-6xl mx-auto px-4">

      {canManage && !isAdding && (
        <div className="flex justify-end">
          <Button onClick={() => setIsAdding(true)}>
            <Plus className="w-4 h-4 mr-1" />
            Initiate Off Boarding
          </Button>
        </div>
      )}

      {/* Create Form */}
      {isAdding && (
        <Card className="border-2 border-blue-200">
          <CardHeader>
            <CardTitle>Initiate Exit</CardTitle>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleCreate} className="space-y-4">
             <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
  <div>
    <Label>Branch *</Label>
    <select
      value={selectedBranchID}
      disabled={user?.role === "BRANCH_ADMIN"}
      onChange={(e) => {
        const branchID = e.target.value;
        setSelectedBranchID(branchID);
        setSelectedDepartmentID("");
        setEmpSearch("");
        setEmpList([]);
        setForm({ ...form, employeeId: "" });
      }}
      className="w-full border rounded p-2"
      required
    >
      <option value="">Select Branch</option>
      {branchList.map((b) => (
        <option key={b.id} value={String(b.id)}>
          {b.branchName || "Unnamed Branch"}
        </option>
      ))}
    </select>
  </div>

  <div>
    <Label>Department *</Label>
    <select
      value={selectedDepartmentID}
      disabled={!selectedBranchID}
      onChange={(e) => {
        setSelectedDepartmentID(e.target.value);
        setEmpSearch("");
        setEmpList([]);
        setForm({ ...form, employeeId: "" });
      }}
      className="w-full border rounded p-2"
      required
    >
      <option value="">Select Department</option>
      {visibleDepartments.map((d) => (
        <option key={d.id} value={String(d.id)}>
          {d.departmentName || "Unnamed Department"}
        </option>
      ))}
    </select>
  </div>
</div>

<div ref={empRef} className="relative">
  <Label>Employee *</Label>
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

  {empList.length > 0 && (
    <div className="absolute z-10 bg-white border rounded w-full shadow max-h-48 overflow-y-auto">
      {empList.map((e) => (
        <div
          key={e.id}
          className="px-3 py-2 hover:bg-gray-100 cursor-pointer"
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
          <div className="text-xs text-gray-500">
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
      <p className="text-xs text-red-500 mt-1">
        No active employees found for selected branch and department.
      </p>
    )}
</div>

              <div>
                <Label>Exit Type *</Label>
                <select
                  value={form.exitType}
                  onChange={(e) => {
                    const exitType = e.target.value;
                    setForm((prev) => ({
                      ...prev,
                      exitType,
                      noticePeriod: EXIT_TYPES_WITHOUT_NOTICE.has(exitType)
                        ? ""
                        : prev.noticePeriod,
                    }));
                  }}
                  className="w-full border rounded p-2"
                  required
                >
                  <option value="">Select Type</option>
                  <option value="RESIGNATION">Resignation</option>
                  <option value="TERMINATION">Termination</option>
                  <option value="RETRENCHMENT">Retrenchment</option>
                  <option value="RETIREMENT">Retirement</option>
                  <option value="DEATH">Death</option>
                  <option value="ABSCONDING">Absconding</option>
                  <option value="CONTRACT_END">Contract End</option>
                </select>
              </div>

              <div>
                <Label>Reason</Label>
                <Input
                  value={form.reasonCategory}
                  onChange={(e) =>
                    setForm({ ...form, reasonCategory: e.target.value })
                  }
                />
              </div>

              <div>
                <Label>Initiated On</Label>
                <Input
                  type="date"
                  value={form.initiatedOn}
                  min={new Date().toISOString().split("T")[0]}
                  onChange={(e) =>
                    setForm({ ...form, initiatedOn: e.target.value })
                  }
                />
              </div>

              {exitTypeRequiresNotice(form.exitType) && (
                <div>
                  <Label>Notice Period (Days)</Label>
                  <Input
                    type="number"
                    min="0"
                    value={form.noticePeriod}
                    onChange={(e) =>
                      setForm({ ...form, noticePeriod: e.target.value })
                    }
                    placeholder="e.g. 30"
                  />
                </div>
              )}

              <div className="flex gap-2">
                <Button type="submit" disabled={saving}>
                  <Save className="w-4 h-4 mr-1" />
                  {saving ? "Saving..." : "Submit"}
                </Button>
                <Button variant="outline" onClick={() => setIsAdding(false)}>
                  <X className="w-4 h-4 mr-1" />
                  Cancel
                </Button>
              </div>
            </form>
          </CardContent>
        </Card>
      )}

      {/* Table */}
            {/* Search + Filters */}
      {!isAdding && (
        <Card>
          <CardContent className="p-6">
            <div className="flex items-center gap-3 w-full">
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => setShowFilterModal(true)}
                className="flex-shrink-0"
                title="Filter by Branch / Department"
              >
                <Filter className="w-4 h-4 mr-1" />
                Filter
                {(selectedFilterBranchIds.length + selectedFilterDepartmentIds.length) > 0 && (
                  <Badge variant="secondary" className="ml-2">
                    {selectedFilterBranchIds.length + selectedFilterDepartmentIds.length}
                  </Badge>
                )}
              </Button>

              <div className="relative flex-1 min-w-0">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 w-4 h-4" />
                <Input
                  placeholder="Search termination records..."
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  className="pl-10 w-full"
                />
              </div>

              <Badge variant="secondary" className="px-3 py-1 flex-shrink-0">
                {filtered.length} records
              </Badge>
            </div>
          </CardContent>
        </Card>
      )}

      {showFilterModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4">
          <div className="w-full max-w-3xl rounded-xl bg-white shadow-xl border">
            <div className="flex items-center justify-between border-b px-5 py-4">
              <div className="flex items-center gap-2">
                <div className="h-9 w-9 rounded-lg bg-indigo-50 flex items-center justify-center">
                  <Filter className="w-4 h-4 text-indigo-600" />
                </div>
                <div>
                  <h3 className="text-base font-semibold text-gray-900">
                    Filter Termination Records
                  </h3>
                  <p className="text-xs text-gray-500">
                    Filter by branch and department
                  </p>
                </div>
              </div>

              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={() => setShowFilterModal(false)}
              >
                <X className="w-4 h-4" />
              </Button>
            </div>

            <div className="p-5 space-y-6 max-h-[70vh] overflow-y-auto">
              <div className="flex items-center justify-between">
                <Badge variant="secondary">
                  {selectedFilterBranchIds.length} branches,{" "}
                  {selectedFilterDepartmentIds.length} departments selected
                </Badge>

                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={clearAllFilters}
                >
                  <RotateCcw className="w-4 h-4 mr-1" />
                  Clear
                </Button>
              </div>

              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <Label>Branches</Label>

                  {user?.role !== "BRANCH_ADMIN" && (
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={selectAllFilterBranches}
                      disabled={branchList.length === 0}
                    >
                      Select All Branches
                    </Button>
                  )}
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  {branchList.length === 0 ? (
                    <p className="text-sm text-gray-500 col-span-full py-4 text-center">
                      No branches found
                    </p>
                  ) : (
                    branchList.map((b) => (
                      <label
                        key={b.id}
                        className="flex items-center gap-2 rounded-md border px-3 py-2 text-sm hover:bg-gray-50 cursor-pointer"
                      >
                        <input
                          type="checkbox"
                          checked={selectedFilterBranchIds.includes(String(b.id))}
                          disabled={user?.role === "BRANCH_ADMIN"}
                          onChange={() => toggleFilterBranch(String(b.id))}
                        />
                        <span className="truncate">{b.branchName}</span>
                      </label>
                    ))
                  )}
                </div>
              </div>

              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <Label>Departments</Label>

                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={selectAllFilterDepartments}
                    disabled={visibleFilterDepartments.length === 0}
                  >
                    Select All Departments
                  </Button>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  {visibleFilterDepartments.length === 0 ? (
                    <p className="text-sm text-gray-500 col-span-full py-4 text-center">
                      No departments found
                    </p>
                  ) : (
                    visibleFilterDepartments.map((d) => (
                      <label
                        key={d.id}
                        className="flex items-center gap-2 rounded-md border px-3 py-2 text-sm hover:bg-gray-50 cursor-pointer"
                      >
                        <input
                          type="checkbox"
                          checked={selectedFilterDepartmentIds.includes(String(d.id))}
                          onChange={() => toggleFilterDepartment(String(d.id))}
                        />
                        <span className="truncate">{d.departmentName}</span>
                      </label>
                    ))
                  )}
                </div>
              </div>
            </div>

            <div className="flex justify-end gap-2 border-t px-5 py-4">
              <Button
                type="button"
                variant="outline"
                onClick={() => setShowFilterModal(false)}
              >
                Cancel
              </Button>

              <Button
                type="button"
                onClick={() => setShowFilterModal(false)}
              >
                Apply Filter
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Table */}
      {!isAdding && (
        <Card>
          <CardHeader>
            <CardTitle>Termination List</CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Employee</TableHead>
                  <TableHead>Exit Type</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Initiated On</TableHead>
                  <TableHead>Notice Period</TableHead>
                  <TableHead>Last Working Day</TableHead>
                  <TableHead>Employee Status</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>

              <TableBody>
                {loading ? (
                  <TableBodySkeleton cols={8} />
                ) : filtered.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={8} className="text-center py-8 text-gray-500">
                      No termination records found
                    </TableCell>
                  </TableRow>
                ) : (
                filtered.map((t) => (
                  <TableRow key={t.id}>
                    <TableCell>
                      {t.employee?.employeeFirstName}{" "}
                      {t.employee?.employeeLastName}
                    </TableCell>

                    <TableCell>{t.exitType}</TableCell>

                    <TableCell>
                      <Badge
                        className={
                          t.exitStatus === "DRAFT"
                            ? "bg-yellow-100 text-yellow-700"
                            : t.exitStatus === "APPROVED"
                            ? "bg-red-100 text-red-700"
                            : "bg-green-100 text-green-700"
                        }
                      >
                        {t.exitStatus}
                      </Badge>
                    </TableCell>

                    <TableCell>
                      {t.noticeStartDate
                        ? new Date(t.noticeStartDate).toLocaleDateString()
                        : "-"}
                    </TableCell>

                    <TableCell>
                      {t.noticeDays != null ? `${t.noticeDays} days` : "-"}
                    </TableCell>

                    <TableCell>
                      {t.lastWorkingDay
                        ? new Date(t.lastWorkingDay).toLocaleDateString()
                        : "-"}
                    </TableCell>

                    <TableCell>
                      {(() => {
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
                      })()}
                    </TableCell>

                    <TableCell className="text-right space-x-2">
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
                        <Button
                          size="sm"
                          onClick={() => handleFinal(t.id)}
                        >
                          Final Settle
                        </Button>
                      )}
                    </TableCell>
                  </TableRow>
                ))
                )}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
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

            <div className="bg-yellow-50 border border-yellow-200 p-3 rounded text-sm text-yellow-700 flex gap-2">
              <AlertTriangle className="w-4 h-4 mt-0.5" />
              Approving will disable login and mark employee as EXITED.
            </div>
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
