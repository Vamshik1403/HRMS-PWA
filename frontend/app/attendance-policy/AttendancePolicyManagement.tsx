"use client";
import { TableBodySkeleton } from "../components/ui/TableBodySkeleton";

import { useState, useEffect } from "react";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "../components/ui/card";
import { Button } from "../components/ui/button";
import { Input } from "../components/ui/input";
import { Label } from "../components/ui/label";
import { FormDrawer } from "../components/ui/form-drawer";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "../components/ui/table";
import { Badge } from "../components/ui/badge";
import { Icon } from "@iconify/react";
import { Plus, Search, Edit, Trash2, Info, ArrowLeft } from "lucide-react";
import { SearchSuggestInput } from "../components/SearchSuggestInput";
import { useCurrentUser } from "../hooks/useCurrentUser";
import { toast } from "sonner";
import { getSidebarContext } from "../utils/sidebarContext";
import {
  canDesktopManagerManage,
  filterCompanyScopedRecords,
  resolveScopeUserMapping,
} from "../utils/scopeContext";


interface AttendancePolicy {
  id: string;
  serviceProviderID?: number;
  companyID?: number;
  branchesID?: number;
  serviceProvider?: string;
  companyName?: string;
  branchName?: string;
  attendancePolicyName: string;
  workingHoursType: string;
  checkin_begin_before_min: number;
  checkout_end_after_min: number;
  checkin_grace_time_min: number;
  min_work_hours_half_day_min: number;
  max_late_check_in_time: number;
  earlyCheckoutBeforeEndMin: number;
  markAs?: string;
  lateMarkCount?: string;
  lateMarkMarkAs?: string;
  lateMarkMarkCount?: string;
  maxLateCheckinMarkAs?: string;
  trimPreshiftMin?: number;
  trimPostshiftMin?: number;
  allow_self_mark_attendance: boolean;
  allow_manager_update_ot: boolean;
  max_ot_hours_per_day_min: number;
  countWorkhoursInMinutes?: boolean;
  overtimeApplicable: boolean;
  minOvertimeHrs: number;
  maxOvertimeHrs: number;
  overtimeTrimmingApply: boolean;
  checkoutGracePeriodForOvertimeTrimming: number;
  breakTimeForOT: number;
  otMealApply: boolean;
  minsForOTMealToken: number;
  minsForBreakTimeForMeal: number;
  createdAt: string;
}

interface SelectedItem {
  display: string;
  value: number;
  item: any;
}

