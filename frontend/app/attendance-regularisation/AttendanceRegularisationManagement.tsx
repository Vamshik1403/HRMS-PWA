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
import { Plus, Search, Edit, Trash2, Clock, Check, X } from "lucide-react"
import { SearchSuggestInput } from "../components/SearchSuggestInput"
import { useCurrentUser } from "../hooks/useCurrentUser"

interface AttendanceRegularisation {
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
  attendanceDate: string
  day?: string
  checkInTime: string
  checkOutTime: string
  actualStatus?: string
  requestedStatus?: string
  reason?: string
  remarks?: string
  status?: "Pending" | "Approved" | "Rejected"
  createdAt: string
}

interface SelectedItem {
  display: string
  value: number
  item: any
}

// Backend URL
const BACKEND_URL = process.env.NEXT_PUBLIC_BACKEND_URL || "http://localhost:8000"

export function AttendanceRegularisationManagement() {
  const [regularisations, setRegularisations] = useState<AttendanceRegularisation[]>([])
  const [searchTerm, setSearchTerm] = useState("")
  const [isDialogOpen, setIsDialogOpen] = useState(false)
  const [editingRegularisation, setEditingRegularisation] = useState<AttendanceRegularisation | null>(null)
  const [formData, setFormData] = useState({
    serviceProvider: "",
    companyName: "",
    branchName: "",
    employeeName: "",
    attendanceDate: "",
    checkInTime: "",
    day: "",
    checkOutTime: "",
    actualStatus: "",
    requestedStatus: "",
    reason: "",
    remarks: "",
    serviceProviderID: undefined as number | undefined,
    companyID: undefined as number | undefined,
    branchesID: undefined as number | undefined,
    manageEmployeeID: undefined as number | undefined,
  })

  const [selectedEmployee, setSelectedEmployee] = useState<any | null>(null)
  const [managerData, setManagerData] = useState<any>(null)
  const [empCreds, setEmpCreds] = useState<any>(null)
  
  const user = useCurrentUser()
  const canManage = user?.role === "SUPERADMIN" || user?.role === "MANAGER"

  // Load user data based on role
  useEffect(() => {
    if (!user) return;

    const loadUserData = async () => {
      try {
        // --- MANAGER ---
        if (user.role === "MANAGER") {
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
        }
      } catch (error) {
        console.error("Error loading user data:", error);
      }
    };

    loadUserData();
  }, [user]);

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
      return []
    }
  }

  const fetchCompanies = async (query: string) => {
    try {
      const res = await fetch(`${BACKEND_URL}/company`, { cache: "no-store" })
      const data = await res.json()
      const q = query.toLowerCase()
      return Array.isArray(data)
        ? data.filter((item: any) =>
          (item?.companyName || "").toLowerCase().includes(q)
        )
        : []
    } catch (error) {
      console.error("Error fetching companies:", error)
      return []
    }
  }

  // Updated fetchBranches with role-based filtering
  const fetchBranches = async (query: string = "") => {
    try {
      const res = await fetch(`${BACKEND_URL}/branches`, { cache: "no-store" })
      let data = await res.json()
      
      // Include company information in branch data for non-superadmin
      if (user?.role !== "SUPERADMIN") {
        const companies = await fetch(`${BACKEND_URL}/company`).then(r => r.json())
        data = data.map((branch: any) => ({
          ...branch,
          company: companies.find((c: any) => c.id === branch.companyID) || {}
        }))
      }

      const q = query.toLowerCase()

      // SUPERADMIN → ALL (filtered by search)
      if (user?.role === "SUPERADMIN") {
        return q 
          ? data.filter((item: any) =>
              (item?.branchName || "").toLowerCase().includes(q)
            )
          : data
      }

      // MANAGER → only mapped branches (filtered by search)
      if (user?.role === "MANAGER" && managerData) {
        const filteredByCompany = data.filter(
          (item: any) => item.companyID === managerData.companyID
        )
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

      return []
    } catch (error) {
      console.error("Error fetching branches:", error)
      return []
    }
  }

  // Updated fetchEmployees with role-based filtering
  const fetchEmployees = async (query: string) => {
    try {
      const res = await fetch(`${BACKEND_URL}/manage-emp`, { cache: "no-store" })
      let data = await res.json()
      const q = query.toLowerCase()

      // SUPERADMIN → ALL employees
      if (user?.role === "SUPERADMIN") {
        return data
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

      // MANAGER → only employees from same company and branch
      if (user?.role === "MANAGER" && managerData) {
        const filtered = data.filter(
          (item: any) => 
            item.companyID === managerData.companyID && 
            item.branchesID === managerData.branchesID
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

      return []
    } catch (error) {
      console.error("Error fetching employees:", error)
      return []
    }
  }

  // Load attendance regularisations on component mount
  useEffect(() => {
    if (user) loadAttendanceRegularisations()
  }, [user, managerData, empCreds])

  const loadAttendanceRegularisations = async () => {
    try {
      const res = await fetch(`${BACKEND_URL}/emp-attendance-regularise`, {
        cache: "no-store",
      })
      const data = await res.json()
      const regularisationsData = (Array.isArray(data) ? data : []).map(
        (regularisation: any) => ({
          id: regularisation.id.toString(),
          serviceProviderID: regularisation.serviceProviderID,
          companyID: regularisation.companyID,
          branchesID: regularisation.branchesID,
          manageEmployeeID: regularisation.manageEmployeeID,
          serviceProvider: regularisation.serviceProvider?.companyName || "",
          companyName: regularisation.company?.companyName || "",
          branchName: regularisation.branches?.branchName || "",
          employeeId: regularisation.manageEmployee?.employeeID || "",
          day: regularisation.day || "",
          employeeName: regularisation.manageEmployee ?
            `${regularisation.manageEmployee.employeeFirstName || ""} ${regularisation.manageEmployee.employeeLastName || ""}`.trim() : "",
          attendanceDate: regularisation.attendanceDate
            ? new Date(regularisation.attendanceDate).toISOString().split("T")[0]
            : "",
          checkInTime: regularisation.checkInTime
            ? new Date(regularisation.checkInTime).toTimeString().split(' ')[0]
            : "",
          checkOutTime: regularisation.checkOutTime
            ? new Date(regularisation.checkOutTime).toTimeString().split(' ')[0]
            : "",
          actualStatus: regularisation.actualStatus || "",
          requestedStatus: regularisation.requestedStatus || "",
          reason: regularisation.reason || "",
          remarks: regularisation.remarks,
          status: (regularisation.status || "Pending") as "Pending" | "Approved" | "Rejected",
          createdAt: regularisation.createdAt
            ? new Date(regularisation.createdAt).toISOString().split("T")[0]
            : new Date().toISOString().split("T")[0],
        })
      )

      // Role-based filtering
      if (!user) {
        setRegularisations([])
        return
      }

      if (user.role === "SUPERADMIN") {
        setRegularisations(regularisationsData)
        return
      }

      if (user.role === "MANAGER") {
        // Fetch manager info from /users
        const usersData = await fetch(`${BACKEND_URL}/users`).then((r) => r.json())
        const currentUser = usersData.find((u: any) => u.username === user.username)
        if (currentUser) {
          const filtered = regularisationsData.filter(
            (a) =>
              a.companyID === currentUser.companyID &&
              a.branchesID === currentUser.branchesID
          )
          setRegularisations(filtered)
          return
        }
      }

      // For employees or others → get from /manage-emp/credentials/all
      const creds = await fetch(`${BACKEND_URL}/manage-emp/credentials/all`).then((r) => r.json())
      const emp = creds.find((c: any) => c.username === user.username)
      if (emp) {
        const filtered = regularisationsData.filter(
          (a) => a.companyID === emp.companyID && a.branchesID === emp.branchesID
        )
        setRegularisations(filtered)
      } else {
        setRegularisations([])
      }
    } catch (error) {
      console.error("Error loading attendance regularisations:", error)
    }
  }

  const filteredRegularisations = regularisations.filter(regularisation =>
    (regularisation.serviceProvider || "").toLowerCase().includes(searchTerm.toLowerCase()) ||
    (regularisation.companyName || "").toLowerCase().includes(searchTerm.toLowerCase()) ||
    (regularisation.branchName || "").toLowerCase().includes(searchTerm.toLowerCase()) ||
    (regularisation.employeeName || "").toLowerCase().includes(searchTerm.toLowerCase()) ||
    (regularisation.employeeId || "").toLowerCase().includes(searchTerm.toLowerCase()) ||
    (regularisation.attendanceDate || "").toLowerCase().includes(searchTerm.toLowerCase())
  )

  const handleServiceProviderSelect = (selected: SelectedItem) => {
    setFormData((prev) => ({
      ...prev,
      serviceProvider: selected.display,
      serviceProviderID: selected.value,
    }))
  }

  const handleCompanySelect = (selected: SelectedItem) => {
    setFormData((prev) => ({
      ...prev,
      companyName: selected.display,
      companyID: selected.value,
    }))
  }

  const handleBranchSelect = (selected: SelectedItem) => {
    setFormData((prev) => ({
      ...prev,
      branchName: selected.display,
      branchesID: selected.value,
    }))
  }

  const handleEmployeeSelect = (selected: SelectedItem) => {
    const employee = selected.item
    setSelectedEmployee(employee)
    setFormData((prev) => ({
      ...prev,
      employeeName: selected.display,
      manageEmployeeID: selected.value,
    }))
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
      alert("Please make sure all required fields are selected: Branch and Employee");
      return;
    }

    try {
      const attendanceRegularisationData = {
        serviceProviderID: serviceProviderID,
        companyID: companyID,
        branchesID: formData.branchesID,
        manageEmployeeID: formData.manageEmployeeID,
        attendanceDate: formData.attendanceDate ? new Date(formData.attendanceDate) : null,
        day: formData.day,
        checkInTime: formData.checkInTime ? new Date(`2000-01-01T${formData.checkInTime}`) : null,
        checkOutTime: formData.checkOutTime ? new Date(`2000-01-01T${formData.checkOutTime}`) : null,
        actualStatus: formData.actualStatus || null,
        requestedStatus: formData.requestedStatus || null,
        reason: formData.reason || null,
        remarks: formData.remarks,
      }

      const url = editingRegularisation
        ? `${BACKEND_URL}/emp-attendance-regularise/${editingRegularisation.id}`
        : `${BACKEND_URL}/emp-attendance-regularise`
      const method = editingRegularisation ? "PATCH" : "POST"

      const res = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(attendanceRegularisationData),
      })
      if (!res.ok) {
        const errorData = await res.json().catch(() => ({}))
        const message = errorData?.message || `Failed to save attendance regularisation: ${res.status}`
        alert(message)
        return
      }

      await loadAttendanceRegularisations()
      resetForm()
      setIsDialogOpen(false)
    } catch (error) {
      console.error("Error saving attendance regularisation:", error)
    }
  }

  const resetForm = () => {
    setFormData({
      serviceProvider: "",
      companyName: "",
      branchName: "",
      employeeName: "",
      attendanceDate: "",
      checkInTime: "",
      checkOutTime: "",
      actualStatus: "",
      requestedStatus: "",
      reason: "",
      remarks: "",
      day: "",
      serviceProviderID: undefined,
      companyID: undefined,
      branchesID: undefined,
      manageEmployeeID: undefined,
    })
    setSelectedEmployee(null)
    setEditingRegularisation(null)
  }

  const handleEdit = (regularisation: AttendanceRegularisation) => {
    setFormData({
      serviceProvider: regularisation.serviceProvider || "",
      companyName: regularisation.companyName || "",
      branchName: regularisation.branchName || "",
      employeeName: regularisation.employeeName || "",
      attendanceDate: regularisation.attendanceDate,
      checkInTime: regularisation.checkInTime,
      checkOutTime: regularisation.checkOutTime,
      actualStatus: regularisation.actualStatus || "",
      requestedStatus: regularisation.requestedStatus || "",
      reason: regularisation.reason || "",
      remarks: regularisation.remarks || "",
      day: regularisation.day || "",
      serviceProviderID: regularisation.serviceProviderID,
      companyID: regularisation.companyID,
      branchesID: regularisation.branchesID,
      manageEmployeeID: regularisation.manageEmployeeID,
    })
    setSelectedEmployee({
      employeeID: regularisation.employeeId,
      employeeFirstName: regularisation.employeeName?.split(' ')[0] || "",
      employeeLastName: regularisation.employeeName?.split(' ').slice(1).join(' ') || "",
    })
    setEditingRegularisation(regularisation)
    setIsDialogOpen(true)
  }

  const handleDelete = async (id: string) => {
    try {
      const res = await fetch(`${BACKEND_URL}/emp-attendance-regularise/${id}`, {
        method: "DELETE",
      })
      if (!res.ok) {
        throw new Error(`Failed to delete attendance regularisation: ${res.status}`)
      }
      await loadAttendanceRegularisations()
    } catch (error) {
      console.error("Error deleting attendance regularisation:", error)
    }
  }

  const handleApprove = async (id: string) => {
    try {
      const res = await fetch(`${BACKEND_URL}/emp-attendance-regularise/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: "Approved" }),
      })
      if (!res.ok) {
        throw new Error(`Failed to approve attendance regularisation: ${res.status}`)
      }
      await loadAttendanceRegularisations()
    } catch (error) {
      console.error("Error approving attendance regularisation:", error)
    }
  }

  const handleReject = async (id: string) => {
    try {
      const res = await fetch(`${BACKEND_URL}/emp-attendance-regularise/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: "Rejected" }),
      })
      if (!res.ok) {
        throw new Error(`Failed to reject attendance regularisation: ${res.status}`)
      }
      await loadAttendanceRegularisations()
    } catch (error) {
      console.error("Error rejecting attendance regularisation:", error)
    }
  }

  return (
    <div className="space-y-6 w-full max-w-6xl mx-auto px-4">
      {/* Header */}
      <div className="flex items-center justify-between w-full">
        <div className="min-w-0 flex-1">
          <p className="text-gray-600 mt-1 text-sm">Manage attendance corrections and time adjustments</p>
        </div>
        <div className="flex items-center gap-3">
          <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
            <DialogTrigger asChild>
              <Button onClick={resetForm} className="bg-gray-900 hover:bg-gray-800 flex-shrink-0 text-sm px-3 py-2">
                <Plus className="w-4 h-4 mr-1" />
                Submit Regularisation
              </Button>
            </DialogTrigger>
            <DialogContent className="sm:max-w-[600px] max-h-[90vh] overflow-y-auto">
              <DialogHeader>
                <DialogTitle>
                  {editingRegularisation ? "Edit Attendance Regularisation" : "Submit Attendance Regularisation"}
                </DialogTitle>
                <DialogDescription>
                  {editingRegularisation
                    ? "Update the attendance regularisation information below."
                    : "Fill in the details to submit a new attendance regularisation."
                  }
                </DialogDescription>
              </DialogHeader>
              <form onSubmit={handleSubmit} className="space-y-6">
                {/* Organization Selection */}
                <div className="space-y-4">
                  <h3 className="text-lg font-semibold">Organization Selection</h3>
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                    {/* Service Provider - Hidden for non-SUPERADMIN */}
                    {user?.role === "SUPERADMIN" && (
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
                    
                    {/* Company Name - Hidden for non-SUPERADMIN */}
                    {user?.role === "SUPERADMIN" && (
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
                      {(user?.role === "MANAGER" || user?.role === "EMPLOYEE") && (
                        <p className="text-xs text-gray-500 mt-1">
                          You can only select from your assigned branches
                        </p>
                      )}
                    </div>
                  </div>
                </div>

                {/* Employee Selection */}
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
                    {(user?.role === "MANAGER" || user?.role === "EMPLOYEE") && (
                      <p className="text-xs text-gray-500">
                        {user?.role === "MANAGER" 
                          ? "You can only select employees from your assigned branch" 
                          : "You can only select yourself"}
                      </p>
                    )}
                  </div>
                </div>

                {/* Attendance Details */}
                <div className="space-y-4">
                  <h3 className="text-lg font-semibold">Attendance Details</h3>
                  <div className="space-y-2">
                    <Label htmlFor="attendanceDate">Attendance Date *</Label>
                    <Input
                      id="attendanceDate"
                      type="date"
                      value={formData.attendanceDate}
                      max={new Date().toISOString().split("T")[0]}
                      onChange={(e) => setFormData(prev => ({ ...prev, attendanceDate: e.target.value }))}
                      className="w-full"
                      required
                    />
                    <p className="text-xs text-gray-500">Only past dates are allowed for regularisation</p>
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label htmlFor="actualStatus">Actual Status (System Detected)</Label>
                      <select
                        id="actualStatus"
                        value={formData.actualStatus}
                        onChange={(e) => setFormData(prev => ({ ...prev, actualStatus: e.target.value }))}
                        className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 bg-gray-50"
                        required
                      >
                        <option value="">Select Actual Status</option>
                        <option value="ABSENT">Absent</option>
                        <option value="LATE">Late</option>
                        <option value="HALFDAY">Half Day</option>
                        <option value="FULLDAY">Full Day</option>
                        <option value="LOP">Loss of Pay (LOP)</option>
                        <option value="WEEKOFF">Week Off</option>
                      </select>
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="requestedStatus">Request To Change As *</Label>
                      <select
                        id="requestedStatus"
                        value={formData.requestedStatus}
                        onChange={(e) => setFormData(prev => ({ ...prev, requestedStatus: e.target.value }))}
                        className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                        required
                      >
                        <option value="">Select Requested Status</option>
                        <option value="PRESENT">Present</option>
                        <option value="SL">Sick Leave (SL)</option>
                        <option value="CL">Casual Leave (CL)</option>
                        <option value="PL">Privilege Leave (PL)</option>
                        <option value="LOP">Loss of Pay (LOP)</option>
                        <option value="WEEKOFF">Week Off</option>
                      </select>
                    </div>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="reason">Reason *</Label>
                    <textarea
                      id="reason"
                      value={formData.reason}
                      onChange={(e) => setFormData(prev => ({ ...prev, reason: e.target.value }))}
                      placeholder="Explain the reason for attendance regularisation"
                      className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 min-h-[80px] resize-y"
                      required
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="remarks">Remarks</Label>
                    <Input
                      id="remarks"
                      type="text"
                      value={formData.remarks}
                      onChange={(e) => setFormData(prev => ({ ...prev, remarks: e.target.value }))}
                      placeholder="Additional remarks (optional)"
                      className="w-full"
                    />
                  </div>
                </div>

                <DialogFooter>
                  <Button type="button" variant="outline" onClick={() => setIsDialogOpen(false)}>
                    Cancel
                  </Button>
                  <Button type="submit" className="bg-gray-900 hover:bg-gray-800">
                    {editingRegularisation ? "Update Regularisation" : "Submit Regularisation"}
                  </Button>
                </DialogFooter>
              </form>
            </DialogContent>
          </Dialog>
        </div>
      </div>

      {/* Search and Filters */}
      <Card>
        <CardContent className="p-6">
          <div className="flex items-center space-x-4 w-full">
            <div className="relative flex-1 min-w-0">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
              <Input
                placeholder="Search attendance regularisations..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-10 w-full"
              />
            </div>
            <Badge variant="secondary" className="px-3 py-1 flex-shrink-0">
              {filteredRegularisations.length} regularisations
            </Badge>
          </div>
        </CardContent>
      </Card>

      {/* Attendance Regularisations Table */}
      <Card className="w-full">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Icon icon="mdi:clock-edit" className="w-5 h-5" />
            Attendance Regularisations List
          </CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <Table className="w-full">
              <TableHeader>
                <TableRow>
                  <TableHead className="w-[90px]">Service Provider</TableHead>
                  <TableHead className="w-[80px]">Company Name</TableHead>
                  <TableHead className="w-[80px]">Branch Name</TableHead>
                  <TableHead className="w-[70px]">Employee ID</TableHead>
                  <TableHead className="w-[100px]">Employee Name</TableHead>
                  <TableHead className="w-[80px]">Attendance Date</TableHead>
                  <TableHead className="w-[80px]">Actual Status</TableHead>
                  <TableHead className="w-[80px]">Requested As</TableHead>
                  <TableHead className="w-[100px]">Reason</TableHead>
                  <TableHead className="w-[70px]">Status</TableHead>
                  <TableHead className="w-[80px]">Created</TableHead>
                  <TableHead className="w-[80px] text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredRegularisations.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={12} className="text-center py-8 text-gray-500">
                      <div className="flex flex-col items-center gap-2">
                        <Icon icon="mdi:clock-edit" className="w-12 h-12 text-gray-300" />
                        <p>No attendance regularisations found</p>
                        <p className="text-sm">Try adjusting your search criteria</p>
                      </div>
                    </TableCell>
                  </TableRow>
                ) : (
                  filteredRegularisations.map((regularisation, index) => (
                    <TableRow key={regularisation.id}>
                      <TableCell className="truncate" title={regularisation.serviceProvider}>{regularisation.serviceProvider}</TableCell>
                      <TableCell className="truncate" title={regularisation.companyName}>{regularisation.companyName}</TableCell>
                      <TableCell className="truncate" title={regularisation.branchName}>{regularisation.branchName}</TableCell>
                      <TableCell className="truncate">{regularisation.employeeId}</TableCell>
                      <TableCell className="truncate" title={regularisation.employeeName}>{regularisation.employeeName}</TableCell>
                      <TableCell className="truncate">{regularisation.attendanceDate}</TableCell>
                      <TableCell className="truncate">
                        {regularisation.actualStatus && (
                          <Badge variant="outline">{regularisation.actualStatus}</Badge>
                        )}
                      </TableCell>
                      <TableCell className="truncate">
                        {regularisation.requestedStatus && (
                          <Badge variant="secondary">{regularisation.requestedStatus}</Badge>
                        )}
                      </TableCell>
                      <TableCell className="truncate" title={regularisation.reason}>{regularisation.reason}</TableCell>
                      <TableCell className="whitespace-nowrap">
                        <Badge variant={
                          regularisation.status === "Approved" ? "default" :
                            regularisation.status === "Rejected" ? "destructive" : "secondary"
                        }>
                          {regularisation.status}
                        </Badge>
                      </TableCell>
                      <TableCell className="truncate">{regularisation.createdAt}</TableCell>
                      <TableCell className="text-right whitespace-nowrap">
                        <div className="flex items-center justify-end gap-1">
                          {canManage && regularisation.status === "Pending" && (  
                            <>
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => handleApprove(regularisation.id)}
                                className="h-7 w-7 p-0 text-green-600 hover:text-green-700 hover:bg-green-50"
                                title="Approve"
                              >
                                <Check className="w-3 h-3" />
                              </Button>
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => handleReject(regularisation.id)}
                                className="h-7 w-7 p-0 text-red-600 hover:text-red-700 hover:bg-red-50"
                                title="Reject"
                              >
                                <X className="w-3 h-3" />
                              </Button>
                            </>
                          )}
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleEdit(regularisation)}
                            className="h-7 w-7 p-0"
                            title="Edit"
                          >
                            <Edit className="w-3 h-3" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleDelete(regularisation.id)}
                            className="h-7 w-7 p-0 text-red-600 hover:text-red-700 hover:bg-red-50"
                            title="Delete"
                          >
                            <Trash2 className="w-3 h-3" />
                          </Button>
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