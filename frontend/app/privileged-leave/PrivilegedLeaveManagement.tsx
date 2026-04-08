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
import { Plus, Search, Edit, Trash2 } from "lucide-react"
import { useCurrentUser } from "../hooks/useCurrentUser"
import { toast } from "sonner";

const BACKEND_URL = "/backend"

interface LedgerEntry {
  id: number
  serviceProviderID?: number
  companyID?: number
  branchesID?: number
  employeeID: number
  leavePolicyID: number
  creditedLeaves: number
  usedLeaves: number
  balanceLeaves: number
  creditDate: string
  description?: string
  manageEmployee?: any
  leavePolicy?: any
}

interface LapseEntry {
  id: number
  employeeID: number
  leavePolicyID: number
  leaveCount: number
  lapseDate: string
  reason?: string
  manageEmployee?: any
  leavePolicy?: any
}

export function PrivilegedLeaveManagement() {
  const [ledgerEntries, setLedgerEntries] = useState<LedgerEntry[]>([])
  const [lapseEntries, setLapseEntries] = useState<LapseEntry[]>([])
  const [searchTerm, setSearchTerm] = useState("")
  const [isDialogOpen, setIsDialogOpen] = useState(false)
  const [isCreditDialogOpen, setIsCreditDialogOpen] = useState(false)
  const [isLapseDialogOpen, setIsLapseDialogOpen] = useState(false)
  const [editingEntry, setEditingEntry] = useState<LedgerEntry | null>(null)
  const [activeTab, setActiveTab] = useState<"ledger" | "lapse">("ledger")
  const [employees, setEmployees] = useState<any[]>([])
  const [policies, setPolicies] = useState<any[]>([])

  const [formData, setFormData] = useState({
    employeeID: 0,
    leavePolicyID: 0,
    creditedLeaves: 0,
    usedLeaves: 0,
    balanceLeaves: 0,
    creditDate: new Date().toISOString().split("T")[0],
    description: "",
  })

  const [creditData, setCreditData] = useState({ employeeID: 0, leavePolicyID: 0 })
  const [lapseData, setLapseData] = useState({ employeeID: 0, leavePolicyID: 0 })

  const user = useCurrentUser()
  const canManage = user?.role === "SUPERADMIN" || user?.role === "MANAGER"

  useEffect(() => {
    if (user) {
      loadLedger()
      loadLapses()
      loadEmployees()
      loadPolicies()
    }
  }, [user])

  const loadLedger = async () => {
    try {
      const res = await fetch(`${BACKEND_URL}/privileged-leave`)
      const data = await res.json()
      setLedgerEntries(Array.isArray(data) ? data : [])
    } catch (err) {
      console.error("Error loading PL ledger:", err)
      toast.error("Failed to load data.");
      setLedgerEntries([])
    }
  }

  const loadLapses = async () => {
    try {
      // We'll load all lapses from the ledger entries' employees
      setLapseEntries([])
    } catch (err) {
      console.error("Error loading lapses:", err)
      toast.error("Failed to load data.");
    }
  }

  const loadEmployees = async () => {
    try {
      const res = await fetch(`${BACKEND_URL}/manage-emp`)
      const data = await res.json()
      setEmployees(Array.isArray(data) ? data : [])
    } catch (err) {
      console.error("Error loading employees:", err)
      toast.error("Failed to load data.");
    }
  }

  const loadPolicies = async () => {
    try {
      const res = await fetch(`${BACKEND_URL}/leave-policy`)
      const data = await res.json()
      const plPolicies = (Array.isArray(data) ? data : []).filter(
        (p: any) => p.isPrivilegedLeaveApplicable
      )
      setPolicies(plPolicies)
    } catch (err) {
      console.error("Error loading policies:", err)
      toast.error("Failed to load data.");
    }
  }

  const filteredLedger = ledgerEntries.filter((entry) => {
    const empName = `${entry.manageEmployee?.employeeFirstName || ""} ${entry.manageEmployee?.employeeLastName || ""}`.toLowerCase()
    const policyName = (entry.leavePolicy?.leavePolicyName || "").toLowerCase()
    const q = searchTerm.toLowerCase()
    return empName.includes(q) || policyName.includes(q)
  })

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    try {
      const payload = {
        ...formData,
        serviceProviderID: undefined,
        companyID: undefined,
        branchesID: undefined,
      }

      if (editingEntry) {
        await fetch(`${BACKEND_URL}/privileged-leave/${editingEntry.id}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        })
      } else {
        await fetch(`${BACKEND_URL}/privileged-leave`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        })
      }
      await loadLedger()
      setIsDialogOpen(false)
      toast.success(editingEntry ? "Updated successfully" : "Created successfully");
      resetForm()
    } catch (err) {
      console.error("Error saving PL entry:", err)
      toast.error("Failed to save. Please try again.");
    }
  }

  const handleCreditPL = async (e: React.FormEvent) => {
    e.preventDefault()
    try {
      await fetch(`${BACKEND_URL}/privileged-leave/credit`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(creditData),
      })
      await loadLedger()
      setIsCreditDialogOpen(false)
      toast.success("Privileged leave credited successfully");
      setCreditData({ employeeID: 0, leavePolicyID: 0 })
    } catch (err) {
      console.error("Error crediting PL:", err)
      toast.error("Failed to update. Please try again.");
    }
  }

  const handleProcessLapse = async (e: React.FormEvent) => {
    e.preventDefault()
    try {
      const res = await fetch(`${BACKEND_URL}/privileged-leave/lapse`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(lapseData),
      })
      const result = await res.json()
      toast.success(result.message || "Lapse processed")
      await loadLedger()
      setIsLapseDialogOpen(false)
      setLapseData({ employeeID: 0, leavePolicyID: 0 })
    } catch (err) {
      console.error("Error processing lapse:", err)
      toast.error("Lapse processing failed.");
    }
  }

  const resetForm = () => {
    setFormData({
      employeeID: 0,
      leavePolicyID: 0,
      creditedLeaves: 0,
      usedLeaves: 0,
      balanceLeaves: 0,
      creditDate: new Date().toISOString().split("T")[0],
      description: "",
    })
    setEditingEntry(null)
  }

  const handleEdit = (entry: LedgerEntry) => {
    setFormData({
      employeeID: entry.employeeID,
      leavePolicyID: entry.leavePolicyID,
      creditedLeaves: entry.creditedLeaves,
      usedLeaves: entry.usedLeaves,
      balanceLeaves: entry.balanceLeaves,
      creditDate: entry.creditDate?.split("T")[0] || "",
      description: entry.description || "",
    })
    setEditingEntry(entry)
    setIsDialogOpen(true)
  }

  const handleDelete = async (id: number) => {
    try {
      await fetch(`${BACKEND_URL}/privileged-leave/${id}`, { method: "DELETE" })
      await loadLedger()
      toast.success("Deleted successfully");
    } catch (err) {
      console.error("Error deleting PL entry:", err)
      toast.error("Failed to delete. Please try again.");
    }
  }

  const getEmployeeName = (emp: any) => {
    if (!emp) return "-"
    return `${emp.employeeFirstName || ""} ${emp.employeeLastName || ""}`.trim() || "-"
  }

  return (
    <div className="space-y-6 w-full max-w-6xl mx-auto px-4">
      {/* Header */}
      <div className="flex items-center justify-between w-full">
        <div className="min-w-0 flex-1">
          <p className="text-gray-600 mt-1 text-sm">Track PL credits, balances, and lapse history</p>
        </div>
        <div className="flex gap-2">
          {canManage && (
            <>
              <FormDrawer open={isCreditDialogOpen} onOpenChange={setIsCreditDialogOpen} title={"Credit Privileged Leave"} description={"Auto-credit PL based on policy ratio"}>
                  <form onSubmit={handleCreditPL} className="space-y-4">
                    <div className="space-y-2">
                      <Label>Employee</Label>
                      <select
                        className="w-full border rounded-md px-3 py-2 text-sm"
                        value={creditData.employeeID}
                        onChange={(e) => setCreditData((p) => ({ ...p, employeeID: Number(e.target.value) }))}
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
                      <Label>Leave Policy (PL Enabled)</Label>
                      <select
                        className="w-full border rounded-md px-3 py-2 text-sm"
                        value={creditData.leavePolicyID}
                        onChange={(e) => setCreditData((p) => ({ ...p, leavePolicyID: Number(e.target.value) }))}
                        required
                      >
                        <option value={0}>Select Policy</option>
                        {policies.map((pol) => (
                          <option key={pol.id} value={pol.id}>
                            {pol.leavePolicyName} (Ratio: {pol.privilegedLeaveRatio || "20:1"})
                          </option>
                        ))}
                      </select>
                    </div>
                    <div className="flex justify-end gap-3 pt-4">
                      <Button type="button" variant="outline" onClick={() => setIsCreditDialogOpen(false)}>Cancel</Button>
                      <Button type="submit" className="bg-green-600 hover:bg-green-700">Credit PL</Button>
                    </div>
                  </form>
                
              </FormDrawer>

              <FormDrawer open={isLapseDialogOpen} onOpenChange={setIsLapseDialogOpen} title={"Process PL Lapse"} description={"Lapse excess PL beyond carry-forward limit"}>
                  <form onSubmit={handleProcessLapse} className="space-y-4">
                    <div className="space-y-2">
                      <Label>Employee</Label>
                      <select
                        className="w-full border rounded-md px-3 py-2 text-sm"
                        value={lapseData.employeeID}
                        onChange={(e) => setLapseData((p) => ({ ...p, employeeID: Number(e.target.value) }))}
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
                      <Label>Leave Policy</Label>
                      <select
                        className="w-full border rounded-md px-3 py-2 text-sm"
                        value={lapseData.leavePolicyID}
                        onChange={(e) => setLapseData((p) => ({ ...p, leavePolicyID: Number(e.target.value) }))}
                        required
                      >
                        <option value={0}>Select Policy</option>
                        {policies.map((pol) => (
                          <option key={pol.id} value={pol.id}>
                            {pol.leavePolicyName} (Limit: {pol.plCarryForwardLimit || 0})
                          </option>
                        ))}
                      </select>
                    </div>
                    <div className="flex justify-end gap-3 pt-4">
                      <Button type="button" variant="outline" onClick={() => setIsLapseDialogOpen(false)}>Cancel</Button>
                      <Button type="submit" className="bg-orange-600 hover:bg-orange-700">Process Lapse</Button>
                    </div>
                  </form>
                
              </FormDrawer>

              <FormDrawer open={isDialogOpen} onOpenChange={setIsDialogOpen} title={editingEntry ? "Edit PL Entry" : "Add PL Ledger Entry"} description={"Manually add or edit a privileged leave ledger record"}>
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
                              {getEmployeeName(emp)}
                            </option>
                          ))}
                        </select>
                      </div>
                      <div className="space-y-2">
                        <Label>Leave Policy</Label>
                        <select
                          className="w-full border rounded-md px-3 py-2 text-sm"
                          value={formData.leavePolicyID}
                          onChange={(e) => setFormData((p) => ({ ...p, leavePolicyID: Number(e.target.value) }))}
                          required
                        >
                          <option value={0}>Select Policy</option>
                          {policies.map((pol) => (
                            <option key={pol.id} value={pol.id}>
                              {pol.leavePolicyName}
                            </option>
                          ))}
                        </select>
                      </div>
                    </div>
                    <div className="grid grid-cols-3 gap-4">
                      <div className="space-y-2">
                        <Label>Credited Leaves</Label>
                        <Input
                          type="number"
                          step="0.5"
                          value={formData.creditedLeaves}
                          onChange={(e) => setFormData((p) => ({ ...p, creditedLeaves: parseFloat(e.target.value) || 0 }))}
                        />
                      </div>
                      <div className="space-y-2">
                        <Label>Used Leaves</Label>
                        <Input
                          type="number"
                          step="0.5"
                          value={formData.usedLeaves}
                          onChange={(e) => setFormData((p) => ({ ...p, usedLeaves: parseFloat(e.target.value) || 0 }))}
                        />
                      </div>
                      <div className="space-y-2">
                        <Label>Balance Leaves</Label>
                        <Input
                          type="number"
                          step="0.5"
                          value={formData.balanceLeaves}
                          onChange={(e) => setFormData((p) => ({ ...p, balanceLeaves: parseFloat(e.target.value) || 0 }))}
                        />
                      </div>
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <Label>Credit Date</Label>
                        <Input
                          type="date"
                          value={formData.creditDate}
                          onChange={(e) => setFormData((p) => ({ ...p, creditDate: e.target.value }))}
                          required
                        />
                      </div>
                      <div className="space-y-2">
                        <Label>Description</Label>
                        <Input
                          value={formData.description}
                          onChange={(e) => setFormData((p) => ({ ...p, description: e.target.value }))}
                          placeholder="Optional note"
                        />
                      </div>
                    </div>
                    <div className="flex justify-end gap-3 pt-4">
                      <Button type="button" variant="outline" onClick={() => setIsDialogOpen(false)}>Cancel</Button>
                      <Button type="submit" className="">
                        {editingEntry ? "Update" : "Add Entry"}
                      </Button>
                    </div>
                  </form>
                
              </FormDrawer>
            </>
          )}
        </div>
      </div>

      {/* Search */}
      <Card>
        <CardContent className="p-6">
          <div className="flex items-center space-x-4 w-full">
            <div className="relative flex-1 min-w-0">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
              <Input
                placeholder="Search by employee or policy..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-10 w-full"
              />
            </div>
            <div className="flex gap-2">
              <Button
                variant={activeTab === "ledger" ? "default" : "outline"}
                size="sm"
                onClick={() => setActiveTab("ledger")}
              >
                PL Ledger
              </Button>
              <Button
                variant={activeTab === "lapse" ? "default" : "outline"}
                size="sm"
                onClick={() => setActiveTab("lapse")}
              >
                Lapse History
              </Button>
            </div>
            <Badge variant="secondary" className="px-3 py-1 flex-shrink-0">
              {activeTab === "ledger" ? filteredLedger.length : lapseEntries.length} records
            </Badge>
          </div>
        </CardContent>
      </Card>

      {/* PL Ledger Table */}
      {activeTab === "ledger" && (
        <Card className="w-full">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Icon icon="mdi:book-open-page-variant" className="w-5 h-5" />
              Privileged Leave Ledger
            </CardTitle>
          </CardHeader>
          <CardContent className="p-0 w-full">
            <div className="overflow-x-auto w-full">
              <Table className="w-full">
                <TableHeader>
                  <TableRow>
                    <TableHead>Employee</TableHead>
                    <TableHead>Policy</TableHead>
                    <TableHead className="text-center">Credited</TableHead>
                    <TableHead className="text-center">Used</TableHead>
                    <TableHead className="text-center">Balance</TableHead>
                    <TableHead>Credit Date</TableHead>
                    <TableHead>Description</TableHead>
                    {canManage && <TableHead className="text-right">Actions</TableHead>}
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredLedger.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={8} className="text-center py-8 text-gray-500">
                        <div className="flex flex-col items-center gap-2">
                          <Icon icon="mdi:book-open-page-variant" className="w-12 h-12 text-gray-300" />
                          <p>No PL ledger entries found</p>
                        </div>
                      </TableCell>
                    </TableRow>
                  ) : (
                    filteredLedger.map((entry) => (
                      <TableRow key={entry.id}>
                        <TableCell className="font-medium whitespace-nowrap">
                          {getEmployeeName(entry.manageEmployee)}
                        </TableCell>
                        <TableCell className="whitespace-nowrap">
                          {entry.leavePolicy?.leavePolicyName || "-"}
                        </TableCell>
                        <TableCell className="text-center">
                          <Badge variant="secondary" className="bg-green-100 text-green-800">
                            +{entry.creditedLeaves}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-center">
                          <Badge variant="secondary" className="bg-red-100 text-red-800">
                            -{entry.usedLeaves}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-center font-semibold">
                          {entry.balanceLeaves}
                        </TableCell>
                        <TableCell className="whitespace-nowrap">
                          {entry.creditDate ? new Date(entry.creditDate).toLocaleDateString() : "-"}
                        </TableCell>
                        <TableCell className="max-w-[200px] truncate">
                          {entry.description || "-"}
                        </TableCell>
                        {canManage && (
                          <TableCell className="text-right whitespace-nowrap">
                            <div className="flex items-center justify-end gap-1">
                              <Button variant="ghost" size="sm" onClick={() => handleEdit(entry)} className="h-7 w-7 p-0" title="Edit">
                                <Edit className="w-3 h-3" />
                              </Button>
                              <Button variant="ghost" size="sm" onClick={() => handleDelete(entry.id)} className="h-7 w-7 p-0 text-red-600 hover:text-red-700 hover:bg-red-50" title="Delete">
                                <Trash2 className="w-3 h-3" />
                              </Button>
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
      )}

      {/* Lapse History Table */}
      {activeTab === "lapse" && (
        <Card className="w-full">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Icon icon="mdi:timer-sand" className="w-5 h-5" />
              PL Lapse History
            </CardTitle>
          </CardHeader>
          <CardContent className="p-0 w-full">
            <div className="overflow-x-auto w-full">
              <Table className="w-full">
                <TableHeader>
                  <TableRow>
                    <TableHead>Employee</TableHead>
                    <TableHead>Policy</TableHead>
                    <TableHead className="text-center">Lapsed Count</TableHead>
                    <TableHead>Lapse Date</TableHead>
                    <TableHead>Reason</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {lapseEntries.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={5} className="text-center py-8 text-gray-500">
                        <div className="flex flex-col items-center gap-2">
                          <Icon icon="mdi:timer-sand" className="w-12 h-12 text-gray-300" />
                          <p>No lapse records found</p>
                          <p className="text-sm">Process a lapse to see records here</p>
                        </div>
                      </TableCell>
                    </TableRow>
                  ) : (
                    lapseEntries.map((entry) => (
                      <TableRow key={entry.id}>
                        <TableCell className="font-medium whitespace-nowrap">
                          {getEmployeeName(entry.manageEmployee)}
                        </TableCell>
                        <TableCell className="whitespace-nowrap">
                          {entry.leavePolicy?.leavePolicyName || "-"}
                        </TableCell>
                        <TableCell className="text-center">
                          <Badge variant="secondary" className="bg-orange-100 text-orange-800">
                            {entry.leaveCount}
                          </Badge>
                        </TableCell>
                        <TableCell className="whitespace-nowrap">
                          {entry.lapseDate ? new Date(entry.lapseDate).toLocaleDateString() : "-"}
                        </TableCell>
                        <TableCell className="max-w-[300px] truncate">
                          {entry.reason || "-"}
                        </TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  )
}
