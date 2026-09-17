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
import { LocationFields } from "../components/ui/location-fields"
import { PdfUploadField } from "../components/PdfUploadField"
import { ListAreaSkeleton } from "../components/ui/TableBodySkeleton"
import { toast } from "sonner"
import { isPasswordValid, PASSWORD_POLICY_MESSAGE } from "@/lib/passwordRules"
import { PasswordRuleHints } from "../components/ui/password-rule-hints"
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
  mapCompanyToFormData,
} from "../utils/companyFormPayload"
import { LEGAL_ENTITY_OPTIONS, ownerTitleForLegalEntity, defaultUserTypeForEntity, userTypeOptionsForEntity } from "@/lib/companyAccess"
import { cn } from "@/app/utils/cn"
import { FormSection } from "../components/ui/form-section"
import { FormField } from "../components/ui/form-field"
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
  website?: string
  gstRegistrationType?: string
  businessTradeName?: string
  shopRegNo?: string
  shopRegCertHistory?: { certNo: string; effectFrom: string; _localId: string }[]
  financialYearStart?: string
  contactNo?: string
  emailAdd?: string
  companyLogoUrl?: string
  SignatureUrl?: string
  createdAt?: string
  subscriptions?: {
    startDate?: string
    endDate?: string
    plan?: { planName?: string } | null
  }[]
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
  salutation?: string | null
  phone?: string | null
  serviceProviderID?: number | null
  contactNo?: string | null
  email?: string | null
  isActive: boolean
  companyID?: number | null
  company?: { id?: number; companyName?: string } | null
}

type OwnerPermissionRow = {
  moduleKey: string
  canView: boolean
  canCreate: boolean
  canEdit: boolean
  canDelete: boolean
}

type ModuleMeta = { moduleKey: string; label: string }

type PrimaryContactRow = {
  _localId: string
  title: string
  firstName: string
  lastName: string
  username: string
  email: string
  phone: string
  mobile: string
  designation: string
  designationOther: string
  setAsCompanyAdmin: boolean
}

const CONTACT_TITLE_OPTIONS = ["Mr", "Mrs", "Ms", "Dr", "Mx"]

