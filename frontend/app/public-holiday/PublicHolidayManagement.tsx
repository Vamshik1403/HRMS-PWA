"use client"

import { useState, useEffect } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "../components/ui/card"
import { useCurrentUser } from "../hooks/useCurrentUser"
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
import { toast } from "sonner";
import { getSidebarContext } from "../utils/sidebarContext";

interface PublicHoliday {
  id: string
  serviceProviderID?: number
  companyID?: number
  branchesID?: number
  manageHolidayID?: number
  serviceProvider?: string
  companyName?: string
  branchName?: string
  holidayName: string
  financialYear: string
  startDate: string
  endDate: string
  createdAt: string
}

interface SelectedItem {
  display: string
  value: number
  item: any
}

const BACKEND_URL = process.env.NEXT_PUBLIC_BACKEND_URL || "/backend"

const monthsFull = [
  "January","February","March","April","May","June",
  "July","August","September","October","November","December"
]

function clampDay(d:number) {
  if (!Number.isFinite(d)) return 1
  return Math.max(1, Math.min(28, Math.floor(d)))
}

function buildFinancialYearOptions(fyStart:string|null|undefined, monthStartDay:string|number|null|undefined) {
  const now = new Date()
  const y = now.getFullYear()
  const day = clampDay(Number(monthStartDay ?? 1))
  const isJan = (fyStart ?? "").toLowerCase().includes("jan")

  const out:string[] = []
  if (day === 1) {
    if (isJan) {
      out.push(`${y}`) // simple year
    } else {
      out.push(`${y}-${y+1}`) // April to March
    }
  } else {
    // Rolling cycles – 12 windows
    for (let i=0;i<12;i++) {
      const start = new Date(y, isJan?11:2, day) // Dec(prev)/Mar(curr)
      start.setMonth(start.getMonth()+i)
      const end = new Date(start)
      end.setMonth(end.getMonth()+1)
      end.setDate(day-1)
      out.push(`${start.getDate()} ${monthsFull[start.getMonth()]} ${start.getFullYear()} to ${end.getDate()} ${monthsFull[end.getMonth()]} ${end.getFullYear()}`)
    }
  }
  return out
}

