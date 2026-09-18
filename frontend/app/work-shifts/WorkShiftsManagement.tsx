"use client";

import { useState, useEffect, useMemo } from "react";
import { hasModuleWriteAccess, isCompanyAdminLikeRole } from "@/lib/companyAccess";
import { Button } from "../components/ui/button";
import { Input } from "../components/ui/input";
import { Label } from "../components/ui/label";
import { FormDrawer } from "../components/ui/form-drawer";
import { Badge } from "../components/ui/badge";
import { Plus, CalendarCheck2 } from "lucide-react";
import { PageHeader } from "../components/app/page-header";
import { FilterBar, FilterSelect } from "../components/app/filter-bar";
import { EntityListShell } from "../components/app/entity-list-shell";
import type { DataTableColumn } from "../components/app/data-table";
import { EntityRowActions } from "../components/app/entity-row-actions";
import { useClientTable, sortRows } from "../hooks/use-client-table";
import { SearchSuggestInput } from "../components/SearchSuggestInput";
import { CompanyBranchField } from "../components/app/company-branch-field";
import { useCurrentUser } from "../hooks/useCurrentUser";
import { toast } from "sonner";
import { getWorkShiftTypeLabel } from "../utils/workShiftLabels";
import { getSidebarContext } from "../utils/sidebarContext";
import {
  canDesktopManagerManage,
  filterCompanyScopedRecords,
  resolveScopeUserMapping,
  resolveScopedCompanyId,
} from "../utils/scopeContext";

interface ShiftRow {
  startTime: string;
  endTime: string;
  breakStart: string;
  breakEnd: string;
}

interface DaySchedule {
  day: string;
  isWeeklyOff: boolean;
  work: ShiftRow;
  ot: ShiftRow;
}

interface WorkShift {
  id: string;
  serviceProviderID?: number;
  companyID?: number;
  branchesID?: number;
  serviceProvider?: string;
  companyName?: string;
  branchName?: string;
  workShiftName: string;
  isFlexible?: boolean;
  isRotating?: boolean;
  workShiftType?: string;
  breakTimeMin?: number;
  weeklySchedule: DaySchedule[];
  createdAt: string;
}

interface SelectedItem {
  display: string;
  value: number;
  item: any;
}

const DAYS_OF_WEEK = [
  "Monday",
  "Tuesday",
  "Wednesday",
  "Thursday",
  "Friday",
  "Saturday",
  "Sunday",
];