const emptyPrimaryContact = (): PrimaryContactRow => ({
  _localId: `pc-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
  title: "",
  firstName: "",
  lastName: "",
  username: "",
  email: "",
  phone: "",
  mobile: "",
  designation: "",
  designationOther: "",
  setAsCompanyAdmin: false,
})

function apiErrorMessage(raw: unknown, fallback: string): string {
  const text = typeof raw === "string" ? raw.trim() : ""
  if (!text) return fallback

  const fromParsed = (parsed: any): string | null => {
    const msg = parsed?.message
    if (Array.isArray(msg)) {
      const joined = msg.map((item) => String(item || "").trim()).filter(Boolean).join(". ")
      return joined || null
    }
    if (typeof msg === "string" && msg.trim()) return msg.trim()
    return null
  }

  try {
    const parsed = JSON.parse(text)
    const extracted = fromParsed(parsed)
    if (extracted) return extracted
  } catch {
    const messageMatch = text.match(/"message"\s*:\s*"([^"]+)"/)
    if (messageMatch?.[1]) return messageMatch[1]
    const arrayMatch = text.match(/"message"\s*:\s*\[([^\]]+)\]/)
    if (arrayMatch?.[1]) {
      const items = arrayMatch[1]
        .split(",")
        .map((part) => part.replace(/["']/g, "").trim())
        .filter(Boolean)
      if (items.length) return items.join(". ")
    }
  }

  if (text.length > 280 || /statusCode|stack|"error"/.test(text)) return fallback
  return text
}

function formatCompanyDate(value?: string | Date | null) {
  if (!value) return "—"
  const d = new Date(value)
  if (Number.isNaN(d.getTime())) return "—"
  return d.toLocaleDateString()
}

function latestSubscription(company: Company) {
  return company.subscriptions?.[0] || null
}

function fullPermissionRows(modules: ModuleMeta[]): OwnerPermissionRow[] {
  return modules.map((m) => ({
    moduleKey: m.moduleKey,
    canView: true,
    canCreate: true,
    canEdit: true,
    canDelete: true,
  }))
}

function resolvedDesignation(row: { designation: string; designationOther: string }) {
  if (row.designation === "Other") return row.designationOther.trim()
  return row.designation.trim()
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
  title: "",
  firstName: "",
  lastName: "",
  phone: "",
  contactNo: "",
  email: "",
  designation: "",
  designationOther: "",
  serviceProviderID: "" as string | number,
  companyID: "" as string | number,
  isActive: true,
  useEmailMobileCreds: false,
}

function digitsOnly(value?: string | null): string {
  return String(value || "").replace(/\D/g, "")
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
  const [companyFormTab, setCompanyFormTab] = useState("general")
  const [primaryContacts, setPrimaryContacts] = useState<PrimaryContactRow[]>([emptyPrimaryContact()])
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
  const [viewingCompanyAdmin, setViewingCompanyAdmin] = useState(false)
  const [companyAdminFormTab, setCompanyAdminFormTab] = useState("general")
  const [ownerModules, setOwnerModules] = useState<ModuleMeta[]>([])
  const [ownerPermissions, setOwnerPermissions] = useState<OwnerPermissionRow[]>([])
  const [usernameCheck, setUsernameCheck] = useState<{
    status: "idle" | "checking" | "ok" | "taken"
    message: string
  }>({ status: "idle", message: "" })
  const usernameCheckTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const savingRef = useRef(false)

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
    website: "",
    gstRegistrationType: "",
    businessTradeName: "",
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
    setViewingCompanyAdmin(false)
    setCompanyAdminFormTab("general")
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

    if (savingRef.current) return;

    if ((formData as any).gstRegistrationType === "Registered" && !String(formData.gstNo || "").trim()) {
      toast.error("GSTIN is required for Registered companies")
      return
    }

    const filledContacts = primaryContacts.filter((row) =>
      [row.email, row.mobile, row.firstName, row.lastName, row.username].some((v) => String(v || "").trim()),
    )
    for (const row of filledContacts) {
      if (!row.email.trim() || !row.mobile.trim()) {
        toast.error("Each filled primary contact requires Email and Mobile")
        return
      }
      if (row.designation === "Other" && !row.designationOther.trim()) {
        toast.error("Specify designation for contacts marked Other")
        return
      }
    }

    savingRef.current = true;
    setSaving(true);

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
        primaryContacts: filledContacts.map((row) => ({
          title: row.title.trim() || undefined,
          firstName: row.firstName.trim() || undefined,
          lastName: row.lastName.trim() || undefined,
          username: row.username.trim() || row.email.trim(),
          email: row.email.trim(),
          phone: row.phone.trim() || undefined,
          mobile: row.mobile.trim(),
          designation: resolvedDesignation(row) || undefined,
          setAsCompanyAdmin: !!row.setAsCompanyAdmin,
        })),
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

      if (!res.ok) {
        throw new Error(apiErrorMessage(await res.text(), "Failed to save company"));
      }

      await fetchCompanies();
        resetForm();
        setIsAddingNew(false);
        setEditingCompany(null);
      toast.success("Company saved successfully");
      window.dispatchEvent(new Event("sidebar-refresh"));
    } catch (error) {
      console.error(error);
      const message =
        error instanceof Error ? error.message : "Failed to save company";
      toast.error(apiErrorMessage(message, "Failed to save company"));
    } finally {
      savingRef.current = false;
      setSaving(false);
    }
  };

  const loadOwnerPermissionGrid = async (ownerId?: number) => {
    try {
      const modRes = await fetch("/backend/employee-permissions/modules")
      const modules = modRes.ok ? await modRes.json() : []
      const list: ModuleMeta[] = Array.isArray(modules) ? modules : []
      setOwnerModules(list)

      if (ownerId && selectedCompanyForAdmin?.id) {
        const permRes = await fetch(
          `/backend/company/${selectedCompanyForAdmin.id}/owner/${ownerId}/permissions`,
        )
        if (permRes.ok) {
          const data = await permRes.json()
          if (Array.isArray(data?.permissions) && data.permissions.length) {
            setOwnerPermissions(data.permissions)
            return
          }
        }
      }
      setOwnerPermissions(fullPermissionRows(list))
    } catch {
      setOwnerModules([])
      setOwnerPermissions([])
    }
  }

  const toggleOwnerPerm = (
    moduleKey: string,
    action: "read" | "write" | "delete" | "admin",
  ) => {
    if (viewingCompanyAdmin) return
    setOwnerPermissions((rows) =>
      rows.map((row) => {
        if (row.moduleKey !== moduleKey) return row
        if (action === "read") return { ...row, canView: !row.canView }
        if (action === "write") {
          const on = row.canCreate && row.canEdit
          return { ...row, canCreate: !on, canEdit: !on }
        }
        if (action === "delete") return { ...row, canDelete: !row.canDelete }
        const allOn = row.canView && row.canCreate && row.canEdit && row.canDelete
        const next = !allOn
        return { ...row, canView: next, canCreate: next, canEdit: next, canDelete: next }
      }),
    )
  }

  const designationFromTitle = (title?: string | null, legalEntityType?: string | null) => {
    const options = userTypeOptionsForEntity(legalEntityType)
    const value = (title || "").trim()
    if (!value) return { designation: defaultUserTypeForEntity(legalEntityType) || "", designationOther: "" }
    if (options.includes(value) && value !== "Other") {
      return { designation: value, designationOther: "" }
    }
    return { designation: "Other", designationOther: value }
  }

  const handleViewCompanyAdmin = async (user: CompanyAdminUser) => {
    setEditingCompanyAdmin(user)
    setViewingCompanyAdmin(true)
    const desg = designationFromTitle(user.ownerTitle, selectedCompanyForAdmin?.legalEntityType)
    setCompanyAdminForm({
      ...emptyCompanyAdminForm,
      username: user.username || "",
      password: "",
      role: "COMPANY_OWNER",
      title: user.salutation || "",
      firstName: user.firstName || "",
      lastName: user.lastName || "",
      phone: user.phone || "",
      contactNo: user.contactNo || "",
      email: user.email || "",
      designation: desg.designation,
      designationOther: desg.designationOther,
      serviceProviderID: selectedCompanyForAdmin?.serviceProviderID || "",
      companyID: selectedCompanyForAdmin?.id || "",
      isActive: user.isActive,
    })
    setCompanyAdminFormTab("general")
    setCompanyAdminFormOpen(true)
    await loadOwnerPermissionGrid(user.id)
  }

  const handleEditCompanyAdmin = async (user: CompanyAdminUser) => {
    setEditingCompanyAdmin(user)
    setViewingCompanyAdmin(false)

    const desg = designationFromTitle(
      (user as any).ownerTitle || selectedCompanyForAdmin?.defaultOwnerTitle,
      selectedCompanyForAdmin?.legalEntityType,
    )

    setCompanyAdminForm({
      ...emptyCompanyAdminForm,
      username: user.username || "",
      password: "",
      role: "COMPANY_OWNER",
      title: user.salutation || "",
      firstName: user.firstName || "",
      lastName: user.lastName || "",
      phone: user.phone || "",
      contactNo: user.contactNo || "",
      email: user.email || "",
      designation: desg.designation,
      designationOther: desg.designationOther,
      serviceProviderID: selectedCompanyForAdmin?.serviceProviderID || "",
      companyID: selectedCompanyForAdmin?.id || "",
      isActive: user.isActive,
    })
    setCompanyAdminFormTab("general")
    setCompanyAdminFormOpen(true)
    await loadOwnerPermissionGrid(user.id)
  }

  const handleDeleteCompanyAdmin = async (id: number) => {
    if (!selectedCompanyForAdmin?.id) return
    if (!confirm("Deactivate this Company Admin?")) return

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
    setCompanyFormTab("general")
    setPrimaryContacts([emptyPrimaryContact()])
    await applySoleServiceProviderToForm()
  }

  const handleView = (company: Company) => {
    setViewCompany(company)
    setIsViewing(true)
    setIsAddingNew(false)
  }

  const handleDelete = async (id: number) => {
      try {
      const res = await fetch(`/backend/company/${id}`, { method: "DELETE" })
      if (!res.ok) {
        throw new Error(apiErrorMessage(await res.text(), "Failed to delete company"))
      }
        await fetchCompanies()
        toast.success("Company deleted successfully")
      } catch (error) {
        console.error("Error deleting company:", error)
      toast.error(
        apiErrorMessage(
          error instanceof Error ? error.message : "",
          "Failed to delete company",
        ),
      )
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
      website: "",
      gstRegistrationType: "",
      businessTradeName: "",
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
    setCompanyFormTab("general")
    setPrimaryContacts([emptyPrimaryContact()])
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
          c.state?.toLowerCase().includes(t) ||
          c.city?.toLowerCase().includes(t) ||
          c.legalEntityType?.toLowerCase().includes(t))
    )
    return sortRows(list, table.sortBy, table.sortDir, (row, key) => {
      const c = row as Company
      if (key === "companyName") return c.companyName ?? ""
      if (key === "companyType") return LEGAL_ENTITY_OPTIONS.find((o) => o.value === c.legalEntityType)?.label ?? c.legalEntityType ?? ""
      if (key === "city") return c.city ?? ""
      if (key === "country") return c.country ?? ""
      if (key === "state") return c.state ?? ""
      if (key === "activePlan") return latestSubscription(c)?.plan?.planName ?? ""
      if (key === "activationDate") return latestSubscription(c)?.startDate ?? ""
      if (key === "expiryDate") return latestSubscription(c)?.endDate ?? ""
      return ""
    })
  }, [companies, table.search, table.sortBy, table.sortDir])

  const companyColumns = useMemo((): DataTableColumn<Company>[] => [
    {
      key: "companyName",
      header: "Company Name",
      sortable: true,
      colSpan: 3,
      cell: (c) => <span className="font-medium">{c.companyName || "—"}</span>,
    },
    {
      key: "companyType",
      header: "Company Type",
      sortable: true,
      colSpan: 2,
      cell: (c) =>
        LEGAL_ENTITY_OPTIONS.find((o) => o.value === c.legalEntityType)?.label ||
        c.legalEntityType ||
        "—",
    },
    {
      key: "city",
      header: "City",
      sortable: true,
      colSpan: 2,
      cell: (c) => c.city || "—",
    },
    {
      key: "state",
      header: "State",
      sortable: true,
      colSpan: 2,
      cell: (c) => c.state || "—",
    },
    {
      key: "country",
      header: "Country",
      sortable: true,
      colSpan: 2,
      cell: (c) => c.country || "—",
    },
    {
      key: "activePlan",
      header: "Active Plan",
      sortable: true,
      colSpan: 2,
      cell: (c) => latestSubscription(c)?.plan?.planName || "—",
    },
    {
      key: "activationDate",
      header: "Activation Date",
      sortable: true,
      colSpan: 2,
      cell: (c) => formatCompanyDate(latestSubscription(c)?.startDate),
    },
    {
      key: "expiryDate",
      header: "Expiry Date",
      sortable: true,
      colSpan: 2,
      cell: (c) => formatCompanyDate(latestSubscription(c)?.endDate),
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
          deleteConfirmMessage="Are you sure you want to delete this company?"
          extra={
            user?.role === "SUPERADMIN" || user?.role === "SERVICE_PROVIDER"
              ? [
                  {
                    icon: UserPlus,
                    title: "Company Admin",
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
          role: "Company Admin",
          firstName: o.employeeFirstName,
          lastName: o.employeeLastName,
          contactNo: o.personalPhoneNo,
          phone: o.businessPhoneNo,
          email: o.businessEmail,
          isActive: o.employeeCredentials?.isActive !== false,
          serviceProviderID: o.serviceProviderID,
          companyID: o.companyID,
          company: o.company,
          ownerTitle: o.ownerTitle,
          salutation: o.salutation,
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
    setViewingCompanyAdmin(false)
    setCompanyAdminFormOpen(false)
    setCompanyAdminFormTab("general")
    setUsernameCheck({ status: "idle", message: "" })
  }

  const applyEmailMobileCreds = (form: typeof emptyCompanyAdminForm) => {
    if (!form.useEmailMobileCreds) return form
    return {
      ...form,
      username: form.email.trim(),
      password: digitsOnly(form.contactNo) || form.contactNo.trim(),
    }
  }

  const checkUsernameAvailable = useCallback(
    (username: string, excludeOwnerId?: number | null) => {
      if (usernameCheckTimer.current) clearTimeout(usernameCheckTimer.current)
      const value = username.trim()
      if (!value) {
        setUsernameCheck({ status: "idle", message: "" })
        return
      }
      setUsernameCheck({ status: "checking", message: "Checking username…" })
      usernameCheckTimer.current = setTimeout(async () => {
        try {
          const params = new URLSearchParams({ username: value })
          if (excludeOwnerId) params.set("excludeOwnerId", String(excludeOwnerId))
          const res = await fetch(`/backend/company/owners/username-available?${params.toString()}`)
          const data = await res.json().catch(() => null)
          if (data?.available) {
            setUsernameCheck({ status: "ok", message: "Username is available" })
          } else {
            setUsernameCheck({
              status: "taken",
              message: data?.message || "Username already exists",
            })
          }
        } catch {
          setUsernameCheck({ status: "idle", message: "" })
        }
      }, 400)
    },
    [],
  )

  const createCompanyAdminUser = async (e: React.FormEvent) => {
    e.preventDefault()

    if (companyAdminSaving) return

    if (!selectedCompanyForAdmin?.id) {
      toast.error("Company not selected")
      return
    }

    if (viewingCompanyAdmin) return

    const form = applyEmailMobileCreds(companyAdminForm)

    if (!form.email.trim()) {
      toast.error("Email is required")
      return
    }

    if (!form.contactNo.trim()) {
      toast.error("Mobile is required")
      return
    }

    if (!form.firstName.trim()) {
      toast.error("First name is required")
      return
    }

    if (form.designation === "Other" && !form.designationOther.trim()) {
      toast.error("Specify designation")
      return
    }

    const isEdit = Boolean(editingCompanyAdmin?.id)

    if (!form.useEmailMobileCreds) {
      if (!form.username.trim()) {
        toast.error("Username is required")
        return
      }
      if (!isEdit && !form.password.trim()) {
        toast.error("Password is required")
        return
      }
    }

    if (form.password && !isPasswordValid(form.password)) {
      toast.error(PASSWORD_POLICY_MESSAGE)
      return
    }

    if (usernameCheck.status === "taken") {
      toast.error(usernameCheck.message || "Username already exists")
      return
    }

    setCompanyAdminSaving(true)

    try {
      const companyId = selectedCompanyForAdmin.id
      const ownerTitle =
        resolvedDesignation(form) ||
        (selectedCompanyForAdmin as any)?.defaultOwnerTitle ||
        ownerTitleForLegalEntity(selectedCompanyForAdmin.legalEntityType) ||
        undefined

      const payload: any = {
        firstName: form.firstName.trim(),
        lastName: form.lastName || undefined,
        username: form.username.trim() || form.email.trim(),
        salutation: form.title || undefined,
        personalPhoneNo: form.contactNo.trim(),
        businessPhoneNo: form.phone.trim() || undefined,
        businessEmail: form.email.trim(),
        isActive: form.isActive,
        isCompanyOwner: true,
        ownerTitle,
        permissions: ownerPermissions,
      }

      if (form.password.trim()) {
        payload.password = form.password
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
        let message = errText
        try {
          const parsed = JSON.parse(errText)
          message = parsed?.message || errText
        } catch {
          /* keep text */
        }
        throw new Error(
          message ||
          (isEdit
            ? "Failed to update company owner"
            : "Failed to create company owner")
        )
      }

      toast.success(
        isEdit
          ? "Company admin updated successfully"
          : "Company admin created — they log in with username"
      )

      setEditingCompanyAdmin(null)
      setViewingCompanyAdmin(false)
      setCompanyAdminFormOpen(false)
      setUsernameCheck({ status: "idle", message: "" })

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
                    { id: "general", label: "General" },
                    { id: "billing", label: "Billing Details" },
                    { id: "contacts", label: "Contact Information" },
                  ]}
                />

                {companyFormTab === "general" && (
                  <>
                <FormSection
                  title="General"
                  description="Core company details and registered address."
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

                  <FormField label="Registered / HO Address">
                <Textarea
                  value={formData.address || ""}
                  onChange={(e) => setFormData((p) => ({ ...p, address: e.target.value }))}
                      placeholder="Street, area, landmark…"
                  rows={3}
                      showCount
                      maxLength={500}
                />
                  </FormField>

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

                  <FormField label="Website">
                    <Input
                      value={(formData as any).website || ""}
                      onChange={(e) => setFormData((p) => ({ ...p, website: e.target.value }))}
                      placeholder="https://"
                    />
                  </FormField>
                </FormSection>
                  </>
                )}

                {companyFormTab === "billing" && (
                <FormSection title="Billing details" description="GST registration and tax identifiers.">
                  <FormField label="Registration Type">
                    <Select
                      value={(formData as any).gstRegistrationType || "Unregistered"}
                      onValueChange={(v) => setFormData((p) => ({ ...p, gstRegistrationType: v }))}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Select registration type" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="Unregistered">Unregistered</SelectItem>
                        <SelectItem value="Registered">Registered</SelectItem>
                      </SelectContent>
                    </Select>
                  </FormField>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <FormField label="GSTIN" required={(formData as any).gstRegistrationType === "Registered"}>
                  <Input value={formData.gstNo || ""} onChange={(e) => setFormData((p) => ({ ...p, gstNo: e.target.value }))} />
                    </FormField>
                    <FormField label="PAN">
                      <Input value={formData.panNo || ""} onChange={(e) => setFormData((p) => ({ ...p, panNo: e.target.value }))} />
                    </FormField>
                    <FormField label="Email">
                      <Input
                        type="email"
                        value={formData.emailAdd || ""}
                        onChange={(e) => setFormData((p) => ({ ...p, emailAdd: e.target.value }))}
                        placeholder="accounts@company.com"
                      />
                    </FormField>
                    <FormField label="Business Trade Name" className="sm:col-span-2">
                      <Input
                        value={(formData as any).businessTradeName || ""}
                        onChange={(e) => setFormData((p) => ({ ...p, businessTradeName: e.target.value }))}
                      />
                    </FormField>
                  </div>
                  <PdfUploadField
                    label="GST certificate (PDF)"
                    value={formData.gstCertUrl}
                    onChange={(url) => setFormData((p) => ({ ...p, gstCertUrl: url ?? "" }))}
                  />
                </FormSection>
                )}

                {companyFormTab === "contacts" && (
                <FormSection title="Primary contacts" description="Optional. Ticked contacts become Company Admins; others get an employee login.">
                  <div className="space-y-4">
                    {primaryContacts.map((row, index) => {
                      const designationOptions = userTypeOptionsForEntity(formData.legalEntityType)
                      return (
                        <div key={row._localId} className="rounded-lg border border-border p-4 space-y-4">
                          <div className="flex items-center justify-between">
                            <p className="text-sm font-medium">Primary Contact {index + 1}</p>
                            {primaryContacts.length > 1 ? (
                              <Button
                                type="button"
                                variant="ghost"
                                size="icon"
                                onClick={() =>
                                  setPrimaryContacts((rows) => rows.filter((r) => r._localId !== row._localId))
                                }
                              >
                                <Trash2 className="h-4 w-4 text-red-600" />
                              </Button>
                            ) : null}
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                            <FormField label="Title">
                              <Select
                                value={row.title || "__none__"}
                                onValueChange={(v) =>
                                  setPrimaryContacts((rows) =>
                                    rows.map((r) =>
                                      r._localId === row._localId ? { ...r, title: v === "__none__" ? "" : v } : r,
                                    ),
                                  )
                                }
                              >
                                <SelectTrigger>
                                  <SelectValue placeholder="Select title" />
                                </SelectTrigger>
                                <SelectContent>
                                  <SelectItem value="__none__">Select title</SelectItem>
                                  {CONTACT_TITLE_OPTIONS.map((opt) => (
                                    <SelectItem key={opt} value={opt}>{opt}</SelectItem>
                                  ))}
                                </SelectContent>
                              </Select>
                            </FormField>
                            <FormField label="Username">
                              <Input
                                value={row.username}
                                onChange={(e) =>
                                  setPrimaryContacts((rows) =>
                                    rows.map((r) => r._localId === row._localId ? { ...r, username: e.target.value } : r),
                                  )
                                }
                              />
                            </FormField>
                            <FormField label="First Name">
                              <Input
                                value={row.firstName}
                                onChange={(e) =>
                                  setPrimaryContacts((rows) =>
                                    rows.map((r) => r._localId === row._localId ? { ...r, firstName: e.target.value } : r),
                                  )
                                }
                              />
                            </FormField>
                            <FormField label="Last Name">
                              <Input
                                value={row.lastName}
                                onChange={(e) =>
                                  setPrimaryContacts((rows) =>
                                    rows.map((r) => r._localId === row._localId ? { ...r, lastName: e.target.value } : r),
                                  )
                                }
                              />
                            </FormField>
                            <FormField label="Email" required>
                              <Input
                                type="email"
                                value={row.email}
                                onChange={(e) =>
                                  setPrimaryContacts((rows) =>
                                    rows.map((r) => r._localId === row._localId ? { ...r, email: e.target.value } : r),
                                  )
                                }
                              />
                            </FormField>
                            <FormField label="Phone">
                              <Input
                                value={row.phone}
                                onChange={(e) =>
                                  setPrimaryContacts((rows) =>
                                    rows.map((r) => r._localId === row._localId ? { ...r, phone: e.target.value } : r),
                                  )
                                }
                              />
                            </FormField>
                            <FormField label="Mobile" required>
                              <Input
                                value={row.mobile}
                                onChange={(e) =>
                                  setPrimaryContacts((rows) =>
                                    rows.map((r) => r._localId === row._localId ? { ...r, mobile: e.target.value } : r),
                                  )
                                }
                              />
                            </FormField>
                            <FormField label="Designation">
                              <Select
                                value={row.designation || "__none__"}
                                onValueChange={(v) =>
                                  setPrimaryContacts((rows) =>
                                    rows.map((r) =>
                                      r._localId === row._localId
                                        ? { ...r, designation: v === "__none__" ? "" : v }
                                        : r,
                                    ),
                                  )
                                }
                              >
                                <SelectTrigger>
                                  <SelectValue placeholder="Select designation" />
                                </SelectTrigger>
                                <SelectContent>
                                  <SelectItem value="__none__">Select designation</SelectItem>
                                  {designationOptions.map((opt) => (
                                    <SelectItem key={opt} value={opt}>{opt}</SelectItem>
                                  ))}
                                </SelectContent>
                              </Select>
                            </FormField>
                            {row.designation === "Other" ? (
                              <FormField label="Specify Designation" required>
                                <Input
                                  value={row.designationOther}
                                  onChange={(e) =>
                                    setPrimaryContacts((rows) =>
                                      rows.map((r) =>
                                        r._localId === row._localId ? { ...r, designationOther: e.target.value } : r,
                                      ),
                                    )
                                  }
                                />
                              </FormField>
                            ) : null}
                </div>
                          <label className="flex items-center gap-2 text-sm">
                            <input
                              type="checkbox"
                              checked={row.setAsCompanyAdmin}
                              onChange={(e) =>
                                setPrimaryContacts((rows) =>
                                  rows.map((r) =>
                                    r._localId === row._localId ? { ...r, setAsCompanyAdmin: e.target.checked } : r,
                                  ),
                                )
                              }
                            />
                            Set as Company Admin
                          </label>
                </div>
                      )
                    })}
                    <Button
                      type="button"
                      variant="outline"
                      onClick={() => setPrimaryContacts((rows) => [...rows, emptyPrimaryContact()])}
                    >
                      <Plus className="w-4 h-4 mr-2" />
                      Add Primary Contact
                    </Button>
              </div>
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
                    { label: "Website", value: viewCompany.website },
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
                  title="Billing"
                  subtitle="GST and tax identifiers"
                  rows={[
                    { label: "Registration type", value: viewCompany.gstRegistrationType },
                    { label: "Business trade name", value: viewCompany.businessTradeName },
                    { label: "GSTIN", value: viewCompany.gstNo },
                    { label: "PAN", value: viewCompany.panNo },
                    { label: "Email", value: viewCompany.emailAdd },
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
                      Company Admin
                    </CardTitle>
                    <p className="text-sm text-gray-500 mt-1">
                      Create and manage company admin employee logins for this tenant.
                    </p>
                </div>

                  <div className="flex gap-2">
                    {!companyAdminFormOpen ? (
                      <Button
                        type="button"
                        onClick={async () => {
                          setEditingCompanyAdmin(null)
                          setViewingCompanyAdmin(false)
                          setCompanyAdminFormTab("general")
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
                          await loadOwnerPermissionGrid()
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
                          setViewingCompanyAdmin(false)
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
                        {viewingCompanyAdmin
                          ? "View Company Admin"
                          : editingCompanyAdmin
                            ? "Update Company Admin"
                            : "Create Company Admin"}
                      </h3>
                      <p className="text-sm text-gray-500">
                        Company login uses a unique username. Password override is optional on update.
                      </p>
                </div>

                    <FormSectionNav
                      active={companyAdminFormTab}
                      onChange={setCompanyAdminFormTab}
                      sections={[
                        { id: "general", label: "General" },
                        { id: "permissions", label: "User Permission" },
                      ]}
                    />

                    {companyAdminFormTab === "general" && (
                    <div className="space-y-4">
                      <div className="space-y-2">
                        <Label>Status</Label>
                        <label className="flex h-10 items-center gap-2 rounded-md border px-3 text-sm bg-white">
                          <input
                            type="checkbox"
                            checked={companyAdminForm.isActive}
                            onChange={(e) =>
                              setCompanyAdminForm((p) => ({ ...p, isActive: e.target.checked }))
                            }
                            disabled={viewingCompanyAdmin}
                          />
                          Active
                        </label>
            </div>

                      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                        <div className="space-y-2">
                          <Label>Title</Label>
                          <Select
                            value={companyAdminForm.title || "__none__"}
                            onValueChange={(v) =>
                              setCompanyAdminForm((p) => ({ ...p, title: v === "__none__" ? "" : v }))
                            }
                            disabled={viewingCompanyAdmin}
                          >
                            <SelectTrigger>
                              <SelectValue placeholder="Select title" />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="__none__">Select title</SelectItem>
                              {CONTACT_TITLE_OPTIONS.map((opt) => (
                                <SelectItem key={opt} value={opt}>{opt}</SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
        </div>
                        <div className="space-y-2">
                          <Label>First Name *</Label>
                          <Input
                            value={companyAdminForm.firstName}
                            onChange={(e) =>
                              setCompanyAdminForm((p) => ({ ...p, firstName: e.target.value }))
                            }
                            disabled={viewingCompanyAdmin}
                          />
                        </div>
                        <div className="space-y-2">
                          <Label>Last Name</Label>
                          <Input
                            value={companyAdminForm.lastName}
                            onChange={(e) =>
                              setCompanyAdminForm((p) => ({ ...p, lastName: e.target.value }))
                            }
                            disabled={viewingCompanyAdmin}
                          />
                        </div>
                      </div>

                      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                        <div className="space-y-2">
                          <Label>Email *</Label>
                          <Input
                            type="email"
                            value={companyAdminForm.email}
                            onChange={(e) => {
                              const email = e.target.value
                              setCompanyAdminForm((p) => {
                                const next = applyEmailMobileCreds({ ...p, email })
                                if (next.useEmailMobileCreds && !viewingCompanyAdmin) {
                                  checkUsernameAvailable(next.username, editingCompanyAdmin?.id)
                                }
                                return next
                              })
                            }}
                            disabled={viewingCompanyAdmin}
                          />
                        </div>
                        <div className="space-y-2">
                          <Label>Phone</Label>
                          <Input
                            value={companyAdminForm.phone}
                            onChange={(e) =>
                              setCompanyAdminForm((p) => ({ ...p, phone: e.target.value }))
                            }
                            disabled={viewingCompanyAdmin}
                          />
                        </div>
                        <div className="space-y-2">
                          <Label>Mobile *</Label>
                          <Input
                            value={companyAdminForm.contactNo}
                            onChange={(e) => {
                              const contactNo = e.target.value
                              setCompanyAdminForm((p) =>
                                applyEmailMobileCreds({ ...p, contactNo }),
                              )
                            }}
                            disabled={viewingCompanyAdmin}
                          />
                        </div>
                      </div>

                      <div className="space-y-2">
                        <Label>Designation</Label>
                        <Select
                          value={companyAdminForm.designation || "__none__"}
                          onValueChange={(v) =>
                            setCompanyAdminForm((p) => ({
                              ...p,
                              designation: v === "__none__" ? "" : v,
                            }))
                          }
                          disabled={viewingCompanyAdmin}
                        >
                          <SelectTrigger>
                            <SelectValue placeholder="Select designation" />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="__none__">Select designation</SelectItem>
                            {userTypeOptionsForEntity(selectedCompanyForAdmin.legalEntityType).map(
                              (opt) => (
                                <SelectItem key={opt} value={opt}>{opt}</SelectItem>
                              ),
                            )}
                          </SelectContent>
                        </Select>
                      </div>
                      {companyAdminForm.designation === "Other" ? (
                        <div className="space-y-2">
                          <Label>Specify Designation *</Label>
                          <Input
                            value={companyAdminForm.designationOther}
                            onChange={(e) =>
                              setCompanyAdminForm((p) => ({ ...p, designationOther: e.target.value }))
                            }
                            disabled={viewingCompanyAdmin}
                          />
                        </div>
                      ) : null}

                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div className="space-y-2">
                          <Label>Username{companyAdminForm.useEmailMobileCreds ? "" : " *"}</Label>
                <Input
                            autoComplete="new-username"
                            value={companyAdminForm.username}
                            onChange={(e) => {
                              const username = e.target.value
                              setCompanyAdminForm((p) => ({ ...p, username }))
                              if (!companyAdminForm.useEmailMobileCreds && !viewingCompanyAdmin) {
                                checkUsernameAvailable(username, editingCompanyAdmin?.id)
                              }
                            }}
                            onBlur={() => {
                              if (!companyAdminForm.useEmailMobileCreds && !viewingCompanyAdmin) {
                                checkUsernameAvailable(
                                  companyAdminForm.username,
                                  editingCompanyAdmin?.id,
                                )
                              }
                            }}
                            placeholder={companyAdminForm.useEmailMobileCreds ? "Uses email" : "Enter unique username"}
                            disabled={viewingCompanyAdmin || companyAdminForm.useEmailMobileCreds}
                          />
                          {companyAdminForm.useEmailMobileCreds ? (
                            <p className="text-xs text-muted-foreground">set email id as username</p>
                          ) : usernameCheck.status !== "idle" ? (
                            <p
                              className={cn(
                                "text-xs",
                                usernameCheck.status === "taken"
                                  ? "text-destructive"
                                  : usernameCheck.status === "ok"
                                    ? "text-emerald-600"
                                    : "text-muted-foreground",
                              )}
                            >
                              {usernameCheck.message}
                            </p>
                          ) : null}
              </div>
                        <div className="space-y-2">
                          <Label>
                            Password
                            {editingCompanyAdmin && !companyAdminForm.useEmailMobileCreds
                              ? " (optional)"
                              : companyAdminForm.useEmailMobileCreds
                                ? ""
                                : " *"}
                          </Label>
                          <Input
                            autoComplete="new-password"
                            type="text"
                            value={companyAdminForm.password}
                            onChange={(e) =>
                              setCompanyAdminForm((p) => ({ ...p, password: e.target.value }))
                            }
                            placeholder={
                              companyAdminForm.useEmailMobileCreds
                                ? "Uses mobile number"
                                : editingCompanyAdmin
                                  ? "Leave blank to keep current"
                                  : "Enter password"
                            }
                            disabled={viewingCompanyAdmin || companyAdminForm.useEmailMobileCreds}
                          />
                          <PasswordRuleHints password={companyAdminForm.password} />
                          {companyAdminForm.useEmailMobileCreds ? (
                            <p className="text-xs text-muted-foreground">set Mobile no. as password</p>
                          ) : null}
                        </div>
                      </div>

                      <label className="flex items-start gap-2 rounded-md border px-3 py-2 text-sm bg-white">
                        <input
                          type="checkbox"
                          className="mt-0.5"
                          checked={companyAdminForm.useEmailMobileCreds}
                          onChange={(e) => {
                            const useEmailMobileCreds = e.target.checked
                            setCompanyAdminForm((p) => {
                              const next = applyEmailMobileCreds({ ...p, useEmailMobileCreds })
                              if (useEmailMobileCreds && !viewingCompanyAdmin) {
                                checkUsernameAvailable(next.username, editingCompanyAdmin?.id)
                              } else {
                                setUsernameCheck({ status: "idle", message: "" })
                              }
                              return next
                            })
                          }}
                          disabled={viewingCompanyAdmin}
                        />
                        <span>
                          Set email as username and mobile as password
                        </span>
                      </label>
                    </div>
                    )}

                    {companyAdminFormTab === "permissions" && (
                      <div className="overflow-x-auto rounded-md border">
                        <Table>
                <TableHeader>
                  <TableRow>
                              <TableHead>Module</TableHead>
                              <TableHead>Read</TableHead>
                              <TableHead>Write</TableHead>
                              <TableHead>Delete</TableHead>
                              <TableHead>Add Admin</TableHead>
                            </TableRow>
                          </TableHeader>
                          <TableBody>
                            {(ownerPermissions.length ? ownerPermissions : fullPermissionRows(ownerModules)).map((row) => {
                              const meta = ownerModules.find((m) => m.moduleKey === row.moduleKey)
                              const writeOn = row.canCreate && row.canEdit
                              const adminOn = row.canView && row.canCreate && row.canEdit && row.canDelete
                              const cell = (on: boolean) =>
                                cn(
                                  "px-2 py-2 text-xs rounded-md border w-full",
                                  on
                                    ? "bg-primary/15 border-primary text-primary font-medium"
                                    : "bg-background border-border text-muted-foreground",
                                  viewingCompanyAdmin ? "cursor-default" : "cursor-pointer",
                                )
                              return (
                                <TableRow key={row.moduleKey}>
                                  <TableCell className="font-medium">{meta?.label || row.moduleKey}</TableCell>
                                  <TableCell>
                                    <button type="button" className={cell(row.canView)} onClick={() => toggleOwnerPerm(row.moduleKey, "read")}>Read</button>
                                  </TableCell>
                                  <TableCell>
                                    <button type="button" className={cell(writeOn)} onClick={() => toggleOwnerPerm(row.moduleKey, "write")}>Write</button>
                                  </TableCell>
                                  <TableCell>
                                    <button type="button" className={cell(row.canDelete)} onClick={() => toggleOwnerPerm(row.moduleKey, "delete")}>Delete</button>
                                  </TableCell>
                                  <TableCell>
                                    <button type="button" className={cell(adminOn)} onClick={() => toggleOwnerPerm(row.moduleKey, "admin")}>Add Admin</button>
                                  </TableCell>
                                </TableRow>
                              )
                            })}
                          </TableBody>
                        </Table>
                      </div>
                    )}

                    {!viewingCompanyAdmin ? (
                    <div className="flex justify-end gap-2">
                      {editingCompanyAdmin && (
                        <Button
                          type="button"
                          variant="outline"
                          onClick={() => {
                            setEditingCompanyAdmin(null)
                            setViewingCompanyAdmin(false)
                            setCompanyAdminFormOpen(false)
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
                    ) : null}
                  </form>
                ) : (
                  <div className="rounded-xl border bg-white overflow-hidden">
                    <div className="px-5 py-4 border-b">
                      <h3 className="text-base font-semibold text-gray-900">
                        Existing Company Admins
                      </h3>
                      <p className="text-sm text-gray-500">
                        Company admin employee accounts for this tenant.
                      </p>
                    </div>

                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>User Name</TableHead>
                          <TableHead>First Name</TableHead>
                          <TableHead>Last Name</TableHead>
                          <TableHead>Role</TableHead>
                          <TableHead>Designation</TableHead>
                          <TableHead>Status</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>

                <TableBody>
                        {companyAdminLoading ? (
                    <TableRow>
                      <TableCell colSpan={7} className="text-center py-8 text-gray-500">
                              Loading users...
                            </TableCell>
                          </TableRow>
                        ) : companyAdminUsers.length === 0 ? (
                          <TableRow>
                            <TableCell colSpan={7} className="text-center py-8 text-gray-500">
                              No company admins found
                      </TableCell>
                    </TableRow>
                  ) : (
                          companyAdminUsers.map((u) => (
                            <TableRow key={u.id}>
                              <TableCell className="font-medium">{u.username}</TableCell>
                              <TableCell>{u.firstName || "—"}</TableCell>
                              <TableCell>{u.lastName || "—"}</TableCell>
                              <TableCell>
                                <Badge variant="secondary">{u.role}</Badge>
                              </TableCell>
                              <TableCell>{u.ownerTitle || "—"}</TableCell>
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
                                    onClick={() => handleViewCompanyAdmin(u)}
                            >
                                    <Eye className="h-4 w-4" />
                            </Button>
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