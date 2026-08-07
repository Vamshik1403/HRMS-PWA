"use client"

import { useState, useEffect, useRef, useCallback, useMemo } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "../components/ui/card"
import { Button } from "../components/ui/button"
import { Input } from "../components/ui/input"
import { Label } from "../components/ui/label"
import { Textarea } from "../components/ui/textarea"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "../components/ui/table"
import { Badge } from "../components/ui/badge"
import { PageHeader } from "../components/app/page-header"
import { Building2, Plus, Edit, Trash2, Eye, ArrowLeft, X, Save, UserPlus } from "lucide-react"
import { useCurrentUser } from "../hooks/useCurrentUser"
import { useRouter } from "next/navigation"
import { TimezoneSelect } from "../components/ui/timezone-select"
import { LocationFields } from "../components/ui/location-fields"
import { SearchSuggestInput } from "../components/SearchSuggestInput"
import { fetchCurrencies } from "../utils/geoApi"
import { PdfUploadField } from "../components/PdfUploadField"
import { ListAreaSkeleton } from "../components/ui/TableBodySkeleton"
import { toast } from "sonner"
import { getSidebarContext, clearSidebarContext, setSidebarContext } from "../utils/sidebarContext"
import { isDesktopManagerFlagSet } from "@/lib/desktopManager"
import {
  canDesktopManagerManage,
  filterCompaniesForUser,
} from "../utils/scopeContext"
import { FormDrawer } from "../components/ui/form-drawer"
import { FilterBar } from "../components/app/filter-bar"
import { EntityListShell } from "../components/app/entity-list-shell"
import type { DataTableColumn } from "../components/app/data-table"
import { EntityRowActions } from "../components/app/entity-row-actions"
import { DetailCard } from "../components/app/detail-card"
import { EntityDetailHero, EntityDetailLayout } from "../components/app/entity-detail-layout"
import { FormSectionNav } from "../components/app/form-section-nav"
import { useClientTable, sortRows } from "../hooks/use-client-table"
import {
  buildCompanyPayload,
  FINANCIAL_YEAR_EMPTY,
  mapCompanyToFormData,
} from "../utils/companyFormPayload"
import { LEGAL_ENTITY_OPTIONS, ownerTitleForLegalEntity, defaultUserTypeForEntity, userTypeOptionsForEntity } from "@/lib/companyAccess"
import { FormSection } from "../components/ui/form-section"
import { FormField } from "../components/ui/form-field"
import { FileDropzone } from "../components/ui/file-dropzone"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "../components/ui/select"

interface Company {
  id: number
  serviceProviderID?: number
  companyName?: string
  companyType?: string
  legalEntityType?: string
  defaultOwnerTitle?: string
  noticePeriodDaysForResignation?: string
  noticePeriodDaysForTermination?: string
  address?: string
  country?: string
  state?: string
  city?: string
  pincode?: string
  timeZone?: string
  currency?: string
  pfNo?: string
  tanNo?: string
  panNo?: string
  esiNo?: string
  linNo?: string
  gstNo?: string
  gstCertUrl?: string
  shopRegNo?: string
  shopRegCertHistory?: { certNo: string; effectFrom: string; _localId: string }[]
  financialYearStart?: string
  contactNo?: string
  emailAdd?: string
  companyLogoUrl?: string
  SignatureUrl?: string
  createdAt?: string
}

interface ServiceProvider {
  id: number
  companyName: string
}

interface ModuleItem {
  id: number
  moduleKey: string
  moduleName: string
  description?: string | null
  isActive: boolean
  sortOrder: number
}

interface CompanyModuleItem {
  id: number
  companyID: number
  moduleID: number
  moduleKey: string
  moduleName: string
  isEnabled: boolean
}

interface CompanyAdminUser {
  id: number
  username: string
  role: string
  firstName?: string
  lastName?: string
  ownerTitle?: string | null

  serviceProviderID?: number | null
  contactNo?: string | null
  email?: string | null
  isActive: boolean
  companyID?: number | null
  company?: { id?: number; companyName?: string } | null
}


const getSafeStorageItem = (storage: "session" | "local", key: string): string | null => {
  if (typeof window === "undefined") return null;

  try {
    return storage === "session"
      ? sessionStorage.getItem(key)
      : localStorage.getItem(key);
  } catch {
    return null;
  }
};

const emptyCompanyAdminForm = {
  username: "",
  password: "",
  role: "COMPANY_OWNER",
  firstName: "",
  lastName: "",
  contactNo: "",
  email: "",
  designation: "",
  serviceProviderID: "" as string | number,
  companyID: "" as string | number,
  isActive: true,
}

