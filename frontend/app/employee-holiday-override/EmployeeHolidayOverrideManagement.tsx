import { hasModuleWriteAccess } from "@/lib/companyAccess";
"use client"

import { useState, useEffect } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "../components/ui/card"
import { Button } from "../components/ui/button"
import { Input } from "../components/ui/input"
import { Label } from "../components/ui/label"
import { FormDrawer } from "../components/ui/form-drawer"
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
import { Plus, Search, Edit, Trash2 } from "lucide-react"
import { useCurrentUser } from "../hooks/useCurrentUser"
import { getSidebarContext } from "../utils/sidebarContext"
import { toast } from "sonner"

const BACKEND_URL = "/backend"

interface Override {
  id: number
  employeeID: number
  holidayId: number
  fromDate: string
  toDate: string
  reason?: string
  manageEmployee?: any
  publicHoliday?: any
}

export function EmployeeHolidayOverrideManagement() {
  const [overrides, setOverrides] = useState<Override[]>([])
  const [searchTerm, setSearchTerm] = useState("")
  const [isDialogOpen, setIsDialogOpen] = useState(false)
  const [editingOverride, setEditingOverride] = useState<Override | null>(null)
  const [employees, setEmployees] = useState<any[]>([])
  const [holidays, setHolidays] = useState<any[]>([])

  const [formData, setFormData] = useState({
    employeeID: 0,
    holidayId: 0,
    fromDate: "",
    toDate: "",
    reason: "",
  })

  const user = useCurrentUser()
  const canManage = user?.role === "SUPERADMIN" || user?.role === "SERVICE_PROVIDER" || user?.role === "COMPANY_ADMIN" || user?.role === "BRANCH_ADMIN"

  useEffect(() => {
    if (user) {
      loadOverrides()
      loadEmployees()
      loadHolidays()
    }
  }, [user])

  useEffect(() => {
    const handler = () => { if (user) { loadOverrides(); } };
    window.addEventListener("sidebar-context-changed", handler);
    window.addEventListener("app-data-refresh", handler);
    return () => {
      window.removeEventListener("sidebar-context-changed", handler);
      window.removeEventListener("app-data-refresh", handler);
    };
  }, [user]);

  const loadOverrides = async () => {
    try {
      const res = await fetch(`${BACKEND_URL}/employee-holiday-override`)
      const data = await res.json()
      let result = Array.isArray(data) ? data : []
      if (user?.role === "SUPERADMIN") {
        const ctx = getSidebarContext();
        if (ctx?.companyID) {
          result = result.filter((r: any) => r.companyID === ctx.companyID);
        }
      }
      setOverrides(result)
    } catch (err) {
      console.error("Error loading overrides:", err)
    }
  }

  const loadEmployees = async () => {
    try {
      const res = await fetch(`${BACKEND_URL}/manage-emp`)
      const data = await res.json()
      setEmployees(Array.isArray(data) ? data : [])
    } catch (err) {
      console.error("Error loading employees:", err)
    }
  }

  const loadHolidays = async () => {
    try {
      const res = await fetch(`${BACKEND_URL}/public-holiday`)
      const data = await res.json()
      setHolidays(Array.isArray(data) ? data : [])
    } catch (err) {
      console.error("Error loading holidays:", err)
    }
  }

  const filteredOverrides = overrides.filter((o) => {
    const empName = `${o.manageEmployee?.employeeFirstName || ""} ${o.manageEmployee?.employeeLastName || ""}`.toLowerCase()
    const holidayName = (o.publicHoliday?.manageHoliday?.holidayName || "").toLowerCase()
    const q = searchTerm.toLowerCase()
    return empName.includes(q) || holidayName.includes(q)
  })

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()

    // Validation
    const validationErrors: string[] = []
    if (!formData.employeeID) validationErrors.push("Please select an Employee")
    if (validationErrors.length > 0) {
      validationErrors.forEach(msg => toast.error(msg))
      return
    }

    try {
      if (editingOverride) {
        await fetch(`${BACKEND_URL}/employee-holiday-override/${editingOverride.id}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(formData),
        })
      } else {
        await fetch(`${BACKEND_URL}/employee-holiday-override`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(formData),
        })
      }
      await loadOverrides()
      setIsDialogOpen(false)
      resetForm()
      toast.success("Holiday override saved successfully")
    } catch (err) {
      console.error("Error saving override:", err)
      toast.error((err as any)?.message || "Failed to save holiday override")
    }
  }

  const resetForm = () => {
    setFormData({ employeeID: 0, holidayId: 0, fromDate: "", toDate: "", reason: "" })
    setEditingOverride(null)
  }

  const handleEdit = (override: Override) => {
    setFormData({
      employeeID: override.employeeID,
      holidayId: override.holidayId,
      fromDate: override.fromDate?.split("T")[0] || "",
      toDate: override.toDate?.split("T")[0] || "",
      reason: override.reason || "",
    })
    setEditingOverride(override)
    setIsDialogOpen(true)
  }

  const handleDelete = async (id: number) => {
    try {
      await fetch(`${BACKEND_URL}/employee-holiday-override/${id}`, { method: "DELETE" })
      await loadOverrides()
      toast.success("Holiday override deleted successfully")
    } catch (err) {
      console.error("Error deleting override:", err)
      toast.error((err as any)?.message || "Failed to delete holiday override")
    }
  }

  const getEmployeeName = (emp: any) => {
    if (!emp) return "-"
    return `${emp.employeeFirstName || ""} ${emp.employeeLastName || ""}`.trim() || "-"
  }

  return (
    <div className="space-y-6 w-full max-w-6xl mx-auto px-4">
      <div className="flex items-center justify-between w-full">
        <div className="min-w-0 flex-1">
          <p className="text-gray-600 mt-1 text-sm">Assign custom holiday overrides per employee</p>
        </div>
        {canManage && !isDialogOpen && (
          <Button onClick={() => { resetForm(); setIsDialogOpen(true); }} className="text-sm px-3 py-2">
            <Plus className="w-4 h-4 mr-1" />
            Add Override
          </Button>
        )}
      </div>

      <FormDrawer
        open={isDialogOpen}
        onOpenChange={setIsDialogOpen}
        title={editingOverride ? "Edit Override" : "Add Holiday Override"}
        description="Override default holidays for a specific employee"
      >
              <form onSubmit={handleSubmit} className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>Employee</Label>
                    <select
                      className="w-full border rounded-md px-3 py-2 text-sm"
                      value={formData.employeeID}
                      onChange={(e) => setFormData((p) => ({ ...p, employeeID: Number(e.target.value) }))}
                      required
                    >
                      <option value={0}>Select Employee</option>
                      {employees.map((emp) => (
                        <option key={emp.id} value={emp.id}>
                          {getEmployeeName(emp)} ({emp.employeeID || emp.id})
                        </option>
                      ))}
                    </select>
                  </div>
                  <div className="space-y-2">
                    <Label>Public Holiday</Label>
                    <select
                      className="w-full border rounded-md px-3 py-2 text-sm"
                      value={formData.holidayId}
                      onChange={(e) => setFormData((p) => ({ ...p, holidayId: Number(e.target.value) }))}
                      required
                    >
                      <option value={0}>Select Holiday</option>
                      {holidays.map((h) => (
                        <option key={h.id} value={h.id}>
                          {h.manageHoliday?.holidayName || `Holiday #${h.id}`}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>From Date</Label>
                    <Input
                      type="date"
                      value={formData.fromDate}
                      onChange={(e) => setFormData((p) => ({ ...p, fromDate: e.target.value }))}
                      required
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>To Date</Label>
                    <Input
                      type="date"
                      value={formData.toDate}
                      onChange={(e) => setFormData((p) => ({ ...p, toDate: e.target.value }))}
                      required
                    />
                  </div>
                </div>
                <div className="space-y-2">
                  <Label>Reason</Label>
                  <Input
                    value={formData.reason}
                    onChange={(e) => setFormData((p) => ({ ...p, reason: e.target.value }))}
                    placeholder="Reason for override"
                  />
                </div>
                <div className="flex justify-end gap-2 pt-4 border-t border-gray-200">
                  <Button type="button" variant="outline" onClick={() => setIsDialogOpen(false)}>Cancel</Button>
                  <Button type="submit" className="">
                    {editingOverride ? "Update" : "Add Override"}
                  </Button>
                </div>
              </form>
      </FormDrawer>

      {!isDialogOpen && (<>
      <Card>
        <CardContent className="p-6">
          <div className="flex items-center space-x-4 w-full">
            <div className="relative flex-1 min-w-0">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
              <Input
                placeholder="Search by employee or holiday..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-10 w-full"
              />
            </div>
            <Badge variant="secondary" className="px-3 py-1 flex-shrink-0">
              {filteredOverrides.length} overrides
            </Badge>
          </div>
        </CardContent>
      </Card>

      <Card className="w-full">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Icon icon="mdi:calendar-edit" className="w-5 h-5" />
            Holiday Overrides
          </CardTitle>
        </CardHeader>
        <CardContent className="p-0 w-full">
          <div className="overflow-x-auto w-full">
            <Table className="w-full">
              <TableHeader>
                <TableRow>
                  <TableHead>Employee</TableHead>
                  <TableHead>Holiday</TableHead>
                  <TableHead>From Date</TableHead>
                  <TableHead>To Date</TableHead>
                  <TableHead>Reason</TableHead>
                  {canManage && <TableHead className="text-right">Actions</TableHead>}
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredOverrides.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={6} className="text-center py-8 text-gray-500">
                      <div className="flex flex-col items-center gap-2">
                        <Icon icon="mdi:calendar-edit" className="w-12 h-12 text-gray-300" />
                        <p>No holiday overrides found</p>
                      </div>
                    </TableCell>
                  </TableRow>
                ) : (
                  filteredOverrides.map((o) => (
                    <TableRow key={o.id}>
                      <TableCell className="font-medium whitespace-nowrap">{getEmployeeName(o.manageEmployee)}</TableCell>
                      <TableCell className="whitespace-nowrap">{o.publicHoliday?.manageHoliday?.holidayName || "-"}</TableCell>
                      <TableCell className="whitespace-nowrap">{o.fromDate ? new Date(o.fromDate).toLocaleDateString() : "-"}</TableCell>
                      <TableCell className="whitespace-nowrap">{o.toDate ? new Date(o.toDate).toLocaleDateString() : "-"}</TableCell>
                      <TableCell className="max-w-[200px] truncate">{o.reason || "-"}</TableCell>
                      {canManage && (
                        <TableCell className="text-right whitespace-nowrap">
                          <div className="flex items-center justify-end gap-1">
                            <Button variant="ghost" size="sm" onClick={() => handleEdit(o)} className="h-7 w-7 p-0"><Edit className="w-3 h-3" /></Button>
                            <Button variant="ghost" size="sm" onClick={() => handleDelete(o.id)} className="h-7 w-7 p-0 text-red-600 hover:text-red-700 hover:bg-red-50"><Trash2 className="w-3 h-3" /></Button>
                          </div>
                        </TableCell>
                      )}
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
