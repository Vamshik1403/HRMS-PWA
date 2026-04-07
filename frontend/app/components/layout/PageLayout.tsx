"use client"

import { useState, useEffect, useRef } from "react"
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

interface PageLayoutProps {
  children: React.ReactNode;
}

/** shadcn SidebarMenuButton defaults conflict with pill nav; reset and fixed row height */
const sbMenuBtnReset =
  "!h-11 !min-h-[44px] !max-h-11 !rounded-md !p-0 w-full max-w-full border-0 !bg-transparent !shadow-none hover:!bg-transparent hover:!text-inherit active:!bg-transparent data-[active=true]:!bg-transparent data-[state=open]:!bg-transparent focus-visible:ring-1 focus-visible:ring-gray-900/10";

const sbRow =
  "flex w-full items-center gap-3 rounded-md px-3 h-11 min-h-[44px] max-h-11 shrink-0 transition-colors duration-150";

const sbActive =
  "!bg-[#eef1f6] text-[#1a1a2e] font-medium !shadow-none ring-0 relative overflow-visible before:absolute before:-left-3 before:top-[20%] before:h-[60%] before:w-[3px] before:rounded-r-sm before:bg-[#4f7df3] [&_svg]:!text-[#1a1a2e]";

const sbIdle =
  "text-[#6b7280] hover:bg-[#f3f4f6] hover:text-[#1a1a2e] !bg-transparent";

const sbSubRow =
  "flex w-full items-center rounded-md !px-3 min-h-9 h-9 max-h-9 text-[12px] font-normal transition-colors duration-150";

const sbSubActive =
  "!bg-[#eef1f6] text-[#1a1a2e] font-medium !shadow-none ring-0 relative !pl-6 before:absolute before:left-0 before:top-[30%] before:h-[40%] before:w-[2px] before:rounded-full before:bg-[#4f7df3]";

const sbSubIdle =
  "text-[#6b7280] hover:bg-[#f3f4f6] hover:text-[#1a1a2e] !bg-transparent";