export function WorkShiftsManagement() {
  const [listLoading, setListLoading] = useState(true);
  const [workShifts, setWorkShifts] = useState<WorkShift[]>([]);
  const table = useClientTable("workShiftName");
  const [branchFilter, setBranchFilter] = useState("ALL");
  const [branchFilterList, setBranchFilterList] = useState<any[]>([]);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingWorkShift, setEditingWorkShift] = useState<WorkShift | null>(
    null
  );
  const user = useCurrentUser();
  const canManage =
    user?.role === "SUPERADMIN" ||
    user?.role === "SERVICE_PROVIDER" ||
    isCompanyAdminLikeRole(user?.role) ||
    user?.role === "BRANCH_ADMIN" ||
    canDesktopManagerManage(user) ||
    hasModuleWriteAccess("WORK_SHIFTS");
  const [currentUserMapping, setCurrentUserMapping] = useState<any>(null);


  const [formData, setFormData] = useState({
    serviceProvider: "",
    companyName: "",
    branchName: "",
    workShiftName: "",
    workShiftType: "",
    isFlexible: false,
    isRotating: false,
    serviceProviderID: undefined as number | undefined,
    companyID: undefined as number | undefined,
    branchesID: undefined as number | undefined,
    weeklySchedule: DAYS_OF_WEEK.map((day) => ({
      day,
      isWeeklyOff: false,
      work: { startTime: "10:00", endTime: "19:00", breakStart: "14:00", breakEnd: "15:00" },
      ot: { startTime: "", endTime: "", breakStart: "", breakEnd: "" },
    })),
  });

  // Utility to format Prisma Date/Time into "HH:mm"
  const formatDbTime = (value: string | Date | null | undefined): string => {
    if (!value) return "";

    // Already "HH:mm"
    if (typeof value === "string" && /^\d{2}:\d{2}$/.test(value)) {
      return value;
    }

    // Try parsing as Date
    const d = new Date(value as any);
    if (isNaN(d.getTime())) return "";

    // Force to UTC time string
    return d.toISOString().substring(11, 16); // "HH:mm"
  };

  // API functions for search and suggest
  const BACKEND_URL =
    process.env.NEXT_PUBLIC_BACKEND_URL || "/backend";


  // Load mapping for MANAGER
  useEffect(() => {
    if (user?.role !== "SERVICE_PROVIDER" && user?.role !== "BRANCH_ADMIN") return;

    if (user?.role === "SERVICE_PROVIDER") {
      (async () => {
        const res = await fetch("/backend/users");
        const list = await res.json();
        const me = list.find((u: any) => u.username === user.username);
        setCurrentUserMapping(me || null);
      })();
    } else if (user?.role === "BRANCH_ADMIN") {
      setCurrentUserMapping(user);
    }
  }, [user]);

  // Auto-inject mapped IDs for MANAGER / BRANCH_ADMIN
  useEffect(() => {
    if (user?.role === "SERVICE_PROVIDER" && currentUserMapping) {
      const ctx = getSidebarContext();
      const companyID = ctx?.companyID ?? currentUserMapping.companyID;
      const sameCompany = Number(companyID) === Number(currentUserMapping.companyID);
      setFormData((p) => ({
        ...p,
        serviceProviderID: currentUserMapping.serviceProviderID,
        companyID,
        branchesID: sameCompany ? currentUserMapping.branchesID : undefined,
      }));
    } else if (user?.role === "BRANCH_ADMIN" && currentUserMapping) {
      setFormData((p) => ({
        ...p,
        serviceProviderID: currentUserMapping.serviceProviderID ?? null,
        companyID: currentUserMapping.companyID ?? null,
        branchesID: currentUserMapping.branchesID ?? null,
      }));
    }
  }, [user, currentUserMapping]);

  const fetchServiceProviders = async (query: string) => {
    try {
      const res = await fetch(`${BACKEND_URL}/service-provider`, {
        cache: "no-store",
      });
      const data = await res.json();
      const q = query.toLowerCase();
      return Array.isArray(data)
        ? data.filter((item: any) =>
          (item?.companyName || "").toLowerCase().includes(q)
        )
        : [];
    } catch (error) {
      console.error("Error fetching service providers:", error);
      toast.error("Failed to load data.");
      return [];
    }
  };

  const fetchCompanies = async (query: string) => {
    try {
      const spID =
        user?.role === "SERVICE_PROVIDER"
          ? currentUserMapping?.serviceProviderID
          : formData.serviceProviderID;

      if (!spID) return [];

      const res = await fetch(`${BACKEND_URL}/company`, { cache: "no-store" });
      const data = await res.json();
      const q = query.toLowerCase();

      return Array.isArray(data)
        ? data.filter(
          (item: any) =>
            item.serviceProviderID === spID &&
            (item.companyName || "").toLowerCase().includes(q)
        )
        : [];
    } catch (error) {
      console.error("Error fetching companies:", error);
      toast.error("Failed to load data.");
      return [];
    }
  };


 const fetchBranches = async (query: string) => {
  try {
    const activeCompanyID =
      resolveScopedCompanyId(user) ??
      formData.companyID ??
      currentUserMapping?.companyID ??
      user?.companyID ??
      null;

    if (!activeCompanyID) return [];

    const res = await fetch(`${BACKEND_URL}/branches`, { cache: "no-store" });
    const data = await res.json();
    const q = query.toLowerCase();

    let filtered = Array.isArray(data) ? data : [];

    filtered = filtered.filter(
      (item: any) => Number(item.companyID) === Number(activeCompanyID)
    );

    if (user?.role === "BRANCH_ADMIN") {
      const branchID = currentUserMapping?.branchesID ?? user?.branchesID;

      if (branchID) {
        filtered = filtered.filter(
          (item: any) => Number(item.id) === Number(branchID)
        );
      }
    }

    return filtered.filter((item: any) =>
      (item.branchName || "").toLowerCase().includes(q)
    ).reduce((acc: any[], item: any) => {
      const id = Number(item.id);
      if (!Number.isFinite(id) || acc.some((x) => Number(x.id) === id)) return acc;
      acc.push(item);
      return acc;
    }, []);
  } catch (error) {
    console.error("Error fetching branches:", error);
    toast.error("Failed to load data.");
    return [];
  }
};

  // Load work shifts on component mount
  useEffect(() => {
    if (user) {
      loadWorkShifts();
      loadBranchFilterList();
    }
  }, [user]);

  useEffect(() => {
const handler = () => {
  setBranchFilter(user?.role === "BRANCH_ADMIN" ? String(user?.branchesID ?? "ALL") : "ALL");
  setFormData((p) => ({
    ...p,
    branchName: "",
    branchesID: undefined,
  }));

  if (user) {
    loadWorkShifts();
    loadBranchFilterList();
  }
};

  const sidebarPageClickHandler = (e: any) => {
    if (e.detail?.path === "/work-shifts") {
      closeWorkShiftPagePanels();
      if (user) loadWorkShifts();
    }
  };

  window.addEventListener("sidebar-context-changed", handler);
  window.addEventListener("app-data-refresh", handler);
  window.addEventListener("sidebar-main-page-click", sidebarPageClickHandler);

  return () => {
    window.removeEventListener("sidebar-context-changed", handler);
    window.removeEventListener("app-data-refresh", handler);
    window.removeEventListener("sidebar-main-page-click", sidebarPageClickHandler);
  };
}, [user]);

  const loadBranchFilterList = async () => {
  try {
    const res = await fetch(`${BACKEND_URL}/branches`, { cache: "no-store" });
    const data = await res.json();

    const mapping = await resolveScopeUserMapping(user!);
    if (mapping) setCurrentUserMapping(mapping);

    const activeCompanyID =
      resolveScopedCompanyId(user) ??
      mapping?.companyID ??
      user?.companyID ??
      null;

    let filtered = Array.isArray(data) ? data : [];

    if (activeCompanyID) {
      filtered = filtered.filter(
        (b: any) => Number(b.companyID) === Number(activeCompanyID)
      );
    }

    if (user?.role === "BRANCH_ADMIN") {
      const branchID = mapping?.branchesID ?? user?.branchesID;

      if (branchID) {
        filtered = filtered.filter(
          (b: any) => Number(b.id) === Number(branchID)
        );
        setBranchFilter(String(branchID));
      }
    }

    setBranchFilterList(filtered);
  } catch (e) {
    console.error(e);
    setBranchFilterList([]);
  }
};

  const loadWorkShifts = async () => {
    setListLoading(true);
    try {
      const scopedId = resolveScopedCompanyId(user);
      const q = scopedId ? `?companyID=${scopedId}` : "";
      const res = await fetch(`${BACKEND_URL}/work-shift${q}`, { cache: "no-store" });
      const data = await res.json();
      const all = Array.isArray(data) ? data : [];

      // Map & normalize shifts
      const mapped = all.map((shift: any) => {
        // Group workShiftDay records by weekDay
        const dayMap: Record<string, DaySchedule> = {};
        DAYS_OF_WEEK.forEach((d) => {
          dayMap[d] = {
            day: d,
            isWeeklyOff: false,
            work: { startTime: "10:00", endTime: "19:00", breakStart: "14:00", breakEnd: "15:00" },
            ot: { startTime: "", endTime: "", breakStart: "", breakEnd: "" },
          };
        });

        (shift.workShiftDay || []).forEach((rec: any) => {
          const day = rec.weekDay;
          if (!day || !dayMap[day]) return;
          const st = formatDbTime(rec.startTime) || "";
          const et = formatDbTime(rec.endTime) || "";
          const bs = rec.breakStart || "";
          const be = rec.breakEnd || "";
          const type = rec.shiftType || "WORK";

          if (type === "OT") {
            dayMap[day].ot = { startTime: st, endTime: et, breakStart: bs, breakEnd: be };
          } else {
            dayMap[day].work = { startTime: st, endTime: et, breakStart: bs, breakEnd: be };
            dayMap[day].isWeeklyOff = rec.weeklyOff || false;
          }
        });

        return {
          id: shift.id.toString(),
          serviceProviderID: shift.serviceProviderID,
          companyID: shift.companyID,
          branchesID: shift.branchesID,
          serviceProvider: shift.serviceProvider?.companyName || "",
          companyName: shift.company?.companyName || "",
          branchName: shift.branches?.branchName || "",
          workShiftName: shift.workShiftName,
          isFlexible: shift.isFlexible === true,
          isRotating: shift.isRotating === true,
          workShiftType: shift.workShiftType || "",
          breakTimeMin: shift.breakTimeMin || 0,
          weeklySchedule: DAYS_OF_WEEK.map((d) => dayMap[d]),
          createdAt: shift.createdAt
            ? new Date(shift.createdAt).toISOString().split("T")[0]
            : new Date().toISOString().split("T")[0],
        };
      });

 const mapping = await resolveScopeUserMapping(user!);
if (mapping) setCurrentUserMapping(mapping);

let filtered = await filterCompanyScopedRecords(mapped, user);

if (user?.role === "BRANCH_ADMIN") {
  const branchID = mapping?.branchesID ?? user?.branchesID;

  if (branchID) {
    filtered = filtered.filter(
      (w: any) => Number(w.branchesID) === Number(branchID)
    );
  }
}

setWorkShifts(filtered);

    } catch (error) {
      console.error("Error loading work shifts:", error);
      toast.error("Failed to load data.");
      setWorkShifts([]);
    } finally {
      setListLoading(false);
    }
  };



  const filteredWorkShifts = useMemo(() => {
    const q = table.search.trim().toLowerCase();

    let list = workShifts.filter((workShift) => {
      const matchesBranch =
        branchFilter === "ALL" || branchFilter === String(workShift.branchesID ?? "");

      const matchesSearch =
        !q ||
        [
          workShift.workShiftName,
          workShift.workShiftType,
          workShift.serviceProvider,
          workShift.companyName,
          workShift.branchName,
          workShift.isFlexible ? "flexible" : "",
          workShift.isRotating ? "rotating" : "",
        ]
          .filter(Boolean)
          .map((f) => String(f ?? "").toLowerCase())
          .some((f) => f.includes(q));

      return matchesBranch && matchesSearch;
    });

    return sortRows(list, table.sortBy, table.sortDir, (row, key) => {
      const ws = row as WorkShift;
      if (key === "workShiftName") return ws.workShiftName ?? "";
      if (key === "branchName") return ws.branchName ?? "";
      if (key === "shiftType") {
        return getWorkShiftTypeLabel(ws.isFlexible, ws.isRotating);
      }
      if (key === "weeklyOff") {
        return ws.weeklySchedule.filter((d) => d.isWeeklyOff).map((d) => d.day).join(", ");
      }
      if (key === "createdAt") return ws.createdAt ?? "";
      return "";
    });
  }, [workShifts, table.search, table.sortBy, table.sortDir, branchFilter]);

  const branchFilterOptions = useMemo(
    () => [
      { value: "ALL", label: "All branches" },
      ...branchFilterList.map((b: any) => ({
        value: String(b.id),
        label: b.branchName || `Branch #${b.id}`,
      })),
    ],
    [branchFilterList],
  );

  const calcMinutes = (start: string, end: string): number => {
    if (!start || !end) return 0;
    const [sh, sm] = start.split(":").map(Number);
    const [eh, em] = end.split(":").map(Number);
    let diff = (eh * 60 + em) - (sh * 60 + sm);
    if (diff < 0) diff += 24 * 60; // handle cross-midnight (e.g. 23:00 → 00:00)
    return diff;
  };

  const formatHrMin = (totalMin: number): string => {
    if (totalMin <= 0) return "0h 0m";
    const h = Math.floor(totalMin / 60);
    const m = totalMin % 60;
    return `${h}h ${m}m`;
  };

  const getBreakMin = (row: ShiftRow): number => calcMinutes(row.breakStart, row.breakEnd);
  const getWorkMin = (row: ShiftRow): number => {
    const span = calcMinutes(row.startTime, row.endTime);
    const brk = getBreakMin(row);
    return Math.max(0, span - brk);
  };

  const handleShiftRowChange = (
    dayIndex: number,
    rowType: "work" | "ot",
    field: keyof ShiftRow,
    value: string,
  ) => {
    setFormData((prev) => {
      const updated = [...prev.weeklySchedule];
      updated[dayIndex] = {
        ...updated[dayIndex],
        [rowType]: { ...updated[dayIndex][rowType], [field]: value },
      };
      return { ...prev, weeklySchedule: updated };
    });
  };

  const handleWeeklyOffChange = (dayIndex: number, isWeeklyOff: boolean) => {
    setFormData((prev) => {
      const updated = [...prev.weeklySchedule];
      updated[dayIndex] = { ...updated[dayIndex], isWeeklyOff };
      return { ...prev, weeklySchedule: updated };
    });
  };

  const handleIsRotatingChange = (checked: boolean) => {
    setFormData(prev => ({
      ...prev,
      isRotating: checked,
      weeklySchedule: checked 
        ? prev.weeklySchedule.map(day => ({ ...day, isWeeklyOff: false }))
        : prev.weeklySchedule
    }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    // Validation
    const validationErrors: string[] = [];
    if (!formData.workShiftName?.trim()) validationErrors.push("Work Shift Name is required");
    if (validationErrors.length > 0) {
      validationErrors.forEach(msg => toast.error(msg));
      return;
    }

    try {
      const workShiftDays: any[] = [];
      formData.weeklySchedule.forEach((day) => {
        // WORK row
        workShiftDays.push({
          weekDay: day.day,
          shiftType: "WORK",
          weeklyOff: day.isWeeklyOff,
          startTime: day.work.startTime || null,
          endTime: day.work.endTime || null,
          breakStart: day.work.breakStart || null,
          breakEnd: day.work.breakEnd || null,
          totalMinutes: day.isWeeklyOff ? 0 : getWorkMin(day.work),
        });
        // OT row (only if times are filled)
        if (day.ot.startTime && day.ot.endTime) {
          workShiftDays.push({
            weekDay: day.day,
            shiftType: "OT",
            weeklyOff: false,
            startTime: day.ot.startTime || null,
            endTime: day.ot.endTime || null,
            breakStart: day.ot.breakStart || null,
            breakEnd: day.ot.breakEnd || null,
            totalMinutes: getWorkMin(day.ot),
          });
        }
      });

      const ctx = getSidebarContext();

const finalServiceProviderID =
  ctx?.serviceProviderID ??
  formData.serviceProviderID ??
  currentUserMapping?.serviceProviderID ??
  user?.serviceProviderID ??
  null;

const finalCompanyID =
  resolveScopedCompanyId(user) ??
  formData.companyID ??
  currentUserMapping?.companyID ??
  user?.companyID ??
  null;

const finalBranchesID =
  user?.role === "BRANCH_ADMIN"
    ? formData.branchesID ?? currentUserMapping?.branchesID ?? user?.branchesID ?? null
    : formData.branchesID ?? null;

const workShiftData = {
  serviceProviderID: finalServiceProviderID,
  companyID: finalCompanyID,
  branchesID: finalBranchesID,
  
  workShiftName: formData.workShiftName,
        isFlexible: formData.isFlexible === true,
        isRotating: formData.isRotating === true,
        workShiftType: formData.workShiftType,
        isActive: "1",
        breakTimeMin: 0,
        workShiftDays,
      };

      const url = editingWorkShift
        ? `${BACKEND_URL}/work-shift/${editingWorkShift.id}`
        : `${BACKEND_URL}/work-shift`;
      const method = editingWorkShift ? "PATCH" : "POST";

      const res = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(workShiftData),
      });
      if (!res.ok) {
        throw new Error(`Failed to save work shift: ${res.status}`);
      }

await loadWorkShifts();
await loadBranchFilterList();
      resetForm();
      setIsDialogOpen(false);
      toast.success(editingWorkShift ? "Updated successfully" : "Created successfully");
    } catch (error) {
      console.error("Error saving work shift:", error);
      toast.error("Failed to save. Please try again.");
    }
  };


  const resetForm = () => {
    const ctx = getSidebarContext();
    setFormData({
      serviceProvider: ctx?.serviceProviderName ?? "",
      companyName: ctx?.companyName ?? "",
      branchName: "",
      workShiftName: "",
      isFlexible: false,
      isRotating: false,
      workShiftType: "",
      serviceProviderID: ctx?.serviceProviderID ?? undefined,
      companyID: resolveScopedCompanyId(user) ?? ctx?.companyID ?? undefined,
      branchesID: undefined,
      weeklySchedule: DAYS_OF_WEEK.map((day) => ({
        day,
        isWeeklyOff: false,
        work: { startTime: "10:00", endTime: "19:00", breakStart: "14:00", breakEnd: "15:00" },
        ot: { startTime: "", endTime: "", breakStart: "", breakEnd: "" },
      })),
    });
    setEditingWorkShift(null);
  };

  const closeWorkShiftPagePanels = () => {
  resetForm();

  setIsDialogOpen(false);
  setEditingWorkShift(null);
};

  const handleServiceProviderSelect = (selected: SelectedItem) => {
    setFormData(prev => ({
      ...prev,
      serviceProvider: selected.display,
      serviceProviderID: selected.value,
      companyName: "",
      companyID: undefined,
      branchName: "",
      branchesID: undefined,
    }));
  };

  const handleCompanySelect = (selected: SelectedItem) => {
    setFormData(prev => ({
      ...prev,
      companyName: selected.display,
      companyID: selected.value,
      branchName: "",
      branchesID: undefined,
    }));
  };

  const handleBranchSelect = (selected: SelectedItem) => {
    setFormData((prev) => ({
      ...prev,
      branchName: selected.display,
      branchesID: selected.value,
    }));
  };

  const handleEdit = (workShift: WorkShift) => {
    setFormData({
      serviceProvider: workShift.serviceProvider || "",
      companyName: workShift.companyName || "",
      branchName: workShift.branchName || "",
      workShiftName: workShift.workShiftName,
      isFlexible: workShift.isFlexible === true,
      isRotating: workShift.isRotating === true,
      workShiftType: workShift.workShiftType || "",
      serviceProviderID: workShift.serviceProviderID,
      companyID: workShift.companyID,
      branchesID: workShift.branchesID,
      weeklySchedule: workShift.weeklySchedule,
    });
    setEditingWorkShift(workShift);
    setIsDialogOpen(true);
  };

  const handleDelete = async (id: string) => {
    try {
      const res = await fetch(`${BACKEND_URL}/work-shift/${id}`, {
        method: "DELETE",
      });
      if (!res.ok) {
        throw new Error(`Failed to delete work shift: ${res.status}`);
      }
      await loadWorkShifts();
      toast.success("Deleted successfully");
    } catch (error) {
      console.error("Error deleting work shift:", error);
      toast.error("Failed to delete. Please try again.");
    }
  };

  const workShiftColumns = useMemo((): DataTableColumn<WorkShift>[] => [
    {
      key: "workShiftName",
      header: "Name",
      sortable: true,
      colSpan: 3,
      cell: (ws) => <span className="font-medium">{ws.workShiftName || "—"}</span>,
    },
    { key: "branchName", header: "Branch", sortable: true, colSpan: 2, cell: (ws) => ws.branchName || "—" },
    {
      key: "shiftType",
      header: "Shift Type",
      sortable: true,
      colSpan: 2,
      cell: (ws) => (
        <Badge variant="outline">
          {getWorkShiftTypeLabel(ws.isFlexible, ws.isRotating)}
        </Badge>
      ),
    },
    {
      key: "weeklyOff",
      header: "Weekly Off",
      sortable: true,
      colSpan: 3,
      cell: (ws) =>
        ws.weeklySchedule.filter((d) => d.isWeeklyOff).map((d) => d.day).join(", ") || "—",
    },
    { key: "createdAt", header: "Created", sortable: true, colSpan: 2, cell: (ws) => ws.createdAt || "—" },
    {
      key: "actions",
      header: "Actions",
      colSpan: 2,
      align: "right",
      cell: (ws) => (
        <EntityRowActions
          onEdit={canManage ? () => handleEdit(ws) : undefined}
          onDelete={canManage ? () => handleDelete(ws.id) : undefined}
        />
      ),
    },
  ], [canManage]);

  return (
    <div className="space-y-6 w-full max-w-none animate-fade-in page-content-enter">
      <PageHeader
        icon={CalendarCheck2}
        title="Work Shifts"
        description="Manage work shifts and schedules"
        actions={
          canManage && !isDialogOpen ? (
            <Button onClick={() => { closeWorkShiftPagePanels(); setIsDialogOpen(true); }}>
              <Plus className="w-4 h-4 mr-1" />
              Add Work Shift
            </Button>
          ) : null
        }
      />

      <FormDrawer
        open={isDialogOpen}
        onOpenChange={setIsDialogOpen}
        title={editingWorkShift ? "Edit Work Shift" : "Add New Work Shift"}
        description={editingWorkShift
                  ? "Update the work shift information below."
                  : "Fill in the details to add a new work shift."}
      >
            <form
              onSubmit={(e) => {
                e.preventDefault();
                handleSubmit(e);
              }}
              className="space-y-6"
            >
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                {/* SP + Company auto-filled from sidebar context */}
                {false && (
                  <>
                    <SearchSuggestInput
                      label="Service Provider"
                      placeholder="Select Service Provider"
                      value={formData.serviceProvider}
                      onChange={(value) =>
                        setFormData((prev) => ({ ...prev, serviceProvider: value }))
                      }
                      onSelect={handleServiceProviderSelect}
                      fetchData={fetchServiceProviders}
                      displayField="companyName"
                      valueField="id"
                      required
                    />

                    <SearchSuggestInput
                      label="Company Name"
                      placeholder="Select Company"
                      value={formData.companyName}
                      onChange={(value) =>
                        setFormData((prev) => ({ ...prev, companyName: value }))
                      }
                      onSelect={handleCompanySelect}
                      fetchData={fetchCompanies}
                      displayField="companyName"
                      valueField="id"
                      required
                    />
                  </>
                )}

                {/* MANAGER → Only Branch input */}
{(user?.role === "SERVICE_PROVIDER" ||
  isCompanyAdminLikeRole(user?.role) ||
  user?.role === "BRANCH_ADMIN") && (
                  <CompanyBranchField
                    label="Branch Name"
                    placeholder="Select Branch"
                    value={formData.branchName}
                    onChange={(value) =>
                      setFormData((prev) => ({ ...prev, branchName: value }))
                    }
                    onSelect={(selected) =>
                      setFormData((p) => ({
                        ...p,
                        branchName: selected.display,
                        branchesID: selected.value,
                      }))
                    }
               fetchData={fetchBranches}
                    displayField="branchName"
                    valueField="id"
                    companyID={formData.companyID ?? resolveScopedCompanyId(user) ?? currentUserMapping?.companyID ?? user?.companyID}
                    required
                  />
                )}

                {/* SUPERADMIN → Branch input */}
                {user?.role === "SUPERADMIN" && (
                  <CompanyBranchField
  label="Branch Name"
  placeholder="Select Branch"
  value={formData.branchName}
  onChange={(value) =>
    setFormData((prev) => ({ ...prev, branchName: value }))
  }
  onSelect={(selected) =>
    setFormData((p) => ({
      ...p,
      branchName: selected.display,
      branchesID: selected.value,
    }))
  }
  fetchData={fetchBranches}
  displayField="branchName"
  valueField="id"
  companyID={formData.companyID}
  required
/>
                )}
              </div>

              <div className="space-y-2">
                <Label htmlFor="workShiftName">Work Shift Name *</Label>
                <Input
                  id="workShiftName"
                  value={formData.workShiftName}
                  onChange={(e) =>
                    setFormData((prev) => ({
                      ...prev,
                      workShiftName: e.target.value,
                    }))
                  }
                  placeholder="Enter work shift name"
                  required
                />
              </div>

              {/* New Checkboxes Section */}
              <div className="space-y-4 border rounded-lg p-4 bg-gray-50">
                <h3 className="text-md font-semibold">Shift Configuration</h3>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="flex items-center space-x-3">
                    <input
                      type="checkbox"
                      id="isFlexible"
                      checked={formData.isFlexible}
                      onChange={(e) =>
                        setFormData((prev) => ({
                          ...prev,
                          isFlexible: e.target.checked,
                        }))
                      }
                      className="w-4 h-4 text-blue-600 bg-gray-100 border-gray-300 rounded focus:ring-blue-500"
                    />
                    <Label htmlFor="isFlexible" className="text-sm font-normal">
                      Flexible Shift
                    </Label>
                  </div>
                  <div className="flex items-center space-x-3">
                    <input
                      type="checkbox"
                      id="isRotating"
                      checked={formData.isRotating}
                      onChange={(e) => handleIsRotatingChange(e.target.checked)}
                      className="w-4 h-4 text-blue-600 bg-gray-100 border-gray-300 rounded focus:ring-blue-500"
                    />
                    <Label htmlFor="isRotating" className="text-sm font-normal">
                      Rotating Shift
                    </Label>
                  </div>
                </div>
                {formData.isFlexible && (
                  <p className="text-xs text-amber-600 bg-amber-50 p-2 rounded">
                    ⚠️ Flexible shifts count total working hours. Latemarks and shift timing are not bound to the employee.
                  </p>
                )}
                {formData.isRotating && (
                  <p className="text-xs text-amber-600 bg-amber-50 p-2 rounded">
                    ⚠️ Rotating shifts cannot have weekly off days. Weekly off checkboxes are disabled.
                  </p>
                )}
                <p className="text-xs text-gray-600 bg-white border border-gray-200 rounded px-2 py-1.5">
                  Type:{" "}
                  <span className="font-semibold text-gray-900">
                    {getWorkShiftTypeLabel(formData.isFlexible, formData.isRotating)}
                  </span>
                </p>
              </div>

              {/* Weekly Schedule */}
              <div className="space-y-4">
                <h3 className="text-lg font-semibold">Default Working Hours</h3>
                <div className="overflow-x-auto">
                  <table className="w-full border-collapse border border-gray-300 text-sm">
                    <thead>
                      <tr className="bg-gray-50">
                        <th className="border border-gray-300 px-2 py-2 text-left font-medium w-[90px]">Day</th>
                        <th className="border border-gray-300 px-2 py-2 text-left font-medium w-[70px]">Type</th>
                        <th className="border border-gray-300 px-2 py-2 text-left font-medium">Start Time</th>
                        <th className="border border-gray-300 px-2 py-2 text-left font-medium">End Time</th>
                        <th className="border border-gray-300 px-2 py-2 text-left font-medium">Break Start Time</th>
                        <th className="border border-gray-300 px-2 py-2 text-left font-medium">Break End Time</th>
                        <th className="border border-gray-300 px-2 py-2 text-center font-medium w-[80px]">Total Break Time</th>
                        <th className="border border-gray-300 px-2 py-2 text-center font-medium w-[80px]">Total Work Time</th>
                        <th className="border border-gray-300 px-2 py-2 text-center font-medium w-[70px]">Weekly Off</th>
                      </tr>
                    </thead>
                    <tbody>
                      {formData.weeklySchedule.map((daySchedule, index) => {
                        const isOff = daySchedule.isWeeklyOff;
                        const disabled = false;
                        return (
                          <>
                            {/* WORK row */}
                            <tr key={`${daySchedule.day}-work`} className={isOff ? "bg-amber-50 border-l-4 border-l-amber-400" : ""}>
                              <td className="border border-gray-300 px-2 py-1.5 font-medium" rowSpan={2}>
                                <div className="flex flex-col gap-0.5">
                                  <span>{daySchedule.day}</span>
                                  {isOff && <span className="text-[10px] font-semibold text-amber-700 bg-amber-200 rounded px-1 py-0 leading-4 self-start">Off</span>}
                                </div>
                              </td>
                              <td className="border border-gray-300 px-2 py-1.5">
                                <Badge variant="outline" className="text-xs">Work</Badge>
                              </td>
                              <td className="border border-gray-300 px-1 py-1">
                                <Input type="time" value={daySchedule.work.startTime} onChange={(e) => handleShiftRowChange(index, "work", "startTime", e.target.value)} disabled={disabled} className="h-8 text-xs" />
                              </td>
                              <td className="border border-gray-300 px-1 py-1">
                                <Input type="time" value={daySchedule.work.endTime} onChange={(e) => handleShiftRowChange(index, "work", "endTime", e.target.value)} disabled={disabled} className="h-8 text-xs" />
                              </td>
                              <td className="border border-gray-300 px-1 py-1">
                                <Input type="time" value={daySchedule.work.breakStart} onChange={(e) => handleShiftRowChange(index, "work", "breakStart", e.target.value)} disabled={disabled} className="h-8 text-xs" />
                              </td>
                              <td className="border border-gray-300 px-1 py-1">
                                <Input type="time" value={daySchedule.work.breakEnd} onChange={(e) => handleShiftRowChange(index, "work", "breakEnd", e.target.value)} disabled={disabled} className="h-8 text-xs" />
                              </td>
                              <td className="border border-gray-300 px-2 py-1.5 text-center text-xs font-medium">
                                {isOff ? "—" : `${formatHrMin(getBreakMin(daySchedule.work))} (${getBreakMin(daySchedule.work)} mins)`}
                              </td>
                              <td className="border border-gray-300 px-2 py-1.5 text-center text-xs font-medium">
                                {isOff ? "—" : `${formatHrMin(getWorkMin(daySchedule.work))} (${getWorkMin(daySchedule.work)} mins)`}
                              </td>
                              <td className="border border-gray-300 px-2 py-1.5 text-center" rowSpan={2}>
                                <input
                                  type="checkbox"
                                  checked={daySchedule.isWeeklyOff}
                                  onChange={(e) => handleWeeklyOffChange(index, e.target.checked)}
                                  disabled={formData.isRotating}
                                  className="w-4 h-4 text-blue-600 bg-gray-100 border-gray-300 rounded focus:ring-blue-500 disabled:opacity-50 disabled:cursor-not-allowed"
                                />
                              </td>
                            </tr>
                            {/* OT row */}
                            <tr key={`${daySchedule.day}-ot`} className={isOff ? "bg-amber-50/60 border-l-4 border-l-amber-400" : "bg-orange-50/30"}>
                              <td className="border border-gray-300 px-2 py-1.5">
                                <Badge variant="outline" className="text-xs bg-orange-50 text-orange-700 border-orange-300">OT</Badge>
                              </td>
                              <td className="border border-gray-300 px-1 py-1">
                                <Input type="time" value={daySchedule.ot.startTime} onChange={(e) => handleShiftRowChange(index, "ot", "startTime", e.target.value)} disabled={disabled} className="h-8 text-xs" />
                              </td>
                              <td className="border border-gray-300 px-1 py-1">
                                <Input type="time" value={daySchedule.ot.endTime} onChange={(e) => handleShiftRowChange(index, "ot", "endTime", e.target.value)} disabled={disabled} className="h-8 text-xs" />
                              </td>
                              <td className="border border-gray-300 px-1 py-1">
                                <Input type="time" value={daySchedule.ot.breakStart} onChange={(e) => handleShiftRowChange(index, "ot", "breakStart", e.target.value)} disabled={disabled} className="h-8 text-xs" />
                              </td>
                              <td className="border border-gray-300 px-1 py-1">
                                <Input type="time" value={daySchedule.ot.breakEnd} onChange={(e) => handleShiftRowChange(index, "ot", "breakEnd", e.target.value)} disabled={disabled} className="h-8 text-xs" />
                              </td>
                              <td className="border border-gray-300 px-2 py-1.5 text-center text-xs font-medium">
                                {(isOff || !daySchedule.ot.startTime || !daySchedule.ot.endTime) ? "—" : `${formatHrMin(getBreakMin(daySchedule.ot))} (${getBreakMin(daySchedule.ot)} mins)`}
                              </td>
                              <td className="border border-gray-300 px-2 py-1.5 text-center text-xs font-medium">
                                {(isOff || !daySchedule.ot.startTime || !daySchedule.ot.endTime) ? "—" : `${formatHrMin(getWorkMin(daySchedule.ot))} (${getWorkMin(daySchedule.ot)} mins)`}
                              </td>
                            </tr>
                          </>
                        );
                      })}
                    </tbody>
                    <tfoot>
                      <tr className="bg-gray-100 font-semibold">
                        <td colSpan={7} className="border border-gray-300 px-2 py-2 text-right text-sm">
                          Total Working Hours
                        </td>
                        <td className="border border-gray-300 px-2 py-2 text-center text-sm font-bold text-green-700">
                          {(() => {
                            const totalWorkMin = formData.weeklySchedule
                              .filter((d) => !d.isWeeklyOff)
                              .reduce((sum, d) => sum + getWorkMin(d.work), 0);
                            const hours = Math.floor(totalWorkMin / 60);
                            const mins = totalWorkMin % 60;
                            return `${hours}h ${mins}m (${totalWorkMin} mins)`;
                          })()}
                        </td>
                        <td className="border border-gray-300 px-2 py-2 text-center text-xs text-gray-500">
                          {/* Weekly Off indicator */}
                        </td>
                      </tr>
                      <tr className="bg-orange-50 font-semibold">
                        <td colSpan={7} className="border border-gray-300 px-2 py-2 text-right text-sm text-orange-700">
                          Total OT Working Hours
                        </td>
                        <td className="border border-gray-300 px-2 py-2 text-center text-sm font-bold text-orange-700">
                          {(() => {
                            const totalOTMin = formData.weeklySchedule
                              .filter((d) => !d.isWeeklyOff && d.ot.startTime && d.ot.endTime)
                              .reduce((sum, d) => sum + getWorkMin(d.ot), 0);
                            const hours = Math.floor(totalOTMin / 60);
                            const mins = totalOTMin % 60;
                            return totalOTMin > 0 ? `${hours}h ${mins}m (${totalOTMin} mins)` : "0h 0m (0 mins)";
                          })()}
                        </td>
                        <td className="border border-gray-300 px-2 py-2 text-center text-xs text-gray-500">
                          {/* OT indicator */}
                        </td>
                      </tr>
                    </tfoot>
                  </table>
                </div>
              </div>

              <div className="flex justify-end gap-3 pt-4">
                <Button
                  type="button"
                  variant="outline"
onClick={closeWorkShiftPagePanels}
                >
                  Cancel
                </Button>
                <Button type="submit" className="">
                  {editingWorkShift ? "Update Work Shift" : "Add Work Shift"}
                </Button>
              </div>
            </form>
      </FormDrawer>

      {!isDialogOpen && (<>
        <FilterBar
          search={{
            value: table.search,
            onChange: table.setSearch,
            placeholder: "Search code or name…",
          }}
          filters={
            <FilterSelect
              id="work-shifts-branch"
              value={branchFilter}
              onChange={setBranchFilter}
              options={branchFilterOptions}
              width="w-56"
              ariaLabel="Filter by branch"
            />
          }
        />

        <EntityListShell
          title="All work shifts"
          columns={workShiftColumns}
          rows={filteredWorkShifts}
          rowKey={(ws) => String(ws.id)}
          isLoading={listLoading}
          sortBy={table.sortBy}
          sortDir={table.sortDir}
          onSort={table.setSort}
          emptyIcon={CalendarCheck2}
          emptyTitle="No work shifts yet"
          emptyDescription="Create your first work shift to define default schedules."
          emptyAction={
            canManage ? (
              <Button onClick={() => { closeWorkShiftPagePanels(); setIsDialogOpen(true); }}>
                <Plus className="w-4 h-4 mr-1" /> Add Work Shift
              </Button>
            ) : undefined
          }
        />
      </>)}
    </div>
  );
}