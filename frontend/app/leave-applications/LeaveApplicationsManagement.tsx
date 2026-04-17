"use client"

import { useState, useEffect } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "../components/ui/card"
import { Button } from "../components/ui/button"
import { Input } from "../components/ui/input"
import { Label } from "../components/ui/label"
import { FormDrawer } from "../components/ui/form-drawer";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "../components/ui/table"
import { Badge } from "../components/ui/badge"
import { Icon } from "@iconify/react"
import { Plus, Search, Edit, Trash2, Check, X } from "lucide-react"
import { useCurrentUser } from "../hooks/useCurrentUser"
import { SearchSuggestInput } from "../components/SearchSuggestInput"
import { toast } from "sonner";
import { getSidebarContext } from "../utils/sidebarContext";

interface LeaveApplication {
  id: string
  serviceProviderID?: number
  companyID?: number
  branchesID?: number
  manageEmployeeID?: number
  serviceProvider?: string
  companyName?: string
  branchName?: string
  employeeId?: string
  employeeName?: string
  remainingSickLeave?: number
  remainingCasualLeave?: number
  appliedLeaveType?: string
  fromDate: string
  toDate: string
  purpose?: string
  status?: "Pending" | "Approved" | "Rejected" | "RevokePending" | "Revoked" | "Accepted"
  createdAt: string
}

interface SelectedItem {
  display: string
  value: number
  item: any
}

interface DayStatus {
  date: string
  status: "Sick" | "Casual" | "Privileged" | "ShortLeave" | "CompOff" | "LoP" | "MtL" | "PtL" | ""
  dayType?: "Present" | "LateMark" | "Halfday" | "Absent" | ""
}

interface LeaveBalanceEntry { used: number; total: number; remaining: number }

interface LeaveBalance {
  sick: LeaveBalanceEntry
  casual: LeaveBalanceEntry
  privileged: LeaveBalanceEntry
  compOff: LeaveBalanceEntry
  maternity: LeaveBalanceEntry
  paternity: LeaveBalanceEntry
}

// Backend URL
const BACKEND_URL = process.env.NEXT_PUBLIC_BACKEND_URL || "/backend"

