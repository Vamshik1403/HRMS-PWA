"use client"

import { hasModuleWriteAccess, isCompanyAdminLikeRole } from "@/lib/companyAccess";

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
import { Plus, Search, Trash2 } from "lucide-react"
import { useCurrentUser } from "../hooks/useCurrentUser"
import { getSidebarContext } from "../utils/sidebarContext"
import { toast } from "sonner"

const BACKEND_URL = "/backend"

interface WeeklyOff {
  id: number
  employeeID: number
  date: string
  manageEmployee?: any
}

export function EmployeeWeeklyOffManagement() {
  const [weeklyOffs, setWeeklyOffs] = useState<WeeklyOff[]>([])
  const [searchTerm, setSearchTerm] = useState("")
  const [isDialogOpen, setIsDialogOpen] = useState(false)
  const [employees, setEmployees] = useState<any[]>([])

  const [formData, setFormData] = useState({
    employeeID: 0,
    date: "",
  })

  const user = useCurrentUser()
  const canManage = user?.role === "SUPERADMIN" || user?.role === "SERVICE_PROVIDER" || isCompanyAdminLikeRole(user?.role) || user?.role === "BRANCH_ADMIN"

  useEffect(() => {
    if (user) {
      loadWeeklyOffs()
      loadEmployees()
    }
  }, [user])

  useEffect(() => {
    const handler = () => { if (user) loadWeeklyOffs(); };
    window.addEventListener("sidebar-context-changed", handler);
    window.addEventListener("app-data-refresh", handler);
    return () => {
      window.removeEventListener("sidebar-context-changed", handler);
      window.removeEventListener("app-data-refresh", handler);
    };
  }, [user]);

  const loadWeeklyOffs = async () => {
    try {
      const res = await fetch(`${BACKEND_URL}/employee-weekly-off`)
      const data = await res.json()
      let result = Array.isArray(data) ? data : []
      if (user?.role === "SUPERADMIN") {
        const ctx = getSidebarContext();
        if (ctx?.companyID) {
          result = result.filter((r: any) => r.companyID === ctx.companyID);
        }
      }
      setWeeklyOffs(result)
    } catch (err) {
      console.error("Error loading weekly offs:", err)
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

  const filteredOffs = weeklyOffs.filter((wo) => {
    const empName = `${wo.manageEmployee?.employeeFirstName || ""} ${wo.manageEmployee?.employeeLastName || ""}`.toLowerCase()
    return empName.includes(searchTerm.toLowerCase())
  })

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()

    // Validation
    const validationErrors: string[] = []
    if (!formData.employeeID) validationErrors.push("Please select an Employee")
    if (!formData.date) validationErrors.push("Date is required")
    if (validationErrors.length > 0) {
      validationErrors.forEach(msg => toast.error(msg))
      return
    }

    try {
      await fetch(`${BACKEND_URL}/employee-weekly-off`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(formData),
      })
      await loadWeeklyOffs()
      setIsDialogOpen(false)
      setFormData({ employeeID: 0, date: "" })
      toast.success("Weekly off saved successfully")
    } catch (err) {
      console.error("Error saving weekly off:", err)
      toast.error((err as any)?.message || "Failed to save weekly off")
    }
  }

  const handleDelete = async (id: number) => {
    try {
      await fetch(`${BACKEND_URL}/employee-weekly-off/${id}`, { method: "DELETE" })
      await loadWeeklyOffs()
      toast.success("Weekly off deleted successfully")
    } catch (err) {
      console.error("Error deleting weekly off:", err)
      toast.error((err as any)?.message || "Failed to delete weekly off")
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
          <p className="text-gray-600 mt-1 text-sm">Track and manage employee weekly off days</p>
        </div>
        {canManage && !isDialogOpen && (
          <Button onClick={() => setIsDialogOpen(true)} className="text-sm px-3 py-2">
            <Plus className="w-4 h-4 mr-1" />
            Add Weekly Off
          </Button>
        )}
      </div>

      <FormDrawer
        open={isDialogOpen}
        onOpenChange={setIsDialogOpen}
        title="Add Weekly Off"
        description="Assign a weekly off day to an employee"
      >
              <form onSubmit={handleSubmit} className="space-y-4">
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
                  <Label>Date</Label>
                  <Input
                    type="date"
                    value={formData.date}
                    onChange={(e) => setFormData((p) => ({ ...p, date: e.target.value }))}
                    required
                  />
                </div>
                <div className="flex justify-end gap-2 pt-4 border-t border-gray-200">
                  <Button type="button" variant="outline" onClick={() => setIsDialogOpen(false)}>Cancel</Button>
                  <Button type="submit" className="">Add Weekly Off</Button>
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
                placeholder="Search by employee..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-10 w-full"
              />
            </div>
            <Badge variant="secondary" className="px-3 py-1 flex-shrink-0">
              {filteredOffs.length} records
            </Badge>
          </div>
        </CardContent>
      </Card>

      <Card className="w-full">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Icon icon="mdi:calendar-weekend" className="w-5 h-5" />
            Weekly Off Records
          </CardTitle>
        </CardHeader>
        <CardContent className="p-0 w-full">
          <div className="overflow-x-auto w-full">
            <Table className="w-full">
              <TableHeader>
                <TableRow>
                  <TableHead>Employee</TableHead>
                  <TableHead>Employee ID</TableHead>
                  <TableHead>Date</TableHead>
                  <TableHead>Day</TableHead>
                  {canManage && <TableHead className="text-right">Actions</TableHead>}
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredOffs.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={5} className="text-center py-8 text-gray-500">
                      <div className="flex flex-col items-center gap-2">
                        <Icon icon="mdi:calendar-weekend" className="w-12 h-12 text-gray-300" />
                        <p>No weekly off records found</p>
                      </div>
                    </TableCell>
                  </TableRow>
                ) : (
                  filteredOffs.map((wo) => {
                    const dateObj = new Date(wo.date)
                    const dayName = dateObj.toLocaleDateString("en-US", { weekday: "long" })
                    return (
                      <TableRow key={wo.id}>
                        <TableCell className="font-medium whitespace-nowrap">{getEmployeeName(wo.manageEmployee)}</TableCell>
                        <TableCell className="whitespace-nowrap">{wo.manageEmployee?.employeeID || "-"}</TableCell>
                        <TableCell className="whitespace-nowrap">{dateObj.toLocaleDateString()}</TableCell>
                        <TableCell className="whitespace-nowrap">
                          <Badge variant="secondary">{dayName}</Badge>
                        </TableCell>
                        {canManage && (
                          <TableCell className="text-right">
                            <Button variant="ghost" size="sm" onClick={() => handleDelete(wo.id)} className="h-7 w-7 p-0 text-red-600 hover:text-red-700 hover:bg-red-50">
                              <Trash2 className="w-3 h-3" />
                            </Button>
                          </TableCell>
                        )}
                      </TableRow>
                    )
                  })
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
