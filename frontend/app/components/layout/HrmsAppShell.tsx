"use client";

import { useState, useEffect, useMemo, useCallback } from "react";
import { useRouter } from "next/navigation";
import { Eye, EyeOff } from "lucide-react";
import { useCurrentUser } from "@/app/hooks/useCurrentUser";
import { authHeaders } from "@/lib/auth";
import { setSidebarContext, getSidebarContext } from "@/app/utils/sidebarContext";
import { getPageCache, setPageCache } from "@/app/utils/pageCache";
import { isDesktopManagerFlagSet } from "@/lib/desktopManager";
import { hasCompanyAccessFlag } from "@/lib/companyAccess";
import { dispatchAppRefresh } from "@/app/utils/appRefresh";
import { ensureFetchRefreshPatch } from "@/app/utils/patchFetchForRefresh";
import { toast } from "sonner";
import { HrmsSidebar } from "@/app/components/app/hrms-sidebar";
import { HrmsTopbar } from "@/app/components/app/hrms-topbar";
import { buildNavContext } from "@/app/components/app/hrms-navigation";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/app/components/ui/dialog";
import { Button } from "@/app/components/ui/button";
import { Input } from "@/app/components/ui/input";
import { Label } from "@/app/components/ui/label";

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

function getStoredActiveCompanyID(): number {
  if (typeof window === "undefined") return 0;
  try {
    return Number(sessionStorage.getItem("activeCompanyID") || 0);
  } catch {
    return 0;
  }
}

