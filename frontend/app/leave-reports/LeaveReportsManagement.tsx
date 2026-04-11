"use client"

import { useState } from "react"
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
import { Plus, Search, Edit, Trash2, Download, FileText } from "lucide-react"
import { toast } from "sonner";

interface LeaveReport {
  id: string
  serviceProvider: string
  companyName: string
  branchName: string
  department: string
  employeeName: string
  employeeId: string
  generatedAt: string
  status: "Generated" | "Processing" | "Failed"
  recordCount: number
  reportType: "Leave Summary" | "Leave Balance" | "Leave History" | "Leave Analytics"
}

// Mock data for dropdowns
const mockServiceProviders = [
  "TechCorp Solutions",
  "Global Services Ltd",
  "Enterprise Systems",
  "Digital Innovations"
]

const mockCompanies = [
  "ABC Corporation",
  "XYZ Industries",
  "Tech Solutions Inc",
  "Global Enterprises"
]

const mockBranches = [
  "Mumbai Branch",
  "Delhi Branch",
  "Bangalore Branch",
  "Chennai Branch"
]

const mockDepartments = [
  "All",
  "Human Resources",
  "Information Technology",
  "Finance",
  "Marketing",
  "Operations",
  "Sales",
  "Customer Support"
]

const mockEmployees = [
  { id: "EMP001", name: "John Doe" },
  { id: "EMP002", name: "Jane Smith" },
  { id: "EMP003", name: "Mike Johnson" },
  { id: "EMP004", name: "Sarah Wilson" },
  { id: "EMP005", name: "David Brown" },
  { id: "EMP006", name: "Lisa Anderson" },
  { id: "EMP007", name: "Robert Taylor" },
  { id: "EMP008", name: "Emily Davis" }
]

const reportTypes = [
  "Leave Summary",
  "Leave Balance",
  "Leave History",
  "Leave Analytics"
]