export function AttendancePolicyManagement() {
  const [listLoading, setListLoading] = useState(true);
  const [policies, setPolicies] = useState<AttendancePolicy[]>([]);
  const [searchTerm, setSearchTerm] = useState("");
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingPolicy, setEditingPolicy] = useState<AttendancePolicy | null>(
    null
  );
  const user = useCurrentUser();
  const canManage = user?.role === "SUPERADMIN" || user?.role === "SERVICE_PROVIDER" || user?.role === "COMPANY_ADMIN" || user?.role === "BRANCH_ADMIN" || canDesktopManagerManage(user)
  const isEmployee = user?.role === "EMPLOYEE";

  const [currentUserMapping, setCurrentUserMapping] = useState<any>(null);

  const [formData, setFormData] = useState({
    serviceProvider: "",
    companyName: "",
    branchName: "",
    attendancePolicyName: "",
    serviceProviderID: undefined as number | undefined,
    companyID: undefined as number | undefined,
    branchesID: undefined as number | undefined,
    workingHoursType: "Fixed",
    checkin_begin_before_min: 0,
    checkout_end_after_min: 0,
    checkin_grace_time_min: 0,
    min_work_hours_half_day_min: 0,
    max_late_check_in_time: 0,
    earlyCheckoutBeforeEndMin: 0,
    markAs: "" as "Absent" | "Half Day" | "",
    lateMarkCount: "",
    lateMarkMarkAs: "" as "Absent" | "Half Day" | "",
    lateMarkMarkCount: "",
    maxLateCheckinMarkAs: "" as "Absent" | "Half Day" | "",
    trimPreshiftMin: 0,
    trimPostshiftMin: 0,
    allow_self_mark_attendance: false,
    allow_manager_update_ot: false,
    max_ot_hours_per_day_min: 0,
    countWorkhoursInMinutes: false,
    overtimeApplicable: false,
    minOvertimeHrs: 0,
    maxOvertimeHrs: 0,
    overtimeTrimmingApply: false,
    checkoutGracePeriodForOvertimeTrimming: 0,
    breakTimeForOT: 0,
    otMealApply: false,
    minsForOTMealToken: 0,
    minsForBreakTimeForMeal: 0,
    leaveAroundHolidayCounted: false,
  });

  const BACKEND_URL =
    process.env.NEXT_PUBLIC_BACKEND_URL || "/backend";

  const resolvedServiceProviderID =
    user?.role === "SERVICE_PROVIDER"
      ? currentUserMapping?.serviceProviderID
      : formData.serviceProviderID;

  const resolvedCompanyID =
    user?.role === "SERVICE_PROVIDER"
      ? currentUserMapping?.companyID
      : formData.companyID;

  // Load mapping for MANAGER / BRANCH_ADMIN
  useEffect(() => {
    if (user?.role !== "SERVICE_PROVIDER" && user?.role !== "BRANCH_ADMIN") return;

    if (user?.role === "SERVICE_PROVIDER") {
      (async () => {
        const res = await fetch(`${BACKEND_URL}/users`);
        const users = await res.json();
        const me = users.find((u: any) => u.username === user.username);
        setCurrentUserMapping(me || null);
      })();
    } else if (user?.role === "BRANCH_ADMIN") {
      setCurrentUserMapping(user);
    }
  }, [user]);

  // Auto-fill SP + Company + Branch for MANAGER / BRANCH_ADMIN
  useEffect(() => {
    if (user?.role === "SERVICE_PROVIDER" && currentUserMapping) {
      setFormData((p) => ({
        ...p,
        serviceProviderID: currentUserMapping.serviceProviderID,
        companyID: currentUserMapping.companyID,
        branchesID: currentUserMapping.branchesID,
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
      if (!resolvedServiceProviderID) return [];

      const res = await fetch(`${BACKEND_URL}/company`, { cache: "no-store" });
      const data = await res.json();
      const q = query.toLowerCase();

      return Array.isArray(data)
        ? data.filter(
          (c: any) =>
            c.serviceProviderID === resolvedServiceProviderID &&
            (c.companyName || "").toLowerCase().includes(q)
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
      if (!resolvedCompanyID) return [];

      const res = await fetch(`${BACKEND_URL}/branches`, { cache: "no-store" });
      const data = await res.json();
      const q = query.toLowerCase();

      return Array.isArray(data)
        ? data.filter(
          (b: any) =>
            b.companyID === resolvedCompanyID &&
            (user?.role !== "BRANCH_ADMIN" || Number(b.id) === Number(user?.branchesID)) &&
            (b.branchName || "").toLowerCase().includes(q)
        )
        : [];
    } catch (error) {
      console.error("Error fetching branches:", error);
      toast.error("Failed to load data.");
      return [];
    }
  };

  useEffect(() => {
    if (user) loadAttendancePolicies();
  }, [user]);

  useEffect(() => {
    const handler = () => { if (user) loadAttendancePolicies(); };
    window.addEventListener("sidebar-context-changed", handler);
    window.addEventListener("app-data-refresh", handler);
    return () => {
      window.removeEventListener("sidebar-context-changed", handler);
      window.removeEventListener("app-data-refresh", handler);
    };
  }, [user]);

  const loadAttendancePolicies = async () => {
    setListLoading(true);
    try {
      const res = await fetch(`${BACKEND_URL}/attendance-policy`, { cache: "no-store" });
      const data = await res.json();
      const all = Array.isArray(data) ? data : [];

      const mapped = all.map((p: any) => ({
        id: p.id.toString(),
        serviceProviderID: p.serviceProviderID,
        companyID: p.companyID,
        branchesID: p.branchesID,
        serviceProvider: p.serviceProvider?.companyName || "",
        companyName: p.company?.companyName || "",
        branchName: p.branches?.branchName || "",
        attendancePolicyName: p.attendancePolicyName,
        workingHoursType: p.workingHoursType,
        createdAt: p.createdAt
          ? new Date(p.createdAt).toISOString().split("T")[0]
          : new Date().toISOString().split("T")[0],
        checkin_begin_before_min: p.checkin_begin_before_min ?? 0,
        checkout_end_after_min: p.checkout_end_after_min ?? 0,
        checkin_grace_time_min: p.checkin_grace_time_min ?? 0,
        min_work_hours_half_day_min: p.min_work_hours_half_day_min ?? 0,
        max_late_check_in_time: p.max_late_check_in_time ?? 0,
        earlyCheckoutBeforeEndMin: p.earlyCheckoutBeforeEndMin ?? 0,
        markAs: p.markAs ?? "",
        lateMarkCount: p.lateMarkCount ?? "",
        lateMarkMarkAs: p.lateMarkMarkAs ?? "",
        lateMarkMarkCount: p.lateMarkMarkCount ?? "",
        maxLateCheckinMarkAs: p.maxLateCheckinMarkAs ?? "",
        trimPreshiftMin: p.trimPreshiftMin ?? 0,
        trimPostshiftMin: p.trimPostshiftMin ?? 0,
        allow_self_mark_attendance: p.allow_self_mark_attendance ?? false,
        allow_manager_update_ot: p.allow_manager_update_ot ?? false,
        max_ot_hours_per_day_min: p.max_ot_hours_per_day_min ?? 0,
        overtimeApplicable: p.overtimeApplicable ?? false,
        minOvertimeHrs: p.minOvertimeHrs ?? 0,
        maxOvertimeHrs: p.maxOvertimeHrs ?? 0,
        overtimeTrimmingApply: p.overtimeTrimmingApply ?? false,
        checkoutGracePeriodForOvertimeTrimming: p.checkoutGracePeriodForOvertimeTrimming ?? 0,
        breakTimeForOT: p.breakTimeForOT ?? 0,
        otMealApply: p.otMealApply ?? false,
        minsForOTMealToken: p.minsForOTMealToken ?? 0,
        minsForBreakTimeForMeal: p.minsForBreakTimeForMeal ?? 0,
        leaveAroundHolidayCounted: p.leaveAroundHolidayCounted ?? false,
      }));

      const mapping = await resolveScopeUserMapping(user!);
      if (mapping) setCurrentUserMapping(mapping);
      setPolicies(await filterCompanyScopedRecords(mapped, user!));

    } catch (err) {
      console.error("Error loading attendance policies:", err);
      toast.error("Failed to load data.");
      setPolicies([]);
    } finally {
      setListLoading(false);
    }
  };

  const filteredPolicies = policies.filter(
    (policy) =>
      policy.attendancePolicyName
        .toLowerCase()
        .includes(searchTerm.toLowerCase()) ||
      (policy.serviceProvider || "")
        .toLowerCase()
        .includes(searchTerm.toLowerCase()) ||
      (policy.companyName || "")
        .toLowerCase()
        .includes(searchTerm.toLowerCase()) ||
      (policy.branchName || "")
        .toLowerCase()
        .includes(searchTerm.toLowerCase())
  );

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    // Validation
    const validationErrors: string[] = [];
    if (!formData.attendancePolicyName?.trim()) validationErrors.push("Attendance Policy Name is required");

    // Check unique policy name per company
    const targetCompanyID = user?.role === "SERVICE_PROVIDER"
      ? currentUserMapping?.companyID
      : formData.companyID;
    if (formData.attendancePolicyName?.trim() && targetCompanyID) {
      const duplicate = policies.find(
        (p) =>
          p.companyID === targetCompanyID &&
          p.attendancePolicyName.toLowerCase() === formData.attendancePolicyName.trim().toLowerCase() &&
          (!editingPolicy || p.id !== editingPolicy.id)
      );
      if (duplicate) {
        validationErrors.push("An attendance policy with this name already exists for this company.");
      }
    }

    if (validationErrors.length > 0) {
      validationErrors.forEach(msg => toast.error(msg));
      return;
    }

    try {
      const attendancePolicyData = {
        serviceProviderID:
          user?.role === "SERVICE_PROVIDER"
            ? currentUserMapping?.serviceProviderID
            : formData.serviceProviderID,
        companyID:
          user?.role === "SERVICE_PROVIDER"
            ? currentUserMapping?.companyID
            : formData.companyID,
        branchesID:
          user?.role === "SERVICE_PROVIDER"
            ? currentUserMapping?.branchesID
            : formData.branchesID,
        attendancePolicyName: formData.attendancePolicyName,
        workingHoursType: formData.workingHoursType,
        checkin_begin_before_min: formData.checkin_begin_before_min,
        checkout_end_after_min: formData.checkout_end_after_min,
        checkin_grace_time_min: formData.checkin_grace_time_min,
        markAs: formData.markAs,
        lateMarkCount: formData.lateMarkCount,
        lateMarkMarkAs: formData.lateMarkMarkAs,
        lateMarkMarkCount: formData.lateMarkMarkCount,
        maxLateCheckinMarkAs: formData.maxLateCheckinMarkAs,
        trimPreshiftMin: formData.trimPreshiftMin,
        trimPostshiftMin: formData.trimPostshiftMin,
        min_work_hours_half_day_min: formData.min_work_hours_half_day_min,
        max_late_check_in_time: formData.max_late_check_in_time,
        earlyCheckoutBeforeEndMin: formData.earlyCheckoutBeforeEndMin,
        allow_self_mark_attendance: formData.allow_self_mark_attendance,
        allow_manager_update_ot: formData.allow_manager_update_ot,
        max_ot_hours_per_day_min: formData.max_ot_hours_per_day_min,
        overtimeApplicable: formData.overtimeApplicable,
        minOvertimeHrs: formData.minOvertimeHrs,
        maxOvertimeHrs: formData.maxOvertimeHrs,
        overtimeTrimmingApply: formData.overtimeTrimmingApply,
        checkoutGracePeriodForOvertimeTrimming: formData.checkoutGracePeriodForOvertimeTrimming,
        otMealApply: formData.otMealApply,
        minsForOTMealToken: formData.minsForOTMealToken,
        minsForBreakTimeForMeal: formData.minsForBreakTimeForMeal,
        breakTimeForOT: formData.breakTimeForOT,
        countWorkhoursInMinutes: formData.countWorkhoursInMinutes,
        leaveAroundHolidayCounted: formData.leaveAroundHolidayCounted,
      };

      const url = editingPolicy
        ? `${BACKEND_URL}/attendance-policy/${editingPolicy.id}`
        : `${BACKEND_URL}/attendance-policy`;
      const method = editingPolicy ? "PATCH" : "POST";

      const res = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(attendancePolicyData),
      });
      if (!res.ok) {
        throw new Error(`Failed to save attendance policy: ${res.status}`);
      }

      await loadAttendancePolicies();
      resetForm();
      setIsDialogOpen(false);
      toast.success(editingPolicy ? "Updated successfully" : "Created successfully");
    } catch (error) {
      console.error("Error saving attendance policy:", error);
      toast.error("Failed to save. Please try again.");
    }
  };

  const resetForm = () => {
    const ctx = getSidebarContext();
    setFormData({
      serviceProvider: ctx?.serviceProviderName ?? "",
      companyName: ctx?.companyName ?? "",
      branchName: "",
      attendancePolicyName: "",
      serviceProviderID: ctx?.serviceProviderID ?? undefined,
      companyID: ctx?.companyID ?? undefined,
      branchesID: undefined,
      workingHoursType: "Fixed",
      checkin_begin_before_min: 0,
      checkout_end_after_min: 0,
      checkin_grace_time_min: 0,
      markAs: "",
      lateMarkCount: "",
      lateMarkMarkAs: "",
      lateMarkMarkCount: "",
      maxLateCheckinMarkAs: "",
      trimPreshiftMin: 0,
      trimPostshiftMin: 0,
      min_work_hours_half_day_min: 0,
      max_late_check_in_time: 0,
      earlyCheckoutBeforeEndMin: 0,
      allow_self_mark_attendance: false,
      allow_manager_update_ot: false,
      max_ot_hours_per_day_min: 0,
      countWorkhoursInMinutes: false,
      overtimeApplicable: false,
      minOvertimeHrs: 0,
      maxOvertimeHrs: 0,
      overtimeTrimmingApply: false,
      checkoutGracePeriodForOvertimeTrimming: 0,
      breakTimeForOT: 0,
      otMealApply: false,
      minsForOTMealToken: 0,
      minsForBreakTimeForMeal: 0,
      leaveAroundHolidayCounted: false,
    });
    setEditingPolicy(null);
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

  const handleEdit = (policy: AttendancePolicy) => {
    setFormData({
      serviceProvider: policy.serviceProvider || "",
      companyName: policy.companyName || "",
      branchName: policy.branchName || "",
      attendancePolicyName: policy.attendancePolicyName,
      serviceProviderID: policy.serviceProviderID,
      companyID: policy.companyID,
      branchesID: policy.branchesID,
      workingHoursType: policy.workingHoursType,
      checkin_begin_before_min: policy.checkin_begin_before_min,
      checkout_end_after_min: policy.checkout_end_after_min,
      checkin_grace_time_min: policy.checkin_grace_time_min,
      markAs: (policy.markAs as "Absent" | "Half Day") ?? "",
      lateMarkCount: policy.lateMarkCount || "",
      lateMarkMarkAs: ((policy as any).lateMarkMarkAs as "Absent" | "Half Day") ?? "",
      lateMarkMarkCount: (policy as any).lateMarkMarkCount || "",
      maxLateCheckinMarkAs: ((policy as any).maxLateCheckinMarkAs as "Absent" | "Half Day") ?? "",
      trimPreshiftMin: (policy as any).trimPreshiftMin ?? 0,
      trimPostshiftMin: (policy as any).trimPostshiftMin ?? 0,
      min_work_hours_half_day_min: policy.min_work_hours_half_day_min,
      max_late_check_in_time: policy.max_late_check_in_time,
      earlyCheckoutBeforeEndMin: policy.earlyCheckoutBeforeEndMin,
      allow_self_mark_attendance: policy.allow_self_mark_attendance,
      allow_manager_update_ot: policy.allow_manager_update_ot,
      max_ot_hours_per_day_min: policy.max_ot_hours_per_day_min,
      countWorkhoursInMinutes: policy.countWorkhoursInMinutes || false,
      overtimeApplicable: policy.overtimeApplicable || false,
      minOvertimeHrs: policy.minOvertimeHrs || 0,
      maxOvertimeHrs: policy.maxOvertimeHrs || 0,
      overtimeTrimmingApply: policy.overtimeTrimmingApply || false,
      checkoutGracePeriodForOvertimeTrimming: policy.checkoutGracePeriodForOvertimeTrimming || 0,
      breakTimeForOT: policy.breakTimeForOT || 0,
      otMealApply: policy.otMealApply || false,
      minsForOTMealToken: policy.minsForOTMealToken || 0,
      minsForBreakTimeForMeal: policy.minsForBreakTimeForMeal || 0,
      leaveAroundHolidayCounted: (policy as any).leaveAroundHolidayCounted || false,
    });
    setEditingPolicy(policy);
    setIsDialogOpen(true);
  };

  const handleDelete = async (id: string) => {
    try {
      const res = await fetch(`${BACKEND_URL}/attendance-policy/${id}`, {
        method: "DELETE",
      });
      if (!res.ok) {
        throw new Error(`Failed to delete attendance policy: ${res.status}`);
      }
      await loadAttendancePolicies();
      toast.success("Deleted successfully");
    } catch (error) {
      console.error("Error deleting attendance policy:", error);
      toast.error("Failed to delete. Please try again.");
    }
  };

  return (
    <div className="space-y-6 w-full max-w-6xl mx-auto px-4">
      {/* Header */}
      <div className="flex items-center justify-between w-full">
        <div className="min-w-0 flex-1">
          <p className="text-gray-600 mt-1 text-sm">
            Manage attendance policies and rules
          </p>
        </div>
        {canManage && !isDialogOpen && (
          <Button
            onClick={() => { resetForm(); setIsDialogOpen(true); }}
            className="flex-shrink-0 text-sm px-3 py-2"
          >
            <Plus className="w-4 h-4 mr-1" />
            Add Attendance Policy
          </Button>
        )}
      </div>

      <FormDrawer open={isDialogOpen} onOpenChange={setIsDialogOpen} title={editingPolicy ? "Edit Attendance Policy" : "Add New Attendance Policy"} description={editingPolicy ? "Update the attendance policy information below." : "Fill in the details to add a new attendance policy."}>
            <form
              onSubmit={(e) => {
                e.preventDefault();
                handleSubmit(e);
              }}
              className="space-y-6"
            >
              {/* Basic Information */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
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

                {user?.role === "SERVICE_PROVIDER" && (
                  <SearchSuggestInput
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
                    required
                  />
                )}

                {user?.role === "SUPERADMIN" && (
                  <SearchSuggestInput
                    label="Branch Name"
                    placeholder="Select Branch"
                    value={formData.branchName}
                    onChange={(value) =>
                      setFormData((prev) => ({ ...prev, branchName: value }))
                    }
                    onSelect={handleBranchSelect}
                    fetchData={fetchBranches}
                    displayField="branchName"
                    valueField="id"
                    required
                  />
                )}
              </div>

              <div className="space-y-2 w-full">
                <Label htmlFor="attendancePolicyName">Attendance Policy Name *</Label>
                <Input
                  id="attendancePolicyName"
                  value={formData.attendancePolicyName}
                  onChange={(e) =>
                    setFormData((prev) => ({
                      ...prev,
                      attendancePolicyName: e.target.value,
                    }))
                  }
                  placeholder="Enter attendance policy name"
                  className="w-full"
                  required
                />
              </div>

              {/* Check-In/Check-Out Configuration */}
              <div className="space-y-4">
                <h3 className="text-lg font-semibold">Check-In/Check-Out Configuration</h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-2 w-full">
                    <div className="flex items-center gap-1">
                      <Label htmlFor="checkin_begin_before_min">Pre Check-In Time(In Minutes)</Label>
                      <span className="relative group">
                        <Info className="w-3.5 h-3.5 text-gray-400 cursor-help flex-shrink-0" />
                        <span className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 w-72 p-3 text-xs bg-gray-800 text-white rounded shadow-lg opacity-0 group-hover:opacity-100 transition pointer-events-none z-50 whitespace-pre-line leading-relaxed text-left">
                          {`* For Flexible shift, Allow employee to start work before shift time
* For Fixed shift, Not Applicable , Actual Shift start time considered as work start time
* Applicable in Rotating Shift`}
                        </span>
                      </span>
                    </div>
                    <div className="flex items-center gap-2 w-full">
                      <Input
                        id="checkin_begin_before_min"
                        type="text"
                        value={formData.checkin_begin_before_min}
                        onChange={(e) => {
                          const value = e.target.value.replace(/\D/g, '');
                          setFormData((prev) => ({
                            ...prev,
                            checkin_begin_before_min: parseInt(value) || 0,
                          }));
                        }}
                        className="w-full"
                        required
                      />
                      <span className="text-sm text-gray-500 flex-shrink-0">Min</span>
                    </div>
                  </div>

                  <div className="space-y-2 w-full">
                    <div className="flex items-center gap-1">
                      <Label htmlFor="checkout_end_after_min">Post Check-Out Time (In Minutes)</Label>
                      <span className="relative group">
                        <Info className="w-3.5 h-3.5 text-gray-400 cursor-help flex-shrink-0" />
                        <span className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 w-72 p-3 text-xs bg-gray-800 text-white rounded shadow-lg opacity-0 group-hover:opacity-100 transition pointer-events-none z-50 whitespace-pre-line leading-relaxed text-left">
                          {`* For Flexible shift, Allow employee to work till this buffer time after actual shift end time to complete Shift hours including OT.
* For Fixed shift, Allow employee to work till this buffer time after shift actual time to complete OT.
* Applicable in Rotating Shift`}
                        </span>
                      </span>
                    </div>
                    <div className="flex items-center gap-2 w-full">
                      <Input
                        id="checkout_end_after_min"
                        type="text"
                        value={formData.checkout_end_after_min}
                        onChange={(e) => {
                          const value = e.target.value.replace(/\D/g, '');
                          setFormData((prev) => ({
                            ...prev,
                            checkout_end_after_min: parseInt(value) || 0,
                          }));
                        }}
                        className="w-full"
                        required
                      />
                      <span className="text-sm text-gray-500 flex-shrink-0">Min</span>
                    </div>
                  </div>
                </div>
              </div>

              {/* Grace Time and Minimum Hours */}
              <div className="space-y-4">
                <h3 className="text-lg font-semibold">Grace Time and Minimum Hours</h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-2 w-full">
                    <div className="flex items-center gap-1">
                      <Label htmlFor="checkin_grace_time_min">Check-In Grace Time (In Minutes)</Label>
                      <span className="relative group">
                        <Info className="w-3.5 h-3.5 text-gray-400 cursor-help flex-shrink-0" />
                        <span className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 w-72 p-3 text-xs bg-gray-800 text-white rounded shadow-lg opacity-0 group-hover:opacity-100 transition pointer-events-none z-50 whitespace-pre-line leading-relaxed text-left">
                          {`* For Flexible Shift, not applicable
* For Fixed shift, After Shift start time allow this buffer time to start work without latemark or deduction
* Applicable in Rotating Shift`}
                        </span>
                      </span>
                    </div>
                    <div className="flex items-center gap-2 w-full">
                      <Input
                        id="checkin_grace_time_min"
                        type="text"
                        value={formData.checkin_grace_time_min}
                        onChange={(e) => {
                          const value = e.target.value.replace(/\D/g, "");
                          setFormData((prev) => ({
                            ...prev,
                            checkin_grace_time_min: parseInt(value) || 0,
                          }));
                        }}
                        className="w-full"
                        required
                      />
                      <span className="text-sm text-gray-500 flex-shrink-0">Min</span>
                    </div>
                  </div>

                  <div className="space-y-2 w-full">
                    <div className="flex items-center gap-1">
                      <Label htmlFor="min_work_hours_half_day_min">
                        Minimum Work Hours for Half Day (In Minutes)
                      </Label>
                      <span className="relative group">
                        <Info className="w-3.5 h-3.5 text-gray-400 cursor-help flex-shrink-0" />
                        <span className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 w-72 p-3 text-xs bg-gray-800 text-white rounded shadow-lg opacity-0 group-hover:opacity-100 transition pointer-events-none z-50 whitespace-pre-line leading-relaxed text-left">
                          {`* For Flexible shift, if total work hours is below this value, mark as absent
* For Fixed shift, if total work hours is below this value, mark as absent
* Applicable in Rotating Shift`}
                        </span>
                      </span>
                    </div>
                    <div className="flex items-center gap-2 w-full">
                      <Input
                        id="min_work_hours_half_day_min"
                        type="text"
                        value={formData.min_work_hours_half_day_min}
                        onChange={(e) => {
                          const value = e.target.value.replace(/\D/g, "");
                          setFormData((prev) => ({
                            ...prev,
                            min_work_hours_half_day_min: parseInt(value) || 0,
                          }));
                        }}
                        className="w-full"
                        required
                      />
                      <span className="text-sm text-gray-500 flex-shrink-0">Min</span>
                    </div>
                  </div>

                  <div className="space-y-2 w-full">
                    <div className="flex items-center gap-1">
                      <Label htmlFor="earlyCheckoutBeforeEndMin">Early Checkout Allow Time (In Minutes)</Label>
                      <span className="relative group">
                        <Info className="w-3.5 h-3.5 text-gray-400 cursor-help flex-shrink-0" />
                        <span className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 w-72 p-3 text-xs bg-gray-800 text-white rounded shadow-lg opacity-0 group-hover:opacity-100 transition pointer-events-none z-50 whitespace-pre-line leading-relaxed text-left">
                          {`* For Flexible shift : Not Applicable
* For Fixed shift : All employee to checkout early before shift time end without latemark or deduction
* Applicable in Rotating Shift`}
                        </span>
                      </span>
                    </div>
                    <div className="flex items-center gap-2 w-full">
                      <Input
                        id="earlyCheckoutBeforeEndMin"
                        type="text"
                        value={formData.earlyCheckoutBeforeEndMin}
                        onChange={(e) => {
                          const value = e.target.value.replace(/\D/g, "");
                          setFormData((prev) => ({
                            ...prev,
                            earlyCheckoutBeforeEndMin: parseInt(value) || 0,
                          }));
                        }}
                        className="w-full"
                        required
                      />
                      <span className="text-sm text-gray-500 flex-shrink-0">Min</span>
                    </div>
                  </div>
                </div>
              </div>

              {/* Late Marks Rule */}
              <div className="space-y-3">
                <div className="flex items-center gap-1">
                  <Label className="text-base font-semibold">Late Marks Rule</Label>
                  <span className="relative group">
                    <Info className="w-3.5 h-3.5 text-gray-400 cursor-help flex-shrink-0" />
                    <span className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 w-72 p-3 text-xs bg-gray-800 text-white rounded shadow-lg opacity-0 group-hover:opacity-100 transition pointer-events-none z-50 whitespace-pre-line leading-relaxed text-left">
                      {`* For Flexible shift, Not applicable
* For Fixed shift, Consider latemark as halfday/absent after no. of repeated latemarks as per policy
* Applicable in Rotating Shift`}
                    </span>
                  </span>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-3 items-end">
                  <div className="space-y-1.5">
                    <Label className="text-xs text-gray-500">Mark as</Label>
                    <select
                      value={formData.lateMarkMarkAs}
                      onChange={(e) =>
                        setFormData((p) => ({
                          ...p,
                          lateMarkMarkAs: e.target.value as "Absent" | "Half Day" | "",
                        }))
                      }
                      className="w-full h-9 px-3 py-2 text-sm border rounded-md border-gray-300 bg-white focus:outline-none focus:ring-2 focus:ring-gray-900/15"
                    >
                      <option value="">Select</option>
                      <option value="Absent">Absent</option>
                      <option value="Half Day">Half Day</option>
                    </select>
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-xs text-gray-500">After (count)</Label>
                    <Input
                      type="text"
                      value={formData.lateMarkMarkCount}
                      onChange={(e) =>
                        setFormData((p) => ({
                          ...p,
                          lateMarkMarkCount: e.target.value,
                        }))
                      }
                      className="w-full"
                      placeholder="0"
                    />
                  </div>
                  <div className="flex items-end h-9">
                    <span className="text-sm text-gray-500">Late Marks</span>
                  </div>
                </div>
              </div>

              {/* Late Check-In Rule */}
              <div className="space-y-3">
                <div className="flex items-center gap-1">
                  <Label className="text-base font-semibold">Late Check-In Rule</Label>
                  <span className="relative group">
                    <Info className="w-3.5 h-3.5 text-gray-400 cursor-help flex-shrink-0" />
                    <span className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 w-72 p-3 text-xs bg-gray-800 text-white rounded shadow-lg opacity-0 group-hover:opacity-100 transition pointer-events-none z-50 whitespace-pre-line leading-relaxed text-left">
                      {`* For Flexible Shift, Not Applicable
* For Fixed shift, If check-in after this buffer time mark as cumpulsory halfday / Absent as per policy
* Applicable in Rotating Shift`}
                    </span>
                  </span>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-3 items-end">
                  <div className="space-y-1.5">
                    <Label className="text-xs text-gray-500">Mark as</Label>
                    <select
                      value={formData.maxLateCheckinMarkAs}
                      onChange={(e) =>
                        setFormData((p) => ({
                          ...p,
                          maxLateCheckinMarkAs: e.target.value as "Absent" | "Half Day" | "",
                        }))
                      }
                      className="w-full h-9 px-3 py-2 text-sm border rounded-md border-gray-300 bg-white focus:outline-none focus:ring-2 focus:ring-gray-900/15"
                    >
                      <option value="">Select</option>
                      <option value="Absent">Absent</option>
                      <option value="Half Day">Half Day</option>
                    </select>
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-xs text-gray-500">if Max Check-In After Grace Period Time</Label>
                    <div className="flex items-center gap-2 w-full">
                      <Input
                        type="text"
                        value={formData.max_late_check_in_time}
                        onChange={(e) => {
                          const value = e.target.value.replace(/\D/g, "");
                          setFormData((p) => ({
                            ...p,
                            max_late_check_in_time: parseInt(value) || 0,
                          }));
                        }}
                        className="w-full"
                        placeholder="0"
                      />
                      <span className="text-sm text-gray-500 flex-shrink-0">Min</span>
                    </div>
                  </div>
                </div>
              </div>

              {/* No Check-out Punch Rule */}
              <div className="space-y-3">
                <div className="flex items-center gap-1">
                  <Label className="text-base font-semibold">No Check-out Punch Rule</Label>
                  <span className="relative group">
                    <Info className="w-3.5 h-3.5 text-gray-400 cursor-help flex-shrink-0" />
                    <span className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 w-72 p-3 text-xs bg-gray-800 text-white rounded shadow-lg opacity-0 group-hover:opacity-100 transition pointer-events-none z-50 whitespace-pre-line leading-relaxed text-left">
                      {`* For Flexible shift, if employee not mark checkout attandace in system, considered as halfday/absent as per policy
* For Fixed shift, if employee not mark checkout attandace in system, considered as halfday/absent as per policy
* Applicable in Rotating Shift`}
                    </span>
                  </span>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-3 items-end">
                  <div className="space-y-1.5">
                    <Label className="text-xs text-gray-500">Mark as</Label>
                    <select
                      value={formData.markAs}
                      onChange={(e) =>
                        setFormData((p) => ({
                          ...p,
                          markAs: e.target.value as "Absent" | "Half Day" | "",
                        }))
                      }
                      className="w-full h-9 px-3 py-2 text-sm border rounded-md border-gray-300 bg-white focus:outline-none focus:ring-2 focus:ring-gray-900/15"
                    >
                      <option value="">Select</option>
                      <option value="Absent">Absent</option>
                      <option value="Half Day">Half Day</option>
                    </select>
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-xs text-gray-500">After (count)</Label>
                    <Input
                      type="text"
                      value={formData.lateMarkCount}
                      onChange={(e) =>
                        setFormData((p) => ({
                          ...p,
                          lateMarkCount: e.target.value,
                        }))
                      }
                      className="w-full"
                      placeholder="0"
                    />
                  </div>
                  <div className="flex items-end h-9">
                    <span className="text-sm text-gray-500">No Check-out Punches</span>
                  </div>
                </div>
              </div>

              {/* Trim Working Hours */}
              <div className="space-y-4">
                <h3 className="text-lg font-semibold">Trim Working Hours</h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-2 w-full">
                    <div className="flex items-center gap-1">
                      <Label htmlFor="trimPreshiftMin">Trim Preshift Time (In Minutes)</Label>
                      <span className="relative group">
                        <Info className="w-3.5 h-3.5 text-gray-400 cursor-help flex-shrink-0" />
                        <span className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 w-72 p-3 text-xs bg-gray-800 text-white rounded shadow-lg opacity-0 group-hover:opacity-100 transition pointer-events-none z-50 whitespace-pre-line leading-relaxed text-left">
                          {`* For Fixed Shift, Trim Preshifttime as non working hours from total hours between Check-in to Checkout
* For Fixed Shift, Trim Preshifttime as non working hours from total working between Check-in to Checkout
* Applicable in Rotating Shift`}
                        </span>
                      </span>
                    </div>
                    <div className="flex items-center gap-2 w-full">
                      <Input
                        id="trimPreshiftMin"
                        type="text"
                        value={formData.trimPreshiftMin}
                        onChange={(e) => {
                          const value = e.target.value.replace(/\D/g, "");
                          setFormData((prev) => ({
                            ...prev,
                            trimPreshiftMin: parseInt(value) || 0,
                          }));
                        }}
                        className="w-full"
                      />
                      <span className="text-sm text-gray-500 flex-shrink-0">Min</span>
                    </div>
                  </div>
                  <div className="space-y-2 w-full">
                    <div className="flex items-center gap-1">
                      <Label htmlFor="trimPostshiftMin">Trim Postshift Time (In Minutes)</Label>
                      <span className="relative group">
                        <Info className="w-3.5 h-3.5 text-gray-400 cursor-help flex-shrink-0" />
                        <span className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 w-72 p-3 text-xs bg-gray-800 text-white rounded shadow-lg opacity-0 group-hover:opacity-100 transition pointer-events-none z-50 whitespace-pre-line leading-relaxed text-left">
                          {`* For Fixed Shift, Trim Postshifttime as non working hours from total time between Check-in to Checkout
* For Fixed Shift, Trim Postshifttime as non working hours from total time between Check-in to Checkout
* Applicable in Rotating Shift`}
                        </span>
                      </span>
                    </div>
                    <div className="flex items-center gap-2 w-full">
                      <Input
                        id="trimPostshiftMin"
                        type="text"
                        value={formData.trimPostshiftMin}
                        onChange={(e) => {
                          const value = e.target.value.replace(/\D/g, "");
                          setFormData((prev) => ({
                            ...prev,
                            trimPostshiftMin: parseInt(value) || 0,
                          }));
                        }}
                        className="w-full"
                      />
                      <span className="text-sm text-gray-500 flex-shrink-0">Min</span>
                    </div>
                  </div>
                </div>
              </div>

              {/* Additional Settings */}
              <div className="border-t border-gray-200 pt-4 space-y-4">
                <div className="flex items-center space-x-3">
                  <input
                    type="checkbox"
                    id="leaveAroundHolidayCounted"
                    checked={formData.leaveAroundHolidayCounted || false}
                    onChange={(e) =>
                      setFormData((prev) => ({
                        ...prev,
                        leaveAroundHolidayCounted: e.target.checked,
                      }))
                    }
                    className="w-4 h-4 text-blue-600 bg-gray-100 border-gray-300 rounded focus:ring-blue-500"
                  />
                  <Label htmlFor="leaveAroundHolidayCounted" className="text-sm font-medium">
                    If an employee takes leave before and after weekly off / holiday, then the holiday in between is also counted as leave
                  </Label>
                  <span className="relative group">
                    <Info className="w-3.5 h-3.5 text-gray-400 cursor-help flex-shrink-0" />
                    <span className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 w-72 p-3 text-xs bg-gray-800 text-white rounded shadow-lg opacity-0 group-hover:opacity-100 transition pointer-events-none z-50 whitespace-pre-line leading-relaxed text-left">
                      {`* For Flexible shift, To restrict employee from tacking leave continue to weekoff or holiday,\n* For Fixed shift, To restrict employee from tacking leave continue to weekoff or holiday,\n* Applicable in Rotating Shift`}
                    </span>
                  </span>
                </div>
                <div className="flex items-center space-x-3">
                  <input
                    type="checkbox"
                    id="overtimeApplicable"
                    checked={formData.overtimeApplicable}
                    onChange={(e) =>
                      setFormData((prev) => ({
                        ...prev,
                        overtimeApplicable: e.target.checked,
                      }))
                    }
                    className="w-4 h-4 text-blue-600 bg-gray-100 border-gray-300 rounded focus:ring-blue-500"
                  />
                  <div className="flex items-center gap-1">
                    <Label htmlFor="overtimeApplicable" className="text-sm font-medium">
                      Overtime Applicable
                    </Label>
                    <span className="relative group">
                      <Info className="w-3.5 h-3.5 text-gray-400 cursor-help flex-shrink-0" />
                      <span className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 w-72 p-3 text-xs bg-gray-800 text-white rounded shadow-lg opacity-0 group-hover:opacity-100 transition pointer-events-none z-50 whitespace-pre-line leading-relaxed text-left">
                        {`* For Flexible shift, If enable then only Overtime Hours calculate\n* For Fixed shift, If enable then only Overtime Hours calculate\n* Applicable in Rotating Shift`}
                      </span>
                    </span>
                  </div>
                </div>

                {formData.overtimeApplicable && (
                  <div className="ml-6 space-y-4">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div className="space-y-2 w-full">
                        <div className="flex items-center gap-1">
                          <Label htmlFor="minOvertimeHrs">Min Overtime Hrs (In Minutes)</Label>
                          <span className="relative group">
                            <Info className="w-3.5 h-3.5 text-gray-400 cursor-help flex-shrink-0" />
                            <span className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 w-72 p-3 text-xs bg-gray-800 text-white rounded shadow-lg opacity-0 group-hover:opacity-100 transition pointer-events-none z-50 whitespace-pre-line leading-relaxed text-left">
                              {`* For Flexible shift, If Overtime Hours below this value after normal working hours, not counted as OT Hours\n* For Fixed shift, If Overtime Hours below this value after normal working hours, not counted as OT Hours\n* Applicable in Rotating Shift`}
                            </span>
                          </span>
                        </div>
                        <div className="flex items-center gap-2 w-full">
                          <Input
                            id="minOvertimeHrs"
                            type="text"
                            value={formData.minOvertimeHrs}
                            onChange={(e) => {
                              const value = e.target.value.replace(/\D/g, "");
                              setFormData((prev) => ({
                                ...prev,
                                minOvertimeHrs: parseInt(value) || 0,
                              }));
                            }}
                            className="w-full"
                            placeholder="Enter minimum overtime hours"
                          />
                          <span className="text-sm text-gray-500 flex-shrink-0">Min</span>
                        </div>
                      </div>

                      <div className="space-y-2 w-full">
                        <div className="flex items-center gap-1">
                          <Label htmlFor="maxOvertimeHrs">Max Overtime Hrs (In Minutes)</Label>
                          <span className="relative group">
                            <Info className="w-3.5 h-3.5 text-gray-400 cursor-help flex-shrink-0" />
                            <span className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 w-72 p-3 text-xs bg-gray-800 text-white rounded shadow-lg opacity-0 group-hover:opacity-100 transition pointer-events-none z-50 whitespace-pre-line leading-relaxed text-left">
                              {`* For Flexible shift, If Overtime Hours above this value after normal working hours, not counted as OT Hours\n* For Fixed shift, If Overtime Hours above this value after normal working hours, not counted as OT Hours\n* Applicable in Rotating Shift`}
                            </span>
                          </span>
                        </div>
                        <div className="flex items-center gap-2 w-full">
                          <Input
                            id="maxOvertimeHrs"
                            type="text"
                            value={formData.maxOvertimeHrs}
                            onChange={(e) => {
                              const value = e.target.value.replace(/\D/g, "");
                              setFormData((prev) => ({
                                ...prev,
                                maxOvertimeHrs: parseInt(value) || 0,
                              }));
                            }}
                            className="w-full"
                            placeholder="Enter maximum overtime hours"
                          />
                          <span className="text-sm text-gray-500 flex-shrink-0">Min</span>
                        </div>
                      </div>
                    </div>
                  </div>
                )}
              </div>

              <div className="flex justify-end gap-3 pt-4">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setIsDialogOpen(false)}
                >
                  Cancel
                </Button>
                <Button type="submit">
                  {editingPolicy ? "Update Attendance Policy" : "Add Attendance Policy"}
                </Button>
              </div>
            </form>
      </FormDrawer>

      {!isDialogOpen && (<>
      {/* Search and Filters */}
      <Card>
        <CardContent>
          <div className="flex items-center gap-4 flex-wrap">
            <div className="relative flex-1 min-w-0">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
              <Input
                placeholder="Search attendance policies..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-10 w-full"
              />
            </div>
            <Badge variant="secondary" className="px-3 py-1 flex-shrink-0">
              {filteredPolicies.length} attendance policies
            </Badge>
          </div>
        </CardContent>
      </Card>

      {/* Attendance Policies Table */}
      <Card className="w-full">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Icon icon="mdi:clock-outline" className="w-5 h-5" />
            Attendance Policies List
          </CardTitle>
        </CardHeader>
        <CardContent className="p-0 w-full">
          <div className="overflow-x-auto w-full">
            <Table className="w-full">
              <TableHeader>
                <TableRow>
                  <TableHead className="w-[200px]">Policy Name</TableHead>
                  <TableHead className="w-[80px] text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {listLoading ? (
                      <TableBodySkeleton cols={5} />
                    ) : filteredPolicies.length === 0 ? (
                  <TableRow>
                    <TableCell
                      colSpan={2}
                      className="text-center py-8 text-gray-500"
                    >
                      <div className="flex flex-col items-center gap-2">
                        <Icon
                          icon="mdi:clock-outline"
                          className="w-12 h-12 text-gray-300"
                        />
                        <p>No attendance policies found</p>
                        <p className="text-sm">
                          Try adjusting your search criteria
                        </p>
                      </div>
                    </TableCell>
                  </TableRow>
                ) : (
                  filteredPolicies.map((policy) => (
                    <TableRow key={policy.id}>
                      <TableCell className="font-medium whitespace-nowrap">
                        {policy.attendancePolicyName}
                      </TableCell>
                      <TableCell className="text-right whitespace-nowrap">
                        <div className="flex items-center justify-end gap-1">
                          {canManage && (
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => handleEdit(policy)}
                              className="h-7 w-7 p-0"
                              title="Edit"
                            >
                              <Edit className="w-3 h-3" />
                            </Button>
                          )}
                          {canManage && (
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => handleDelete(policy.id)}
                              className="h-7 w-7 p-0 text-red-600 hover:text-red-700 hover:bg-red-50"
                              title="Delete"
                            >
                              <Trash2 className="w-3 h-3" />
                            </Button>
                          )}
                        </div>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>
      </>)}
    </div>
  );
}