"use client";

import { useState, useEffect, useRef } from "react";
import { toast } from "sonner";
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
} from "../../components/ui/sidebar";
import { Collapsible, CollapsibleTrigger, CollapsibleContent } from "../../components/ui/collapsible";
import { Icon } from "@iconify/react";
import { Avatar, AvatarImage, AvatarFallback } from "../../components/ui/avatar";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "../../components/ui/dropdown-menu";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "../../components/ui/dialog";
import { Button } from "../../components/ui/button";
import { Input } from "../../components/ui/input";
import { Label } from "../../components/ui/label";
import { Eye, EyeOff } from "lucide-react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";

interface EmpLayoutProps {
  children: React.ReactNode;
}

export default function EmpLayout({ children }: EmpLayoutProps) {
  const pathname = usePathname();
  const [showChangePassword, setShowChangePassword] = useState(false);
  const [pwdForm, setPwdForm] = useState({ oldPassword: "", newPassword: "", confirmPassword: "" });
  const [pwdLoading, setPwdLoading] = useState(false);
  const [showOldPwd, setShowOldPwd] = useState(false);
  const [showNewPwd, setShowNewPwd] = useState(false);
  const [showConfirmPwd, setShowConfirmPwd] = useState(false);
  const [showProfile, setShowProfile] = useState(false);

  const handleChangePassword = async () => {
    if (!pwdForm.oldPassword || !pwdForm.newPassword) { toast.error("All fields are required"); return; }
    if (pwdForm.newPassword !== pwdForm.confirmPassword) { toast.error("Passwords do not match"); return; }
    if (pwdForm.newPassword.length < 4) { toast.error("Password must be at least 4 characters"); return; }
    try {
      setPwdLoading(true);
      const user = JSON.parse(localStorage.getItem("user") || "{}");
      const empId = user?.employee?.id;
      if (!empId) { toast.error("Employee not found"); return; }
      const res = await fetch(`/backend/manage-emp/${empId}/change-password`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ oldPassword: pwdForm.oldPassword, newPassword: pwdForm.newPassword }),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => null);
        throw new Error(err?.message || "Failed to change password");
      }
      toast.success("Password changed successfully");
      setShowChangePassword(false);
      setPwdForm({ oldPassword: "", newPassword: "", confirmPassword: "" });
    } catch (err: any) {
      toast.error(err.message || "Failed to change password");
    } finally {
      setPwdLoading(false);
    }
  };

  const [empUser, setEmpUser] = useState<any>(null);

  useEffect(() => {
    try {
      const stored = localStorage.getItem("user");
      if (stored) setEmpUser(JSON.parse(stored));
    } catch {}
  }, []);

  const empDisplayName = empUser?.employee
    ? `${empUser.employee.firstName || ""} ${empUser.employee.lastName || ""}`.trim() || empUser.username || "Employee"
    : empUser?.username || "Employee";
  const empInitials = empDisplayName
    .split(" ")
    .filter(Boolean)
    .slice(0, 2)
    .map((w: string) => w[0].toUpperCase())
    .join("") || "E";

  const [openSections, setOpenSections] = useState({
    leave: false,
  });

  useEffect(() => {
    const newOpen = { leave: false };
    if (["/empLeaveApplication"].includes(pathname)) {
      newOpen.leave = true;
    }
    setOpenSections(newOpen);
  }, [pathname]);

  const isActive = (href: string) => pathname === href;

  return (
    <div className="min-h-screen bg-[#f8fafc]">
      <SidebarProvider>
        {/* Sidebar */}
        <Sidebar collapsible="icon" className="border-r border-[#d1d5db] bg-sidebar text-sidebar-foreground">
          <SidebarHeader className="px-4 py-6 border-0">
            <Link href="/empAttendance" className="flex items-center gap-3">
              <img src="/img/OpenHRM_Logo.png" alt="OpenHRM" className="w-11 h-11 rounded-full object-cover shrink-0 shadow-[0_6px_16px_rgba(79,70,229,0.35)]" />
              <div className="min-w-0">
                <span className="text-[#111827] font-bold text-sm tracking-tight block truncate">OpenHRM</span>
                <p className="text-[11px] text-gray-400">Employee Portal</p>
              </div>
            </Link>
          </SidebarHeader>

          <SidebarContent className="px-2.5 py-2 flex-1 overflow-y-auto">
            <SidebarGroup>
              <SidebarMenu className="gap-1.5 flex flex-col">
                {/* Attendance */}
                <SidebarMenuItem className="mx-0">
                  <SidebarMenuButton asChild>
                    <Link
                      href="/empAttendance"
                      className={`flex w-full items-center gap-3 rounded-md px-3 h-11 min-h-[44px] max-h-11 shrink-0 transition-colors duration-150 ${
                        isActive("/empAttendance")
                          ? "!bg-[#eef2ff] text-[#4f46e5] font-medium relative overflow-visible before:absolute before:-left-3 before:top-[20%] before:h-[60%] before:w-[3px] before:rounded-r-sm before:bg-[#4f46e5]"
                          : "text-[#6b7280] hover:bg-[#f3f4f6] hover:text-[#1a1a2e]"
                      }`}
                    >
                      <Icon icon="mdi:map-marker-check-outline" className={`w-5 h-5 shrink-0 ${isActive("/empAttendance") ? "text-[#4f46e5]" : "text-gray-400"}`} />
                      <span className="text-[13px]">Attendance</span>
                    </Link>
                  </SidebarMenuButton>
                </SidebarMenuItem>

                {/* Leave Management */}
                <Collapsible
                  open={openSections.leave}
                  onOpenChange={(open) =>
                    setOpenSections((prev) => ({ ...prev, leave: open }))
                  }
                >
                  <SidebarMenuItem className="mx-0">
                    <CollapsibleTrigger asChild>
                      <SidebarMenuButton className={`flex w-full items-center gap-3 rounded-md px-3 h-11 min-h-[44px] max-h-11 shrink-0 transition-colors duration-150 ${
                        ["/empLeaveApplication"].includes(pathname)
                          ? "!bg-[#eef2ff] text-[#4f46e5] font-medium"
                          : "text-[#6b7280] hover:bg-[#f3f4f6] hover:text-[#1a1a2e]"
                      }`}>
                        <Icon icon="mdi:calendar-clock-outline" className={`w-5 h-5 shrink-0 ${["/empLeaveApplication"].includes(pathname) ? "text-[#4f46e5]" : "text-gray-400"}`} />
                        <span className="text-[13px]">Leave Policy</span>
                        <Icon
                          icon="mdi:chevron-right"
                          className={`w-4 h-4 ml-auto transition-transform duration-200 text-gray-400 ${
                            openSections.leave ? "rotate-90" : ""
                          }`}
                        />
                      </SidebarMenuButton>
                    </CollapsibleTrigger>
                  </SidebarMenuItem>

                  <CollapsibleContent>
                    <SidebarMenuSub className="ml-4 mt-1 space-y-0.5">
                      {[
                        { href: "/empLeaveApplication", label: "Leave Applications" },
                      ].map((item) => (
                        <SidebarMenuSubItem key={item.href}>
                          <SidebarMenuSubButton asChild>
                            <Link
                              href={item.href}
                              className={`flex w-full items-center rounded-md !px-3 min-h-9 h-9 max-h-9 text-[12px] font-normal transition-colors duration-150 ${
                                isActive(item.href)
                                  ? "!bg-[#eef2ff] text-[#4f46e5] font-medium relative !pl-6 before:absolute before:left-0 before:top-[30%] before:h-[40%] before:w-[2px] before:rounded-full before:bg-[#4f46e5]"
                                  : "text-[#6b7280] hover:bg-[#f3f4f6] hover:text-[#1a1a2e]"
                              }`}
                            >
                              <span>{item.label}</span>
                            </Link>
                          </SidebarMenuSubButton>
                        </SidebarMenuSubItem>
                      ))}
                    </SidebarMenuSub>
                  </CollapsibleContent>
                </Collapsible>
              </SidebarMenu>
            </SidebarGroup>
          </SidebarContent>
        </Sidebar>

        {/* Content Area */}
        <SidebarInset>
          <div className="min-h-screen bg-[#f8fafc] overflow-x-hidden">
            <header className="bg-[#f8fafc] border-b border-[#d1d5db] px-3 sm:px-6 py-3 sm:py-4 flex justify-between items-center">
              <SidebarTrigger className="text-gray-600 hover:bg-gray-100 transition-colors duration-150" />
              <div className="flex items-center gap-4">
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <button type="button" className="flex items-center gap-2 cursor-pointer focus:outline-none rounded-full pl-1 pr-1 py-1 hover:bg-white/80 transition-colors">
                      <Avatar className="w-10 h-10 ring-[3px] ring-white shadow-md">
                        <AvatarFallback className="bg-gray-900 text-white text-sm font-bold">{empInitials}</AvatarFallback>
                      </Avatar>
                    </button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end" className="w-52 rounded-2xl">
                    <div className="px-3 py-2 border-b border-gray-100">
                      <p className="text-sm font-semibold text-gray-900 truncate">{empDisplayName}</p>
                      <p className="text-[11px] text-gray-400 font-medium mt-0.5">Employee</p>
                    </div>
                    <DropdownMenuItem
                      className="cursor-pointer rounded-xl m-1"
                      onClick={() => setShowProfile(true)}
                    >
                      <Icon icon="mdi:account-circle-outline" className="w-4 h-4 mr-2" />
                      User Profile
                    </DropdownMenuItem>
                    <DropdownMenuItem
                      className="cursor-pointer rounded-xl m-1"
                      onClick={() => setShowChangePassword(true)}
                    >
                      <Icon icon="mdi:lock-outline" className="w-4 h-4 mr-2" />
                      Change Password
                    </DropdownMenuItem>
                    <DropdownMenuItem
                      className="cursor-pointer text-red-600 focus:text-red-600"
                      onClick={() => {
                        localStorage.removeItem("accessToken");
                        localStorage.removeItem("user");
                        document.cookie = "accessToken=; path=/; max-age=0; expires=Thu, 01 Jan 1970 00:00:00 UTC; samesite=lax";
                        window.location.href = "/login";
                      }}
                    >
                      <Icon icon="mdi:logout" className="w-4 h-4 mr-2" />
                      Logout
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              </div>
            </header>

            <main className="p-3 sm:p-6">{children}</main>
          </div>
        </SidebarInset>
      </SidebarProvider>

      <Dialog open={showChangePassword} onOpenChange={setShowChangePassword}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Change Password</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label>Current Password</Label>
              <div className="relative">
                <Input type={showOldPwd ? "text" : "password"} value={pwdForm.oldPassword} onChange={(e) => setPwdForm({ ...pwdForm, oldPassword: e.target.value })} className="pr-10" />
                <button type="button" onClick={() => setShowOldPwd(v => !v)} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600" tabIndex={-1}>
                  {showOldPwd ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>
            <div>
              <Label>New Password</Label>
              <div className="relative">
                <Input type={showNewPwd ? "text" : "password"} value={pwdForm.newPassword} onChange={(e) => setPwdForm({ ...pwdForm, newPassword: e.target.value })} className="pr-10" />
                <button type="button" onClick={() => setShowNewPwd(v => !v)} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600" tabIndex={-1}>
                  {showNewPwd ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>
            <div>
              <Label>Confirm New Password</Label>
              <div className="relative">
                <Input type={showConfirmPwd ? "text" : "password"} value={pwdForm.confirmPassword} onChange={(e) => setPwdForm({ ...pwdForm, confirmPassword: e.target.value })} className="pr-10" />
                <button type="button" onClick={() => setShowConfirmPwd(v => !v)} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600" tabIndex={-1}>
                  {showConfirmPwd ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>
            <Button onClick={handleChangePassword} disabled={pwdLoading} className="w-full">
              {pwdLoading ? "Changing..." : "Change Password"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* User Profile Modal */}
      <Dialog open={showProfile} onOpenChange={setShowProfile}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>User Profile</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="flex items-center gap-4 pb-4 border-b border-gray-100">
              <div className="w-14 h-14 rounded-full bg-gray-900 flex items-center justify-center text-white text-xl font-bold shrink-0">
                {empInitials}
              </div>
              <div>
                <p className="text-base font-semibold text-gray-900">{empDisplayName}</p>
                <p className="text-sm text-gray-500">Employee</p>
              </div>
            </div>
            {empUser?.employee?.employeeID && (
              <div className="flex justify-between text-sm">
                <span className="text-gray-500 font-medium">Employee ID</span>
                <span className="font-semibold text-gray-900">{empUser.employee.employeeID}</span>
              </div>
            )}
            {empUser?.employee?.email && (
              <div className="flex justify-between text-sm">
                <span className="text-gray-500 font-medium">Email</span>
                <span className="font-semibold text-gray-900">{empUser.employee.email}</span>
              </div>
            )}
            {empUser?.employee?.department && (
              <div className="flex justify-between text-sm">
                <span className="text-gray-500 font-medium">Department</span>
                <span className="font-semibold text-gray-900">{empUser.employee.department}</span>
              </div>
            )}
            {empUser?.employee?.designation && (
              <div className="flex justify-between text-sm">
                <span className="text-gray-500 font-medium">Designation</span>
                <span className="font-semibold text-gray-900">{empUser.employee.designation}</span>
              </div>
            )}
            {empUser?.employee?.company && (
              <div className="flex justify-between text-sm">
                <span className="text-gray-500 font-medium">Company</span>
                <span className="font-semibold text-gray-900">{empUser.employee.company}</span>
              </div>
            )}
            {empUser?.employee?.branch && (
              <div className="flex justify-between text-sm">
                <span className="text-gray-500 font-medium">Branch</span>
                <span className="font-semibold text-gray-900">{empUser.employee.branch}</span>
              </div>
            )}
            <div className="flex justify-between text-sm">
              <span className="text-gray-500 font-medium">Username</span>
              <span className="font-semibold text-gray-900">{empUser?.username || "—"}</span>
            </div>
            <div className="pt-2">
              <Button variant="outline" className="w-full" onClick={() => { setShowProfile(false); setShowChangePassword(true); }}>
                <Icon icon="mdi:lock-outline" className="w-4 h-4 mr-2" />
                Change Password
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
