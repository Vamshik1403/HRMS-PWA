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
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "../components/ui/dialog";
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

interface DaySchedule {
  day: string;
  startTime: string;
  endTime: string;
  totalHours: number;
  isWeeklyOff: boolean;
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
  const [workShifts, setWorkShifts] = useState<WorkShift[]>([]);
  const [searchTerm, setSearchTerm] = useState("");
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingWorkShift, setEditingWorkShift] = useState<WorkShift | null>(
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
    workShiftName: "",
    workShiftType: "",
    isFlexible: false,
    isRotating: false,
    serviceProviderID: undefined as number | undefined,
    companyID: undefined as number | undefined,
    branchesID: undefined as number | undefined,
    breakTimeMin: 0,
    weeklySchedule: DAYS_OF_WEEK.map((day) => ({
      day,
      startTime: "10:00",
      endTime: "18:00",
      totalHours: 8,
      isWeeklyOff: false,
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
    process.env.NEXT_PUBLIC_BACKEND_URL || "http://localhost:8000";


  // Load mapping for MANAGER
  useEffect(() => {
    if (user?.role !== "MANAGER") return;

    (async () => {
      const res = await fetch("http://localhost:8000/users");
      const list = await res.json();
      const me = list.find((u: any) => u.username === user.username);
      setCurrentUserMapping(me || null);
    })();
  }, [user]);

  // Auto-inject mapped IDs for MANAGER
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
      return [];
    }
  };

  const fetchCompanies = async (query: string) => {
    try {
      const spID =
        user?.role === "MANAGER"
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
      return [];
    }
  };


  const fetchBranches = async (query: string) => {
    try {
      const companyID =
        user?.role === "MANAGER"
          ? currentUserMapping?.companyID
          : formData.companyID;

      if (!companyID) return [];

      const res = await fetch(`${BACKEND_URL}/branches`, { cache: "no-store" });
      const data = await res.json();
      const q = query.toLowerCase();

      return Array.isArray(data)
        ? data.filter(
          (item: any) =>
            item.companyID === companyID &&
            (item.branchName || "").toLowerCase().includes(q)
        )
        : [];
    } catch (error) {
      console.error("Error fetching branches:", error);
      return [];
    }
  };


  // Load work shifts on component mount
  useEffect(() => {
    if (user) loadWorkShifts();
  }, [user]);


  const loadWorkShifts = async () => {
    try {
      const res = await fetch(`${BACKEND_URL}/work-shift`, { cache: "no-store" });
      const data = await res.json();
      const all = Array.isArray(data) ? data : [];

      // Map & normalize shifts
      const mapped = all.map((shift: any) => ({
        id: shift.id.toString(),
        serviceProviderID: shift.serviceProviderID,
        companyID: shift.companyID,
        branchesID: shift.branchesID,
        serviceProvider: shift.serviceProvider?.companyName || "",
        companyName: shift.company?.companyName || "",
        branchName: shift.branches?.branchName || "",
        workShiftName: shift.workShiftName,
        isFlexible: shift.isFlexible || false,
        isRotating: shift.isRotating || false,
        workShiftType: shift.workShiftType || "",
        breakTimeMin: shift.breakTimeMin || 0,
        weeklySchedule:
          shift.workShiftDay?.map((day: any) => ({
            day: day.weekDay,
            startTime: formatDbTime(day.startTime) || "10:00",
            endTime: formatDbTime(day.endTime) || "18:00",
            totalHours: day.totalMinutes
              ? Math.round((day.totalMinutes / 60) * 10) / 10
              : 8,
            isWeeklyOff: day.weeklyOff || false,
          })) || [],
        createdAt: shift.createdAt
          ? new Date(shift.createdAt).toISOString().split("T")[0]
          : new Date().toISOString().split("T")[0],
      }));

      // Role-based filtering
      if (user?.role === "SUPERADMIN") {
        setWorkShifts(mapped);
        return;
      }

      if (user?.role === "MANAGER") {
        const usersRes = await fetch(`${BACKEND_URL}/users`);
        const users = await usersRes.json();
        const currentUser = users.find((u: any) => u.username === user.username);

        if (currentUser) {
          const filtered = mapped.filter(
            (s) =>
              s.companyID === currentUser.companyID &&
              s.branchesID === currentUser.branchesID
          );
          setWorkShifts(filtered);
          return;
        }
      }

      const credsRes = await fetch(`${BACKEND_URL}/manage-emp/credentials/all`);
      const creds = await credsRes.json();
      const emp = creds.find((c: any) => c.username === user?.username);

      if (emp) {
        const filtered = mapped.filter(
          (s) =>
            s.companyID === emp.companyID &&
            s.branchesID === emp.branchesID
        );
        setWorkShifts(filtered);
      } else {
        setWorkShifts([]);
      }
    } catch (error) {
      console.error("Error loading work shifts:", error);
      setWorkShifts([]);
    }
  };



  const filteredWorkShifts = workShifts.filter(
    (workShift) =>
      workShift.workShiftName
        .toLowerCase()
        .includes(searchTerm.toLowerCase()) ||
      workShift.isFlexible === (searchTerm.toLowerCase() === "flexible") ||
      workShift.isRotating === (searchTerm.toLowerCase() === "rotating") ||
      workShift.workShiftType
        ?.toLowerCase()
        .includes(searchTerm.toLowerCase()) ||
      (workShift.serviceProvider || "")
        .toLowerCase()
        .includes(searchTerm.toLowerCase()) ||
      (workShift.companyName || "")
        .toLowerCase()
        .includes(searchTerm.toLowerCase()) ||
      (workShift.branchName || "")
        .toLowerCase()
        .includes(searchTerm.toLowerCase())
  );

  const calculateTotalHours = (startTime: string, endTime: string, breakMin?: number): number => {
    const [startHour, startMin] = startTime.split(":").map(Number);
    const [endHour, endMin] = endTime.split(":").map(Number);

    const startMinutes = startHour * 60 + startMin;
    const endMinutes = endHour * 60 + endMin;

    const diffMinutes = endMinutes - startMinutes - (breakMin || 0);
    return Math.round((Math.max(0, diffMinutes) / 60) * 10) / 10;
  };

  const handleTimeChange = (
    dayIndex: number,
    field: "startTime" | "endTime",
    value: string,
    event?: React.ChangeEvent<HTMLInputElement>
  ) => {
    const updatedSchedule = [...formData.weeklySchedule];
    updatedSchedule[dayIndex] = {
      ...updatedSchedule[dayIndex],
      [field]: value,
    };

    const totalHours = calculateTotalHours(
      updatedSchedule[dayIndex].startTime,
      updatedSchedule[dayIndex].endTime,
      formData.breakTimeMin
    );
    updatedSchedule[dayIndex].totalHours = totalHours;

    setFormData((prev) => ({
      ...prev,
      weeklySchedule: updatedSchedule,
    }));

    if (event?.target) {
      event.target.blur();
    }
  };

  const handleWeeklyOffChange = (dayIndex: number, isWeeklyOff: boolean) => {
    const updatedSchedule = [...formData.weeklySchedule];
    updatedSchedule[dayIndex] = {
      ...updatedSchedule[dayIndex],
      isWeeklyOff,
      totalHours: isWeeklyOff ? 0 : updatedSchedule[dayIndex].totalHours,
    };

    setFormData((prev) => ({
      ...prev,
      weeklySchedule: updatedSchedule,
    }));
  };

  // New function to handle isRotating change and reset weekly off checkboxes
  const handleIsRotatingChange = (checked: boolean) => {
    setFormData(prev => ({
      ...prev,
      isRotating: checked,
      // If isRotating is checked, set all weekly off checkboxes to false and disable them
      weeklySchedule: checked 
        ? prev.weeklySchedule.map(day => ({
            ...day,
            isWeeklyOff: false // Reset all weekly off to false
          }))
        : prev.weeklySchedule
    }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    try {
      const toDateTime = (time: string) => {
        const [h, m] = time.split(":").map(Number);
        const now = new Date();
        return new Date(Date.UTC(now.getFullYear(), now.getMonth(), now.getDate(), h, m, 0));
      };

      const workShiftDays = formData.weeklySchedule.map((day) => ({
        weekDay: day.day,
        weeklyOff: day.isWeeklyOff,
        startTime: day.isWeeklyOff ? null : toDateTime(day.startTime),
        endTime: day.isWeeklyOff ? null : toDateTime(day.endTime),
        totalMinutes: day.isWeeklyOff ? 0 : Math.max(0, Math.round(day.totalHours * 60)),
      }));

      const workShiftData = {
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
        workShiftName: formData.workShiftName,
        isFlexible: formData.isFlexible,
        isRotating: formData.isRotating,
        workShiftType: formData.workShiftType,
        isActive: "1",
        breakTimeMin: formData.breakTimeMin || 0,
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
      resetForm();
      setIsDialogOpen(false);
    } catch (error) {
      console.error("Error saving work shift:", error);
    }
  };


  const resetForm = () => {
    setFormData({
      serviceProvider: "",
      companyName: "",
      branchName: "",
      workShiftName: "",
      isFlexible: false,
      isRotating: false,
      workShiftType: "",
      serviceProviderID: undefined,
      companyID: undefined,
      branchesID: undefined,
      breakTimeMin: 0,
      weeklySchedule: DAYS_OF_WEEK.map((day) => ({
        day,
        startTime: "10:00",
        endTime: "18:00",
        totalHours: 8,
        isWeeklyOff: false,
      })),
    });
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
    const breakMin = (workShift as any).breakTimeMin || 0;
    setFormData({
      serviceProvider: workShift.serviceProvider || "",
      companyName: workShift.companyName || "",
      branchName: workShift.branchName || "",
      workShiftName: workShift.workShiftName,
      isFlexible: workShift.isFlexible || false,
      isRotating: workShift.isRotating || false,
      workShiftType: workShift.workShiftType || "",
      serviceProviderID: workShift.serviceProviderID,
      companyID: workShift.companyID,
      branchesID: workShift.branchesID,
      breakTimeMin: breakMin,
      weeklySchedule: workShift.weeklySchedule.map((day) => {
        const st = formatDbTime(day.startTime) || "10:00";
        const et = formatDbTime(day.endTime) || "18:00";
        return {
          ...day,
          startTime: st,
          endTime: et,
          totalHours: day.isWeeklyOff ? 0 : calculateTotalHours(st, et, breakMin),
        };
      }),
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
    } catch (error) {
      console.error("Error deleting work shift:", error);
    }
  };

  return (
    <div className="space-y-6 w-full max-w-6xl mx-auto px-4">
      {/* Header */}
      <div className="flex items-center justify-between w-full">
        <div className="min-w-0 flex-1">
          <h1 className="text-2xl font-bold text-gray-900">Work Shifts</h1>
          <p className="text-gray-600 mt-1 text-sm">
            Manage work shifts and schedules
          </p>
        </div>
        <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
          <DialogTrigger asChild>
            {canManage && (
              <Button
                onClick={resetForm}
                className="bg-blue-600 hover:bg-blue-700 flex-shrink-0 text-sm px-3 py-2"
              >
                <Plus className="w-4 h-4 mr-1" />
                Add Work Shift
              </Button>
            )}
          </DialogTrigger>
          <DialogContent className="sm:max-w-[800px] max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>
                {editingWorkShift ? "Edit Work Shift" : "Add New Work Shift"}
              </DialogTitle>
              <DialogDescription>
                {editingWorkShift
                  ? "Update the work shift information below."
                  : "Fill in the details to add a new work shift."}
              </DialogDescription>
            </DialogHeader>
            <form
              onSubmit={(e) => {
                e.preventDefault();
                handleSubmit(e);
              }}
              className="space-y-6"
            >
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                {/* SUPERADMIN → Show SP + Company + Branch */}
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

                {/* MANAGER → Only Branch input */}
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
                    fetchData={async (query) => {
                      const res = await fetch(`${BACKEND_URL}/branches`);
                      const data = await res.json();
                      const q = query.toLowerCase();
                      return data
                        .filter(
                          (b: any) =>
                            b.companyID === currentUserMapping?.companyID &&
                            (b.branchName || "").toLowerCase().includes(q)
                        );
                    }}
                    displayField="branchName"
                    valueField="id"
                    required
                  />
                )}

                {/* SUPERADMIN → Branch input */}
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

              <div className="space-y-2">
                <Label htmlFor="breakTimeMin">Break Time (Minutes)</Label>
                <div className="flex items-center space-x-2">
                  <Input
                    id="breakTimeMin"
                    type="text"
                    value={(formData as any).breakTimeMin ?? 0}
                    onChange={(e) => {
                      const value = e.target.value.replace(/\D/g, "");
                      const breakMin = parseInt(value) || 0;
                      setFormData((prev) => ({
                        ...prev,
                        breakTimeMin: breakMin,
                        weeklySchedule: prev.weeklySchedule.map((day) => ({
                          ...day,
                          totalHours: day.isWeeklyOff ? 0 : calculateTotalHours(day.startTime, day.endTime, breakMin),
                        })),
                      } as any));
                    }}
                    className="flex-1"
                    placeholder="0"
                  />
                  <span className="text-sm text-gray-500">Min</span>
                </div>
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
                {formData.isRotating && (
                  <p className="text-xs text-amber-600 bg-amber-50 p-2 rounded">
                    ⚠️ Rotating shifts cannot have weekly off days. Weekly off checkboxes are disabled.
                  </p>
                )}
              </div>

              {/* Weekly Schedule */}
              <div className="space-y-4">
                <h3 className="text-lg font-semibold">Default Working Hours</h3>
                <div className="overflow-x-auto">
                  <table className="w-full border-collapse border border-gray-300">
                    <thead>
                      <tr className="bg-gray-50">
                        <th className="border border-gray-300 px-3 py-2 text-left font-medium">
                          Day
                        </th>
                        <th className="border border-gray-300 px-3 py-2 text-left font-medium">
                          Start Time
                        </th>
                        <th className="border border-gray-300 px-3 py-2 text-left font-medium">
                          End Time
                        </th>
                        <th className="border border-gray-300 px-3 py-2 text-left font-medium">
                          Break Time
                        </th>
                        <th className="border border-gray-300 px-3 py-2 text-left font-medium">
                          Total Hours
                        </th>
                        <th className="border border-gray-300 px-3 py-2 text-left font-medium">
                          Weekly Off
                        </th>
                       </tr>
                    </thead>
                    <tbody>
                      {formData.weeklySchedule.map((daySchedule, index) => (
                        <tr key={daySchedule.day}>
                          <td className="border border-gray-300 px-3 py-2 font-medium">
                            {daySchedule.day}
                           </td>
                          <td className="border border-gray-300 px-3 py-2">
                            <Input
                              type="time"
                              value={daySchedule.startTime}
                              onChange={(e) =>
                                handleTimeChange(
                                  index,
                                  "startTime",
                                  e.target.value,
                                  e
                                )
                              }
                              disabled={daySchedule.isWeeklyOff || formData.isRotating}
                              className="w-full"
                            />
                           </td>
                          <td className="border border-gray-300 px-3 py-2">
                            <Input
                              type="time"
                              value={daySchedule.endTime}
                              onChange={(e) =>
                                handleTimeChange(
                                  index,
                                  "endTime",
                                  e.target.value,
                                  e
                                )
                              }
                              disabled={daySchedule.isWeeklyOff || formData.isRotating}
                              className="w-full"
                            />
                           </td>
                          <td className="border border-gray-300 px-3 py-2 text-center">
                            <span className="text-sm text-gray-600">
                              {daySchedule.isWeeklyOff ? "—" : `${formData.breakTimeMin || 0}m`}
                            </span>
                           </td>
                          <td className="border border-gray-300 px-3 py-2 text-center">
                            <span className="font-medium">
                              {daySchedule.totalHours}h
                            </span>
                           </td>
                          <td className="border border-gray-300 px-3 py-2 text-center">
                            <input
                              type="checkbox"
                              checked={daySchedule.isWeeklyOff}
                              onChange={(e) =>
                                handleWeeklyOffChange(index, e.target.checked)
                              }
                              disabled={formData.isRotating}
                              className="w-4 h-4 text-blue-600 bg-gray-100 border-gray-300 rounded focus:ring-blue-500 disabled:opacity-50 disabled:cursor-not-allowed"
                            />
                           </td>
                         </tr>
                      ))}
                    </tbody>
                   </table>
                </div>
              </div>

              <DialogFooter>
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setIsDialogOpen(false)}
                >
                  Cancel
                </Button>
                <Button type="submit" className="bg-blue-600 hover:bg-blue-700">
                  {editingWorkShift ? "Update Work Shift" : "Add Work Shift"}
                </Button>
              </DialogFooter>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      {/* Search and Filters */}
      <Card>
        <CardContent className="p-6">
          <div className="flex items-center space-x-4 w-full">
            <div className="relative flex-1 min-w-0">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
              <Input
                placeholder="Search work shifts..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-10 w-full"
              />
            </div>
            <Badge variant="secondary" className="px-3 py-1 flex-shrink-0">
              {filteredWorkShifts.length} work shifts
            </Badge>
          </div>
        </CardContent>
      </Card>

      {/* Work Shifts Table */}
      <Card className="w-full">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Icon icon="mdi:clock-outline" className="w-5 h-5" />
            Work Shifts List
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
                  <TableHead className="w-[150px]">Work Shift Name</TableHead>
                  <TableHead className="w-[100px]">Type</TableHead>
                  <TableHead className="w-[200px]">Schedule</TableHead>
                  <TableHead className="w-[100px]">Break Time</TableHead>
                  <TableHead className="w-[100px]">
                    Total Weekly Hours
                  </TableHead>
                  <TableHead className="w-[100px]">Created</TableHead>
                  <TableHead className="w-[80px] text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredWorkShifts.length === 0 ? (
                  <TableRow>
                    <TableCell
                      colSpan={10}
                      className="text-center py-8 text-gray-500"
                    >
                      <div className="flex flex-col items-center gap-2">
                        <Icon
                          icon="mdi:clock-outline"
                          className="w-12 h-12 text-gray-300"
                        />
                        <p>No work shifts found</p>
                        <p className="text-sm">
                          Try adjusting your search criteria
                        </p>
                      </div>
                    </TableCell>
                  </TableRow>
                ) : (
                  filteredWorkShifts.map((workShift) => {
                    const totalWeeklyHours = workShift.weeklySchedule
                      .filter((day) => !day.isWeeklyOff)
                      .reduce((sum, day) => {
                        const breakHours = ((workShift as any).breakTimeMin || 0) / 60;
                        return sum + Math.max(0, day.totalHours - breakHours);
                      }, 0);

                    const breakTimeMin = (workShift as any).breakTimeMin || 0;

                    const scheduleSummary = workShift.weeklySchedule
                      .filter((day) => !day.isWeeklyOff)
                      .map((day) => `${day.day}: ${formatDbTime(day.startTime)}-${formatDbTime(day.endTime)}`)
                      .join(", ");

                    const shiftType = [];
                    if (workShift.isFlexible) shiftType.push("Flexible");
                    if (workShift.isRotating) shiftType.push("Rotating");
                    const shiftTypeDisplay = shiftType.length > 0 ? shiftType.join(", ") : "Regular";

                    return (
                      <TableRow key={workShift.id}>
                        <TableCell className="whitespace-nowrap">
                          {workShift.serviceProvider}
                        </TableCell>
                        <TableCell className="whitespace-nowrap">
                          {workShift.companyName}
                        </TableCell>
                        <TableCell className="whitespace-nowrap">
                          {workShift.branchName}
                        </TableCell>
                        <TableCell className="font-medium whitespace-nowrap">
                          {workShift.workShiftName}
                        </TableCell>
                        <TableCell className="whitespace-nowrap">
                          <Badge variant="outline">{shiftTypeDisplay}</Badge>
                        </TableCell>
                        <TableCell className="whitespace-nowrap text-sm">
                          <div
                            className="max-w-[180px] truncate"
                            title={scheduleSummary}
                          >
                            {scheduleSummary || "No working days"}
                          </div>
                        </TableCell>
                        <TableCell className="whitespace-nowrap text-center">
                          <Badge variant="outline">{breakTimeMin > 0 ? `${breakTimeMin}m` : "—"}</Badge>
                        </TableCell>
                        <TableCell className="whitespace-nowrap text-center">
                          <Badge variant="outline">{Math.round(totalWeeklyHours * 10) / 10}h</Badge>
                        </TableCell>
                        <TableCell className="whitespace-nowrap">
                          {workShift.createdAt}
                        </TableCell>
                        <TableCell className="text-right whitespace-nowrap">
                          <div className="flex items-center justify-end gap-1">
                            {canManage && (
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => handleEdit(workShift)}
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
                                onClick={() => handleDelete(workShift.id)}
                                className="h-7 w-7 p-0 text-red-600 hover:text-red-700 hover:bg-red-50"
                                title="Delete"
                              >
                                <Trash2 className="w-3 h-3" />
                              </Button>
                            )}
                          </div>
                        </TableCell>
                      </TableRow>
                    );
                  })
                )}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}