export function HrmsAppShell({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const currentUser = useCurrentUser();
  const [collapsed, setCollapsed] = useState(false);
  const [sidebarRefreshKey, setSidebarRefreshKey] = useState(0);
  const [fetchedServiceProviders, setFetchedServiceProviders] = useState<any[]>(
    () => getPageCache<any[]>("sidebarSPs") ?? [],
  );
  const [fetchedCompanies, setFetchedCompanies] = useState<any[]>(
    () => getPageCache<any[]>("sidebarCompanies") ?? [],
  );
  const [desktopManager, setDesktopManager] = useState(false);

  const [profileOpen, setProfileOpen] = useState(false);
  const [profileForm, setProfileForm] = useState({
    username: "",
    password: "",
    confirmPassword: "",
    fullName: "",
    email: "",
    mobileNo: "",
    address: "",
    city: "",
    state: "",
    pincode: "",
  });
  const [profileSaving, setProfileSaving] = useState(false);
  const [profileLoading, setProfileLoading] = useState(false);
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);

  useEffect(() => {
    ensureFetchRefreshPatch();
  }, []);

  useEffect(() => {
    setDesktopManager(isDesktopManagerFlagSet());
  }, [currentUser?.id]);

  const assignedCompanyIds = useMemo(() => getUserCompanyIds(currentUser), [currentUser]);

  const isSuperAdmin = currentUser?.role === "SUPERADMIN";
  const isCompanyScopedSidebarUser =
    currentUser?.role === "COMPANY_ADMIN" ||
    currentUser?.role === "ADMIN" ||
    currentUser?.role === "BRANCH_ADMIN" ||
    (currentUser?.role === "EMPLOYEE" &&
      (desktopManager || hasCompanyAccessFlag()));

  const navContext = buildNavContext(currentUser, desktopManager);

  useEffect(() => {
    const fetchData = async () => {
      try {
        const [spRes, compRes] = await Promise.all([
          fetch("/backend/service-provider"),
          fetch("/backend/company"),
        ]);
        if (spRes.ok) {
          const data = await spRes.json();
          if (Array.isArray(data)) {
            setFetchedServiceProviders(data);
            setPageCache("sidebarSPs", data);
          }
        }
        if (compRes.ok) {
          const data = await compRes.json();
          const companies = Array.isArray(data) ? data : data?.data ?? [];
          setFetchedCompanies(companies);
          setPageCache("sidebarCompanies", companies);
        }
      } catch {
        /* ignore */
      }
    };
    fetchData();
  }, [sidebarRefreshKey]);

  const displaySPs = useMemo(() => {
    if (currentUser?.serviceProvider && currentUser.serviceProviderID) {
      return [{ id: currentUser.serviceProviderID, companyName: currentUser.serviceProvider.companyName }];
    }
    return fetchedServiceProviders.map((sp) => ({
      id: sp.id,
      companyName: sp.companyName || "Service Provider",
    }));
  }, [currentUser?.serviceProvider, currentUser?.serviceProviderID, fetchedServiceProviders]);

  const accessibleCompanies = useMemo(() => {
    return displaySPs.flatMap((sp) => {
      let companies = fetchedCompanies.filter((c) => c.serviceProviderID === sp.id);
      if (isCompanyScopedSidebarUser && assignedCompanyIds.length > 0) {
        companies = companies.filter((c) => assignedCompanyIds.includes(Number(c.id)));
      }
      return companies.map((company: any) => ({
        ...company,
        serviceProviderID: sp.id,
        serviceProviderName: sp.companyName || "",
      }));
    });
  }, [displaySPs, fetchedCompanies, isCompanyScopedSidebarUser, assignedCompanyIds]);

  const sidebarCtx = getSidebarContext();

  const activeCompany = useMemo(() => {
    const storedCompanyID = getStoredActiveCompanyID();
    return (
      accessibleCompanies.find((c: any) => Number(c.id) === storedCompanyID) ||
      accessibleCompanies.find((c: any) => Number(c.id) === Number(sidebarCtx?.companyID)) ||
      accessibleCompanies.find((c: any) => Number(c.id) === Number(currentUser?.companyID)) ||
      accessibleCompanies[0]
    );
  }, [accessibleCompanies, sidebarCtx?.companyID, currentUser?.companyID]);

  const switchCompany = useCallback(
    (company: any) => {
      if (!company?.id) return;
      setSidebarContext(
        company.serviceProviderID,
        company.serviceProviderName || "",
        company.id,
        company.companyName || "",
      );
      const userData = JSON.parse(localStorage.getItem("user") || "{}");
      userData.activeCompanyID = company.id;
      userData.companyID = company.id;
      userData.company = { id: company.id, companyName: company.companyName };
      localStorage.setItem("user", JSON.stringify(userData));
      sessionStorage.setItem("activeCompanyID", String(company.id));
      window.dispatchEvent(new Event("sidebar-context-changed"));
      window.dispatchEvent(new Event("app-data-refresh"));
      dispatchAppRefresh();
      router.push(
        currentUser?.role === "EMPLOYEE" ? "/empCompanyDashboard" : "/dashboard",
      );
    },
    [router, currentUser?.role],
  );

  useEffect(() => {
    if (!isCompanyScopedSidebarUser || accessibleCompanies.length === 0 || !activeCompany) return;
    const ctx = getSidebarContext();
    if (!ctx || Number(ctx.companyID) !== Number(activeCompany.id)) {
      setSidebarContext(
        activeCompany.serviceProviderID,
        activeCompany.serviceProviderName || "",
        activeCompany.id,
        activeCompany.companyName || "",
      );
    }
  }, [isCompanyScopedSidebarUser, accessibleCompanies.length, activeCompany?.id, activeCompany]);

  const handleRefresh = () => {
    setSidebarRefreshKey((k) => k + 1);
    dispatchAppRefresh();
    router.refresh();
  };

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
    try {
      localStorage.removeItem("openhrmCompanyAccess");
      localStorage.removeItem("openhrmDesktopManager");
    } catch {
      /* ignore */
    }
    document.cookie = "accessToken=; path=/; max-age=0; expires=Thu, 01 Jan 1970 00:00:00 UTC; samesite=lax";
    router.push("/login");
  };

  const handleProfileOpen = async () => {
    setProfileForm({
      username: currentUser?.username || "",
      password: "",
      confirmPassword: "",
      fullName: "",
      email: "",
      mobileNo: "",
      address: "",
      city: "",
      state: "",
      pincode: "",
    });
    setProfileOpen(true);
    setProfileLoading(true);
    try {
      const res = await fetch(`/backend/users/${currentUser?.id}/profile`, { headers: authHeaders() });
      if (res.ok) {
        const data = await res.json();
        if (data) {
          setProfileForm((prev) => ({
            ...prev,
            fullName: data.fullName || "",
            email: data.email || "",
            mobileNo: data.mobileNo || "",
            address: data.address || "",
            city: data.city || "",
            state: data.state || "",
            pincode: data.pincode || "",
          }));
        }
      }
    } catch {
      /* ignore */
    } finally {
      setProfileLoading(false);
    }
  };

  const handleProfileSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (profileForm.password && profileForm.password !== profileForm.confirmPassword) {
      toast.error("Passwords do not match");
      return;
    }
    setProfileSaving(true);
    try {
      const payload: any = { username: profileForm.username };
      if (profileForm.password) payload.password = profileForm.password;
      const res = await fetch(`/backend/users/${currentUser?.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json", ...authHeaders() },
        body: JSON.stringify(payload),
      });
      if (!res.ok) throw new Error(await res.text());
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
      });
      toast.success("Profile updated successfully");
      setProfileOpen(false);
      window.location.reload();
    } catch (err: any) {
      toast.error(err?.message || "Failed to update profile");
    } finally {
      setProfileSaving(false);
    }
  };

  return (
    <div className="flex h-dvh max-h-dvh overflow-hidden bg-background">
      <HrmsSidebar
        collapsed={collapsed}
        onToggle={() => setCollapsed((v) => !v)}
        user={currentUser}
        navContext={navContext}
        onRefresh={handleRefresh}
        accessibleCompanies={accessibleCompanies}
        activeCompany={activeCompany}
        onSwitchCompany={switchCompany}
        showCompanySwitcher={!!isCompanyScopedSidebarUser || isSuperAdmin}
      />
      <div className="flex-1 flex flex-col min-w-0 min-h-0 overflow-hidden">
        <HrmsTopbar user={currentUser} onProfileOpen={handleProfileOpen} onLogout={handleLogout} />
        <main className="flex-1 h-0 min-h-0 overflow-y-auto overscroll-y-contain scrollbar-auto-hide p-6 lg:p-8 max-w-screen-2xl w-full mx-auto hrms-admin-content">{children}</main>
      </div>

      <Dialog open={profileOpen} onOpenChange={setProfileOpen}>
        <DialogContent className="max-w-lg rounded-xl">
          <DialogHeader>
            <DialogTitle>User Profile</DialogTitle>
          </DialogHeader>
          {profileLoading ? (
            <div className="py-8 text-center text-muted-foreground">Loading profile…</div>
          ) : (
            <form onSubmit={handleProfileSubmit} className="space-y-4 mt-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Full Name</Label>
                  <Input value={profileForm.fullName} onChange={(e) => setProfileForm((p) => ({ ...p, fullName: e.target.value }))} />
                </div>
                <div className="space-y-2">
                  <Label>Email</Label>
                  <Input type="email" value={profileForm.email} onChange={(e) => setProfileForm((p) => ({ ...p, email: e.target.value }))} />
                </div>
                <div className="space-y-2">
                  <Label>Mobile</Label>
                  <Input value={profileForm.mobileNo} onChange={(e) => setProfileForm((p) => ({ ...p, mobileNo: e.target.value }))} />
                </div>
                <div className="space-y-2">
                  <Label>Username</Label>
                  <Input value={profileForm.username} onChange={(e) => setProfileForm((p) => ({ ...p, username: e.target.value }))} required />
                </div>
              </div>
              <div className="border-t pt-4 space-y-4">
                <p className="text-sm text-muted-foreground font-medium">Change password</p>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="space-y-2 relative">
                    <Label>New password</Label>
                    <Input type={showNewPassword ? "text" : "password"} value={profileForm.password} onChange={(e) => setProfileForm((p) => ({ ...p, password: e.target.value }))} className="pr-10" />
                    <button type="button" className="absolute right-3 top-8 text-muted-foreground" onClick={() => setShowNewPassword((v) => !v)}>
                      {showNewPassword ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
                    </button>
                  </div>
                  <div className="space-y-2 relative">
                    <Label>Confirm password</Label>
                    <Input type={showConfirmPassword ? "text" : "password"} value={profileForm.confirmPassword} onChange={(e) => setProfileForm((p) => ({ ...p, confirmPassword: e.target.value }))} className="pr-10" />
                    <button type="button" className="absolute right-3 top-8 text-muted-foreground" onClick={() => setShowConfirmPassword((v) => !v)}>
                      {showConfirmPassword ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
                    </button>
                  </div>
                </div>
              </div>
              <div className="flex justify-end gap-2">
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
