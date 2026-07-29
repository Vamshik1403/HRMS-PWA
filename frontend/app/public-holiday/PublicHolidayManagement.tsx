"use client"

import { useState, useEffect, useMemo } from "react"
import { useCurrentUser } from "../hooks/useCurrentUser"
import { Button } from "../components/ui/button"
import { Input } from "../components/ui/input"
import { Label } from "../components/ui/label"
import { FormDrawer } from "../components/ui/form-drawer"
import { Icon } from "@iconify/react"
import { Plus, Calendar } from "lucide-react"
import { PageHeader } from "../components/app/page-header";
import { hasModuleWriteAccess } from "@/lib/companyAccess";
import { FilterBar, FilterSelect } from "../components/app/filter-bar";
import { EntityListShell } from "../components/app/entity-list-shell";
import type { DataTableColumn } from "../components/app/data-table";
import { EntityRowActions } from "../components/app/entity-row-actions";
import { useClientTable, sortRows } from "../hooks/use-client-table";
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
  const table = useClientTable("holidayName")
  const [branchFilter, setBranchFilter] = useState("ALL")
  const [branchFilterList, setBranchFilterList] = useState<any[]>([])
  const [isDialogOpen, setIsDialogOpen] = useState(false)
  const [editingHoliday, setEditingHoliday] = useState<PublicHoliday | null>(null)
  const [holidayOptions, setHolidayOptions] = useState<any[]>([])
  const [financialYearOptions, setFinancialYearOptions] = useState<string[]>([])
  const user = useCurrentUser()
  const canManage = user?.role === "SUPERADMIN" || user?.role === "SERVICE_PROVIDER" || user?.role === "COMPANY_ADMIN" || user?.role === "BRANCH_ADMIN"

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
  loadBranchFilterList()
}
  }, [user, managerData, empCreds])

  useEffect(() => {
const handler = () => {
  if (user) {
    loadPublicHolidays()
    loadBranchFilterList()
  }
};

window.addEventListener("sidebar-context-changed", handler);
    window.addEventListener("app-data-refresh", handler);
    return () => {
      window.removeEventListener("sidebar-context-changed", handler);
      window.removeEventListener("app-data-refresh", handler);
    };
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
        const ctx = getSidebarContext();
        companyIdToUse = managerData?.companyID ?? ctx?.companyID ?? user?.companyID;
      } else if (user?.role === "EMPLOYEE") {
        companyIdToUse = empCreds?.companyID;
      } else {
        // COMPANY_ADMIN / BRANCH_ADMIN
        const ctx = getSidebarContext();
        companyIdToUse = formData.companyID ?? ctx?.companyID ?? user?.companyID;
      }

      if (!companyIdToUse) return [];

      const data = await robustGet<any[]>(`${BACKEND_URL}/branches`);
      const allBranches = Array.isArray(data) ? data : [];

      // Filter branches by company
      const filteredByCompany = allBranches.filter((b: any) => 
        b.companyID === companyIdToUse
      );
      // 🔒 BRANCH_ADMIN — restrict to their own branch only
      const branchScope =
        user?.role === "BRANCH_ADMIN" && user?.branchesID
          ? filteredByCompany.filter((b: any) => Number(b.id) === Number(user.branchesID))
          : filteredByCompany;

      // Apply search filter if query provided
      if (q) {
        return branchScope.filter((b: any) =>
          (b.branchName || "")
            .toLowerCase()
            .includes(q.toLowerCase())
        );
      }

      return branchScope;
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

  const loadBranchFilterList = async () => {
  try {
    const data = await robustGet<any[]>(`${BACKEND_URL}/branches`)
    const ctx = getSidebarContext()

    const activeCompanyID =
      ctx?.companyID ??
      user?.companyID ??
      managerData?.companyID ??
      empCreds?.companyID ??
      formData.companyID

    let branches = Array.isArray(data) ? data : []

    if (user?.role !== "SUPERADMIN" && activeCompanyID) {
      branches = branches.filter(
        (b: any) => Number(b.companyID) === Number(activeCompanyID)
      )
    }

    if (user?.role === "SUPERADMIN" && ctx?.companyID) {
      branches = branches.filter(
        (b: any) => Number(b.companyID) === Number(ctx.companyID)
      )
    }

    if (user?.role === "BRANCH_ADMIN") {
      const branchID = user?.branchesID ?? managerData?.branchesID ?? empCreds?.branchesID

      if (branchID) {
        branches = branches.filter((b: any) => Number(b.id) === Number(branchID))
        setBranchFilter(String(branchID))
      }
    }

    setBranchFilterList(branches)
  } catch (e) {
    console.error("Failed to load branch filter list:", e)
    setBranchFilterList([])
  }
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

      // COMPANY_ADMIN / BRANCH_ADMIN → filter by company (branch admin also by branch)
      {
        const ctx = getSidebarContext();
        const companyID = ctx?.companyID ?? user?.companyID;
        if (companyID) {
          if (user?.role === "BRANCH_ADMIN" && user?.branchesID) {
            setPublicHolidays(mapped.filter((h: any) => h.companyID === companyID && h.branchesID === user.branchesID));
          } else {
            setPublicHolidays(mapped.filter((h: any) => h.companyID === companyID));
          }
          return;
        }
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
    } else if (user?.role === "COMPANY_ADMIN" || user?.role === "BRANCH_ADMIN") {
      const ctx = getSidebarContext();
      serviceProviderID = ctx?.serviceProviderID ?? formData.serviceProviderID;
      companyID = formData.companyID ?? ctx?.companyID ?? user?.companyID;
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
    } else if (user?.role === "BRANCH_ADMIN") {
      const ctx = getSidebarContext();
      setFormData({
        ...baseForm,
        serviceProviderID: user?.serviceProviderID ?? ctx?.serviceProviderID ?? undefined,
        companyID: user?.companyID ?? ctx?.companyID ?? undefined,
        branchesID: user?.branchesID ?? undefined,
        serviceProvider: (user as any)?.serviceProvider?.companyName ?? ctx?.serviceProviderName ?? "",
        companyName: (user as any)?.company?.companyName ?? ctx?.companyName ?? "",
        branchName: (user as any)?.branches?.branchName ?? "",
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
        companyID: ctx?.companyID ?? user?.companyID ?? undefined,
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
    try {
      await fetch(`${BACKEND_URL}/public-holiday/${id}`, { method: "DELETE" })
      await loadPublicHolidays()
      toast.success("Public holiday deleted successfully")
    } catch (error) {
      console.error("Error deleting public holiday:", error)
      toast.error("Failed to delete. Please try again.")
    }
  }

  const filtered = useMemo(() => {
    const t = table.search.trim().toLowerCase()

    let list = publicHolidays.filter((h) => {
      const matchesBranch =
        branchFilter === "ALL" || branchFilter === String(h.branchesID)

      const matchesSearch =
        !t ||
        (h.serviceProvider || "").toLowerCase().includes(t) ||
        (h.companyName || "").toLowerCase().includes(t) ||
        (h.branchName || "").toLowerCase().includes(t) ||
        (h.holidayName || "").toLowerCase().includes(t) ||
        (h.financialYear || "").toLowerCase().includes(t)

      return matchesBranch && matchesSearch
    })

    return sortRows(list, table.sortBy, table.sortDir, (row, key) => {
      const h = row as PublicHoliday
      if (key === "branch") return h.branchName ?? ""
      if (key === "holidayName") return h.holidayName ?? ""
      if (key === "financialYear") return h.financialYear ?? ""
      if (key === "startDate") return h.startDate ?? ""
      if (key === "endDate") return h.endDate ?? ""
      return ""
    })
  }, [publicHolidays, table.search, table.sortBy, table.sortDir, branchFilter])

  const branchFilterOptions = useMemo(
    () => [
      { value: "ALL", label: "All branches" },
      ...branchFilterList.map((b: any) => ({
        value: String(b.id),
        label: b.branchName || `Branch #${b.id}`,
      })),
    ],
    [branchFilterList],
  )

  const publicHolidayColumns = useMemo((): DataTableColumn<PublicHoliday>[] => [
    {
      key: "branch",
      header: "Branch",
      sortable: true,
      colSpan: 2,
      cell: (h) => h.branchName || "—",
    },
    {
      key: "holidayName",
      header: "Holiday",
      sortable: true,
      colSpan: 2,
      cell: (h) => <span className="font-medium">{h.holidayName || "—"}</span>,
    },
    {
      key: "financialYear",
      header: "Year",
      sortable: true,
      colSpan: 1,
      cell: (h) => h.financialYear || "—",
    },
    {
      key: "startDate",
      header: "Start Date",
      sortable: true,
      colSpan: 2,
      cell: (h) => h.startDate ? new Date(h.startDate).toLocaleDateString("en-GB") : "—",
    },
    {
      key: "endDate",
      header: "End Date",
      sortable: true,
      colSpan: 2,
      cell: (h) => h.endDate ? new Date(h.endDate).toLocaleDateString("en-GB") : "—",
    },
    {
      key: "actions",
      header: "Actions",
      colSpan: 2,
      align: "right",
      cell: (h) => (
        <EntityRowActions
          onEdit={canManage ? () => handleEdit(h) : undefined}
          onDelete={canManage ? () => handleDelete(h.id) : undefined}
        />
      ),
    },
  ], [canManage])

  return (
    <div className="space-y-6 w-full max-w-none animate-fade-in page-content-enter">
      <PageHeader
        icon={Calendar}
        title="Public Holiday"
        description="Manage public holidays for companies and branches"
        actions={
          !isDialogOpen && canManage ? (
            <Button onClick={() => { resetForm(); setIsDialogOpen(true); }}>
              <Plus className="w-4 h-4 mr-2" />
              Add Public Holiday
            </Button>
          ) : null
        }
      />
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

                 

                  {/* Branch - For SUPERADMIN, MANAGER, and COMPANY_ADMIN */}
                  {(user?.role === "SUPERADMIN" || user?.role === "SERVICE_PROVIDER" || user?.role === "COMPANY_ADMIN") && (
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
          <FilterBar
            search={{
              value: table.search,
              onChange: table.setSearch,
              placeholder: "Search public holidays…",
            }}
            filters={
              <FilterSelect
                id="public-holiday-branch"
                value={branchFilter}
                onChange={setBranchFilter}
                options={branchFilterOptions}
                width="w-56"
                ariaLabel="Filter by branch"
              />
            }
          />

          <EntityListShell
            title="All public holidays"
            columns={publicHolidayColumns}
            rows={filtered}
            rowKey={(h) => h.id}
            isLoading={isLoading}
            sortBy={table.sortBy}
            sortDir={table.sortDir}
            onSort={table.setSort}
            emptyIcon={Calendar}
            emptyTitle="No public holidays found"
            emptyDescription="Try adjusting your search or branch filter."
            emptyAction={
              canManage ? (
                <Button onClick={() => { resetForm(); setIsDialogOpen(true); }}>
                  <Plus className="w-4 h-4 mr-2" /> Add Public Holiday
                </Button>
              ) : undefined
            }
          />
        </>
      )}
    </div>
  )
}