export function CompanyManagement() {
  const router = useRouter()
  const [companies, setCompanies] = useState<Company[]>([])
  const [listLoading, setListLoading] = useState(true)
  const [desktopManager, setDesktopManager] = useState(false)
  const table = useClientTable("companyName")
  const [editingCompany, setEditingCompany] = useState<Company | null>(null)
  const [viewCompany, setViewCompany] = useState<Company | null>(null)
  const [serviceProviders, setServiceProviders] = useState<ServiceProvider[]>([])
  const [spDropdownOpen, setSpDropdownOpen] = useState(false)
  const [logoFile, setLogoFile] = useState<File | null>(null)
  const [isAddingNew, setIsAddingNew] = useState(false)
  const [companyFormTab, setCompanyFormTab] = useState("basic")
  const [isViewing, setIsViewing] = useState(false)

  const [isModuleDrawerOpen, setIsModuleDrawerOpen] = useState(false)
  const [selectedCompanyForModules, setSelectedCompanyForModules] = useState<Company | null>(null)
  const [allModules, setAllModules] = useState<ModuleItem[]>([])
  const [selectedModuleIds, setSelectedModuleIds] = useState<number[]>([])
  const [moduleLoading, setModuleLoading] = useState(false)
  const [moduleSaving, setModuleSaving] = useState(false)
  const [saving, setSaving] = useState(false);
  const [companyAdminDrawerOpen, setCompanyAdminDrawerOpen] = useState(false)
  const [selectedCompanyForAdmin, setSelectedCompanyForAdmin] = useState<Company | null>(null)
  const [companyAdminUsers, setCompanyAdminUsers] = useState<CompanyAdminUser[]>([])
  const [companyAdminForm, setCompanyAdminForm] = useState({ ...emptyCompanyAdminForm })
  const [companyAdminSaving, setCompanyAdminSaving] = useState(false)
  const [companyAdminLoading, setCompanyAdminLoading] = useState(false)
  const [editingCompanyAdmin, setEditingCompanyAdmin] =
    useState<CompanyAdminUser | null>(null)

  const [companyAdminFormOpen, setCompanyAdminFormOpen] = useState(false)

  const user = useCurrentUser()


  useEffect(() => {
    setDesktopManager(isDesktopManagerFlagSet())
  }, [user?.id])

  const isDesktopManager = desktopManager && user?.role === "EMPLOYEE"
  const canManage = user?.role === "SUPERADMIN" || user?.role === "SERVICE_PROVIDER" || user?.role === "COMPANY_ADMIN" || user?.role === "ADMIN" || canDesktopManagerManage(user)
 const isServiceProvider = user?.role === "SERVICE_PROVIDER"
const isSuperAdmin = user?.role === "SUPERADMIN"
const isCompanyProfileOnly = user?.role === "COMPANY_ADMIN" || user?.role === "ADMIN" || isDesktopManager
const shouldAutoOpenCompanyProfile = isCompanyProfileOnly

  interface CompanyFormData extends Partial<Company> {
    autocompleteName?: string
  }

  const [formData, setFormData] = useState<CompanyFormData>({
    companyName: "",
    companyType: "",
    legalEntityType: "",
    noticePeriodDaysForResignation: "",
    noticePeriodDaysForTermination: "",
    address: "",
    country: "",
    state: "",
    city: "",
    pincode: "",
    timeZone: "",
    currency: "",
    pfNo: "",
    tanNo: "",
    panNo: "",
    esiNo: "",
    linNo: "",
    gstNo: "",
    gstCertUrl: "",
    shopRegNo: "",
    shopRegCertHistory: [] as { certNo: string; effectFrom: string; _localId: string }[],
    financialYearStart: "",
    contactNo: "",
    emailAdd: "",
    autocompleteName: "",
  })

  const wrapperRef = useRef<HTMLDivElement>(null)

  // Fetch companies based on role
  useEffect(() => {
    if (user) {
      fetchCompanies()
    }
  }, [user])

  const closeCompanyPagePanels = useCallback(() => {
    resetForm()
    setIsAddingNew(false)
    setIsViewing(false)
    setViewCompany(null)

    closeModuleDrawer()

    setCompanyAdminDrawerOpen(false)
    setSelectedCompanyForAdmin(null)
    setCompanyAdminUsers([])
    setCompanyAdminForm({ ...emptyCompanyAdminForm })
    setCompanyAdminSaving(false)
    setCompanyAdminLoading(false)
    setEditingCompanyAdmin(null)
  }, [])

  const handleBack = () => {
    closeCompanyPagePanels()
    router.push('/company')
  }

  useEffect(() => {
    const handler = () => {
      if (user) fetchCompanies()
    }

    const sidebarPageClickHandler = (e: any) => {
      if (e.detail?.path !== "/company") return

      closeCompanyPagePanels()

      setTimeout(() => {
        if (user) fetchCompanies()
      }, 0)
    }

    window.addEventListener("sidebar-context-changed", handler)
    window.addEventListener("app-data-refresh", handler)
    window.addEventListener("sidebar-main-page-click", sidebarPageClickHandler)

    return () => {
      window.removeEventListener("sidebar-context-changed", handler)
      window.removeEventListener("app-data-refresh", handler)
      window.removeEventListener("sidebar-main-page-click", sidebarPageClickHandler)
    }
  }, [user, closeCompanyPagePanels])

  // For non-SUPERADMIN users, auto-open edit form with their company
// Company profile users open direct edit form.
// SERVICE_PROVIDER must see company list, not direct edit form.
useEffect(() => {
  if (shouldAutoOpenCompanyProfile && companies.length > 0 && !isAddingNew && !editingCompany) {
    const company = companies[0] as any
    setServiceProviders([])
    setSpDropdownOpen(false)
    setFormData(mapCompanyToFormData(company))
    setEditingCompany(company)
    setIsAddingNew(true)
  }
}, [companies, shouldAutoOpenCompanyProfile, isAddingNew, editingCompany])

  const fetchCompanies = async () => {
    setListLoading(true)
    try {
      const res = await fetch("/backend/company")
      if (!res.ok) throw new Error(`Failed to load companies (${res.status})`)
      const json = await res.json()
      const all = Array.isArray(json) ? json : json.data ?? []

let filtered =
  user?.role === "SERVICE_PROVIDER"
    ? all.filter(
        (company: any) =>
          Number(company.serviceProviderID) === Number(user.serviceProviderID)
      )
    : await filterCompaniesForUser(all, user)

      if (filtered.length === 0 && isCompanyProfileOnly) {
        const ctx = getSidebarContext()
        const companyId =
          ctx?.companyID ??
          user?.companyID ??
          (Number(sessionStorage.getItem("activeCompanyID") || 0) || undefined)

        if (companyId) {
          const oneRes = await fetch(`/backend/company/${companyId}`)
          if (oneRes.ok) {
            const company = await oneRes.json()
            if (company?.id) filtered = [company]
          }
        }
      }

      setCompanies(filtered as Company[])
    } catch (error) {
      console.error("Failed to load companies:", error)
      toast.error("Failed to load company profile.")
      setCompanies([])
    } finally {
      setListLoading(false)
    }
  }

  // Resolve the single service provider (platform has only one).
  // Never trust stale sidebar/localStorage SP after deletes.
  const resolveSoleServiceProvider = async (): Promise<ServiceProvider | null> => {
    try {
      const res = await fetch("/backend/service-provider", { cache: "no-store" })
      if (!res.ok) return null
      const data = await res.json()
      const list: ServiceProvider[] = Array.isArray(data) ? data : data?.data ?? []
      const sole = list[0] || null

      const ctx = getSidebarContext()
      if (!sole) {
        if (ctx?.serviceProviderID) clearSidebarContext()
        return null
      }

      // Keep sidebar context in sync with the live SP only.
      if (
        !ctx ||
        Number(ctx.serviceProviderID) !== Number(sole.id) ||
        ctx.serviceProviderName !== sole.companyName
      ) {
        setSidebarContext(
          sole.id,
          sole.companyName || "",
          ctx?.companyID || 0,
          ctx?.companyName || "",
        )
      }
      return sole
    } catch (error) {
      console.error("Error resolving service provider:", error)
      return null
    }
  }

  const applySoleServiceProviderToForm = async () => {
    const sole = await resolveSoleServiceProvider()
    setFormData((p) => ({
      ...p,
      serviceProviderID: sole?.id,
      autocompleteName: sole?.companyName || "",
    }))
    return sole
  }

  // Fetch service providers for autocomplete (legacy — kept unused for SP list cache)
  const fetchServiceProviders = async (_query: string) => {
    /* no-op: tenant SP field is read-only and auto-bound */
  }


  const UPLOAD_URL = "/backend/files/upload";

  async function uploadImage(file: File): Promise<string> {
    const fd = new FormData();
    fd.append("file", file);
    const res = await fetch(UPLOAD_URL, { method: "POST", body: fd });
    if (!res.ok) throw new Error(`${res.status} ${res.statusText}`);
    const raw = await res.json();
    return raw?.url || raw?.data?.url || raw?.location || "";
  }

  // Submit form
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    // Prevent double click / multiple submits
    if (saving) return;

    setSaving(true);

    // Safety timeout - unlock after 5 sec if API hangs
    const saveTimeout = setTimeout(() => {
      setSaving(false);
    }, 5000);

    try {
      let companyLogoUrl = formData.companyLogoUrl || "";
      const SignatureUrl = formData.SignatureUrl || "";

      if (logoFile) {
        companyLogoUrl = await uploadImage(logoFile);
      }

      // Always bind the sole live service provider (never stale localStorage / typed text).
      const soleSp = await resolveSoleServiceProvider()
      const resolvedServiceProviderID = soleSp?.id
      if (!resolvedServiceProviderID) {
        toast.error("Create a Service Provider first, then add a tenant.")
        return
      }

      const finalData = buildCompanyPayload(formData as Record<string, unknown>, {
        companyName: formData.companyName || formData.autocompleteName || "",
        serviceProviderID: resolvedServiceProviderID,
        companyLogoUrl: companyLogoUrl || undefined,
        SignatureUrl: SignatureUrl || undefined,
      });

      const res = editingCompany
        ? await fetch(`/backend/company/${editingCompany.id}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(finalData),
        })
        : await fetch("/backend/company", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(finalData),
        });

      if (!res.ok) throw new Error(await res.text());

      await fetchCompanies();
      // For non-SUPERADMIN, stay in edit mode (useEffect will re-open)
      resetForm();
setIsAddingNew(false);
setEditingCompany(null);
      toast.success("Company saved successfully");
      window.dispatchEvent(new Event("sidebar-refresh"));
    } catch (error) {
      console.error(error);
      const message =
        error instanceof Error ? error.message : "Failed to save company";
      toast.error(message.includes("statusCode") ? "Failed to save company" : message);
    } finally {
      clearTimeout(saveTimeout);
      setSaving(false);
    }
  };

  const handleEditCompanyAdmin = (user: CompanyAdminUser) => {
    setEditingCompanyAdmin(user)

    setCompanyAdminForm({
      ...emptyCompanyAdminForm,
      username: user.username || "",
      password: "",
      role: "COMPANY_OWNER",
      firstName: user.firstName || "",
      lastName: user.lastName || "",
      contactNo: user.contactNo || "",
      email: user.email || "",
      designation:
        (user as any).ownerTitle ||
        (selectedCompanyForAdmin as any)?.defaultOwnerTitle ||
        defaultUserTypeForEntity(selectedCompanyForAdmin?.legalEntityType) ||
        "",
      serviceProviderID: selectedCompanyForAdmin?.serviceProviderID || "",
      companyID: selectedCompanyForAdmin?.id || "",
      isActive: user.isActive,
    })
    setCompanyAdminFormOpen(true)
  }

  const handleDeleteCompanyAdmin = async (id: number) => {
    if (!selectedCompanyForAdmin?.id) return
    if (!confirm("Deactivate this Company Owner?")) return

    try {
      const res = await fetch(`/backend/company/${selectedCompanyForAdmin.id}/owner/${id}`, {
        method: "DELETE",
      })

      if (!res.ok) {
        const errText = await res.text()
        throw new Error(errText || "Failed to deactivate Company Owner")
      }

      toast.success("Company Owner deactivated")

      if (editingCompanyAdmin?.id === id) {
        setEditingCompanyAdmin(null)
        setCompanyAdminForm({
          ...emptyCompanyAdminForm,
          role: "COMPANY_OWNER",
          serviceProviderID: selectedCompanyForAdmin?.serviceProviderID || "",
          companyID: selectedCompanyForAdmin?.id || "",
          isActive: true,
        })
      }

      if (selectedCompanyForAdmin) {
        await fetchCompanyAdminUsers(selectedCompanyForAdmin)
        setCompanyAdminFormOpen(false)
      }
    } catch (error: any) {
      toast.error(error?.message || "Failed to deactivate Company Owner")
    }
  }

  const handleEdit = async (company: Company & { serviceProvider?: ServiceProvider }) => {
    setServiceProviders([])
    setSpDropdownOpen(false)
    setFormData(mapCompanyToFormData(company))
    setEditingCompany(company)
    setIsAddingNew(true)
    setIsViewing(false)
    await applySoleServiceProviderToForm()
  }

  const handleView = (company: Company) => {
    setViewCompany(company)
    setIsViewing(true)
    setIsAddingNew(false)
  }

  const handleDelete = async (id: number) => {
    if (confirm("Are you sure you want to delete this company?")) {
      try {
        const res = await fetch(`/backend/company/${id}`, { method: "DELETE" })
        if (!res.ok) {
          const errText = await res.text()
          let message = "Failed to delete company"
          try {
            const parsed = JSON.parse(errText)
            message = parsed?.message || message
          } catch {
            if (errText) message = errText
          }
          throw new Error(message)
        }
        await fetchCompanies()
        toast.success("Company deleted successfully")
      } catch (error) {
        console.error("Error deleting company:", error)
        toast.error((error as any)?.message || "Failed to delete company")
      }
    }
  }

  const resetForm = () => {
    setFormData({
      companyName: "",
      companyType: "",
      legalEntityType: "",
      noticePeriodDaysForResignation: "",
      noticePeriodDaysForTermination: "",
      address: "",
      country: "",
      state: "",
      city: "",
      pincode: "",
      timeZone: "",
      currency: "",
      pfNo: "",
      tanNo: "",
      panNo: "",
      esiNo: "",
      linNo: "",
      gstNo: "",
      gstCertUrl: "",
      shopRegNo: "",
      shopRegCertHistory: [],
      financialYearStart: "",
      contactNo: "",
      emailAdd: "",
      serviceProviderID: undefined,
      autocompleteName: "",
    })
    setLogoFile(null)
    setEditingCompany(null)
    setServiceProviders([])
    setSpDropdownOpen(false)
    setCompanyFormTab("basic")
  }

  const handleCancel = () => {
    resetForm()
    setIsAddingNew(false)
    setIsViewing(false)
    setViewCompany(null)
  }



  const openModuleDrawer = async (company: Company) => {
    setSelectedCompanyForModules(company)
    setIsModuleDrawerOpen(true)
    setModuleLoading(true)

    try {
      const [modulesRes, companyModulesRes] = await Promise.all([
        fetch("/backend/company/modules/all"),
        fetch(`/backend/company/${company.id}/modules`),
      ])

      if (!modulesRes.ok) throw new Error("Failed to load modules")
      if (!companyModulesRes.ok) throw new Error("Failed to load company modules")

      const modules = await modulesRes.json()
      const companyModules = await companyModulesRes.json()

      setAllModules(Array.isArray(modules) ? modules : [])

      setSelectedModuleIds(
        Array.isArray(companyModules)
          ? companyModules
            .filter((m: CompanyModuleItem) => m.isEnabled)
            .map((m: CompanyModuleItem) => Number(m.moduleID))
          : []
      )
    } catch (error) {
      console.error("Module load error:", error)
      toast.error("Failed to load modules")
      setAllModules([])
      setSelectedModuleIds([])
    } finally {
      setModuleLoading(false)
    }
  }

  const closeModuleDrawer = () => {
    setIsModuleDrawerOpen(false)
    setSelectedCompanyForModules(null)
    setAllModules([])
    setSelectedModuleIds([])
  }

  const toggleModule = (moduleId: number) => {
    setSelectedModuleIds((prev) =>
      prev.includes(moduleId)
        ? prev.filter((id) => id !== moduleId)
        : [...prev, moduleId]
    )
  }

  const saveCompanyModules = async () => {
    if (!selectedCompanyForModules?.id) {
      toast.error("Company not selected")
      return
    }

    setModuleSaving(true)

    try {
      const payload = {
        modules: allModules.map((module) => ({
          moduleID: module.id,
          isEnabled: selectedModuleIds.includes(module.id),
        })),
      }

      const res = await fetch(`/backend/company/${selectedCompanyForModules.id}/modules`, {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(payload),
      })

      if (!res.ok) {
        const err = await res.text()
        throw new Error(err || "Failed to save company modules")
      }

      toast.success("Company modules updated successfully")
      closeModuleDrawer()
    } catch (error: any) {
      console.error("Save module error:", error)
      toast.error(error?.message || "Failed to save modules")
    } finally {
      setModuleSaving(false)
    }
  }

  const filteredCompanies = useMemo(() => {
    const t = table.search.trim().toLowerCase()
    let list = companies.filter(
      (c) =>
        !t ||
        (c.companyName?.toLowerCase().includes(t) ||
          c.country?.toLowerCase().includes(t) ||
          c.emailAdd?.toLowerCase().includes(t))
    )
    return sortRows(list, table.sortBy, table.sortDir, (row, key) => {
      const c = row as Company
      if (key === "companyName") return c.companyName ?? ""
      if (key === "country") return c.country ?? ""
      if (key === "state") return c.state ?? ""
      if (key === "emailAdd") return c.emailAdd ?? ""
      if (key === "contactNo") return c.contactNo ?? ""
      if (key === "gstNo") return c.gstNo ?? ""
      return ""
    })
  }, [companies, table.search, table.sortBy, table.sortDir])

  const companyColumns = useMemo((): DataTableColumn<Company>[] => [
    {
      key: "companyName",
      header: "Name",
      sortable: true,
      colSpan: 3,
      cell: (c) => <span className="font-medium">{c.companyName || "—"}</span>,
    },
    {
      key: "country",
      header: "Country",
      sortable: true,
      colSpan: 2,
      cell: (c) => c.country || "—",
    },
    {
      key: "state",
      header: "State",
      sortable: true,
      colSpan: 2,
      cell: (c) => c.state || "—",
    },
    {
      key: "emailAdd",
      header: "Email",
      sortable: true,
      colSpan: 2,
      cell: (c) => c.emailAdd || "—",
    },
    {
      key: "contactNo",
      header: "Contact",
      sortable: true,
      colSpan: 2,
      cell: (c) => c.contactNo || "—",
    },
    {
      key: "gstNo",
      header: "GST",
      sortable: true,
      colSpan: 2,
      cell: (c) => c.gstNo || "—",
    },
    {
      key: "actions",
      header: "Actions",
      colSpan: 3,
      align: "right",
      cell: (c) => (
        <EntityRowActions
          onView={() => handleView(c)}
          onEdit={
            user?.role === "SUPERADMIN" || user?.role === "SERVICE_PROVIDER" || user?.role === "COMPANY_ADMIN"
              ? () => handleEdit(c)
              : undefined
          }
          onDelete={
            user?.role === "SUPERADMIN" || user?.role === "COMPANY_ADMIN" || user?.role === "SERVICE_PROVIDER"
              ? () => handleDelete(c.id)
              : undefined
          }
          extra={
            user?.role === "SUPERADMIN" || user?.role === "SERVICE_PROVIDER"
              ? [
                  {
                    icon: UserPlus,
                    title: "Company Owners",
                    onClick: () => openCompanyAdminDrawer(c),
                  },
                ]
              : undefined
          }
        />
      ),
    },
  ], [user?.role])

  // Close autocomplete on outside click
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (wrapperRef.current && !wrapperRef.current.contains(event.target as Node)) {
        setServiceProviders([])
      }
    }
    document.addEventListener("mousedown", handleClickOutside)
    return () => document.removeEventListener("mousedown", handleClickOutside)
  }, [])

  const fetchCompanyAdminUsers = async (company: Company) => {
    try {
      setCompanyAdminLoading(true)

      const res = await fetch(`/backend/company/owners?companyID=${company.id}`)
      const data = await res.json()
      const owners = Array.isArray(data) ? data : data?.data ?? []

      setCompanyAdminUsers(
        owners.map((o: any) => ({
          id: o.id,
          username: o.employeeCredentials?.username || o.employeeID || "",
          role: "COMPANY_OWNER",
          firstName: o.employeeFirstName,
          lastName: o.employeeLastName,
          contactNo: o.personalPhoneNo,
          email: o.businessEmail,
          isActive: o.employeeCredentials?.isActive !== false,
          serviceProviderID: o.serviceProviderID,
          companyID: o.companyID,
          company: o.company,
          ownerTitle: o.ownerTitle,
        })),
      )
    } catch (error) {
      console.error("Failed to fetch company owners:", error)
      setCompanyAdminUsers([])
    } finally {
      setCompanyAdminLoading(false)
    }
  }

  const openCompanyAdminDrawer = async (company: Company) => {
    setSelectedCompanyForAdmin(company)

    setCompanyAdminForm({
      ...emptyCompanyAdminForm,
      role: "COMPANY_OWNER",
      serviceProviderID: company.serviceProviderID || "",
      companyID: company.id,
      isActive: true,
      designation:
        (company as any).defaultOwnerTitle ||
        defaultUserTypeForEntity(company.legalEntityType) ||
        ownerTitleForLegalEntity(company.legalEntityType) ||
        "",
    })

    setCompanyAdminFormOpen(false)
    setCompanyAdminDrawerOpen(true)
    await fetchCompanyAdminUsers(company)
  }

  const closeCompanyAdminPanel = () => {
    setCompanyAdminDrawerOpen(false)
    setSelectedCompanyForAdmin(null)
    setCompanyAdminUsers([])
    setCompanyAdminForm({ ...emptyCompanyAdminForm })
    setCompanyAdminSaving(false)
    setCompanyAdminLoading(false)
    setEditingCompanyAdmin(null)
    setCompanyAdminFormOpen(false)
  }

  const createCompanyAdminUser = async (e: React.FormEvent) => {
    e.preventDefault()

    if (companyAdminSaving) return

    if (!selectedCompanyForAdmin?.id) {
      toast.error("Company not selected")
      return
    }

    if (!companyAdminForm.username.trim()) {
      toast.error("Username is required")
      return
    }

    if (!editingCompanyAdmin && !companyAdminForm.password.trim()) {
      toast.error("Password is required")
      return
    }

    if (companyAdminForm.password && companyAdminForm.password.length < 6) {
      toast.error("Password must be at least 6 characters")
      return
    }

    setCompanyAdminSaving(true)

    try {
      const companyId = selectedCompanyForAdmin.id
      const isEdit = Boolean(editingCompanyAdmin?.id)

      const payload: any = {
        firstName: companyAdminForm.firstName || companyAdminForm.username.trim(),
        lastName: companyAdminForm.lastName || undefined,
        username: companyAdminForm.username.trim(),
        personalPhoneNo: companyAdminForm.contactNo || undefined,
        businessEmail: companyAdminForm.email || undefined,
        isActive: companyAdminForm.isActive,
        ownerTitle:
          companyAdminForm.designation?.trim() ||
          (selectedCompanyForAdmin as any)?.defaultOwnerTitle ||
          ownerTitleForLegalEntity(selectedCompanyForAdmin.legalEntityType) ||
          undefined,
      }

      if (companyAdminForm.password.trim()) {
        payload.password = companyAdminForm.password
      } else if (!isEdit) {
        toast.error("Password is required")
        setCompanyAdminSaving(false)
        return
      }

      const res = await fetch(
        isEdit
          ? `/backend/company/${companyId}/owner/${editingCompanyAdmin?.id}`
          : `/backend/company/${companyId}/owner`,
        {
          method: isEdit ? "PATCH" : "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        }
      )

      if (!res.ok) {
        const errText = await res.text()
        throw new Error(
          errText ||
          (isEdit
            ? "Failed to update company owner"
            : "Failed to create company owner")
        )
      }

      toast.success(
        isEdit
          ? "Company owner updated successfully"
          : "Company owner created — they log in as an employee"
      )

      setEditingCompanyAdmin(null)
      setCompanyAdminForm({
        ...emptyCompanyAdminForm,
        role: "COMPANY_OWNER",
        serviceProviderID: selectedCompanyForAdmin.serviceProviderID || "",
        companyID: selectedCompanyForAdmin.id,
        isActive: true,
      })

      await fetchCompanyAdminUsers(selectedCompanyForAdmin)
    } catch (error: any) {
      console.error(error)
      toast.error(error?.message || "Failed to save company owner")
    } finally {
      setCompanyAdminSaving(false)
    }
  }

  return (
    <div className="space-y-6 w-full max-w-none animate-fade-in page-content-enter pb-6 min-h-0">

      {listLoading && isCompanyProfileOnly && (
        <ListAreaSkeleton rows={6} />
      )}

      {!listLoading && (
        <>

          {/* Header with Dropdown */}
          <PageHeader
            icon={Building2}
            title="Tenants"
            description="Manage registered companies"
            actions={
              !isAddingNew && !isViewing && !isModuleDrawerOpen && user?.role === "SUPERADMIN" ? (
                <Button
                  onClick={async () => {
                    resetForm()
                    setIsAddingNew(true)
                    await applySoleServiceProviderToForm()
                  }}
                >
                  <Plus className="w-4 h-4 mr-1" /> Add Tenant
                </Button>
              ) : null
            }
          />

          {/* Add/Edit Form - Drawer */}
          <FormDrawer
            open={isAddingNew}
            onOpenChange={(v) => { if (!v) handleCancel(); }}
            title={editingCompany ? "Edit Tenant" : "Add New Tenant"}
          >
            <div>
              <form onSubmit={handleSubmit} className="space-y-8 pb-2">
                <FormSectionNav
                  active={companyFormTab}
                  onChange={setCompanyFormTab}
                  sections={[
                    { id: "basic", label: "Company Information" },
                    { id: "location", label: "Additional Information" },
                    { id: "compliance", label: "Compliance & Tax" },
                  ]}
                />

                {companyFormTab === "basic" && (
                  <>
                <FormSection
                  title="Company information"
                  description="Manage your organization's core details and classification."
                >
                  <FormField label="Company Name" required>
                    <Input
                      value={formData.companyName || ""}
                      onChange={(e) => setFormData((p) => ({ ...p, companyName: e.target.value }))}
                      placeholder="Enter company name"
                    />
                  </FormField>

                  <FormField label="Company Type" description="Legal entity type for this tenant." required>
                    <Select
                      value={formData.legalEntityType || ""}
                      onValueChange={(v) =>
                        setFormData((p) => ({
                          ...p,
                          legalEntityType: v,
                          defaultOwnerTitle: defaultUserTypeForEntity(v),
                        }))
                      }
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Select company type" />
                      </SelectTrigger>
                      <SelectContent>
                        {LEGAL_ENTITY_OPTIONS.map((opt) => (
                          <SelectItem key={opt.value} value={opt.value}>
                            {opt.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </FormField>

                  <FormField label="Company Address">
                    <Textarea
                      value={formData.address || ""}
                      onChange={(e) => setFormData((p) => ({ ...p, address: e.target.value }))}
                      placeholder="Street, area, landmark…"
                      rows={3}
                      showCount
                      maxLength={500}
                    />
                  </FormField>
                </FormSection>

                  </>
                )}

                {companyFormTab === "location" && (
                  <>
                <FormSection title="Location" description="Regional address and geo details.">
                  <LocationFields
                    values={{
                      city: formData.city,
                      state: formData.state,
                      pincode: formData.pincode,
                      country: formData.country,
                      currency: formData.currency,
                    }}
                    onChange={(patch) => setFormData((p) => ({ ...p, ...patch }))}
                    showCurrency={false}
                  />
                </FormSection>

                <FormSection title="Regional settings" description="Timezone and currency for payroll and reporting.">
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <FormField label="Time Zone">
                      <TimezoneSelect
                        value={formData.timeZone || ""}
                        onChange={(value) => setFormData((p) => ({ ...p, timeZone: value }))}
                      />
                    </FormField>
                    <SearchSuggestInput
                      label="Currency"
                      placeholder="Type currency code…"
                      value={formData.currency || ""}
                      onChange={(v) => setFormData((p) => ({ ...p, currency: v }))}
                      onSelect={({ display }) => setFormData((p) => ({ ...p, currency: display }))}
                      fetchData={fetchCurrencies}
                      displayField="code"
                      valueField="code"
                    />
                  </div>
                </FormSection>

                <FormSection title="Contact" description="Primary contact details for this company.">
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <FormField label="Contact Number">
                      <Input value={formData.contactNo || ""} onChange={(e) => setFormData((p) => ({ ...p, contactNo: e.target.value }))} />
                    </FormField>
                    <FormField label="Email Address">
                      <Input type="email" value={formData.emailAdd || ""} onChange={(e) => setFormData((p) => ({ ...p, emailAdd: e.target.value }))} />
                    </FormField>
                  </div>
                </FormSection>

                <FormSection title="Branding" description="Logo used on documents and payslips.">
                  <FileDropzone
                    label="Company Logo"
                    accept="image/*"
                    hint="PNG or JPG"
                    value={logoFile}
                    onChange={setLogoFile}
                    variant="image"
                  />
                </FormSection>

                  </>
                )}

                {companyFormTab === "compliance" && (
                <FormSection title="Compliance & tax" description="Statutory registration numbers for payroll compliance.">
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <FormField label="PF No"><Input value={formData.pfNo || ""} onChange={(e) => setFormData((p) => ({ ...p, pfNo: e.target.value }))} /></FormField>
                    <FormField label="TAN No"><Input value={formData.tanNo || ""} onChange={(e) => setFormData((p) => ({ ...p, tanNo: e.target.value }))} /></FormField>
                    <FormField label="PAN No"><Input value={formData.panNo || ""} onChange={(e) => setFormData((p) => ({ ...p, panNo: e.target.value }))} /></FormField>
                    <FormField label="ESI No"><Input value={formData.esiNo || ""} onChange={(e) => setFormData((p) => ({ ...p, esiNo: e.target.value }))} /></FormField>
                    <FormField label="LIN No"><Input value={formData.linNo || ""} onChange={(e) => setFormData((p) => ({ ...p, linNo: e.target.value }))} /></FormField>
                    <FormField label="GST No" className="sm:col-span-2">
                      <Input value={formData.gstNo || ""} onChange={(e) => setFormData((p) => ({ ...p, gstNo: e.target.value }))} />
                    </FormField>
                  </div>
                  <PdfUploadField
                    label="GST certificate (PDF)"
                    value={formData.gstCertUrl}
                    onChange={(url) => setFormData((p) => ({ ...p, gstCertUrl: url ?? "" }))}
                  />
                  <FormField label="Financial Year Start">
                    <Select
                      value={formData.financialYearStart || FINANCIAL_YEAR_EMPTY}
                      onValueChange={(value) =>
                        setFormData((p) => ({
                          ...p,
                          financialYearStart: value === FINANCIAL_YEAR_EMPTY ? "" : value,
                        }))
                      }
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Select start date" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value={FINANCIAL_YEAR_EMPTY}>Select start date</SelectItem>
                        <SelectItem value="1st Jan">1st January</SelectItem>
                        <SelectItem value="1st April">1st April</SelectItem>
                      </SelectContent>
                    </Select>
                  </FormField>
                </FormSection>
                )}

                <div className="flex justify-end gap-2 border-t border-border pt-5">
                  <Button type="submit" disabled={saving}>
                    <Save className="w-4 h-4 mr-1" />
                    {editingCompany ? "Save Changes" : "Add Tenant"}
                  </Button>
                </div>
              </form>
            </div>
          </FormDrawer>

          {/* View Details - Drawer */}
          <FormDrawer
            open={!!(isViewing && viewCompany)}
            onOpenChange={(v) => { if (!v) handleCancel(); }}
            title="Company Details"
            showHeaderCancel
            cancelLabel="Close"
          >
            {viewCompany && (
              <EntityDetailLayout
                hero={
                  <EntityDetailHero
                    title={viewCompany.companyName}
                    subtitle={
                      <span>
                        {[
                          LEGAL_ENTITY_OPTIONS.find((o) => o.value === viewCompany.legalEntityType)?.label,
                          viewCompany.companyType,
                        ]
                          .filter(Boolean)
                          .join(" · ") || "—"}
                      </span>
                    }
                  />
                }
              >
                <DetailCard
                  title="Overview"
                  subtitle="Core company details"
                  rows={[
                    { label: "Company name", value: viewCompany.companyName },
                    {
                      label: "Company type",
                      value:
                        LEGAL_ENTITY_OPTIONS.find((o) => o.value === viewCompany.legalEntityType)?.label ||
                        viewCompany.legalEntityType ||
                        "—",
                    },
                    { label: "Establishment type", value: viewCompany.companyType },
                    { label: "Address", value: viewCompany.address },
                  ]}
                />
                <DetailCard
                  title="Location"
                  subtitle="Regional address details"
                  rows={[
                    { label: "Country", value: viewCompany.country },
                    { label: "State", value: viewCompany.state },
                    { label: "City", value: viewCompany.city },
                    { label: "Pincode", value: viewCompany.pincode },
                  ]}
                />
                <DetailCard
                  title="Contact"
                  subtitle="Primary contact details"
                  rows={[
                    { label: "Contact number", value: viewCompany.contactNo },
                    { label: "Email", value: viewCompany.emailAdd },
                    { label: "Time zone", value: viewCompany.timeZone },
                    { label: "Currency", value: viewCompany.currency },
                  ]}
                />
                <DetailCard
                  title="Statutory"
                  subtitle="Government and legal identifiers"
                  rows={[
                    { label: "GST No", value: viewCompany.gstNo },
                    { label: "PF", value: viewCompany.pfNo },
                    { label: "TAN", value: viewCompany.tanNo },
                    { label: "PAN", value: viewCompany.panNo },
                    { label: "ESI", value: viewCompany.esiNo },
                    { label: "LIN", value: viewCompany.linNo },
                    { label: "Shop registration", value: viewCompany.shopRegNo },
                    { label: "Financial year start", value: viewCompany.financialYearStart },
                  ]}
                />
                {(viewCompany.companyLogoUrl || viewCompany.SignatureUrl) ? (
                  <DetailCard title="Branding" subtitle="Logo and signature" className="lg:col-span-2">
                    <div className="flex flex-wrap gap-6">
                      {viewCompany.companyLogoUrl ? (
                        <div>
                          <p className="mb-2 text-sm text-muted-foreground">Company logo</p>
                          <img src={viewCompany.companyLogoUrl} alt="Company Logo" className="h-24 w-24 rounded-lg border object-contain" />
                        </div>
                      ) : null}
                      {viewCompany.SignatureUrl ? (
                        <div>
                          <p className="mb-2 text-sm text-muted-foreground">Signature</p>
                          <img src={viewCompany.SignatureUrl} alt="Signature" className="h-24 w-24 rounded-lg border object-contain" />
                        </div>
                      ) : null}
                    </div>
                  </DetailCard>
                ) : null}
              </EntityDetailLayout>
            )}
          </FormDrawer>

          <FormDrawer
            open={isModuleDrawerOpen}
            onOpenChange={(open) => {
              if (!open) closeModuleDrawer()
              else setIsModuleDrawerOpen(true)
            }}
            title="Company Modules"
            description="Select modules enabled for this company."
          >
            <div className="space-y-4">
              <div className="space-y-2">
                <Label>Company</Label>
                <Input
                  value={selectedCompanyForModules?.companyName || ""}
                  readOnly
                  className="bg-gray-100 cursor-not-allowed"
                />
              </div>

              {moduleLoading ? (
                <div className="text-center py-6 text-gray-500">
                  Loading modules...
                </div>
              ) : allModules.length === 0 ? (
                <div className="text-center py-6 text-gray-500">
                  No modules found.
                </div>
              ) : (
                <div className="space-y-3">
                  {allModules.map((module) => (
                    <div
                      key={module.id}
                      className="flex items-start gap-3 rounded-md border p-3"
                    >
                      <input
                        type="checkbox"
                        checked={selectedModuleIds.includes(module.id)}
                        onChange={() => toggleModule(module.id)}
                        className="mt-1 w-4 h-4"
                      />

                      <div>
                        <p className="font-medium">{module.moduleName}</p>
                        <p className="text-xs text-gray-500">{module.moduleKey}</p>
                      </div>
                    </div>
                  ))}
                </div>
              )}

              <div className="flex justify-end gap-3 pt-4">

                <Button
                  type="button"
                  onClick={saveCompanyModules}
                  disabled={moduleSaving || moduleLoading}
                >
                  {moduleSaving ? "Saving..." : "Save Modules"}
                </Button>
              </div>
            </div>
          </FormDrawer>

          {companyAdminDrawerOpen && selectedCompanyForAdmin && (
            <Card className="w-full border border-gray-200 shadow-sm">
              <CardHeader className="border-b bg-white">
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <CardTitle className="flex items-center gap-2 text-xl">
                      <UserPlus className="w-5 h-5 text-indigo-600" />
                      Company Owners
                    </CardTitle>
                    <p className="text-sm text-gray-500 mt-1">
                      Create and view company owner employee logins for this tenant.
                    </p>
                  </div>

                  <div className="flex gap-2">
                    {!companyAdminFormOpen ? (
                      <Button
                        type="button"
                        onClick={() => {
                          setEditingCompanyAdmin(null)
                          setCompanyAdminForm({
                            ...emptyCompanyAdminForm,
                            role: "COMPANY_OWNER",
                            serviceProviderID: selectedCompanyForAdmin?.serviceProviderID || "",
                            companyID: selectedCompanyForAdmin?.id || "",
                            isActive: true,
                            designation:
                              (selectedCompanyForAdmin as any)?.defaultOwnerTitle ||
                              defaultUserTypeForEntity(selectedCompanyForAdmin?.legalEntityType) ||
                              ownerTitleForLegalEntity(selectedCompanyForAdmin?.legalEntityType) ||
                              "",
                          })
                          setCompanyAdminFormOpen(true)
                        }}
                      >
                        <Plus className="w-4 h-4 mr-2" />
                        Add User
                      </Button>
                    ) : (
                      <Button
                        type="button"
                        variant="outline"
                        onClick={() => {
                          setEditingCompanyAdmin(null)
                          setCompanyAdminFormOpen(false)
                        }}
                      >
                        <ArrowLeft className="w-4 h-4 mr-2" />
                        Back to Users
                      </Button>
                    )}

                    <Button
                      type="button"
                      variant="outline"
                      onClick={closeCompanyAdminPanel}
                    >
                      <X className="w-4 h-4 mr-2" />
                      Back to Companies
                    </Button>
                  </div>
                </div>
              </CardHeader>

              <CardContent className="p-6 space-y-6">
                <div className="rounded-xl border bg-indigo-50/60 px-4 py-3">
                  <p className="text-sm text-gray-500">Selected Company</p>
                  <p className="text-base font-semibold text-gray-900">
                    {selectedCompanyForAdmin.companyName || "—"}
                  </p>
                </div>

                {companyAdminFormOpen ? (
                  <form
                    onSubmit={createCompanyAdminUser}
                    className="rounded-xl border bg-white p-5 space-y-5"
                  >
                    <div>
                      <h3 className="text-base font-semibold text-gray-900">
                        {editingCompanyAdmin
                          ? "Update Company Owner"
                          : "Create Company Owner"}
                      </h3>
                      <p className="text-sm text-gray-500">
                        {editingCompanyAdmin
                          ? "Update owner employee login. Leave password blank to keep existing password."
                          : "Creates an employee login with full company owner rights."}
                      </p>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div className="space-y-2 md:col-span-2">
                        <Label>Designation *</Label>
                        {selectedCompanyForAdmin?.legalEntityType &&
                        userTypeOptionsForEntity(selectedCompanyForAdmin.legalEntityType).length > 0 ? (
                          <Select
                            value={
                              companyAdminForm.designation ||
                              (selectedCompanyForAdmin as any).defaultOwnerTitle ||
                              defaultUserTypeForEntity(selectedCompanyForAdmin.legalEntityType)
                            }
                            onValueChange={(v) =>
                              setCompanyAdminForm((p) => ({ ...p, designation: v }))
                            }
                          >
                            <SelectTrigger>
                              <SelectValue placeholder="Select designation" />
                            </SelectTrigger>
                            <SelectContent>
                              {userTypeOptionsForEntity(selectedCompanyForAdmin.legalEntityType).map(
                                (opt) => (
                                  <SelectItem key={opt} value={opt}>
                                    {opt}
                                  </SelectItem>
                                ),
                              )}
                            </SelectContent>
                          </Select>
                        ) : (
                          <Input
                            value={companyAdminForm.designation}
                            onChange={(e) =>
                              setCompanyAdminForm((p) => ({
                                ...p,
                                designation: e.target.value,
                              }))
                            }
                            placeholder="e.g. Proprietor / Director"
                          />
                        )}
                      </div>

                      <div className="space-y-2">
                        <Label>Username *</Label>
                        <Input
                          autoComplete="new-username"
                          name="new-company-admin-username"
                          value={companyAdminForm.username}
                          onChange={(e) =>
                            setCompanyAdminForm((p) => ({
                              ...p,
                              username: e.target.value,
                            }))
                          }
                          placeholder="Enter username"
                        />
                      </div>

                      <div className="space-y-2">
                        <Label>Password *</Label>
                        <Input
                          autoComplete="new-password"
                          name="new-company-admin-password"
                          type="text"
                          value={companyAdminForm.password}
                          onChange={(e) =>
                            setCompanyAdminForm((p) => ({
                              ...p,
                              password: e.target.value,
                            }))
                          }
                          placeholder="Minimum 6 characters"
                        />
                      </div>

                      <div className="space-y-2">
                        <Label>First Name</Label>
                        <Input
                          name="new-company-admin-firstName"
                          value={companyAdminForm.firstName}
                          onChange={(e) =>
                            setCompanyAdminForm((p) => ({
                              ...p,
                              firstName: e.target.value,
                            }))
                          }
                          placeholder="Enter first name"
                        />
                      </div>

                      <div className="space-y-2">
                        <Label>Last Name</Label>
                        <Input
                          name="new-company-admin-lastName"
                          value={companyAdminForm.lastName}
                          onChange={(e) =>
                            setCompanyAdminForm((p) => ({
                              ...p,
                              lastName: e.target.value,
                            }))
                          }
                          placeholder="Enter last name"
                        />
                      </div>

                      <div className="space-y-2">
                        <Label>Contact Number</Label>
                        <Input
                          name="new-company-admin-contactNo"
                          value={companyAdminForm.contactNo}
                          onChange={(e) =>
                            setCompanyAdminForm((p) => ({
                              ...p,
                              contactNo: e.target.value,
                            }))
                          }
                          placeholder="Enter contact number"
                        />
                      </div>

                      <div className="space-y-2">
                        <Label>Email</Label>
                        <Input
                          name="new-company-admin-email"
                          type="text"
                          value={companyAdminForm.email}
                          onChange={(e) =>
                            setCompanyAdminForm((p) => ({
                              ...p,
                              email: e.target.value,
                            }))
                          }
                          placeholder="Enter email"
                        />
                      </div>

                      <div className="space-y-2">
                        <Label>Status</Label>
                        <label className="flex h-10 items-center gap-2 rounded-md border px-3 text-sm bg-white">
                          <input
                            type="checkbox"
                            checked={companyAdminForm.isActive}
                            onChange={(e) =>
                              setCompanyAdminForm((p) => ({
                                ...p,
                                isActive: e.target.checked,
                              }))
                            }
                          />
                          Active
                        </label>
                      </div>
                    </div>

                    <div className="flex justify-end gap-2">
                      {editingCompanyAdmin && (
                        <Button
                          type="button"
                          variant="outline"
                          onClick={() => {
                            setEditingCompanyAdmin(null)
                            setCompanyAdminForm({
                              ...emptyCompanyAdminForm,
                              role: "COMPANY_OWNER",
                              serviceProviderID: selectedCompanyForAdmin?.serviceProviderID || "",
                              companyID: selectedCompanyForAdmin?.id || "",
                              isActive: true,
                            })
                          }}
                        >
                          Cancel Edit
                        </Button>
                      )}

                      <Button type="submit" disabled={companyAdminSaving}>
                        {companyAdminSaving
                          ? editingCompanyAdmin
                            ? "Updating..."
                            : "Creating..."
                          : editingCompanyAdmin
                            ? "Update Company Owner"
                            : "Create Company Owner"}

                      </Button>
                    </div>
                  </form>
                ) : (
                  <div className="rounded-xl border bg-white overflow-hidden">
                    <div className="px-5 py-4 border-b">
                      <h3 className="text-base font-semibold text-gray-900">
                        Existing Company Owners
                      </h3>
                      <p className="text-sm text-gray-500">
                        Company owner employee accounts for this tenant.
                      </p>
                    </div>

                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Username</TableHead>
                          <TableHead>Role</TableHead>
                          <TableHead>Status</TableHead>
                          <TableHead className="text-right">Actions</TableHead>
                        </TableRow>
                      </TableHeader>

                      <TableBody>
                        {companyAdminLoading ? (
                          <TableRow>
                            <TableCell colSpan={4} className="text-center py-8 text-gray-500">
                              Loading users...

                            </TableCell>
                          </TableRow>
                        ) : companyAdminUsers.length === 0 ? (
                          <TableRow>
                            <TableCell colSpan={4} className="text-center py-8 text-gray-500">
                              No company owners found
                            </TableCell>
                          </TableRow>
                        ) : (
                          companyAdminUsers.map((u) => (
                            <TableRow key={u.id}>
                              <TableCell className="font-medium">{u.username}</TableCell>
                              <TableCell>
                                <Badge variant="secondary">{u.role}</Badge>
                              </TableCell>
                              <TableCell>
                                <Badge>
                                  {u.isActive ? "Active" : "Inactive"}
                                </Badge>
                              </TableCell>

                              <TableCell className="text-right">
                                <div className="flex justify-end gap-2">

                                  <Button
                                    variant="ghost"
                                    size="icon"
                                    onClick={() => handleEditCompanyAdmin(u)}
                                  >
                                    <Edit className="h-4 w-4 text-blue-600" />
                                  </Button>

                                  <Button
                                    variant="ghost"
                                    size="icon"
                                    onClick={() => handleDeleteCompanyAdmin(u.id)}
                                  >
                                    <Trash2 className="h-4 w-4 text-red-600" />
                                  </Button>

                                </div>
                              </TableCell>
                            </TableRow>
                          ))
                        )}
                      </TableBody>
                    </Table>
                  </div>
                )}
              </CardContent>
            </Card>
          )}

{!isAddingNew && !isViewing && (isSuperAdmin || isServiceProvider) && !companyAdminDrawerOpen && !isModuleDrawerOpen && (<>
            <FilterBar
              search={{
                value: table.search,
                onChange: table.setSearch,
                placeholder: "Search companies…",
              }}
            />

            <EntityListShell
              title="Company list"
              columns={companyColumns}
              rows={filteredCompanies}
              rowKey={(c) => String(c.id)}
              isLoading={listLoading}
              sortBy={table.sortBy}
              sortDir={table.sortDir}
              onSort={table.setSort}
              emptyTitle="No companies found"
              emptyDescription="Try adjusting your search criteria."
              emptyAction={
                user?.role === "SUPERADMIN" ? (
                  <Button
                    onClick={async () => {
                      resetForm()
                      setIsAddingNew(true)
                      await applySoleServiceProviderToForm()
                    }}
                  >
                    <Plus className="w-4 h-4 mr-1" /> Add Company
                  </Button>
                ) : undefined
              }
            />
          </>
          )}
        </>
      )}
    </div>
  )
}