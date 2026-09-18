"use client"

import { useState, useEffect, useMemo, useCallback, useTransition } from "react"
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
import { setSidebarContext, getSidebarContext, clearActiveCompanySession } from "@/app/utils/sidebarContext";
import { getPageCache, setPageCache } from "@/app/utils/pageCache";
import { isDesktopManagerFlagSet } from "@/lib/desktopManager";
import { authHeaders } from "@/lib/auth";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "../ui/dialog";
import { Button } from "../ui/button";
import { Label } from "../ui/label";
import { toast } from "sonner";
import { isPasswordValid, PASSWORD_POLICY_MESSAGE } from "@/lib/passwordRules";
import { PasswordRuleHints } from "../ui/password-rule-hints";
import { isCompanyAdminLikeRole } from "@/lib/companyAccess";
import { Eye, EyeOff } from "lucide-react";
import { TASK_MANAGEMENT_ENABLED } from "@/app/config/featureFlags";
import { dispatchAppRefresh } from "@/app/utils/appRefresh";
import { ensureFetchRefreshPatch } from "@/app/utils/patchFetchForRefresh";
import { Skeleton } from "../ui/skeleton";
import { HrmsTopbar } from "../app/hrms-topbar";

const SIDEBAR_OPEN_SECTIONS_KEY = "sidebarOpenSections";

function readOpenSections(): Record<string, boolean> {
  if (typeof window === "undefined") return {};
  try {
    const raw = sessionStorage.getItem(SIDEBAR_OPEN_SECTIONS_KEY);
    return raw ? (JSON.parse(raw) as Record<string, boolean>) : {};
  } catch {
    return {};
  }
}

function persistOpenSections(sections: Record<string, boolean>) {
  try {
    sessionStorage.setItem(SIDEBAR_OPEN_SECTIONS_KEY, JSON.stringify(sections));
  } catch { /* ignore */ }
}

function getStoredActiveCompanyID(): number {
  if (typeof window === "undefined") return 0;

  try {
    return Number(sessionStorage.getItem("activeCompanyID") || 0);
  } catch {
    return 0;
  }
}

function getUserCompanyIds(user: any): number[] {
  const ids = new Set<number>();

  if (user?.companyID) ids.add(Number(user.companyID));

  if (Array.isArray(user?.userCompanies)) {
    user.userCompanies.forEach((uc: any) => {
      if (uc?.companyID) ids.add(Number(uc.companyID));
    });
  }

  return Array.from(ids);
}

interface PageLayoutProps {
  children: React.ReactNode;
}

const sbMenuBtnReset =
  "!h-11 !min-h-[44px] !max-h-11 !rounded-md !p-0 w-full max-w-full border-0 !bg-transparent !shadow-none hover:!bg-transparent hover:!text-inherit active:!bg-transparent data-[active=true]:!bg-transparent data-[state=open]:!bg-transparent focus-visible:ring-1 focus-visible:ring-gray-900/10";

const sbRow =
  "flex w-full items-center gap-3.5 rounded-xl px-3.5 h-[46px] min-h-[46px] max-h-[46px] shrink-0 transition-all duration-150";

const sbActive =
  "!bg-primary !text-primary-foreground font-semibold !shadow-md rounded-xl [&_svg]:!text-primary-foreground";

const sbIdle =
  "text-muted-foreground hover:bg-muted/70 hover:text-foreground !bg-transparent";

const sbSubRow =
  "flex w-full items-center rounded-md !px-3 min-h-9 h-9 max-h-9 text-[13px] font-normal transition-all duration-150 overflow-hidden";

const sbSubActive =
  "!bg-accent text-accent-foreground font-medium !shadow-sm ring-0 relative !pl-6 before:absolute before:left-0 before:top-[30%] before:h-[40%] before:w-[2px] before:rounded-full before:bg-primary";

const sbSubIdle =
  "text-muted-foreground hover:bg-accent/60 hover:text-foreground !bg-transparent";

