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
import { SearchSuggestInput } from "../components/SearchSuggestInput"
import { useCurrentUser } from "../hooks/useCurrentUser";
import { toast } from "sonner";
import { getSidebarContext } from "../utils/sidebarContext";

interface Holiday {
  id: string
  serviceProviderID?: number
  companyID?: number
  branchesID?: number
  serviceProvider?: string
  companyName?: string
  branchName?: string
  holidayName: string
  monthPeriod?: string
  createdAt: string
}

interface SelectedItem {
  display: string
  value: number
  item: any
}

const BACKEND_URL = process.env.NEXT_PUBLIC_BACKEND_URL || "/backend"

const monthsFull = ["January","February","March","April","May","June","July","August","September","October","November","December"]

function clampDay(d: number) {
  if (!Number.isFinite(d)) return 1
  return Math.max(1, Math.min(28, Math.floor(d)))
}

function buildSalaryPeriodLabels(fyStart?: string | null, dayStr?: string | number | null): string[] {
  const now = new Date()
  const y = now.getFullYear()
  const day = clampDay(Number(dayStr ?? 1))
  const fyIsJan = (fyStart ?? "").toLowerCase().includes("jan")

  const fmt = (d: Date) => `${d.getDate()} ${monthsFull[d.getMonth()]} ${d.getFullYear()}`
  const addMonths = (y: number, m: number, delta: number) => {
    const n = m + delta
    const y2 = y + Math.floor(n / 12)
    const m2 = ((n % 12) + 12) % 12
    return { y: y2, m: m2 }
  }
  const makeDate = (y: number, m: number, d: number) => new Date(y, m, d)

  if (day === 1) {
    if (fyIsJan) {
      return monthsFull.map((m, i) => `${m} ${y}`)
    } else {
      const out: string[] = []
      for (let i = 3; i <= 11; i++) out.push(`${monthsFull[i]} ${y}`)
      out.push(`January ${y + 1}`, `February ${y + 1}`, `March ${y + 1}`)
      return out
    }
  }

  const periods: string[] = []
  if (fyIsJan) {
    const start0 = makeDate(y - 1, 11, day)
    for (let i = 0; i < 12; i++) {
      const start = addMonths(start0.getFullYear(), start0.getMonth(), i)
      const startDate = makeDate(start.y, start.m, day)
      const end = addMonths(startDate.getFullYear(), startDate.getMonth(), 1)
      const endDate = makeDate(end.y, end.m, day - 1)
      periods.push(`${fmt(startDate)} to ${fmt(endDate)}`)
    }
  } else {
    const start0 = makeDate(y, 2, day)
    for (let i = 0; i < 12; i++) {
      const start = addMonths(start0.getFullYear(), start0.getMonth(), i)
      const startDate = makeDate(start.y, start.m, day)
      const end = addMonths(startDate.getFullYear(), startDate.getMonth(), 1)
      const endDate = makeDate(end.y, end.m, day - 1)
      periods.push(`${fmt(startDate)} to ${fmt(endDate)}`)
    }
  }
  return periods
}

