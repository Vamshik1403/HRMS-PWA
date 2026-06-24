"use client"

import { useState, useEffect, useRef } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "../components/ui/card"
import { Button } from "../components/ui/button"
import { Input } from "../components/ui/input"
import { Label } from "../components/ui/label"
import { Textarea } from "../components/ui/textarea"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "../components/ui/table"
import { Badge } from "../components/ui/badge"
import { Icon } from "@iconify/react"
import { Plus, Search, Edit, Trash2, Eye, ArrowLeft, X, Save, ChevronDown, FileText, Shield, Settings, UserPlus } from "lucide-react"
import { useCurrentUser } from "../hooks/useCurrentUser"
import { useRouter } from "next/navigation"
import { TimezoneSelect } from "../components/ui/timezone-select"
import { LocationFields } from "../components/ui/location-fields"
import { SearchSuggestInput } from "../components/SearchSuggestInput"
import { fetchCurrencies } from "../utils/geoApi"
import { PdfUploadField } from "../components/PdfUploadField"
import { ListAreaSkeleton } from "../components/ui/TableBodySkeleton"
import { toast } from "sonner"
import { getSidebarContext } from "../utils/sidebarContext"
import { isDesktopManagerFlagSet } from "@/lib/desktopManager"
import {
  canDesktopManagerManage,
  filterCompaniesForUser,
} from "../utils/scopeContext"
import { FormDrawer } from "../components/ui/form-drawer"

interface Company {
  id: number
  serviceProviderID?: number
  companyName?: string
  companyType?: string

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
  role: "COMPANY_ADMIN",
  firstName: "",
  lastName: "",
  contactNo: "",
  email: "",
  serviceProviderID: "" as string | number,
  companyID: "" as string | number,
  isActive: true,
}