export function PublicHolidayManagement() {
  const [publicHolidays, setPublicHolidays] = useState<PublicHoliday[]>([])
  const [searchTerm, setSearchTerm] = useState("")
  const [isDialogOpen, setIsDialogOpen] = useState(false)
  const [editingHoliday, setEditingHoliday] = useState<PublicHoliday | null>(null)
  const [holidayOptions, setHolidayOptions] = useState<any[]>([])
  const [financialYearOptions, setFinancialYearOptions] = useState<string[]>([])
  const user = useCurrentUser()
  const canManage = user?.role === "SUPERADMIN" || user?.role === "SERVICE_PROVIDER" || user?.role === "COMPANY_ADMIN"

  const [managerData, setManagerData] = useState<any>(null);
  const [empCreds, setEmpCreds] = useState<any>(null);
  const [isLoading, setIsLoading] = useState(false);

  const [formData, setFormData] = useState({
    serviceProvider: "",
    companyName: "",
    branchName: "",
    holidayName: "",
    financialYear: "",
    startDate: "",
    endDate: "",
    serviceProviderID: undefined as number|undefined,
    companyID: undefined as number|undefined,
    branchesID: undefined as number|undefined,
    manageHolidayID: undefined as number|undefined,
  })

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
    if (user) {
      loadPublicHolidays()
    }
  }, [user, managerData, empCreds])

  useEffect(() => {
    const handler = () => { if (user) loadPublicHolidays(); };
    window.addEventListener("sidebar-context-changed", handler);
    return () => window.removeEventListener("sidebar-context-changed", handler);
  }, [user, managerData, empCreds]);

  // Load holiday options when branch is selected
  useEffect(() => {
    if (formData.branchesID && formData.companyID) {
      loadHolidayOptions(formData.companyID, formData.branchesID);
    }
  }, [formData.branchesID, formData.companyID]);

  async function robustGet<T=any>(url:string):Promise<T>{
    const res = await fetch(url,{cache:"no-store"})
    if(!res.ok) throw new Error(`${res.status}`)
    return res.json()
  }

  // Service Provider fetch for SUPERADMIN
  const fetchServiceProviders = async (q:string) => {
    const data = await robustGet<any[]>(`${BACKEND_URL}/service-provider`)
    return data.filter(d=>(d.companyName||"").toLowerCase().includes(q.toLowerCase()))
  }

  // Company fetch for SUPERADMIN (filtered by service provider)
  const fetchCompanies = async (q:string) => {
    try {
      if (!formData.serviceProviderID) return [];
      
      const data = await robustGet<any[]>(`${BACKEND_URL}/company`)
      const companies = Array.isArray(data) ? data : [];
      
      // Filter companies by selected service provider
      const filtered = companies.filter((c: any) => 
        c.serviceProviderID === formData.serviceProviderID
      );
      
      // Apply search filter
      return q 
        ? filtered.filter(d => (d.companyName||"").toLowerCase().includes(q.toLowerCase()))
        : filtered;
    } catch (error) {
      console.error("Error fetching companies:", error);
      return [];
    }
  }

  // Branch fetch (filtered by company)
  const fetchBranches = async (q: string = "") => {
    try {
      // Determine company ID based on role
      let companyIdToUse: number | undefined;
      
      if (user?.role === "SUPERADMIN") {
        companyIdToUse = formData.companyID;
      } else if (user?.role === "SERVICE_PROVIDER") {
        companyIdToUse = managerData?.companyID;
      } else if (user?.role === "EMPLOYEE") {
        companyIdToUse = empCreds?.companyID;
      } else {
        // COMPANY_ADMIN / BRANCH_ADMIN
        companyIdToUse = formData.companyID;
      }

      if (!companyIdToUse) return [];

      const data = await robustGet<any[]>(`${BACKEND_URL}/branches`);
      const allBranches = Array.isArray(data) ? data : [];

      // Filter branches by company
      const filteredByCompany = allBranches.filter((b: any) => 
        b.companyID === companyIdToUse
      );

      // Apply search filter if query provided
      if (q) {
        return filteredByCompany.filter((b: any) =>
          (b.branchName || "")
            .toLowerCase()
            .includes(q.toLowerCase())
        );
      }

      return filteredByCompany;
    } catch (error) {
      console.error("Error fetching branches:", error);
      return [];
    }
  }

  // Fetch manage holidays for the selected branch
  const fetchManageHolidays = async (companyID?: number, branchesID?: number) => {
    try {
      const allHolidays = await robustGet<any[]>(`${BACKEND_URL}/manage-holiday`);
      
      // If no filters provided, return all for SUPERADMIN or empty for others
      if (!companyID || !branchesID) {
        if (user?.role === "SUPERADMIN") {
          return allHolidays;
        }
        return [];
      }

      // Filter holidays based on companyID and branchesID
      return allHolidays.filter(holiday => 
        holiday.companyID === companyID && holiday.branchesID === branchesID
      );
    } catch (error) {
      console.error("Error fetching manage holidays:", error);
      return [];
    }
  }

  const loadHolidayOptions = async (companyID: number, branchesID: number) => {
    const holidays = await fetchManageHolidays(companyID, branchesID);
    setHolidayOptions(holidays);
  }

  const loadPublicHolidays = async () => {
    setIsLoading(true);
    try {
      const holidays = await robustGet<any[]>(`${BACKEND_URL}/public-holiday`)

      // Transform all holidays first
      const mapped = holidays.map((h) => ({
        id: String(h.id),
        serviceProviderID: h.serviceProviderID,
        companyID: h.companyID,
        branchesID: h.branchesID,
        manageHolidayID: h.manageHolidayID,
        serviceProvider: h.serviceProvider?.companyName || "",
        companyName: h.company?.companyName || "",
        branchName: h.branches?.branchName || "",
        holidayName: h.manageHoliday?.holidayName || "",
        financialYear: h.financialYear,
        startDate: h.startDate
          ? new Date(h.startDate).toISOString().split("T")[0]
          : "",
        endDate: h.endDate
          ? new Date(h.endDate).toISOString().split("T")[0]
          : "",
        createdAt: h.createdAt
          ? new Date(h.createdAt).toISOString().split("T")[0]
          : new Date().toISOString().split("T")[0],
      }))

      // ---- Role-based filtering ----
      if (user?.role === "SUPERADMIN") {
        const ctx = getSidebarContext();
        if (ctx?.companyID) {
          setPublicHolidays(mapped.filter((r: any) => r.companyID === ctx.companyID));
        } else {
          setPublicHolidays(mapped);
        }
        return
      }

      if (user?.role === "SERVICE_PROVIDER") {
        const ctx = getSidebarContext();
        if (ctx?.companyID) {
          setPublicHolidays(mapped.filter((h: any) => h.companyID === ctx.companyID));
          return;
        }
        if (managerData?.serviceProviderID) {
          setPublicHolidays(mapped.filter((h: any) => h.serviceProviderID === managerData.serviceProviderID));
          return;
        }
        setPublicHolidays([]);
        return;
      }

      if (user?.role === "EMPLOYEE") {
        const filtered = mapped.filter(
          (h) =>
            h.companyID === empCreds?.companyID && 
            h.branchesID === empCreds?.branchesID
        )
        setPublicHolidays(filtered)
        return
      }

      // If no specific filtering applied, show empty
      setPublicHolidays([]);
      
    } catch (error) {
      console.error("Error loading public holidays:", error);
      setPublicHolidays([]);
    } finally {
      setIsLoading(false);
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
      holidayName: "",
      manageHolidayID: undefined,
      financialYear: "",
    }))
    setFinancialYearOptions([])
    setHolidayOptions([])
  }

  const handleCompanySelect = async(selected: SelectedItem)=>{
    setFormData(prev => ({ 
      ...prev, 
      companyName: selected.display, 
      companyID: selected.value,
      // Clear branch when company changes
      branchName: "",
      branchesID: undefined,
      holidayName: "",
      manageHolidayID: undefined,
      financialYear: "",
    }))
    
    setHolidayOptions([])
    
    // Load financial year options
    try{
      const company = await robustGet<any>(`${BACKEND_URL}/company/${selected.value}`)
      const fyStart = company?.financialYearStart||"1st April"
      const cycles = await robustGet<any[]>(`${BACKEND_URL}/salary-cycle/company/${selected.value}`)
      let day = "1"
      if(Array.isArray(cycles)&&cycles.length>0) day = cycles[0].monthStartDay||"1"
      setFinancialYearOptions(buildFinancialYearOptions(fyStart,day))
    }catch(e){ 
      console.error(e); 
      setFinancialYearOptions([])
    }
  }

  const handleBranchSelect = async (selected: SelectedItem) => {
    // Get all branches to find the selected one
    const allBranches = await fetchBranches("");
    const selectedBranch = allBranches.find(b => b.id === selected.value);
    
    if (selectedBranch) {
      setFormData(prev => ({
        ...prev,
        branchName: selected.display,
        branchesID: selected.value,
        // For SUPERADMIN, ensure companyID matches the branch's company
        ...(user?.role === "SUPERADMIN" && {
          companyID: selectedBranch.companyID,
          companyName: selectedBranch.company?.companyName || ""
        }),
        // Clear holiday selection
        holidayName: "",
        manageHolidayID: undefined,
        financialYear: "",
      }));

      // Load financial year and holiday options
      if (selectedBranch.companyID) {
        await loadFinancialYearOptions(selectedBranch.companyID);
        await loadHolidayOptions(selectedBranch.companyID, selected.value);
      }
    }
  }

  // Function to load financial year options
  const loadFinancialYearOptions = async (companyId: number) => {
    try {
      const company = await robustGet<any>(`${BACKEND_URL}/company/${companyId}`)
      const fyStart = company?.financialYearStart || "1st April"
      const cycles = await robustGet<any[]>(`${BACKEND_URL}/salary-cycle/company/${companyId}`)
      let day = "1"
      if (Array.isArray(cycles) && cycles.length > 0) day = cycles[0].monthStartDay || "1"
      setFinancialYearOptions(buildFinancialYearOptions(fyStart, day))
    } catch (e) {
      console.error("Error loading financial year options:", e)
      setFinancialYearOptions([])
    }
  }

  const handleSubmit = async(e:React.FormEvent)=>{
    e.preventDefault()
    
    // Determine IDs based on role
    let serviceProviderID, companyID, branchesID;
    
    if (user?.role === "SUPERADMIN") {
      serviceProviderID = formData.serviceProviderID;
      companyID = formData.companyID;
      branchesID = formData.branchesID;
    } else if (user?.role === "SERVICE_PROVIDER") {
      serviceProviderID = managerData?.serviceProviderID;
      companyID = managerData?.companyID;
      branchesID = formData.branchesID;
    } else if (user?.role === "EMPLOYEE") {
      serviceProviderID = empCreds?.serviceProviderID;
      companyID = empCreds?.companyID;
      branchesID = empCreds?.branchesID;
    }

    // Ensure we have the required IDs
    if (!companyID || !branchesID || !formData.manageHolidayID) {
      toast.error("Please make sure all required fields are selected: Branch and Holiday Name");
      return;
    }

    const data = {
      serviceProviderID,
      companyID,
      branchesID,
      manageHolidayID: formData.manageHolidayID,
      financialYear: formData.financialYear,
      startDate: formData.startDate ? new Date(formData.startDate) : null,
      endDate: formData.endDate ? new Date(formData.endDate) : null,
    }
    
    console.log('Submitting data:', data)
    
    const url = editingHoliday?`${BACKEND_URL}/public-holiday/${editingHoliday.id}`:`${BACKEND_URL}/public-holiday`
    const method = editingHoliday?"PATCH":"POST"
    
    try {
      const response = await fetch(url,{
        method,
        headers:{"Content-Type":"application/json"},
        body:JSON.stringify(data)
      })
      
      if (!response.ok) {
        const errorText = await response.text()
        console.error('Server error:', errorText)
        throw new Error(`HTTP error! status: ${response.status}`)
      }
      
      await loadPublicHolidays()
      resetForm(); 
      setIsDialogOpen(false)
      toast.success("Public holiday saved successfully")
    } catch (error) {
      console.error('Error submitting form:', error)
      toast.error('Error saving holiday. Check console for details.')
    }
  }

  const resetForm = () => { 
    // Reset based on role
    const baseForm = {
      serviceProvider: "",
      companyName: "",
      branchName: "",
      holidayName: "",
      financialYear: "",
      startDate: "",
      endDate: "",
      serviceProviderID: undefined,
      companyID: undefined,
      branchesID: undefined,
      manageHolidayID: undefined,
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
    setFinancialYearOptions([])
    setHolidayOptions([])
  }

  const handleEdit = async (h: PublicHoliday) => {
    // Make sure all IDs are properly set
    setFormData({
      serviceProvider: h.serviceProvider || "",
      companyName: h.companyName || "",
      branchName: h.branchName || "",
      holidayName: h.holidayName,
      financialYear: h.financialYear,
      startDate: h.startDate,
      endDate: h.endDate,
      serviceProviderID: h.serviceProviderID || undefined,
      companyID: h.companyID || undefined,
      branchesID: h.branchesID || undefined,
      manageHolidayID: h.manageHolidayID || undefined
    })
    
    setEditingHoliday(h)
    
    // Load financial year options and holiday options for editing
    if (h.companyID && h.branchesID) {
      await loadFinancialYearOptions(h.companyID);
      await loadHolidayOptions(h.companyID, h.branchesID);
    }
    
    setIsDialogOpen(true)
  }

  const handleDelete = async (id: string) => { 
    if (confirm("Are you sure you want to delete this holiday?")) {
      await fetch(`${BACKEND_URL}/public-holiday/${id}`, { method: "DELETE" })
      await loadPublicHolidays()
      toast.success("Public holiday deleted successfully")
    }
  }

  const filtered = publicHolidays.filter(h=>
    (h.companyName||"").toLowerCase().includes(searchTerm.toLowerCase()) ||
    (h.holidayName||"").toLowerCase().includes(searchTerm.toLowerCase()) ||
    (h.financialYear||"").toLowerCase().includes(searchTerm.toLowerCase())
  )

  return (
    <div className="space-y-6 w-full max-w-6xl mx-auto px-4">
      {/* FormDrawer for Add/Edit */}
      <FormDrawer
        open={isDialogOpen}
        onOpenChange={setIsDialogOpen}
        title={`${editingHoliday?"Edit":"Add New"} Public Holiday`}
        description={editingHoliday ? "Update the public holiday details" : "Add a new public holiday to the system"}
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
                      onChange={v=>setFormData(p=>({...p,serviceProvider:v}))} 
                      onSelect={handleServiceProviderSelect} 
                      fetchData={fetchServiceProviders} 
                      displayField="companyName" 
                      valueField="id" 
                    />
                  )}

                  {/* Company - auto-filled from sidebar */}
                  {false && (
                    <SearchSuggestInput 
                      label="Company Name" 
                      placeholder="Select Company" 
                      value={formData.companyName} 
                      onChange={v=>setFormData(p=>({...p,companyName:v}))} 
                      onSelect={handleCompanySelect} 
                      fetchData={fetchCompanies} 
                      displayField="companyName" 
                      valueField="id" 
                    />
                  )}

                 

                  {/* Branch - For SUPERADMIN and MANAGER */}
                  {(user?.role === "SUPERADMIN" || user?.role === "SERVICE_PROVIDER") && (
                    <div className={`${user?.role === "SUPERADMIN" ? "col-span-1" : "col-span-3"}`}>
                      <SearchSuggestInput 
                        label="Branch Name" 
                        placeholder="Start typing branch name..." 
                        value={formData.branchName} 
                        onChange={v=>setFormData(p=>({...p,branchName:v}))} 
                        onSelect={handleBranchSelect} 
                        fetchData={fetchBranches} 
                        displayField="branchName" 
                        valueField="id" 
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

              {/* Holiday Configuration */}
              <div className="space-y-4">
                <h3 className="text-lg font-semibold">Holiday Configuration</h3>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <Label>Holiday Name *</Label>
                    <select 
                      value={formData.holidayName} 
                      onChange={e=>{
                        const sel = holidayOptions.find(h=>h.holidayName===e.target.value)
                        setFormData(p=>({...p,holidayName:e.target.value,manageHolidayID:sel?.id}))
                      }} 
                      required 
                      disabled={!formData.branchesID || holidayOptions.length === 0}
                      className="w-full border px-2 py-1 rounded-md"
                    >
                      <option value="">
                        {holidayOptions.length 
                          ? "Select Holiday" 
                          : (formData.branchesID ? `No holidays found for this branch` : "Select Branch first")}
                      </option>
                      {holidayOptions.map(h=>
                        <option key={h.id} value={h.holidayName}>{h.holidayName}</option>
                      )}
                    </select>
                  </div>
                  
                </div>
              </div>

              {/* Dates */}
              <div className="space-y-4">
                <h3 className="text-lg font-semibold">Date Range</h3>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <Label>Start Date *</Label>
                    <Input 
                      type="date" 
                      value={formData.startDate} 
                      onChange={e=>setFormData(p=>({...p,startDate:e.target.value}))} 
                      required
                    />
                  </div>
                  <div>
                    <Label>End Date *</Label>
                    <Input 
                      type="date" 
                      value={formData.endDate} 
                      onChange={e=>setFormData(p=>({...p,endDate:e.target.value}))} 
                      required
                    />
                  </div>
                </div>
              </div>

              <div className="flex justify-end gap-2 pt-4">
                <Button 
                  type="button" 
                  variant="outline" 
                  onClick={() => { resetForm(); setIsDialogOpen(false); }}
                >
                  Cancel
                </Button>
                <Button type="submit">
                  {editingHoliday?"Update":"Add"} Public Holiday
                </Button>
              </div>
            </form>
      </FormDrawer>

      {!isDialogOpen && (
      <>
      {/* Header */}
      <div className="flex items-center justify-between w-full">
        <div className="min-w-0 flex-1">
          <p className="text-gray-600 mt-1 text-sm">Manage public holidays for companies and branches</p>
        </div>
        {canManage && (
          <Button onClick={() => { resetForm(); setIsDialogOpen(true); }}>
            <Plus className="w-4 h-4 mr-2" />
            Add Public Holiday
          </Button>
        )}
      </div>

      {/* Search and Table */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Icon icon="mdi:calendar-multiple" className="w-5 h-5" />
            Public Holidays
            {isLoading && <span className="text-sm text-gray-500">Loading...</span>}
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-center mb-6">
            <div className="relative flex-1 max-w-md">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
              <Input 
                placeholder="Search holidays..." 
                value={searchTerm} 
                onChange={e=>setSearchTerm(e.target.value)}
                className="pl-10"
              />
            </div>
            <Badge variant="secondary" className="ml-3 px-3 py-1 flex-shrink-0">
              {filtered.length} {filtered.length === 1 ? 'holiday' : 'holidays'}
            </Badge>
          </div>
          
          <div className="rounded-md border overflow-hidden">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Company</TableHead>
                  <TableHead>Branch</TableHead>
                  <TableHead>Holiday</TableHead>
                  <TableHead>Year</TableHead>
                  <TableHead>Start Date</TableHead>
                  <TableHead>End Date</TableHead>
                  {canManage && <TableHead className="text-right">Actions</TableHead>}
                </TableRow>
              </TableHeader>

              <TableBody>
                {isLoading ? (
                  <TableRow>
                    <TableCell colSpan={canManage ? 7 : 6} className="text-center py-8 text-gray-500">
                      <div className="flex flex-col items-center gap-2">
                        <Icon icon="mdi:loading" className="w-8 h-8 animate-spin text-gray-400" />
                        <p>Loading holidays...</p>
                      </div>
                    </TableCell>
                  </TableRow>
                ) : filtered.length > 0 ? (
                  filtered.map(h => (
                    <TableRow key={h.id}>
                      <TableCell className="font-medium">{h.companyName || "N/A"}</TableCell>
                      <TableCell>{h.branchName || "N/A"}</TableCell>
                      <TableCell>{h.holidayName}</TableCell>
                      <TableCell>{h.financialYear}</TableCell>
                      <TableCell>{h.startDate ? new Date(h.startDate).toLocaleDateString('en-GB') : "-"}</TableCell>
                      <TableCell>{h.endDate ? new Date(h.endDate).toLocaleDateString('en-GB') : "-"}</TableCell>

                      {canManage && (
                        <TableCell className="text-right">
                          <div className="flex items-center justify-end gap-1">
                            <Button 
                              size="sm" 
                              variant="ghost" 
                              onClick={() => handleEdit(h)}
                              className="h-7 w-7 p-0"
                              title="Edit"
                            >
                              <Edit className="w-3 h-3" />
                            </Button>
                            <Button
                              size="sm"
                              variant="ghost"
                              onClick={() => handleDelete(h.id)}
                              className="h-7 w-7 p-0 text-red-600 hover:text-red-700 hover:bg-red-50"
                              title="Delete"
                            >
                              <Trash2 className="w-3 h-3" />
                            </Button>
                          </div>
                        </TableCell>
                      )}
                    </TableRow>
                  ))
                ) : (
                  <TableRow>
                    <TableCell colSpan={canManage ? 7 : 6} className="text-center py-8 text-gray-500">
                      <div className="flex flex-col items-center gap-2">
                        <Icon icon="mdi:calendar-multiple" className="w-12 h-12 text-gray-300" />
                        <p>No holidays found</p>
                        <p className="text-sm">Try adjusting your search criteria</p>
                      </div>
                    </TableCell>
                  </TableRow>
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