export function ManageHolidaysManagement() {
  const [holidays, setHolidays] = useState<Holiday[]>([])
  const [searchTerm, setSearchTerm] = useState("")
  const [isDialogOpen, setIsDialogOpen] = useState(false)
  const [editingHoliday, setEditingHoliday] = useState<Holiday | null>(null)
  const [formData, setFormData] = useState({
    serviceProvider: "",
    companyName: "",
    branchName: "",
    holidayName: "",
    serviceProviderID: undefined as number | undefined,
    companyID: undefined as number | undefined,
    branchesID: undefined as number | undefined,
    monthPeriod: "",
  })
  
  const user = useCurrentUser();
  const canManage = user?.role === "SUPERADMIN" || user?.role === "SERVICE_PROVIDER" || user?.role === "COMPANY_ADMIN";

  const [managerData, setManagerData] = useState<any>(null);
  const [empCreds, setEmpCreds] = useState<any>(null);
  const [isLoading, setIsLoading] = useState(false);

  const [selectedCompanyFYStart, setSelectedCompanyFYStart] = useState<string | null>(null)
  const [selectedCompanyStartDay, setSelectedCompanyStartDay] = useState<string>("1")
  const [salaryPeriodOptions, setSalaryPeriodOptions] = useState<string[]>([])

  // Resolved IDs based on role
  const resolvedServiceProviderID = user?.role === "SUPERADMIN" 
    ? formData.serviceProviderID 
    : managerData?.serviceProviderID || empCreds?.serviceProviderID;

  const resolvedCompanyID = user?.role === "SUPERADMIN" 
    ? formData.companyID 
    : managerData?.companyID || empCreds?.companyID;

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
          
          // Auto-populate form data for MANAGER
          if (me) {
            setFormData(prev => ({
              ...prev,
              serviceProviderID: me.serviceProviderID,
              companyID: me.companyID,
              serviceProvider: me.serviceProviderName || "",
              companyName: me.companyName || "",
            }));
          }
        }

        // --- EMPLOYEE ---
        if (user.role === "EMPLOYEE") {
          const credsRes = await fetch(`${BACKEND_URL}/manage-emp/credentials/all`);
          const creds = await credsRes.json();
          const me = creds.find((u: any) => u.username === user.username);
          setEmpCreds(me || null);
          
          // Auto-populate form data for EMPLOYEE
          if (me) {
            setFormData(prev => ({
              ...prev,
              serviceProviderID: me.serviceProviderID,
              companyID: me.companyID,
              branchesID: me.branchesID,
              serviceProvider: me.serviceProviderName || "",
              companyName: me.companyName || "",
              branchName: me.branchName || "",
            }));
          }
        }
      } catch (error) {
        console.error("Error loading user data:", error);
      }
    };

    loadUserData();
  }, [user]);

  useEffect(() => { 
    loadHolidays() 
  }, [user, managerData, empCreds])

  useEffect(() => {
    const handler = () => { if (user) loadHolidays(); };
    window.addEventListener("sidebar-context-changed", handler);
    return () => window.removeEventListener("sidebar-context-changed", handler);
  }, [user]);

  const loadHolidays = async () => {
    setIsLoading(true);
    try {
      console.log("Loading holidays...");
      const res = await fetch(`${BACKEND_URL}/manage-holiday`, { 
        cache: "no-store",
        headers: {
          'Content-Type': 'application/json',
        }
      });
      
      if (!res.ok) {
        throw new Error(`HTTP error! status: ${res.status}`);
      }
      
      const data = await res.json();
      console.log("Raw API response:", data);
      
      // Handle different response formats
      const all = Array.isArray(data) ? data : (data.data || data.holidays || []);
      console.log("Processed holidays data:", all);

      const holidaysData = all.map((holiday: any) => ({
        id: holiday.id?.toString() || holiday._id?.toString() || Math.random().toString(),
        serviceProviderID: holiday.serviceProviderID || holiday.serviceProvider?.id,
        companyID: holiday.companyID || holiday.company?.id,
        branchesID: holiday.branchesID || holiday.branches?.id,
        serviceProvider: holiday.serviceProvider?.companyName || holiday.serviceProviderName || "",
        companyName: holiday.company?.companyName || holiday.companyName || "",
        branchName: holiday.branches?.branchName || holiday.branchName || "",
        holidayName: holiday.holidayName || holiday.name || "",
        monthPeriod: holiday.monthPeriod || "",
        createdAt: holiday.createdAt
          ? new Date(holiday.createdAt).toISOString().split("T")[0]
          : new Date().toISOString().split("T")[0],
      }));

      console.log("Mapped holidays data:", holidaysData);

      // 🟢 SUPERADMIN → filter by sidebar context
      if (user?.role === "SUPERADMIN") {
        const ctx = getSidebarContext();
        if (ctx?.companyID) {
          setHolidays(holidaysData.filter((r: any) => r.companyID === ctx.companyID));
        } else {
          setHolidays(holidaysData);
        }
        return;
      }

      // 🟡 MANAGER → filter by assigned company and branch
      if (user?.role === "SERVICE_PROVIDER") {
        const ctx = getSidebarContext();
        if (ctx?.companyID) {
          setHolidays(holidaysData.filter((r: any) => r.companyID === ctx.companyID));
          return;
        }
        if (managerData?.serviceProviderID) {
          setHolidays(holidaysData.filter((r: any) => r.serviceProviderID === managerData.serviceProviderID));
          return;
        }
        setHolidays([]);
        return;
      }

      // 🔵 EMPLOYEE → filter by assigned company and branch
      if (user?.role === "EMPLOYEE" && empCreds) {
        console.log("Filtering for EMPLOYEE:", empCreds);
        const filtered = holidaysData.filter(
          (r: any) =>
            r.companyID === empCreds.companyID &&
            r.branchesID === empCreds.branchesID
        );
        console.log("Employee filtered holidays:", filtered);
        setHolidays(filtered);
        return;
      }

      // 🟠 COMPANY_ADMIN / BRANCH_ADMIN → filter by company
      {
        const ctx = getSidebarContext();
        const companyID = ctx?.companyID ?? user?.companyID;
        if (companyID) {
          setHolidays(holidaysData.filter((r: any) => r.companyID === companyID));
          return;
        }
      }

      // If no specific filtering applied, show empty
      setHolidays([]);
      
    } catch (error) {
      console.error("Error loading holidays:", error);
      setHolidays([]);
    } finally {
      setIsLoading(false);
    }
  };

  const filteredHolidays = holidays.filter(holiday =>
    (holiday.serviceProvider || "").toLowerCase().includes(searchTerm.toLowerCase()) ||
    (holiday.companyName || "").toLowerCase().includes(searchTerm.toLowerCase()) ||
    (holiday.branchName || "").toLowerCase().includes(searchTerm.toLowerCase()) ||
    holiday.holidayName.toLowerCase().includes(searchTerm.toLowerCase())
  )

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()

    // Validation
    const validationErrors: string[] = []
    if (!formData.holidayName?.trim()) validationErrors.push("Holiday Name is required")
    if (validationErrors.length > 0) {
      validationErrors.forEach(msg => toast.error(msg))
      return
    }

    try {
      // Determine IDs based on role
      let serviceProviderID, companyID, branchesID;
      
      if (user?.role === "SUPERADMIN") {
        serviceProviderID = formData.serviceProviderID;
        companyID = formData.companyID;
        branchesID = formData.branchesID;
      } else if (user?.role === "SERVICE_PROVIDER") {
        serviceProviderID = managerData?.serviceProviderID;
        companyID = managerData?.companyID;
        branchesID = formData.branchesID; // MANAGER can select branch
      } else if (user?.role === "EMPLOYEE") {
        serviceProviderID = empCreds?.serviceProviderID;
        companyID = empCreds?.companyID;
        branchesID = empCreds?.branchesID; // EMPLOYEE can't select branch
      }

      const holidayData = {
        holidayName: formData.holidayName,
        monthPeriod: formData.monthPeriod,
        serviceProviderID,
        companyID,
        branchesID,
      };

      console.log("Submitting holiday data:", holidayData);

      const url = editingHoliday
        ? `${BACKEND_URL}/manage-holiday/${editingHoliday.id}`
        : `${BACKEND_URL}/manage-holiday`
      const method = editingHoliday ? "PATCH" : "POST"
      
      const res = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(holidayData),
      })
      
      if (!res.ok) {
        const errorText = await res.text();
        throw new Error(`Failed to save holiday: ${res.status} - ${errorText}`);
      }
      
      await loadHolidays()
      resetForm()
      setIsDialogOpen(false)
      toast.success("Holiday saved successfully")
    } catch (error) {
      console.error("Error saving holiday:", error)
      toast.error(`Error saving holiday: ${error}`);
    }
  }

  const resetForm = () => {
    // Reset based on role
    const baseForm = {
      serviceProvider: "",
      companyName: "",
      branchName: "",
      holidayName: "",
      serviceProviderID: undefined,
      companyID: undefined,
      branchesID: undefined,
      monthPeriod: "",
    };

    if (user?.role === "SERVICE_PROVIDER" && managerData) {
      setFormData({
        ...baseForm,
        serviceProviderID: managerData.serviceProviderID,
        companyID: managerData.companyID,
        serviceProvider: managerData.serviceProviderName || "",
        companyName: managerData.companyName || "",
      });
    } else if (user?.role === "EMPLOYEE" && empCreds) {
      setFormData({
        ...baseForm,
        serviceProviderID: empCreds.serviceProviderID,
        companyID: empCreds.companyID,
        branchesID: empCreds.branchesID,
        serviceProvider: empCreds.serviceProviderName || "",
        companyName: empCreds.companyName || "",
        branchName: empCreds.branchName || "",
      });
    } else {
      const ctx = getSidebarContext();
      setFormData({
        ...baseForm,
        serviceProviderID: ctx?.serviceProviderID ?? undefined,
        companyID: ctx?.companyID ?? undefined,
        serviceProvider: ctx?.serviceProviderName ?? "",
        companyName: ctx?.companyName ?? "",
      });
    }
    
    setEditingHoliday(null)
    setSelectedCompanyFYStart(null)
    setSelectedCompanyStartDay("1")
    setSalaryPeriodOptions([])
  }

  const handleEdit = (holiday: Holiday) => {
    setFormData({
      serviceProvider: holiday.serviceProvider || "",
      companyName: holiday.companyName || "",
      branchName: holiday.branchName || "",
      holidayName: holiday.holidayName,
      serviceProviderID: holiday.serviceProviderID,
      companyID: holiday.companyID,
      branchesID: holiday.branchesID,
      monthPeriod: holiday.monthPeriod || "",
    })
    setEditingHoliday(holiday)
    // Load salary periods based on branch for editing
    if (holiday.branchesID) {
      handleBranchSelect({ 
        display: holiday.branchName || "", 
        value: holiday.branchesID, 
        item: { companyID: holiday.companyID } 
      });
    }
    setIsDialogOpen(true)
  }

  const handleDelete = async (id: string) => {
    if (!confirm("Are you sure you want to delete this holiday?")) return;
    
    try {
      const res = await fetch(`${BACKEND_URL}/manage-holiday/${id}`, { method: "DELETE" })
      if (!res.ok) throw new Error(`Failed to delete holiday: ${res.status}`)
      await loadHolidays()
      toast.success("Holiday deleted successfully")
    } catch (error) {
      console.error("Error deleting holiday:", error)
      toast.error(`Error deleting holiday: ${error}`);
    }
  }

  const handleServiceProviderSelect = (selected: SelectedItem) => {
    setFormData(prev => ({ 
      ...prev, 
      serviceProvider: selected.display, 
      serviceProviderID: selected.value,
      // Clear dependent fields when service provider changes
      companyName: "",
      companyID: undefined,
      branchName: "",
      branchesID: undefined,
    }))
  }

  const handleCompanySelect = async (selected: SelectedItem) => {
    setFormData(prev => ({ 
      ...prev, 
      companyName: selected.display, 
      companyID: selected.value,
      // Clear branch when company changes
      branchName: "",
      branchesID: undefined,
    }))
    await loadSalaryPeriods(selected.value);
  }

  // New function to load salary periods based on branch/company
  const loadSalaryPeriods = async (companyId: number) => {
    try {
      const co = await fetch(`${BACKEND_URL}/company/${companyId}`).then(r => r.json())
      const fy = co?.financialYearStart || "1st April"
      setSelectedCompanyFYStart(fy)
      
      const sc = await fetch(`${BACKEND_URL}/salary-cycle/company/${companyId}`).then(r => r.json())
      let day = "1"
      if (Array.isArray(sc) && sc.length > 0) {
        sc.sort((a:any,b:any)=>b.id-a.id)
        day = sc[0].monthStartDay || "1"
      } else if (sc?.monthStartDay) {
        day = sc.monthStartDay
      }
      setSelectedCompanyStartDay(day)
      setSalaryPeriodOptions(buildSalaryPeriodLabels(fy, day))
    } catch (e) {
      console.error("Failed to load company/cycle:", e)
      setSalaryPeriodOptions([])
    }
  }

  const handleBranchSelect = async (selected: SelectedItem) => {
    setFormData(prev => ({
      ...prev,
      branchName: selected.display,
      branchesID: selected.value,
    }));

    // Load salary periods based on the branch's company
    const branchCompanyId = selected.item?.companyID;
    if (branchCompanyId) {
      await loadSalaryPeriods(branchCompanyId);
    }
  };

  // Service Provider fetch for SUPERADMIN
  const fetchServiceProviders = async () => {
    try {
      const data = await fetch(`${BACKEND_URL}/service-provider`).then(r => r.json());
      return Array.isArray(data) ? data : [];
    } catch (error) {
      console.error("Error fetching service providers:", error);
      return [];
    }
  };

  // Company fetch for SUPERADMIN (filtered by service provider)
  const fetchCompanies = async () => {
    try {
      if (!formData.serviceProviderID) return [];
      
      const data = await fetch(`${BACKEND_URL}/company`).then(r => r.json());
      const companies = Array.isArray(data) ? data : [];
      
      // Filter companies by selected service provider
      return companies.filter((c: any) => 
        c.serviceProviderID === formData.serviceProviderID
      );
    } catch (error) {
      console.error("Error fetching companies:", error);
      return [];
    }
  };

  // Branch fetch (filtered by company)
  const fetchBranches = async (searchQuery: string = "") => {
    try {
      // For SUPERADMIN, use formData.companyID
      // For MANAGER, use managerData.companyID
      // For EMPLOYEE, use empCreds.companyID (and auto-select their branch)
      
      let companyIdToUse: number | undefined;
      
      if (user?.role === "SUPERADMIN") {
        companyIdToUse = formData.companyID;
      } else if (user?.role === "SERVICE_PROVIDER") {
        const ctx = getSidebarContext();
        companyIdToUse = managerData?.companyID ?? ctx?.companyID ?? user?.companyID;
      } else if (user?.role === "EMPLOYEE") {
        companyIdToUse = empCreds?.companyID;
      } else {
        // COMPANY_ADMIN / BRANCH_ADMIN
        companyIdToUse = formData.companyID;
      }

      if (!companyIdToUse) return [];

      const data = await fetch(`${BACKEND_URL}/branches`).then(r => r.json());
      const allBranches = Array.isArray(data) ? data : [];

      // Filter branches by company
      const filtered = allBranches.filter((b: any) => 
        b.companyID === companyIdToUse
      );

      // Apply search filter if query provided
      if (searchQuery) {
        return filtered.filter((b: any) =>
          (b.branchName || "")
            .toLowerCase()
            .includes(searchQuery.toLowerCase())
        );
      }

      return filtered;
    } catch (error) {
      console.error("Error fetching branches:", error);
      return [];
    }
  };

  return (
    <div className="space-y-6 w-full max-w-6xl mx-auto px-4">
      {/* FormDrawer for Add/Edit */}
      <FormDrawer
        open={isDialogOpen}
        onOpenChange={setIsDialogOpen}
        title={editingHoliday ? "Edit Holiday" : "Add New Holiday"}
        description={editingHoliday ? "Update the holiday information below." : "Fill in the details to add a new holiday."}
      >
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
                        onChange={v => setFormData(p => ({ ...p, serviceProvider: v }))}
                        onSelect={handleServiceProviderSelect}
                        fetchData={fetchServiceProviders}
                        displayField="companyName"
                        valueField="id"
                        required
                      />
                    )}

                    {/* Company - auto-filled from sidebar */}
                    {false && (
                      <SearchSuggestInput
                        label="Company Name"
                        placeholder="Select Company"
                        value={formData.companyName}
                        onChange={v => setFormData(p => ({ ...p, companyName: v }))}
                        onSelect={handleCompanySelect}
                        fetchData={fetchCompanies}
                        displayField="companyName"
                        valueField="id"
                        required
                      />
                    )}

                     

                    {/* Branch - For SUPERADMIN and MANAGER */}
                    {(user?.role === "SUPERADMIN" || user?.role === "SERVICE_PROVIDER") && (
                      <div className={`${user?.role === "SUPERADMIN" ? "col-span-1" : "col-span-3"}`}>
                        <SearchSuggestInput
                          label="Branch Name"
                          placeholder="Start typing branch name..."
                          value={formData.branchName}
                          onChange={(value) => setFormData(prev => ({ ...prev, branchName: value }))}
                          onSelect={handleBranchSelect}
                          fetchData={fetchBranches}
                          displayField="branchName"
                          valueField="id"
                          required
                        />
                        {user?.role === "SERVICE_PROVIDER" && (
                          <p className="text-xs text-gray-500 mt-1">
                            You can only select from branches in your assigned company
                          </p>
                        )}
                      </div>
                    )}

                    {/* Display assigned branch for EMPLOYEE */}
                    {user?.role === "EMPLOYEE" && (
                      <div className="col-span-3 space-y-2">
                        <Label>Assigned Branch</Label>
                        <div className="p-2 border rounded bg-gray-50">
                          <div className="flex items-center gap-2">
                            <Icon icon="mdi:map-marker" className="w-4 h-4 text-gray-500" />
                            <span className="font-medium">{formData.branchName || "Loading..."}</span>
                          </div>
                        </div>
                      </div>
                    )}
                  </div>
                </div>

                {/* Holiday Info */}
                <div className="space-y-4">
                  <h3 className="text-lg font-semibold">Holiday Information</h3>
                  <div className="space-y-2">
                    <Label htmlFor="holidayName">Holiday Name *</Label>
                    <Input 
                      id="holidayName" 
                      type="text" 
                      value={formData.holidayName} 
                      onChange={(e)=>setFormData(prev=>({...prev, holidayName:e.target.value}))} 
                      placeholder="Enter holiday name" 
                      required 
                    />
                  </div>
                </div>

                <div className="flex justify-end gap-2 pt-4">
                  <Button type="button" variant="outline" onClick={()=>setIsDialogOpen(false)}>Cancel</Button>
                  <Button type="submit">
                    {editingHoliday ? "Update Holiday" : "Add Holiday"}
                  </Button>
                </div>
              </form>
      </FormDrawer>

      {!isDialogOpen && (
      <>
      {/* Header */}
      <div className="flex items-center justify-between w-full">
        <div className="min-w-0 flex-1">
          <p className="text-gray-600 mt-1 text-sm">Manage company holidays and special days</p>
        </div>
        {canManage && (
          <Button
            onClick={() => { resetForm(); setIsDialogOpen(true); }}
            className="flex-shrink-0 text-sm px-3 py-2"
          >
            <Plus className="w-4 h-4 mr-1" />
            Add Holiday
          </Button>
        )}
      </div>

      {/* Search & Filters */}
      <Card>
        <CardContent className="p-6">
          <div className="flex items-center space-x-4 w-full">
            <div className="relative flex-1 min-w-0">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
              <Input placeholder="Search holidays..." value={searchTerm} onChange={(e)=>setSearchTerm(e.target.value)} className="pl-10 w-full" />
            </div>
            <Badge variant="secondary" className="px-3 py-1 flex-shrink-0">
              {isLoading ? "Loading..." : `${filteredHolidays.length} holidays`}
            </Badge>
          </div>
        </CardContent>
      </Card>

      {/* Holidays Table */}
      <Card className="w-full">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Icon icon="mdi:calendar-star" className="w-5 h-5" /> 
            Holidays List
            {isLoading && <span className="text-sm text-gray-500">Loading...</span>}
          </CardTitle>
        </CardHeader>
        <CardContent className="p-0 w-full">
          <div className="overflow-x-auto w-full">
            <Table className="w-full">
              <TableHeader>
                <TableRow>
                  <TableHead>Service Provider</TableHead>
                  <TableHead>Company Name</TableHead>
                  <TableHead>Branch Name</TableHead>
                  <TableHead>Holiday Name</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {isLoading ? (
                  <TableRow>
                    <TableCell colSpan={5} className="text-center py-8 text-gray-500">
                      <div className="flex flex-col items-center gap-2">
                        <Icon icon="mdi:loading" className="w-8 h-8 animate-spin text-gray-400" />
                        <p>Loading holidays...</p>
                      </div>
                    </TableCell>
                  </TableRow>
                ) : filteredHolidays.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={5} className="text-center py-8 text-gray-500">
                      <div className="flex flex-col items-center gap-2">
                        <Icon icon="mdi:calendar-star" className="w-12 h-12 text-gray-300" />
                        <p>No holidays found</p>
                        <p className="text-sm">Try adjusting your search criteria</p>
                        <Button onClick={loadHolidays} variant="outline" size="sm" className="mt-2">
                          Retry
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ) : (
                  filteredHolidays.map((holiday) => (
                    <TableRow key={holiday.id}>
                      <TableCell>{holiday.serviceProvider || "-"}</TableCell>
                      <TableCell>{holiday.companyName || "-"}</TableCell>
                      <TableCell>{holiday.branchName || "-"}</TableCell>
                      <TableCell>{holiday.holidayName}</TableCell>
                      <TableCell className="text-right">
                       <div className="flex items-center justify-end gap-1">
                         {/* ✏️ SUPERADMIN & MANAGER can edit */}
                         {canManage && (
                           <Button
                             variant="ghost"
                             size="sm"
                             onClick={() => handleEdit(holiday)}
                             className="h-7 w-7 p-0"
                             title="Edit"
                           >
                             <Edit className="w-3 h-3" />
                           </Button>
                         )}

                         {/* 🗑️ SUPERADMIN & MANAGER can delete */}
                         {canManage && (
                           <Button
                             variant="ghost"
                             size="sm"
                             onClick={() => handleDelete(holiday.id)}
                             className="h-7 w-7 p-0 text-red-600 hover:text-red-700 hover:bg-red-50"
                             title="Delete"
                           >
                             <Trash2 className="w-3 h-3" />
                           </Button>
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
      </>
      )}
    </div>
  )
}