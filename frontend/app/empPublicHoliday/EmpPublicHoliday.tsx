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
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "../components/ui/table"
import { Badge } from "../components/ui/badge"
import { Plus, Search, Edit, Trash2 } from "lucide-react"
import { SearchSuggestInput } from "../components/SearchSuggestInput"
import { getSidebarContext } from "../utils/sidebarContext"

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

export function EmpPublicHoliday() {
  const [publicHolidays, setPublicHolidays] = useState<PublicHoliday[]>([])
  const [searchTerm, setSearchTerm] = useState("")
  const [isDialogOpen, setIsDialogOpen] = useState(false)
  const [editingHoliday, setEditingHoliday] = useState<PublicHoliday | null>(null)
  const [holidayOptions, setHolidayOptions] = useState<any[]>([])
  const [financialYearOptions, setFinancialYearOptions] = useState<string[]>([])
  const user = useCurrentUser()
  const canManage = user?.role === "SUPERADMIN" || user?.role === "SERVICE_PROVIDER" || user?.role === "COMPANY_ADMIN" || user?.role === "BRANCH_ADMIN"

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

  async function robustGet<T=any>(url:string):Promise<T>{
    const res = await fetch(url,{cache:"no-store"})
    if(!res.ok) throw new Error(`${res.status}`)
    return res.json()
  }

  const fetchServiceProviders = async (q:string) => {
    const data = await robustGet<any[]>(`${BACKEND_URL}/service-provider`)
    return data.filter(d=>(d.companyName||"").toLowerCase().includes(q.toLowerCase()))
  }
  const fetchCompanies = async (q:string) => {
    const data = await robustGet<any[]>(`${BACKEND_URL}/company`)
    return data.filter(d=>(d.companyName||"").toLowerCase().includes(q.toLowerCase()))
  }
  const fetchBranches = async (q:string) => {
    const data = await robustGet<any[]>(`${BACKEND_URL}/branches`)
    return data.filter(d=>(d.branchName||"").toLowerCase().includes(q.toLowerCase()))
  }
  const fetchManageHolidays = async ()=> robustGet<any[]>(`${BACKEND_URL}/manage-holiday`)

  useEffect(() => {
    if (user) {
      loadPublicHolidays()
      loadHolidayOptions()
    }
  }, [user])

  const loadHolidayOptions = async()=> setHolidayOptions(await fetchManageHolidays())
  
  const loadPublicHolidays = async () => {
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
      setPublicHolidays(mapped)
      return
    }

    if (user?.role === "SERVICE_PROVIDER") {
      const ctx = getSidebarContext()
      if (ctx?.companyID) {
        setPublicHolidays(mapped.filter((h: any) => h.companyID === ctx.companyID))
        return
      }
      try {
        const usersData = await robustGet<any[]>(`${BACKEND_URL}/users`)
        const currentUser = usersData.find((u) => u.username === user.username)
        if (currentUser?.serviceProviderID) {
          setPublicHolidays(mapped.filter((h: any) => h.serviceProviderID === currentUser.serviceProviderID))
          return
        }
      } catch (e) {
        console.error("Error fetching /users data for MANAGER", e)
      }
    }

    // If not SUPERADMIN or MANAGER → check /manage-emp/credentials/all
    try {
      const creds = await robustGet<any[]>(`${BACKEND_URL}/manage-emp/credentials/all`)
      const emp = user ? creds.find((c) => c.username === user.username) : null
      if (emp) {
        const filtered = mapped.filter(
          (h) =>
            h.companyID === emp.companyID && h.branchesID === emp.branchesID
        )
        setPublicHolidays(filtered)
      } else {
        // fallback: show nothing if not found
        setPublicHolidays([])
      }
    } catch (err) {
      console.error("Error fetching /manage-emp/credentials/all", err)
      setPublicHolidays([])
    }
  }

  const handleCompanySelect = async(selected:SelectedItem)=>{
    setFormData(p=>({...p,companyName:selected.display,companyID:selected.value,financialYear:""}))
    try{
      const company = await robustGet<any>(`${BACKEND_URL}/company/${selected.value}`)
      const fyStart = company?.financialYearStart||"1st April"
      const cycles = await robustGet<any[]>(`${BACKEND_URL}/salary-cycle/company/${selected.value}`)
      let day = "1"
      if(Array.isArray(cycles)&&cycles.length>0) day = cycles[0].monthStartDay||"1"
      setFinancialYearOptions(buildFinancialYearOptions(fyStart,day))
    }catch(e){ console.error(e); setFinancialYearOptions([])}
  }

  const handleSubmit = async(e:React.FormEvent)=>{
  e.preventDefault()
  const data = {
    serviceProviderID: formData.serviceProviderID,
    companyID: formData.companyID,
    branchesID: formData.branchesID,
    manageHolidayID: formData.manageHolidayID,
    financialYear: formData.financialYear,
    startDate: formData.startDate?new Date(formData.startDate):null,
    endDate: formData.endDate?new Date(formData.endDate):null,
  }
  
  console.log('Sending data:', data) // Add this line
  
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
    resetForm(); setIsDialogOpen(false)
  } catch (error) {
    console.error('Error submitting form:', error)
    alert('Error saving holiday. Check console for details.')
  }
}

  const resetForm=()=>{ 
    setFormData({
      serviceProvider:"",companyName:"",branchName:"",holidayName:"",financialYear:"",
      startDate:"",endDate:"",serviceProviderID:undefined,companyID:undefined,branchesID:undefined,manageHolidayID:undefined
    }); 
    setEditingHoliday(null)
    setFinancialYearOptions([])
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
    
    // Load financial year options if company exists
    if (h.companyID) {
      try {
        const company = await robustGet<any>(`${BACKEND_URL}/company/${h.companyID}`)
        const fyStart = company?.financialYearStart || "1st April"
        const cycles = await robustGet<any[]>(`${BACKEND_URL}/salary-cycle/company/${h.companyID}`)
        let day = "1"
        if (Array.isArray(cycles) && cycles.length > 0) day = cycles[0].monthStartDay || "1"
        setFinancialYearOptions(buildFinancialYearOptions(fyStart, day))
      } catch (e) {
        console.error("Error loading company data for edit", e)
        setFinancialYearOptions([])
      }
    }
    
    setIsDialogOpen(true)
  }

  const handleDelete = async (id: string) => { 
    if (confirm("Are you sure you want to delete this holiday?")) {
      await fetch(`${BACKEND_URL}/public-holiday/${id}`, { method: "DELETE" })
      await loadPublicHolidays() 
    }
  }

  const filtered = publicHolidays.filter(h=>
    (h.companyName||"").toLowerCase().includes(searchTerm.toLowerCase()) ||
    (h.holidayName||"").toLowerCase().includes(searchTerm.toLowerCase()) ||
    (h.financialYear||"").toLowerCase().includes(searchTerm.toLowerCase())
  )

  return (
    <div className="space-y-6 w-full max-w-6xl mx-auto px-4">
      {/* Header */}
      <div className="flex items-center justify-between w-full">
        <h1 className="text-2xl font-bold">Public Holiday</h1>
        <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
          {canManage && (
            <DialogTrigger asChild>
              <Button onClick={resetForm} className="bg-gray-900">
                <Plus className="w-4 h-4 mr-2" />
                Add Public Holiday
              </Button>
            </DialogTrigger>
          )}
          <DialogContent>
            <DialogHeader>
              <DialogTitle>{editingHoliday?"Edit":"Add New"} Public Holiday</DialogTitle>
              <DialogDescription>
                {editingHoliday ? "Update the public holiday details" : "Add a new public holiday to the system"}
              </DialogDescription>
            </DialogHeader>
            <form onSubmit={handleSubmit} className="space-y-6">
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <SearchSuggestInput 
                  label="Service Provider" 
                  placeholder="Select Service Provider" 
                  value={formData.serviceProvider} 
                  onChange={v=>setFormData(p=>({...p,serviceProvider:v}))} 
                  onSelect={s=>setFormData(p=>({...p,serviceProvider:s.display,serviceProviderID:s.value}))} 
                  fetchData={fetchServiceProviders} 
                  displayField="companyName" 
                  valueField="id" 
                />
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
                <SearchSuggestInput 
                  label="Branch Name" 
                  placeholder="Select Branch" 
                  value={formData.branchName} 
                  onChange={v=>setFormData(p=>({...p,branchName:v}))} 
                  onSelect={s=>setFormData(p=>({...p,branchName:s.display,branchesID:s.value}))} 
                  fetchData={fetchBranches} 
                  displayField="branchName" 
                  valueField="id" 
                />
              </div>

              {/* Holiday Config */}
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
                    className="w-full border px-2 py-1 rounded-md"
                  >
                    <option value="">Select Holiday</option>
                    {holidayOptions.map(h=><option key={h.id} value={h.holidayName}>{h.holidayName}</option>)}
                  </select>
                </div>
                <div>
                  <Label>Financial Year *</Label>
                  <select 
                    value={formData.financialYear} 
                    onChange={e=>setFormData(p=>({...p,financialYear:e.target.value}))} 
                    required 
                    className="w-full border px-2 py-1 rounded-md"
                  >
                    <option value="">{financialYearOptions.length?"Select Year":"Select Company first"}</option>
                    {financialYearOptions.map(opt=><option key={opt} value={opt}>{opt}</option>)}
                  </select>
                </div>
              </div>

              {/* Dates */}
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

              <DialogFooter>
                <Button 
                  type="button" 
                  variant="outline" 
                  onClick={() => { resetForm(); setIsDialogOpen(false); }}
                >
                  Cancel
                </Button>
                <Button type="submit" className="bg-gray-900">
                  {editingHoliday?"Update":"Add"} Public Holiday
                </Button>
              </DialogFooter>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      {/* Search and Table */}
      <Card>
        <CardHeader>
          <CardTitle>Public Holidays</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-center mb-4">
            <div className="relative flex-1 max-w-md">
              <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
              <Input 
                placeholder="Search holidays..." 
                value={searchTerm} 
                onChange={e=>setSearchTerm(e.target.value)}
                className="pl-8"
              />
            </div>
            <Badge variant="secondary" className="ml-3">
              {filtered.length} {filtered.length === 1 ? 'holiday' : 'holidays'}
            </Badge>
          </div>
          <div className="rounded-md border">
            <Table>
           <TableHeader>
  <TableRow>
    <TableHead>Company</TableHead>
    <TableHead>Holiday</TableHead>
    <TableHead>Year</TableHead>
    <TableHead>Start</TableHead>
    <TableHead>End</TableHead>
    {canManage && <TableHead>Actions</TableHead>}
  </TableRow>
</TableHeader>

<TableBody>
  {filtered.length > 0 ? (
    filtered.map(h => (
      <TableRow key={h.id}>
        <TableCell className="font-medium">{h.companyName || "N/A"}</TableCell>
        <TableCell>{h.holidayName}</TableCell>
        <TableCell>{h.financialYear}</TableCell>
        <TableCell>{h.startDate ? new Date(h.startDate).toLocaleDateString('en-GB') : "-"}</TableCell>
        <TableCell>{h.endDate ? new Date(h.endDate).toLocaleDateString('en-GB') : "-"}</TableCell>

        {canManage && (
          <TableCell>
            <div className="flex space-x-2">
              <Button size="sm" variant="outline" onClick={() => handleEdit(h)}>
                <Edit className="w-4 h-4" />
              </Button>
              <Button
                size="sm"
                variant="outline"
                onClick={() => handleDelete(h.id)}
                className="text-red-600 hover:text-red-700"
              >
                <Trash2 className="w-4 h-4" />
              </Button>
            </div>
          </TableCell>
        )}
      </TableRow>
    ))
  ) : (
    <TableRow>
      <TableCell colSpan={canManage ? 6 : 5} className="text-center py-8 text-muted-foreground">
        No holidays found
      </TableCell>
    </TableRow>
  )}
</TableBody>

            </Table>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}