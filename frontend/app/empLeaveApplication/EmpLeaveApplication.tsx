"use client"

import { useState, useEffect } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "../components/ui/card"
import { Button } from "../components/ui/button"
import { Input } from "../components/ui/input"
import { Label } from "../components/ui/label"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "../components/ui/dialog"
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
import { getSidebarContext } from "../utils/sidebarContext"
import { getPageCache, setPageCache } from "../utils/pageCache"

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
  remainingEarnedLeave?: number
  appliedLeaveType?: string
  fromDate: string
  toDate: string
  purpose?: string
  status?: "Pending" | "Approved" | "Rejected" | "RevokePending" | "Revoked"
  createdAt: string
}

interface EmployeeCredentials {
  id: number
  username: string
  serviceProviderID: number
  companyID: number
  branchesID: number
  employeeID: number
  serviceProvider?: any
  company?: any
  branch?: any
  employee?: any
}

// Backend URL
const BACKEND_URL = process.env.NEXT_PUBLIC_BACKEND_URL || "/backend"

export function EmpLeaveApplication() {
  const [leaveApplications, setLeaveApplications] = useState<LeaveApplication[]>(() => getPageCache<LeaveApplication[]>("empLeaveApps") ?? [])
  const [searchTerm, setSearchTerm] = useState("")
  const [isDialogOpen, setIsDialogOpen] = useState(false)
  const [editingApplication, setEditingApplication] = useState<LeaveApplication | null>(null)
  const [userCredentials, setUserCredentials] = useState<EmployeeCredentials | null>(null)
  
  const [formData, setFormData] = useState({
    serviceProvider: "",
    companyName: "",
    branchName: "",
    employeeName: "",
    leaveType: "",
    childNumber: "",
    birthEventDate: "",
    fromDate: "",
    toDate: "",
    purpose: "",
    serviceProviderID: undefined as number | undefined,
    companyID: undefined as number | undefined,
    branchesID: undefined as number | undefined,
    manageEmployeeID: undefined as number | undefined,
  })

  const [tenureWarning, setTenureWarning] = useState<string | null>(null)
  const [childrenCountWarning, setChildrenCountWarning] = useState<string | null>(null)

  const user = useCurrentUser()
  const canManage = user?.role === "SUPERADMIN" || user?.role === "SERVICE_PROVIDER" || user?.role === "COMPANY_ADMIN" || user?.role === "BRANCH_ADMIN"

  // Leave balance state
  const [leaveBalance, setLeaveBalance] = useState<Record<string, { used: number; total: number; remaining: number }>>({})
  const [availableLeaveTypes, setAvailableLeaveTypes] = useState<string[]>(["ShortLeave", "LoP"])
  const [employeeGender, setEmployeeGender] = useState<string | null>(null)

  const leaveTypeLabel = (type: string) => {
    const map: Record<string, string> = {
      Sick: "Sick Leave", Casual: "Casual Leave", Privileged: "Privileged Leave",
      ShortLeave: "Short Leave", CompOff: "Comp Off", LoP: "Loss of Pay (LoP)",
      MtL: "Maternity Leave (MtL)", PtL: "Paternity Leave (PtL)",
    };
    return map[type] || type;
  };

  const loadLeaveBalance = async (employeeId: number) => {
    try {
      const empRes = await robustGet<any>(`${BACKEND_URL}/manage-emp/${employeeId}`);
      const employeeGenderVal = empRes.gender ?? null;
      setEmployeeGender(employeeGenderVal);
      const policy = empRes.leavePolicy ||
        ([...(empRes.empLeavePolicy ?? [])].sort((a: any, b: any) =>
          new Date(b.effectFrom || 0).getTime() - new Date(a.effectFrom || 0).getTime()
        )[0]?.leavePolicy) ||
        {};
      const totalSick = Number(policy.sickLeaveCount) || 0;
      const totalCasual = Number(policy.casualLeaveCount) || 0;

      let totalPrivileged = 0;
      try {
        const plData = await robustGet<any[]>(`${BACKEND_URL}/privileged-leave/employee/${employeeId}`);
        if (Array.isArray(plData)) totalPrivileged = plData.reduce((s: number, e: any) => s + (Number(e.balanceLeaves) || 0), 0);
      } catch {}

      let totalCompOff = 0;
      try {
        const woData = await robustGet<any[]>(`${BACKEND_URL}/employee-weekly-off?employeeID=${employeeId}`);
        if (Array.isArray(woData)) totalCompOff = woData.filter((w: any) => w.status === "Present").length;
      } catch {}

      // Fetch per-employee stored balance from DB (seeded from historical approved leaves on first call)
      let balanceRecord: any = {};
      try {
        balanceRecord = await robustGet<any>(`${BACKEND_URL}/emp-leave-balance/employee/${employeeId}`);
      } catch {}
      const used: Record<string, number> = {
        Sick:       Number(balanceRecord.sickUsed)       || 0,
        Casual:     Number(balanceRecord.casualUsed)     || 0,
        Privileged: Number(balanceRecord.privilegedUsed) || 0,
        CompOff:    Number(balanceRecord.compOffUsed)    || 0,
        MtL:        Number(balanceRecord.maternityUsed)  || 0,
        PtL:        Number(balanceRecord.paternityUsed)  || 0,
      };

      const numChildren = empRes.numberOfChildren ?? null;
      const totalMaternity = Number(policy.maternityLeaveCount) || 182;
      const totalPaternity = Number(policy.paternityLeaveCount) || 15;
      const mk = (u: number, t: number) => ({ used: Math.min(u, t), total: t, remaining: Math.max(t - u, 0) });
      const balance: Record<string, { used: number; total: number; remaining: number }> = {
        sick: mk(used.Sick, totalSick),
        casual: mk(used.Casual, totalCasual),
        privileged: mk(used.Privileged, totalPrivileged),
        compOff: mk(used.CompOff, totalCompOff),
        maternity: mk(used.MtL, totalMaternity),
        paternity: mk(used.PtL, totalPaternity),
      };
      setLeaveBalance(balance);

      // Tenure warning
      const joiningDate = empRes.joiningDate ?? null;
      if (joiningDate) {
        const joining = new Date(joiningDate);
        const today = new Date();
        const daysSinceJoining = Math.floor((today.getTime() - joining.getTime()) / (1000 * 60 * 60 * 24));
        if (daysSinceJoining < 80) {
          setTenureWarning(`You have only ${daysSinceJoining} days of service. Minimum 80 days required — leave subject to approval.`);
        } else {
          setTenureWarning(null);
        }
      } else {
        setTenureWarning(null);
      }

      // numberOfChildren null warning
      if (numChildren === null && (employeeGenderVal === "Female" || employeeGenderVal === "Male" || employeeGenderVal === "Others")) {
        setChildrenCountWarning("Number of children not set in your employee profile. Maternity entitlement defaults to 182 days. Please contact HR to update.");
      } else {
        setChildrenCountWarning(null);
      }

      const types: string[] = [];
      if (balance.sick.remaining > 0) types.push("Sick");
      if (balance.casual.remaining > 0) types.push("Casual");
      if (balance.privileged.remaining > 0) types.push("Privileged");
      types.push("ShortLeave");
      if (balance.compOff.remaining > 0) types.push("CompOff");
      types.push("LoP");
      // Gender-based: Maternity for Female/Transgender, Paternity for Male/Transgender
      if (balance.maternity.remaining > 0 && (employeeGenderVal === "Female" || employeeGenderVal === "Others")) types.push("MtL");
      if (balance.paternity.remaining > 0 && (employeeGenderVal === "Male" || employeeGenderVal === "Others")) types.push("PtL");
      setAvailableLeaveTypes(types);
    } catch (error) {
      console.error("Error loading leave balance:", error);
      setAvailableLeaveTypes(["ShortLeave", "LoP"]);
    }
  };
  
  // Revoke Modal State
  const [isRevokeDialogOpen, setIsRevokeDialogOpen] = useState(false)
  const [revokeReason, setRevokeReason] = useState("")
  const [revokeApplication, setRevokeApplication] = useState<LeaveApplication | null>(null)

  // ---------- APIs ----------
  async function robustGet<T = any>(url: string): Promise<T> {
    const res = await fetch(url, { cache: "no-store" })
    if (!res.ok) throw new Error(`${res.status}`)
    return res.json()
  }
  
  async function robustFetch(url: string, init?: RequestInit) {
    const res = await fetch(url, init)
    if (!res.ok) throw new Error(`${res.status}`)
    return res.json().catch(() => ({}))
  }

  // Load user credentials and auto-populate form
  useEffect(() => {
    if (user) {
      loadUserCredentials()
    }
  }, [user])
  
  useEffect(() => {
    if (userCredentials) {
      loadLeaveApplications()

      // Poll every 15 s so status changes (approvals) appear without needing to navigate away
      const interval = setInterval(() => {
        if (document.visibilityState === "visible") loadLeaveApplications();
      }, 15000);

      const onVisible = () => {
        if (document.visibilityState === "visible") loadLeaveApplications();
      };
      document.addEventListener("visibilitychange", onVisible);

      return () => {
        clearInterval(interval);
        document.removeEventListener("visibilitychange", onVisible);
      };
    }
  }, [userCredentials])

  const loadUserCredentials = async () => {
    try {
      const creds = await robustGet<any[]>(`${BACKEND_URL}/manage-emp/credentials/all`)
      const userCreds = creds.find(c => c.username === user?.username)
      
      if (userCreds) {
        setUserCredentials(userCreds)
        
        // Auto-populate form with user's organization data
        const serviceProvider = await robustGet<any>(`${BACKEND_URL}/service-provider/${userCreds.serviceProviderID}`).catch(() => null)
        const company = await robustGet<any>(`${BACKEND_URL}/company/${userCreds.companyID}`).catch(() => null)
        const branch = await robustGet<any>(`${BACKEND_URL}/branches/${userCreds.branchesID}`).catch(() => null)
        const employee = await robustGet<any>(`${BACKEND_URL}/manage-emp/${userCreds.employeeID}`).catch(() => null)
        
        setFormData(prev => ({
          ...prev,
          serviceProvider: serviceProvider?.companyName || "",
          companyName: company?.companyName || "",
          branchName: branch?.branchName || "",
          employeeName: employee ? `${employee.employeeFirstName || ""} ${employee.employeeLastName || ""} (${employee.employeeID})` : "",
          serviceProviderID: userCreds.serviceProviderID,
          companyID: userCreds.companyID,
          branchesID: userCreds.branchesID,
          manageEmployeeID: userCreds.employeeID,
        }))
        
        // Load leave balance
        loadLeaveBalance(userCreds.employeeID)
      }
    } catch (error) {
      console.error("Error loading user credentials:", error)
    }
  }

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
      alert("Revoke request submitted for approval.")
    } catch (error) {
      console.error("Error revoking leave application:", error)
      alert("Error submitting revoke request. Please try again.")
    }
  }

  const loadLeaveApplications = async () => {
    try {
      const data = await robustGet<any[]>(`${BACKEND_URL}/leave-application`)
      
      const mapped = (Array.isArray(data) ? data : []).map((application: any) => ({
        id: application.id.toString(),
        serviceProviderID: application.serviceProviderID,
        companyID: application.companyID,
        branchesID: application.branchesID,
        manageEmployeeID: application.manageEmployeeID,
        serviceProvider: application.serviceProvider?.companyName || "",
        companyName: application.company?.companyName || "",
        branchName: application.branches?.branchName || "",
        employeeId: application.manageEmployee?.employeeID || "",
        employeeName: application.manageEmployee
          ? `${application.manageEmployee.employeeFirstName || ""} ${application.manageEmployee.employeeLastName || ""}`.trim()
          : "",
        remainingSickLeave: application.remainingSickLeave,
        remainingCasualLeave: application.remainingCasualLeave,
        remainingEarnedLeave: application.remainingEarnedLeave,
        appliedLeaveType: application.appliedLeaveType,
        fromDate: application.fromDate ? new Date(application.fromDate).toISOString().split("T")[0] : "",
        toDate: application.toDate ? new Date(application.toDate).toISOString().split("T")[0] : "",
        purpose: application.purpose,
        status: (application.status || "Pending") as "Pending" | "Approved" | "Rejected",
        createdAt: application.createdAt ? new Date(application.createdAt).toISOString().split("T")[0] : new Date().toISOString().split("T")[0],
      }))

      // Role-based filtering
      if (!user) {
        setLeaveApplications([])
        return
      }

      if (user.role === "SUPERADMIN") {
        setLeaveApplications(mapped)
        return
      }

      if (user.role === "SERVICE_PROVIDER") {
        const ctx = getSidebarContext()
        if (ctx?.companyID) {
          setLeaveApplications(mapped.filter((a: any) => a.companyID === ctx.companyID))
          return
        }
        const usersData = await fetch(`${BACKEND_URL}/users`).then((r) => r.json())
        const currentUser = usersData.find((u: any) => u.username === user.username)
        if (currentUser?.serviceProviderID) {
          setLeaveApplications(mapped.filter((a: any) => a.serviceProviderID === currentUser.serviceProviderID))
          return
        }
      }

      // For employees or others → filter by current user's employee ID
      if (userCredentials) {
        const filtered = mapped.filter(
          (a) => a.manageEmployeeID === userCredentials.employeeID
        )
        setPageCache("empLeaveApps", filtered)
        setLeaveApplications(filtered)
        // Refresh balance so approved leaves are immediately reflected
        loadLeaveBalance(userCredentials.employeeID)
      } else {
        setLeaveApplications([])
      }
    } catch (error) {
      console.error("Error loading leave applications:", error)
      setLeaveApplications([])
    }
  }

  const filteredApplications = leaveApplications.filter(application =>
    (application.serviceProvider || "").toLowerCase().includes(searchTerm.toLowerCase()) ||
    (application.companyName || "").toLowerCase().includes(searchTerm.toLowerCase()) ||
    (application.branchName || "").toLowerCase().includes(searchTerm.toLowerCase()) ||
    (application.employeeName || "").toLowerCase().includes(searchTerm.toLowerCase()) ||
    (application.employeeId || "").toLowerCase().includes(searchTerm.toLowerCase()) ||
    (application.appliedLeaveType || "").toLowerCase().includes(searchTerm.toLowerCase())
  )

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
    
    try {
      const leaveApplicationData = {
        serviceProviderID: formData.serviceProviderID,
        companyID: formData.companyID,
        branchesID: formData.branchesID,
        manageEmployeeID: formData.manageEmployeeID,
        remainingSickLeave: 0, // These would come from employee data in a real scenario
        remainingCasualLeave: 0,
        remainingEarnedLeave: 0,
        appliedLeaveType: formData.leaveType || "",
        fromDate: formData.fromDate ? new Date(formData.fromDate) : null,
        toDate: formData.toDate ? new Date(formData.toDate) : null,
        purpose: formData.purpose,
        childNumber: formData.childNumber || undefined,
        birthEventDate: formData.birthEventDate || undefined,
        status: "Pending",
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
    } catch (error) {
      console.error("Error saving leave application:", error)
    }
  }

  const resetForm = () => {
    // Reset form but keep the auto-populated organization data
    if (userCredentials) {
      setFormData(prev => ({
        ...prev,
        leaveType: "",
        childNumber: "",
        birthEventDate: "",
        fromDate: "",
        toDate: "",
        purpose: "",
      }))
    } else {
      setFormData({
        serviceProvider: "",
        companyName: "",
        branchName: "",
        employeeName: "",
        leaveType: "",
        childNumber: "",
        birthEventDate: "",
        fromDate: "",
        toDate: "",
        purpose: "",
        serviceProviderID: undefined,
        companyID: undefined,
        branchesID: undefined,
        manageEmployeeID: undefined,
      })
    }
    setEditingApplication(null)
  }

  const handleEdit = (application: LeaveApplication) => {
    setFormData({
      serviceProvider: application.serviceProvider || "",
      companyName: application.companyName || "",
      branchName: application.branchName || "",
      employeeName: application.employeeName || "",
      leaveType: application.appliedLeaveType || "",
      childNumber: (application as any).childNumber || "",
      birthEventDate: (application as any).birthEventDate || "",
      fromDate: application.fromDate,
      toDate: application.toDate,
      purpose: application.purpose || "",
      serviceProviderID: application.serviceProviderID,
      companyID: application.companyID,
      branchesID: application.branchesID,
      manageEmployeeID: application.manageEmployeeID,
    })
    
    setEditingApplication(application)
    setIsDialogOpen(true)
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
    } catch (error) {
      console.error("Error deleting leave application:", error)
    }
  }

  const handleApprove = async (id: string) => {
    try {
      const res = await fetch(`${BACKEND_URL}/leave-application/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: "Approved" }),
      })
      if (!res.ok) {
        throw new Error(`Failed to approve leave application: ${res.status}`)
      }
      await loadLeaveApplications()
    } catch (error) {
      console.error("Error approving leave application:", error)
    }
  }

  const handleReject = async (id: string) => {
    try {
      const res = await fetch(`${BACKEND_URL}/leave-application/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: "Rejected" }),
      })
      if (!res.ok) {
        throw new Error(`Failed to reject leave application: ${res.status}`)
      }
      await loadLeaveApplications()
    } catch (error) {
      console.error("Error rejecting leave application:", error)
    }
  }

  // --- helpers for the date picker display ---
  const formatDateParts = (dateStr: string) => {
    if (!dateStr) return { top: "", bottom: "" };
    const d = new Date(dateStr + "T00:00:00");
    const day = d.getDate();
    const month = d.toLocaleString("en-US", { month: "short" });
    const year = d.getFullYear();
    return { top: `${day} ${month}`, bottom: `${year}` };
  };

  const leaveTypeIcon = (type: string) => {
    const icons: Record<string, string> = {
      Sick:       "solar:heart-pulse-linear",
      Casual:     "solar:calendar-linear",
      Privileged: "solar:star-shine-linear",
      ShortLeave: "solar:clock-circle-linear",
      CompOff:    "solar:transfer-horizontal-linear",
      LoP:        "solar:document-remove-linear",
      MtL:        "mdi:baby-face-outline",
      PtL:        "mdi:human-male",
    };
    return icons[type] || "solar:calendar-linear";
  };

  return (
    <div className="px-4 pt-5 pb-4 space-y-5">
      {/* Header */}
      <h1 className="text-[22px] font-bold text-gray-900">Request Leave</h1>

      {/* Leave Balance Cards — monochrome bordered */}
      {Object.keys(leaveBalance).length > 0 && (
        <div className="flex gap-2 overflow-x-auto pb-1 -mx-1 px-1" style={{ scrollbarWidth: 'none' }}>
          {([
            { key: "sick",       label: "SICK"      },
            { key: "casual",     label: "CASUAL"    },
            { key: "privileged", label: "PRIVILEGED"},
            { key: "compOff",    label: "COMP OFF"  },
            { key: "maternity",  label: "MATERNITY", genderReq: "Female" },
            { key: "paternity",  label: "PATERNITY", genderReq: "Male"   },
          ] as { key: string; label: string; genderReq?: string }[])
            .filter(({ key, genderReq }) => {
              if (!leaveBalance[key]) return false;
              if (genderReq === "Female" && employeeGender !== "Female" && employeeGender !== "Others") return false;
              if (genderReq === "Male"   && employeeGender !== "Male"   && employeeGender !== "Others") return false;
              return true;
            })
            .map(({ key, label }) => (
              <div key={key} className="shrink-0 bg-white border border-gray-200 rounded-xl px-3.5 py-2.5 flex flex-col items-center min-w-[68px]">
                <span className="text-[22px] font-bold text-gray-900 leading-none">{leaveBalance[key].remaining}</span>
                <span className="text-[9px] font-semibold text-gray-400 mt-1.5 uppercase tracking-widest whitespace-nowrap">{label}</span>
              </div>
            ))}
        </div>
      )}

      {/* Form Container */}
      <div className="bg-white rounded-2xl border border-gray-200 p-4 space-y-5">
        {tenureWarning && (
          <div className="p-3 bg-amber-50 rounded-xl border border-amber-100">
            <p className="text-[12px] text-amber-700">⚠️ {tenureWarning}</p>
          </div>
        )}

        {/* Leave Type */}
        <div>
          <p className="text-[10px] font-semibold text-gray-400 uppercase tracking-widest mb-2.5">Leave Type</p>
          <div className="flex flex-wrap gap-2">
            {availableLeaveTypes.map((type) => (
              <button
                key={type}
                onClick={() => setFormData(p => ({ ...p, leaveType: type }))}
                className={`flex items-center gap-1.5 px-3 py-2 rounded-xl text-[12px] font-semibold border transition-all active:scale-[0.97] ${
                  formData.leaveType === type
                    ? "bg-[#2563eb] text-white border-[#2563eb]"
                    : "bg-white text-gray-700 border-gray-200"
                }`}
              >
                <Icon icon={leaveTypeIcon(type)} className="w-[15px] h-[15px] shrink-0" />
                {leaveTypeLabel(type)}
              </button>
            ))}
          </div>
        </div>

        {/* MtL/PtL extra fields */}
        {(formData.leaveType === "MtL" || formData.leaveType === "PtL") && (
          <div className="grid grid-cols-2 gap-3">
            <div>
              <p className="text-[10px] font-semibold text-gray-400 uppercase tracking-widest mb-1.5">Child Event</p>
              <select
                value={formData.childNumber}
                onChange={(e) => setFormData(p => ({ ...p, childNumber: e.target.value }))}
                className="w-full px-3 py-2.5 text-[13px] rounded-xl border border-gray-200 bg-white focus:outline-none"
              >
                <option value="">Select…</option>
                <option value="1st">1st Child</option>
                <option value="2nd">2nd Child</option>
                <option value="3rd+">3rd+ Child</option>
                <option value="Adoption">Adoption</option>
              </select>
            </div>
            <div>
              <p className="text-[10px] font-semibold text-gray-400 uppercase tracking-widest mb-1.5">
                {formData.leaveType === "MtL" ? "Expected Delivery" : "Birth Date"}
              </p>
              <input
                type="date"
                value={formData.birthEventDate}
                onChange={(e) => setFormData(p => ({ ...p, birthEventDate: e.target.value }))}
                className="w-full px-3 py-2.5 text-[13px] rounded-xl border border-gray-200 bg-white focus:outline-none"
              />
            </div>
          </div>
        )}

        {/* Start / End Date — image-2 style: bordered box with arrows + stacked date inside */}
        <div className="grid grid-cols-2 gap-3">
          {(["fromDate", "toDate"] as const).map((key) => {
            const label = key === "fromDate" ? "START" : "END";
            const parts = formatDateParts(formData[key]);
            return (
              <div key={key}>
                <p className="text-[10px] font-semibold text-gray-400 uppercase tracking-widest mb-1.5">{label}</p>
                <div className="relative flex items-center justify-between border border-gray-200 rounded-xl bg-white px-2 py-3">
                  {/* Transparent native date input — covers entire box for tap-to-pick */}
                  <input
                    type="date"
                    value={formData[key]}
                    onChange={(e) => setFormData(p => ({ ...p, [key]: e.target.value }))}
                    className="absolute inset-0 opacity-0 w-full h-full cursor-pointer z-0"
                  />
                  {/* Left arrow — above the transparent input */}
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      const d = formData[key] ? new Date(formData[key] + "T00:00:00") : new Date();
                      d.setDate(d.getDate() - 1);
                      setFormData(p => ({ ...p, [key]: d.toISOString().split("T")[0] }));
                    }}
                    className="relative z-10 w-7 h-7 flex items-center justify-center text-gray-400 text-[18px] font-light shrink-0 active:scale-[0.85]"
                  >‹</button>
                  {/* Stacked date display */}
                  <div className="relative z-10 flex flex-col items-center flex-1 pointer-events-none select-none">
                    {formData[key] ? (
                      <>
                        <span className="text-[14px] font-bold text-gray-900 leading-tight">{parts.top}</span>
                        <span className="text-[12px] font-medium text-gray-500 leading-tight">{parts.bottom}</span>
                      </>
                    ) : (
                      <span className="text-[12px] text-gray-400">Select</span>
                    )}
                  </div>
                  {/* Right arrow */}
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      const d = formData[key] ? new Date(formData[key] + "T00:00:00") : new Date();
                      d.setDate(d.getDate() + 1);
                      setFormData(p => ({ ...p, [key]: d.toISOString().split("T")[0] }));
                    }}
                    className="relative z-10 w-7 h-7 flex items-center justify-center text-gray-400 text-[18px] font-light shrink-0 active:scale-[0.85]"
                  >›</button>
                </div>
              </div>
            );
          })}
        </div>
        {formData.fromDate && formData.toDate && (
          <p className="text-[12px] text-center text-[#2563eb] font-semibold -mt-3">
            {calculateDays(formData.fromDate, formData.toDate)} day{calculateDays(formData.fromDate, formData.toDate) !== 1 ? "s" : ""}
          </p>
        )}

        {/* Reason */}
        <div>
          <p className="text-[10px] font-semibold text-gray-400 uppercase tracking-widest mb-1.5">Reason</p>
          <textarea
            value={formData.purpose}
            onChange={(e) => setFormData(p => ({ ...p, purpose: e.target.value }))}
            placeholder="Describe your reason…"
            rows={3}
            className="w-full px-3 py-2.5 text-[13px] rounded-xl border border-gray-200 bg-gray-50 focus:outline-none resize-none"
          />
        </div>

        {/* Submit */}
        <button
          onClick={async () => {
            if (!formData.leaveType || !formData.fromDate || !formData.toDate) {
              alert("Please select leave type and dates.");
              return;
            }
            try {
              const payload = {
                serviceProviderID: formData.serviceProviderID,
                companyID: formData.companyID,
                branchesID: formData.branchesID,
                manageEmployeeID: formData.manageEmployeeID,
                remainingSickLeave: 0,
                remainingCasualLeave: 0,
                remainingEarnedLeave: 0,
                appliedLeaveType: formData.leaveType,
                fromDate: new Date(formData.fromDate),
                toDate: new Date(formData.toDate),
                purpose: formData.purpose,
                childNumber: formData.childNumber || undefined,
                birthEventDate: formData.birthEventDate || undefined,
                status: "Pending",
              };
              const url = editingApplication
                ? `${BACKEND_URL}/leave-application/${editingApplication.id}`
                : `${BACKEND_URL}/leave-application`;
              const method = editingApplication ? "PATCH" : "POST";
              const res = await fetch(url, {
                method,
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(payload),
              });
              if (!res.ok) throw new Error(await res.text());
              await loadLeaveApplications();
              resetForm();
              alert(editingApplication ? "Leave updated!" : "Leave request submitted!");
            } catch (e: any) {
              alert("Error: " + (e.message || "Failed to submit"));
            }
          }}
          className="w-full py-3.5 bg-[#2563eb] text-white font-bold text-[15px] rounded-2xl active:scale-[0.98] transition-transform"
        >
          {editingApplication ? "Update Request" : "Submit Request"}
        </button>
        {editingApplication && (
          <button onClick={resetForm} className="w-full py-2.5 text-[13px] font-semibold text-gray-500 rounded-xl bg-white border border-gray-200 active:scale-[0.98]">
            Cancel Edit
          </button>
        )}
      </div>

      {/* Recent Requests */}
      <div>
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-[16px] font-bold text-gray-900">Recent Requests</h2>
          <div className="relative">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-gray-400" />
            <input
              placeholder="Search…"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-7 pr-3 py-1.5 text-[12px] rounded-xl border border-gray-100 bg-white shadow-sm focus:outline-none w-28"
            />
          </div>
        </div>

        {/* Manager actions */}
        {canManage && (
          <div className="mb-3 p-3 bg-blue-50 rounded-xl border border-blue-100">
            <p className="text-[12px] font-semibold text-blue-700">Manager View — swipe cards to approve / reject</p>
          </div>
        )}

        <div className="space-y-3">
          {filteredApplications.length === 0 ? (
            <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-8 flex flex-col items-center gap-3">
              <Icon icon="solar:calendar-bold-duotone" className="w-12 h-12 text-gray-200" />
              <p className="text-[14px] font-semibold text-gray-400">No leave requests yet</p>
            </div>
          ) : (
            filteredApplications.map((application) => (
              <div key={application.id} className="bg-white rounded-2xl border border-gray-100 shadow-sm p-4">
                <div className="flex items-start justify-between gap-2 mb-1.5">
                  <div>
                    <p className="text-[14px] font-bold text-gray-900">{leaveTypeLabel(application.appliedLeaveType || "")}</p>
                    {application.employeeName && (
                      <p className="text-[12px] text-gray-400">{application.employeeName}</p>
                    )}
                  </div>
                  <span className={`text-[11px] font-bold px-2.5 py-1 rounded-full ${
                    application.status === "Approved" ? "bg-green-100 text-green-700"
                    : application.status === "Rejected" ? "bg-red-100 text-red-600"
                    : application.status === "RevokePending" ? "bg-amber-100 text-amber-700"
                    : "bg-gray-100 text-gray-600"
                  }`}>
                    {application.status === "RevokePending" ? "Revoke Pending" : application.status}
                  </span>
                </div>
                <div className="flex items-center gap-1.5 text-[12px] text-gray-500 mb-1.5">
                  <Icon icon="solar:calendar-linear" className="w-3.5 h-3.5 shrink-0" />
                  <span>{application.fromDate}</span>
                  <span className="text-gray-300">→</span>
                  <span>{application.toDate}</span>
                  <span className="ml-1 font-bold text-gray-700">{calculateDays(application.fromDate, application.toDate)}d</span>
                </div>
                {application.purpose && (
                  <p className="text-[12px] text-gray-500 line-clamp-2 mb-2">{application.purpose}</p>
                )}
                <div className="flex items-center justify-end gap-1 pt-2 border-t border-gray-50">
                  {canManage ? (
                    <>
                      {(application.status === "Pending" || application.status === "RevokePending") && (
                        <>
                          <button onClick={() => handleApprove(application.id)} className="flex items-center gap-1 text-[11px] font-bold text-emerald-600 border border-emerald-100 bg-emerald-50 rounded-lg px-2.5 py-1.5 active:scale-[0.97]">
                            <Check className="w-3 h-3" /> Approve
                          </button>
                          <button onClick={() => handleReject(application.id)} className="flex items-center gap-1 text-[11px] font-bold text-red-500 border border-red-100 bg-red-50 rounded-lg px-2.5 py-1.5 active:scale-[0.97]">
                            <X className="w-3 h-3" /> Reject
                          </button>
                        </>
                      )}
                      <button onClick={() => handleEdit(application)} className="flex items-center gap-1 text-[11px] font-bold text-gray-600 border border-gray-100 bg-gray-50 rounded-lg px-2.5 py-1.5 active:scale-[0.97]">
                        <Edit className="w-3 h-3" /> Edit
                      </button>
                      <button onClick={() => handleDelete(application.id)} className="flex items-center gap-1 text-[11px] font-bold text-red-500 border border-red-100 bg-red-50 rounded-lg px-2.5 py-1.5 active:scale-[0.97]">
                        <Trash2 className="w-3 h-3" /> Delete
                      </button>
                    </>
                  ) : (
                    <>
                      {application.status === "Pending" && (
                        <>
                          <button onClick={() => handleEdit(application)} className="flex items-center gap-1 text-[11px] font-bold text-gray-600 border border-gray-100 bg-gray-50 rounded-lg px-2.5 py-1.5 active:scale-[0.97]">
                            <Edit className="w-3 h-3" /> Edit
                          </button>
                          <button onClick={() => handleDelete(application.id)} className="flex items-center gap-1 text-[11px] font-bold text-red-500 border border-red-100 bg-red-50 rounded-lg px-2.5 py-1.5 active:scale-[0.97]">
                            <Trash2 className="w-3 h-3" /> Delete
                          </button>
                        </>
                      )}
                      {application.status === "Approved" && (
                        <button onClick={() => openRevokeModal(application)} className="flex items-center gap-1 text-[11px] font-bold text-amber-600 border border-amber-100 bg-amber-50 rounded-lg px-2.5 py-1.5 active:scale-[0.97]">
                          <Icon icon="mdi:rotate-left" className="w-3 h-3" /> Revoke
                        </button>
                      )}
                    </>
                  )}
                </div>
              </div>
            ))
          )}
        </div>
      </div>

      {/* Revoke Dialog */}
      <Dialog open={isRevokeDialogOpen} onOpenChange={setIsRevokeDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Revoke Leave Application</DialogTitle>
            <DialogDescription>Please provide a reason for revoking this leave.</DialogDescription>
          </DialogHeader>
          <div className="space-y-4 mt-4">
            <div>
              <Label htmlFor="revokedReason">Revoked Reason</Label>
              <Input id="revokedReason" type="text" placeholder="Enter reason" value={revokeReason} onChange={(e) => setRevokeReason(e.target.value)} />
            </div>
            <div>
              <Label>Request Date</Label>
              <div className="border rounded-md px-3 py-2 bg-gray-50 text-gray-700">{new Date().toLocaleString()}</div>
            </div>
          </div>
          <DialogFooter className="mt-4">
            <Button variant="outline" onClick={() => setIsRevokeDialogOpen(false)}>Cancel</Button>
            <Button onClick={handleRevokeSubmit} className="bg-yellow-600 hover:bg-yellow-700 text-white">Submit Revoke Request</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}