// Path groups for section active-state detection
const TASK_MANAGEMENT_PATHS = ["/task-customers", "/task-customer-sites", "/task-projects"];
const SETUP_PATHS = ["/company", "/branches", "/devices", "/federal-domain"];
const CONTRACTOR_MANAGEMENT_PATHS = ["/contractors", "/contractor-rates"];
const EMPLOYEE_PATHS = ["/departments", "/designations", "/manage-employees", "/employees-promotions", "/termination"];
const IM_PATHS = ["/employee-memo"];
const PAYROLL_PATHS = ["/work-shifts", "/attendance-policy", "/roster", "/attendance-regularisation"];
const SALARY_PATHS = ["/salary-advance", "/reimbursement", "/bonus-allocations", "/generate-salary", "/contractor-payout"];
const PAYROLL_POLICY_PATHS = ["/monthly-salary-cycle", "/salary-allowances", "/salary-deductions", "/monthly-pay-grade", "/bonus-setup"];
const LEAVE_PATHS = ["/manage-holidays", "/public-holiday", "/leave-policy"];
const ATTENDANCE_PATHS = ["/field-attendance-schedule"];
const LEAVE_MANAGEMENT_PATHS = ["/leave-applications", "/privileged-leave"];
const REPORTS_PATHS = ["/attendance-reports", "/payroll-reports"];
const CANTEEN_PATHS = ["/canteen", "/canteen/setup", "/canteen/reports"];
const SETTINGS_PATHS = ["/import-attendance", "/hrms-integrations", "/system-settings", "/system-settings/general", "/system-settings/compliance", "/system-settings/email-templates"];
const ADMIN_PATHS = ["/system-users", "/subscription"];
const SUPERADMIN_SYSTEM_PATHS = ["/service-providers", "/company"];
const ALL_SECTION_PATHS = [...SETUP_PATHS, ...CONTRACTOR_MANAGEMENT_PATHS, ...EMPLOYEE_PATHS, ...IM_PATHS, ...TASK_MANAGEMENT_PATHS, ...PAYROLL_PATHS, ...SALARY_PATHS, ...PAYROLL_POLICY_PATHS, ...LEAVE_PATHS, ...LEAVE_MANAGEMENT_PATHS, ...ATTENDANCE_PATHS, ...REPORTS_PATHS, ...CANTEEN_PATHS, ...SETTINGS_PATHS];
export function PageLayout({ children }: PageLayoutProps) {
const pathname = usePathname()
const router = useRouter()
const [isNavigating, startNavigation] = useTransition()

 const handleSidebarNavigation = (
  e: React.MouseEvent<HTMLAnchorElement>,
  href: string
) => {
  e.preventDefault();

  if (isNavigating) return;

  window.dispatchEvent(
    new CustomEvent("sidebar-main-page-click", {
      detail: { path: href },
    })
  );

  startNavigation(() => {
    if (pathname === href) {
      router.refresh();
    } else {
      router.push(href);
    }
  });
};

  const currentUser = useCurrentUser()
  console.log("CURRENT USER", currentUser);
  const [sidebarOpen, setSidebarOpen] = useState(true)
  const [fetchedServiceProviders, setFetchedServiceProviders] = useState<any[]>(
    () => getPageCache<any[]>("sidebarSPs") ?? []
  )
  const [fetchedCompanies, setFetchedCompanies] = useState<any[]>(
    () => getPageCache<any[]>("sidebarCompanies") ?? []
  )
  const [openSections, setOpenSections] = useState<Record<string, boolean>>(readOpenSections)
  const [sidebarRefreshKey, setSidebarRefreshKey] = useState(0)
  const [sidebarCtx, setSidebarCtxState] = useState<{ serviceProviderID: number; serviceProviderName: string; companyID: number; companyName: string } | null>(getSidebarContext())

  const assignedCompanyIds = useMemo(
    () => getUserCompanyIds(currentUser),
    [currentUser]
  )

  useEffect(() => {
    ensureFetchRefreshPatch();
  }, []);

  // Keep sidebarCtx in sync with localStorage changes
  useEffect(() => {
    const handleCtxChange = () => setSidebarCtxState(getSidebarContext())
    window.addEventListener("sidebar-context-changed", handleCtxChange)
    window.addEventListener("app-data-refresh", handleCtxChange)
    return () => {
      window.removeEventListener("sidebar-context-changed", handleCtxChange)
      window.removeEventListener("app-data-refresh", handleCtxChange)
    }
  }, [])

  useEffect(() => {
if (currentUser?.role !== "SUPERADMIN") return;

    const blockedForSuperAdmin = [
      "/dashboard",
      "/manage-employees",
      "/branches",
      "/devices",
      "/federal-domain",
      "/departments",
      "/designations",
      "/work-shifts",
      "/attendance-policy",
      "/roster",
      "/attendance-regularisation",
      "/leave-policy",
      "/generate-salary",
      "/attendance-reports",
      "/import-attendance",
    ];

    if (blockedForSuperAdmin.includes(pathname)) {
      router.replace("/superdashboard");
    }
  }, [currentUser?.role, pathname, router]);


  const [desktopManager, setDesktopManager] = useState(false)
  useEffect(() => {
    setDesktopManager(isDesktopManagerFlagSet())
  }, [currentUser?.id])

  const isSuperAdmin = currentUser?.role === 'SUPERADMIN'
  const isServiceProvider = currentUser?.role === 'SERVICE_PROVIDER'
  const isCompanyAdmin = isCompanyAdminLikeRole(currentUser?.role)
  const isAdmin = currentUser?.role === 'ADMIN'
  const isBranchAdmin = currentUser?.role === 'BRANCH_ADMIN'
const isDesktopManager = desktopManager && currentUser?.role === 'EMPLOYEE'
const isPlatformSimpleSidebarUser = isSuperAdmin || isServiceProvider




  const isRegularUser =
    !isSuperAdmin &&
    !isServiceProvider &&
    !isCompanyAdmin &&
    !isAdmin &&
    !isBranchAdmin &&
    !isDesktopManager

const canAccessFullHrSections =
  (isCompanyAdmin || isBranchAdmin || isDesktopManager) && !isAdmin

const canSeeCompanySetupSections =
  isCompanyAdmin || isAdmin || isBranchAdmin || isDesktopManager

const isCompanyScopedSidebarUser =
  isCompanyAdmin || isAdmin || isBranchAdmin || isDesktopManager



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
    const isEmployeeUser =
      currentUser?.role === "EMPLOYEE" ||
      (currentUser as { type?: string })?.type === "employee";

    setProfileForm({
      username: currentUser?.username || "", password: "", confirmPassword: "",
      fullName: [currentUser?.firstName, currentUser?.lastName].filter(Boolean).join(" ").trim(),
      email: currentUser?.email || "",
      mobileNo: currentUser?.contactNo || "",
      address: "", city: "", state: "", pincode: "",
    })
    setProfileOpen(true)
    setProfileLoading(true)
    try {
      if (isEmployeeUser) {
        const empId =
          (currentUser as { employee?: { id?: number } })?.employee?.id ??
          currentUser?.id;
        if (empId) {
          const res = await fetch(`/backend/manage-emp/${empId}`, {
            headers: authHeaders(),
          });
          if (res.ok) {
            const emp = await res.json();
            const fullName = [emp?.employeeFirstName, emp?.employeeLastName]
              .filter(Boolean)
              .join(" ")
              .trim();
            setProfileForm((prev) => ({
              ...prev,
              fullName: fullName || prev.fullName,
              email: emp?.businessEmail || emp?.personalEmail || prev.email,
              mobileNo:
                emp?.personalPhoneNo ||
                emp?.businessPhoneNo ||
                emp?.emergancyContact ||
                prev.mobileNo,
              address:
                emp?.presentAddress || emp?.permenantAddress || prev.address,
              city: prev.city,
              state: prev.state,
              pincode: prev.pincode,
            }));
          }
        }
        return;
      }

      const res = await fetch(`/backend/users/${currentUser?.id}/profile`, {
        headers: authHeaders(),
      })
      if (res.ok) {
        const data = await res.json()
        setProfileForm(prev => ({
          ...prev,
          fullName: data?.fullName || [currentUser?.firstName, currentUser?.lastName].filter(Boolean).join(" ").trim() || prev.fullName,
          email: data?.email || currentUser?.email || prev.email,
          mobileNo: data?.mobileNo || currentUser?.contactNo || prev.mobileNo,
          address: data?.address || "",
          city: data?.city || "",
          state: data?.state || "",
          pincode: data?.pincode || "",
        }))
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
    if (profileForm.password && !isPasswordValid(profileForm.password)) {
      toast.error(PASSWORD_POLICY_MESSAGE)
      return
    }
    setProfileSaving(true)
    try {
      // Save user credentials (username / password)
      const payload: any = { username: profileForm.username }
      if (profileForm.password) payload.password = profileForm.password
      const res = await fetch(`/backend/users/${currentUser?.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json", ...authHeaders() },
        body: JSON.stringify(payload),
      })
      if (!res.ok) throw new Error(await res.text())

      // Save profile details
      await fetch(`/backend/users/${currentUser?.id}/profile`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json", ...authHeaders() },
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

  // Fetch service providers and companies for sidebar (cache-first, background refresh)
  useEffect(() => {
    if (isSuperAdmin) return;

    const fetchData = async () => {
      try {
        const [spRes, compRes] = await Promise.all([
          fetch("/backend/service-provider"),
          fetch("/backend/company"),
        ])

        if (spRes.ok) {
          const data = await spRes.json()
          if (Array.isArray(data)) {
            setFetchedServiceProviders(data)
            setPageCache("sidebarSPs", data)
          }
        }

        if (compRes.ok) {
          const data = await compRes.json()
          const companies = Array.isArray(data) ? data : data?.data ?? []
          setFetchedCompanies(companies)
          setPageCache("sidebarCompanies", companies)
        }
      } catch { /* ignore */ }
    }

    fetchData()
  }, [sidebarRefreshKey, isSuperAdmin])

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

  const accessibleCompanies = useMemo(() => {
  if (!isCompanyAdmin) {
    return [];
  }

  return displaySPs.flatMap((sp) => {
    let companies = fetchedCompanies.filter(
      (c) => c.serviceProviderID === sp.id
    );

    if (assignedCompanyIds.length > 0) {
      companies = companies.filter((c) =>
        assignedCompanyIds.includes(Number(c.id))
      );
    }

    return companies.map((company: any) => ({
      ...company,
      serviceProviderID: sp.id,
      serviceProviderName: sp.companyName || "",
    }));
  });
}, [
  displaySPs,
  fetchedCompanies,
  assignedCompanyIds,
  isCompanyAdmin,
]);

const currentRole = String(currentUser?.role || "").toUpperCase();

const canShowCompanySwitcher =
  isCompanyAdminLikeRole(currentRole) && accessibleCompanies.length > 1;

  const activeCompany = useMemo(() => {
    const storedCompanyID = getStoredActiveCompanyID();

    return (
      accessibleCompanies.find((c: any) => Number(c.id) === storedCompanyID) ||
      accessibleCompanies.find((c: any) => Number(c.id) === Number(sidebarCtx?.companyID)) ||
      accessibleCompanies.find((c: any) => Number(c.id) === Number(currentUser?.companyID)) ||
      accessibleCompanies[0]
    );
  }, [accessibleCompanies, sidebarCtx?.companyID, currentUser?.companyID]);

  const companiesBySP = useMemo(() => {
    const map: Record<number, any[]> = {}

    for (const sp of displaySPs) {
      let companies = fetchedCompanies.filter((c) => c.serviceProviderID === sp.id)

      if (isCompanyScopedSidebarUser) {
        companies = activeCompany ? companies.filter((c) => Number(c.id) === Number(activeCompany.id)) : []
      }

      map[sp.id] = companies
    }

    return map
  }, [displaySPs, fetchedCompanies, isCompanyScopedSidebarUser, activeCompany?.id])

  const switchCompany = (company: any) => {
    if (!company?.id) return

    setSidebarContext(
      company.serviceProviderID,
      company.serviceProviderName || "",
      company.id,
      company.companyName || ""
    )

    const userData = JSON.parse(localStorage.getItem("user") || "{}")
    userData.activeCompanyID = company.id
    userData.companyID = company.id
    userData.company = {
      id: company.id,
      companyName: company.companyName,
    }
    localStorage.setItem("user", JSON.stringify(userData))

    sessionStorage.setItem("activeCompanyID", String(company.id))

    window.dispatchEvent(new Event("sidebar-context-changed"))
    window.dispatchEvent(new Event("app-data-refresh"))
    dispatchAppRefresh()

    const targetDashboard =
      currentUser?.role === "SUPERADMIN"
        ? "/superdashboard"
        : isCompanyAdminLikeRole(currentUser?.role)
          ? "/my-company"
          : "/dashboard"

    if (pathname !== targetDashboard) {
      router.push(targetDashboard)
    } else {
      router.refresh()
    }
  }

  useEffect(() => {
    if (!isCompanyScopedSidebarUser || accessibleCompanies.length === 0 || !activeCompany) return

    const ctx = getSidebarContext()

    if (!ctx || Number(ctx.companyID) !== Number(activeCompany.id)) {
      setSidebarContext(
        activeCompany.serviceProviderID,
        activeCompany.serviceProviderName || "",
        activeCompany.id,
        activeCompany.companyName || ""
      )
    }
  }, [isCompanyScopedSidebarUser, accessibleCompanies.length, activeCompany?.id])

  const toggleSection = useCallback((key: string, open: boolean) => {
    setOpenSections(prev => {
      const next = { ...prev, [key]: open };
      persistOpenSections(next);
      return next;
    });
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
          if (IM_PATHS.includes(pathname)) newOpen[`c${comp.id}_im`] = true
          if (TASK_MANAGEMENT_PATHS.includes(pathname)) newOpen[`c${comp.id}_taskMgmt`] = true
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
    setOpenSections(prev => {
      const merged = { ...prev, ...newOpen };
      const changed =
        Object.keys(newOpen).some(k => merged[k] !== prev[k]) ||
        Object.keys(prev).length !== Object.keys(merged).length;
      if (!changed) return prev;
      persistOpenSections(merged);
      return merged;
    });
  }, [pathname, displaySPs, companiesBySP, sidebarCtx, isBranchAdmin, currentUser?.branchesID])

  const pageTitle = (() => {
    if (pathname === "/dashboard" || pathname === "/superdashboard") return "Dashboard";
    if (pathname === "/employee-memo") return "Internal Messaging (IM)";
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

  const sidebarHierarchyLoading = useMemo(() => {
    if (!currentUser) return false;
    const hasCachedSp = (getPageCache<any[]>("sidebarSPs")?.length ?? 0) > 0;
    const hasCachedCo = (getPageCache<any[]>("sidebarCompanies")?.length ?? 0) > 0;
    if ((isServiceProvider && !currentUser.serviceProviderID)) {
      return displaySPs.length === 0 && !hasCachedSp;
    }
    if (isCompanyScopedSidebarUser) {
      const comps = displaySPs.flatMap((sp) => companiesBySP[sp.id] || []);
      return comps.length === 0 && !hasCachedCo;
    }
    return false;
  }, [
    currentUser,
    isSuperAdmin,
    isServiceProvider,
    isCompanyScopedSidebarUser,
    displaySPs,
    companiesBySP,
  ]);

  const renderSidebarHierarchySkeleton = () => (
    <div className="space-y-2 px-1 py-1" aria-hidden="true">
      {Array.from({ length: 3 }).map((_, i) => (
        <div key={i} className="space-y-1.5">
          <div className={cn(sbRow, "pointer-events-none")}>
            <Skeleton className="h-5 w-5 shrink-0 rounded-md" />
            <Skeleton className="h-4 flex-1 max-w-[72%] rounded-full" />
            <Skeleton className="h-4 w-4 shrink-0 rounded-md" />
          </div>
          {i === 0 && (
            <div className="ml-5 space-y-1.5 border-l border-border pl-3">
              {Array.from({ length: 4 }).map((__, j) => (
                <Skeleton key={j} className="h-9 w-full max-w-[88%] rounded-md" />
              ))}
            </div>
          )}
        </div>
      ))}
    </div>
  );

  /* ── helper: render all management sections under a company ── */
  const renderCompanySections = (companyId: number, spId: number, spName: string, companyName: string) => {
    const k = (s: string) => `c${companyId}_${s}`

   const onNav = (e: React.MouseEvent<HTMLAnchorElement>) => {
  e.preventDefault();

  if (isNavigating) return;

  const href = e.currentTarget.getAttribute("href") || "";

  setSidebarContext(spId, spName, companyId, companyName);

  setSidebarCtxState({
    serviceProviderID: spId,
    serviceProviderName: spName,
    companyID: companyId,
    companyName,
  });

  window.dispatchEvent(new Event("sidebar-context-changed"));
  window.dispatchEvent(new Event("app-data-refresh"));

  window.dispatchEvent(
    new CustomEvent("sidebar-main-page-click", {
      detail: { path: href },
    })
  );

  startNavigation(() => {
    if (pathname === href) {
      router.refresh();
    } else {
      router.push(href);
    }
  });
};


    const setupSectionActive = isSectionActiveForCompany(SETUP_PATHS, companyId);
    const contractorManagementSectionActive = isSectionActiveForCompany(CONTRACTOR_MANAGEMENT_PATHS, companyId);
    const employeeSectionActive = isSectionActiveForCompany(EMPLOYEE_PATHS, companyId);
    const imSectionActive = isSectionActiveForCompany(IM_PATHS, companyId);
    const taskMgmtSectionActive = isSectionActiveForCompany(TASK_MANAGEMENT_PATHS, companyId);
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
      <div className="ml-2 border-l border-border pl-1">

        {/* Company Dashboard - SUPERADMIN only */}
        {false && isSuperAdmin && (
          <SidebarMenuButton asChild size="lg" className={sbMenuBtnReset}>
            <Link
              href="/dashboard"
              onClick={(e) => onNav(e)}
              className={cn(
                sbRow,
                isActiveLink("/dashboard", companyId) ? sbActive : sbIdle
              )}
            >
              <Icon
                icon="mdi:view-dashboard-outline"
                className={cn(
                  "w-5 h-5 shrink-0",
                  isActiveLink("/dashboard", companyId)
                    ? "text-primary"
                    : "text-gray-400"
                )}
              />
              <span className="truncate font-semibold text-sm">Dashboard</span>
            </Link>
          </SidebarMenuButton>
        )}

        {/* Company Management */}
        {(canSeeCompanySetupSections) && (
          <Collapsible open={openSections[k('setup')]} onOpenChange={o => toggleSection(k('setup'), o)}>
            <CollapsibleTrigger asChild>
              <SidebarMenuButton size="lg" className={cn(sbMenuBtnReset, sbRow, "mx-0 justify-between", setupSectionActive ? sbActive : cn(sbIdle, openSections[k('setup')] && "font-semibold text-primary"))}>
                <span className="flex items-center gap-3 min-w-0">
                  <Icon icon="mdi:domain" className={cn("w-5 h-5 shrink-0", setupSectionActive ? "text-primary" : "text-gray-400")} />
                  <span className="truncate font-semibold text-sm">Company Management</span>
                </span>
                <Icon icon="mdi:chevron-down" className={cn("w-4 h-4 shrink-0 text-gray-500 transition-transform duration-300", openSections[k('setup')] && "rotate-180")} />
              </SidebarMenuButton>
            </CollapsibleTrigger>
            <CollapsibleContent>
              <SidebarMenuSub className="ml-5 mt-1 space-y-0.5 border-l border-border pl-3">
            {(canSeeCompanySetupSections && !isCompanyAdmin) && (
  <SidebarMenuSubItem><SidebarMenuSubButton asChild><Link onClick={(e) => onNav(e)} href="/company" className={cn(sbSubRow, isActiveLink('/company', companyId) ? sbSubActive : sbSubIdle)}><span className="font-medium truncate" style={{ display: "block" }}>Company Profile</span></Link></SidebarMenuSubButton></SidebarMenuSubItem>
                )}
                <SidebarMenuSubItem><SidebarMenuSubButton asChild><Link onClick={(e) => onNav(e)} href="/branches" className={cn(sbSubRow, isActiveLink('/branches', companyId) ? sbSubActive : sbSubIdle)}><span className="font-medium truncate" style={{ display: "block" }}>Branches</span></Link></SidebarMenuSubButton></SidebarMenuSubItem>
                <SidebarMenuSubItem><SidebarMenuSubButton asChild><Link onClick={(e) => onNav(e)} href="/devices" className={cn(sbSubRow, isActiveLink('/devices', companyId) ? sbSubActive : sbSubIdle)}><span className="font-medium truncate" style={{ display: "block" }}>Devices</span></Link></SidebarMenuSubButton></SidebarMenuSubItem>
                <SidebarMenuSubItem><SidebarMenuSubButton asChild><Link onClick={(e) => onNav(e)} href="/federal-domain" className={cn(sbSubRow, isActiveLink('/federal-domain', companyId) ? sbSubActive : sbSubIdle)}><span className="font-medium truncate" style={{ display: "block" }}>Federal Domain</span></Link></SidebarMenuSubButton></SidebarMenuSubItem>
                <SidebarMenuSubItem><SidebarMenuSubButton asChild><Link onClick={(e) => onNav(e)} href="/departments" className={cn(sbSubRow, isActiveLink('/departments', companyId) ? sbSubActive : sbSubIdle)}><span className="font-medium truncate" style={{ display: "block" }}>Departments</span></Link></SidebarMenuSubButton></SidebarMenuSubItem>
                <SidebarMenuSubItem><SidebarMenuSubButton asChild><Link onClick={(e) => onNav(e)} href="/designations" className={cn(sbSubRow, isActiveLink('/designations', companyId) ? sbSubActive : sbSubIdle)}><span className="font-medium truncate" style={{ display: "block" }}>Designations</span></Link></SidebarMenuSubButton></SidebarMenuSubItem>

              </SidebarMenuSub>
            </CollapsibleContent>
          </Collapsible>
        )}

        {/* Contractor Management */}
        {canAccessFullHrSections && (
          <Collapsible open={openSections[k('contractorMgmt')]} onOpenChange={o => toggleSection(k('contractorMgmt'), o)}>
            <CollapsibleTrigger asChild>
              <SidebarMenuButton size="lg" className={cn(sbMenuBtnReset, sbRow, "mx-0 justify-between", contractorManagementSectionActive ? sbActive : cn(sbIdle, openSections[k('contractorMgmt')] && "font-semibold text-primary"))}>
                <span className="flex items-center gap-3 min-w-0">
                  <Icon icon="mdi:briefcase-outline" className={cn("w-5 h-5 shrink-0", contractorManagementSectionActive ? "text-primary" : "text-gray-400")} />
                  <span className="truncate font-semibold text-sm">Contractor Management</span>
                </span>
                <Icon icon="mdi:chevron-down" className={cn("w-4 h-4 shrink-0 text-gray-500 transition-transform duration-300", openSections[k('contractorMgmt')] && "rotate-180")} />
              </SidebarMenuButton>
            </CollapsibleTrigger>
            <CollapsibleContent>
              <SidebarMenuSub className="ml-5 mt-1 space-y-0.5 border-l border-border pl-3">
                <SidebarMenuSubItem><SidebarMenuSubButton asChild><Link onClick={(e) => onNav(e)} href="/contractors" className={cn(sbSubRow, isActiveLink('/contractors', companyId) ? sbSubActive : sbSubIdle)}><span className="font-medium truncate" style={{ display: "block" }}>Contractors</span></Link></SidebarMenuSubButton></SidebarMenuSubItem>
                <SidebarMenuSubItem><SidebarMenuSubButton asChild><Link onClick={(e) => onNav(e)} href="/contractor-rates" className={cn(sbSubRow, isActiveLink('/contractor-rates', companyId) ? sbSubActive : sbSubIdle)}><span className="font-medium truncate" style={{ display: "block" }}>Contractor Rates</span></Link></SidebarMenuSubButton></SidebarMenuSubItem>
              </SidebarMenuSub>
            </CollapsibleContent>
          </Collapsible>
        )}

        {/* Employee Management */}
        {(canSeeCompanySetupSections) && (
          <Collapsible open={openSections[k('employee')]} onOpenChange={o => toggleSection(k('employee'), o)}>
            <CollapsibleTrigger asChild>
              <SidebarMenuButton size="lg" className={cn(sbMenuBtnReset, sbRow, "mx-0 justify-between", employeeSectionActive ? sbActive : cn(sbIdle, openSections[k('employee')] && "font-semibold text-primary"))}>
                <span className="flex items-center gap-3 min-w-0">
                  <Icon icon="mdi:message-text-outline" className={cn("w-5 h-5 shrink-0", employeeSectionActive ? "text-primary" : "text-gray-400")} />
                  <span className="truncate font-semibold text-sm">Employee Management</span>
                </span>
                <Icon icon="mdi:chevron-down" className={cn("w-4 h-4 shrink-0 text-gray-500 transition-transform duration-300", openSections[k('employee')] && "rotate-180")} />
              </SidebarMenuButton>
            </CollapsibleTrigger>
            <CollapsibleContent>
              <SidebarMenuSub className="ml-5 mt-1 space-y-0.5 border-l border-border pl-3">
                <SidebarMenuSubItem><SidebarMenuSubButton asChild><Link onClick={(e) => onNav(e)} href="/manage-employees" className={cn(sbSubRow, isActiveLink('/manage-employees', companyId) ? sbSubActive : sbSubIdle)}><span className="font-medium truncate" style={{ display: "block" }}>Manage Employees</span></Link></SidebarMenuSubButton></SidebarMenuSubItem>
                {/* Promotions & Transfers - temporarily hidden */}
                <SidebarMenuSubItem><SidebarMenuSubButton asChild><Link onClick={(e) => onNav(e)} href="/termination" className={cn(sbSubRow, isActiveLink('/termination', companyId) ? sbSubActive : sbSubIdle)}><span className="font-medium truncate" style={{ display: "block" }}>Off Boarding</span></Link></SidebarMenuSubButton></SidebarMenuSubItem>
              </SidebarMenuSub>
            </CollapsibleContent>
          </Collapsible>
        )}


        {(canSeeCompanySetupSections) && (
          <Collapsible open={openSections[k('im')]} onOpenChange={o => toggleSection(k('im'), o)}>
            <CollapsibleTrigger asChild>
              <SidebarMenuButton size="lg" className={cn(sbMenuBtnReset, sbRow, "mx-0 justify-between", imSectionActive ? sbActive : cn(sbIdle, openSections[k('im')] && "font-semibold text-primary"))}>
                <span className="flex items-center gap-3 min-w-0">
                  <Icon icon="mdi:account-group-outline" className={cn("w-5 h-5 shrink-0", imSectionActive ? "text-primary" : "text-gray-400")} />
                  <span className="truncate font-semibold text-sm">Internal Messaging (IM)</span>
                </span>
                <Icon icon="mdi:chevron-down" className={cn("w-4 h-4 shrink-0 text-gray-500 transition-transform duration-300", openSections[k('im')] && "rotate-180")} />
              </SidebarMenuButton>
            </CollapsibleTrigger>
            <CollapsibleContent>
              <SidebarMenuSub className="ml-5 mt-1 space-y-0.5 border-l border-border pl-3">
                <SidebarMenuSubItem><SidebarMenuSubButton asChild><Link onClick={(e) => onNav(e)} href="/employee-memo" className={cn(sbSubRow, isActiveLink('/employee-memo', companyId) ? sbSubActive : sbSubIdle)}><span className="font-medium truncate" style={{ display: "block" }}>Internal Messaging (IM)</span></Link></SidebarMenuSubButton></SidebarMenuSubItem>
              </SidebarMenuSub>
            </CollapsibleContent>
          </Collapsible>
        )}


        {/* Task Management System — temporarily hidden */}
        {TASK_MANAGEMENT_ENABLED && (isCompanyAdmin || isDesktopManager) && (
          <Collapsible open={openSections[k('taskMgmt')]} onOpenChange={o => toggleSection(k('taskMgmt'), o)}>
            <CollapsibleTrigger asChild>
              <SidebarMenuButton size="lg" className={cn(sbMenuBtnReset, sbRow, "mx-0 justify-between", taskMgmtSectionActive ? sbActive : cn(sbIdle, openSections[k('taskMgmt')] && "font-semibold text-primary"))}>
                <span className="flex items-center gap-3 min-w-0">
                  <Icon icon="mdi:clipboard-check-outline" className={cn("w-5 h-5 shrink-0", taskMgmtSectionActive ? "text-primary" : "text-gray-400")} />
                  <span className="truncate font-semibold text-sm">Task Management System</span>
                </span>
                <Icon icon="mdi:chevron-down" className={cn("w-4 h-4 shrink-0 text-gray-500 transition-transform duration-300", openSections[k('taskMgmt')] && "rotate-180")} />
              </SidebarMenuButton>
            </CollapsibleTrigger>
            <CollapsibleContent>
              <SidebarMenuSub className="ml-5 mt-1 space-y-0.5 border-l border-border pl-3">
                <SidebarMenuSubItem><SidebarMenuSubButton asChild><Link onClick={(e) => onNav(e)} href="/task-customers" className={cn(sbSubRow, isActiveLink('/task-customers', companyId) ? sbSubActive : sbSubIdle)}><span className="font-medium truncate" style={{ display: "block" }}>Customers</span></Link></SidebarMenuSubButton></SidebarMenuSubItem>
                <SidebarMenuSubItem><SidebarMenuSubButton asChild><Link onClick={(e) => onNav(e)} href="/task-customer-sites" className={cn(sbSubRow, isActiveLink('/task-customer-sites', companyId) ? sbSubActive : sbSubIdle)}><span className="font-medium truncate" style={{ display: "block" }}>Sites / Branches</span></Link></SidebarMenuSubButton></SidebarMenuSubItem>
                <SidebarMenuSubItem><SidebarMenuSubButton asChild><Link onClick={(e) => onNav(e)} href="/task-projects" className={cn(sbSubRow, isActiveLink('/task-projects', companyId) ? sbSubActive : sbSubIdle)}><span className="font-medium truncate" style={{ display: "block" }}>Tasks / Projects</span></Link></SidebarMenuSubButton></SidebarMenuSubItem>
              </SidebarMenuSub>
            </CollapsibleContent>
          </Collapsible>
        )}

        {/* Shift & Attendance Management */}
        {(isServiceProvider || isCompanyAdmin || isBranchAdmin || isDesktopManager) && !isAdmin && (
          <Collapsible open={openSections[k('payroll')]} onOpenChange={o => toggleSection(k('payroll'), o)}>
            <CollapsibleTrigger asChild>
              <SidebarMenuButton size="lg" className={cn(sbMenuBtnReset, sbRow, "mx-0 justify-between", payrollSectionActive ? sbActive : cn(sbIdle, openSections[k('payroll')] && "font-semibold text-primary"))}>
                <span className="flex items-center gap-3 min-w-0">
                  <Icon icon="mdi:account-cash-outline" className={cn("w-5 h-5 shrink-0", payrollSectionActive ? "text-primary" : "text-gray-400")} />
                  <span className="truncate font-semibold text-sm">Shift & Attendance Management</span>
                </span>
                <Icon icon="mdi:chevron-down" className={cn("w-4 h-4 shrink-0 text-gray-500 transition-transform duration-300", openSections[k('payroll')] && "rotate-180")} />
              </SidebarMenuButton>
            </CollapsibleTrigger>
            <CollapsibleContent>
              <SidebarMenuSub className="ml-5 mt-1 space-y-0.5 border-l border-border pl-3">
                <SidebarMenuSubItem><SidebarMenuSubButton asChild><Link onClick={(e) => onNav(e)} href="/work-shifts" className={cn(sbSubRow, isActiveLink('/work-shifts', companyId) ? sbSubActive : sbSubIdle)}><span className="font-medium truncate" style={{ display: "block" }}>Work Shifts</span></Link></SidebarMenuSubButton></SidebarMenuSubItem>
                <SidebarMenuSubItem><SidebarMenuSubButton asChild><Link onClick={(e) => onNav(e)} href="/attendance-policy" className={cn(sbSubRow, isActiveLink('/attendance-policy', companyId) ? sbSubActive : sbSubIdle)}><span className="font-medium truncate" style={{ display: "block" }}>Attendance Policy</span></Link></SidebarMenuSubButton></SidebarMenuSubItem>
                <SidebarMenuSubItem><SidebarMenuSubButton asChild><Link onClick={(e) => onNav(e)} href="/roster" className={cn(sbSubRow, isActiveLink('/roster', companyId) ? sbSubActive : sbSubIdle)}><span className="font-medium truncate" style={{ display: "block" }}>Workshift Roster</span></Link></SidebarMenuSubButton></SidebarMenuSubItem>
                <SidebarMenuSubItem><SidebarMenuSubButton asChild><Link onClick={(e) => onNav(e)} href="/attendance-regularisation" className={cn(sbSubRow, isActiveLink('/attendance-regularisation', companyId) ? sbSubActive : sbSubIdle)}><span className="font-medium truncate" style={{ display: "block" }}>Attendance Regularisation</span></Link></SidebarMenuSubButton></SidebarMenuSubItem>
              </SidebarMenuSub>
            </CollapsibleContent>
          </Collapsible>
        )}

        {/* Leave Policy */}
        {canAccessFullHrSections && (
          <Collapsible open={openSections[k('leave')]} onOpenChange={o => toggleSection(k('leave'), o)}>
            <CollapsibleTrigger asChild>
              <SidebarMenuButton size="lg" className={cn(sbMenuBtnReset, sbRow, "mx-0 justify-between", leaveSectionActive ? sbActive : cn(sbIdle, openSections[k('leave')] && "font-semibold text-primary"))}>
                <span className="flex items-center gap-3 min-w-0">
                  <Icon icon="mdi:calendar-clock-outline" className={cn("w-5 h-5 shrink-0", leaveSectionActive ? "text-primary" : "text-gray-400")} />
                  <span className="truncate font-semibold text-sm">Leave Policy</span>
                </span>
                <Icon icon="mdi:chevron-down" className={cn("w-4 h-4 shrink-0 text-gray-500 transition-transform duration-300", openSections[k('leave')] && "rotate-180")} />
              </SidebarMenuButton>
            </CollapsibleTrigger>
            <CollapsibleContent>
              <SidebarMenuSub className="ml-5 mt-1 space-y-0.5 border-l border-border pl-3">
                {(isServiceProvider || isCompanyAdmin || isBranchAdmin || isDesktopManager) && (
                  <SidebarMenuSubItem><SidebarMenuSubButton asChild><Link onClick={(e) => onNav(e)} href="/manage-holidays" className={cn(sbSubRow, isActiveLink('/manage-holidays', companyId) ? sbSubActive : sbSubIdle)}><span className="font-medium truncate" style={{ display: "block" }}>Manage Holidays</span></Link></SidebarMenuSubButton></SidebarMenuSubItem>
                )}
                <SidebarMenuSubItem><SidebarMenuSubButton asChild><Link onClick={(e) => onNav(e)} href="/public-holiday" className={cn(sbSubRow, isActiveLink('/public-holiday', companyId) ? sbSubActive : sbSubIdle)}><span className="font-medium truncate" style={{ display: "block" }}>Public Holiday</span></Link></SidebarMenuSubButton></SidebarMenuSubItem>
                {(isServiceProvider || isCompanyAdmin || isBranchAdmin || isDesktopManager) && (
                  <SidebarMenuSubItem><SidebarMenuSubButton asChild><Link onClick={(e) => onNav(e)} href="/leave-policy" className={cn(sbSubRow, isActiveLink('/leave-policy', companyId) ? sbSubActive : sbSubIdle)}><span className="font-medium truncate" style={{ display: "block" }}>Leave Policy</span></Link></SidebarMenuSubButton></SidebarMenuSubItem>
                )}
              </SidebarMenuSub>
            </CollapsibleContent>
          </Collapsible>
        )}

        {/* Payroll Policy */}
        {canAccessFullHrSections && (
          <Collapsible open={openSections[k('payrollPolicy')]} onOpenChange={o => toggleSection(k('payrollPolicy'), o)}>
            <CollapsibleTrigger asChild>
              <SidebarMenuButton size="lg" className={cn(sbMenuBtnReset, sbRow, "mx-0 justify-between", payrollPolicySectionActive ? sbActive : cn(sbIdle, openSections[k('payrollPolicy')] && "font-semibold text-primary"))}>
                <span className="flex items-center gap-3 min-w-0">
                  <Icon icon="mdi:file-document-edit-outline" className={cn("w-5 h-5 shrink-0", payrollPolicySectionActive ? "text-primary" : "text-gray-400")} />
                  <span className="truncate font-semibold text-sm">Payroll Policy</span>
                </span>
                <Icon icon="mdi:chevron-down" className={cn("w-4 h-4 shrink-0 text-gray-500 transition-transform duration-300", openSections[k('payrollPolicy')] && "rotate-180")} />
              </SidebarMenuButton>
            </CollapsibleTrigger>
            <CollapsibleContent>
              <SidebarMenuSub className="ml-5 mt-1 space-y-0.5 border-l border-border pl-3">
                <SidebarMenuSubItem><SidebarMenuSubButton asChild><Link onClick={(e) => onNav(e)} href="/monthly-salary-cycle" className={cn(sbSubRow, isActiveLink('/monthly-salary-cycle', companyId) ? sbSubActive : sbSubIdle)}><span className="font-medium truncate" style={{ display: "block" }}>Payroll Salary Cycle</span></Link></SidebarMenuSubButton></SidebarMenuSubItem>
                <SidebarMenuSubItem><SidebarMenuSubButton asChild><Link onClick={(e) => onNav(e)} href="/salary-allowances" className={cn(sbSubRow, isActiveLink('/salary-allowances', companyId) ? sbSubActive : sbSubIdle)}><span className="font-medium truncate" style={{ display: "block" }}>Allowances</span></Link></SidebarMenuSubButton></SidebarMenuSubItem>
                <SidebarMenuSubItem><SidebarMenuSubButton asChild><Link onClick={(e) => onNav(e)} href="/salary-deductions" className={cn(sbSubRow, isActiveLink('/salary-deductions', companyId) ? sbSubActive : sbSubIdle)}><span className="font-medium truncate" style={{ display: "block" }}>Deductions</span></Link></SidebarMenuSubButton></SidebarMenuSubItem>
                <SidebarMenuSubItem><SidebarMenuSubButton asChild><Link onClick={(e) => onNav(e)} href="/monthly-pay-grade" className={cn(sbSubRow, isActiveLink('/monthly-pay-grade', companyId) ? sbSubActive : sbSubIdle)}><span className="font-medium truncate" style={{ display: "block" }}>Paygrade</span></Link></SidebarMenuSubButton></SidebarMenuSubItem>
                <SidebarMenuSubItem><SidebarMenuSubButton asChild><Link onClick={(e) => onNav(e)} href="/bonus-setup" className={cn(sbSubRow, isActiveLink('/bonus-setup', companyId) ? sbSubActive : sbSubIdle)}><span className="font-medium truncate" style={{ display: "block" }}>Bonus Rule</span></Link></SidebarMenuSubButton></SidebarMenuSubItem>
              </SidebarMenuSub>
            </CollapsibleContent>
          </Collapsible>
        )}

        {/* Payroll Management */}
        {canAccessFullHrSections && (
          <Collapsible open={openSections[k('salary')]} onOpenChange={o => toggleSection(k('salary'), o)}>
            <CollapsibleTrigger asChild>
              <SidebarMenuButton size="lg" className={cn(sbMenuBtnReset, sbRow, "mx-0 justify-between", salarySectionActive ? sbActive : cn(sbIdle, openSections[k('salary')] && "font-semibold text-primary"))}>
                <span className="flex items-center gap-3 min-w-0">
                  <Icon icon="mdi:currency-usd" className={cn("w-5 h-5 shrink-0", salarySectionActive ? "text-primary" : "text-gray-400")} />
                  <span className="truncate font-semibold text-sm">Payroll Management</span>
                </span>
                <Icon icon="mdi:chevron-down" className={cn("w-4 h-4 shrink-0 text-gray-500 transition-transform duration-300", openSections[k('salary')] && "rotate-180")} />
              </SidebarMenuButton>
            </CollapsibleTrigger>
            <CollapsibleContent>
              <SidebarMenuSub className="ml-5 mt-1 space-y-0.5 border-l border-border pl-3">
                {(isServiceProvider || isCompanyAdmin || isBranchAdmin || isDesktopManager) && (
                  <SidebarMenuSubItem><SidebarMenuSubButton asChild><Link onClick={(e) => onNav(e)} href="/bonus-allocations" className={cn(sbSubRow, isActiveLink('/bonus-allocations', companyId) ? sbSubActive : sbSubIdle)}><span className="font-medium truncate" style={{ display: "block" }}>Bonus Allocations</span></Link></SidebarMenuSubButton></SidebarMenuSubItem>
                )}
                <SidebarMenuSubItem><SidebarMenuSubButton asChild><Link onClick={(e) => onNav(e)} href="/salary-advance" className={cn(sbSubRow, isActiveLink('/salary-advance', companyId) ? sbSubActive : sbSubIdle)}><span className="font-medium truncate" style={{ display: "block" }}>Salary Advances</span></Link></SidebarMenuSubButton></SidebarMenuSubItem>
                <SidebarMenuSubItem><SidebarMenuSubButton asChild><Link onClick={(e) => onNav(e)} href="/reimbursement" className={cn(sbSubRow, isActiveLink('/reimbursement', companyId) ? sbSubActive : sbSubIdle)}><span className="font-medium truncate" style={{ display: "block" }}>Reimbursements</span></Link></SidebarMenuSubButton></SidebarMenuSubItem>
                <SidebarMenuSubItem><SidebarMenuSubButton asChild><Link onClick={(e) => onNav(e)} href="/generate-salary" className={cn(sbSubRow, isActiveLink('/generate-salary', companyId) ? sbSubActive : sbSubIdle)}><span className="font-medium truncate" style={{ display: "block" }}>Run Payroll</span></Link></SidebarMenuSubButton></SidebarMenuSubItem>
                <SidebarMenuSubItem><SidebarMenuSubButton asChild><Link onClick={(e) => onNav(e)} href="/contractor-payout" className={cn(sbSubRow, isActiveLink('/contractor-payout', companyId) ? sbSubActive : sbSubIdle)}><span className="font-medium truncate" style={{ display: "block" }}>Contractor Payouts</span></Link></SidebarMenuSubButton></SidebarMenuSubItem>
              </SidebarMenuSub>
            </CollapsibleContent>
          </Collapsible>
        )}

        {/* Attendance Management - merged into Shift & Attendance Management */}

        {/* Leave Management */}
        {canAccessFullHrSections && (
          <Collapsible open={openSections[k('leaveManagement')]} onOpenChange={o => toggleSection(k('leaveManagement'), o)}>
            <CollapsibleTrigger asChild>
              <SidebarMenuButton size="lg" className={cn(sbMenuBtnReset, sbRow, "mx-0 justify-between", leaveManagementSectionActive ? sbActive : cn(sbIdle, openSections[k('leaveManagement')] && "font-semibold text-primary"))}>
                <span className="flex items-center gap-3 min-w-0">
                  <Icon icon="mdi:calendar-check" className={cn("w-5 h-5 shrink-0", leaveManagementSectionActive ? "text-primary" : "text-gray-400")} />
                  <span className="truncate font-semibold text-sm">Leave Management</span>
                </span>
                <Icon icon="mdi:chevron-down" className={cn("w-4 h-4 shrink-0 text-gray-500 transition-transform duration-300", openSections[k('leaveManagement')] && "rotate-180")} />
              </SidebarMenuButton>
            </CollapsibleTrigger>
            <CollapsibleContent>
              <SidebarMenuSub className="ml-5 mt-1 space-y-0.5 border-l border-border pl-3">
                <SidebarMenuSubItem><SidebarMenuSubButton asChild><Link onClick={(e) => onNav(e)} href="/leave-applications" className={cn(sbSubRow, isActiveLink('/leave-applications', companyId) ? sbSubActive : sbSubIdle)}><span className="font-medium truncate" style={{ display: "block" }}>Leave Application</span></Link></SidebarMenuSubButton></SidebarMenuSubItem>
                {(isServiceProvider || isCompanyAdmin || isBranchAdmin || isDesktopManager) && (
                  <SidebarMenuSubItem><SidebarMenuSubButton asChild><Link onClick={(e) => onNav(e)} href="/privileged-leave" className={cn(sbSubRow, isActiveLink('/privileged-leave', companyId) ? sbSubActive : sbSubIdle)}><span className="font-medium truncate" style={{ display: "block" }}>Privileged Leave</span></Link></SidebarMenuSubButton></SidebarMenuSubItem>
                )}
              </SidebarMenuSub>
            </CollapsibleContent>
          </Collapsible>
        )}

        {/* Canteen Management - temporarily hidden */}
        {false && (isServiceProvider || isCompanyAdmin || isBranchAdmin) && !isAdmin && (
          <Collapsible open={openSections[k('canteen')]} onOpenChange={o => toggleSection(k('canteen'), o)}>
            <CollapsibleTrigger asChild>
              <SidebarMenuButton size="lg" className={cn(sbMenuBtnReset, sbRow, "mx-0 justify-between", canteenSectionActive ? sbActive : cn(sbIdle, openSections[k('canteen')] && "font-semibold text-primary"))}>
                <span className="flex items-center gap-3 min-w-0">
                  <Icon icon="mdi:silverware-fork-knife" className={cn("w-5 h-5 shrink-0", canteenSectionActive ? "text-primary" : "text-gray-400")} />
                  <span className="truncate font-semibold text-sm">Canteen Management</span>
                </span>
                <Icon icon="mdi:chevron-down" className={cn("w-4 h-4 shrink-0 text-gray-500 transition-transform duration-300", openSections[k('canteen')] && "rotate-180")} />
              </SidebarMenuButton>
            </CollapsibleTrigger>
            <CollapsibleContent>
              <SidebarMenuSub className="ml-5 mt-1 space-y-0.5 border-l border-border pl-3">
                <SidebarMenuSubItem><SidebarMenuSubButton asChild><Link onClick={(e) => onNav(e)} href="/canteen" className={cn(sbSubRow, isActiveLink('/canteen', companyId) ? sbSubActive : sbSubIdle)}><span className="font-medium truncate" style={{ display: "block" }}>Dashboard</span></Link></SidebarMenuSubButton></SidebarMenuSubItem>
                <SidebarMenuSubItem><SidebarMenuSubButton asChild><Link onClick={(e) => onNav(e)} href="/canteen/setup" className={cn(sbSubRow, isActiveLink('/canteen/setup', companyId) ? sbSubActive : sbSubIdle)}><span className="font-medium truncate" style={{ display: "block" }}>Configuration</span></Link></SidebarMenuSubButton></SidebarMenuSubItem>
                <SidebarMenuSubItem><SidebarMenuSubButton asChild><Link onClick={(e) => onNav(e)} href="/canteen/reports" className={cn(sbSubRow, isActiveLink('/canteen/reports', companyId) ? sbSubActive : sbSubIdle)}><span className="font-medium truncate" style={{ display: "block" }}>Reports</span></Link></SidebarMenuSubButton></SidebarMenuSubItem>
              </SidebarMenuSub>
            </CollapsibleContent>
          </Collapsible>
        )}

        {/* Reports */}
        {(canSeeCompanySetupSections) && (
          <Collapsible open={openSections[k('reports')]} onOpenChange={o => toggleSection(k('reports'), o)}>
            <CollapsibleTrigger asChild>
              <SidebarMenuButton size="lg" className={cn(sbMenuBtnReset, sbRow, "mx-0 justify-between", reportsSectionActive ? sbActive : cn(sbIdle, openSections[k('reports')] && "font-semibold text-primary"))}>
                <span className="flex items-center gap-3 min-w-0">
                  <Icon icon="mdi:chart-line" className={cn("w-5 h-5 shrink-0", reportsSectionActive ? "text-primary" : "text-gray-400")} />
                  <span className="truncate font-semibold text-sm">Reports</span>
                </span>
                <Icon icon="mdi:chevron-down" className={cn("w-4 h-4 shrink-0 text-gray-500 transition-transform duration-300", openSections[k('reports')] && "rotate-180")} />
              </SidebarMenuButton>
            </CollapsibleTrigger>
            <CollapsibleContent>
              <SidebarMenuSub className="ml-5 mt-1 space-y-0.5 border-l border-border pl-3">
                <SidebarMenuSubItem><SidebarMenuSubButton asChild><Link onClick={(e) => onNav(e)} href="/attendance-reports" className={cn(sbSubRow, isActiveLink('/attendance-reports', companyId) ? sbSubActive : sbSubIdle)}><span className="font-medium truncate" style={{ display: "block" }}>Attendance Reports</span></Link></SidebarMenuSubButton></SidebarMenuSubItem>
                {/* Payroll Reports - temporarily hidden */}
                {/* Leave Reports - temporarily hidden */}
                {/* Canteen Reports - moved to Canteen Management */}
                {/* Contractor Reports - temporarily hidden */}
              </SidebarMenuSub>
            </CollapsibleContent>
          </Collapsible>
        )}

        {/* Settings */}
        {(canSeeCompanySetupSections) && (
          <Collapsible open={openSections[k('settings')]} onOpenChange={o => toggleSection(k('settings'), o)}>
            <CollapsibleTrigger asChild>
              <SidebarMenuButton size="lg" className={cn(sbMenuBtnReset, sbRow, "mx-0 justify-between", settingsSectionActive ? sbActive : cn(sbIdle, openSections[k('settings')] && "font-semibold text-primary"))}>
                <span className="flex items-center gap-3 min-w-0">
                  <Icon icon="mdi:cog-outline" className={cn("w-5 h-5 shrink-0", settingsSectionActive ? "text-primary" : "text-gray-400")} />
                  <span className="truncate font-semibold text-sm">Settings</span>
                </span>
                <Icon icon="mdi:chevron-down" className={cn("w-4 h-4 shrink-0 text-gray-500 transition-transform duration-300", openSections[k('settings')] && "rotate-180")} />
              </SidebarMenuButton>
            </CollapsibleTrigger>
            <CollapsibleContent>
              <SidebarMenuSub className="ml-5 mt-1 space-y-0.5 border-l border-border pl-3">
                {!isAdmin && (<SidebarMenuSubItem><SidebarMenuSubButton asChild><Link onClick={(e) => onNav(e)} href="/import-attendance" className={cn(sbSubRow, isActiveLink('/import-attendance', companyId) ? sbSubActive : sbSubIdle)}><span className="font-medium truncate" style={{ display: "block" }}>Import Attendance</span></Link></SidebarMenuSubButton></SidebarMenuSubItem>)}
                {isAdmin && (<SidebarMenuSubItem><SidebarMenuSubButton asChild><Link onClick={(e) => onNav(e)} href="/hrms-integrations" className={cn(sbSubRow, isActiveLink('/hrms-integrations', companyId) ? sbSubActive : sbSubIdle)}><span className="font-medium truncate" style={{ display: "block" }}>HRMS Integrations</span></Link></SidebarMenuSubButton></SidebarMenuSubItem>)}
                {(isCompanyAdmin || isDesktopManager) && (<SidebarMenuSubItem><SidebarMenuSubButton asChild><Link onClick={(e) => onNav(e)} href="/system-settings/general" className={cn(sbSubRow, isActiveLink('/system-settings/general', companyId) ? sbSubActive : sbSubIdle)}><span className="font-medium truncate" style={{ display: "block" }}>General</span></Link></SidebarMenuSubButton></SidebarMenuSubItem>)}
                {(isCompanyAdmin || isDesktopManager) && (<SidebarMenuSubItem><SidebarMenuSubButton asChild><Link onClick={(e) => onNav(e)} href="/system-settings/compliance" className={cn(sbSubRow, isActiveLink('/system-settings/compliance', companyId) ? sbSubActive : sbSubIdle)}><span className="font-medium truncate" style={{ display: "block" }}>Compliance</span></Link></SidebarMenuSubButton></SidebarMenuSubItem>)}
                {(isCompanyAdmin || isDesktopManager) && (<SidebarMenuSubItem><SidebarMenuSubButton asChild><Link onClick={(e) => onNav(e)} href="/system-settings/email-templates" className={cn(sbSubRow, isActiveLink('/system-settings/email-templates', companyId) ? sbSubActive : sbSubIdle)}><span className="font-medium truncate" style={{ display: "block" }}>Email templates</span></Link></SidebarMenuSubButton></SidebarMenuSubItem>)}
              </SidebarMenuSub>
            </CollapsibleContent>
          </Collapsible>
        )}
      </div>
    )
  }

  const handleLogout = () => {
    const token = localStorage.getItem("token") || localStorage.getItem("accessToken") || "";
    if (token) {
      void fetch(`${process.env.NEXT_PUBLIC_BACKEND_URL || "/backend"}/auth/logout`, {
        method: "POST",
        headers: { Authorization: `Bearer ${token}` },
      }).catch(() => undefined);
    }
    localStorage.removeItem("accessToken");
    localStorage.removeItem("token");
    localStorage.removeItem("user");
    clearActiveCompanySession();
    document.cookie = "accessToken=; path=/; max-age=0; expires=Thu, 01 Jan 1970 00:00:00 UTC; samesite=lax";
    router.push("/login");
  };

  return (
    <div className="min-h-screen bg-background">
      <SidebarProvider open={sidebarOpen} onOpenChange={setSidebarOpen}>
        <Sidebar collapsible="icon" className="border-r border-border bg-card/40 backdrop-blur-sm text-sidebar-foreground">
          <SidebarHeader className="px-4 pt-5 pb-4 border-b border-border">
            <div className="space-y-4">
              <div className="flex items-center justify-between gap-3">
                <Link
                  href={isSuperAdmin ? "/superdashboard" : "/dashboard"}
                  onClick={(e) => handleSidebarNavigation(e, isSuperAdmin ? "/superdashboard" : "/dashboard")}
                  className="flex min-w-0 items-center gap-3"
                >
                  <div className="size-10 rounded-lg bg-primary text-primary-foreground grid place-items-center font-bold text-base shadow-sm shrink-0">
                    O
                  </div>
                  <div className="min-w-0 group-data-[collapsible=icon]:hidden">
                    <span className="font-display text-base font-semibold tracking-tight block truncate">
                      OpenHRM
                    </span>
                    <p className="text-[10px] text-muted-foreground uppercase tracking-wider font-mono mt-0.5">
                      v1.0.0
                    </p>
                  </div>
                </Link>

                <button
                  type="button"
                  onClick={() => {
                    setSidebarRefreshKey((k) => k + 1);
                    dispatchAppRefresh();
                    router.refresh();
                  }}
                  className="p-2 rounded-md text-gray-400 hover:text-primary hover:bg-accent transition-colors shrink-0"
                  title="Refresh data"
                >
                  <Icon icon="mdi:refresh" className="w-6 h-6" />
                </button>
              </div>

  
{canShowCompanySwitcher && (
<DropdownMenu modal={false}>
                    <DropdownMenuTrigger asChild>
                    <button
                      type="button"
                      className="w-full rounded-xl border border-gray-200 bg-white px-3 py-2.5 text-left shadow-sm hover:border-primary/40 hover:bg-[#f8f7ff]"
                      title="Switch company"
                    >
                      <div className="flex items-center gap-2">
                        <Icon icon="mdi:office-building" className="h-4 w-4 shrink-0 text-primary" />
                        <span className="min-w-0 flex-1 truncate text-sm font-semibold text-gray-800">
                          {activeCompany?.companyName || "Select company"}
                        </span>
                        <Icon icon="mdi:chevron-down" className="h-4 w-4 shrink-0 text-gray-400" />
                      </div>
                    </button>
                  </DropdownMenuTrigger>

                  <DropdownMenuContent
                    align="start"
                    sideOffset={6}
                    className="w-[260px] rounded-xl border border-gray-100 bg-white p-1 shadow-xl"
                  >
                    {accessibleCompanies.map((company: any) => {
                      const selected = Number(company.id) === Number(activeCompany?.id);

                      return (
                        <DropdownMenuItem
                          key={company.id}
                          className={cn(
                            "cursor-pointer rounded-lg px-3 py-2 text-sm",
                            selected
                              ? "bg-accent text-primary font-semibold"
                              : "text-gray-700"
                          )}
                          onClick={() => switchCompany(company)}
                        >
                          <Icon
                            icon={selected ? "mdi:check-circle" : "mdi:office-building-outline"}
                            className={cn(
                              "mr-2 h-4 w-4",
                              selected ? "text-primary" : "text-gray-400"
                            )}
                          />
                          <span className="truncate">{company.companyName}</span>
                        </DropdownMenuItem>
                      );
                    })}
                  </DropdownMenuContent>
                </DropdownMenu>
)}
            </div>
          </SidebarHeader>

          <SidebarContent className="px-2.5 py-2 flex-1 overflow-y-auto">
            {canAccessFullHrSections && (
              <SidebarGroup className="hidden group-data-[collapsible=icon]:flex">
                <SidebarMenu className="gap-1.5 flex flex-col">
                  {!isSuperAdmin && (
                    <SidebarMenuItem className="mx-0">
                      <SidebarMenuButton asChild size="lg" className={sbMenuBtnReset}>
                        <Link href="/dashboard" title="Dashboard" className={cn(sbRow, isActiveLink("/dashboard") ? sbActive : sbIdle)}>
                          <Icon icon="mdi:view-dashboard-outline" className={cn("w-5 h-5 shrink-0", isActiveLink("/dashboard") ? "text-primary" : "text-gray-400")} />
                          <span className="sr-only">Dashboard</span>
                        </Link>
                      </SidebarMenuButton>
                    </SidebarMenuItem>
                  )}
                  {isSuperAdmin && [
                    { href: "/superdashboard", icon: "mdi:view-dashboard-outline", label: "Dashboard" },
                    { href: "/service-providers", icon: "mdi:account-supervisor-outline", label: "Service Providers" },
                    { href: "/company", icon: "mdi:domain", label: "Tenants" },
                    { href: "/system-users", icon: "mdi:account-cog-outline", label: "System Users" },
                    { href: "/subscription", icon: "mdi:credit-card-outline", label: "Subscriptions" },
                  ].map((item) => (
                    <SidebarMenuItem key={item.href} className="mx-0">
                      <SidebarMenuButton asChild size="lg" className={sbMenuBtnReset}>
                        <Link
                          href={item.href}
                          title={item.label}
                          onClick={(e) => handleSidebarNavigation(e, item.href)}
                          className={cn(sbRow, isActiveLink(item.href) ? sbActive : sbIdle)}
                        >
                          <Icon icon={item.icon} className={cn("w-5 h-5 shrink-0", isActiveLink(item.href) ? "text-primary" : "text-gray-400")} />
                          <span className="sr-only">{item.label}</span>
                        </Link>
                      </SidebarMenuButton>
                    </SidebarMenuItem>
                  ))}
                  {!isSuperAdmin && [
                    { href: "/company", icon: "mdi:domain", label: "Company Management", paths: SETUP_PATHS },
                    { href: "/contractors", icon: "mdi:briefcase-account", label: "Contractor Management", paths: CONTRACTOR_MANAGEMENT_PATHS },
                    { href: "/manage-employees", icon: "mdi:account-group", label: "Employee Management", paths: EMPLOYEE_PATHS },
                    ...(TASK_MANAGEMENT_ENABLED
                      ? [{ href: "/task-projects", icon: "mdi:clipboard-check-outline", label: "Task Management", paths: TASK_MANAGEMENT_PATHS }]
                      : []),
                    { href: "/roster", icon: "mdi:calendar-clock", label: "Shift & Attendance", paths: PAYROLL_PATHS },
                    { href: "/leave-policy", icon: "mdi:calendar-star", label: "Leave Policy", paths: LEAVE_PATHS },
                    { href: "/monthly-salary-cycle", icon: "mdi:file-document-outline", label: "Payroll Policy", paths: PAYROLL_POLICY_PATHS },
                    { href: "/generate-salary", icon: "mdi:cash-multiple", label: "Payroll Management", paths: SALARY_PATHS },
                    { href: "/leave-applications", icon: "mdi:calendar-remove", label: "Leave Management", paths: LEAVE_MANAGEMENT_PATHS },
                    { href: "/attendance-reports", icon: "mdi:chart-line", label: "Reports", paths: REPORTS_PATHS },
                    { href: "/import-attendance", icon: "mdi:cog-outline", label: "Settings", paths: SETTINGS_PATHS },
                  ].map((item) => (
                    <SidebarMenuItem key={item.href} className="mx-0">
                      <SidebarMenuButton
                        asChild
                        size="lg"
                        className={sbMenuBtnReset}
                      >
                        <Link
                          href={item.href}
                          title={item.label}
                        onClick={(e) => {
  const companyId = activeCompanyID ?? fetchedCompanies[0]?.id;
  const spId = sidebarCtx?.serviceProviderID ?? fetchedServiceProviders[0]?.id;

  if (companyId && spId) {
    const comp = fetchedCompanies.find((c: { id: number }) => c.id === companyId);
    const sp = fetchedServiceProviders.find((s: { id: number }) => s.id === spId);
    setSidebarContext(spId, sp?.companyName ?? "", companyId, comp?.companyName ?? "");
  }

  handleSidebarNavigation(e, item.href);
}}
                          className={cn(
                            sbRow,
                            item.paths.includes(pathname) ? sbActive : sbIdle,
                            "group-data-[collapsible=icon]:!justify-center group-data-[collapsible=icon]:!px-0",
                          )}
                        >
                          <Icon
                            icon={item.icon}
                            className={cn(
                              "w-5 h-5 shrink-0",
                              item.paths.includes(pathname) ? "text-primary" : "text-gray-400",
                            )}
                          />
                          <span className="truncate font-semibold text-sm group-data-[collapsible=icon]:sr-only">
                            {item.label}
                          </span>
                        </Link>
                      </SidebarMenuButton>
                    </SidebarMenuItem>
                  ))}
                </SidebarMenu>
              </SidebarGroup>
            )}

            <SidebarGroup className="group-data-[collapsible=icon]:hidden">
              <SidebarMenu className="gap-1.5 flex flex-col">
                {!isSuperAdmin && (
                  <SidebarMenuItem className="mx-0">
                    <SidebarMenuButton asChild size="lg" className={sbMenuBtnReset}>
                      <Link
                        href="/dashboard"
                        onClick={(e) => handleSidebarNavigation(e, "/dashboard")}
                        className={cn(sbRow, isActiveLink("/dashboard") ? sbActive : sbIdle)}
                      >
                        <Icon icon="mdi:view-dashboard-outline" className={cn("w-5 h-5 shrink-0", isActiveLink("/dashboard") ? "text-primary" : "text-gray-400")} />
                        <span className="truncate font-semibold">Dashboard</span>
                      </Link>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                )}

         {/* ── SUPERADMIN / SERVICE_PROVIDER simple sidebar ── */}
{isPlatformSimpleSidebarUser && (
                  <>
                    <SidebarMenuItem className="mx-0">
                      <SidebarMenuButton asChild size="lg" className={sbMenuBtnReset}>
                        <Link
                       href={isSuperAdmin ? "/superdashboard" : "/dashboard"}
onClick={(e) => handleSidebarNavigation(e, isSuperAdmin ? "/superdashboard" : "/dashboard")}
className={cn(sbRow, isActiveLink(isSuperAdmin ? "/superdashboard" : "/dashboard") ? sbActive : sbIdle)}
                        >
                          <Icon icon="mdi:view-dashboard-outline" className={cn("w-5 h-5 shrink-0", isActiveLink(isSuperAdmin ? "/superdashboard" : "/dashboard") ? "text-primary" : "text-gray-400")} />
                          <span className="truncate font-semibold">Dashboard</span>
                        </Link>
                      </SidebarMenuButton>
                    </SidebarMenuItem>

                    <Collapsible open={openSections["super_system"]} onOpenChange={o => toggleSection("super_system", o)}>
                      <CollapsibleTrigger asChild>
                        <SidebarMenuButton size="lg" className={cn(sbMenuBtnReset, sbRow, "mx-0 justify-between", SUPERADMIN_SYSTEM_PATHS.includes(pathname) ? sbActive : cn(sbIdle, openSections["super_system"] && "font-semibold text-primary"))}>
                          <span className="flex items-center gap-3 min-w-0">
                            <Icon icon="mdi:cog-outline" className={cn("w-5 h-5 shrink-0", SUPERADMIN_SYSTEM_PATHS.includes(pathname) ? "text-primary" : "text-gray-400")} />
                            <span className="truncate font-semibold">System</span>
                          </span>
                          <Icon icon="mdi:chevron-down" className={cn("w-4 h-4 shrink-0 text-gray-500 transition-transform duration-300", openSections["super_system"] && "rotate-180")} />
                        </SidebarMenuButton>
                      </CollapsibleTrigger>
                      <CollapsibleContent>
                        <SidebarMenuSub className="ml-5 mt-1 space-y-0.5 border-l border-border pl-3">
                         {isSuperAdmin && (
  <SidebarMenuSubItem>
    <SidebarMenuSubButton asChild>
      <Link
        href="/service-providers"
        onClick={(e) => handleSidebarNavigation(e, "/service-providers")}
        className={cn(sbSubRow, isActiveLink("/service-providers") ? sbSubActive : sbSubIdle)}
      >
        <span className="font-medium truncate" style={{ display: "block" }}>Service Provider</span>
      </Link>
    </SidebarMenuSubButton>
  </SidebarMenuSubItem>
)}

                          <SidebarMenuSubItem>
                            <SidebarMenuSubButton asChild>
                              <Link
                                href="/company"
                                onClick={(e) => handleSidebarNavigation(e, "/company")}
                                className={cn(sbSubRow, isActiveLink("/company") ? sbSubActive : sbSubIdle)}
                              >
                                <span className="font-medium truncate" style={{ display: "block" }}>Tenants</span>
                              </Link>
                            </SidebarMenuSubButton>
                          </SidebarMenuSubItem>
                        </SidebarMenuSub>
                      </CollapsibleContent>
                </Collapsible>

                    {isServiceProvider && (
                      <Collapsible open={openSections["personal"]} onOpenChange={o => toggleSection("personal", o)}>
                        <CollapsibleTrigger asChild>
                          <SidebarMenuButton size="lg" className={cn(sbMenuBtnReset, sbRow, "mx-0 justify-between", isActiveLink("/service-providers") ? sbActive : cn(sbIdle, openSections["personal"] && "font-semibold text-primary"))}>
                            <span className="flex items-center gap-3 min-w-0">
                              <Icon icon="mdi:account-circle-outline" className={cn("w-5 h-5 shrink-0", isActiveLink("/service-providers") ? "text-primary" : "text-gray-400")} />
                              <span className="truncate font-semibold">Personal</span>
                            </span>
                            <Icon icon="mdi:chevron-down" className={cn("w-4 h-4 shrink-0 text-gray-500 transition-transform duration-300", openSections["personal"] && "rotate-180")} />
                          </SidebarMenuButton>
                        </CollapsibleTrigger>
                        <CollapsibleContent>
                          <SidebarMenuSub className="ml-5 mt-1 space-y-0.5 border-l border-border pl-3">
                            <SidebarMenuSubItem>
                              <SidebarMenuSubButton asChild>
                                <Link
                                  href="/profile"
                                  onClick={(e) => handleSidebarNavigation(e, "/profile")}
                                  className={cn(sbSubRow, isActiveLink("/profile") ? sbSubActive : sbSubIdle)}
                                >
                                  <span className="font-medium truncate" style={{ display: "block" }}>Profile</span>
                                </Link>
                              </SidebarMenuSubButton>
                            </SidebarMenuSubItem>
                          </SidebarMenuSub>
                        </CollapsibleContent>
                      </Collapsible>
                    )}
                  </>
                )}
                
                {/* ── SP → Company → Sections hierarchy ── */}
{isPlatformSimpleSidebarUser ? null : sidebarHierarchyLoading ? (
                    renderSidebarHierarchySkeleton()
                ) : displaySPs.map(sp => {
                  const spCompanies = companiesBySP[sp.id] || []
                  const hasCompanies = spCompanies.length > 0

                  // COMPANY_ADMIN / ADMIN / BRANCH_ADMIN / desktop manager: skip SP wrapper
                  if (isCompanyScopedSidebarUser) {
                    const company = spCompanies[0];

                    return company ? (
                      <SidebarMenuItem key={sp.id} className="mx-0 list-none">
                        {isBranchAdmin && currentUser?.branches?.branchName ? (
                          <div className="ml-0 border-l border-border pl-1">
                            <Collapsible
                              open={openSections[`branch_${currentUser.branchesID}`]}
                              onOpenChange={o => toggleSection(`branch_${currentUser.branchesID}`, o)}
                            >
                              <CollapsibleTrigger asChild>
                                <SidebarMenuButton
                                  size="lg"
                                  className={cn(
                                    sbMenuBtnReset,
                                    sbRow,
                                    "mx-0 justify-between",
                                    cn(sbIdle, openSections[`branch_${currentUser.branchesID}`] && "font-semibold text-primary")
                                  )}
                                >
                                  <span className="flex items-center gap-3 min-w-0">
                                    <Icon
                                      icon="mdi:source-branch"
                                      className={cn(
                                        "w-5 h-5 shrink-0",
                                        openSections[`branch_${currentUser.branchesID}`]
                                          ? "text-primary"
                                          : "text-gray-400"
                                      )}
                                    />
                                    <span className="truncate font-semibold text-sm">
                                      {currentUser.branches.branchName}
                                    </span>
                                  </span>
                                  <Icon
                                    icon="mdi:chevron-down"
                                    className={cn(
                                      "w-4 h-4 shrink-0 text-gray-500 transition-transform duration-300",
                                      openSections[`branch_${currentUser.branchesID}`] && "rotate-180"
                                    )}
                                  />
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
                      </SidebarMenuItem>
                    ) : null;
                  }

                  return (
                    <Collapsible key={sp.id} open={openSections[`sp_${sp.id}`]} onOpenChange={o => toggleSection(`sp_${sp.id}`, o)}>
                      <CollapsibleTrigger asChild>
                        <SidebarMenuButton size="lg" className={cn(sbMenuBtnReset, sbRow, "mx-0 justify-between", cn(sbIdle, openSections[`sp_${sp.id}`] && "font-semibold text-primary"))}>
                          <span className="flex items-center gap-3 min-w-0">
                            <Icon icon="mdi:office-building-outline" className={cn("w-5 h-5 shrink-0", openSections[`sp_${sp.id}`] ? "text-primary" : "text-gray-400")} />
                            <span className="truncate font-semibold">{sp.companyName}</span>
                          </span>
                          <Icon icon="mdi:chevron-down" className={cn("w-4 h-4 shrink-0 text-gray-500 transition-transform duration-300", openSections[`sp_${sp.id}`] && "rotate-180")} />
                        </SidebarMenuButton>
                      </CollapsibleTrigger>
                      <CollapsibleContent>
                        <div className="ml-3 border-l border-border pl-1">
                          {hasCompanies ? (
                            spCompanies.map((company: any) => (
                              <Collapsible key={company.id} open={openSections[`company_${company.id}`]} onOpenChange={o => toggleSection(`company_${company.id}`, o)}>
                                <CollapsibleTrigger asChild>
                                  <SidebarMenuButton size="lg" className={cn(sbMenuBtnReset, sbRow, "mx-0 justify-between", cn(sbIdle, openSections[`company_${company.id}`] && "font-semibold text-primary"))}>
                                    <span className="flex items-center gap-3 min-w-0">
                                      <Icon icon="mdi:domain" className={cn("w-5 h-5 shrink-0", openSections[`company_${company.id}`] ? "text-primary" : "text-gray-400")} />
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

                {/* ── User Management (ADMIN only) ── */}
                {isAdmin && (
                  <SidebarMenuItem className="mx-0">
                    <SidebarMenuButton asChild size="lg" className={sbMenuBtnReset}>
                      <Link href="/system-users" className={cn(sbRow, isActiveLink("/system-users") ? sbActive : sbIdle)}>
                        <Icon icon="mdi:account-cog-outline" className={cn("w-5 h-5 shrink-0", isActiveLink("/system-users") ? "text-primary" : "text-gray-400")} />
                        <span className="truncate font-semibold">User Management</span>
                      </Link>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                )}

                {/* ── Administration (SUPERADMIN only) ── */}
               {isPlatformSimpleSidebarUser && (
  <Collapsible open={openSections['admin']} onOpenChange={o => toggleSection('admin', o)}>
                    <CollapsibleTrigger asChild>
                      <SidebarMenuButton size="lg" className={cn(sbMenuBtnReset, sbRow, "mx-0 justify-between", adminSectionActive ? sbActive : cn(sbIdle, openSections['admin'] && "font-semibold text-primary"))}>
                        <span className="flex items-center gap-3 min-w-0">
                          <Icon icon="mdi:shield-lock-outline" className={cn("w-5 h-5 shrink-0", adminSectionActive ? "text-primary" : "text-gray-400")} />
                          <span className="truncate font-semibold">Administration</span>
                        </span>
                        <Icon icon="mdi:chevron-down" className={cn("w-4 h-4 shrink-0 text-gray-500 transition-transform duration-300", openSections['admin'] && "rotate-180")} />
                      </SidebarMenuButton>
                    </CollapsibleTrigger>
                    <CollapsibleContent>
                      <SidebarMenuSub className="ml-5 mt-1 space-y-0.5 border-l border-border pl-3">
                        <SidebarMenuSubItem>
                          <SidebarMenuSubButton asChild>
                            <Link
                              href="/system-users"
                              onClick={(e) => handleSidebarNavigation(e, "/system-users")}
                              className={cn(sbSubRow, isActiveLink('/system-users') ? sbSubActive : sbSubIdle)}
                            >
                              <span className="font-medium truncate" style={{ display: "block" }}>System Users</span>
                            </Link>
                          </SidebarMenuSubButton>
                        </SidebarMenuSubItem>

                        <SidebarMenuSubItem>
                          <SidebarMenuSubButton asChild>
                            <Link
                              href="/subscription"
                              onClick={(e) => handleSidebarNavigation(e, "/subscription")}
                              className={cn(sbSubRow, isActiveLink('/subscription') ? sbSubActive : sbSubIdle)}
                            >
                              <span className="font-medium truncate" style={{ display: "block" }}>Subscriptions</span>
                            </Link>
                          </SidebarMenuSubButton>
                        </SidebarMenuSubItem>
                      </SidebarMenuSub>
                    </CollapsibleContent>
                  </Collapsible>
                )}

              </SidebarMenu>
            </SidebarGroup>
          </SidebarContent>

          <div className="mt-auto border-t border-border p-4 flex flex-col items-center">
            <p className="text-[10px] text-gray-400 font-medium">v1.0.0</p>
          </div>
        </Sidebar>

        <SidebarInset>
          <div className="min-h-screen bg-background overflow-x-hidden flex flex-col">
            <HrmsTopbar
              user={currentUser}
              onProfileOpen={handleProfileOpen}
              onLogout={handleLogout}
            />
            <main className="flex-1 p-7 lg:p-10 max-w-screen-2xl w-full mx-auto overflow-x-hidden hrms-admin-content">{children}</main>
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
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 items-end">
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
                    <PasswordRuleHints password={profileForm.password} />
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