export function PageLayout({ children }: PageLayoutProps) {
  const pathname = usePathname()
  const router = useRouter()
  const currentUser = useCurrentUser()
  const [sidebarOpen, setSidebarOpen] = useState(true)
  const sidebarBeforeDrawerRef = useRef(true)
  const [openSections, setOpenSections] = useState<{ [key: string]: boolean }>({
    setup: false,
    employee: false,
    payroll: false,
    salary: false,
    leave: false,
    shift: false,
    attendance: false,
    reports: false,
    canteen: false
  })

  // Check user role and determine what to show
  const isSuperAdmin = currentUser?.role === 'SUPERADMIN'
  const isManager = currentUser?.role === 'MANAGER'
  const isRegularUser = !isSuperAdmin && !isManager

  // Determine which section should be open based on current path
  useEffect(() => {
    const newOpenSections = {
      setup: false,
      employee: false,
      payroll: false,
      salary: false,
      leave: false,
      shift: false,
      attendance: false,
      reports: false,
      canteen: false
    }

    // Setup section paths
    if (['/company', '/branches', '/devices', '/contractors'].includes(pathname)) {
      newOpenSections.setup = true
    }
    // Employee Management section paths
    else if (['/departments', '/designations', '/manage-employees', '/employees-promotions'].includes(pathname)) {
      newOpenSections.employee = true
    }
    // Payroll Management section paths
    else if (['/work-shifts', '/attendance-policy', '/leave-policy'].includes(pathname)) {
      newOpenSections.payroll = true
    }
    // Salary Management section paths
    else if (['/monthly-salary-cycle', '/salary-allowances', '/salary-deductions', '/monthly-pay-grade', '/salary-advance', '/reimbursement','/bonus-setup', '/bonus-allocations', '/generate-salary'].includes(pathname)) {
      newOpenSections.salary = true
    }
    // Leave Management section paths
    else if (['/manage-holidays', '/public-holiday', '/leave-applications', '/privileged-leave', '/employee-holiday-override', '/employee-weekly-off'].includes(pathname)) {
      newOpenSections.leave = true
    }
    // Shift Management section paths
    else if (['/roster'].includes(pathname)) {
      newOpenSections.shift = true
    }
    // Attendance Management section paths
    else if (['/attendance-logs', '/field-attendance-schedule', '/attendance-regularisation', '/import-attendance'].includes(pathname)) {
      newOpenSections.attendance = true
    }
    // Reports section paths
    else if (['/attendance-reports', '/leave-reports', '/salary-statements', '/canteen/reports'].includes(pathname)) {
      newOpenSections.reports = true
    }
    // Canteen Management section paths
    else if (['/canteen', '/canteen/setup', '/canteen/reports'].includes(pathname)) {
      newOpenSections.canteen = true
    }

    // Default behavior on dashboard (root) route: show Salary section only if user has access
    else if (pathname === '/dashboard') {
      // Only open salary section if user has access to salary management
      if (isSuperAdmin || isManager || isRegularUser) {
        newOpenSections.salary = true
      }
    }

    setOpenSections(newOpenSections)
  }, [pathname, isSuperAdmin, isManager, isRegularUser])

  // Sidebar stays open when form drawers are active
  // (no collapse behavior needed)

  // Function to check if a link is active
  const isActiveLink = (href: string) => pathname === href

  const pageTitle = (() => {
    if (pathname === "/dashboard") return "Dashboard";
    const parts = pathname.split("/").filter(Boolean);
    if (parts.length === 0) return "Dashboard";
    const raw = parts[parts.length - 1];
    return raw
      .split("-")
      .map((s) => s.charAt(0).toUpperCase() + s.slice(1))
      .join(" ");
  })();

  const setupSectionActive = [
    "/company",
    "/branches",
    "/devices",
    "/contractors",
  ].includes(pathname);
  const employeeSectionActive = [
    "/departments",
    "/designations",
    "/manage-employees",
    "/employees-promotions",
  ].includes(pathname);
  const payrollSectionActive = [
    "/work-shifts",
    "/attendance-policy",
    "/leave-policy",
  ].includes(pathname);
  const salarySectionActive = [
    "/monthly-salary-cycle",
    "/salary-allowances",
    "/salary-deductions",
    "/monthly-pay-grade",
    "/salary-advance",
    "/reimbursement",
    "/bonus-setup",
    "/bonus-allocations",
    "/generate-salary",
  ].includes(pathname);
  const leaveSectionActive = [
    "/manage-holidays",
    "/public-holiday",
    "/leave-applications",
    "/privileged-leave",
    "/employee-holiday-override",
    "/employee-weekly-off",
  ].includes(pathname);
  const shiftSectionActive = ["/roster"].includes(pathname);
  const attendanceSectionActive = [
    "/attendance-logs",
    "/field-attendance-schedule",
    "/attendance-regularisation",
    "/import-attendance",
  ].includes(pathname);
  const reportsSectionActive = [
    "/attendance-reports",
    "/leave-reports",
    "/salary-statements",
    "/canteen/reports",
  ].includes(pathname);
  const canteenSectionActive =
    pathname === "/canteen" || pathname === "/canteen/setup";

  return (
    <div className="min-h-screen bg-[#f4f4f4]">
      <SidebarProvider open={sidebarOpen} onOpenChange={setSidebarOpen}>
        <Sidebar className="border-r border-[#e5e5e5] bg-sidebar text-sidebar-foreground">
          <SidebarHeader className="px-4 py-6 border-0">
            <Link href="/dashboard" className="flex items-center gap-3">
              <div className="w-11 h-11 rounded-full bg-gray-900 flex items-center justify-center text-white text-sm font-bold shadow-[0_4px_14px_rgba(0,0,0,0.12)] shrink-0">
                HR
              </div>
              <div className="min-w-0">
                <span className="text-gray-900 font-bold text-sm tracking-tight block truncate">
                  OpenHRM
                </span>
                <p className="text-[11px] text-gray-400">Human resources</p>
              </div>
            </Link>
          </SidebarHeader>
          <SidebarContent className="px-2.5 py-2 flex-1 overflow-y-auto">
            <SidebarGroup>
              <SidebarMenu className="gap-1.5 flex flex-col">
                {/* Dashboard - Show to all users */}
                <SidebarMenuItem className="mx-0">
                  <SidebarMenuButton asChild size="lg" className={sbMenuBtnReset}>
                    <Link
                      href="/dashboard"
                      className={cn(
                        sbRow,
                        isActiveLink("/dashboard") ? sbActive : sbIdle
                      )}
                    >
                      <Icon
                        icon="mdi:view-dashboard-outline"
                        className={cn(
                          "w-5 h-5 shrink-0",
                          isActiveLink("/dashboard")
                            ? "text-gray-900"
                            : "text-gray-500"
                        )}
                      />
                      <span className="truncate font-semibold">Dashboard</span>
                    </Link>
                  </SidebarMenuButton>
                </SidebarMenuItem>
                {isSuperAdmin && (
                  <SidebarMenuItem className="mx-0">
                    <SidebarMenuButton asChild size="lg" className={sbMenuBtnReset}>
                      <Link
                        href="/service-providers"
                        className={cn(
                          sbRow,
                          isActiveLink("/service-providers") ? sbActive : sbIdle
                        )}
                      >
                        <Icon
                          icon="mdi:account-supervisor-outline"
                          className={cn(
                            "w-5 h-5 shrink-0",
                            isActiveLink("/service-providers")
                              ? "text-gray-900"
                              : "text-gray-500"
                          )}
                        />
                        <span className="truncate font-semibold">
                          Service Providers
                        </span>
                      </Link>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                )}

                {/* Setup Section - Only for SUPERADMIN and MANAGER (with restrictions for MANAGER) */}
                {(isSuperAdmin || isManager) && (
                  <Collapsible open={openSections.setup} onOpenChange={(open) => setOpenSections(prev => ({ ...prev, setup: open }))}>
                    <CollapsibleTrigger asChild>
                      <SidebarMenuButton
                        size="lg"
                        className={cn(
                          sbMenuBtnReset,
                          sbRow,
                          "mx-0 justify-between",
                          setupSectionActive
                            ? sbActive
                            : cn(
                                sbIdle,
                                openSections.setup &&
                                  "font-semibold text-gray-900"
                              )
                        )}
                      >
                        <span className="flex items-center gap-3 min-w-0">
                          <Icon
                            icon="mdi:cog-outline"
                            className={cn(
                              "w-5 h-5 shrink-0",
                              setupSectionActive
                                ? "text-gray-900"
                                : "text-gray-500"
                            )}
                          />
                          <span className="truncate font-semibold">Setup</span>
                        </span>
                        <Icon
                          icon="mdi:chevron-down"
                          className={cn(
                            "w-4 h-4 shrink-0 text-gray-500 transition-transform duration-300",
                            openSections.setup && "rotate-180"
                          )}
                        />
                      </SidebarMenuButton>
                    </CollapsibleTrigger>


                    
                  

                    <CollapsibleContent>
                      <SidebarMenuSub className="ml-5 mt-1 space-y-0.5 border-l border-[#f0f0f0] pl-3">
                       
                        {/* Company - Only for SUPERADMIN */}
                        {isSuperAdmin && (
                          <SidebarMenuSubItem>
                            <SidebarMenuSubButton asChild>
                              <Link href="/company" className={cn(sbSubRow,
                                isActiveLink('/company') 
                                  ? sbSubActive
                                  : sbSubIdle
                              )}>
                                <span className="font-medium">Company</span>
                              </Link>
                            </SidebarMenuSubButton>
                          </SidebarMenuSubItem>
                        )}
                        {/* Branches, Devices, Contractors - For both SUPERADMIN and MANAGER */}
                        <SidebarMenuSubItem>
                          <SidebarMenuSubButton asChild>
                            <Link href="/branches" className={cn(sbSubRow,
                              isActiveLink('/branches') 
                                ? sbSubActive
                                : sbSubIdle
                            )}>
                              <span className="font-medium">Branches</span>
                            </Link>
                          </SidebarMenuSubButton>
                        </SidebarMenuSubItem>
                        <SidebarMenuSubItem>
                          <SidebarMenuSubButton asChild>
                            <Link href="/devices" className={cn(sbSubRow,
                              isActiveLink('/devices') 
                                ? sbSubActive
                                : sbSubIdle
                            )}>
                              <span className="font-medium">Devices</span>
                            </Link>
                          </SidebarMenuSubButton>
                        </SidebarMenuSubItem>
                        <SidebarMenuSubItem>
                          <SidebarMenuSubButton asChild>
                            <Link href="/contractors" className={cn(sbSubRow,
                              isActiveLink('/contractors') 
                                ? sbSubActive
                                : sbSubIdle
                            )}>
                              <span className="font-medium">Contractors</span>
                            </Link>
                          </SidebarMenuSubButton>
                        </SidebarMenuSubItem>
                      </SidebarMenuSub>
                    </CollapsibleContent>
                  </Collapsible>
                )}

                {/* Employee Management Section - Only for SUPERADMIN and MANAGER */}
                {(isSuperAdmin || isManager) && (
                  <Collapsible open={openSections.employee} onOpenChange={(open) => setOpenSections(prev => ({ ...prev, employee: open }))}>
                    <CollapsibleTrigger asChild>
                      <SidebarMenuButton
                        size="lg"
                        className={cn(
                          sbMenuBtnReset,
                          sbRow,
                          "mx-0 justify-between",
                          employeeSectionActive
                            ? sbActive
                            : cn(
                                sbIdle,
                                openSections.employee &&
                                  "font-semibold text-gray-900"
                              )
                        )}
                      >
                        <span className="flex items-center gap-3 min-w-0">
                          <Icon
                            icon="mdi:account-group-outline"
                            className={cn(
                              "w-5 h-5 shrink-0",
                              employeeSectionActive
                                ? "text-gray-900"
                                : "text-gray-500"
                            )}
                          />
                          <span className="truncate font-semibold">
                            Employee Management
                          </span>
                        </span>
                        <Icon
                          icon="mdi:chevron-down"
                          className={cn(
                            "w-4 h-4 shrink-0 text-gray-500 transition-transform duration-300",
                            openSections.employee && "rotate-180"
                          )}
                        />
                      </SidebarMenuButton>
                    </CollapsibleTrigger>
                    <CollapsibleContent>
                      <SidebarMenuSub className="ml-5 mt-1 space-y-0.5 border-l border-[#f0f0f0] pl-3">
                        <SidebarMenuSubItem>
                          <SidebarMenuSubButton asChild>
                            <Link href="/departments" className={cn(sbSubRow,
                              isActiveLink('/departments') 
                                ? sbSubActive
                                : sbSubIdle
                            )}>
                              <span className="font-medium">Departments</span>
                            </Link>
                          </SidebarMenuSubButton>
                        </SidebarMenuSubItem>
                        <SidebarMenuSubItem>
                          <SidebarMenuSubButton asChild>
                            <Link href="/designations" className={cn(sbSubRow,
                              isActiveLink('/designations') 
                                ? sbSubActive
                                : sbSubIdle
                            )}>
                              <span className="font-medium">Designations</span>
                            </Link>
                          </SidebarMenuSubButton>
                        </SidebarMenuSubItem>
                        <SidebarMenuSubItem>
                          <SidebarMenuSubButton asChild>
                            <Link href="/manage-employees" className={cn(sbSubRow,
                              isActiveLink('/manage-employees') 
                                ? sbSubActive
                                : sbSubIdle
                            )}>
                              <span className="font-medium">Manage Employees</span>
                            </Link>
                          </SidebarMenuSubButton>
                        </SidebarMenuSubItem>
                        {/* <SidebarMenuSubItem>
                          <SidebarMenuSubButton asChild>
                            <Link href="/employees-promotions" className={cn(sbSubRow,
                              isActiveLink('/employees-promotions') 
                                ? sbSubActive
                                : sbSubIdle
                            )}>
                              <span className="font-medium">Employees Promotions</span>
                            </Link>
                          </SidebarMenuSubButton>
                        </SidebarMenuSubItem>
                        <SidebarMenuSubItem>
                          <SidebarMenuSubButton className={cn(sbSubRow, sbSubIdle, "cursor-default opacity-70")}>
                            <span className="font-medium">Employees Notices</span>
                          </SidebarMenuSubButton>
                        </SidebarMenuSubItem>
                        <SidebarMenuSubItem>
                          <SidebarMenuSubButton className={cn(sbSubRow, sbSubIdle, "cursor-default opacity-70")}>
                            <span className="font-medium">Employees Terminations</span>
                          </SidebarMenuSubButton>
                        </SidebarMenuSubItem> */}
                      </SidebarMenuSub>
                    </CollapsibleContent>
                  </Collapsible>
                )}

                {/* Payroll Management Section - Only for SUPERADMIN and MANAGER */}
                {(isSuperAdmin || isManager) && (
                  <Collapsible open={openSections.payroll} onOpenChange={(open) => setOpenSections(prev => ({ ...prev, payroll: open }))}>
                    <CollapsibleTrigger asChild>
                      <SidebarMenuButton
                        size="lg"
                        className={cn(
                          sbMenuBtnReset,
                          sbRow,
                          "mx-0 justify-between",
                          payrollSectionActive
                            ? sbActive
                            : cn(
                                sbIdle,
                                openSections.payroll &&
                                  "font-semibold text-gray-900"
                              )
                        )}
                      >
                        <span className="flex items-center gap-3 min-w-0">
                          <Icon
                            icon="mdi:account-cash-outline"
                            className={cn(
                              "w-5 h-5 shrink-0",
                              payrollSectionActive
                                ? "text-gray-900"
                                : "text-gray-500"
                            )}
                          />
                          <span className="truncate font-semibold">
                            Payroll Management
                          </span>
                        </span>
                        <Icon
                          icon="mdi:chevron-down"
                          className={cn(
                            "w-4 h-4 shrink-0 text-gray-500 transition-transform duration-300",
                            openSections.payroll && "rotate-180"
                          )}
                        />
                      </SidebarMenuButton>
                    </CollapsibleTrigger>
                    <CollapsibleContent>
                      <SidebarMenuSub className="ml-5 mt-1 space-y-0.5 border-l border-[#f0f0f0] pl-3">
                        <SidebarMenuSubItem>
                          <SidebarMenuSubButton asChild>
                            <Link href="/work-shifts" className={cn(sbSubRow,
                              isActiveLink('/work-shifts') 
                                ? sbSubActive
                                : sbSubIdle
                            )}>
                              <span className="font-medium">Work Shifts</span>
                            </Link>
                          </SidebarMenuSubButton>
                        </SidebarMenuSubItem>
                        <SidebarMenuSubItem>
                          <SidebarMenuSubButton asChild>
                            <Link href="/attendance-policy" className={cn(sbSubRow,
                              isActiveLink('/attendance-policy') 
                                ? sbSubActive
                                : sbSubIdle
                            )}>
                              <span className="font-medium">Attendance Policy</span>
                            </Link>
                          </SidebarMenuSubButton>
                        </SidebarMenuSubItem>
                        <SidebarMenuSubItem>
                          <SidebarMenuSubButton asChild>
                            <Link href="/leave-policy" className={cn(sbSubRow,
                              isActiveLink('/leave-policy') 
                                ? sbSubActive
                                : sbSubIdle
                            )}>
                              <span className="font-medium">Leave Policy</span>
                            </Link>
                          </SidebarMenuSubButton>
                        </SidebarMenuSubItem>
                      </SidebarMenuSub>
                    </CollapsibleContent>
                  </Collapsible>
                )}

                {/* Salary Management Section - Show to all users with different access levels */}
                {(isSuperAdmin || isManager || isRegularUser) && (
                  <Collapsible open={openSections.salary} onOpenChange={(open) => setOpenSections(prev => ({ ...prev, salary: open }))}>
                    <CollapsibleTrigger asChild>
                      <SidebarMenuButton
                        size="lg"
                        className={cn(
                          sbMenuBtnReset,
                          sbRow,
                          "mx-0 justify-between",
                          salarySectionActive
                            ? sbActive
                            : cn(
                                sbIdle,
                                openSections.salary &&
                                  "font-semibold text-gray-900"
                              )
                        )}
                      >
                        <span className="flex items-center gap-3 min-w-0">
                          <Icon
                            icon="mdi:currency-usd"
                            className={cn(
                              "w-5 h-5 shrink-0",
                              salarySectionActive
                                ? "text-gray-900"
                                : "text-gray-500"
                            )}
                          />
                          <span className="truncate font-semibold">
                            Salary Management
                          </span>
                        </span>
                        <Icon
                          icon="mdi:chevron-down"
                          className={cn(
                            "w-4 h-4 shrink-0 text-gray-500 transition-transform duration-300",
                            openSections.salary && "rotate-180"
                          )}
                        />
                      </SidebarMenuButton>
                    </CollapsibleTrigger>
                    <CollapsibleContent>
                      <SidebarMenuSub className="ml-5 mt-1 space-y-0.5 border-l border-[#f0f0f0] pl-3">
                        {/* Full access for SUPERADMIN and MANAGER */}
                        {(isSuperAdmin || isManager) && (
                          <>
                            <SidebarMenuSubItem>
                              <SidebarMenuSubButton asChild>
                                <Link href="/monthly-salary-cycle" className={cn(sbSubRow,
                                  isActiveLink('/monthly-salary-cycle') 
                                    ? sbSubActive
                                    : sbSubIdle
                                )}>
                                  <span className="font-medium">Monthly Salary Cycle</span>
                                </Link>
                              </SidebarMenuSubButton>
                            </SidebarMenuSubItem>
                            <SidebarMenuSubItem>
                              <SidebarMenuSubButton asChild>
                                <Link href="/salary-allowances" className={cn(sbSubRow,
                                  isActiveLink('/salary-allowances') 
                                    ? sbSubActive
                                    : sbSubIdle
                                )}>
                                  <span className="font-medium">Salary Allowances</span>
                                </Link>
                              </SidebarMenuSubButton>
                            </SidebarMenuSubItem>
                            <SidebarMenuSubItem>
                              <SidebarMenuSubButton asChild>
                                <Link href="/salary-deductions" className={cn(sbSubRow,
                                  isActiveLink('/salary-deductions') 
                                    ? sbSubActive
                                    : sbSubIdle
                                )}>
                                  <span className="font-medium">Salary Deductions</span>
                                </Link>
                              </SidebarMenuSubButton>
                            </SidebarMenuSubItem>
                            <SidebarMenuSubItem>
                              <SidebarMenuSubButton asChild>
                                <Link href="/monthly-pay-grade" className={cn(sbSubRow,
                                  isActiveLink('/monthly-pay-grade') 
                                    ? sbSubActive
                                    : sbSubIdle
                                )}>
                                  <span className="font-medium">Monthly Pay Grade</span>
                                </Link>
                              </SidebarMenuSubButton>
                            </SidebarMenuSubItem>
                            <SidebarMenuSubItem>
                              <SidebarMenuSubButton asChild>
                                <Link href="/bonus-setup" className={cn(sbSubRow,
                                  isActiveLink('/bonus-setup') 
                                    ? sbSubActive
                                    : sbSubIdle
                                )}>
                                  <span className="font-medium">Bonus Setup</span>
                                </Link>
                              </SidebarMenuSubButton>
                            </SidebarMenuSubItem>
                            <SidebarMenuSubItem>
                              <SidebarMenuSubButton asChild>
                                <Link href="/bonus-allocations" className={cn(sbSubRow,
                                  isActiveLink('/bonus-allocations') 
                                    ? sbSubActive
                                    : sbSubIdle
                                )}>
                                  <span className="font-medium">Bonus Allocations</span>
                                </Link>
                              </SidebarMenuSubButton>
                            </SidebarMenuSubItem>
                          </>
                        )}
                        
                        {/* Common links for all users - Salary Advance, Reimbursement, Generate Salary */}
                        <SidebarMenuSubItem>
                          <SidebarMenuSubButton asChild>
                            <Link href="/salary-advance" className={cn(sbSubRow,
                              isActiveLink('/salary-advance') 
                                ? sbSubActive
                                : sbSubIdle
                            )}>
                              <span className="font-medium">Salary Advance</span>
                            </Link>
                          </SidebarMenuSubButton>
                        </SidebarMenuSubItem>
                        <SidebarMenuSubItem>
                          <SidebarMenuSubButton asChild>
                            <Link href="/reimbursement" className={cn(sbSubRow,
                              isActiveLink('/reimbursement') 
                                ? sbSubActive
                                : sbSubIdle
                            )}>
                              <span className="font-medium">Reimbursement</span>
                            </Link>
                          </SidebarMenuSubButton>
                        </SidebarMenuSubItem>
                        <SidebarMenuSubItem>
                          <SidebarMenuSubButton asChild>
                            <Link href="/generate-salary" className={cn(sbSubRow,
                              isActiveLink('/generate-salary') 
                                ? sbSubActive
                                : sbSubIdle
                            )}>
                              <span className="font-medium">Generate Salary</span>
                            </Link>
                          </SidebarMenuSubButton>
                        </SidebarMenuSubItem>
                      </SidebarMenuSub>
                    </CollapsibleContent>
                  </Collapsible>
                )}

                {/* Leave Management Section - Show to all users */}
                {(isSuperAdmin || isManager || isRegularUser) && (
                  <Collapsible open={openSections.leave} onOpenChange={(open) => setOpenSections(prev => ({ ...prev, leave: open }))}>
                    <CollapsibleTrigger asChild>
                      <SidebarMenuButton
                        size="lg"
                        className={cn(
                          sbMenuBtnReset,
                          sbRow,
                          "mx-0 justify-between",
                          leaveSectionActive
                            ? sbActive
                            : cn(
                                sbIdle,
                                openSections.leave &&
                                  "font-semibold text-gray-900"
                              )
                        )}
                      >
                        <span className="flex items-center gap-3 min-w-0">
                          <Icon
                            icon="mdi:calendar-clock-outline"
                            className={cn(
                              "w-5 h-5 shrink-0",
                              leaveSectionActive
                                ? "text-gray-900"
                                : "text-gray-500"
                            )}
                          />
                          <span className="truncate font-semibold">
                            Leave Management
                          </span>
                        </span>
                        <Icon
                          icon="mdi:chevron-down"
                          className={cn(
                            "w-4 h-4 shrink-0 text-gray-500 transition-transform duration-300",
                            openSections.leave && "rotate-180"
                          )}
                        />
                      </SidebarMenuButton>
                    </CollapsibleTrigger>
                    <CollapsibleContent>
                      <SidebarMenuSub className="ml-5 mt-1 space-y-0.5 border-l border-[#f0f0f0] pl-3">
                        {/* Manage Holidays only for SUPERADMIN and MANAGER */}
                        {(isSuperAdmin || isManager) && (
                          <SidebarMenuSubItem>
                            <SidebarMenuSubButton asChild>
                              <Link href="/manage-holidays" className={cn(sbSubRow,
                                isActiveLink('/manage-holidays') 
                                  ? sbSubActive
                                  : sbSubIdle
                              )}>
                                <span className="font-medium">Manage Holiday</span>
                              </Link>
                            </SidebarMenuSubButton>
                          </SidebarMenuSubItem>
                        )}
                        
                        {/* Common links for all users - Public Holiday and Leave Applications */}
                        <SidebarMenuSubItem>
                          <SidebarMenuSubButton asChild>
                            <Link href="/public-holiday" className={cn(sbSubRow,
                              isActiveLink('/public-holiday') 
                                ? sbSubActive
                                : sbSubIdle
                            )}>
                              <span className="font-medium">Public Holiday</span>
                            </Link>
                          </SidebarMenuSubButton>
                        </SidebarMenuSubItem>
                        <SidebarMenuSubItem>
                          <SidebarMenuSubButton asChild>
                            <Link href="/leave-applications" className={cn(sbSubRow,
                              isActiveLink('/leave-applications') 
                                ? sbSubActive
                                : sbSubIdle
                            )}>
                              <span className="font-medium">Leave Applications</span>
                            </Link>
                          </SidebarMenuSubButton>
                        </SidebarMenuSubItem>
                        {(isSuperAdmin || isManager) && (
                          <>
                            <SidebarMenuSubItem>
                              <SidebarMenuSubButton asChild>
                                <Link href="/privileged-leave" className={cn(sbSubRow,
                                  isActiveLink('/privileged-leave') 
                                    ? sbSubActive
                                    : sbSubIdle
                                )}>
                                  <span className="font-medium">Privileged Leave</span>
                                </Link>
                              </SidebarMenuSubButton>
                            </SidebarMenuSubItem>
                            <SidebarMenuSubItem>
                              <SidebarMenuSubButton asChild>
                                <Link href="/employee-holiday-override" className={cn(sbSubRow,
                                  isActiveLink('/employee-holiday-override') 
                                    ? sbSubActive
                                    : sbSubIdle
                                )}>
                                  <span className="font-medium">Holiday Override</span>
                                </Link>
                              </SidebarMenuSubButton>
                            </SidebarMenuSubItem>
                            <SidebarMenuSubItem>
                              <SidebarMenuSubButton asChild>
                                <Link href="/employee-weekly-off" className={cn(sbSubRow,
                                  isActiveLink('/employee-weekly-off') 
                                    ? sbSubActive
                                    : sbSubIdle
                                )}>
                                  <span className="font-medium">Weekly Off</span>
                                </Link>
                              </SidebarMenuSubButton>
                            </SidebarMenuSubItem>
                          </>
                        )}
                      </SidebarMenuSub>
                    </CollapsibleContent>
                  </Collapsible>
                )}





















                  {/* Leave Management Section - Show to all users */}
                {(isSuperAdmin || isManager || isRegularUser) && (
                  <Collapsible open={openSections.shift} onOpenChange={(open) => setOpenSections(prev => ({ ...prev, shift: open }))}>
                    <CollapsibleTrigger asChild>
                      <SidebarMenuButton
                        size="lg"
                        className={cn(
                          sbMenuBtnReset,
                          sbRow,
                          "mx-0 justify-between",
                          shiftSectionActive
                            ? sbActive
                            : cn(
                                sbIdle,
                                openSections.shift &&
                                  "font-semibold text-gray-900"
                              )
                        )}
                      >
                        <span className="flex items-center gap-3 min-w-0">
                          <Icon
                            icon="mdi:calendar-month-outline"
                            className={cn(
                              "w-5 h-5 shrink-0",
                              shiftSectionActive
                                ? "text-gray-900"
                                : "text-gray-500"
                            )}
                          />
                          <span className="truncate font-semibold">
                            Shift Management
                          </span>
                        </span>
                        <Icon
                          icon="mdi:chevron-down"
                          className={cn(
                            "w-4 h-4 shrink-0 text-gray-500 transition-transform duration-300",
                            openSections.shift && "rotate-180"
                          )}
                        />
                      </SidebarMenuButton>
                    </CollapsibleTrigger>
                    <CollapsibleContent>
                      <SidebarMenuSub className="ml-5 mt-1 space-y-0.5 border-l border-[#f0f0f0] pl-3">
                        {/* Manage Holidays only for SUPERADMIN and MANAGER */}
                        {(isSuperAdmin || isManager) && (
                          <SidebarMenuSubItem>
                            <SidebarMenuSubButton asChild>
                              <Link href="/roster" className={cn(sbSubRow,
                                isActiveLink('/roster') 
                                  ? sbSubActive
                                  : sbSubIdle
                              )}>
                                <span className="font-medium">Manage Roster</span>
                              </Link>
                            </SidebarMenuSubButton>
                          </SidebarMenuSubItem>
                        )}
                        

                        {/* <SidebarMenuSubItem>
                          <SidebarMenuSubButton asChild>
                            <Link href="/leave-applications" className={cn(sbSubRow,
                              isActiveLink('/leave-applications') 
                                ? sbSubActive
                                : sbSubIdle
                            )}>
                              <span className="font-medium">Leave Applications</span>
                            </Link>
                          </SidebarMenuSubButton>
                        </SidebarMenuSubItem> */}
                      </SidebarMenuSub>
                    </CollapsibleContent>
                  </Collapsible>
                )}

















                {/* Attendance Management Section - Only for SUPERADMIN and MANAGER */}
                {(isSuperAdmin || isManager) && (
                  <Collapsible open={openSections.attendance} onOpenChange={(open) => setOpenSections(prev => ({ ...prev, attendance: open }))}>
                    <CollapsibleTrigger asChild>
                      <SidebarMenuButton
                        size="lg"
                        className={cn(
                          sbMenuBtnReset,
                          sbRow,
                          "mx-0 justify-between",
                          attendanceSectionActive
                            ? sbActive
                            : cn(
                                sbIdle,
                                openSections.attendance &&
                                  "font-semibold text-gray-900"
                              )
                        )}
                      >
                        <span className="flex items-center gap-3 min-w-0">
                          <Icon
                            icon="mdi:clock-check-outline"
                            className={cn(
                              "w-5 h-5 shrink-0",
                              attendanceSectionActive
                                ? "text-gray-900"
                                : "text-gray-500"
                            )}
                          />
                          <span className="truncate font-semibold">
                            Attendance Management
                          </span>
                        </span>
                        <Icon
                          icon="mdi:chevron-down"
                          className={cn(
                            "w-4 h-4 shrink-0 text-gray-500 transition-transform duration-300",
                            openSections.attendance && "rotate-180"
                          )}
                        />
                      </SidebarMenuButton>
                    </CollapsibleTrigger>
                    <CollapsibleContent>
                      <SidebarMenuSub className="ml-5 mt-1 space-y-0.5 border-l border-[#f0f0f0] pl-3">
                        
                        <SidebarMenuSubItem>
                          <SidebarMenuSubButton asChild>
                            <Link href="/field-attendance-schedule" className={cn(sbSubRow,
                              isActiveLink('/field-attendance-schedule') 
                                ? sbSubActive
                                : sbSubIdle
                            )}>
                              <span className="font-medium">Field Attendance Schedule</span>
                            </Link>
                          </SidebarMenuSubButton>
                        </SidebarMenuSubItem>
                        <SidebarMenuSubItem>
                          <SidebarMenuSubButton asChild>
                            <Link href="/attendance-regularisation" className={cn(sbSubRow,
                              isActiveLink('/attendance-regularisation') 
                                ? sbSubActive
                                : sbSubIdle
                            )}>
                              <span className="font-medium">Attendance Regularisation</span>
                            </Link>
                          </SidebarMenuSubButton>
                        </SidebarMenuSubItem>
                        <SidebarMenuSubItem>
                          <SidebarMenuSubButton asChild>
                            <Link href="/import-attendance" className={cn(sbSubRow,
                              isActiveLink('/import-attendance') 
                                ? sbSubActive
                                : sbSubIdle
                            )}>
                              <span className="font-medium">Import Attendance</span>
                            </Link>
                          </SidebarMenuSubButton>
                        </SidebarMenuSubItem>
                      </SidebarMenuSub>
                    </CollapsibleContent>
                  </Collapsible>
                )}

                {/* Reports Section - Only for SUPERADMIN and MANAGER */}
                {(isSuperAdmin || isManager) && (
                  <Collapsible open={openSections.reports} onOpenChange={(open) => setOpenSections(prev => ({ ...prev, reports: open }))}>
                    <CollapsibleTrigger asChild>
                      <SidebarMenuButton
                        size="lg"
                        className={cn(
                          sbMenuBtnReset,
                          sbRow,
                          "mx-0 justify-between",
                          reportsSectionActive
                            ? sbActive
                            : cn(
                                sbIdle,
                                openSections.reports &&
                                  "font-semibold text-gray-900"
                              )
                        )}
                      >
                        <span className="flex items-center gap-3 min-w-0">
                          <Icon
                            icon="mdi:chart-line"
                            className={cn(
                              "w-5 h-5 shrink-0",
                              reportsSectionActive
                                ? "text-gray-900"
                                : "text-gray-500"
                            )}
                          />
                          <span className="truncate font-semibold">
                            Reports
                          </span>
                        </span>
                        <Icon
                          icon="mdi:chevron-down"
                          className={cn(
                            "w-4 h-4 shrink-0 text-gray-500 transition-transform duration-300",
                            openSections.reports && "rotate-180"
                          )}
                        />
                      </SidebarMenuButton>
                    </CollapsibleTrigger>
                    <CollapsibleContent>
                      <SidebarMenuSub className="ml-5 mt-1 space-y-0.5 border-l border-[#f0f0f0] pl-3">
                        <SidebarMenuSubItem>
                          <SidebarMenuSubButton asChild>
                            <Link href="/attendance-reports" className={cn(sbSubRow,
                              isActiveLink('/attendance-reports') 
                                ? sbSubActive
                                : sbSubIdle
                            )}>
                              <span className="font-medium">Attendance Reports</span>
                            </Link>
                          </SidebarMenuSubButton>
                        </SidebarMenuSubItem>
                        <SidebarMenuSubItem>
                          <SidebarMenuSubButton asChild>
                            <Link href="/leave-reports" className={cn(sbSubRow,
                              isActiveLink('/leave-reports') 
                                ? sbSubActive
                                : sbSubIdle
                            )}>
                              <span className="font-medium">Leave Reports</span>
                            </Link>
                          </SidebarMenuSubButton>
                        </SidebarMenuSubItem>
                        {/* <SidebarMenuSubItem>
                          <SidebarMenuSubButton asChild>
                            <Link href="/salary-statements" className={cn(sbSubRow,
                              isActiveLink('/salary-statements') 
                                ? sbSubActive
                                : sbSubIdle
                            )}>
                              <span className="font-medium">Salary Statements</span>
                            </Link>
                          </SidebarMenuSubButton>
                        </SidebarMenuSubItem> */}
                        <SidebarMenuSubItem>
                          <SidebarMenuSubButton asChild>
                            <Link href="/canteen/reports" className={cn(sbSubRow,
                              isActiveLink('/canteen/reports') 
                                ? sbSubActive
                                : sbSubIdle
                            )}>
                              <span className="font-medium">Canteen Reports</span>
                            </Link>
                          </SidebarMenuSubButton>
                        </SidebarMenuSubItem>
                      </SidebarMenuSub>
                    </CollapsibleContent>
                  </Collapsible>
                )}
                {/* Canteen Management Section */}
                {(isSuperAdmin || isManager) && (
                  <Collapsible open={openSections.canteen} onOpenChange={(open) => setOpenSections(prev => ({ ...prev, canteen: open }))}>
                    <CollapsibleTrigger asChild>
                      <SidebarMenuButton
                        size="lg"
                        className={cn(
                          sbMenuBtnReset,
                          sbRow,
                          "mx-0 justify-between",
                          canteenSectionActive
                            ? sbActive
                            : cn(
                                sbIdle,
                                openSections.canteen &&
                                  "font-semibold text-gray-900"
                              )
                        )}
                      >
                        <span className="flex items-center gap-3 min-w-0">
                          <Icon
                            icon="mdi:silverware-fork-knife"
                            className={cn(
                              "w-5 h-5 shrink-0",
                              canteenSectionActive
                                ? "text-gray-900"
                                : "text-gray-500"
                            )}
                          />
                          <span className="truncate font-semibold">
                            Canteen Management
                          </span>
                        </span>
                        <Icon
                          icon="mdi:chevron-down"
                          className={cn(
                            "w-4 h-4 shrink-0 text-gray-500 transition-transform duration-300",
                            openSections.canteen && "rotate-180"
                          )}
                        />
                      </SidebarMenuButton>
                    </CollapsibleTrigger>
                    <CollapsibleContent>
                      <SidebarMenuSub className="ml-5 mt-1 space-y-0.5 border-l border-[#f0f0f0] pl-3">
                        <SidebarMenuSubItem>
                          <SidebarMenuSubButton asChild>
                            <Link href="/canteen" className={cn(sbSubRow,
                              isActiveLink('/canteen') 
                                ? sbSubActive
                                : sbSubIdle
                            )}>
                              <span className="font-medium">Dashboard</span>
                            </Link>
                          </SidebarMenuSubButton>
                        </SidebarMenuSubItem>
                        <SidebarMenuSubItem>
                          <SidebarMenuSubButton asChild>
                            <Link href="/canteen/setup" className={cn(sbSubRow,
                              isActiveLink('/canteen/setup') 
                                ? sbSubActive
                                : sbSubIdle
                            )}>
                              <span className="font-medium">Setup</span>
                            </Link>
                          </SidebarMenuSubButton>
                        </SidebarMenuSubItem>
                        <SidebarMenuSubItem>
                          <SidebarMenuSubButton asChild>
                            <Link href="/canteen/reports" className={cn(sbSubRow,
                              isActiveLink('/canteen/reports') 
                                ? sbSubActive
                                : sbSubIdle
                            )}>
                              <span className="font-medium">Reports</span>
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

          <div className="mt-auto border-t border-[#e8e8e8] p-4 flex flex-col items-center">
            <p className="text-[10px] text-gray-400 font-medium">v1.0.0</p>
          </div>
        </Sidebar>
        <SidebarInset>
          <div className="min-h-screen bg-[#f4f4f4] overflow-x-hidden">
            <header className="sticky top-0 z-30 bg-[#f4f4f4]/95 backdrop-blur-sm px-4 sm:px-8 pt-5 pb-4">
              <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
                <div className="flex items-center gap-3 min-w-0">
                  <SidebarTrigger className="text-gray-500 hover:text-gray-800 hover:bg-white rounded-full h-10 w-10 shrink-0 border border-[#e8e8e8] shadow-sm" />
                  <h1 className="text-2xl sm:text-[1.65rem] font-bold text-gray-900 tracking-tight truncate">
                    {pageTitle}
                  </h1>
                </div>
                <div className="flex flex-1 flex-col sm:flex-row items-stretch sm:items-center gap-3 lg:max-w-2xl lg:mx-6">
                  <div className="flex flex-1 items-center gap-2.5 bg-white rounded-full border border-[#e8e8e8] shadow-[0_2px_12px_rgba(0,0,0,0.04)] px-4 py-2.5 min-w-0">
                    <Icon icon="mdi:magnify" className="w-5 h-5 text-gray-400 shrink-0" />
                    <Input
                      type="search"
                      placeholder="Search anything..."
                      className="border-0 bg-transparent shadow-none focus-visible:ring-0 h-8 px-0 text-sm placeholder:text-gray-400"
                    />
                  </div>
                </div>
                <div className="flex items-center justify-end gap-2 sm:gap-2 shrink-0">
                  {(isSuperAdmin || isManager) && (
                    <Link
                      href="/manage-employees"
                      title="Employees"
                      className="p-2.5 rounded-full bg-white border border-[#e8e8e8] shadow-sm text-gray-600 hover:bg-[#fafafa] hover:text-gray-900 transition-colors"
                      aria-label="Manage employees"
                    >
                      <Icon
                        icon="mdi:account-group-outline"
                        className="w-[22px] h-[22px]"
                      />
                    </Link>
                  )}
                  <Link
                    href="/attendance-logs"
                    title="Attendance logs"
                    className="p-2.5 rounded-full bg-white border border-[#e8e8e8] shadow-sm text-gray-600 hover:bg-[#fafafa] hover:text-gray-900 transition-colors hidden sm:flex"
                    aria-label="Attendance logs"
                  >
                    <Icon
                      icon="mdi:clipboard-text-clock-outline"
                      className="w-[22px] h-[22px]"
                    />
                  </Link>
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <button
                        type="button"
                        className="flex items-center gap-2 cursor-pointer focus:outline-none rounded-full pl-1 pr-1 py-1 hover:bg-white/80 transition-colors"
                      >
                        <Avatar className="w-10 h-10 ring-[3px] ring-white shadow-md">
                          <AvatarImage src="" />
                          <AvatarFallback className="bg-gray-900 text-white text-sm font-bold">
                            {currentUser?.username?.[0]?.toUpperCase() || "A"}
                          </AvatarFallback>
                        </Avatar>
                      </button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end" className="w-52 rounded-2xl">
                      <div className="px-3 py-2 border-b border-gray-100">
                        <p className="text-sm font-semibold text-gray-900 truncate">
                          {currentUser?.username || "User"}
                        </p>
                        <p className="text-[11px] text-gray-400 font-medium mt-0.5">
                          {currentUser?.role || "—"}
                        </p>
                      </div>
                      <DropdownMenuItem
                        className="cursor-pointer text-red-600 focus:text-red-600 rounded-xl m-1"
                        onClick={() => {
                          localStorage.removeItem("accessToken");
                          localStorage.removeItem("user");
                          document.cookie =
                            "accessToken=; expires=Thu, 01 Jan 1970 00:00:00 UTC; path=/;";
                          router.push("/login");
                        }}
                      >
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
    </div>
  );
}
