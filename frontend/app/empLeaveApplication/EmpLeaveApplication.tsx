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
  const [leaveApplications, setLeaveApplications] = useState<LeaveApplication[]>([])
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
    fromDate: "",
    toDate: "",
    purpose: "",
    serviceProviderID: undefined as number | undefined,
    companyID: undefined as number | undefined,
    branchesID: undefined as number | undefined,
    manageEmployeeID: undefined as number | undefined,
  })

  const user = useCurrentUser()
  const canManage = user?.role === "SUPERADMIN" || user?.role === "SERVICE_PROVIDER" || user?.role === "COMPANY_ADMIN"

  // Leave balance state
  const [leaveBalance, setLeaveBalance] = useState<Record<string, { used: number; total: number; remaining: number }>>({})
  const [availableLeaveTypes, setAvailableLeaveTypes] = useState<string[]>(["ShortLeave", "LoP"])

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
      const policy = empRes.leavePolicy || {};
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

      const allLeaves = await robustGet<any[]>(`${BACKEND_URL}/leave-application`);
      const approved = (Array.isArray(allLeaves) ? allLeaves : []).filter(
        (l: any) => l.manageEmployeeID === employeeId && l.status === "Approved"
      );

      const used: Record<string, number> = { Sick: 0, Casual: 0, Privileged: 0, CompOff: 0, MtL: 0, PtL: 0 };
      approved.forEach((leave: any) => {
        if (leave.dayStatuses && Array.isArray(leave.dayStatuses)) {
          leave.dayStatuses.forEach((day: any) => { if (used[day.status] !== undefined) used[day.status]++; });
        } else if (leave.fromDate && leave.toDate) {
          const days = Math.ceil(Math.abs(new Date(leave.toDate).getTime() - new Date(leave.fromDate).getTime()) / 86400000) + 1;
          if (used[leave.appliedLeaveType] !== undefined) used[leave.appliedLeaveType] += days;
        }
      });

      const mk = (u: number, t: number) => ({ used: Math.min(u, t), total: t, remaining: Math.max(t - u, 0) });
      const balance: Record<string, { used: number; total: number; remaining: number }> = {
        sick: mk(used.Sick, totalSick),
        casual: mk(used.Casual, totalCasual),
        privileged: mk(used.Privileged, totalPrivileged),
        compOff: mk(used.CompOff, totalCompOff),
        maternity: mk(used.MtL, 180),
        paternity: mk(used.PtL, 15),
      };
      setLeaveBalance(balance);

      const types: string[] = [];
      if (balance.sick.remaining > 0) types.push("Sick");
      if (balance.casual.remaining > 0) types.push("Casual");
      if (balance.privileged.remaining > 0) types.push("Privileged");
      types.push("ShortLeave");
      if (balance.compOff.remaining > 0) types.push("CompOff");
      types.push("LoP");
      if (balance.maternity.remaining > 0) types.push("MtL");
      if (balance.paternity.remaining > 0) types.push("PtL");
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
        setLeaveApplications(filtered)
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

  return (
    <div className="space-y-6 w-full max-w-full mx-auto px-4 overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between w-full">
        <div className="min-w-0 flex-1">
          <p className="text-gray-600 mt-1 text-sm">Manage employee leave applications and approvals</p>
        </div>
        <div className="flex items-center gap-3">
          <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
            <DialogTrigger asChild>
              <Button onClick={resetForm} className="flex-shrink-0 text-sm px-3 py-2">
                <Plus className="w-4 h-4 mr-1" />
                Submit Application
              </Button>
            </DialogTrigger>
                      <DialogContent    onOpenAutoFocus={(e) => e.preventDefault()}
>
              <DialogHeader>
                <DialogTitle>
                  {editingApplication ? "Edit Leave Application" : "Submit Leave Application"}
                </DialogTitle>
                <DialogDescription>
                  {editingApplication 
                    ? "Update the leave application information below." 
                    : "Fill in the details to submit a new leave application."
                  }
                </DialogDescription>
              </DialogHeader>
              <form onSubmit={handleSubmit} className="space-y-6">
                {/* Auto-populated Organization Info (Read-only) */}
                <div className="space-y-4">
                  <h3 className="text-lg font-semibold">Organization Information</h3>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  
                    <div className="space-y-2">
                      <Label className="text-sm font-medium text-gray-700">Company</Label>
                      <Input 
                        type="text" 
                        value={formData.companyName} 
                        readOnly 
                        className="bg-gray-100 border-gray-300"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label className="text-sm font-medium text-gray-700">Branch</Label>
                      <Input 
                        type="text" 
                        value={formData.branchName} 
                        readOnly 
                        className="bg-gray-100 border-gray-300"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label className="text-sm font-medium text-gray-700">Employee</Label>
                      <Input 
                        type="text" 
                        value={formData.employeeName} 
                        readOnly 
                        className="bg-gray-100 border-gray-300"
                      />
                    </div>
                  </div>
                </div>

                {/* Leave Application Details */}
                <div className="space-y-4">
                  <h3 className="text-lg font-semibold">Leave Application Details</h3>
                  
                  {/* Leave Balance Display */}
                  {Object.keys(leaveBalance).length > 0 && (
                    <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 p-4 bg-gray-50 rounded-lg">
                      {([
                        { key: "sick", label: "Sick Leave", color: "text-blue-600" },
                        { key: "casual", label: "Casual Leave", color: "text-green-600" },
                        { key: "privileged", label: "Privileged Leave", color: "text-purple-600" },
                        { key: "compOff", label: "Comp Off", color: "text-orange-600" },
                        { key: "maternity", label: "MtL", color: "text-pink-600" },
                        { key: "paternity", label: "PtL", color: "text-teal-600" },
                      ]).map(({ key, label, color }) => leaveBalance[key] ? (
                        <div key={key} className="text-center">
                          <div className="text-xs font-medium text-gray-600">{label}</div>
                          <div className={`text-base font-bold ${color}`}>
                            {leaveBalance[key].used}/{leaveBalance[key].total}
                          </div>
                          <div className="text-xs text-gray-500">{leaveBalance[key].remaining} remaining</div>
                        </div>
                      ) : null)}
                    </div>
                  )}

                  {/* Leave Type */}
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

                <DialogFooter>
                  <Button type="button" variant="outline" onClick={() => setIsDialogOpen(false)}>
                    Cancel
                  </Button>
                  <Button type="submit" className="">
                    {editingApplication ? "Update Application" : "Submit Application"}
                  </Button>
                </DialogFooter>
              </form>
            </DialogContent>
          </Dialog>
        </div>
        
        {/* === Revoke Leave Modal === */}
        <Dialog open={isRevokeDialogOpen} onOpenChange={setIsRevokeDialogOpen}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Revoke Leave Application</DialogTitle>
              <DialogDescription>
                Please provide a reason for revoking this leave. It will go for manager approval.
              </DialogDescription>
            </DialogHeader>
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
            <DialogFooter className="mt-4">
              <Button variant="outline" onClick={() => setIsRevokeDialogOpen(false)}>
                Cancel
              </Button>
              <Button onClick={handleRevokeSubmit} className="bg-yellow-600 hover:bg-yellow-700 text-white">
                Submit Revoke Request
              </Button>
            </DialogFooter>
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
                  filteredApplications.map((application) => (
                    <TableRow key={application.id}>
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

                      {/* === Action Buttons Section === */}
                      <TableCell className="text-right whitespace-nowrap">
                        <div className="flex items-center justify-end gap-1">
                          {/* --- For SUPERADMIN and MANAGER --- */}
                          {canManage ? (
                            <>
                              {/* Pending or RevokePending approval flow */}
                              {(application.status === "Pending" || application.status === "RevokePending") && (
                                <>
                                  <Button
                                    variant="ghost"
                                    size="sm"
                                    onClick={() => handleApprove(application.id)}
                                    className="h-7 w-7 p-0 text-green-600 hover:text-green-700 hover:bg-green-50"
                                    title="Approve"
                                  >
                                    <Check className="w-3 h-3" />
                                  </Button>
                                  <Button
                                    variant="ghost"
                                    size="sm"
                                    onClick={() => handleReject(application.id)}
                                    className="h-7 w-7 p-0 text-red-600 hover:text-red-700 hover:bg-red-50"
                                    title="Reject"
                                  >
                                    <X className="w-3 h-3" />
                                  </Button>
                                </>
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
    </div>
  )
}