"use client";

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
import { Plus, Search, Edit, Trash2 } from "lucide-react";
import { SearchSuggestInput } from "../components/SearchSuggestInput";
import { useCurrentUser } from "../hooks/useCurrentUser";
import { toast } from "sonner";


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
  allow_self_mark_attendance: boolean;
  allow_manager_update_ot: boolean;
  max_ot_hours_per_day_min: number;
  overtimeApplicable: boolean;
  minOvertimeHrs: number;
  maxOvertimeHrs: number;
  overtimeTrimmingApply: boolean;
  checkoutGracePeriodForOvertimeTrimming: number;
  breakTimeForOT: number;
  createdAt: string;
}

interface SelectedItem {
  display: string;
  value: number;
  item: any;
}

export function AttendancePolicyManagement() {
  const [policies, setPolicies] = useState<AttendancePolicy[]>([]);
  const [searchTerm, setSearchTerm] = useState("");
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingPolicy, setEditingPolicy] = useState<AttendancePolicy | null>(
    null
  );
  const user = useCurrentUser();
  const canManage = user?.role === "SUPERADMIN" || user?.role === "MANAGER";
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
    allow_self_mark_attendance: false,
    allow_manager_update_ot: false,
    max_ot_hours_per_day_min: 0,
    overtimeApplicable: false,
    minOvertimeHrs: 0,
    maxOvertimeHrs: 0,
    overtimeTrimmingApply: false,
    checkoutGracePeriodForOvertimeTrimming: 0,
    breakTimeForOT: 0,
  });

  const BACKEND_URL =
    process.env.NEXT_PUBLIC_BACKEND_URL || "/backend";

  const resolvedServiceProviderID =
    user?.role === "MANAGER"
      ? currentUserMapping?.serviceProviderID
      : formData.serviceProviderID;

  const resolvedCompanyID =
    user?.role === "MANAGER"
      ? currentUserMapping?.companyID
      : formData.companyID;

  // Load mapping for MANAGER
  useEffect(() => {
    if (user?.role !== "MANAGER") return;

    (async () => {
      const res = await fetch(`${BACKEND_URL}/users`);
      const users = await res.json();
      const me = users.find((u: any) => u.username === user.username);
      setCurrentUserMapping(me || null);
    })();
  }, [user]);

  // Auto-fill SP + Company + Branch for MANAGER
  useEffect(() => {
    if (user?.role === "MANAGER" && currentUserMapping) {
      setFormData((p) => ({
        ...p,
        serviceProviderID: currentUserMapping.serviceProviderID,
        companyID: currentUserMapping.companyID,
        branchesID: currentUserMapping.branchesID,
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

  const loadAttendancePolicies = async () => {
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
        allow_self_mark_attendance: p.allow_self_mark_attendance ?? false,
        allow_manager_update_ot: p.allow_manager_update_ot ?? false,
        max_ot_hours_per_day_min: p.max_ot_hours_per_day_min ?? 0,
        overtimeApplicable: p.overtimeApplicable ?? false,
        minOvertimeHrs: p.minOvertimeHrs ?? 0,
        maxOvertimeHrs: p.maxOvertimeHrs ?? 0,
        overtimeTrimmingApply: p.overtimeTrimmingApply ?? false,
        checkoutGracePeriodForOvertimeTrimming: p.checkoutGracePeriodForOvertimeTrimming ?? 0,
        breakTimeForOT: p.breakTimeForOT ?? 0,
      }));

      if (user?.role === "SUPERADMIN") {
        setPolicies(mapped);
        return;
      }

      if (user?.role === "MANAGER") {
        const usersRes = await fetch(`${BACKEND_URL}/users`);
        const users = await usersRes.json();
        const currentUser = users.find((u: any) => u.username === user.username);
        if (currentUser) {
          const filtered = mapped.filter(
            (r) =>
              r.companyID === currentUser.companyID &&
              r.branchesID === currentUser.branchesID
          );
          setPolicies(filtered);
          return;
        }
      }

      const credsRes = await fetch(`${BACKEND_URL}/manage-emp/credentials/all`);
      const creds = await credsRes.json();
      const emp = creds.find((c: any) => c.username === user?.username);
      if (emp) {
        const filtered = mapped.filter(
          (r) =>
            r.companyID === emp.companyID &&
            r.branchesID === emp.branchesID
        );
        setPolicies(filtered);
      } else {
        setPolicies([]);
      }
    } catch (err) {
      console.error("Error loading attendance policies:", err);
      toast.error("Failed to load data.");
      setPolicies([]);
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

    try {
      const attendancePolicyData = {
        serviceProviderID:
          user?.role === "MANAGER"
            ? currentUserMapping?.serviceProviderID
            : formData.serviceProviderID,
        companyID:
          user?.role === "MANAGER"
            ? currentUserMapping?.companyID
            : formData.companyID,
        branchesID:
          user?.role === "MANAGER"
            ? currentUserMapping?.branchesID
            : formData.branchesID,
        attendancePolicyName: formData.attendancePolicyName,
        workingHoursType: formData.workingHoursType,
        checkin_begin_before_min: formData.checkin_begin_before_min,
        checkout_end_after_min: formData.checkout_end_after_min,
        checkin_grace_time_min: formData.checkin_grace_time_min,
        markAs: formData.markAs,
        lateMarkCount: formData.lateMarkCount,
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
    setFormData({
      serviceProvider: "",
      companyName: "",
      branchName: "",
      attendancePolicyName: "",
      serviceProviderID: undefined,
      companyID: undefined,
      branchesID: undefined,
      workingHoursType: "Fixed",
      checkin_begin_before_min: 0,
      checkout_end_after_min: 0,
      checkin_grace_time_min: 0,
      markAs: "",
      lateMarkCount: "",
      min_work_hours_half_day_min: 0,
      max_late_check_in_time: 0,
      earlyCheckoutBeforeEndMin: 0,
      allow_self_mark_attendance: false,
      allow_manager_update_ot: false,
      max_ot_hours_per_day_min: 0,
      overtimeApplicable: false,
      minOvertimeHrs: 0,
      maxOvertimeHrs: 0,
      overtimeTrimmingApply: false,
      checkoutGracePeriodForOvertimeTrimming: 0,
      breakTimeForOT: 0,
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
      min_work_hours_half_day_min: policy.min_work_hours_half_day_min,
      max_late_check_in_time: policy.max_late_check_in_time,
      earlyCheckoutBeforeEndMin: policy.earlyCheckoutBeforeEndMin,
      allow_self_mark_attendance: policy.allow_self_mark_attendance,
      allow_manager_update_ot: policy.allow_manager_update_ot,
      max_ot_hours_per_day_min: policy.max_ot_hours_per_day_min,
      overtimeApplicable: policy.overtimeApplicable || false,
      minOvertimeHrs: policy.minOvertimeHrs || 0,
      maxOvertimeHrs: policy.maxOvertimeHrs || 0,
      overtimeTrimmingApply: policy.overtimeTrimmingApply || false,
      checkoutGracePeriodForOvertimeTrimming: policy.checkoutGracePeriodForOvertimeTrimming || 0,
      breakTimeForOT: policy.breakTimeForOT || 0,
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
        {canManage && (
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
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                {user?.role === "SUPERADMIN" && (
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

                {user?.role === "MANAGER" && (
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

              <div className="space-y-2">
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
                  required
                />
              </div>

              {/* Check-In/Check-Out Configuration */}
              <div className="space-y-4">
                <h3 className="text-lg font-semibold">Check-In/Check-Out Configuration</h3>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="checkin_begin_before_min">Check-In Begin Before (Minutes)</Label>
                    <div className="flex items-center space-x-2">
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
                        className="flex-1"
                        required
                      />
                      <span className="text-sm text-gray-500">Min</span>
                    </div>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="checkout_end_after_min">Check-Out End After (Minutes)</Label>
                    <div className="flex items-center space-x-2">
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
                        className="flex-1"
                        required
                      />
                      <span className="text-sm text-gray-500">Min</span>
                    </div>
                  </div>
                </div>
              </div>

              {/* Grace Time and Minimum Hours */}
              <div className="space-y-4">
                <h3 className="text-lg font-semibold">Grace Time and Minimum Hours</h3>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="checkin_grace_time_min">Check-In Grace Time (Minutes)</Label>
                    <div className="flex items-center space-x-2">
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
                        className="flex-1"
                        required
                      />
                      <span className="text-sm text-gray-500">Min</span>
                    </div>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="min_work_hours_half_day_min">
                      Minimum Work Hours for Half Day (Minutes)
                    </Label>
                    <div className="flex items-center space-x-2">
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
                        className="flex-1"
                        required
                      />
                      <span className="text-sm text-gray-500">Min</span>
                    </div>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="max_late_check_in_time">Max Late Check-In Time (Minutes)</Label>
                    <div className="flex items-center space-x-2">
                      <Input
                        id="max_late_check_in_time"
                        type="text"
                        value={formData.max_late_check_in_time}
                        onChange={(e) => {
                          const value = e.target.value.replace(/\D/g, "");
                          setFormData((prev) => ({
                            ...prev,
                            max_late_check_in_time: parseInt(value) || 0,
                          }));
                        }}
                        className="flex-1"
                        required
                      />
                      <span className="text-sm text-gray-500">Min</span>
                    </div>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="earlyCheckoutBeforeEndMin">Early Checkout Before End (Minutes)</Label>
                    <div className="flex items-center space-x-2">
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
                        className="flex-1"
                        required
                      />
                      <span className="text-sm text-gray-500">Min</span>
                    </div>
                  </div>
                </div>
              </div>

              {/* Mark As + Late Marks */}
              <div className="flex items-center space-x-3">
                <Label className="whitespace-nowrap">Mark as</Label>
                <select
                  value={formData.markAs}
                  onChange={(e) =>
                    setFormData((p) => ({
                      ...p,
                      markAs: e.target.value as "Absent" | "Half Day" | "",
                    }))
                  }
                  className="px-3 py-2 border border-gray-300 rounded-sm border-[#d0d0d0] focus:outline-none focus-visible:ring-2 focus-visible:ring-gray-900/15 focus-visible:border-[#b0b0b0]"
                >
                  <option value="">Select</option>
                  <option value="Absent">Absent</option>
                  <option value="Half Day">Half Day</option>
                </select>

                <Label className="whitespace-nowrap">After</Label>
                <Input
                  type="text"
                  min={0}
                  value={formData.lateMarkCount}
                  onChange={(e) =>
                    setFormData((p) => ({
                      ...p,
                      lateMarkCount: e.target.value,
                    }))
                  }
                  className="w-20"
                  placeholder="0"
                />

                <Label className="whitespace-nowrap">Late Marks</Label>
              </div>

              {/* Page Break - Overtime Configuration Section */}
              <div className="border-t border-gray-200 pt-4">
                <div className="space-y-4">
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
                    <Label htmlFor="overtimeApplicable" className="text-sm font-medium">
                      Overtime Applicable
                    </Label>
                  </div>

                  {formData.overtimeApplicable && (
                    <div className="ml-6 space-y-4">
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                        <div className="space-y-2">
                          <Label htmlFor="minOvertimeHrs">Min Overtime Hrs (Minutes)</Label>
                          <div className="flex items-center space-x-2">
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
                              className="flex-1"
                              placeholder="Enter minimum overtime hours"
                            />
                            <span className="text-sm text-gray-500">Min</span>
                          </div>
                        </div>

                        <div className="space-y-2">
                          <Label htmlFor="maxOvertimeHrs">Max Overtime Hrs (Minutes)</Label>
                          <div className="flex items-center space-x-2">
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
                              className="flex-1"
                              placeholder="Enter maximum overtime hours"
                            />
                            <span className="text-sm text-gray-500">Min</span>
                          </div>
                        </div>

                        <div className="space-y-2">
                          <Label htmlFor="breakTimeForOT">Break Time for OT (Minutes)</Label>
                          <div className="flex items-center space-x-2">
                            <Input
                              id="breakTimeForOT"
                              type="text"
                              value={formData.breakTimeForOT ?? 0}
                              onChange={(e) => {
                                const value = e.target.value.replace(/\D/g, "");
                                setFormData((prev) => ({
                                  ...prev,
                                  breakTimeForOT: parseInt(value) || 0,
                                }));
                              }}
                              className="flex-1"
                              placeholder="Enter break time for OT"
                            />
                            <span className="text-sm text-gray-500">Min</span>
                          </div>
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              </div>

              {/* Page Break - Overtime Trimming Section */}
              <div className="border-t border-gray-200 pt-4">
                <div className="space-y-4">
                  <div className="flex items-center space-x-3">
                    <input
                      type="checkbox"
                      id="overtimeTrimmingApply"
                      checked={formData.overtimeTrimmingApply}
                      onChange={(e) =>
                        setFormData((prev) => ({
                          ...prev,
                          overtimeTrimmingApply: e.target.checked,
                        }))
                      }
                      className="w-4 h-4 text-blue-600 bg-gray-100 border-gray-300 rounded focus:ring-blue-500"
                    />
                    <Label htmlFor="overtimeTrimmingApply" className="text-sm font-medium">
                      Overtime Trimming Apply
                    </Label>
                  </div>

                  {formData.overtimeTrimmingApply && (
                    <div className="ml-6 space-y-4">
                      <div className="grid grid-cols-1 gap-4">
                        <div className="space-y-2">
                          <Label htmlFor="checkoutGracePeriodForOvertimeTrimming">
                            Checkout grace period for overtime trimming (Minutes)
                          </Label>
                          <div className="flex items-center space-x-2">
                            <Input
                              id="checkoutGracePeriodForOvertimeTrimming"
                              type="text"
                              value={formData.checkoutGracePeriodForOvertimeTrimming}
                              onChange={(e) => {
                                const value = e.target.value.replace(/\D/g, "");
                                setFormData((prev) => ({
                                  ...prev,
                                  checkoutGracePeriodForOvertimeTrimming: parseInt(value) || 0,
                                }));
                              }}
                              className="flex-1"
                              placeholder="Enter grace period in minutes"
                            />
                            <span className="text-sm text-gray-500">Min</span>
                          </div>
                          <p className="text-xs text-gray-500">
                            Grace period after checkout before overtime trimming is applied
                          </p>
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              </div>

              <div className="flex justify-end gap-3 pt-4">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setIsDialogOpen(false)}
                >
                  Cancel
                </Button>
                <Button type="submit" className="">
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
                  <TableHead className="w-[120px]">Service Provider</TableHead>
                  <TableHead className="w-[120px]">Company Name</TableHead>
                  <TableHead className="w-[120px]">Branch Name</TableHead>
                  <TableHead className="w-[150px]">Policy Name</TableHead>
                  <TableHead className="w-[100px]">Overtime</TableHead>
                  <TableHead className="w-[100px]">Created</TableHead>
                  <TableHead className="w-[80px] text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredPolicies.length === 0 ? (
                  <TableRow>
                    <TableCell
                      colSpan={7}
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
                      <TableCell className="whitespace-nowrap">
                        {policy.serviceProvider}
                      </TableCell>
                      <TableCell className="whitespace-nowrap">
                        {policy.companyName}
                      </TableCell>
                      <TableCell className="whitespace-nowrap">
                        {policy.branchName}
                      </TableCell>
                      <TableCell className="font-medium whitespace-nowrap">
                        {policy.attendancePolicyName}
                      </TableCell>
                      <TableCell className="whitespace-nowrap text-center">
                        {policy.overtimeApplicable ? (
                          <Badge variant="outline" className="bg-green-50 text-green-700">
                            Yes
                          </Badge>
                        ) : (
                          <Badge variant="outline" className="bg-gray-50 text-gray-500">
                            No
                          </Badge>
                        )}
                      </TableCell>
                      <TableCell className="whitespace-nowrap">
                        {policy.createdAt}
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