export function LeaveReportsManagement() {
  const [reports, setReports] = useState<LeaveReport[]>([])
  const [searchTerm, setSearchTerm] = useState("")
  const [isDialogOpen, setIsDialogOpen] = useState(false)
  const [editingReport, setEditingReport] = useState<LeaveReport | null>(null)
  const [formData, setFormData] = useState({
    serviceProvider: "",
    companyName: "",
    branchName: "",
    department: "",
    employeeName: "",
    employeeId: ""
  })

  const filteredReports = reports.filter(report =>
    report.serviceProvider.toLowerCase().includes(searchTerm.toLowerCase()) ||
    report.companyName.toLowerCase().includes(searchTerm.toLowerCase()) ||
    report.branchName.toLowerCase().includes(searchTerm.toLowerCase()) ||
    report.department.toLowerCase().includes(searchTerm.toLowerCase()) ||
    report.employeeName.toLowerCase().includes(searchTerm.toLowerCase()) ||
    report.reportType.toLowerCase().includes(searchTerm.toLowerCase())
  )

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    
    if (editingReport) {
      setReports(prev => 
        prev.map(report => 
          report.id === editingReport.id 
            ? { ...report, ...formData, id: editingReport.id, generatedAt: editingReport.generatedAt }
            : report
        )
      )
    } else {
      const employee = mockEmployees.find(emp => emp.id === formData.employeeId)
      const newReport: LeaveReport = {
        id: Date.now().toString(),
        ...formData,
        employeeName: employee?.name || "",
        generatedAt: new Date().toISOString().split('T')[0],
        status: "Generated",
        recordCount: Math.floor(Math.random() * 500) + 50,
        reportType: reportTypes[Math.floor(Math.random() * reportTypes.length)] as "Leave Summary" | "Leave Balance" | "Leave History" | "Leave Analytics"
      }
      setReports(prev => [...prev, newReport])
    }
    
    resetForm()
    setIsDialogOpen(false)
  }

  const resetForm = () => {
    setFormData({
      serviceProvider: "",
      companyName: "",
      branchName: "",
      department: "",
      employeeName: "",
      employeeId: ""
    })
    setEditingReport(null)
  }

  const handleEdit = (report: LeaveReport) => {
    setFormData({
      serviceProvider: report.serviceProvider,
      companyName: report.companyName,
      branchName: report.branchName,
      department: report.department,
      employeeName: report.employeeName,
      employeeId: report.employeeId
    })
    setEditingReport(report)
    setIsDialogOpen(true)
  }

  const handleDelete = (id: string) => {
    setReports(prev => prev.filter(report => report.id !== id))
  }

  const handleGenerateReport = (id: string) => {
    setReports(prev => 
      prev.map(report => 
        report.id === id 
          ? { ...report, status: "Generated" as const }
          : report
      )
    )
  }

  const handleDownloadReport = (id: string) => {
    // Mock download functionality
    console.log(`Downloading leave report ${id}`)
  }

  return (
    <div className="space-y-6 w-full max-w-7xl mx-auto px-4">
      {/* Header */}
      <div className="flex items-center justify-between w-full">
        <div className="min-w-0 flex-1">
          <p className="text-gray-600 mt-1 text-sm">Generate and manage comprehensive leave reports</p>
        </div>
        <div className="flex items-center gap-3">
          <Button onClick={() => { resetForm(); setIsDialogOpen(true); }} className="flex-shrink-0 text-sm px-3 py-2">
                <Plus className="w-4 h-4 mr-1" />
                Generate Report
              </Button>
      </div>

      <FormDrawer open={isDialogOpen} onOpenChange={setIsDialogOpen} title={editingReport ? "Edit Leave Report" : "Generate Leave Report"} description={editingReport ? "Update the leave report configuration below." : "Configure the parameters to generate a new leave report."}>
              <form onSubmit={handleSubmit} className="space-y-6">
                {/* Organization Selection */}
                <div className="space-y-4">
                  <h3 className="text-lg font-semibold">Organization Selection</h3>
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                    <div className="space-y-2">
                      <Label htmlFor="serviceProvider">Service Provider *</Label>
                      <select
                        id="serviceProvider"
                        value={formData.serviceProvider}
                        onChange={(e) => setFormData(prev => ({ ...prev, serviceProvider: e.target.value }))}
                        className="w-full px-3 py-2 border border-gray-300 rounded-sm border-[#d0d0d0] focus:outline-none focus-visible:ring-2 focus-visible:ring-gray-900/15 focus-visible:border-[#b0b0b0]"
                        required
                      >
                        <option value="">Select Service Provider</option>
                        {mockServiceProviders.map((provider) => (
                          <option key={provider} value={provider}>{provider}</option>
                        ))}
                      </select>
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="companyName">Company Name *</Label>
                      <select
                        id="companyName"
                        value={formData.companyName}
                        onChange={(e) => setFormData(prev => ({ ...prev, companyName: e.target.value }))}
                        className="w-full px-3 py-2 border border-gray-300 rounded-sm border-[#d0d0d0] focus:outline-none focus-visible:ring-2 focus-visible:ring-gray-900/15 focus-visible:border-[#b0b0b0]"
                        required
                      >
                        <option value="">Select Company</option>
                        {mockCompanies.map((company) => (
                          <option key={company} value={company}>{company}</option>
                        ))}
                      </select>
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="branchName">Branch Name *</Label>
                      <select
                        id="branchName"
                        value={formData.branchName}
                        onChange={(e) => setFormData(prev => ({ ...prev, branchName: e.target.value }))}
                        className="w-full px-3 py-2 border border-gray-300 rounded-sm border-[#d0d0d0] focus:outline-none focus-visible:ring-2 focus-visible:ring-gray-900/15 focus-visible:border-[#b0b0b0]"
                        required
                      >
                        <option value="">Select Branch</option>
                        {mockBranches.map((branch) => (
                          <option key={branch} value={branch}>{branch}</option>
                        ))}
                      </select>
                    </div>
                  </div>
                </div>

                {/* Report Configuration */}
                <div className="space-y-4">
                  <h3 className="text-lg font-semibold">Report Configuration</h3>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label htmlFor="department">Department *</Label>
                      <select
                        id="department"
                        value={formData.department}
                        onChange={(e) => setFormData(prev => ({ ...prev, department: e.target.value }))}
                        className="w-full px-3 py-2 border border-gray-300 rounded-sm border-[#d0d0d0] focus:outline-none focus-visible:ring-2 focus-visible:ring-gray-900/15 focus-visible:border-[#b0b0b0]"
                        required
                      >
                        <option value="">Select Department</option>
                        {mockDepartments.map((department) => (
                          <option key={department} value={department}>{department}</option>
                        ))}
                      </select>
                      <p className="text-xs text-gray-500">Select or All</p>
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="employeeId">Employee Name *</Label>
                      <select
                        id="employeeId"
                        value={formData.employeeId}
                        onChange={(e) => setFormData(prev => ({ ...prev, employeeId: e.target.value }))}
                        className="w-full px-3 py-2 border border-gray-300 rounded-sm border-[#d0d0d0] focus:outline-none focus-visible:ring-2 focus-visible:ring-gray-900/15 focus-visible:border-[#b0b0b0]"
                        required
                      >
                        <option value="">Select Employee</option>
                        {mockEmployees.map((employee) => (
                          <option key={employee.id} value={employee.id}>
                            {employee.name} ({employee.id})
                          </option>
                        ))}
                      </select>
                      <p className="text-xs text-gray-500">Fetch List</p>
                    </div>
                  </div>
                  {formData.employeeId && (
                    <div className="bg-gray-50 p-4 rounded-md">
                      <h4 className="font-medium text-gray-900 mb-2">Selected Employee: {mockEmployees.find(emp => emp.id === formData.employeeId)?.name}</h4>
                      <p className="text-sm text-gray-600">Employee ID: {formData.employeeId}</p>
                    </div>
                  )}
                </div>

                <div className="flex justify-end gap-3 pt-4">
                  <Button type="button" variant="outline" onClick={() => setIsDialogOpen(false)}>
                    Cancel
                  </Button>
                  <Button type="submit" className="">
                    {editingReport ? "Update Report" : "Generate Report"}
                  </Button>
                </div>
              </form>
      </FormDrawer>
      </div>

      {!isDialogOpen && (<>
      {/* Search and Filters */}
      <Card>
        <CardContent className="p-6">
          <div className="flex items-center space-x-4 w-full">
            <div className="relative flex-1 min-w-0">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
              <Input
                placeholder="Search leave reports..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-10 w-full"
              />
            </div>
            <Badge variant="secondary" className="px-3 py-1 flex-shrink-0">
              {filteredReports.length} reports
            </Badge>
          </div>
        </CardContent>
      </Card>

      {/* Leave Reports Table */}
      <Card className="w-full">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Icon icon="mdi:calendar-text" className="w-5 h-5" />
            Leave Reports List
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
                  <TableHead className="w-[120px]">Department</TableHead>
                  <TableHead className="w-[150px]">Employee Name</TableHead>
                  <TableHead className="w-[100px]">Employee ID</TableHead>
                  <TableHead className="w-[120px]">Report Type</TableHead>
                  <TableHead className="w-[100px]">Status</TableHead>
                  <TableHead className="w-[100px]">Record Count</TableHead>
                  <TableHead className="w-[100px]">Generated At</TableHead>
                  <TableHead className="w-[120px] text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredReports.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={11} className="text-center py-8 text-gray-500">
                      <div className="flex flex-col items-center gap-2">
                        <Icon icon="mdi:calendar-text" className="w-12 h-12 text-gray-300" />
                        <p>No leave reports found</p>
                        <p className="text-sm">Try adjusting your search criteria</p>
                      </div>
                    </TableCell>
                  </TableRow>
                ) : (
                  filteredReports.map((report) => (
                    <TableRow key={report.id}>
                      <TableCell className="font-medium whitespace-nowrap">{report.serviceProvider}</TableCell>
                      <TableCell className="whitespace-nowrap">{report.companyName}</TableCell>
                      <TableCell className="whitespace-nowrap">{report.branchName}</TableCell>
                      <TableCell className="whitespace-nowrap">{report.department}</TableCell>
                      <TableCell className="whitespace-nowrap">{report.employeeName}</TableCell>
                      <TableCell className="whitespace-nowrap">{report.employeeId}</TableCell>
                      <TableCell className="whitespace-nowrap">{report.reportType}</TableCell>
                      <TableCell className="whitespace-nowrap">
                        <Badge variant={
                          report.status === "Generated" ? "default" : 
                          report.status === "Processing" ? "secondary" : "destructive"
                        }>
                          {report.status}
                        </Badge>
                      </TableCell>
                      <TableCell className="whitespace-nowrap">{report.recordCount.toLocaleString()}</TableCell>
                      <TableCell className="whitespace-nowrap">{report.generatedAt}</TableCell>
                      <TableCell className="text-right whitespace-nowrap">
                        <div className="flex items-center justify-end gap-1">
                          {report.status === "Generated" && (
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => handleDownloadReport(report.id)}
                              className="h-7 w-7 p-0 text-blue-600 hover:text-blue-700 hover:bg-blue-50"
                              title="Download Report"
                            >
                              <Download className="w-3 h-3" />
                            </Button>
                          )}
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleEdit(report)}
                            className="h-7 w-7 p-0"
                            title="Edit"
                          >
                            <Edit className="w-3 h-3" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleDelete(report.id)}
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
      </>)}
    </div>
  )
}
