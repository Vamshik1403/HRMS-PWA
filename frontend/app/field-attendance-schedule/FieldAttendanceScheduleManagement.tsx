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
import { Plus, Search, Edit, Trash2, MapPin } from "lucide-react"
import { SearchSuggestInput } from "../components/SearchSuggestInput"

interface FieldAttendanceSchedule {
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
  siteName?: string
  address?: string
  latitude?: string
  longitude?: string
  fromDate: string
  toDate: string
  createdAt: string
}

interface SelectedItem {
  display: string
  value: number
  item: any
}

// Backend URL
const BACKEND_URL = process.env.NEXT_PUBLIC_BACKEND_URL || "http://localhost:8000"

export function FieldAttendanceScheduleManagement() {
  const [schedules, setSchedules] = useState<FieldAttendanceSchedule[]>([])
  const [searchTerm, setSearchTerm] = useState("")
  const [isDialogOpen, setIsDialogOpen] = useState(false)
  const [editingSchedule, setEditingSchedule] = useState<FieldAttendanceSchedule | null>(null)
  const [formData, setFormData] = useState({
    serviceProvider: "",
    companyName: "",
    branchName: "",
    employeeName: "",
    siteName: "",
    address: "",
    latitude: "",
    longitude: "",
    fromDate: "",
    toDate: "",
    serviceProviderID: undefined as number | undefined,
    companyID: undefined as number | undefined,
    branchesID: undefined as number | undefined,
    manageEmployeeID: undefined as number | undefined,
  })

  const [selectedEmployee, setSelectedEmployee] = useState<any | null>(null)

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

  const fetchBranches = async (query: string) => {
    try {
      const res = await fetch(`${BACKEND_URL}/branches`, { cache: "no-store" })
      const data = await res.json()
      const q = query.toLowerCase()
      return Array.isArray(data)
        ? data.filter((item: any) =>
          (item?.branchName || "").toLowerCase().includes(q)
        )
        : []
    } catch (error) {
      console.error("Error fetching branches:", error)
      return []
    }
  }

  const fetchEmployees = async (query: string) => {
    try {
      const res = await fetch(`${BACKEND_URL}/manage-emp`, { cache: "no-store" })
      const data = await res.json()
      const q = query.toLowerCase()
      return Array.isArray(data)
        ? data.filter((item: any) => {
          const fullName = `${item?.employeeFirstName || ""} ${item?.employeeLastName || ""}`.trim().toLowerCase()
          const employeeId = (item?.employeeID || "").toLowerCase()
          return fullName.includes(q) || employeeId.includes(q)
        }).map((item: any) => ({
          ...item,
          displayName: `${item?.employeeFirstName || ""} ${item?.employeeLastName || ""}`.trim() + (item?.employeeID ? ` (${item.employeeID})` : "")
        }))
        : []
    } catch (error) {
      console.error("Error fetching employees:", error)
      return []
    }
  }

  // Load field attendance schedules on component mount
  useEffect(() => {
    loadFieldAttendanceSchedules()
  }, [])

  const loadFieldAttendanceSchedules = async () => {
    try {
      const res = await fetch(`${BACKEND_URL}/emp-field-site-attendance`, {
        cache: "no-store",
      })
      const data = await res.json()
      const schedulesData = (Array.isArray(data) ? data : []).map(
        (schedule: any) => ({
          id: schedule.id.toString(),
          serviceProviderID: schedule.serviceProviderID,
          companyID: schedule.companyID,
          branchesID: schedule.branchesID,
          manageEmployeeID: schedule.manageEmployeeID,
          serviceProvider: schedule.serviceProvider?.companyName || "",
          companyName: schedule.company?.companyName || "",
          branchName: schedule.branches?.branchName || "",
          employeeId: schedule.manageEmployee?.employeeID || "",
          employeeName: schedule.manageEmployee ?
            `${schedule.manageEmployee.employeeFirstName || ""} ${schedule.manageEmployee.employeeLastName || ""}`.trim() : "",
          siteName: schedule.siteName,
          address: schedule.address,
          latitude: schedule.latitude,
          longitude: schedule.longitude,
         fromDate: schedule.fromDate
  ? toDatetimeLocal(schedule.fromDate)
  : "",
toDate: schedule.toDate
  ? toDatetimeLocal(schedule.toDate)
  : "",
createdAt: schedule.createdAt
  ? toDatetimeLocal(schedule.createdAt)
  : "",

        })
      )
      setSchedules(schedulesData)
    } catch (error) {
      console.error("Error loading field attendance schedules:", error)
    }
  }

  const filteredSchedules = schedules.filter(schedule =>
    (schedule.serviceProvider || "").toLowerCase().includes(searchTerm.toLowerCase()) ||
    (schedule.companyName || "").toLowerCase().includes(searchTerm.toLowerCase()) ||
    (schedule.branchName || "").toLowerCase().includes(searchTerm.toLowerCase()) ||
    (schedule.employeeName || "").toLowerCase().includes(searchTerm.toLowerCase()) ||
    (schedule.employeeId || "").toLowerCase().includes(searchTerm.toLowerCase()) ||
    (schedule.siteName || "").toLowerCase().includes(searchTerm.toLowerCase()) ||
    (schedule.address || "").toLowerCase().includes(searchTerm.toLowerCase())
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

    try {
      const fieldAttendanceScheduleData = {
        serviceProviderID: formData.serviceProviderID,
        companyID: formData.companyID,
        branchesID: formData.branchesID,
        manageEmployeeID: formData.manageEmployeeID,
        siteName: formData.siteName,
        address: formData.address,
        latitude: formData.latitude,
        longitude: formData.longitude,
        fromDate: formData.fromDate ? new Date(formData.fromDate) : null,
        toDate: formData.toDate ? new Date(formData.toDate) : null,
      }

      const url = editingSchedule
        ? `${BACKEND_URL}/emp-field-site-attendance/${editingSchedule.id}`
        : `${BACKEND_URL}/emp-field-site-attendance`
      const method = editingSchedule ? "PATCH" : "POST"

      const res = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(fieldAttendanceScheduleData),
      })
      if (!res.ok) {
        throw new Error(`Failed to save field attendance schedule: ${res.status}`)
      }

      await loadFieldAttendanceSchedules()
      resetForm()
      setIsDialogOpen(false)
    } catch (error) {
      console.error("Error saving field attendance schedule:", error)
    }
  }

  const resetForm = () => {
    setFormData({
      serviceProvider: "",
      companyName: "",
      branchName: "",
      employeeName: "",
      siteName: "",
      address: "",
      latitude: "",
      longitude: "",
      fromDate: "",
      toDate: "",
      serviceProviderID: undefined,
      companyID: undefined,
      branchesID: undefined,
      manageEmployeeID: undefined,
    })
    setSelectedEmployee(null)
    setEditingSchedule(null)
  }

  const handleEdit = (schedule: FieldAttendanceSchedule) => {
    setFormData({
      serviceProvider: schedule.serviceProvider || "",
      companyName: schedule.companyName || "",
      branchName: schedule.branchName || "",
      employeeName: schedule.employeeName || "",
      siteName: schedule.siteName || "",
      address: schedule.address || "",
      latitude: schedule.latitude || "",
      longitude: schedule.longitude || "",
      fromDate: schedule.fromDate,
      toDate: schedule.toDate,
      serviceProviderID: schedule.serviceProviderID,
      companyID: schedule.companyID,
      branchesID: schedule.branchesID,
      manageEmployeeID: schedule.manageEmployeeID,
    })
    setSelectedEmployee({
      employeeID: schedule.employeeId,
      employeeFirstName: schedule.employeeName?.split(' ')[0] || "",
      employeeLastName: schedule.employeeName?.split(' ').slice(1).join(' ') || "",
    })
    setEditingSchedule(schedule)
    setIsDialogOpen(true)
  }

  const handleDelete = async (id: string) => {
    try {
      const res = await fetch(`${BACKEND_URL}/emp-field-site-attendance/${id}`, {
        method: "DELETE",
      })
      if (!res.ok) {
        throw new Error(`Failed to delete field attendance schedule: ${res.status}`)
      }
      await loadFieldAttendanceSchedules()
    } catch (error) {
      console.error("Error deleting field attendance schedule:", error)
    }
  }

  const generateGoogleMapsLink = (latitude: string, longitude: string) => {
    if (latitude && longitude) {
      return `https://www.google.com/maps?q=${latitude},${longitude}`
    }
    return ""
  }

  function toDatetimeLocal(value?: string | Date | null) {
    if (!value) return ""
    const d = new Date(value)
    return new Date(d.getTime() - d.getTimezoneOffset() * 60000)
      .toISOString()
      .slice(0, 16)
  }


  return (
    <div className="space-y-6 w-full max-w-6xl mx-auto px-4">
      {/* Header */}
      <div className="flex items-center justify-between w-full">
        <div className="min-w-0 flex-1">
          <h1 className="text-2xl font-bold text-gray-900">Field Attendance Schedule</h1>
          <p className="text-gray-600 mt-1 text-sm">Manage field attendance schedules and site assignments</p>
        </div>
        <div className="flex items-center gap-3">
          <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
            <DialogTrigger asChild>
              <Button onClick={resetForm} className="bg-blue-600 hover:bg-blue-700 flex-shrink-0 text-sm px-3 py-2">
                <Plus className="w-4 h-4 mr-1" />
                Add Field Schedule
              </Button>
            </DialogTrigger>
                      <DialogContent    onOpenAutoFocus={(e) => e.preventDefault()}
className="sm:max-w-[700px] max-h-[90vh] overflow-y-auto">
              <DialogHeader>
                <DialogTitle>
                  {editingSchedule ? "Edit Field Attendance Schedule" : "Add New Field Attendance Schedule"}
                </DialogTitle>
                <DialogDescription>
                  {editingSchedule
                    ? "Update the field attendance schedule information below."
                    : "Fill in the details to add a new field attendance schedule."
                  }
                </DialogDescription>
              </DialogHeader>
              <form onSubmit={handleSubmit} className="space-y-6">
                {/* Organization Selection */}
                <div className="space-y-4">
                  <h3 className="text-lg font-semibold">Organization Selection</h3>
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
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
                  </div>
                  {/* {selectedEmployee && (
                    <div className="bg-gray-50 p-4 rounded-md">
                      <h4 className="font-medium text-gray-900 mb-2">Employee ID: {selectedEmployee.employeeID}</h4>
                      <p className="text-sm text-gray-600">Fetch by Name</p>
                    </div>
                  )} */}
                </div>

                {/* Site Information */}
                <div className="space-y-4">
                  <h3 className="text-lg font-semibold">Site Information</h3>
                  <div className="space-y-2">
                    <Label htmlFor="siteName">Site Name *</Label>
                    <Input
                      id="siteName"
                      type="text"
                      value={formData.siteName}
                      onChange={(e) => setFormData(prev => ({ ...prev, siteName: e.target.value }))}
                      placeholder="Enter site name"
                      className="w-full"
                      required
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="address">Address *</Label>
                    <Input
                      id="address"
                      type="text"
                      value={formData.address}
                      onChange={(e) => setFormData(prev => ({ ...prev, address: e.target.value }))}
                      placeholder="Enter site address"
                      className="w-full"
                      required
                    />
                  </div>
                </div>

                {/* Location Information */}
                <div className="space-y-4">
                  <h3 className="text-lg font-semibold">Location Information</h3>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label htmlFor="latitude">Latitude *</Label>
                      <Input
                        id="latitude"
                        type="text"
                        value={formData.latitude}
                        onChange={(e) => setFormData(prev => ({ ...prev, latitude: e.target.value }))}
                        placeholder="Enter latitude"
                        className="w-full"
                        required
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="longitude">Longitude *</Label>
                      <Input
                        id="longitude"
                        type="text"
                        value={formData.longitude}
                        onChange={(e) => setFormData(prev => ({ ...prev, longitude: e.target.value }))}
                        placeholder="Enter longitude"
                        className="w-full"
                        required
                      />
                    </div>
                  </div>
                  {formData.latitude && formData.longitude && (
                    <div className="bg-blue-50 p-4 rounded-md">
                      <h4 className="font-medium text-blue-900 mb-2">Google Maps Link</h4>
                      <a
                        href={generateGoogleMapsLink(formData.latitude, formData.longitude)}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-blue-600 hover:text-blue-800 flex items-center gap-1"
                      >
                        <MapPin className="w-4 h-4" />
                        View Site on Google Maps
                      </a>
                    </div>
                  )}
                </div>

                {/* Schedule Period */}
                <div className="space-y-4">
                  <h3 className="text-lg font-semibold">Schedule Period</h3>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label htmlFor="fromDate">From Date *</Label>
                      <Input
                        type="datetime-local"
                        value={formData.fromDate}
                        onChange={(e) =>
                          setFormData(prev => ({ ...prev, fromDate: e.target.value }))
                        }
                      />


                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="toDate">To Date *</Label>
                      <Input
                        type="datetime-local"
                        value={formData.toDate}
                        onChange={(e) =>
                          setFormData(prev => ({ ...prev, toDate: e.target.value }))
                        }
                      />


                    </div>
                  </div>
                </div>

                <DialogFooter>
                  <Button type="button" variant="outline" onClick={() => setIsDialogOpen(false)}>
                    Cancel
                  </Button>
                  <Button type="submit" className="bg-blue-600 hover:bg-blue-700">
                    {editingSchedule ? "Update Field Schedule" : "Add Field Schedule"}
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
                placeholder="Search field attendance schedules..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-10 w-full"
              />
            </div>
            <Badge variant="secondary" className="px-3 py-1 flex-shrink-0">
              {filteredSchedules.length} schedules
            </Badge>
          </div>
        </CardContent>
      </Card>

      {/* Field Attendance Schedules Table */}
      <Card className="w-full">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Icon icon="mdi:map-marker-multiple" className="w-5 h-5" />
            Field Attendance Schedules List
          </CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <Table className="w-full">
              <TableHeader>
                <TableRow>
                  <TableHead className="w-[40px]">#</TableHead>
                  <TableHead className="w-[80px]">Service Provider</TableHead>
                  <TableHead className="w-[70px]">Company Name</TableHead>
                  <TableHead className="w-[70px]">Branch Name</TableHead>
                  <TableHead className="w-[60px]">Employee ID</TableHead>
                  <TableHead className="w-[90px]">Employee Name</TableHead>
                  <TableHead className="w-[70px]">Site Name</TableHead>
                  <TableHead className="w-[70px]">Latitude</TableHead>
                  <TableHead className="w-[70px]">Longitude</TableHead>
                  <TableHead className="w-[90px]">Google Maps Link</TableHead>
                  <TableHead className="w-[70px]">From Date</TableHead>
                  <TableHead className="w-[70px]">To Date</TableHead>
                  <TableHead className="w-[70px] text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredSchedules.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={15} className="text-center py-8 text-gray-500">
                      <div className="flex flex-col items-center gap-2">
                        <Icon icon="mdi:map-marker-multiple" className="w-12 h-12 text-gray-300" />
                        <p>No field attendance schedules found</p>
                        <p className="text-sm">Try adjusting your search criteria</p>
                      </div>
                    </TableCell>
                  </TableRow>
                ) : (
                  filteredSchedules.map((schedule, index) => (
                    <TableRow key={schedule.id}>
                      <TableCell className="font-medium truncate">{index + 1}</TableCell>
                      <TableCell className="truncate" title={schedule.serviceProvider}>{schedule.serviceProvider}</TableCell>
                      <TableCell className="truncate" title={schedule.companyName}>{schedule.companyName}</TableCell>
                      <TableCell className="truncate" title={schedule.branchName}>{schedule.branchName}</TableCell>
                      <TableCell className="truncate">{schedule.employeeId}</TableCell>
                      <TableCell className="truncate" title={schedule.employeeName}>{schedule.employeeName}</TableCell>
                      <TableCell className="truncate" title={schedule.siteName}>{schedule.siteName}</TableCell>
                      <TableCell className="truncate">{schedule.latitude}</TableCell>
                      <TableCell className="truncate">{schedule.longitude}</TableCell>
                      <TableCell className="whitespace-nowrap">
                        {schedule.latitude && schedule.longitude ? (
                          <a
                            href={generateGoogleMapsLink(schedule.latitude, schedule.longitude)}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-blue-600 hover:text-blue-800 flex items-center gap-1"
                          >
                            <MapPin className="w-3 h-3" />
                            View on Maps
                          </a>
                        ) : (
                          <span className="text-gray-400">-</span>
                        )}
                      </TableCell>
<TableCell>
  {schedule.fromDate
    ? new Date(schedule.fromDate).toLocaleString("en-IN", {
        dateStyle: "medium",
        timeStyle: "short",
      })
    : "-"}
</TableCell>
<TableCell>
  {schedule.toDate
    ? new Date(schedule.toDate).toLocaleString("en-IN", {
        dateStyle: "medium",
        timeStyle: "short",
      })
    : "-"}
</TableCell>
                      <TableCell className="text-right whitespace-nowrap">
                        <div className="flex items-center justify-end gap-1">
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleEdit(schedule)}
                            className="h-7 w-7 p-0"
                            title="Edit"
                          >
                            <Edit className="w-3 h-3" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleDelete(schedule.id)}
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
