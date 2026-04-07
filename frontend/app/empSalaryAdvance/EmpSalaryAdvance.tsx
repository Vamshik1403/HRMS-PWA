"use client"

import { useEffect, useState } from "react"
import { Card, CardContent } from "../components/ui/card"
import { Button } from "../components/ui/button"
import { Input } from "../components/ui/input"
import { Label } from "../components/ui/label"
import {
  Dialog, DialogContent, DialogFooter,
  DialogHeader, DialogTitle, DialogTrigger,
} from "../components/ui/dialog"
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "../components/ui/table"
import { Badge } from "../components/ui/badge"
import { Search, Edit, Trash2, Plus } from "lucide-react"
import { useCurrentUser } from "../hooks/useCurrentUser"

interface SalaryAdvance {
  id: string
  serviceProviderID?: number
  companyID?: number
  branchesID?: number
  manageEmployeeID?: number
  serviceProvider?: string
  companyName?: string
  branchName?: string
  employeeName?: string
  previousAdvancesDue: string
  advanceAmount: string
  reason: string
  status: string
  createdAt: string
}

const BACKEND_URL = process.env.NEXT_PUBLIC_BACKEND_URL || "/backend"

export function EmpSalaryAdvancePage() {
  const [advances, setAdvances] = useState<SalaryAdvance[]>([])
  const [searchTerm, setSearchTerm] = useState("")
  const [isDialogOpen, setIsDialogOpen] = useState(false)
  const [editingAdvance, setEditingAdvance] = useState<SalaryAdvance | null>(null)
  const [loading, setLoading] = useState(true)


  // Form state
  const [formData, setFormData] = useState({
    serviceProvider: "",
    companyName: "",
    branchName: "",
    employeeName: "",
    previousAdvancesDue: "0",
    advanceAmount: "",
    reason: "",
    status: "Pending",
    serviceProviderID: undefined as number | undefined,
    companyID: undefined as number | undefined,
    branchesID: undefined as number | undefined,
    manageEmployeeID: undefined as number | undefined,
  })

  const user = useCurrentUser()


  useEffect(() => {
    if (user) {
      loadEmployeeAndOrganizationData()
    }
  }, [user])



  useEffect(() => {
    if (isDialogOpen && user) {
      loadEmployeeAndOrganizationData()
    }
  }, [isDialogOpen, user])




  // Load employee data and auto-populate form
  const loadEmployeeAndOrganizationData = async () => {
    try {
      setLoading(true)

      if (!user) throw new Error("User not loaded")

      // ================================
      // 1️⃣ GET ALL EMPLOYEES
      // ================================
      const allEmployees = await fetch(
        `${BACKEND_URL}/manage-emp`,
        { cache: "no-store" }
      ).then(r => r.json())

      // ================================
      // 2️⃣ TRY MATCH BY USERNAME / ID
      // ================================
      let employee = allEmployees.find((emp: any) =>
        emp.employeeFirstName?.toLowerCase() === user.username?.toLowerCase() ||
        emp.employeeLastName?.toLowerCase() === user.username?.toLowerCase() ||
        emp.employeeID?.toString() === user.username
      )

      // ================================
      // 3️⃣ FALLBACK → CREDENTIALS
      // ================================
      if (!employee) {
        const creds = await fetch(
          `${BACKEND_URL}/manage-emp/credentials/all`,
          { cache: "no-store" }
        ).then(r => r.json())

        const userCreds = creds.find(
          (c: any) => c.username === user.username
        )

        if (userCreds) {
          employee = await fetch(
            `${BACKEND_URL}/manage-emp/${userCreds.employeeID}`,
            { cache: "no-store" }
          ).then(r => r.json())
        }
      }

      if (!employee) {
        throw new Error("Employee record not found")
      }

      // ================================
      // 4️⃣ FETCH ORG INFO
      // ================================
      const serviceProvider = await fetch(
        `${BACKEND_URL}/service-provider/${employee.serviceProviderID}`
      ).then(r => r.json())

      const company = await fetch(
        `${BACKEND_URL}/company/${employee.companyID}`
      ).then(r => r.json())

      const branch = await fetch(
        `${BACKEND_URL}/branches/${employee.branchesID}`
      ).then(r => r.json())

      // ================================
      // 5️⃣ SET FORM DATA
      // ================================
      setFormData({
        serviceProvider: serviceProvider?.companyName || "",
        companyName: company?.companyName || "",
        branchName: branch?.branchName || "",
        employeeName: `${employee.employeeFirstName || ""} ${employee.employeeLastName || ""}`.trim(),
        previousAdvancesDue: "0",
        advanceAmount: "",
        reason: "",
        status: "Pending",
        serviceProviderID: employee.serviceProviderID,
        companyID: employee.companyID,
        branchesID: employee.branchesID,
        manageEmployeeID: employee.id,
      })

      // ================================
      // 6️⃣ LOAD DUES + RECORDS
      // ================================
      await calculatePreviousAdvancesDue(employee.id)
      await loadAdvances(employee.id)

    } catch (err) {
      console.error("SalaryAdvance load failed:", err)
    } finally {
      setLoading(false)
    }
  }


  // Calculate previous advances due
  const calculatePreviousAdvancesDue = async (employeeId: number) => {
    try {
      const response = await fetch(`${BACKEND_URL}/salary-advance`, { cache: "no-store" })
      if (!response.ok) throw new Error(`Failed to fetch advances: ${response.status}`)

      const data = await response.json()
      const dues = data.filter((a: any) =>
        a.manageEmployeeID === employeeId &&
        (a.status === "Pending" || a.status === "Approved" || a.status === "Partially Paid")
      )

      const total = dues.reduce((sum: number, cur: any) =>
        sum + (parseFloat(cur.advanceAmount || "0")), 0
      )

      setFormData(p => ({ ...p, previousAdvancesDue: String(total) }))
    } catch (error) {
      console.error("Error calculating previous advances:", error)
      setFormData(p => ({ ...p, previousAdvancesDue: "0" }))
    }
  }

  // Load advances for employee
  const loadAdvances = async (employeeId?: number) => {
    try {
      const response = await fetch(`${BACKEND_URL}/salary-advance`, { cache: "no-store" })
      if (!response.ok) throw new Error(`Failed to fetch advances: ${response.status}`)

      const data = await response.json()

      // Filter by current employee
      const currentEmployeeId = employeeId || formData.manageEmployeeID
      const filtered = currentEmployeeId
        ? data.filter((a: any) => a.manageEmployeeID === currentEmployeeId)
        : data

      // Map to our interface
      const mapped = filtered.map((a: any) => {
        let employeeName = ""
        if (a.manageEmployee) {
          employeeName = `${a.manageEmployee.employeeFirstName || ""} ${a.manageEmployee.employeeLastName || ""}`.trim()
          if (a.manageEmployee.employeeID) {
            employeeName += ` (${a.manageEmployee.employeeID})`
          }
        }

        return {
          id: String(a.id),
          serviceProviderID: a.serviceProviderID,
          companyID: a.companyID,
          branchesID: a.branchesID,
          manageEmployeeID: a.manageEmployeeID,
          serviceProvider: a.serviceProvider?.companyName || "",
          companyName: a.company?.companyName || "",
          branchName: a.branches?.branchName || "",
          employeeName: employeeName,
          previousAdvancesDue: a.previousAdvancesDue || "0",
          advanceAmount: a.advanceAmount || "",
          reason: a.reason || "",
          status: a.status || "Pending",
          createdAt: a.createdAt
            ? new Date(a.createdAt).toISOString().split("T")[0]
            : new Date().toISOString().split("T")[0],
        }
      })

      console.log("Mapped advances:", mapped)
      setAdvances(mapped)
    } catch (error) {
      console.error("Error loading advances:", error)
      setAdvances([])
    }
  }

  // Handle form submission
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()


    // Validation
    if (!formData.advanceAmount || !formData.reason) {
      alert("Please fill in all required fields: Advance Amount and Reason")
      return
    }

    if (!formData.serviceProviderID || !formData.companyID ||
      !formData.branchesID || !formData.manageEmployeeID) {
      alert("Missing organization IDs. Please refresh the page.")
      console.error("Missing IDs:", {
        serviceProviderID: formData.serviceProviderID,
        companyID: formData.companyID,
        branchesID: formData.branchesID,
        manageEmployeeID: formData.manageEmployeeID,
      })
      return
    }

    // Prepare data for API
    const submitData = {
      serviceProviderID: formData.serviceProviderID,
      companyID: formData.companyID,
      branchesID: formData.branchesID,
      manageEmployeeID: formData.manageEmployeeID,
      previousAdvancesDue: formData.previousAdvancesDue,
      advanceAmount: formData.advanceAmount,
      reason: formData.reason,
      status: formData.status,
    }


    try {
      const url = editingAdvance
        ? `${BACKEND_URL}/salary-advance/${editingAdvance.id}`
        : `${BACKEND_URL}/salary-advance`

      const method = editingAdvance ? "PATCH" : "POST"

      const response = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(submitData),
      })

      if (!response.ok) {
        const errorText = await response.text()
        throw new Error(`API Error: ${response.status} - ${errorText}`)
      }

      // Reload data
      await loadAdvances(formData.manageEmployeeID)
      await calculatePreviousAdvancesDue(formData.manageEmployeeID!)

      // Reset and close
      resetForm()
      setIsDialogOpen(false)
      alert("Salary advance submitted successfully!")

    } catch (error: any) {
      console.error("Error submitting advance:", error)
      alert(`Error: ${error.message || "Failed to submit advance"}`)
    }
  }

  // Reset form to initial state
  const resetForm = () => {
    setEditingAdvance(null)
    loadEmployeeAndOrganizationData()
  }


  // Handle edit
  const handleEdit = (a: SalaryAdvance) => {
    setFormData(prev => ({
      ...prev,
      advanceAmount: a.advanceAmount || "",
      reason: a.reason || "",
    }))
    setEditingAdvance(a)
    setIsDialogOpen(true)
  }

  // Handle delete
  const handleDelete = async (id: string) => {
    if (!confirm("Are you sure you want to delete this salary advance?")) return

    try {
      const response = await fetch(`${BACKEND_URL}/salary-advance/${id}`, {
        method: "DELETE",
      })

      if (!response.ok) throw new Error(`Failed to delete: ${response.status}`)

      await loadAdvances(formData.manageEmployeeID)
      await calculatePreviousAdvancesDue(formData.manageEmployeeID!)

      alert("Salary advance deleted successfully!")
    } catch (error) {
      console.error("Error deleting advance:", error)
      alert("Error deleting advance. Please try again.")
    }
  }

  // Filter advances for search
  const filtered = advances.filter(a =>
    (a.companyName || "").toLowerCase().includes(searchTerm.toLowerCase()) ||
    (a.employeeName || "").toLowerCase().includes(searchTerm.toLowerCase()) ||
    (a.advanceAmount || "").toLowerCase().includes(searchTerm.toLowerCase()) ||
    (a.reason || "").toLowerCase().includes(searchTerm.toLowerCase()) ||
    (a.status || "").toLowerCase().includes(searchTerm.toLowerCase())
  )

  // Loading state
  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500 mx-auto"></div>
          <p className="mt-2 text-gray-600">Loading your data...</p>
        </div>
      </div>
    )
  }

  return (
<div className="space-y-6 w-full max-w-6xl mx-auto px-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Salary Advances</h1>
          <p className="text-sm text-gray-600 mt-1">Manage your salary advance requests</p>
        </div>

        <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
          <DialogTrigger asChild>
            <Button onClick={resetForm} className="bg-gray-900 hover:bg-gray-800">
              <Plus className="w-4 h-4 mr-1" /> Add Advance
            </Button>
          </DialogTrigger>

          <DialogContent className="max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>{editingAdvance ? "Edit" : "Add"} Salary Advance</DialogTitle>
            </DialogHeader>

            <form onSubmit={handleSubmit} className="space-y-6">
              {/* Organization Info - Read Only */}
              <div className="space-y-4 p-4 bg-gray-50 rounded-lg">
                <h3 className="font-medium text-gray-700">Organization Information</h3>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label className="text-sm font-medium text-gray-700">Company</Label>
                    <Input
                      type="text"
                      value={formData.companyName || ""}
                      readOnly
                      className="bg-gray-100 border-gray-300"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label className="text-sm font-medium text-gray-700">Branch</Label>
                    <Input
                      type="text"
                      value={formData.branchName || ""}
                      readOnly
                      className="bg-gray-100 border-gray-300"
                    />
                  </div>
                  <div className="space-y-2 col-span-2">
                    <Label className="text-sm font-medium text-gray-700">Employee</Label>
                    <Input
                      type="text"
                      value={formData.employeeName || ""}
                      readOnly
                      className="bg-gray-100 border-gray-300"
                    />
                  </div>
                </div>
              </div>

              {/* Editable Fields */}
              <div className="space-y-4">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <Label>Previous Advances Due</Label>
                    <Input
                      value={`₹${formData.previousAdvancesDue}`}
                      readOnly
                      className="bg-gray-50"
                    />
                  </div>

                  <div>
                    <Label>Advance Amount *</Label>
                    <Input
                      type="text"
                      value={formData.advanceAmount}
                      onChange={e => setFormData(p => ({ ...p, advanceAmount: e.target.value }))}
                      required
                    />
                  </div>
                </div>

                <div>
                  <Label>Reason *</Label>
                  <Input
                    value={formData.reason}
                    onChange={e => setFormData(p => ({ ...p, reason: e.target.value }))}
                    required
                    placeholder="Enter reason for advance"
                  />
                </div>

                <div>
                  <Label>Status</Label>
                  <Input
                    value={formData.status}
                    readOnly
                    className="bg-gray-50"
                  />
                </div>
              </div>



              <DialogFooter>
                <Button
                  type="submit"
                  className="bg-gray-900 hover:bg-gray-800"
                  disabled={!formData.advanceAmount || !formData.reason}
                >
                  {editingAdvance ? "Update" : "Submit"} Advance
                </Button>
              </DialogFooter>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      {/* Search and Table */}
      <Card>
        <CardContent>
          <div className="flex items-center mb-4">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400" />
              <Input
                placeholder="Search advances..."
                value={searchTerm}
                onChange={e => setSearchTerm(e.target.value)}
                className="pl-10"
              />
            </div>
            <Badge variant="secondary" className="ml-3">
              {filtered.length} {filtered.length === 1 ? 'advance' : 'advances'}
            </Badge>
          </div>

          {filtered.length === 0 ? (
            <div className="text-center py-8">
              <p className="text-gray-500">No salary advances found.</p>
              {advances.length === 0 && (
                <p className="text-sm text-gray-400 mt-1">
{"You don't have any salary advances yet."}
                </p>
              )}
            </div>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Company</TableHead>
                    <TableHead>Employee</TableHead>
                    <TableHead>Prev Due</TableHead>
                    <TableHead>Amount</TableHead>
                    <TableHead>Reason</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filtered.map(a => (
                    <TableRow key={a.id}>
                      <TableCell>{a.companyName || "-"}</TableCell>
                      <TableCell>{a.employeeName || "-"}</TableCell>
                      <TableCell>₹{a.previousAdvancesDue}</TableCell>
                      <TableCell>₹{a.advanceAmount}</TableCell>
                      <TableCell>{a.reason || "-"}</TableCell>
                      <TableCell>
                        <Badge
                          className={
                            a.status === "Approved" ? "bg-green-600 hover:bg-green-600" :
                              a.status === "Rejected" ? "bg-red-600 hover:bg-red-600" :
                                a.status === "Paid" ? "bg-gray-900 hover:bg-gray-900" :
                                  "bg-yellow-500 hover:bg-yellow-500"
                          }
                        >
                          {a.status}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex justify-end gap-1">
                          {a.status !== "Approved" && a.status !== "Paid" && (
                            <>
                              <Button
                                size="sm"
                                variant="ghost"
                                onClick={() => handleEdit(a)}
                                title="Edit"
                              >
                                <Edit className="w-4 h-4" />
                              </Button>
                              <Button
                                size="sm"
                                variant="ghost"
                                className="text-red-600 hover:text-red-700 hover:bg-red-50"
                                onClick={() => handleDelete(a.id)}
                                title="Delete"
                              >
                                <Trash2 className="w-4 h-4" />
                              </Button>
                            </>
                          )}
                          {(a.status === "Approved" || a.status === "Paid") && (
                            <span className="text-sm text-gray-500">No actions</span>
                          )}
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}