"use client"

import { useState, useEffect, useMemo, useCallback } from "react"
import {
  SidebarProvider,
  Sidebar,
  SidebarHeader,
  SidebarContent,
  SidebarGroup,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuSub,
  SidebarMenuSubItem,
  SidebarMenuSubButton,
  SidebarMenuItem,
  SidebarInset,
  SidebarTrigger,
} from "../ui/sidebar";
import { Collapsible, CollapsibleTrigger, CollapsibleContent } from "../ui/collapsible";
import { Icon } from "@iconify/react";
import { Avatar, AvatarImage, AvatarFallback } from "../ui/avatar";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "../ui/dropdown-menu";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useCurrentUser } from "../../hooks/useCurrentUser";
import { Input } from "../ui/input";
import { cn } from "@/app/utils/cn";
import { setSidebarContext, getSidebarContext } from "@/app/utils/sidebarContext";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "../ui/dialog";
import { Button } from "../ui/button";
import { Label } from "../ui/label";
import { toast } from "sonner";
import { Eye, EyeOff } from "lucide-react";

interface PageLayoutProps {
  children: React.ReactNode;
}

const sbMenuBtnReset =
  "!h-11 !min-h-[44px] !max-h-11 !rounded-md !p-0 w-full max-w-full border-0 !bg-transparent !shadow-none hover:!bg-transparent hover:!text-inherit active:!bg-transparent data-[active=true]:!bg-transparent data-[state=open]:!bg-transparent focus-visible:ring-1 focus-visible:ring-gray-900/10";

const sbRow =
  "flex w-full items-center gap-3 rounded-md px-3 h-11 min-h-[44px] max-h-11 shrink-0 transition-colors duration-150";

const sbActive =
  "!bg-[#eef2ff] text-[#4f46e5] font-medium !shadow-none ring-0 relative overflow-visible before:absolute before:-left-3 before:top-[20%] before:h-[60%] before:w-[3px] before:rounded-r-sm before:bg-[#4f46e5] [&_svg]:!text-[#4f46e5]";

const sbIdle =
  "text-[#6b7280] hover:bg-[#eef2ff] hover:text-[#4f46e5] !bg-transparent";

const sbSubRow =
  "flex w-full items-center rounded-md !px-3 min-h-9 h-9 max-h-9 text-[13px] font-normal transition-colors duration-150 overflow-hidden";

const sbSubActive =
  "!bg-[#eef2ff] text-[#4f46e5] font-medium !shadow-none ring-0 relative !pl-6 before:absolute before:left-0 before:top-[30%] before:h-[40%] before:w-[2px] before:rounded-full before:bg-[#4f46e5]";

const sbSubIdle =
  "text-[#6b7280] hover:bg-[#eef2ff] hover:text-[#4f46e5] !bg-transparent";

// Path groups for section active-state detection
const SETUP_PATHS = ["/company", "/branches", "/devices"];
const CONTRACTOR_MANAGEMENT_PATHS = ["/contractors", "/contractor-rates"];
const EMPLOYEE_PATHS = ["/departments", "/designations", "/manage-employees", "/employees-promotions", "/employee-memo", "/termination"];
const PAYROLL_PATHS = ["/work-shifts", "/attendance-policy"];
const SALARY_PATHS = ["/salary-advance", "/reimbursement", "/bonus-allocations", "/generate-salary", "/contractor-payout"];
const PAYROLL_POLICY_PATHS = ["/monthly-salary-cycle", "/salary-allowances", "/salary-deductions", "/monthly-pay-grade", "/bonus-setup"];
const LEAVE_PATHS = ["/manage-holidays", "/public-holiday", "/leave-policy"];
const ATTENDANCE_PATHS = ["/field-attendance-schedule", "/attendance-regularisation", "/roster"];
const LEAVE_MANAGEMENT_PATHS = ["/leave-applications", "/privileged-leave"];
const REPORTS_PATHS = ["/attendance-reports", "/payroll-reports"];
const CANTEEN_PATHS = ["/canteen", "/canteen/setup", "/canteen/reports"];
const SETTINGS_PATHS = ["/import-attendance"];
const ADMIN_PATHS = ["/system-users", "/backup-restore", "/system-settings"];
const ALL_SECTION_PATHS = [...SETUP_PATHS, ...CONTRACTOR_MANAGEMENT_PATHS, ...EMPLOYEE_PATHS, ...PAYROLL_PATHS, ...SALARY_PATHS, ...PAYROLL_POLICY_PATHS, ...LEAVE_PATHS, ...LEAVE_MANAGEMENT_PATHS, ...ATTENDANCE_PATHS, ...REPORTS_PATHS, ...CANTEEN_PATHS, ...SETTINGS_PATHS];