export function LeaveApplicationsManagement() {
  const [leaveApplications, setLeaveApplications] = useState<LeaveApplication[]>([])
  const [searchTerm, setSearchTerm] = useState("")
  const [isDialogOpen, setIsDialogOpen] = useState(false)
  const [editingApplication, setEditingApplication] = useState<LeaveApplication | null>(null)
  const [formData, setFormData] = useState({
    serviceProvider: "",
    companyName: "",
    branchName: "",
    employeeName: "",
    leaveType: "",
    fromDate: "",
    toDate: "",
    purpose: "",
    serviceProviderID: undefined as number | undefined,
    companyID: undefined as number | undefined,
    branchesID: undefined as number | undefined,
    manageEmployeeID: undefined as number | undefined,
  })

  const [selectedEmployee, setSelectedEmployee] = useState<any | null>(null)
  const [managerData, setManagerData] = useState<any>(null)
  const [empCreds, setEmpCreds] = useState<any>(null)
  // Dynamic Leave Types
  const [availableLeaveTypes, setAvailableLeaveTypes] = useState<string[]>(["LoP"])
  const [isEmployeeSelected, setIsEmployeeSelected] = useState(false)
  const [leaveBalance, setLeaveBalance] = useState<LeaveBalance>({
    sick: { used: 0, total: 0, remaining: 0 },
    casual: { used: 0, total: 0, remaining: 0 },
    privileged: { used: 0, total: 0, remaining: 0 },
    compOff: { used: 0, total: 0, remaining: 0 },
    maternity: { used: 0, total: 0, remaining: 0 },
    paternity: { used: 0, total: 0, remaining: 0 },
  })

  const user = useCurrentUser()
  const canManage = user?.role === "SUPERADMIN" || user?.role === "SERVICE_PROVIDER" || user?.role === "COMPANY_ADMIN"
  const isNormalUser = user?.role === "EMPLOYEE"

  // Revoke Modal State
  const [isRevokeDialogOpen, setIsRevokeDialogOpen] = useState(false)
  const [revokeReason, setRevokeReason] = useState("")
  const [revokeApplication, setRevokeApplication] = useState<LeaveApplication | null>(null)

  // Manager Approval Modal State
  const [isManagerApprovalDialogOpen, setIsManagerApprovalDialogOpen] = useState(false)
  const [managerApprovalApplication, setManagerApprovalApplication] = useState<LeaveApplication | null>(null)
  const [dayStatuses, setDayStatuses] = useState<DayStatus[]>([])
  const [pendingDaysCount, setPendingDaysCount] = useState(0)
  const [availableLeaveTypesForManager, setAvailableLeaveTypesForManager] = useState<string[]>(["LoP"])
  const [managerLeaveBalance, setManagerLeaveBalance] = useState<LeaveBalance>({
    sick: { used: 0, total: 0, remaining: 0 },
    casual: { used: 0, total: 0, remaining: 0 },
    privileged: { used: 0, total: 0, remaining: 0 },
    compOff: { used: 0, total: 0, remaining: 0 },
    maternity: { used: 0, total: 0, remaining: 0 },
    paternity: { used: 0, total: 0, remaining: 0 },
  })
  const [currentAvailableTypes, setCurrentAvailableTypes] = useState<string[]>(["LoP"])

  // Load user data based on role
  useEffect(() => {
    if (!user) return;

    const loadUserData = async () => {
      try {
        // --- MANAGER ---
        if (user.role === "SERVICE_PROVIDER") {
          const usersRes = await fetch(`${BACKEND_URL}/users`);
          const users = await usersRes.json();
          const me = users.find((u: any) => u.username === user.username);
          setManagerData(me || null);
        }

        // --- EMPLOYEE ---
        if (user.role === "EMPLOYEE") {
          const credsRes = await fetch(`${BACKEND_URL}/manage-emp/credentials/all`);
          const creds = await credsRes.json();
          const me = creds.find((u: any) => u.username === user.username);
          setEmpCreds(me || null);
          
          // Auto-populate employee data for normal users
          if (me) {
            setFormData(prev => ({
              ...prev,
              manageEmployeeID: me.manageEmployeeID,
              employeeName: `${me.employeeFirstName || ""} ${me.employeeLastName || ""}`.trim()
            }));
            // Load leave types for the logged-in employee
            loadEmployeeLeaveTypes(me.manageEmployeeID);
            setIsEmployeeSelected(true);
          }
        }
      } catch (error) {
        console.error("Error loading user data:", error);
        toast.error("Failed to load data.");
      }
    };

    loadUserData();
  }, [user]);

  // Function to calculate leave balance for an employee
  const calculateLeaveBalance = async (employeeId: number) => {
    try {
      // 1. Fetch employee with leave policy
      const empRes = await fetch(`${BACKEND_URL}/manage-emp/${employeeId}`, {
        cache: "no-store",
      });
      const employee = await empRes.json();
      
      const policy = employee.leavePolicy || {};
      
      // Get policy limits
      const totalSick = Number(policy.sickLeaveCount) || 0;
      const totalCasual = Number(policy.casualLeaveCount) || 0;

      // Privileged Leave: fetch from ledger
      let totalPrivileged = 0;
      try {
        const plRes = await fetch(`${BACKEND_URL}/privileged-leave/employee/${employeeId}`, { cache: "no-store" });
        if (plRes.ok) {
          const plData = await plRes.json();
          if (Array.isArray(plData)) {
            totalPrivileged = plData.reduce((sum: number, entry: any) => sum + (Number(entry.balanceLeaves) || 0), 0);
          }
        }
      } catch { /* no PL data */ }

      // CompOff: count approved week-off/holiday overrides that are unused
      let totalCompOff = 0;
      try {
        const woRes = await fetch(`${BACKEND_URL}/employee-weekly-off?employeeID=${employeeId}`, { cache: "no-store" });
        if (woRes.ok) {
          const woData = await woRes.json();
          if (Array.isArray(woData)) {
            totalCompOff += woData.filter((w: any) => w.status === "Present").length;
          }
        }
      } catch { /* no compoff data */ }

      // Maternity / Paternity: static policy-based (commonly 180/15 days)
      const totalMaternity = 180;
      const totalPaternity = 15;

      // 2. Fetch all leave applications for this employee
      const leaveRes = await fetch(`${BACKEND_URL}/leave-application`);
      const allLeaves = await leaveRes.json();
      
      // Filter only this employee's APPROVED leaves
      const employeeApprovedLeaves = allLeaves.filter((leave: any) => 
        leave.manageEmployeeID === employeeId && leave.status === "Approved"
      );

      // 3. Calculate USED leave counts by type using dayStatuses
      let usedSick = 0;
      let usedCasual = 0;
      let usedPrivileged = 0;
      let usedCompOff = 0;
      let usedMaternity = 0;
      let usedPaternity = 0;

      employeeApprovedLeaves.forEach((leave: any) => {
        if (leave.dayStatuses && Array.isArray(leave.dayStatuses)) {
          leave.dayStatuses.forEach((day: any) => {
            switch (day.status) {
              case "Sick": usedSick += 1; break;
              case "Casual": usedCasual += 1; break;
              case "Privileged": usedPrivileged += 1; break;
              case "CompOff": usedCompOff += 1; break;
              case "MtL": usedMaternity += 1; break;
              case "PtL": usedPaternity += 1; break;
            }
          });
        } else {
          if (!leave.fromDate || !leave.toDate) return;
          const from = new Date(leave.fromDate);
          const to = new Date(leave.toDate);
          if (isNaN(from.getTime()) || isNaN(to.getTime())) return;
          const diffDays = Math.ceil(Math.abs(to.getTime() - from.getTime()) / (1000 * 60 * 60 * 24)) + 1;

          switch (leave.appliedLeaveType) {
            case "Sick": usedSick += diffDays; break;
            case "Casual": usedCasual += diffDays; break;
            case "Privileged": usedPrivileged += diffDays; break;
            case "CompOff": usedCompOff += diffDays; break;
            case "MtL": usedMaternity += diffDays; break;
            case "PtL": usedPaternity += diffDays; break;
          }
        }
      });

      const mkEntry = (used: number, total: number) => ({
        used: Math.min(used, total),
        total,
        remaining: Math.max(total - used, 0),
      });

      const balance: LeaveBalance = {
        sick: mkEntry(usedSick, totalSick),
        casual: mkEntry(usedCasual, totalCasual),
        privileged: mkEntry(usedPrivileged, totalPrivileged),
        compOff: mkEntry(usedCompOff, totalCompOff),
        maternity: mkEntry(usedMaternity, totalMaternity),
        paternity: mkEntry(usedPaternity, totalPaternity),
      };

      setLeaveBalance(balance);
      return balance;

    } catch (error) {
      console.error("Error calculating leave balance:", error);
      toast.error("Operation failed. Please try again.");
      const zero = { used: 0, total: 0, remaining: 0 };
      return {
        sick: zero, casual: zero, privileged: zero,
        compOff: zero, maternity: zero, paternity: zero,
      };
    }
  };

  // Function to load leave types for a specific employee
  const loadEmployeeLeaveTypes = async (employeeId: number) => {
    try {
      const balance = await calculateLeaveBalance(employeeId);
      
      // Build available Leave Types based on remaining leaves
      const types: string[] = [];

      if (balance.sick.remaining > 0) types.push("Sick");
      if (balance.casual.remaining > 0) types.push("Casual");
      if (balance.privileged.remaining > 0) types.push("Privileged");
      types.push("ShortLeave"); // Always available - marks as Present/LateMark/Halfday/Absent
      if (balance.compOff.remaining > 0) types.push("CompOff");
      types.push("LoP"); // Always available - unpaid absent
      if (balance.maternity.remaining > 0) types.push("MtL");
      if (balance.paternity.remaining > 0) types.push("PtL");

      console.log("Final Available Leave Types:", types);
      setAvailableLeaveTypes(types);

    } catch (error) {
      console.error("Error loading employee leave types:", error);
      toast.error("Failed to load data.");
      setAvailableLeaveTypes(["ShortLeave", "LoP"]);
    }
  };

  // === REVOKE HANDLERS ===
  const openRevokeModal = (application: LeaveApplication) => {
    setRevokeApplication(application)
    setRevokeReason("")
    setIsRevokeDialogOpen(true)
  }

  const handleRevokeSubmit = async () => {
    if (!revokeApplication) return

    try {
      const res = await fetch(`${BACKEND_URL}/leave-application/revoke/${revokeApplication.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ revokedReason: revokeReason }),
      })

      if (!res.ok) throw new Error(`Failed to revoke leave application: ${res.status}`)

      await loadLeaveApplications()
      setIsRevokeDialogOpen(false)
      toast.success("Revoke request submitted for approval.")
    } catch (error) {
      console.error("Error revoking leave application:", error)
      toast.error("Error submitting revoke request. Please try again.")
    }
  }

  // Function to update available leave types
  const updateAvailableLeaveTypes = (currentDayStatuses: DayStatus[]) => {
    const ob = { ...managerLeaveBalance };
    
    const countType = (t: string) => currentDayStatuses.filter(day => day.status === t).length;
    const sickDays = countType("Sick");
    const casualDays = countType("Casual");
    const privilegedDays = countType("Privileged");
    const compOffDays = countType("CompOff");
    const maternityDays = countType("MtL");
    const paternityDays = countType("PtL");

    const calc = (entry: LeaveBalanceEntry, used: number) => Math.max(entry.total - (entry.used + used), 0);
    const remainingSick = calc(ob.sick, sickDays);
    const remainingCasual = calc(ob.casual, casualDays);
    const remainingPrivileged = calc(ob.privileged, privilegedDays);
    const remainingCompOff = calc(ob.compOff, compOffDays);
    const remainingMaternity = calc(ob.maternity, maternityDays);
    const remainingPaternity = calc(ob.paternity, paternityDays);

    const types: string[] = [];
    if (remainingSick > 0) types.push("Sick");
    if (remainingCasual > 0) types.push("Casual");
    if (remainingPrivileged > 0) types.push("Privileged");
    types.push("ShortLeave");
    if (remainingCompOff > 0) types.push("CompOff");
    types.push("LoP");
    if (remainingMaternity > 0) types.push("MtL");
    if (remainingPaternity > 0) types.push("PtL");

    setCurrentAvailableTypes(types);
    
    return {
      sick: { ...ob.sick, remaining: remainingSick },
      casual: { ...ob.casual, remaining: remainingCasual },
      privileged: { ...ob.privileged, remaining: remainingPrivileged },
      compOff: { ...ob.compOff, remaining: remainingCompOff },
      maternity: { ...ob.maternity, remaining: remainingMaternity },
      paternity: { ...ob.paternity, remaining: remainingPaternity },
    };
  };

  // Day status change handler
  const handleDayStatusChange = (index: number, status: DayStatus["status"]) => {
    console.log("Changing day", index, "to:", status);
    
    // Create a new array with the updated day status
    const updatedDayStatuses = dayStatuses.map((day, i) => 
      i === index ? { ...day, status } : { ...day }
    );
    
    console.log("Updated dayStatuses:", updatedDayStatuses);
    
    // Update the state
    setDayStatuses(updatedDayStatuses);
    
    // Update available types and balance
    const updatedBalance = updateAvailableLeaveTypes(updatedDayStatuses);
    
    // Update pending count
    const pendingCount = updatedDayStatuses.filter(day => day.status === "").length;
    setPendingDaysCount(pendingCount);
    
    // Update balance for display
    setManagerLeaveBalance(updatedBalance);
  };

  // Manager approval modal opener
  const openManagerApprovalModal = async (application: LeaveApplication) => {
    setManagerApprovalApplication(application);
    
    // Calculate leave balance for this employee
    if (application.manageEmployeeID) {
      const balance = await calculateLeaveBalance(application.manageEmployeeID);
      setManagerLeaveBalance(balance);
      
      const types: string[] = [];
      if (balance.sick.remaining > 0) types.push("Sick");
      if (balance.casual.remaining > 0) types.push("Casual");
      if (balance.privileged.remaining > 0) types.push("Privileged");
      types.push("ShortLeave");
      if (balance.compOff.remaining > 0) types.push("CompOff");
      types.push("LoP");
      if (balance.maternity.remaining > 0) types.push("MtL");
      if (balance.paternity.remaining > 0) types.push("PtL");
      
      setAvailableLeaveTypesForManager(types);
      setCurrentAvailableTypes(types);
    }
    
    // Generate day statuses for each date in the leave period
    const fromDate = new Date(application.fromDate);
    const toDate = new Date(application.toDate);
    const days: DayStatus[] = [];
    
    // Create array of all dates in the range
    const currentDate = new Date(fromDate);
    while (currentDate <= toDate) {
      days.push({
        date: currentDate.toISOString().split('T')[0],
        status: ""
      });
      currentDate.setDate(currentDate.getDate() + 1);
    }
    
    console.log("Initialized dayStatuses:", days);
    setDayStatuses(days);
    setPendingDaysCount(days.length);
    setIsManagerApprovalDialogOpen(true);
  };

  const handleManagerApprovalSubmit = async () => {
    if (!managerApprovalApplication) return

    try {
      if (pendingDaysCount > 0) {
        toast.error("Please assign leave types for all days before approving.")
        return
      }

      // Calculate the main leave type (most frequent type used)
      const leaveTypeCounts: Record<string, number> = {};
      dayStatuses.forEach(day => {
        if (day.status && day.status !== "LoP" && day.status !== "ShortLeave") {
          leaveTypeCounts[day.status] = (leaveTypeCounts[day.status] || 0) + 1;
        }
      });

      let mainLeaveType = "LoP";
      let maxCount = 0;
      Object.entries(leaveTypeCounts).forEach(([type, count]) => {
        if (count > maxCount) {
          maxCount = count;
          mainLeaveType = type;
        }
      });

      if (maxCount === 0) {
        // Check if all are ShortLeave
        const shortLeaveDays = dayStatuses.filter(day => day.status === "ShortLeave").length;
        mainLeaveType = shortLeaveDays > 0 ? "ShortLeave" : "LoP";
      }

      const countType = (t: string) => dayStatuses.filter(day => day.status === t).length;

      const updateData = {
        status: "Approved" as const,
        appliedLeaveType: mainLeaveType,
        dayStatuses: dayStatuses,
        remainingSickLeave: Math.max(managerLeaveBalance.sick.total - (managerLeaveBalance.sick.used + countType("Sick")), 0),
        remainingCasualLeave: Math.max(managerLeaveBalance.casual.total - (managerLeaveBalance.casual.used + countType("Casual")), 0),
      };

      console.log("Sending update data:", updateData);

      const res = await fetch(`${BACKEND_URL}/leave-application/${managerApprovalApplication.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(updateData),
      })

      if (!res.ok) {
        const errorText = await res.text();
        throw new Error(`Failed to approve leave application: ${res.status} - ${errorText}`)
      }

      await loadLeaveApplications()
      setIsManagerApprovalDialogOpen(false)
      toast.success("Leave application approved successfully.")
    } catch (error) {
      console.error("Error approving leave application:", error)
      toast.error("Error approving leave application. Please try again.")
    }
  }

  // Accept handler - For RevokePending status, set to Accepted
  const handleAccept = async (id: string, isRevokeRequest: boolean = false) => {
    try {
      let endpoint, body;

      if (isRevokeRequest) {
        // For revoke requests, set status to "Accepted" to allow re-assignment
        endpoint = `${BACKEND_URL}/leave-application/${id}`;
        body = JSON.stringify({ status: "Accepted" });
      } else {
        // For regular pending leaves, set to "Accepted"
        endpoint = `${BACKEND_URL}/leave-application/${id}`;
        body = JSON.stringify({ status: "Accepted" });
      }

      const res = await fetch(endpoint, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: body,
      })
      
      if (!res.ok) {
        throw new Error(`Failed to accept ${isRevokeRequest ? 'revoke request' : 'leave application'}: ${res.status}`)
      }
      await loadLeaveApplications()
      toast.success(isRevokeRequest ? "Revoke request accepted" : "Leave application accepted");
    } catch (error) {
      console.error(`Error accepting ${isRevokeRequest ? 'revoke request' : 'leave application'}:`, error)
      toast.error("Operation failed. Please try again.");
    }
  }

  // Reject handler - For RevokePending status, set back to Approved
  const handleReject = async (id: string, isRevokeRequest: boolean = false) => {
    try {
      let endpoint, body;

      if (isRevokeRequest) {
        // For revoke requests, reject means keep it as "Approved"
        endpoint = `${BACKEND_URL}/leave-application/${id}`;
        body = JSON.stringify({ status: "Approved" });
      } else {
        // For regular pending leaves, set to "Rejected"
        endpoint = `${BACKEND_URL}/leave-application/${id}`;
        body = JSON.stringify({ status: "Rejected" });
      }

      const res = await fetch(endpoint, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: body,
      })
      
      if (!res.ok) {
        throw new Error(`Failed to reject ${isRevokeRequest ? 'revoke request' : 'leave application'}: ${res.status}`)
      }
      await loadLeaveApplications()
      toast.success(isRevokeRequest ? "Revoke request rejected" : "Leave application rejected");
    } catch (error) {
      console.error(`Error rejecting ${isRevokeRequest ? 'revoke request' : 'leave application'}:`, error)
      toast.error("Operation failed. Please try again.");
    }
  }

  // API functions for search and suggest
  const fetchServiceProviders = async (query: string) => {
    try {
      const res = await fetch(`${BACKEND_URL}/service-provider`, {
        cache: "no-store",
      })
      const data = await res.json()
      const q = query.toLowerCase()
      return Array.isArray(data)
        ? data.filter((item: any) =>
            (item?.companyName || "").toLowerCase().includes(q)
          )
        : []
    } catch (error) {
      console.error("Error fetching service providers:", error)
      toast.error("Failed to load data.");
      return []
    }
  }

  // Updated fetchCompanies function - filters by selected Service Provider
  const fetchCompanies = async (query: string) => {
    try {
      // SUPERADMIN: Only fetch if service provider is selected
      if (user?.role === "SUPERADMIN" && !formData.serviceProviderID) {
        return []
      }

      const res = await fetch(`${BACKEND_URL}/company`, { cache: "no-store" })
      const data = await res.json()
      const q = query.toLowerCase()
      
      // Filter data based on selected Service Provider
      let filteredData = Array.isArray(data) ? data : []
      
      if (user?.role === "SUPERADMIN" && formData.serviceProviderID) {
        filteredData = filteredData.filter((item: any) => 
          item.serviceProviderID === formData.serviceProviderID
        )
      }
      
      // Filter by search query
      return filteredData
        .filter((item: any) =>
          (item?.companyName || "").toLowerCase().includes(q)
        )
        .map((item: any) => ({
          ...item,
          displayName: item.companyName
        }))
    } catch (error) {
      console.error("Error fetching companies:", error)
      toast.error("Failed to load data.");
      return []
    }
  }

  // Updated fetchBranches function - filters by selected Company
  const fetchBranches = async (query: string = "") => {
    try {
      // SUPERADMIN: Only fetch if company is selected
      if (user?.role === "SUPERADMIN" && !formData.companyID) {
        return []
      }

      const res = await fetch(`${BACKEND_URL}/branches`, { cache: "no-store" })
      let data = await res.json()
      
      const q = query.toLowerCase()

      // SUPERADMIN → Filter by selected company
      if (user?.role === "SUPERADMIN") {
        let filteredData = data.filter((item: any) => 
          item.companyID === formData.companyID
        )
        
        return q 
          ? filteredData.filter((item: any) =>
              (item?.branchName || "").toLowerCase().includes(q)
            )
          : filteredData
      }

      // MANAGER → only mapped branches (filtered by search)
      if (user?.role === "SERVICE_PROVIDER" && managerData) {
        let filteredByCompany;
        if (managerData.companyID) {
          filteredByCompany = data.filter(
            (item: any) => item.companyID === managerData.companyID
          )
        } else if (managerData.serviceProviderID) {
          filteredByCompany = data.filter(
            (item: any) => item.serviceProviderID === managerData.serviceProviderID
          )
        } else {
          filteredByCompany = []
        }
        return q
          ? filteredByCompany.filter((item: any) =>
              (item?.branchName || "").toLowerCase().includes(q)
            )
          : filteredByCompany
      }

      // EMPLOYEE → only mapped branches (filtered by search)
      if (user?.role === "EMPLOYEE" && empCreds) {
        const filteredByCompany = data.filter(
          (item: any) => item.companyID === empCreds.companyID
        )
        return q
          ? filteredByCompany.filter((item: any) =>
              (item?.branchName || "").toLowerCase().includes(q)
            )
          : filteredByCompany
      }

      // COMPANY_ADMIN / BRANCH_ADMIN → filter by formData.companyID
      if (formData.companyID) {
        const filteredByCompany = data.filter(
          (item: any) => item.companyID === formData.companyID
        )
        return q
          ? filteredByCompany.filter((item: any) =>
              (item?.branchName || "").toLowerCase().includes(q)
            )
          : filteredByCompany
      }

      return []
    } catch (error) {
      console.error("Error fetching branches:", error)
      toast.error("Failed to load data.");
      return []
    }
  }

  // Updated fetchEmployees function with strict filtering
  const fetchEmployees = async (query: string) => {
    try {
      const res = await fetch(`${BACKEND_URL}/manage-emp`, { cache: "no-store" })
      let data = await res.json()
      const q = query.toLowerCase()

      // SUPERADMIN → Filter by selected company AND branch
      if (user?.role === "SUPERADMIN") {
        // SUPERADMIN REQUIREMENT: Must have both companyID AND branchesID
        if (!formData.companyID || !formData.branchesID) {
          return [] // No employees shown until both are selected
        }
        
        const filteredData = data.filter((item: any) => 
          item.companyID === formData.companyID && 
          item.branchesID === formData.branchesID
        )
        
        return filteredData
          .filter((item: any) => {
            const fullName = `${item?.employeeFirstName || ""} ${item?.employeeLastName || ""}`.trim().toLowerCase()
            const employeeId = (item?.employeeID || "").toLowerCase()
            return fullName.includes(q) || employeeId.includes(q)
          })
          .map((item: any) => ({
            ...item,
            displayName: `${item?.employeeFirstName || ""} ${item?.employeeLastName || ""}`.trim() + (item?.employeeID ? ` (${item.employeeID})` : "")
          }))
      }

      // SERVICE_PROVIDER → Filter by sidebar context company AND selected branch
      if (user?.role === "SERVICE_PROVIDER") {
        if (!formData.branchesID) {
          return [] // No employees shown until branch is selected
        }
        
        const ctx = getSidebarContext();
        let filteredData;
        if (ctx?.companyID) {
          filteredData = data.filter((item: any) => 
            item.companyID === ctx.companyID && 
            item.branchesID === formData.branchesID
          )
        } else if (managerData?.serviceProviderID) {
          filteredData = data.filter((item: any) => 
            item.serviceProviderID === managerData?.serviceProviderID && 
            item.branchesID === formData.branchesID
          )
        } else {
          filteredData = []
        }
        
        return filteredData
          .filter((item: any) => {
            const fullName = `${item?.employeeFirstName || ""} ${item?.employeeLastName || ""}`.trim().toLowerCase()
            const employeeId = (item?.employeeID || "").toLowerCase()
            return fullName.includes(q) || employeeId.includes(q)
          })
          .map((item: any) => ({
            ...item,
            displayName: `${item?.employeeFirstName || ""} ${item?.employeeLastName || ""}`.trim() + (item?.employeeID ? ` (${item.employeeID})` : "")
          }))
      }

      // EMPLOYEE → only show themselves
      if (user?.role === "EMPLOYEE" && empCreds) {
        const filtered = data.filter(
          (item: any) => item.id === empCreds.manageEmployeeID
        )
        return filtered
          .filter((item: any) => {
            const fullName = `${item?.employeeFirstName || ""} ${item?.employeeLastName || ""}`.trim().toLowerCase()
            const employeeId = (item?.employeeID || "").toLowerCase()
            return fullName.includes(q) || employeeId.includes(q)
          })
          .map((item: any) => ({
            ...item,
            displayName: `${item?.employeeFirstName || ""} ${item?.employeeLastName || ""}`.trim() + (item?.employeeID ? ` (${item.employeeID})` : "")
          }))
      }

      // COMPANY_ADMIN / BRANCH_ADMIN → filter by formData
      if (formData.companyID && formData.branchesID) {
        const filteredData = data.filter((item: any) =>
          item.companyID === formData.companyID &&
          item.branchesID === formData.branchesID
        )
        return filteredData
          .filter((item: any) => {
            const fullName = `${item?.employeeFirstName || ""} ${item?.employeeLastName || ""}`.trim().toLowerCase()
            const employeeId = (item?.employeeID || "").toLowerCase()
            return fullName.includes(q) || employeeId.includes(q)
          })
          .map((item: any) => ({
            ...item,
            displayName: `${item?.employeeFirstName || ""} ${item?.employeeLastName || ""}`.trim() + (item?.employeeID ? ` (${item.employeeID})` : "")
          }))
      }

      return []
    } catch (error) {
      console.error("Error fetching employees:", error)
      toast.error("Failed to load data.");
      return []
    }
  }

  // Function to split applications by day status for table display
  const splitApplicationByDayStatus = (application: any): LeaveApplication[] => {
    // If no dayStatuses or only one type, return as single entry
    if (!application.dayStatuses || application.dayStatuses.length === 0) {
      return [{
        id: application.id.toString(),
        serviceProviderID: application.serviceProviderID,
        companyID: application.companyID,
        branchesID: application.branchesID,
        manageEmployeeID: application.manageEmployeeID,
        serviceProvider: application.serviceProvider || "",
        companyName: application.companyName || "",
        branchName: application.branchName || "",
        employeeId: application.employeeId || "",
        employeeName: application.employeeName || "",
        remainingSickLeave: application.remainingSickLeave,
        remainingCasualLeave: application.remainingCasualLeave,
        appliedLeaveType: application.appliedLeaveType,
        fromDate: application.fromDate,
        toDate: application.toDate,
        purpose: application.purpose,
        status: application.status,
        createdAt: application.createdAt,
      }];
    }

    // Group days by status
    const groupedByStatus: Record<string, DayStatus[]> = {};
    application.dayStatuses.forEach((day: any) => {
      const status = day.status || "LoP";
      if (!groupedByStatus[status]) {
        groupedByStatus[status] = [];
      }
      groupedByStatus[status].push(day);
    });

    // Create separate entries for each leave type
    const entries: LeaveApplication[] = [];
    Object.entries(groupedByStatus).forEach(([status, days]) => {
      if (days.length > 0) {
        // Sort dates
        const sortedDates = days.map(d => d.date).sort();
        const fromDate = sortedDates[0];
        const toDate = sortedDates[sortedDates.length - 1];

        entries.push({
          id: `${application.id}-${status}-${fromDate}`,
          serviceProviderID: application.serviceProviderID,
          companyID: application.companyID,
          branchesID: application.branchesID,
          manageEmployeeID: application.manageEmployeeID,
          serviceProvider: application.serviceProvider || "",
          companyName: application.companyName || "",
          branchName: application.branchName || "",
          employeeId: application.employeeId || "",
          employeeName: application.employeeName || "",
          remainingSickLeave: application.remainingSickLeave,
          remainingCasualLeave: application.remainingCasualLeave,
          appliedLeaveType: status,
          fromDate: fromDate,
          toDate: toDate,
          purpose: application.purpose,
          status: application.status,
          createdAt: application.createdAt,
        });
      }
    });

    return entries;
  };

  const loadLeaveApplications = async () => {
    try {
      const res = await fetch(`${BACKEND_URL}/leave-application`, { cache: "no-store" })
      const data = await res.json()
      
      console.log("API Response data:", data);
      
      // First map all applications
      const allApplications = (Array.isArray(data) ? data : []).map((application: any) => {
        console.log("Processing application:", application.id);
        
        // Extract employee name from manageEmployee object
        let employeeName = "";
        let employeeId = "";
        
        if (application.manageEmployee) {
          employeeName = `${application.manageEmployee.employeeFirstName || ""} ${application.manageEmployee.employeeLastName || ""}`.trim();
          employeeId = application.manageEmployee.employeeID || "";
        }
        
        console.log("Extracted employeeName:", employeeName);
        console.log("Extracted employeeId:", employeeId);
        
        const mappedApp = {
          id: application.id.toString(),
          serviceProviderID: application.serviceProviderID,
          companyID: application.companyID,
          branchesID: application.branchesID,
          manageEmployeeID: application.manageEmployeeID,
          serviceProvider: application.serviceProvider?.companyName || "",
          companyName: application.company?.companyName || "",
          branchName: application.branches?.branchName || "",
          employeeId: employeeId,
          employeeName: employeeName,
          remainingSickLeave: application.remainingSickLeave,
          remainingCasualLeave: application.remainingCasualLeave,
          appliedLeaveType: application.appliedLeaveType,
          fromDate: application.fromDate ? new Date(application.fromDate).toISOString().split("T")[0] : "",
          toDate: application.toDate ? new Date(application.toDate).toISOString().split("T")[0] : "",
          purpose: application.purpose,
          status: (application.status || "Pending") as "Pending" | "Approved" | "Rejected" | "Accepted" | "RevokePending" | "Revoked",
          createdAt: application.createdAt ? new Date(application.createdAt).toISOString().split("T")[0] : new Date().toISOString().split("T")[0],
          dayStatuses: application.dayStatuses || []
        };
        
        console.log("Mapped application:", mappedApp);
        return mappedApp;
      });

      console.log("All mapped applications:", allApplications);
      
      // Split applications by day status
      const splitApplications: LeaveApplication[] = [];
      allApplications.forEach(app => {
        if (app.status === "Approved" && app.dayStatuses && app.dayStatuses.length > 0) {
          // For approved applications with dayStatuses, split them
          const splitEntries = splitApplicationByDayStatus(app);
          console.log("Split entries for app", app.id, ":", splitEntries);
          splitApplications.push(...splitEntries);
        } else {
          // For other applications, keep as is
          splitApplications.push(app);
        }
      });

      console.log("Final split applications:", splitApplications);

      // Role-based filtering
      if (!user) {
        setLeaveApplications([])
        return
      }

      if (user.role === "SUPERADMIN") {
        const ctx = getSidebarContext();
        if (ctx?.companyID) {
          setLeaveApplications(splitApplications.filter((r: any) => r.companyID === ctx.companyID));
        } else {
          setLeaveApplications(splitApplications);
        }
        return
      }

      if (user.role === "SERVICE_PROVIDER") {
        const ctx = getSidebarContext()
        if (ctx?.companyID) {
          setLeaveApplications(splitApplications.filter((a: any) => a.companyID === ctx.companyID))
          return
        }
        const usersData = await fetch(`${BACKEND_URL}/users`).then((r) => r.json())
        const currentUser = usersData.find((u: any) => u.username === user.username)
        if (currentUser?.serviceProviderID) {
          setLeaveApplications(splitApplications.filter((a: any) => a.serviceProviderID === currentUser.serviceProviderID))
          return
        }
      }

      // For employees or others → get from /manage-emp/credentials/all
      const creds = await fetch(`${BACKEND_URL}/manage-emp/credentials/all`).then((r) => r.json())
      const emp = creds.find((c: any) => c.username === user.username)
      if (emp) {
        const filtered = splitApplications.filter(
          (a) => a.companyID === emp.companyID && a.branchesID === emp.branchesID
        )
        console.log("Filtered for EMPLOYEE:", filtered);
        setLeaveApplications(filtered)
      } else {
        setLeaveApplications([])
      }
    } catch (error) {
      console.error("Error loading leave applications:", error)
      toast.error("Failed to load data.");
    }
  }

  useEffect(() => {
    if (user) loadLeaveApplications()
  }, [user, managerData, empCreds])

  useEffect(() => {
    const handler = () => { if (user) loadLeaveApplications(); };
    window.addEventListener("sidebar-context-changed", handler);
    return () => window.removeEventListener("sidebar-context-changed", handler);
  }, [user, managerData, empCreds]);

  useEffect(() => {
    if (user?.role === "SERVICE_PROVIDER" && managerData) {
      // Auto-populate company info for manager
      setFormData(prev => ({
        ...prev,
        companyName: managerData.company?.companyName || "",
        companyID: managerData.companyID
      }))
    }
  }, [user, managerData])

  const filteredApplications = leaveApplications.filter(application =>
    (application.serviceProvider || "").toLowerCase().includes(searchTerm.toLowerCase()) ||
    (application.companyName || "").toLowerCase().includes(searchTerm.toLowerCase()) ||
    (application.branchName || "").toLowerCase().includes(searchTerm.toLowerCase()) ||
    (application.employeeName || "").toLowerCase().includes(searchTerm.toLowerCase()) ||
    (application.employeeId || "").toLowerCase().includes(searchTerm.toLowerCase()) ||
    (application.appliedLeaveType || "").toLowerCase().includes(searchTerm.toLowerCase())
  )

  useEffect(() => {
    if (user?.role === "SUPERADMIN" && formData.serviceProviderID) {
      setFormData(prev => ({
        ...prev,
        companyName: "",
        companyID: undefined,
        branchName: "",
        branchesID: undefined,
        employeeName: "",
        manageEmployeeID: undefined
      }))
      resetEmployeeState()
    }
  }, [formData.serviceProviderID, user?.role])

  useEffect(() => {
    if (user?.role === "SUPERADMIN" && formData.companyID) {
      setFormData(prev => ({
        ...prev,
        branchName: "",
        branchesID: undefined,
        employeeName: "",
        manageEmployeeID: undefined
      }))
      resetEmployeeState()
    }
  }, [formData.companyID, user?.role])

  useEffect(() => {
    if ((user?.role === "SUPERADMIN" && formData.branchesID) || 
        (user?.role === "SERVICE_PROVIDER" && formData.branchesID)) {
      setFormData(prev => ({
        ...prev,
        employeeName: "",
        manageEmployeeID: undefined
      }))
      resetEmployeeState()
    }
  }, [formData.branchesID, user?.role])

  const resetEmployeeState = () => {
    setSelectedEmployee(null)
    setAvailableLeaveTypes(["ShortLeave", "LoP"])
    setIsEmployeeSelected(false)
  }

  const handleServiceProviderSelect = (selected: SelectedItem) => {
    setFormData((prev) => ({
      ...prev,
      serviceProvider: selected.display,
      serviceProviderID: selected.value,
      companyName: "",
      companyID: undefined,
      branchName: "",
      branchesID: undefined,
      employeeName: "",
      manageEmployeeID: undefined
    }))
    resetEmployeeState()
  }

  // Update the handleCompanySelect function
  const handleCompanySelect = (selected: SelectedItem) => {
    setFormData((prev) => ({
      ...prev,
      companyName: selected.display,
      companyID: selected.value,
      branchName: "",
      branchesID: undefined,
      employeeName: "",
      manageEmployeeID: undefined
    }))
    resetEmployeeState()
  }

  // Update the handleBranchSelect function
  const handleBranchSelect = (selected: SelectedItem) => {
    setFormData((prev) => ({
      ...prev,
      branchName: selected.display,
      branchesID: selected.value,
      employeeName: "",
      manageEmployeeID: undefined
    }))
    resetEmployeeState()
  }

  const handleEmployeeSelect = async (selected: SelectedItem) => {
    try {
      const empId = selected.value;

      setSelectedEmployee(null);
      setAvailableLeaveTypes(["LoP"]);
      setIsEmployeeSelected(false);

      // Load employee data and calculate leave balance
      await loadEmployeeLeaveTypes(empId);

      setFormData((prev) => ({
        ...prev,
        employeeName: selected.display,
        manageEmployeeID: empId,
      }));

      setIsEmployeeSelected(true);

    } catch (error) {
      console.error("Error selecting employee:", error);
      toast.error("Operation failed. Please try again.");
      // Fallback to only LoP if there's an error
      setAvailableLeaveTypes(["LoP"]);
    }
  }

  const leaveTypeLabel = (type: string) => {
    const map: Record<string, string> = {
      Sick: "Sick Leave",
      Casual: "Casual Leave",
      Privileged: "Privileged Leave",
      ShortLeave: "Short Leave",
      CompOff: "Comp Off",
      LoP: "Loss of Pay (LoP)",
      MtL: "Maternity Leave (MtL)",
      PtL: "Paternity Leave (PtL)",
    };
    return map[type] || type;
  };

  const calculateDays = (fromDate: string, toDate: string) => {
    if (!fromDate || !toDate) return 0
    const start = new Date(fromDate)
    const end = new Date(toDate)
    const diffTime = Math.abs(end.getTime() - start.getTime())
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24)) + 1
    return diffDays
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    
    // Auto-populate serviceProviderID and companyID for MANAGER/EMPLOYEE
    const serviceProviderID = user?.role === "SUPERADMIN" 
      ? formData.serviceProviderID 
      : managerData?.serviceProviderID || empCreds?.serviceProviderID;

    const companyID = user?.role === "SUPERADMIN" 
      ? formData.companyID 
      : managerData?.companyID || empCreds?.companyID;

    // Ensure we have the required IDs
    if (!companyID || !formData.branchesID || !formData.manageEmployeeID) {
      toast.error("Please make sure all required fields are selected: Branch and Employee");
      return;
    }

    try {
      const leaveApplicationData = {
        serviceProviderID: serviceProviderID,
        companyID: companyID,
        branchesID: formData.branchesID,
        manageEmployeeID: formData.manageEmployeeID,
        remainingSickLeave: selectedEmployee?.remainingSickLeave || 0,
        remainingCasualLeave: selectedEmployee?.remainingCasualLeave || 0,
        appliedLeaveType: formData.leaveType,
        fromDate: formData.fromDate ? new Date(formData.fromDate) : null,
        toDate: formData.toDate ? new Date(formData.toDate) : null,
        purpose: formData.purpose,
      }

      const url = editingApplication
        ? `${BACKEND_URL}/leave-application/${editingApplication.id}`
        : `${BACKEND_URL}/leave-application`
      const method = editingApplication ? "PATCH" : "POST"

      const res = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(leaveApplicationData),
      })
      if (!res.ok) {
        throw new Error(`Failed to save leave application: ${res.status}`)
      }

      await loadLeaveApplications()
      resetForm()
      setIsDialogOpen(false)
      toast.success(editingApplication ? "Updated successfully" : "Created successfully");
    } catch (error) {
      console.error("Error saving leave application:", error)
      toast.error("Failed to save. Please try again.");
    }
  }

  const resetForm = () => {
    const ctx = getSidebarContext();
    setFormData({
      serviceProvider: ctx?.serviceProviderName ?? "",
      companyName: ctx?.companyName ?? "",
      branchName: "",
      employeeName: isNormalUser ? `${empCreds?.employeeFirstName || ""} ${empCreds?.employeeLastName || ""}`.trim() : "",
      leaveType: "",
      fromDate: "",
      toDate: "",
      purpose: "",
      serviceProviderID: ctx?.serviceProviderID ?? undefined,
      companyID: ctx?.companyID ?? undefined,
      branchesID: undefined,
      manageEmployeeID: isNormalUser ? empCreds?.manageEmployeeID : undefined,
    })
    setSelectedEmployee(null)
    setEditingApplication(null)
    setAvailableLeaveTypes(["ShortLeave", "LoP"])
    setLeaveBalance({
      sick: { used: 0, total: 0, remaining: 0 },
      casual: { used: 0, total: 0, remaining: 0 },
      privileged: { used: 0, total: 0, remaining: 0 },
      compOff: { used: 0, total: 0, remaining: 0 },
      maternity: { used: 0, total: 0, remaining: 0 },
      paternity: { used: 0, total: 0, remaining: 0 },
    })
    setIsEmployeeSelected(isNormalUser) // For normal users, employee is pre-selected
  }

  const handleEdit = (application: LeaveApplication) => {
    setFormData({
      serviceProvider: application.serviceProvider || "",
      companyName: application.companyName || "",
      branchName: application.branchName || "",
      employeeName: application.employeeName || "",
      leaveType: application.appliedLeaveType || "",
      fromDate: application.fromDate,
      toDate: application.toDate,
      purpose: application.purpose || "",
      serviceProviderID: application.serviceProviderID,
      companyID: application.companyID,
      branchesID: application.branchesID,
      manageEmployeeID: application.manageEmployeeID,
    })
    setSelectedEmployee({
      remainingSickLeave: application.remainingSickLeave,
      remainingCasualLeave: application.remainingCasualLeave,
    })
    setEditingApplication(application)
    setIsDialogOpen(true)
    setIsEmployeeSelected(true)
  }

  const handleDelete = async (id: string) => {
    try {
      const res = await fetch(`${BACKEND_URL}/leave-application/${id}`, {
        method: "DELETE",
      })
      if (!res.ok) {
        throw new Error(`Failed to delete leave application: ${res.status}`)
      }
      await loadLeaveApplications()
      toast.success("Deleted successfully");
    } catch (error) {
      console.error("Error deleting leave application:", error)
      toast.error("Failed to delete. Please try again.");
    }
  }

  return (
    <div className="space-y-6 w-full max-w-full mx-auto px-4 overflow-hidden">
      {/* FormDrawer for Add/Edit */}
      <FormDrawer open={isDialogOpen} onOpenChange={setIsDialogOpen} title={editingApplication ? "Edit Leave Application" : "Submit Leave Application"} description={editingApplication 
                    ? "Update the leave application information below." 
                    : "Fill in the details to submit a new leave application."}>
              <form onSubmit={handleSubmit} className="space-y-6">
                {/* Organization Selection */}
                <div className="space-y-4">
                  <h3 className="text-lg font-semibold">Organization Selection</h3>
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                    {/* Service Provider - auto-filled from sidebar */}
                    {false && (
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
                    )}
                    
                    {/* Company Name - auto-filled from sidebar */}
                    {false && (
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
                    )}

                    {/* Branch Name - Always visible */}
                    <div style={{ 
                      gridColumn: user?.role !== "SUPERADMIN" ? "span 3" : "span 1"
                    }}>
                      <SearchSuggestInput
                        label="Branch Name"
                        placeholder="Start typing branch name..."
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
                      {(user?.role === "SERVICE_PROVIDER" || user?.role === "EMPLOYEE") && (
                        <p className="text-xs text-gray-500 mt-1">
                          You can only select from your assigned branches
                        </p>
                      )}
                    </div>
                  </div>
                </div>

                {/* Employee Selection - Hidden for normal users */}
                {!isNormalUser && (
                  <div className="space-y-4">
                    <h3 className="text-lg font-semibold">Employee Selection</h3>
                    <div className="space-y-2">
                      <SearchSuggestInput
                        label="Employee Name"
                        placeholder="Select Employee"
                        value={formData.employeeName}
                        onChange={(value) =>
                          setFormData((prev) => ({ ...prev, employeeName: value }))
                        }
                        onSelect={handleEmployeeSelect}
                        fetchData={fetchEmployees}
                        displayField="displayName"
                        valueField="id"
                        required
                      />
                      <p className="text-xs text-gray-500">Show FirstName + LastName + Emp ID</p>
                      {user?.role === "SERVICE_PROVIDER" && (
                        <p className="text-xs text-gray-500">
                          You can only select employees from your assigned branch
                        </p>
                      )}
                    </div>
                  </div>
                )}

                {/* Leave Application Details */}
                <div className="space-y-4">
                  <h3 className="text-lg font-semibold">Leave Application Details</h3>
                  
                  {/* Leave Balance Display */}
                  {(isEmployeeSelected || isNormalUser) && (
                    <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3 p-4 bg-gray-50 rounded-lg">
                      {([
                        { key: "sick" as const, label: "Sick Leave", color: "text-blue-600" },
                        { key: "casual" as const, label: "Casual Leave", color: "text-green-600" },
                        { key: "privileged" as const, label: "Privileged Leave", color: "text-purple-600" },
                        { key: "compOff" as const, label: "Comp Off", color: "text-orange-600" },
                        { key: "maternity" as const, label: "Maternity (MtL)", color: "text-pink-600" },
                        { key: "paternity" as const, label: "Paternity (PtL)", color: "text-teal-600" },
                      ] as const).map(({ key, label, color }) => (
                        <div key={key} className="text-center">
                          <div className="text-xs font-medium text-gray-600">{label}</div>
                          <div className={`text-base font-bold ${color}`}>
                            {leaveBalance[key].used}/{leaveBalance[key].total}
                          </div>
                          <div className="text-xs text-gray-500">
                            {leaveBalance[key].remaining} remaining
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                  
                  {/* Leave Type - Only show after employee is selected (for MANAGER/SUPERADMIN) or always for normal users */}
                  {(isEmployeeSelected || isNormalUser) && (
                    <div className="space-y-2">
                      <Label htmlFor="leaveType">Leave Type *</Label>
                      <select
                        id="leaveType"
                        value={formData.leaveType}
                        onChange={(e) => setFormData(prev => ({ ...prev, leaveType: e.target.value }))}
                        className="w-full px-3 py-2 border border-gray-300 rounded-sm border-[#d0d0d0] focus:outline-none focus-visible:ring-2 focus-visible:ring-gray-900/15 focus-visible:border-[#b0b0b0]"
                        required
                      >
                        <option value="">Select Leave Type</option>
                        {availableLeaveTypes.map((type) => (
                          <option key={type} value={type}>{leaveTypeLabel(type)}</option>
                        ))}
                      </select>
                    </div>
                  )}

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label>Calculated Days</Label>
                      <div className="w-full px-3 py-2 border border-[#d0d0d0] rounded-sm bg-gray-50 text-gray-600">
                        {calculateDays(formData.fromDate, formData.toDate)} days
                      </div>
                    </div>
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label htmlFor="fromDate">From Date *</Label>
                      <Input
                        id="fromDate"
                        type="date"
                        value={formData.fromDate}
                        onChange={(e) => setFormData(prev => ({ ...prev, fromDate: e.target.value }))}
                        className="w-full"
                        required
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="toDate">To Date *</Label>
                      <Input
                        id="toDate"
                        type="date"
                        value={formData.toDate}
                        onChange={(e) => setFormData(prev => ({ ...prev, toDate: e.target.value }))}
                        className="w-full"
                        required
                      />
                    </div>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="purpose">Purpose *</Label>
                    <Input
                      id="purpose"
                      type="text"
                      value={formData.purpose}
                      onChange={(e) => setFormData(prev => ({ ...prev, purpose: e.target.value }))}
                      placeholder="Enter purpose for leave"
                      className="w-full"
                      required
                    />
                  </div>
                </div>

                <div className="flex justify-end gap-3 pt-4">
                  <Button type="button" variant="outline" onClick={() => setIsDialogOpen(false)}>
                    Cancel
                  </Button>
                  <Button type="submit" className="">
                    {editingApplication ? "Update Application" : "Submit Application"}
                  </Button>
                </div>
              </form>
            
          </FormDrawer>

      {/* Header - shown when form is closed */}
      {!isDialogOpen && (
        <div className="flex items-center justify-between w-full">
          <div className="min-w-0 flex-1">
            <p className="text-gray-600 mt-1 text-sm">Manage employee leave applications and approvals</p>
          </div>
          <Button
            onClick={() => { resetForm(); setIsDialogOpen(true); }}
            className="flex-shrink-0 text-sm px-3 py-2"
          >
            <Plus className="w-4 h-4 mr-1" />
            Add Leave Application
          </Button>
        </div>
      )}

      {/* Revoke Leave Modal */}
      <FormDrawer open={isRevokeDialogOpen} onOpenChange={setIsRevokeDialogOpen} title={"Revoke Leave Application"} description={"Please provide a reason for revoking this leave. It will go for manager approval."}>
          <div className="space-y-4 mt-4">
            <div>
              <Label htmlFor="revokedReason">Revoked Reason</Label>
              <Input
                id="revokedReason"
                type="text"
                placeholder="Enter reason for revoking leave"
                value={revokeReason}
                onChange={(e) => setRevokeReason(e.target.value)}
                required
              />
            </div>
            <div>
              <Label>Request Date</Label>
              <div className="border rounded-md px-3 py-2 bg-gray-50 text-gray-700">
                {new Date().toLocaleString()}
              </div>
            </div>
          </div>
          <div className="flex justify-end gap-3 pt-4">
            <Button variant="outline" onClick={() => setIsRevokeDialogOpen(false)}>
              Cancel
            </Button>
            <Button onClick={handleRevokeSubmit} className="bg-yellow-600 hover:bg-yellow-700 text-white">
              Submit Revoke Request
            </Button>
          </div>
        
      </FormDrawer>

      {/* Manager Approval Modal */}
      <FormDrawer open={isManagerApprovalDialogOpen} onOpenChange={setIsManagerApprovalDialogOpen} title={"Manage Leave Approval"} description={`Assign leave types for each day. {pendingDaysCount} day(s) pending assignment.`}>
          <div className="space-y-4 mt-4">
            {managerApprovalApplication && (
              <>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-4">
                  <div>
                    <Label>Employee</Label>
                    <div className="border rounded-md px-3 py-2 bg-gray-50 text-gray-700">
                      {managerApprovalApplication.employeeName}
                    </div>
                  </div>
                  <div>
                    <Label>Requested Period</Label>
                    <div className="border rounded-md px-3 py-2 bg-gray-50 text-gray-700">
                      {managerApprovalApplication.fromDate} to {managerApprovalApplication.toDate}
                    </div>
                  </div>
                </div>

                {/* Leave Balance Display for Manager */}
                <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3 p-4 bg-blue-50 rounded-lg">
                  {([
                    { key: "sick" as const, label: "Sick Leave", color: "text-blue-600", statusKey: "Sick" },
                    { key: "casual" as const, label: "Casual Leave", color: "text-green-600", statusKey: "Casual" },
                    { key: "privileged" as const, label: "Privileged Leave", color: "text-purple-600", statusKey: "Privileged" },
                    { key: "compOff" as const, label: "Comp Off", color: "text-orange-600", statusKey: "CompOff" },
                    { key: "maternity" as const, label: "Maternity (MtL)", color: "text-pink-600", statusKey: "MtL" },
                    { key: "paternity" as const, label: "Paternity (PtL)", color: "text-teal-600", statusKey: "PtL" },
                  ] as const).map(({ key, label, color, statusKey }) => (
                    <div key={key} className="text-center">
                      <div className="text-xs font-medium text-gray-600">{label}</div>
                      <div className={`text-base font-bold ${color}`}>
                        {managerLeaveBalance[key].used + dayStatuses.filter(day => day.status === statusKey).length}/{managerLeaveBalance[key].total}
                      </div>
                      <div className="text-xs text-gray-500">
                        {managerLeaveBalance[key].remaining} remaining
                      </div>
                    </div>
                  ))}
                </div>

                {/* Available Leave Types Info */}
                <div className="p-3 bg-yellow-50 rounded-md">
                  <p className="text-sm text-yellow-700">
                    <strong>Available Leave Types:</strong> {currentAvailableTypes.map(t => leaveTypeLabel(t)).join(", ")}
                  </p>
                </div>
              </>
            )}

            <div className="space-y-3">
              <Label>Assign Leave Types for Each Day</Label>
              {dayStatuses.map((day, index) => {
                // Calculate if a type should be available for this specific day
                const getAvailableTypesForDay = () => {
                  const getAvailableTypesForDay = () => {
                  const types: string[] = [];
                  
                  if (managerLeaveBalance.sick.remaining > 0 || day.status === "Sick") types.push("Sick");
                  if (managerLeaveBalance.casual.remaining > 0 || day.status === "Casual") types.push("Casual");
                  if (managerLeaveBalance.privileged.remaining > 0 || day.status === "Privileged") types.push("Privileged");
                  types.push("ShortLeave");
                  if (managerLeaveBalance.compOff.remaining > 0 || day.status === "CompOff") types.push("CompOff");
                  types.push("LoP");
                  if (managerLeaveBalance.maternity.remaining > 0 || day.status === "MtL") types.push("MtL");
                  if (managerLeaveBalance.paternity.remaining > 0 || day.status === "PtL") types.push("PtL");
                  
                  return types;
                };

                const availableTypesForThisDay = getAvailableTypesForDay();
                                          
                return (
                  <div key={index} className="flex items-center gap-4 p-3 border rounded-md">
                    <div className="w-32 flex-shrink-0">
                      <Label>Date</Label>
                      <div className="text-sm font-medium text-gray-700">
                        {new Date(day.date).toLocaleDateString()}
                      </div>
                    </div>
                    <div className="flex-1">
                      <Label>Leave Type</Label>
                      <select
                        value={day.status}
                        onChange={(e) => handleDayStatusChange(index, e.target.value as DayStatus["status"])}
                        className="w-full px-3 py-2 border border-gray-300 rounded-sm border-[#d0d0d0] focus:outline-none focus-visible:ring-2 focus-visible:ring-gray-900/15 focus-visible:border-[#b0b0b0]"
                      >
                        <option value="">Select Type</option>
                        {availableTypesForThisDay.map((type) => (
                          <option key={type} value={type}>{leaveTypeLabel(type)}</option>
                        ))}
                      </select>
                      {day.status === "ShortLeave" && (
                        <select
                          value={day.dayType || ""}
                          onChange={(e) => {
                            const updated = dayStatuses.map((d, i) => 
                              i === index ? { ...d, dayType: e.target.value as DayStatus["dayType"] } : d
                            );
                            setDayStatuses(updated);
                          }}
                          className="w-full mt-2 px-3 py-2 border border-gray-300 rounded-sm border-[#d0d0d0] focus:outline-none focus-visible:ring-2 focus-visible:ring-gray-900/15 focus-visible:border-[#b0b0b0]"
                        >
                          <option value="">Mark As...</option>
                          <option value="Present">Present</option>
                          <option value="LateMark">Late Mark</option>
                          <option value="Halfday">Half Day</option>
                          <option value="Absent">Absent</option>
                        </select>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
          <div className="flex justify-end gap-3 pt-4">
            <Button variant="outline" onClick={() => setIsManagerApprovalDialogOpen(false)}>
              Cancel
            </Button>
            <Button 
              onClick={handleManagerApprovalSubmit} 
              className="bg-green-600 hover:bg-green-700 text-white"
              disabled={pendingDaysCount > 0}
            >
              Approve Leave ({pendingDaysCount} pending)
            </Button>
          </div>
        
      </FormDrawer>

      {!isDialogOpen && (<>
      {/* Search and Filters */}
      <Card>
        <CardContent>
          <div className="flex items-center gap-4 flex-wrap">
            <div className="relative flex-1 min-w-0">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
              <Input
                placeholder="Search leave applications..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-10 w-full"
              />
            </div>
            <Badge variant="secondary" className="px-3 py-1 flex-shrink-0">
              {filteredApplications.length} applications
            </Badge>
          </div>
        </CardContent>
      </Card>

      {/* Leave Applications Table */}
      <Card className="w-full">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Icon icon="mdi:calendar-clock" className="w-5 h-5" />
            Leave Application Request
          </CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          <div className="overflow-x-auto max-w-full">
            <Table className="w-full table-fixed">
              <TableHeader>
                <TableRow>
                  <TableHead className="w-[100px]">Employee Name</TableHead>
                  <TableHead className="w-[70px]">Leave Type</TableHead>
                  <TableHead className="w-[70px]">From Date</TableHead>
                  <TableHead className="w-[70px]">To Date</TableHead>
                  <TableHead className="w-[60px]">No of Days</TableHead>
                  <TableHead className="w-[80px]">Purpose</TableHead>
                  <TableHead className="w-[70px]">Status</TableHead>
                  <TableHead className="w-[80px] text-right">Action</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredApplications.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={8} className="text-center py-8 text-gray-500">
                      <div className="flex flex-col items-center gap-2">
                        <Icon icon="mdi:calendar-clock" className="w-12 h-12 text-gray-300" />
                        <p>No leave applications found</p>
                        <p className="text-sm">Try adjusting your search criteria</p>
                      </div>
                    </TableCell>
                  </TableRow>
                ) : (
                  filteredApplications.map((application, index) => (
                    <TableRow key={`${application.id}-${index}`}>
                      <TableCell className="truncate" title={application.employeeName}>{application.employeeName}</TableCell>
                      <TableCell className="truncate">{application.appliedLeaveType}</TableCell>
                      <TableCell className="truncate">{application.fromDate}</TableCell>
                      <TableCell className="truncate">{application.toDate}</TableCell>
                      <TableCell className="truncate text-center">{calculateDays(application.fromDate, application.toDate)}</TableCell>
                      <TableCell className="truncate" title={application.purpose}>{application.purpose}</TableCell>
                      <TableCell className="whitespace-nowrap">
                        <Badge
                          variant={
                            application.status === "Approved"
                              ? "default"
                              : application.status === "Rejected"
                              ? "destructive"
                              : application.status === "Accepted"
                              ? "secondary"
                              : application.status === "RevokePending"
                              ? "outline"
                              : application.status === "Revoked"
                              ? "secondary"
                              : "secondary"
                          }
                        >
                          {application.status === "RevokePending" ? "Revoke Pending" : application.status}
                        </Badge>
                      </TableCell>

                      {/* === Action Buttons Section - FIXED REVOKE FLOW === */}
                      <TableCell className="text-right whitespace-nowrap">
                        <div className="flex items-center justify-end gap-1">
                          {/* --- For SUPERADMIN and MANAGER --- */}
                          {canManage ? (
                            <>
                              {/* Pending approval flow */}
                              {application.status === "Pending" && (
                                <>
                                  <Button
                                    variant="ghost"
                                    size="sm"
                                    onClick={() => handleAccept(application.id, false)}
                                    className="h-7 w-7 p-0 text-green-600 hover:text-green-700 hover:bg-green-50"
                                    title="Accept"
                                  >
                                    <Check className="w-3 h-3" />
                                  </Button>
                                  <Button
                                    variant="ghost"
                                    size="sm"
                                    onClick={() => handleReject(application.id, false)}
                                    className="h-7 w-7 p-0 text-red-600 hover:text-red-700 hover:bg-red-50"
                                    title="Reject"
                                  >
                                    <X className="w-3 h-3" />
                                  </Button>
                                </>
                              )}

                              {/* RevokePending status - show accept/reject for revoke requests */}
                              {application.status === "RevokePending" && (
                                <>
                                  <Button
                                    variant="ghost"
                                    size="sm"
                                    onClick={() => handleAccept(application.id, true)}
                                    className="h-7 w-7 p-0 text-green-600 hover:text-green-700 hover:bg-green-50"
                                    title="Accept Revoke"
                                  >
                                    <Check className="w-3 h-3" />
                                  </Button>
                                  <Button
                                    variant="ghost"
                                    size="sm"
                                    onClick={() => handleReject(application.id, true)}
                                    className="h-7 w-7 p-0 text-red-600 hover:text-red-700 hover:bg-red-50"
                                    title="Reject Revoke"
                                  >
                                    <X className="w-3 h-3" />
                                  </Button>
                                </>
                              )}

                              {/* Accepted status - show manager approval icon (for both regular and revoke flows) */}
                              {(application.status === "Accepted") && (
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  onClick={() => openManagerApprovalModal(application)}
                                  className="h-7 w-7 p-0 text-blue-600 hover:text-blue-700 hover:bg-blue-50"
                                  title="Manage Approval"
                                >
                                  <Icon icon="mdi:account-cog" className="w-3 h-3" />
                                </Button>
                              )}

                              {/* Edit/Delete always available for managers */}
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => handleEdit(application)}
                                className="h-7 w-7 p-0"
                                title="Edit"
                              >
                                <Edit className="w-3 h-3" />
                              </Button>
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => handleDelete(application.id)}
                                className="h-7 w-7 p-0 text-red-600 hover:text-red-700 hover:bg-red-50"
                                title="Delete"
                              >
                                <Trash2 className="w-3 h-3" />
                              </Button>
                            </>
                          ) : (
                            <>
                              {/* Normal Employee actions */}
                              {application.status === "Pending" && (
                                <>
                                  <Button
                                    variant="ghost"
                                    size="sm"
                                    onClick={() => handleEdit(application)}
                                    className="h-7 w-7 p-0"
                                    title="Edit"
                                  >
                                    <Edit className="w-3 h-3" />
                                  </Button>
                                  <Button
                                    variant="ghost"
                                    size="sm"
                                    onClick={() => handleDelete(application.id)}
                                    className="h-7 w-7 p-0 text-red-600 hover:text-red-700 hover:bg-red-50"
                                    title="Delete"
                                  >
                                    <Trash2 className="w-3 h-3" />
                                  </Button>
                                </>
                              )}

                              {/* Revoke option for approved leaves */}
                              {application.status === "Approved" && (
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  onClick={() => openRevokeModal(application)}
                                  className="h-7 w-7 p-0 text-yellow-600 hover:text-yellow-700 hover:bg-yellow-50"
                                  title="Request Revoke"
                                >
                                  <Icon icon="mdi:rotate-left" className="w-3 h-3" />
                                </Button>
                              )}
                            </>
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
  )
}