export function CompanyManagement() {
  const router = useRouter()
  const [companies, setCompanies] = useState<Company[]>([])
  const [listLoading, setListLoading] = useState(true)
  const [desktopManager, setDesktopManager] = useState(false)
  const [searchTerm, setSearchTerm] = useState("")
  const [editingCompany, setEditingCompany] = useState<Company | null>(null)
  const [viewCompany, setViewCompany] = useState<Company | null>(null)
  const [serviceProviders, setServiceProviders] = useState<ServiceProvider[]>([])
  const [spDropdownOpen, setSpDropdownOpen] = useState(false)
  const [logoFile, setLogoFile] = useState<File | null>(null)
  const [signatureFile, setSignatureFile] = useState<File | null>(null)
  const [isAddingNew, setIsAddingNew] = useState(false)
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

  const user = useCurrentUser()


  useEffect(() => {
    setDesktopManager(isDesktopManagerFlagSet())
  }, [user?.id])

  const isDesktopManager = desktopManager && user?.role === "EMPLOYEE"
  const canManage = user?.role === "SUPERADMIN" || user?.role === "SERVICE_PROVIDER" || user?.role === "COMPANY_ADMIN" || user?.role === "ADMIN" || canDesktopManagerManage(user)
  const isNonSuperAdmin = user?.role === "SERVICE_PROVIDER" || user?.role === "COMPANY_ADMIN" || user?.role === "ADMIN" || user?.role === "BRANCH_ADMIN" || isDesktopManager
  const isSuperAdmin = user?.role === "SUPERADMIN"
  const isCompanyProfileOnly = user?.role === "COMPANY_ADMIN" || user?.role === "ADMIN" || isDesktopManager

  interface CompanyFormData extends Partial<Company> {
    autocompleteName?: string
  }

    const [formData, setFormData] = useState<CompanyFormData>({
    companyName: "",
    companyType: "",
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

  useEffect(() => {
    const handler = () => { if (user) fetchCompanies() }
    window.addEventListener("sidebar-context-changed", handler)
    window.addEventListener("app-data-refresh", handler)
    return () => {
      window.removeEventListener("sidebar-context-changed", handler)
      window.removeEventListener("app-data-refresh", handler)
    }
  }, [user])

  // For non-SUPERADMIN users, auto-open edit form with their company
  useEffect(() => {
    if (isNonSuperAdmin && companies.length > 0 && !isAddingNew && !editingCompany) {
      const company = companies[0] as any
      setServiceProviders([])
      setSpDropdownOpen(false)
      setFormData({
        ...company,
        serviceProviderID: company.serviceProviderID,
        autocompleteName: company.serviceProvider?.companyName || "",
      })
      setEditingCompany(company)
      setIsAddingNew(true)
    }
  }, [companies, isNonSuperAdmin])

  const fetchCompanies = async () => {
    setListLoading(true)
    try {
      const res = await fetch("/backend/company")
      const json = await res.json()
      const all = Array.isArray(json) ? json : json.data ?? []
      setCompanies(await filterCompaniesForUser(all, user))
    } catch (error) {
      console.error("Failed to load companies:", error)
      setCompanies([])
    } finally {
      setListLoading(false)
    }
  }

  // Fetch service providers for autocomplete
  const fetchServiceProviders = async (query: string) => {
    try {
      const res = await fetch("/backend/service-provider")
      const data = await res.json()
      const filtered = data.filter((sp: ServiceProvider) =>
        sp.companyName.toLowerCase().includes(query.toLowerCase())
      )
      setServiceProviders(filtered)
    } catch (error) {
      console.error("Error fetching service providers:", error)
    }
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
      let SignatureUrl = formData.SignatureUrl || "";

      if (logoFile) {
        companyLogoUrl = await uploadImage(logoFile);
      }
      if (signatureFile) {
        SignatureUrl = await uploadImage(signatureFile);
      }

      const { autocompleteName, id, ...formDataWithoutAutocomplete } = formData;
      const { serviceProvider, ...cleanFormData } = formDataWithoutAutocomplete as any;

      // Validate serviceProviderID exists in DB before submitting to avoid FK constraint errors
      let resolvedServiceProviderID: number | undefined = formData.serviceProviderID || undefined;
      if (resolvedServiceProviderID) {
        try {
          const spCheck = await fetch(`/backend/service-provider/${resolvedServiceProviderID}`);
          if (!spCheck.ok) resolvedServiceProviderID = undefined;
        } catch {
          resolvedServiceProviderID = undefined;
        }
      }

      const finalData = {
        ...cleanFormData,
        companyName: formData.companyName || formData.autocompleteName || "",
        serviceProviderID: resolvedServiceProviderID,
        companyLogoUrl: companyLogoUrl || undefined,
        SignatureUrl: SignatureUrl || undefined,
      };

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
      if (!isNonSuperAdmin) {
        resetForm();
        setIsAddingNew(false);
        setEditingCompany(null);
      } else {
        // Reset editing state so useEffect re-triggers with fresh data
        setEditingCompany(null);
        setIsAddingNew(false);
      }
      toast.success("Company saved successfully");
      window.dispatchEvent(new Event("sidebar-refresh"));
    } catch (error) {
      console.error(error);
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
      role: "COMPANY_ADMIN",
      firstName: user.firstName || "",
      lastName: user.lastName || "",
      contactNo: user.contactNo || "",
      email: user.email || "",
      serviceProviderID: selectedCompanyForAdmin?.serviceProviderID || "",
      companyID: selectedCompanyForAdmin?.id || "",
      isActive: user.isActive,
    })
  }

const handleDeleteCompanyAdmin = async (id: number) => {
  if (!confirm("Delete this Company Admin user?")) return

  try {
    const res = await fetch(`/backend/users/${id}`, {
      method: "DELETE",
    })

    if (!res.ok) {
      const errText = await res.text()
      throw new Error(errText || "Failed to delete Company Admin")
    }

    toast.success("Company Admin deleted successfully")

    if (editingCompanyAdmin?.id === id) {
      setEditingCompanyAdmin(null)
      setCompanyAdminForm({
        ...emptyCompanyAdminForm,
        role: "COMPANY_ADMIN",
        serviceProviderID: selectedCompanyForAdmin?.serviceProviderID || "",
        companyID: selectedCompanyForAdmin?.id || "",
        isActive: true,
      })
    }

    if (selectedCompanyForAdmin) {
      await fetchCompanyAdminUsers(selectedCompanyForAdmin)
    }
  } catch (error: any) {
    toast.error(error?.message || "Failed to delete Company Admin")
  }
}

  const handleEdit = (company: Company & { serviceProvider?: ServiceProvider }) => {
    setServiceProviders([])
    setSpDropdownOpen(false)
    setFormData({
      ...company,
      serviceProviderID: company.serviceProviderID,
      autocompleteName: company.serviceProvider?.companyName || "",
    })
    setEditingCompany(company)
    setIsAddingNew(true)
    setIsViewing(false)
  }

  const handleView = (company: Company) => {
    setViewCompany(company)
    setIsViewing(true)
    setIsAddingNew(false)
  }

  const handleDelete = async (id: number) => {
    if (confirm("Are you sure you want to delete this company?")) {
      try {
        await fetch(`/backend/company/${id}`, { method: "DELETE" })
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
    setSignatureFile(null)
    setEditingCompany(null)
    setServiceProviders([])
    setSpDropdownOpen(false)
  }

  const handleCancel = () => {
    resetForm()
    setIsAddingNew(false)
    setIsViewing(false)
    setViewCompany(null)
  }

  const handleBack = () => {
    router.push('/company')
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

  const filteredCompanies = companies.filter(
    (c) =>
      c.companyName?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      c.country?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      c.emailAdd?.toLowerCase().includes(searchTerm.toLowerCase())
  )

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

      const res = await fetch("/backend/users")
      const data = await res.json()
      const users = Array.isArray(data) ? data : data?.data ?? []

      const filtered = users.filter(
        (u: CompanyAdminUser) =>
          Number(u.companyID) === Number(company.id) &&
          u.role === "COMPANY_ADMIN"
      )

      setCompanyAdminUsers(filtered)
    } catch (error) {
      console.error("Failed to fetch company admin users:", error)
      setCompanyAdminUsers([])
    } finally {
      setCompanyAdminLoading(false)
    }
  }

  const openCompanyAdminDrawer = async (company: Company) => {
    setSelectedCompanyForAdmin(company)

    setCompanyAdminForm({
      ...emptyCompanyAdminForm,
      role: "COMPANY_ADMIN",
      serviceProviderID: company.serviceProviderID || "",
      companyID: company.id,
      isActive: true,
    })

    setCompanyAdminDrawerOpen(true)
    await fetchCompanyAdminUsers(company)
  }

    const closeCompanyAdminPanel = () => {
    setCompanyAdminDrawerOpen(false)
    setSelectedCompanyForAdmin(null)
    setCompanyAdminUsers([])
    setCompanyAdminForm({ ...emptyCompanyAdminForm })
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
      const payload: any = {
        username: companyAdminForm.username.trim(),
        role: "COMPANY_ADMIN",
        firstName: companyAdminForm.firstName || null,
        lastName: companyAdminForm.lastName || null,
        contactNo: companyAdminForm.contactNo || null,
        email: companyAdminForm.email || null,
        serviceProviderID: selectedCompanyForAdmin.serviceProviderID || null,
        companyID: selectedCompanyForAdmin.id,
        companyIDs: [selectedCompanyForAdmin.id],
        branchesID: null,
        isActive: companyAdminForm.isActive,
      }

      if (companyAdminForm.password.trim()) {
        payload.password = companyAdminForm.password
      }

      const isEdit = Boolean(editingCompanyAdmin?.id)

      const res = await fetch(
        isEdit ? `/backend/users/${editingCompanyAdmin?.id}` : "/backend/users",
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
              ? "Failed to update company admin"
              : "Failed to create company admin")
        )
      }

      toast.success(
        isEdit
          ? "Company admin updated successfully"
          : "Company admin created successfully"
      )

      setEditingCompanyAdmin(null)
      setCompanyAdminForm({
        ...emptyCompanyAdminForm,
        role: "COMPANY_ADMIN",
        serviceProviderID: selectedCompanyForAdmin.serviceProviderID || "",
        companyID: selectedCompanyForAdmin.id,
        isActive: true,
      })

      await fetchCompanyAdminUsers(selectedCompanyForAdmin)
    } catch (error: any) {
      console.error(error)
      toast.error(error?.message || "Failed to save company admin")
    } finally {
      setCompanyAdminSaving(false)
    }
  }

  return (
    <div className="space-y-6 w-full max-w-7xl mx-auto px-4">

      {/* Header with Dropdown */}
      <div className="flex items-center justify-between w-full">
        <div className="min-w-0 flex-1">
          <p className="text-gray-600 mt-1 text-sm">Manage registered companies</p>
        </div>

        <div className="flex items-center gap-3">
          {/* Compliance Dropdown */}

          {!isAddingNew && !isViewing && user?.role === "SUPERADMIN" && (
            <Button
              onClick={() => {
                resetForm()
                // Auto-populate serviceProviderID from sidebar context
                const ctx = getSidebarContext()
                if (ctx?.serviceProviderID) {
                  setFormData(prev => ({
                    ...prev,
                    serviceProviderID: ctx.serviceProviderID,
                    autocompleteName: ctx.serviceProviderName || "",
                  }))
                }
                setIsAddingNew(true)
              }}
              className="text-sm px-3 py-2"
            >
              <Plus className="w-4 h-4 mr-1" /> Add Company
            </Button>
          )}
        </div>
      </div>

      {/* Add/Edit Form - Drawer */}
      <FormDrawer
        open={isAddingNew}
        onOpenChange={(v) => { if (!v) handleCancel(); }}
        title={editingCompany ? "Edit Company" : "Add New Company"}
      >
        <div>
          <form onSubmit={handleSubmit} className="space-y-4">
            {/* Company Name with Service Provider Autocomplete - auto-filled from sidebar */}
            {user?.role !== "COMPANY_ADMIN" && user?.role !== "ADMIN" && (
              <div ref={wrapperRef} className="space-y-2 relative">
                <Label>Service Provider *</Label>
                <Input
                  value={formData.autocompleteName || ""}
                  onChange={(e) => {
                    const val = e.target.value
                    setFormData((p) => ({ ...p, autocompleteName: val }))
                    if (val.length > 1) {
                      fetchServiceProviders(val)
                      setSpDropdownOpen(true)
                    } else {
                      setServiceProviders([])
                      setSpDropdownOpen(false)
                    }
                  }}
                  onFocus={() => setSpDropdownOpen(false)}
                  placeholder="Start typing service provider..."
                  autoComplete="off"
                />
                {spDropdownOpen && serviceProviders.length > 0 && (
                  <div className="absolute z-10 bg-white border rounded w-full shadow max-h-40 overflow-y-auto">
                    {serviceProviders.map((sp) => (
                      <div
                        key={sp.id}
                        className="px-3 py-2 hover:bg-gray-100 cursor-pointer"
                        onMouseDown={(e) => e.preventDefault()}
                        onClick={() => {
                          setFormData((p) => ({
                            ...p,
                            serviceProviderID: sp.id,
                            autocompleteName: sp.companyName,
                          }))
                          setServiceProviders([])
                          setSpDropdownOpen(false)
                        }}
                      >
                        {sp.companyName}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}

            <div className="space-y-2">
              <Label>Company Name</Label>
              <Input
                value={formData.companyName || ""}
                onChange={(e) => setFormData((p) => ({ ...p, companyName: e.target.value }))}
                placeholder="Enter company name manually"
              />
            </div>

            <div className="space-y-2">
              <Label>Company Type</Label>
              <div className="flex flex-wrap gap-3">
                {["office", "shop", "factory"].map((type) => {
                  const selected = (formData.companyType || "").split(",").map(s => s.trim()).filter(Boolean);
                  const isChecked = selected.includes(type);
                  return (
                    <label key={type} className="flex items-center gap-2 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={isChecked}
                        onChange={(e) => {
                          const current = (formData.companyType || "").split(",").map(s => s.trim()).filter(Boolean);
                          const updated = e.target.checked
                            ? [...current, type]
                            : current.filter(v => v !== type);
                          setFormData((p) => ({ ...p, companyType: updated.join(", ") }));
                        }}
                        className="w-4 h-4"
                      />
                      <span className="capitalize">{type}</span>
                    </label>
                  );
                })}
              </div>
            </div>





            <div className="space-y-2">
              <Label>Company Address</Label>
              <Textarea
                value={formData.address || ""}
                onChange={(e) => setFormData((p) => ({ ...p, address: e.target.value }))}
                rows={3}
              />
            </div>

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

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Time Zone</Label>
                <TimezoneSelect
                  value={formData.timeZone || ""}
                  onChange={(value) => setFormData((p) => ({ ...p, timeZone: value }))}
                />
              </div>
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

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-2"><Label>PF No</Label><Input value={formData.pfNo || ""} onChange={(e) => setFormData((p) => ({ ...p, pfNo: e.target.value }))} /></div>
              <div className="space-y-2"><Label>TAN No</Label><Input value={formData.tanNo || ""} onChange={(e) => setFormData((p) => ({ ...p, tanNo: e.target.value }))} /></div>
              <div className="space-y-2"><Label>PAN No</Label><Input value={formData.panNo || ""} onChange={(e) => setFormData((p) => ({ ...p, panNo: e.target.value }))} /></div>
              <div className="space-y-2"><Label>ESI No</Label><Input value={formData.esiNo || ""} onChange={(e) => setFormData((p) => ({ ...p, esiNo: e.target.value }))} /></div>
              <div className="space-y-2"><Label>LIN No</Label><Input value={formData.linNo || ""} onChange={(e) => setFormData((p) => ({ ...p, linNo: e.target.value }))} /></div>
              <div className="space-y-2 sm:col-span-2">
                <Label>GST No</Label>
                <Input value={formData.gstNo || ""} onChange={(e) => setFormData((p) => ({ ...p, gstNo: e.target.value }))} />
                <PdfUploadField
                  label="GST certificate (PDF)"
                  value={formData.gstCertUrl}
                  onChange={(url) => setFormData((p) => ({ ...p, gstCertUrl: url ?? "" }))}
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label>Financial Year Start</Label>
              <select
                className="w-full rounded-md border px-3 py-2"
                value={formData.financialYearStart || ""}
                onChange={(e) =>
                  setFormData((p) => ({ ...p, financialYearStart: e.target.value }))
                }
              >
                <option value="">-- Select Start Date --</option>
                <option value="1st Jan">1st Jan</option>
                <option value="1st April">1st April</option>
              </select>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Contact Number</Label>
                <Input value={formData.contactNo || ""} onChange={(e) => setFormData((p) => ({ ...p, contactNo: e.target.value }))} />
              </div>
              <div className="space-y-2">
                <Label>Email Address</Label>
                <Input type="email" value={formData.emailAdd || ""} onChange={(e) => setFormData((p) => ({ ...p, emailAdd: e.target.value }))} />
              </div>
            </div>

            <div className="space-y-2">
              <Label>Company Logo</Label>
              <Input type="file" accept="image/*" onChange={(e) => setLogoFile(e.target.files?.[0] || null)} />
            </div>
            <div className="space-y-2">
              <Label>Signature Upload</Label>
              <Input type="file" accept="image/*" onChange={(e) => setSignatureFile(e.target.files?.[0] || null)} />
            </div>

            <div className="flex justify-end gap-2 pt-4">
           
              <Button
                type="submit"
                disabled={saving}
                className="">
                <Save className="w-4 h-4 mr-1" />
                {editingCompany ? "Update Company" : "Add Company"}
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
      >
        {viewCompany && (
          <div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div><strong>Name:</strong> {viewCompany.companyName}</div>
              <div><strong>Type:</strong> {viewCompany.companyType}</div>
              <div><strong>Address:</strong> {viewCompany.address}</div>
              <div><strong>Country:</strong> {viewCompany.country}</div>
              <div><strong>State:</strong> {viewCompany.state}</div>
              <div><strong>City:</strong> {viewCompany.city || "—"}</div>
              <div><strong>Pincode:</strong> {viewCompany.pincode || "—"}</div>
              <div><strong>GST No:</strong> {viewCompany.gstNo}</div>
              <div><strong>Contact:</strong> {viewCompany.contactNo}</div>
              <div><strong>Email:</strong> {viewCompany.emailAdd}</div>
              <div><strong>Currency:</strong> {viewCompany.currency}</div>
              <div><strong>TimeZone:</strong> {viewCompany.timeZone}</div>
              <div><strong>PF:</strong> {viewCompany.pfNo}</div>
              <div><strong>TAN:</strong> {viewCompany.tanNo}</div>
              <div><strong>PAN:</strong> {viewCompany.panNo}</div>
              <div><strong>ESI:</strong> {viewCompany.esiNo}</div>
              <div><strong>LIN:</strong> {viewCompany.linNo}</div>
              <div><strong>Shop Reg:</strong> {viewCompany.shopRegNo}
                {(viewCompany as any).shopRegCertHistory && Array.isArray((viewCompany as any).shopRegCertHistory) && (viewCompany as any).shopRegCertHistory.length > 0 && (
                  <div className="mt-1 text-xs text-gray-500">
                    {(viewCompany as any).shopRegCertHistory.map((h: any, i: number) => (
                      <div key={i}>{h.certNo} — WEF {h.effectFrom || "—"}</div>
                    ))}
                  </div>
                )}
              </div>
              <div><strong>FY Start:</strong> {viewCompany.financialYearStart}</div>
            </div>
            <div className="flex gap-4 mt-4">
              {viewCompany.companyLogoUrl && (
                <div>
                  <strong>Logo:</strong>
                  <img src={viewCompany.companyLogoUrl} alt="Company Logo" className="w-24 h-24 object-contain border rounded" />
                </div>
              )}
              {viewCompany.SignatureUrl && (
                <div>
                  <strong>Signature:</strong>
                  <img src={viewCompany.SignatureUrl} alt="Signature" className="w-24 h-24 object-contain border rounded" />
                </div>
              )}
            </div>
          </div>
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

      {isCompanyProfileOnly && !isAddingNew && listLoading && (
        <ListAreaSkeleton rows={6} />
      )}

      {companyAdminDrawerOpen && selectedCompanyForAdmin && (
        <Card className="w-full border border-gray-200 shadow-sm">
          <CardHeader className="border-b bg-white">
            <div className="flex items-start justify-between gap-4">
              <div>
                <CardTitle className="flex items-center gap-2 text-xl">
                  <UserPlus className="w-5 h-5 text-indigo-600" />
                  Company Admin Users
                </CardTitle>
                <p className="text-sm text-gray-500 mt-1">
                  Create and view admin users for selected company.
                </p>
              </div>

              <Button
                type="button"
                variant="outline"
                onClick={closeCompanyAdminPanel}
              >
                <X className="w-4 h-4 mr-2" />
                Back to Companies
              </Button>
            </div>
          </CardHeader>

          <CardContent className="p-6 space-y-6">
            <div className="rounded-xl border bg-indigo-50/60 px-4 py-3">
              <p className="text-sm text-gray-500">Selected Company</p>
              <p className="text-base font-semibold text-gray-900">
                {selectedCompanyForAdmin.companyName || "—"}
              </p>
            </div>

            <form
              onSubmit={createCompanyAdminUser}
              className="rounded-xl border bg-white p-5 space-y-5"
            >
              <div>
                <h3 className="text-base font-semibold text-gray-900">
{editingCompanyAdmin
  ? "Update Company Admin"
  : "Create Company Admin"}
                  </h3>
                <p className="text-sm text-gray-500">
{editingCompanyAdmin
  ? "Update COMPANY_ADMIN user details. Leave password blank to keep existing password."
  : "This user will get COMPANY_ADMIN role for this company only."}
  
                  </p>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
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
          role: "COMPANY_ADMIN",
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
    ? "Update Company Admin"
    : "Create Company Admin"}
    
                    </Button>
              </div>
            </form>

            <div className="rounded-xl border bg-white overflow-hidden">
              <div className="px-5 py-4 border-b">
                <h3 className="text-base font-semibold text-gray-900">
                  Existing Company Admin Users
                </h3>
                <p className="text-sm text-gray-500">
                  Only COMPANY_ADMIN users for this company are listed here.
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
                        No company admin users found
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
          </CardContent>
        </Card>
      )}

      {!isAddingNew && !isViewing && !isCompanyProfileOnly && !companyAdminDrawerOpen && (<>
          <Card>
          <CardContent className="p-6 flex items-center space-x-4">
            <div className="relative flex-1 min-w-0">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
              <Input
                placeholder="Search companies..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-10 w-full"
              />
            </div>
            <Badge variant="secondary" className="px-3 py-1 flex-shrink-0">
              {filteredCompanies.length} companies
            </Badge>
          </CardContent>
        </Card>

       
        <Card className="w-full">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Icon icon="mdi:office-building" className="w-5 h-5" /> Company List
            </CardTitle>
          </CardHeader>
          <CardContent className="p-0 w-full overflow-x-auto">
            <Table className="w-full">
              <TableHeader>
                <TableRow>
                  <TableHead>Name</TableHead>
                  <TableHead>Country</TableHead>
                  <TableHead>State</TableHead>
                  <TableHead>Email</TableHead>
                  <TableHead>Contact</TableHead>
                  <TableHead>GST</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredCompanies.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={7} className="text-center py-8 text-gray-500">
                      <div className="flex flex-col items-center gap-2">
                        <Icon icon="mdi:account-search" className="w-12 h-12 text-gray-300" />
                        <p>No companies found</p>
                        <p className="text-sm">Try adjusting your search criteria</p>
                      </div>
                    </TableCell>
                  </TableRow>
                ) : (
                  filteredCompanies.map((company) => (
                    <TableRow key={company.id}>
                      <TableCell>{company.companyName}</TableCell>
                      <TableCell>{company.country}</TableCell>
                      <TableCell>{company.state}</TableCell>
                      <TableCell>{company.emailAdd}</TableCell>
                      <TableCell>{company.contactNo}</TableCell>
                      <TableCell>{company.gstNo}</TableCell>
                      <TableCell className="text-right">
                        <div className="flex items-center justify-end gap-1">
                           
                          {isSuperAdmin && (
                            <Button
                              variant="ghost"
                              size="sm"
                              title="Company Admin Users"
                              onClick={() => openCompanyAdminDrawer(company)}
                            >
                              <UserPlus className="w-4 h-4 text-indigo-600" />
                            </Button>
                          )}
                          
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => openModuleDrawer(company)}
                            className="h-7 w-7 p-0 text-blue-600 hover:text-blue-700 hover:bg-blue-50"
                            title="Manage company modules"
                          >
                            <Settings className="w-3 h-3" />
                          </Button>

                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleView(company)}
                            className="h-7 w-7 p-0"
                          >
                            <Eye className="w-3 h-3" />
                          </Button>

                          {(user?.role === "SUPERADMIN" || user?.role === "SERVICE_PROVIDER" || user?.role === "COMPANY_ADMIN") && (
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => handleEdit(company)}
                              className="h-7 w-7 p-0"
                            >
                              <Edit className="w-3 h-3" />
                            </Button>
                          )}

                          {user?.role === "SUPERADMIN" && (
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => handleDelete(company.id)}
                              className="h-7 w-7 p-0 text-red-600 hover:text-red-700 hover:bg-red-50"
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
          </CardContent>
        </Card>
      </>
    )}

      
    </div>
  )
}