export function PageLayout({ children }: PageLayoutProps) {
  const pathname = usePathname()
  const router = useRouter()
  const currentUser = useCurrentUser()
  const [sidebarOpen, setSidebarOpen] = useState(true)
  const [fetchedServiceProviders, setFetchedServiceProviders] = useState<any[]>([])
  const [fetchedCompanies, setFetchedCompanies] = useState<any[]>([])
  const [openSections, setOpenSections] = useState<Record<string, boolean>>({})
  const [sidebarRefreshKey, setSidebarRefreshKey] = useState(0)
  const [sidebarCtx, setSidebarCtxState] = useState<{ serviceProviderID: number; serviceProviderName: string; companyID: number; companyName: string } | null>(getSidebarContext())

  // Keep sidebarCtx in sync with localStorage changes
  useEffect(() => {
    const handleCtxChange = () => setSidebarCtxState(getSidebarContext())
    window.addEventListener("sidebar-context-changed", handleCtxChange)
    return () => window.removeEventListener("sidebar-context-changed", handleCtxChange)
  }, [])

  const isSuperAdmin = currentUser?.role === 'SUPERADMIN'
  const isServiceProvider = currentUser?.role === 'SERVICE_PROVIDER'
  const isCompanyAdmin = currentUser?.role === 'COMPANY_ADMIN'
  const isBranchAdmin = currentUser?.role === 'BRANCH_ADMIN'
  const isRegularUser = !isSuperAdmin && !isServiceProvider && !isCompanyAdmin && !isBranchAdmin

  // Profile modal state
  const [profileOpen, setProfileOpen] = useState(false)
  const [profileForm, setProfileForm] = useState({
    username: "", password: "", confirmPassword: "",
    fullName: "", email: "", mobileNo: "", address: "", city: "", state: "", pincode: "",
  })
  const [profileSaving, setProfileSaving] = useState(false)
  const [profileLoading, setProfileLoading] = useState(false)
  const [showNewPassword, setShowNewPassword] = useState(false)
  const [showConfirmPassword, setShowConfirmPassword] = useState(false)

  const handleProfileOpen = async () => {
    setProfileForm({
      username: currentUser?.username || "", password: "", confirmPassword: "",
      fullName: "", email: "", mobileNo: "", address: "", city: "", state: "", pincode: "",
    })
    setProfileOpen(true)
    setProfileLoading(true)
    try {
      const res = await fetch(`/backend/users/${currentUser?.id}/profile`)
      if (res.ok) {
        const data = await res.json()
        if (data) {
          setProfileForm(prev => ({
            ...prev,
            fullName: data.fullName || "",
            email: data.email || "",
            mobileNo: data.mobileNo || "",
            address: data.address || "",
            city: data.city || "",
            state: data.state || "",
            pincode: data.pincode || "",
          }))
        }
      }
    } catch { /* ignore */ }
    finally { setProfileLoading(false) }
  }

  const handleProfileSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (profileForm.password && profileForm.password !== profileForm.confirmPassword) {
      toast.error("Passwords do not match")
      return
    }
    if (profileForm.password && profileForm.password.length < 6) {
      toast.error("Password must be at least 6 characters")
      return
    }
    setProfileSaving(true)
    try {
      // Save user credentials (username / password)
      const payload: any = { username: profileForm.username }
      if (profileForm.password) payload.password = profileForm.password
      const res = await fetch(`/backend/users/${currentUser?.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      })
      if (!res.ok) throw new Error(await res.text())

      // Save profile details
      await fetch(`/backend/users/${currentUser?.id}/profile`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          fullName: profileForm.fullName,
          email: profileForm.email,
          mobileNo: profileForm.mobileNo,
          address: profileForm.address,
          city: profileForm.city,
          state: profileForm.state,
          pincode: profileForm.pincode,
        }),
      })

      // Update localStorage
      const userData = JSON.parse(localStorage.getItem("user") || "{}")
      userData.username = profileForm.username
      localStorage.setItem("user", JSON.stringify(userData))
      toast.success("Profile updated successfully")
      setProfileOpen(false)
      // Reload to reflect changes
      window.location.reload()
    } catch (err: any) {
      toast.error(err?.message || "Failed to update profile")
    } finally {
      setProfileSaving(false)
    }
  }

  // Fetch service providers and companies for sidebar
  useEffect(() => {
    const fetchData = async () => {
      try {
        const [spRes, compRes] = await Promise.all([
          fetch("/backend/service-provider"),
          fetch("/backend/company"),
        ])
        if (spRes.ok) {
          const data = await spRes.json()
          if (Array.isArray(data)) setFetchedServiceProviders(data)
        }
        if (compRes.ok) {
          const data = await compRes.json()
          setFetchedCompanies(Array.isArray(data) ? data : data?.data ?? [])
        }
      } catch { /* ignore */ }
    }
    fetchData()
  }, [sidebarRefreshKey])

  // Listen for custom sidebar refresh events from child components
  useEffect(() => {
    const handleRefresh = () => setSidebarRefreshKey(k => k + 1)
    window.addEventListener("sidebar-refresh", handleRefresh)
    return () => window.removeEventListener("sidebar-refresh", handleRefresh)
  }, [])

  // Which SPs to display
  const displaySPs = useMemo(() => {
    if (currentUser?.serviceProvider && currentUser.serviceProviderID) {
      return [{ id: currentUser.serviceProviderID, companyName: currentUser.serviceProvider.companyName }]
    }
    return fetchedServiceProviders.map(sp => ({ id: sp.id, companyName: sp.companyName || "Service Provider" }))
  }, [currentUser?.serviceProvider, currentUser?.serviceProviderID, fetchedServiceProviders])

  // Companies grouped by SP
  const companiesBySP = useMemo(() => {
    const map: Record<number, any[]> = {}
    for (const sp of displaySPs) {
      let companies = fetchedCompanies.filter(c => c.serviceProviderID === sp.id)
      // COMPANY_ADMIN and BRANCH_ADMIN only see their own company
      if ((isCompanyAdmin || isBranchAdmin) && currentUser?.companyID) {
        companies = companies.filter(c => c.id === currentUser.companyID)
      }
      map[sp.id] = companies
    }
    return map
  }, [displaySPs, fetchedCompanies, isCompanyAdmin, isBranchAdmin, currentUser?.companyID])

  // Auto-set sidebar context for COMPANY_ADMIN / BRANCH_ADMIN so forms can read it
  useEffect(() => {
    if ((isCompanyAdmin || isBranchAdmin) && currentUser?.companyID) {
      const ctx = getSidebarContext();
      if (!ctx || ctx.companyID !== currentUser.companyID) {
        // Find the company and SP for this user
        for (const sp of displaySPs) {
          const comps = companiesBySP[sp.id] || [];
          const comp = comps.find((c: any) => c.id === currentUser.companyID);
          if (comp) {
            setSidebarContext(sp.id, sp.companyName || "", comp.id, comp.companyName || "");
            break;
          }
        }
      }
    }
  }, [isCompanyAdmin, isBranchAdmin, currentUser?.companyID, displaySPs, companiesBySP])

  const toggleSection = useCallback((key: string, open: boolean) => {
    setOpenSections(prev => ({ ...prev, [key]: open }))
  }, [])

  // Auto-expand sections based on current path
  useEffect(() => {
    const newOpen: Record<string, boolean> = {}
    const inSection = ALL_SECTION_PATHS.includes(pathname) || pathname.startsWith("/canteen")
    const inAdmin = ADMIN_PATHS.includes(pathname)

    if (inSection) {
      const activeCompanyID = sidebarCtx?.companyID;
      for (const sp of displaySPs) {
        if (activeCompanyID) {
          // Only expand the SP that contains the active company
          const spComps = companiesBySP[sp.id] || [];
          const hasActiveCompany = spComps.some((c: any) => c.id === activeCompanyID);
          if (!hasActiveCompany) continue;
        }
        newOpen[`sp_${sp.id}`] = true
        for (const comp of (companiesBySP[sp.id] || [])) {
          if (activeCompanyID && comp.id !== activeCompanyID) continue;
          newOpen[`company_${comp.id}`] = true
          if (SETUP_PATHS.includes(pathname)) newOpen[`c${comp.id}_setup`] = true
          if (CONTRACTOR_MANAGEMENT_PATHS.includes(pathname)) newOpen[`c${comp.id}_contractorMgmt`] = true
          if (EMPLOYEE_PATHS.includes(pathname)) newOpen[`c${comp.id}_employee`] = true
          if (PAYROLL_PATHS.includes(pathname)) newOpen[`c${comp.id}_payroll`] = true
          if (SALARY_PATHS.includes(pathname)) newOpen[`c${comp.id}_salary`] = true
          if (PAYROLL_POLICY_PATHS.includes(pathname)) newOpen[`c${comp.id}_payrollPolicy`] = true
          if (LEAVE_PATHS.includes(pathname)) newOpen[`c${comp.id}_leave`] = true
          if (ATTENDANCE_PATHS.includes(pathname)) newOpen[`c${comp.id}_attendance`] = true
          if (LEAVE_MANAGEMENT_PATHS.includes(pathname)) newOpen[`c${comp.id}_leaveManagement`] = true
          if (REPORTS_PATHS.includes(pathname)) newOpen[`c${comp.id}_reports`] = true
          if (pathname.startsWith("/canteen")) newOpen[`c${comp.id}_canteen`] = true
          if (SETTINGS_PATHS.includes(pathname)) newOpen[`c${comp.id}_settings`] = true
          // For branch admin, also expand the branch level
          if (isBranchAdmin && currentUser?.branchesID) {
            newOpen[`branch_${currentUser.branchesID}`] = true
          }
        }
      }
    }
    if (inAdmin) newOpen['admin'] = true
    if (pathname === '/dashboard' && displaySPs.length > 0) {
      newOpen[`sp_${displaySPs[0].id}`] = true
      const firstComps = companiesBySP[displaySPs[0].id] || []
      if (firstComps.length > 0) {
        newOpen[`company_${firstComps[0].id}`] = true
        if (isBranchAdmin && currentUser?.branchesID) {
          newOpen[`branch_${currentUser.branchesID}`] = true
        }
      }
    }
    setOpenSections(newOpen)
  }, [pathname, displaySPs, companiesBySP, sidebarCtx])

  const pageTitle = (() => {
    if (pathname === "/dashboard") return "Dashboard";
    if (pathname === "/employee-memo") return "Employee Warnings";
    const parts = pathname.split("/").filter(Boolean);
    if (parts.length === 0) return "Dashboard";
    const raw = parts[parts.length - 1];
    return raw.split("-").map(s => s.charAt(0).toUpperCase() + s.slice(1)).join(" ");
  })();

  const activeCtx = sidebarCtx;
  const activeCompanyID = activeCtx?.companyID;

  const isActiveLink = (href: string, companyId?: number) => {
    if (pathname !== href) return false;
    if (companyId != null && activeCompanyID != null) return companyId === activeCompanyID;
    return true;
  };

  const isSectionActiveForCompany = (paths: string[], companyId: number) => {
    return paths.includes(pathname) && activeCompanyID === companyId;
  };

  const adminSectionActive = ADMIN_PATHS.includes(pathname);

  /* ── helper: render all management sections under a company ── */
  const renderCompanySections = (companyId: number, spId: number, spName: string, companyName: string) => {
    const k = (s: string) => `c${companyId}_${s}`
    const onNav = () => setSidebarContext(spId, spName, companyId, companyName)

    const setupSectionActive = isSectionActiveForCompany(SETUP_PATHS, companyId);
    const contractorManagementSectionActive = isSectionActiveForCompany(CONTRACTOR_MANAGEMENT_PATHS, companyId);
    const employeeSectionActive = isSectionActiveForCompany(EMPLOYEE_PATHS, companyId);
    const payrollSectionActive = isSectionActiveForCompany(PAYROLL_PATHS, companyId);
    const salarySectionActive = isSectionActiveForCompany(SALARY_PATHS, companyId);
    const payrollPolicySectionActive = isSectionActiveForCompany(PAYROLL_POLICY_PATHS, companyId);
    const leaveSectionActive = isSectionActiveForCompany(LEAVE_PATHS, companyId);
    const attendanceSectionActive = isSectionActiveForCompany(ATTENDANCE_PATHS, companyId);
    const leaveManagementSectionActive = isSectionActiveForCompany(LEAVE_MANAGEMENT_PATHS, companyId);
    const reportsSectionActive = isSectionActiveForCompany(REPORTS_PATHS, companyId);
    const canteenSectionActive = isSectionActiveForCompany(CANTEEN_PATHS, companyId);
    const settingsSectionActive = isSectionActiveForCompany(SETTINGS_PATHS, companyId);
    return (
      <div className="ml-2 border-l border-[#f0f0f0] pl-1">

        {/* Company Management */}
        {(isSuperAdmin || isServiceProvider || isCompanyAdmin || isBranchAdmin) && (
          <Collapsible open={openSections[k('setup')]} onOpenChange={o => toggleSection(k('setup'), o)}>
            <CollapsibleTrigger asChild>
              <SidebarMenuButton size="lg" className={cn(sbMenuBtnReset, sbRow, "mx-0 justify-between", setupSectionActive ? sbActive : cn(sbIdle, openSections[k('setup')] && "font-semibold text-[#4f46e5]"))}>
                <span className="flex items-center gap-3 min-w-0">
                  <Icon icon="mdi:domain" className={cn("w-5 h-5 shrink-0", setupSectionActive ? "text-[#4f46e5]" : "text-gray-400")} />
                  <span className="truncate font-semibold text-sm">Company Management</span>
                </span>
                <Icon icon="mdi:chevron-down" className={cn("w-4 h-4 shrink-0 text-gray-500 transition-transform duration-300", openSections[k('setup')] && "rotate-180")} />
              </SidebarMenuButton>
            </CollapsibleTrigger>
            <CollapsibleContent>
              <SidebarMenuSub className="ml-5 mt-1 space-y-0.5 border-l border-[#f0f0f0] pl-3">
                {(isSuperAdmin || isServiceProvider || isCompanyAdmin || isBranchAdmin) && (
                  <SidebarMenuSubItem><SidebarMenuSubButton asChild><Link onClick={onNav} href="/company" className={cn(sbSubRow, isActiveLink('/company', companyId) ? sbSubActive : sbSubIdle)}><span className="font-medium truncate" style={{ display: "block" }}>Company Profile</span></Link></SidebarMenuSubButton></SidebarMenuSubItem>
                )}
                <SidebarMenuSubItem><SidebarMenuSubButton asChild><Link onClick={onNav} href="/branches" className={cn(sbSubRow, isActiveLink('/branches', companyId) ? sbSubActive : sbSubIdle)}><span className="font-medium truncate" style={{ display: "block" }}>Branches</span></Link></SidebarMenuSubButton></SidebarMenuSubItem>
                <SidebarMenuSubItem><SidebarMenuSubButton asChild><Link onClick={onNav} href="/devices" className={cn(sbSubRow, isActiveLink('/devices', companyId) ? sbSubActive : sbSubIdle)}><span className="font-medium truncate" style={{ display: "block" }}>Devices</span></Link></SidebarMenuSubButton></SidebarMenuSubItem>
              </SidebarMenuSub>
            </CollapsibleContent>
          </Collapsible>
        )}

        {/* Contractor Management */}
        {(isSuperAdmin || isServiceProvider || isCompanyAdmin || isBranchAdmin) && (
          <Collapsible open={openSections[k('contractorMgmt')]} onOpenChange={o => toggleSection(k('contractorMgmt'), o)}>
            <CollapsibleTrigger asChild>
              <SidebarMenuButton size="lg" className={cn(sbMenuBtnReset, sbRow, "mx-0 justify-between", contractorManagementSectionActive ? sbActive : cn(sbIdle, openSections[k('contractorMgmt')] && "font-semibold text-[#4f46e5]"))}>
                <span className="flex items-center gap-3 min-w-0">
                  <Icon icon="mdi:briefcase-outline" className={cn("w-5 h-5 shrink-0", contractorManagementSectionActive ? "text-[#4f46e5]" : "text-gray-400")} />
                  <span className="truncate font-semibold text-sm">Contractor Management</span>
                </span>
                <Icon icon="mdi:chevron-down" className={cn("w-4 h-4 shrink-0 text-gray-500 transition-transform duration-300", openSections[k('contractorMgmt')] && "rotate-180")} />
              </SidebarMenuButton>
            </CollapsibleTrigger>
            <CollapsibleContent>
              <SidebarMenuSub className="ml-5 mt-1 space-y-0.5 border-l border-[#f0f0f0] pl-3">
                <SidebarMenuSubItem><SidebarMenuSubButton asChild><Link onClick={onNav} href="/contractors" className={cn(sbSubRow, isActiveLink('/contractors', companyId) ? sbSubActive : sbSubIdle)}><span className="font-medium truncate" style={{ display: "block" }}>Contractors</span></Link></SidebarMenuSubButton></SidebarMenuSubItem>
                <SidebarMenuSubItem><SidebarMenuSubButton asChild><Link onClick={onNav} href="/contractor-rates" className={cn(sbSubRow, isActiveLink('/contractor-rates', companyId) ? sbSubActive : sbSubIdle)}><span className="font-medium truncate" style={{ display: "block" }}>Contractor Rates</span></Link></SidebarMenuSubButton></SidebarMenuSubItem>
              </SidebarMenuSub>
            </CollapsibleContent>
          </Collapsible>
        )}

        {/* Employee Management */}
        {(isSuperAdmin || isServiceProvider || isCompanyAdmin || isBranchAdmin) && (
          <Collapsible open={openSections[k('employee')]} onOpenChange={o => toggleSection(k('employee'), o)}>
            <CollapsibleTrigger asChild>
              <SidebarMenuButton size="lg" className={cn(sbMenuBtnReset, sbRow, "mx-0 justify-between", employeeSectionActive ? sbActive : cn(sbIdle, openSections[k('employee')] && "font-semibold text-[#4f46e5]"))}>
                <span className="flex items-center gap-3 min-w-0">
                  <Icon icon="mdi:account-group-outline" className={cn("w-5 h-5 shrink-0", employeeSectionActive ? "text-[#4f46e5]" : "text-gray-400")} />
                  <span className="truncate font-semibold text-sm">Employee Management</span>
                </span>
                <Icon icon="mdi:chevron-down" className={cn("w-4 h-4 shrink-0 text-gray-500 transition-transform duration-300", openSections[k('employee')] && "rotate-180")} />
              </SidebarMenuButton>
            </CollapsibleTrigger>
            <CollapsibleContent>
              <SidebarMenuSub className="ml-5 mt-1 space-y-0.5 border-l border-[#f0f0f0] pl-3">
                <SidebarMenuSubItem><SidebarMenuSubButton asChild><Link onClick={onNav} href="/departments" className={cn(sbSubRow, isActiveLink('/departments', companyId) ? sbSubActive : sbSubIdle)}><span className="font-medium truncate" style={{ display: "block" }}>Departments</span></Link></SidebarMenuSubButton></SidebarMenuSubItem>
                <SidebarMenuSubItem><SidebarMenuSubButton asChild><Link onClick={onNav} href="/designations" className={cn(sbSubRow, isActiveLink('/designations', companyId) ? sbSubActive : sbSubIdle)}><span className="font-medium truncate" style={{ display: "block" }}>Designations</span></Link></SidebarMenuSubButton></SidebarMenuSubItem>
                <SidebarMenuSubItem><SidebarMenuSubButton asChild><Link onClick={onNav} href="/manage-employees" className={cn(sbSubRow, isActiveLink('/manage-employees', companyId) ? sbSubActive : sbSubIdle)}><span className="font-medium truncate" style={{ display: "block" }}>Manage Employees</span></Link></SidebarMenuSubButton></SidebarMenuSubItem>
                <SidebarMenuSubItem><SidebarMenuSubButton asChild><Link onClick={onNav} href="/employees-promotions" className={cn(sbSubRow, isActiveLink('/employees-promotions', companyId) ? sbSubActive : sbSubIdle)}><span className="font-medium" style={{ display: "block" }}>Promotions & Transfers</span></Link></SidebarMenuSubButton></SidebarMenuSubItem>
                {/* Warning & Notices - temporarily hidden */}
                <SidebarMenuSubItem><SidebarMenuSubButton asChild><Link onClick={onNav} href="/termination" className={cn(sbSubRow, isActiveLink('/termination', companyId) ? sbSubActive : sbSubIdle)}><span className="font-medium truncate" style={{ display: "block" }}>Off Boarding</span></Link></SidebarMenuSubButton></SidebarMenuSubItem>
              </SidebarMenuSub>
            </CollapsibleContent>
          </Collapsible>
        )}

        {/* Shift & Attendance Policy */}
        {(isSuperAdmin || isServiceProvider || isCompanyAdmin || isBranchAdmin) && (
          <Collapsible open={openSections[k('payroll')]} onOpenChange={o => toggleSection(k('payroll'), o)}>
            <CollapsibleTrigger asChild>
              <SidebarMenuButton size="lg" className={cn(sbMenuBtnReset, sbRow, "mx-0 justify-between", payrollSectionActive ? sbActive : cn(sbIdle, openSections[k('payroll')] && "font-semibold text-[#4f46e5]"))}>
                <span className="flex items-center gap-3 min-w-0">
                  <Icon icon="mdi:account-cash-outline" className={cn("w-5 h-5 shrink-0", payrollSectionActive ? "text-[#4f46e5]" : "text-gray-400")} />
                  <span className="truncate font-semibold text-sm">Shift & Attendance Policy</span>
                </span>
                <Icon icon="mdi:chevron-down" className={cn("w-4 h-4 shrink-0 text-gray-500 transition-transform duration-300", openSections[k('payroll')] && "rotate-180")} />
              </SidebarMenuButton>
            </CollapsibleTrigger>
            <CollapsibleContent>
              <SidebarMenuSub className="ml-5 mt-1 space-y-0.5 border-l border-[#f0f0f0] pl-3">
                <SidebarMenuSubItem><SidebarMenuSubButton asChild><Link onClick={onNav} href="/work-shifts" className={cn(sbSubRow, isActiveLink('/work-shifts', companyId) ? sbSubActive : sbSubIdle)}><span className="font-medium truncate" style={{ display: "block" }}>Work Shifts</span></Link></SidebarMenuSubButton></SidebarMenuSubItem>
                <SidebarMenuSubItem><SidebarMenuSubButton asChild><Link onClick={onNav} href="/attendance-policy" className={cn(sbSubRow, isActiveLink('/attendance-policy', companyId) ? sbSubActive : sbSubIdle)}><span className="font-medium truncate" style={{ display: "block" }}>Attendance Policy</span></Link></SidebarMenuSubButton></SidebarMenuSubItem>
              </SidebarMenuSub>
            </CollapsibleContent>
          </Collapsible>
        )}

        {/* Leave Policy */}
        {(isSuperAdmin || isServiceProvider || isCompanyAdmin || isBranchAdmin || isRegularUser) && (
          <Collapsible open={openSections[k('leave')]} onOpenChange={o => toggleSection(k('leave'), o)}>
            <CollapsibleTrigger asChild>
              <SidebarMenuButton size="lg" className={cn(sbMenuBtnReset, sbRow, "mx-0 justify-between", leaveSectionActive ? sbActive : cn(sbIdle, openSections[k('leave')] && "font-semibold text-[#4f46e5]"))}>
                <span className="flex items-center gap-3 min-w-0">
                  <Icon icon="mdi:calendar-clock-outline" className={cn("w-5 h-5 shrink-0", leaveSectionActive ? "text-[#4f46e5]" : "text-gray-400")} />
                  <span className="truncate font-semibold text-sm">Leave Policy</span>
                </span>
                <Icon icon="mdi:chevron-down" className={cn("w-4 h-4 shrink-0 text-gray-500 transition-transform duration-300", openSections[k('leave')] && "rotate-180")} />
              </SidebarMenuButton>
            </CollapsibleTrigger>
            <CollapsibleContent>
              <SidebarMenuSub className="ml-5 mt-1 space-y-0.5 border-l border-[#f0f0f0] pl-3">
                {(isSuperAdmin || isServiceProvider || isCompanyAdmin || isBranchAdmin) && (
                  <SidebarMenuSubItem><SidebarMenuSubButton asChild><Link onClick={onNav} href="/manage-holidays" className={cn(sbSubRow, isActiveLink('/manage-holidays', companyId) ? sbSubActive : sbSubIdle)}><span className="font-medium truncate" style={{ display: "block" }}>Manage Holidays</span></Link></SidebarMenuSubButton></SidebarMenuSubItem>
                )}
                <SidebarMenuSubItem><SidebarMenuSubButton asChild><Link onClick={onNav} href="/public-holiday" className={cn(sbSubRow, isActiveLink('/public-holiday', companyId) ? sbSubActive : sbSubIdle)}><span className="font-medium truncate" style={{ display: "block" }}>Public Holiday</span></Link></SidebarMenuSubButton></SidebarMenuSubItem>
                {(isSuperAdmin || isServiceProvider || isCompanyAdmin || isBranchAdmin) && (
                  <SidebarMenuSubItem><SidebarMenuSubButton asChild><Link onClick={onNav} href="/leave-policy" className={cn(sbSubRow, isActiveLink('/leave-policy', companyId) ? sbSubActive : sbSubIdle)}><span className="font-medium truncate" style={{ display: "block" }}>Leave Policy</span></Link></SidebarMenuSubButton></SidebarMenuSubItem>
                )}
              </SidebarMenuSub>
            </CollapsibleContent>
          </Collapsible>
        )}

        {/* Payroll Policy */}
        {(isSuperAdmin || isServiceProvider || isCompanyAdmin || isBranchAdmin) && (
          <Collapsible open={openSections[k('payrollPolicy')]} onOpenChange={o => toggleSection(k('payrollPolicy'), o)}>
            <CollapsibleTrigger asChild>
              <SidebarMenuButton size="lg" className={cn(sbMenuBtnReset, sbRow, "mx-0 justify-between", payrollPolicySectionActive ? sbActive : cn(sbIdle, openSections[k('payrollPolicy')] && "font-semibold text-[#4f46e5]"))}>
                <span className="flex items-center gap-3 min-w-0">
                  <Icon icon="mdi:file-document-edit-outline" className={cn("w-5 h-5 shrink-0", payrollPolicySectionActive ? "text-[#4f46e5]" : "text-gray-400")} />
                  <span className="truncate font-semibold text-sm">Payroll Policy</span>
                </span>
                <Icon icon="mdi:chevron-down" className={cn("w-4 h-4 shrink-0 text-gray-500 transition-transform duration-300", openSections[k('payrollPolicy')] && "rotate-180")} />
              </SidebarMenuButton>
            </CollapsibleTrigger>
            <CollapsibleContent>
              <SidebarMenuSub className="ml-5 mt-1 space-y-0.5 border-l border-[#f0f0f0] pl-3">
                <SidebarMenuSubItem><SidebarMenuSubButton asChild><Link onClick={onNav} href="/monthly-salary-cycle" className={cn(sbSubRow, isActiveLink('/monthly-salary-cycle', companyId) ? sbSubActive : sbSubIdle)}><span className="font-medium truncate" style={{ display: "block" }}>Payroll Salary Cycle</span></Link></SidebarMenuSubButton></SidebarMenuSubItem>
                <SidebarMenuSubItem><SidebarMenuSubButton asChild><Link onClick={onNav} href="/salary-allowances" className={cn(sbSubRow, isActiveLink('/salary-allowances', companyId) ? sbSubActive : sbSubIdle)}><span className="font-medium truncate" style={{ display: "block" }}>Allowances</span></Link></SidebarMenuSubButton></SidebarMenuSubItem>
                <SidebarMenuSubItem><SidebarMenuSubButton asChild><Link onClick={onNav} href="/salary-deductions" className={cn(sbSubRow, isActiveLink('/salary-deductions', companyId) ? sbSubActive : sbSubIdle)}><span className="font-medium truncate" style={{ display: "block" }}>Deductions</span></Link></SidebarMenuSubButton></SidebarMenuSubItem>
                <SidebarMenuSubItem><SidebarMenuSubButton asChild><Link onClick={onNav} href="/monthly-pay-grade" className={cn(sbSubRow, isActiveLink('/monthly-pay-grade', companyId) ? sbSubActive : sbSubIdle)}><span className="font-medium truncate" style={{ display: "block" }}>Paygrade</span></Link></SidebarMenuSubButton></SidebarMenuSubItem>
                <SidebarMenuSubItem><SidebarMenuSubButton asChild><Link onClick={onNav} href="/bonus-setup" className={cn(sbSubRow, isActiveLink('/bonus-setup', companyId) ? sbSubActive : sbSubIdle)}><span className="font-medium truncate" style={{ display: "block" }}>Bonus Rule</span></Link></SidebarMenuSubButton></SidebarMenuSubItem>
              </SidebarMenuSub>
            </CollapsibleContent>
          </Collapsible>
        )}

        {/* Payroll Management */}
        {(isSuperAdmin || isServiceProvider || isCompanyAdmin || isBranchAdmin || isRegularUser) && (
          <Collapsible open={openSections[k('salary')]} onOpenChange={o => toggleSection(k('salary'), o)}>
            <CollapsibleTrigger asChild>
              <SidebarMenuButton size="lg" className={cn(sbMenuBtnReset, sbRow, "mx-0 justify-between", salarySectionActive ? sbActive : cn(sbIdle, openSections[k('salary')] && "font-semibold text-[#4f46e5]"))}>
                <span className="flex items-center gap-3 min-w-0">
                  <Icon icon="mdi:currency-usd" className={cn("w-5 h-5 shrink-0", salarySectionActive ? "text-[#4f46e5]" : "text-gray-400")} />
                  <span className="truncate font-semibold text-sm">Payroll Management</span>
                </span>
                <Icon icon="mdi:chevron-down" className={cn("w-4 h-4 shrink-0 text-gray-500 transition-transform duration-300", openSections[k('salary')] && "rotate-180")} />
              </SidebarMenuButton>
            </CollapsibleTrigger>
            <CollapsibleContent>
              <SidebarMenuSub className="ml-5 mt-1 space-y-0.5 border-l border-[#f0f0f0] pl-3">
                {(isSuperAdmin || isServiceProvider || isCompanyAdmin || isBranchAdmin) && (
                  <SidebarMenuSubItem><SidebarMenuSubButton asChild><Link onClick={onNav} href="/bonus-allocations" className={cn(sbSubRow, isActiveLink('/bonus-allocations', companyId) ? sbSubActive : sbSubIdle)}><span className="font-medium truncate" style={{ display: "block" }}>Bonus Allocations</span></Link></SidebarMenuSubButton></SidebarMenuSubItem>
                )}
                <SidebarMenuSubItem><SidebarMenuSubButton asChild><Link onClick={onNav} href="/salary-advance" className={cn(sbSubRow, isActiveLink('/salary-advance', companyId) ? sbSubActive : sbSubIdle)}><span className="font-medium truncate" style={{ display: "block" }}>Salary Advances</span></Link></SidebarMenuSubButton></SidebarMenuSubItem>
                <SidebarMenuSubItem><SidebarMenuSubButton asChild><Link onClick={onNav} href="/reimbursement" className={cn(sbSubRow, isActiveLink('/reimbursement', companyId) ? sbSubActive : sbSubIdle)}><span className="font-medium truncate" style={{ display: "block" }}>Reimbursements</span></Link></SidebarMenuSubButton></SidebarMenuSubItem>
                <SidebarMenuSubItem><SidebarMenuSubButton asChild><Link onClick={onNav} href="/generate-salary" className={cn(sbSubRow, isActiveLink('/generate-salary', companyId) ? sbSubActive : sbSubIdle)}><span className="font-medium truncate" style={{ display: "block" }}>Run Payroll</span></Link></SidebarMenuSubButton></SidebarMenuSubItem>
                <SidebarMenuSubItem><SidebarMenuSubButton asChild><Link onClick={onNav} href="/contractor-payout" className={cn(sbSubRow, isActiveLink('/contractor-payout', companyId) ? sbSubActive : sbSubIdle)}><span className="font-medium truncate" style={{ display: "block" }}>Contractor Payouts</span></Link></SidebarMenuSubButton></SidebarMenuSubItem>
              </SidebarMenuSub>
            </CollapsibleContent>
          </Collapsible>
        )}

        {/* Attendance Management */}
        {(isSuperAdmin || isServiceProvider || isCompanyAdmin || isBranchAdmin || isRegularUser) && (
          <Collapsible open={openSections[k('attendance')]} onOpenChange={o => toggleSection(k('attendance'), o)}>
            <CollapsibleTrigger asChild>
              <SidebarMenuButton size="lg" className={cn(sbMenuBtnReset, sbRow, "mx-0 justify-between", attendanceSectionActive ? sbActive : cn(sbIdle, openSections[k('attendance')] && "font-semibold text-[#4f46e5]"))}>
                <span className="flex items-center gap-3 min-w-0">
                  <Icon icon="mdi:clock-check-outline" className={cn("w-5 h-5 shrink-0", attendanceSectionActive ? "text-[#4f46e5]" : "text-gray-400")} />
                  <span className="truncate font-semibold text-sm">Attendance Management</span>
                </span>
                <Icon icon="mdi:chevron-down" className={cn("w-4 h-4 shrink-0 text-gray-500 transition-transform duration-300", openSections[k('attendance')] && "rotate-180")} />
              </SidebarMenuButton>
            </CollapsibleTrigger>
            <CollapsibleContent>
              <SidebarMenuSub className="ml-5 mt-1 space-y-0.5 border-l border-[#f0f0f0] pl-3">
                <SidebarMenuSubItem><SidebarMenuSubButton asChild><Link onClick={onNav} href="/attendance-regularisation" className={cn(sbSubRow, isActiveLink('/attendance-regularisation', companyId) ? sbSubActive : sbSubIdle)}><span className="font-medium" style={{ display: "block" }}>Attendance Regularisation</span></Link></SidebarMenuSubButton></SidebarMenuSubItem>
                {/* Field Attendance Schedule - temporarily hidden */}
                {(isSuperAdmin || isServiceProvider || isCompanyAdmin || isBranchAdmin) && (
                  <SidebarMenuSubItem><SidebarMenuSubButton asChild><Link onClick={onNav} href="/roster" className={cn(sbSubRow, isActiveLink('/roster', companyId) ? sbSubActive : sbSubIdle)}><span className="font-medium truncate" style={{ display: "block" }}>Workshift Roster</span></Link></SidebarMenuSubButton></SidebarMenuSubItem>
                )}
              </SidebarMenuSub>
            </CollapsibleContent>
          </Collapsible>
        )}

        {/* Leave Management */}
        {(isSuperAdmin || isServiceProvider || isCompanyAdmin || isBranchAdmin || isRegularUser) && (
          <Collapsible open={openSections[k('leaveManagement')]} onOpenChange={o => toggleSection(k('leaveManagement'), o)}>
            <CollapsibleTrigger asChild>
              <SidebarMenuButton size="lg" className={cn(sbMenuBtnReset, sbRow, "mx-0 justify-between", leaveManagementSectionActive ? sbActive : cn(sbIdle, openSections[k('leaveManagement')] && "font-semibold text-[#4f46e5]"))}>
                <span className="flex items-center gap-3 min-w-0">
                  <Icon icon="mdi:calendar-check" className={cn("w-5 h-5 shrink-0", leaveManagementSectionActive ? "text-[#4f46e5]" : "text-gray-400")} />
                  <span className="truncate font-semibold text-sm">Leave Management</span>
                </span>
                <Icon icon="mdi:chevron-down" className={cn("w-4 h-4 shrink-0 text-gray-500 transition-transform duration-300", openSections[k('leaveManagement')] && "rotate-180")} />
              </SidebarMenuButton>
            </CollapsibleTrigger>
            <CollapsibleContent>
              <SidebarMenuSub className="ml-5 mt-1 space-y-0.5 border-l border-[#f0f0f0] pl-3">
                <SidebarMenuSubItem><SidebarMenuSubButton asChild><Link onClick={onNav} href="/leave-applications" className={cn(sbSubRow, isActiveLink('/leave-applications', companyId) ? sbSubActive : sbSubIdle)}><span className="font-medium truncate" style={{ display: "block" }}>Leave Application</span></Link></SidebarMenuSubButton></SidebarMenuSubItem>
                {(isSuperAdmin || isServiceProvider || isCompanyAdmin || isBranchAdmin) && (
                  <SidebarMenuSubItem><SidebarMenuSubButton asChild><Link onClick={onNav} href="/privileged-leave" className={cn(sbSubRow, isActiveLink('/privileged-leave', companyId) ? sbSubActive : sbSubIdle)}><span className="font-medium truncate" style={{ display: "block" }}>Privileged Leave</span></Link></SidebarMenuSubButton></SidebarMenuSubItem>
                )}
              </SidebarMenuSub>
            </CollapsibleContent>
          </Collapsible>
        )}

        {/* Canteen Management */}
        {(isSuperAdmin || isServiceProvider || isCompanyAdmin || isBranchAdmin) && (
          <Collapsible open={openSections[k('canteen')]} onOpenChange={o => toggleSection(k('canteen'), o)}>
            <CollapsibleTrigger asChild>
              <SidebarMenuButton size="lg" className={cn(sbMenuBtnReset, sbRow, "mx-0 justify-between", canteenSectionActive ? sbActive : cn(sbIdle, openSections[k('canteen')] && "font-semibold text-[#4f46e5]"))}>
                <span className="flex items-center gap-3 min-w-0">
                  <Icon icon="mdi:silverware-fork-knife" className={cn("w-5 h-5 shrink-0", canteenSectionActive ? "text-[#4f46e5]" : "text-gray-400")} />
                  <span className="truncate font-semibold text-sm">Canteen Management</span>
                </span>
                <Icon icon="mdi:chevron-down" className={cn("w-4 h-4 shrink-0 text-gray-500 transition-transform duration-300", openSections[k('canteen')] && "rotate-180")} />
              </SidebarMenuButton>
            </CollapsibleTrigger>
            <CollapsibleContent>
              <SidebarMenuSub className="ml-5 mt-1 space-y-0.5 border-l border-[#f0f0f0] pl-3">
                <SidebarMenuSubItem><SidebarMenuSubButton asChild><Link onClick={onNav} href="/canteen" className={cn(sbSubRow, isActiveLink('/canteen', companyId) ? sbSubActive : sbSubIdle)}><span className="font-medium truncate" style={{ display: "block" }}>Dashboard</span></Link></SidebarMenuSubButton></SidebarMenuSubItem>
                <SidebarMenuSubItem><SidebarMenuSubButton asChild><Link onClick={onNav} href="/canteen/setup" className={cn(sbSubRow, isActiveLink('/canteen/setup', companyId) ? sbSubActive : sbSubIdle)}><span className="font-medium truncate" style={{ display: "block" }}>Configuration</span></Link></SidebarMenuSubButton></SidebarMenuSubItem>
                <SidebarMenuSubItem><SidebarMenuSubButton asChild><Link onClick={onNav} href="/canteen/reports" className={cn(sbSubRow, isActiveLink('/canteen/reports', companyId) ? sbSubActive : sbSubIdle)}><span className="font-medium truncate" style={{ display: "block" }}>Reports</span></Link></SidebarMenuSubButton></SidebarMenuSubItem>
              </SidebarMenuSub>
            </CollapsibleContent>
          </Collapsible>
        )}

        {/* Reports */}
        {(isSuperAdmin || isServiceProvider || isCompanyAdmin || isBranchAdmin) && (
          <Collapsible open={openSections[k('reports')]} onOpenChange={o => toggleSection(k('reports'), o)}>
            <CollapsibleTrigger asChild>
              <SidebarMenuButton size="lg" className={cn(sbMenuBtnReset, sbRow, "mx-0 justify-between", reportsSectionActive ? sbActive : cn(sbIdle, openSections[k('reports')] && "font-semibold text-[#4f46e5]"))}>
                <span className="flex items-center gap-3 min-w-0">
                  <Icon icon="mdi:chart-line" className={cn("w-5 h-5 shrink-0", reportsSectionActive ? "text-[#4f46e5]" : "text-gray-400")} />
                  <span className="truncate font-semibold text-sm">Reports</span>
                </span>
                <Icon icon="mdi:chevron-down" className={cn("w-4 h-4 shrink-0 text-gray-500 transition-transform duration-300", openSections[k('reports')] && "rotate-180")} />
              </SidebarMenuButton>
            </CollapsibleTrigger>
            <CollapsibleContent>
              <SidebarMenuSub className="ml-5 mt-1 space-y-0.5 border-l border-[#f0f0f0] pl-3">
                <SidebarMenuSubItem><SidebarMenuSubButton asChild><Link onClick={onNav} href="/attendance-reports" className={cn(sbSubRow, isActiveLink('/attendance-reports', companyId) ? sbSubActive : sbSubIdle)}><span className="font-medium truncate" style={{ display: "block" }}>Attendance Reports</span></Link></SidebarMenuSubButton></SidebarMenuSubItem>
                <SidebarMenuSubItem><SidebarMenuSubButton asChild><Link onClick={onNav} href="/payroll-reports" className={cn(sbSubRow, isActiveLink('/payroll-reports', companyId) ? sbSubActive : sbSubIdle)}><span className="font-medium truncate" style={{ display: "block" }}>Payroll Reports</span></Link></SidebarMenuSubButton></SidebarMenuSubItem>
                {/* Leave Reports - temporarily hidden */}
                {/* Canteen Reports - moved to Canteen Management */}
                {/* Contractor Reports - temporarily hidden */}
              </SidebarMenuSub>
            </CollapsibleContent>
          </Collapsible>
        )}

        {/* Settings */}
        {(isSuperAdmin || isServiceProvider || isCompanyAdmin || isBranchAdmin) && (
          <Collapsible open={openSections[k('settings')]} onOpenChange={o => toggleSection(k('settings'), o)}>
            <CollapsibleTrigger asChild>
              <SidebarMenuButton size="lg" className={cn(sbMenuBtnReset, sbRow, "mx-0 justify-between", settingsSectionActive ? sbActive : cn(sbIdle, openSections[k('settings')] && "font-semibold text-[#4f46e5]"))}>
                <span className="flex items-center gap-3 min-w-0">
                  <Icon icon="mdi:cog-outline" className={cn("w-5 h-5 shrink-0", settingsSectionActive ? "text-[#4f46e5]" : "text-gray-400")} />
                  <span className="truncate font-semibold text-sm">Settings</span>
                </span>
                <Icon icon="mdi:chevron-down" className={cn("w-4 h-4 shrink-0 text-gray-500 transition-transform duration-300", openSections[k('settings')] && "rotate-180")} />
              </SidebarMenuButton>
            </CollapsibleTrigger>
            <CollapsibleContent>
              <SidebarMenuSub className="ml-5 mt-1 space-y-0.5 border-l border-[#f0f0f0] pl-3">
                <SidebarMenuSubItem><SidebarMenuSubButton asChild><Link onClick={onNav} href="/import-attendance" className={cn(sbSubRow, isActiveLink('/import-attendance', companyId) ? sbSubActive : sbSubIdle)}><span className="font-medium truncate" style={{ display: "block" }}>Import Attendance</span></Link></SidebarMenuSubButton></SidebarMenuSubItem>
              </SidebarMenuSub>
            </CollapsibleContent>
          </Collapsible>
        )}
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-[#f8fafc]">
      <SidebarProvider open={sidebarOpen} onOpenChange={setSidebarOpen}>
        <Sidebar collapsible="icon" className="border-r border-[#d1d5db] bg-sidebar text-sidebar-foreground">
          <SidebarHeader className="px-4 py-6 border-0">
            <div className="flex items-center justify-between">
              <Link href="/dashboard" className="flex items-center gap-3">
                <img src="/img/OpenHRM_Logo.png" alt="OpenHRM" className="w-14 h-14 rounded-full object-cover shrink-0 shadow-[0_6px_16px_rgba(79,70,229,0.35)]" />
                <div className="min-w-0">
                  <span className="text-[#111827] font-bold text-base tracking-tight block truncate">OpenHRM</span>
                  <p className="text-xs text-gray-400">Human resources</p>
                </div>
              </Link>
              <button
                type="button"
                onClick={() => setSidebarRefreshKey(k => k + 1)}
                className="p-2.5 rounded-md text-gray-400 hover:text-[#4f46e5] hover:bg-[#eef2ff] transition-colors shrink-0"
                title="Refresh sidebar"
              >
                <Icon icon="mdi:refresh" className="w-6 h-6" />
              </button>
            </div>
          </SidebarHeader>

          <SidebarContent className="px-2.5 py-2 flex-1 overflow-y-auto">
            <SidebarGroup>
              <SidebarMenu className="gap-1.5 flex flex-col">

                {/* ── Dashboard ── */}
                <SidebarMenuItem className="mx-0">
                  <SidebarMenuButton asChild size="lg" className={sbMenuBtnReset}>
                    <Link href="/dashboard" className={cn(sbRow, isActiveLink("/dashboard") ? sbActive : sbIdle)}>
                      <Icon icon="mdi:view-dashboard-outline" className={cn("w-5 h-5 shrink-0", isActiveLink("/dashboard") ? "text-[#4f46e5]" : "text-gray-400")} />
                      <span className="truncate font-semibold">Dashboard</span>
                    </Link>
                  </SidebarMenuButton>
                </SidebarMenuItem>

                {/* ── Service Providers link (SUPERADMIN only) ── */}
                {isSuperAdmin && (
                  <SidebarMenuItem className="mx-0">
                    <SidebarMenuButton asChild size="lg" className={sbMenuBtnReset}>
                      <Link href="/service-providers" className={cn(sbRow, isActiveLink("/service-providers") ? sbActive : sbIdle)}>
                        <Icon icon="mdi:account-supervisor-outline" className={cn("w-5 h-5 shrink-0", isActiveLink("/service-providers") ? "text-[#4f46e5]" : "text-gray-400")} />
                        <span className="truncate font-semibold">Service Providers</span>
                      </Link>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                )}

                {/* ── SP → Company → Sections hierarchy ── */}
                {displaySPs.map(sp => {
                  const spCompanies = companiesBySP[sp.id] || []
                  const hasCompanies = spCompanies.length > 0

                  // COMPANY_ADMIN / BRANCH_ADMIN: skip SP wrapper, show companies directly
                  if (isCompanyAdmin || isBranchAdmin) {
                    return hasCompanies ? (
                      <SidebarMenuItem key={sp.id} className="mx-0 list-none">
                        {spCompanies.map((company: any) => (
                          <Collapsible key={company.id} open={openSections[`company_${company.id}`]} onOpenChange={o => toggleSection(`company_${company.id}`, o)}>
                            <CollapsibleTrigger asChild>
                              <SidebarMenuButton size="lg" className={cn(sbMenuBtnReset, sbRow, "mx-0 justify-between", cn(sbIdle, openSections[`company_${company.id}`] && "font-semibold text-[#4f46e5]"))}>
                                <span className="flex items-center gap-3 min-w-0">
                                  <Icon icon="mdi:domain" className={cn("w-5 h-5 shrink-0", openSections[`company_${company.id}`] ? "text-[#4f46e5]" : "text-gray-400")} />
                                  <span className="truncate font-semibold text-sm">{company.companyName || "Unnamed Company"}</span>
                                </span>
                                <Icon icon="mdi:chevron-down" className={cn("w-4 h-4 shrink-0 text-gray-500 transition-transform duration-300", openSections[`company_${company.id}`] && "rotate-180")} />
                              </SidebarMenuButton>
                            </CollapsibleTrigger>
                            <CollapsibleContent>
                              {isBranchAdmin && currentUser?.branches?.branchName ? (
                                <div className="ml-3 border-l border-[#f0f0f0] pl-1">
                                  <Collapsible open={openSections[`branch_${currentUser.branchesID}`]} onOpenChange={o => toggleSection(`branch_${currentUser.branchesID}`, o)}>
                                    <CollapsibleTrigger asChild>
                                      <SidebarMenuButton size="lg" className={cn(sbMenuBtnReset, sbRow, "mx-0 justify-between", cn(sbIdle, openSections[`branch_${currentUser.branchesID}`] && "font-semibold text-[#4f46e5]"))}>
                                        <span className="flex items-center gap-3 min-w-0">
                                          <Icon icon="mdi:source-branch" className={cn("w-5 h-5 shrink-0", openSections[`branch_${currentUser.branchesID}`] ? "text-[#4f46e5]" : "text-gray-400")} />
                                          <span className="truncate font-semibold text-sm">{currentUser.branches.branchName}</span>
                                        </span>
                                        <Icon icon="mdi:chevron-down" className={cn("w-4 h-4 shrink-0 text-gray-500 transition-transform duration-300", openSections[`branch_${currentUser.branchesID}`] && "rotate-180")} />
                                      </SidebarMenuButton>
                                    </CollapsibleTrigger>
                                    <CollapsibleContent>
                                      {renderCompanySections(company.id, sp.id, sp.companyName, company.companyName || "")}
                                    </CollapsibleContent>
                                  </Collapsible>
                                </div>
                              ) : (
                                renderCompanySections(company.id, sp.id, sp.companyName, company.companyName || "")
                              )}
                            </CollapsibleContent>
                          </Collapsible>
                        ))}
                      </SidebarMenuItem>
                    ) : null
                  }

                  return (
                    <Collapsible key={sp.id} open={openSections[`sp_${sp.id}`]} onOpenChange={o => toggleSection(`sp_${sp.id}`, o)}>
                      <CollapsibleTrigger asChild>
                        <SidebarMenuButton size="lg" className={cn(sbMenuBtnReset, sbRow, "mx-0 justify-between", cn(sbIdle, openSections[`sp_${sp.id}`] && "font-semibold text-[#4f46e5]"))}>
                          <span className="flex items-center gap-3 min-w-0">
                            <Icon icon="mdi:office-building-outline" className={cn("w-5 h-5 shrink-0", openSections[`sp_${sp.id}`] ? "text-[#4f46e5]" : "text-gray-400")} />
                            <span className="truncate font-semibold">{sp.companyName}</span>
                          </span>
                          <Icon icon="mdi:chevron-down" className={cn("w-4 h-4 shrink-0 text-gray-500 transition-transform duration-300", openSections[`sp_${sp.id}`] && "rotate-180")} />
                        </SidebarMenuButton>
                      </CollapsibleTrigger>
                      <CollapsibleContent>
                        <div className="ml-3 border-l border-[#f0f0f0] pl-1">
                          {hasCompanies ? (
                            spCompanies.map((company: any) => (
                              <Collapsible key={company.id} open={openSections[`company_${company.id}`]} onOpenChange={o => toggleSection(`company_${company.id}`, o)}>
                                <CollapsibleTrigger asChild>
                                  <SidebarMenuButton size="lg" className={cn(sbMenuBtnReset, sbRow, "mx-0 justify-between", cn(sbIdle, openSections[`company_${company.id}`] && "font-semibold text-[#4f46e5]"))}>
                                    <span className="flex items-center gap-3 min-w-0">
                                      <Icon icon="mdi:domain" className={cn("w-5 h-5 shrink-0", openSections[`company_${company.id}`] ? "text-[#4f46e5]" : "text-gray-400")} />
                                      <span className="truncate font-semibold text-sm">{company.companyName || "Unnamed Company"}</span>
                                    </span>
                                    <Icon icon="mdi:chevron-down" className={cn("w-4 h-4 shrink-0 text-gray-500 transition-transform duration-300", openSections[`company_${company.id}`] && "rotate-180")} />
                                  </SidebarMenuButton>
                                </CollapsibleTrigger>
                                <CollapsibleContent>
                                  {renderCompanySections(company.id, sp.id, sp.companyName, company.companyName || "")}
                                </CollapsibleContent>
                              </Collapsible>
                            ))
                          ) : (
                            <div className="px-4 py-3 text-xs text-gray-400 italic">No companies yet</div>
                          )}
                        </div>
                      </CollapsibleContent>
                    </Collapsible>
                  )
                })}

                {/* ── Administration (SUPERADMIN only) ── */}
                {isSuperAdmin && (
                  <Collapsible open={openSections['admin']} onOpenChange={o => toggleSection('admin', o)}>
                    <CollapsibleTrigger asChild>
                      <SidebarMenuButton size="lg" className={cn(sbMenuBtnReset, sbRow, "mx-0 justify-between", adminSectionActive ? sbActive : cn(sbIdle, openSections['admin'] && "font-semibold text-[#4f46e5]"))}>
                        <span className="flex items-center gap-3 min-w-0">
                          <Icon icon="mdi:shield-lock-outline" className={cn("w-5 h-5 shrink-0", adminSectionActive ? "text-[#4f46e5]" : "text-gray-400")} />
                          <span className="truncate font-semibold">Administration</span>
                        </span>
                        <Icon icon="mdi:chevron-down" className={cn("w-4 h-4 shrink-0 text-gray-500 transition-transform duration-300", openSections['admin'] && "rotate-180")} />
                      </SidebarMenuButton>
                    </CollapsibleTrigger>
                    <CollapsibleContent>
                      <SidebarMenuSub className="ml-5 mt-1 space-y-0.5 border-l border-[#f0f0f0] pl-3">
                        <SidebarMenuSubItem><SidebarMenuSubButton asChild><Link href="/system-users" className={cn(sbSubRow, isActiveLink('/system-users') ? sbSubActive : sbSubIdle)}><span className="font-medium truncate" style={{ display: "block" }}>System Users</span></Link></SidebarMenuSubButton></SidebarMenuSubItem>
                        <SidebarMenuSubItem><SidebarMenuSubButton asChild><Link href="/backup-restore" className={cn(sbSubRow, isActiveLink('/backup-restore') ? sbSubActive : sbSubIdle)}><span className="font-medium truncate" style={{ display: "block" }}>Backup & Restore</span></Link></SidebarMenuSubButton></SidebarMenuSubItem>
                        <SidebarMenuSubItem><SidebarMenuSubButton asChild><Link href="/system-settings" className={cn(sbSubRow, isActiveLink('/system-settings') ? sbSubActive : sbSubIdle)}><span className="font-medium truncate" style={{ display: "block" }}>System Settings</span></Link></SidebarMenuSubButton></SidebarMenuSubItem>
                      </SidebarMenuSub>
                    </CollapsibleContent>
                  </Collapsible>
                )}

              </SidebarMenu>
            </SidebarGroup>
          </SidebarContent>

          <div className="mt-auto border-t border-[#e8e8e8] p-4 flex flex-col items-center">
            <p className="text-[10px] text-gray-400 font-medium">v1.0.0</p>
          </div>
        </Sidebar>

        <SidebarInset>
          <div className="min-h-screen bg-[#f8fafc] overflow-x-hidden">
            <header className="sticky top-0 z-30 bg-[#f8fafc]/95 backdrop-blur-sm px-4 sm:px-8 pt-5 pb-4">
              <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
                <div className="flex items-center gap-3 min-w-0">
                  <SidebarTrigger className="text-gray-500 hover:text-[#4f46e5] hover:bg-[#eef2ff] rounded-full h-10 w-10 shrink-0 border border-[#d1d5db] shadow-sm" />
                  <h1 className="text-2xl sm:text-[1.65rem] font-bold text-gray-900 tracking-tight truncate">{pageTitle}</h1>
                </div>
                <div className="flex flex-1 flex-col sm:flex-row items-stretch sm:items-center gap-3 lg:max-w-2xl lg:mx-6">
                  <div className="flex flex-1 items-center gap-2.5 bg-white rounded-full border border-[#e8e8e8] shadow-[0_2px_12px_rgba(0,0,0,0.04)] px-4 py-2.5 min-w-0">
                    <Icon icon="mdi:magnify" className="w-5 h-5 text-gray-400 shrink-0" />
                    <Input type="search" placeholder="Search anything..." className="border-0 bg-transparent shadow-none focus-visible:ring-0 h-8 px-0 text-sm placeholder:text-gray-400" />
                  </div>
                </div>
                <div className="flex items-center justify-end gap-2 sm:gap-2 shrink-0">
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <button type="button" className="flex items-center gap-2 cursor-pointer focus:outline-none rounded-full pl-1 pr-1 py-1 hover:bg-white/80 transition-colors">
                        <Avatar className="w-10 h-10 ring-[3px] ring-white shadow-md">
                          <AvatarFallback className="bg-gray-900 text-white text-sm font-bold">{currentUser?.username?.[0]?.toUpperCase() || "A"}</AvatarFallback>
                        </Avatar>
                      </button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end" className="w-52 rounded-2xl">
                      <div className="px-3 py-2 border-b border-gray-100">
                        <p className="text-sm font-semibold text-gray-900 truncate">{currentUser?.username || "User"}</p>
                        <p className="text-[11px] text-gray-400 font-medium mt-0.5">{(() => {
                          const roleMap: Record<string, string> = {
                            SUPERADMIN: "Super Admin",
                            SERVICE_PROVIDER: "Service Provider",
                            COMPANY_ADMIN: "Company Admin",
                            BRANCH_ADMIN: "Branch Admin",
                            EMPLOYEE: "Employee",
                          };
                          return roleMap[currentUser?.role || ""] || currentUser?.role || "—";
                        })()}</p>
                      </div>
                      <DropdownMenuItem className="cursor-pointer rounded-xl m-1" onClick={handleProfileOpen}>
                        <Icon icon="mdi:account-circle-outline" className="w-4 h-4 mr-2" />
                        User Profile
                      </DropdownMenuItem>
                      <DropdownMenuItem className="cursor-pointer text-red-600 focus:text-red-600 rounded-xl m-1" onClick={() => {
                        localStorage.removeItem("accessToken");
                        localStorage.removeItem("user");
                        document.cookie = "accessToken=; expires=Thu, 01 Jan 1970 00:00:00 UTC; path=/;";
                        router.push("/login");
                      }}>
                        <Icon icon="mdi:logout" className="w-4 h-4 mr-2" />
                        Logout
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </div>
              </div>
            </header>
            <main className="px-4 sm:px-8 pb-8 pt-0 overflow-x-hidden">{children}</main>
          </div>
        </SidebarInset>
      </SidebarProvider>

      {/* User Profile Modal */}
      <Dialog open={profileOpen} onOpenChange={setProfileOpen}>
        <DialogContent className="!w-full !max-w-lg !left-1/2 !top-1/2 !-translate-x-1/2 !-translate-y-1/2 !right-auto !bottom-auto !h-auto !max-h-[90vh] !min-h-0 rounded-2xl overflow-y-auto">
          <DialogHeader>
            <DialogTitle>User Profile</DialogTitle>
          </DialogHeader>
          {profileLoading ? (
            <div className="py-8 text-center text-gray-400">Loading profile…</div>
          ) : (
          <form onSubmit={handleProfileSubmit} className="space-y-4 mt-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Full Name</Label>
                <Input
                  value={profileForm.fullName}
                  onChange={(e) => setProfileForm(p => ({ ...p, fullName: e.target.value }))}
                  placeholder="Full Name"
                />
              </div>
              <div className="space-y-2">
                <Label>Email</Label>
                <Input
                  type="email"
                  value={profileForm.email}
                  onChange={(e) => setProfileForm(p => ({ ...p, email: e.target.value }))}
                  placeholder="Email"
                />
              </div>
              <div className="space-y-2">
                <Label>Mobile Number</Label>
                <Input
                  value={profileForm.mobileNo}
                  onChange={(e) => setProfileForm(p => ({ ...p, mobileNo: e.target.value }))}
                  placeholder="Mobile Number"
                />
              </div>
              <div className="space-y-2">
                <Label>Username</Label>
                <Input
                  value={profileForm.username}
                  onChange={(e) => setProfileForm(p => ({ ...p, username: e.target.value }))}
                  placeholder="Username"
                  required
                />
              </div>
            </div>
            <div className="space-y-2">
              <Label>Address</Label>
              <Input
                value={profileForm.address}
                onChange={(e) => setProfileForm(p => ({ ...p, address: e.target.value }))}
                placeholder="Address"
              />
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div className="space-y-2">
                <Label>City</Label>
                <Input
                  value={profileForm.city}
                  onChange={(e) => setProfileForm(p => ({ ...p, city: e.target.value }))}
                  placeholder="City"
                />
              </div>
              <div className="space-y-2">
                <Label>State</Label>
                <Input
                  value={profileForm.state}
                  onChange={(e) => setProfileForm(p => ({ ...p, state: e.target.value }))}
                  placeholder="State"
                />
              </div>
              <div className="space-y-2">
                <Label>Pincode</Label>
                <Input
                  value={profileForm.pincode}
                  onChange={(e) => setProfileForm(p => ({ ...p, pincode: e.target.value }))}
                  placeholder="Pincode"
                />
              </div>
            </div>
            <div className="border-t border-gray-200 pt-4 space-y-4">
              <p className="text-sm text-gray-500 font-medium">Change Password</p>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>New Password (leave blank to keep current)</Label>
                  <div className="relative">
                    <Input
                      type={showNewPassword ? "text" : "password"}
                      value={profileForm.password}
                      onChange={(e) => setProfileForm(p => ({ ...p, password: e.target.value }))}
                      placeholder="Enter new password"
                      className="pr-10"
                    />
                    <button
                      type="button"
                      onClick={() => setShowNewPassword(v => !v)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                      tabIndex={-1}
                    >
                      {showNewPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </button>
                  </div>
                </div>
                <div className="space-y-2">
                  <Label>Confirm Password</Label>
                  <div className="relative">
                    <Input
                      type={showConfirmPassword ? "text" : "password"}
                      value={profileForm.confirmPassword}
                      onChange={(e) => setProfileForm(p => ({ ...p, confirmPassword: e.target.value }))}
                      placeholder="Confirm new password"
                      className="pr-10"
                    />
                    <button
                      type="button"
                      onClick={() => setShowConfirmPassword(v => !v)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                      tabIndex={-1}
                    >
                      {showConfirmPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </button>
                  </div>
                </div>
              </div>
            </div>
            <div className="flex justify-end gap-2 pt-2">
              <Button type="button" variant="outline" onClick={() => setProfileOpen(false)}>Cancel</Button>
              <Button type="submit" disabled={profileSaving}>{profileSaving ? "Saving…" : "Update"}</Button>
            </div>
          </form>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
