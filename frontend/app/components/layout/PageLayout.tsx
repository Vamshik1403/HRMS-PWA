"use client"

import { useState, useEffect } from "react"
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

interface PageLayoutProps {
  children: React.ReactNode;
}

export function PageLayout({ children }: PageLayoutProps) {
  const pathname = usePathname()
  const router = useRouter()
  const currentUser = useCurrentUser()
  const [openSections, setOpenSections] = useState<{ [key: string]: boolean }>({
    setup: false,
    employee: false,
    payroll: false,
    salary: false,
    leave: false,
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
      attendance: false,
      reports: false,
      canteen: false
    }

    // Setup section paths
    if (['/service-providers', '/company', '/branches', '/devices', '/contractors'].includes(pathname)) {
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

  // Function to check if a link is active
  const isActiveLink = (href: string) => pathname === href

  return (
    <div className="min-h-screen bg-background">
      <SidebarProvider>
        <Sidebar className="bg-gradient-to-b from-blue-900 via-blue-800 to-blue-900 border-r border-blue-700 shadow-2xl">
          <SidebarHeader className="p-4 border-b border-blue-700 bg-gradient-to-r from-blue-800 to-blue-700">
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 bg-gradient-to-r from-blue-400 to-blue-500 rounded-lg flex items-center justify-center text-white font-bold text-sm shadow-lg">
                HR
              </div>
              <span className="text-white font-semibold text-sm tracking-wide">OpenHRM</span>
            </div>
          </SidebarHeader>
          <SidebarContent className="py-4">
            <SidebarGroup>
              <SidebarMenu className="space-y-2">
                {/* Dashboard - Show to all users */}
                <SidebarMenuItem>
                  <SidebarMenuButton asChild>
                    <Link href="/dashboard" className={`text-blue-100 hover:text-white hover:bg-gradient-to-r hover:from-blue-700 hover:to-blue-600 transition-all duration-300 rounded-lg mx-2 px-3 py-2.5 shadow-sm hover:shadow-md block ${
                      isActiveLink('/dashboard') 
                        ? 'bg-gradient-to-r from-blue-600 to-blue-500 text-white shadow-md' 
                        : ''
                    }`}>
                      <Icon icon="mdi:view-dashboard" className="w-5 h-5" />
                      <span className="font-medium">Dashboard</span>
                    </Link>
                  </SidebarMenuButton>
                     {/* Service Providers - Only for SUPERADMIN */}
                        {isSuperAdmin && (
                            <SidebarMenuButton asChild>
                              <Link href="/service-providers" className={`text-blue-100 hover:text-white hover:bg-gradient-to-r hover:from-blue-700 hover:to-blue-600 transition-all duration-300 rounded-lg mx-2 px-3 py-2.5 shadow-sm hover:shadow-md block ${
                                isActiveLink('/service-providers') 
                                  ? 'bg-gradient-to-r to-blue-500 text-white shadow-md' 
                                  : 'text-blue-200 hover:text-white hover:bg-blue-700/50'
                              }`}>

                               <Icon icon="mdi:account-group-outline" className="w-5 h-5 mt-2" />

                                <span className="font-medium mt-2">Service Providers</span>
                              </Link>
                            </SidebarMenuButton>
                        )}
                </SidebarMenuItem>

                {/* Setup Section - Only for SUPERADMIN and MANAGER (with restrictions for MANAGER) */}
                {(isSuperAdmin || isManager) && (
                  <Collapsible open={openSections.setup} onOpenChange={(open) => setOpenSections(prev => ({ ...prev, setup: open }))}>
                    <CollapsibleTrigger asChild>
                      <SidebarMenuButton className="text-blue-100 hover:text-white hover:bg-gradient-to-r hover:from-blue-700 hover:to-blue-600 transition-all duration-300 rounded-lg mx-2 px-3 py-2.5 shadow-sm hover:shadow-md">
                        <Icon icon="mdi:cog-outline" className="w-5 h-5" />
                        <span className="font-medium">Setup</span>
                        <Icon 
                          icon="mdi:chevron-right" 
                          className={`w-4 h-4 ml-auto transition-transform duration-300 ${openSections.setup ? 'rotate-90' : ''}`} 
                        />
                      </SidebarMenuButton>
                    </CollapsibleTrigger>


                    
                  

                    <CollapsibleContent>
                      <SidebarMenuSub className="ml-4 mt-2 space-y-1">
                       
                        {/* Company - Only for SUPERADMIN */}
                        {isSuperAdmin && (
                          <SidebarMenuSubItem>
                            <SidebarMenuSubButton asChild>
                              <Link href="/company" className={`transition-all duration-200 rounded-md px-3 py-2 ${
                                isActiveLink('/company') 
                                  ? 'bg-gradient-to-r from-blue-600 to-blue-500 text-white shadow-md' 
                                  : 'text-blue-200 hover:text-white hover:bg-blue-700/50'
                              }`}>
                                <span className="font-medium">Company</span>
                              </Link>
                            </SidebarMenuSubButton>
                          </SidebarMenuSubItem>
                        )}
                        {/* Branches, Devices, Contractors - For both SUPERADMIN and MANAGER */}
                        <SidebarMenuSubItem>
                          <SidebarMenuSubButton asChild>
                            <Link href="/branches" className={`transition-all duration-200 rounded-md px-3 py-2 ${
                              isActiveLink('/branches') 
                                ? 'bg-gradient-to-r from-blue-600 to-blue-500 text-white shadow-md' 
                                : 'text-blue-200 hover:text-white hover:bg-blue-700/50'
                            }`}>
                              <span className="font-medium">Branches</span>
                            </Link>
                          </SidebarMenuSubButton>
                        </SidebarMenuSubItem>
                        <SidebarMenuSubItem>
                          <SidebarMenuSubButton asChild>
                            <Link href="/devices" className={`transition-all duration-200 rounded-md px-3 py-2 ${
                              isActiveLink('/devices') 
                                ? 'bg-gradient-to-r from-blue-600 to-blue-500 text-white shadow-md' 
                                : 'text-blue-200 hover:text-white hover:bg-blue-700/50'
                            }`}>
                              <span className="font-medium">Devices</span>
                            </Link>
                          </SidebarMenuSubButton>
                        </SidebarMenuSubItem>
                        <SidebarMenuSubItem>
                          <SidebarMenuSubButton asChild>
                            <Link href="/contractors" className={`transition-all duration-200 rounded-md px-3 py-2 ${
                              isActiveLink('/contractors') 
                                ? 'bg-gradient-to-r from-blue-600 to-blue-500 text-white shadow-md' 
                                : 'text-blue-200 hover:text-white hover:bg-blue-700/50'
                            }`}>
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
                      <SidebarMenuButton className="text-blue-100 hover:text-white hover:bg-gradient-to-r hover:from-blue-700 hover:to-blue-600 transition-all duration-300 rounded-lg mx-2 px-3 py-2.5 shadow-sm hover:shadow-md">
                        <Icon icon="mdi:account-group-outline" className="w-5 h-5" />
                        <span className="font-medium">Employee Management</span>
                        <Icon 
                          icon="mdi:chevron-right" 
                          className={`w-4 h-4 ml-auto transition-transform duration-300 ${openSections.employee ? 'rotate-90' : ''}`} 
                        />
                      </SidebarMenuButton>
                    </CollapsibleTrigger>
                    <CollapsibleContent>
                      <SidebarMenuSub className="ml-4 mt-2 space-y-1">
                        <SidebarMenuSubItem>
                          <SidebarMenuSubButton asChild>
                            <Link href="/departments" className={`transition-all duration-200 rounded-md px-3 py-2 ${
                              isActiveLink('/departments') 
                                ? 'bg-gradient-to-r from-blue-600 to-blue-500 text-white shadow-md' 
                                : 'text-blue-200 hover:text-white hover:bg-blue-700/50'
                            }`}>
                              <span className="font-medium">Departments</span>
                            </Link>
                          </SidebarMenuSubButton>
                        </SidebarMenuSubItem>
                        <SidebarMenuSubItem>
                          <SidebarMenuSubButton asChild>
                            <Link href="/designations" className={`transition-all duration-200 rounded-md px-3 py-2 ${
                              isActiveLink('/designations') 
                                ? 'bg-gradient-to-r from-blue-600 to-blue-500 text-white shadow-md' 
                                : 'text-blue-200 hover:text-white hover:bg-blue-700/50'
                            }`}>
                              <span className="font-medium">Designations</span>
                            </Link>
                          </SidebarMenuSubButton>
                        </SidebarMenuSubItem>
                        <SidebarMenuSubItem>
                          <SidebarMenuSubButton asChild>
                            <Link href="/manage-employees" className={`transition-all duration-200 rounded-md px-3 py-2 ${
                              isActiveLink('/manage-employees') 
                                ? 'bg-gradient-to-r from-blue-600 to-blue-500 text-white shadow-md' 
                                : 'text-blue-200 hover:text-white hover:bg-blue-700/50'
                            }`}>
                              <span className="font-medium">Manage Employees</span>
                            </Link>
                          </SidebarMenuSubButton>
                        </SidebarMenuSubItem>
                        <SidebarMenuSubItem>
                          <SidebarMenuSubButton asChild>
                            <Link href="/employees-promotions" className={`transition-all duration-200 rounded-md px-3 py-2 ${
                              isActiveLink('/employees-promotions') 
                                ? 'bg-gradient-to-r from-blue-600 to-blue-500 text-white shadow-md' 
                                : 'text-blue-200 hover:text-white hover:bg-blue-700/50'
                            }`}>
                              <span className="font-medium">Employees Promotions</span>
                            </Link>
                          </SidebarMenuSubButton>
                        </SidebarMenuSubItem>
                        <SidebarMenuSubItem>
                          <SidebarMenuSubButton className="text-blue-200 hover:text-white hover:bg-blue-700/50 transition-all duration-200 rounded-md px-3 py-2">
                            <span className="font-medium">Employees Notices</span>
                          </SidebarMenuSubButton>
                        </SidebarMenuSubItem>
                        <SidebarMenuSubItem>
                          <SidebarMenuSubButton className="text-blue-200 hover:text-white hover:bg-blue-700/50 transition-all duration-200 rounded-md px-3 py-2">
                            <span className="font-medium">Employees Terminations</span>
                          </SidebarMenuSubButton>
                        </SidebarMenuSubItem>
                      </SidebarMenuSub>
                    </CollapsibleContent>
                  </Collapsible>
                )}

                {/* Payroll Management Section - Only for SUPERADMIN and MANAGER */}
                {(isSuperAdmin || isManager) && (
                  <Collapsible open={openSections.payroll} onOpenChange={(open) => setOpenSections(prev => ({ ...prev, payroll: open }))}>
                    <CollapsibleTrigger asChild>
                      <SidebarMenuButton className="text-blue-100 hover:text-white hover:bg-gradient-to-r hover:from-blue-700 hover:to-blue-600 transition-all duration-300 rounded-lg mx-2 px-3 py-2.5 shadow-sm hover:shadow-md">
                        <Icon icon="mdi:account-cash-outline" className="w-5 h-5" />
                        <span className="font-medium">Payroll Management</span>
                        <Icon 
                          icon="mdi:chevron-right" 
                          className={`w-4 h-4 ml-auto transition-transform duration-300 ${openSections.payroll ? 'rotate-90' : ''}`} 
                        />
                      </SidebarMenuButton>
                    </CollapsibleTrigger>
                    <CollapsibleContent>
                      <SidebarMenuSub className="ml-4 mt-2 space-y-1">
                        <SidebarMenuSubItem>
                          <SidebarMenuSubButton asChild>
                            <Link href="/work-shifts" className={`transition-all duration-200 rounded-md px-3 py-2 ${
                              isActiveLink('/work-shifts') 
                                ? 'bg-gradient-to-r from-blue-600 to-blue-500 text-white shadow-md' 
                                : 'text-blue-200 hover:text-white hover:bg-blue-700/50'
                            }`}>
                              <span className="font-medium">Work Shifts</span>
                            </Link>
                          </SidebarMenuSubButton>
                        </SidebarMenuSubItem>
                        <SidebarMenuSubItem>
                          <SidebarMenuSubButton asChild>
                            <Link href="/attendance-policy" className={`transition-all duration-200 rounded-md px-3 py-2 ${
                              isActiveLink('/attendance-policy') 
                                ? 'bg-gradient-to-r from-blue-600 to-blue-500 text-white shadow-md' 
                                : 'text-blue-200 hover:text-white hover:bg-blue-700/50'
                            }`}>
                              <span className="font-medium">Attendance Policy</span>
                            </Link>
                          </SidebarMenuSubButton>
                        </SidebarMenuSubItem>
                        <SidebarMenuSubItem>
                          <SidebarMenuSubButton asChild>
                            <Link href="/leave-policy" className={`transition-all duration-200 rounded-md px-3 py-2 ${
                              isActiveLink('/leave-policy') 
                                ? 'bg-gradient-to-r from-blue-600 to-blue-500 text-white shadow-md' 
                                : 'text-blue-200 hover:text-white hover:bg-blue-700/50'
                            }`}>
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
                      <SidebarMenuButton className="text-blue-100 hover:text-white hover:bg-gradient-to-r hover:from-blue-700 hover:to-blue-600 transition-all duration-300 rounded-lg mx-2 px-3 py-2.5 shadow-sm hover:shadow-md">
                        <Icon icon="mdi:currency-usd" className="w-5 h-5" />
                        <span className="font-medium">Salary Management</span>
                        <Icon 
                          icon="mdi:chevron-right" 
                          className={`w-4 h-4 ml-auto transition-transform duration-300 ${openSections.salary ? 'rotate-90' : ''}`} 
                        />
                      </SidebarMenuButton>
                    </CollapsibleTrigger>
                    <CollapsibleContent>
                      <SidebarMenuSub className="ml-4 mt-2 space-y-1">
                        {/* Full access for SUPERADMIN and MANAGER */}
                        {(isSuperAdmin || isManager) && (
                          <>
                            <SidebarMenuSubItem>
                              <SidebarMenuSubButton asChild>
                                <Link href="/monthly-salary-cycle" className={`transition-all duration-200 rounded-md px-3 py-2 ${
                                  isActiveLink('/monthly-salary-cycle') 
                                    ? 'bg-gradient-to-r from-blue-600 to-blue-500 text-white shadow-md' 
                                    : 'text-blue-200 hover:text-white hover:bg-blue-700/50'
                                }`}>
                                  <span className="font-medium">Monthly Salary Cycle</span>
                                </Link>
                              </SidebarMenuSubButton>
                            </SidebarMenuSubItem>
                            <SidebarMenuSubItem>
                              <SidebarMenuSubButton asChild>
                                <Link href="/salary-allowances" className={`transition-all duration-200 rounded-md px-3 py-2 ${
                                  isActiveLink('/salary-allowances') 
                                    ? 'bg-gradient-to-r from-blue-600 to-blue-500 text-white shadow-md' 
                                    : 'text-blue-200 hover:text-white hover:bg-blue-700/50'
                                }`}>
                                  <span className="font-medium">Salary Allowances</span>
                                </Link>
                              </SidebarMenuSubButton>
                            </SidebarMenuSubItem>
                            <SidebarMenuSubItem>
                              <SidebarMenuSubButton asChild>
                                <Link href="/salary-deductions" className={`transition-all duration-200 rounded-md px-3 py-2 ${
                                  isActiveLink('/salary-deductions') 
                                    ? 'bg-gradient-to-r from-blue-600 to-blue-500 text-white shadow-md' 
                                    : 'text-blue-200 hover:text-white hover:bg-blue-700/50'
                                }`}>
                                  <span className="font-medium">Salary Deductions</span>
                                </Link>
                              </SidebarMenuSubButton>
                            </SidebarMenuSubItem>
                            <SidebarMenuSubItem>
                              <SidebarMenuSubButton asChild>
                                <Link href="/monthly-pay-grade" className={`transition-all duration-200 rounded-md px-3 py-2 ${
                                  isActiveLink('/monthly-pay-grade') 
                                    ? 'bg-gradient-to-r from-blue-600 to-blue-500 text-white shadow-md' 
                                    : 'text-blue-200 hover:text-white hover:bg-blue-700/50'
                                }`}>
                                  <span className="font-medium">Monthly Pay Grade</span>
                                </Link>
                              </SidebarMenuSubButton>
                            </SidebarMenuSubItem>
                            <SidebarMenuSubItem>
                              <SidebarMenuSubButton asChild>
                                <Link href="/bonus-setup" className={`transition-all duration-200 rounded-md px-3 py-2 ${
                                  isActiveLink('/bonus-setup') 
                                    ? 'bg-gradient-to-r from-blue-600 to-blue-500 text-white shadow-md' 
                                    : 'text-blue-200 hover:text-white hover:bg-blue-700/50'
                                }`}>
                                  <span className="font-medium">Bonus Setup</span>
                                </Link>
                              </SidebarMenuSubButton>
                            </SidebarMenuSubItem>
                            <SidebarMenuSubItem>
                              <SidebarMenuSubButton asChild>
                                <Link href="/bonus-allocations" className={`transition-all duration-200 rounded-md px-3 py-2 ${
                                  isActiveLink('/bonus-allocations') 
                                    ? 'bg-gradient-to-r from-blue-600 to-blue-500 text-white shadow-md' 
                                    : 'text-blue-200 hover:text-white hover:bg-blue-700/50'
                                }`}>
                                  <span className="font-medium">Bonus Allocations</span>
                                </Link>
                              </SidebarMenuSubButton>
                            </SidebarMenuSubItem>
                          </>
                        )}
                        
                        {/* Common links for all users - Salary Advance, Reimbursement, Generate Salary */}
                        <SidebarMenuSubItem>
                          <SidebarMenuSubButton asChild>
                            <Link href="/salary-advance" className={`transition-all duration-200 rounded-md px-3 py-2 ${
                              isActiveLink('/salary-advance') 
                                ? 'bg-gradient-to-r from-blue-600 to-blue-500 text-white shadow-md' 
                                : 'text-blue-200 hover:text-white hover:bg-blue-700/50'
                            }`}>
                              <span className="font-medium">Salary Advance</span>
                            </Link>
                          </SidebarMenuSubButton>
                        </SidebarMenuSubItem>
                        <SidebarMenuSubItem>
                          <SidebarMenuSubButton asChild>
                            <Link href="/reimbursement" className={`transition-all duration-200 rounded-md px-3 py-2 ${
                              isActiveLink('/reimbursement') 
                                ? 'bg-gradient-to-r from-blue-600 to-blue-500 text-white shadow-md' 
                                : 'text-blue-200 hover:text-white hover:bg-blue-700/50'
                            }`}>
                              <span className="font-medium">Reimbursement</span>
                            </Link>
                          </SidebarMenuSubButton>
                        </SidebarMenuSubItem>
                        <SidebarMenuSubItem>
                          <SidebarMenuSubButton asChild>
                            <Link href="/generate-salary" className={`transition-all duration-200 rounded-md px-3 py-2 ${
                              isActiveLink('/generate-salary') 
                                ? 'bg-gradient-to-r from-blue-600 to-blue-500 text-white shadow-md' 
                                : 'text-blue-200 hover:text-white hover:bg-blue-700/50'
                            }`}>
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
                      <SidebarMenuButton className="text-blue-100 hover:text-white hover:bg-gradient-to-r hover:from-blue-700 hover:to-blue-600 transition-all duration-300 rounded-lg mx-2 px-3 py-2.5 shadow-sm hover:shadow-md">
                        <Icon icon="mdi:calendar-clock-outline" className="w-5 h-5" />
                        <span className="font-medium">Leave Management</span>
                        <Icon 
                          icon="mdi:chevron-right" 
                          className={`w-4 h-4 ml-auto transition-transform duration-300 ${openSections.leave ? 'rotate-90' : ''}`} 
                        />
                      </SidebarMenuButton>
                    </CollapsibleTrigger>
                    <CollapsibleContent>
                      <SidebarMenuSub className="ml-4 mt-2 space-y-1">
                        {/* Manage Holidays only for SUPERADMIN and MANAGER */}
                        {(isSuperAdmin || isManager) && (
                          <SidebarMenuSubItem>
                            <SidebarMenuSubButton asChild>
                              <Link href="/manage-holidays" className={`transition-all duration-200 rounded-md px-3 py-2 ${
                                isActiveLink('/manage-holidays') 
                                  ? 'bg-gradient-to-r from-blue-600 to-blue-500 text-white shadow-md' 
                                  : 'text-blue-200 hover:text-white hover:bg-blue-700/50'
                              }`}>
                                <span className="font-medium">Manage Holiday</span>
                              </Link>
                            </SidebarMenuSubButton>
                          </SidebarMenuSubItem>
                        )}
                        
                        {/* Common links for all users - Public Holiday and Leave Applications */}
                        <SidebarMenuSubItem>
                          <SidebarMenuSubButton asChild>
                            <Link href="/public-holiday" className={`transition-all duration-200 rounded-md px-3 py-2 ${
                              isActiveLink('/public-holiday') 
                                ? 'bg-gradient-to-r from-blue-600 to-blue-500 text-white shadow-md' 
                                : 'text-blue-200 hover:text-white hover:bg-blue-700/50'
                            }`}>
                              <span className="font-medium">Public Holiday</span>
                            </Link>
                          </SidebarMenuSubButton>
                        </SidebarMenuSubItem>
                        <SidebarMenuSubItem>
                          <SidebarMenuSubButton asChild>
                            <Link href="/leave-applications" className={`transition-all duration-200 rounded-md px-3 py-2 ${
                              isActiveLink('/leave-applications') 
                                ? 'bg-gradient-to-r from-blue-600 to-blue-500 text-white shadow-md' 
                                : 'text-blue-200 hover:text-white hover:bg-blue-700/50'
                            }`}>
                              <span className="font-medium">Leave Applications</span>
                            </Link>
                          </SidebarMenuSubButton>
                        </SidebarMenuSubItem>
                        {(isSuperAdmin || isManager) && (
                          <>
                            <SidebarMenuSubItem>
                              <SidebarMenuSubButton asChild>
                                <Link href="/privileged-leave" className={`transition-all duration-200 rounded-md px-3 py-2 ${
                                  isActiveLink('/privileged-leave') 
                                    ? 'bg-gradient-to-r from-blue-600 to-blue-500 text-white shadow-md' 
                                    : 'text-blue-200 hover:text-white hover:bg-blue-700/50'
                                }`}>
                                  <span className="font-medium">Privileged Leave</span>
                                </Link>
                              </SidebarMenuSubButton>
                            </SidebarMenuSubItem>
                            <SidebarMenuSubItem>
                              <SidebarMenuSubButton asChild>
                                <Link href="/employee-holiday-override" className={`transition-all duration-200 rounded-md px-3 py-2 ${
                                  isActiveLink('/employee-holiday-override') 
                                    ? 'bg-gradient-to-r from-blue-600 to-blue-500 text-white shadow-md' 
                                    : 'text-blue-200 hover:text-white hover:bg-blue-700/50'
                                }`}>
                                  <span className="font-medium">Holiday Override</span>
                                </Link>
                              </SidebarMenuSubButton>
                            </SidebarMenuSubItem>
                            <SidebarMenuSubItem>
                              <SidebarMenuSubButton asChild>
                                <Link href="/employee-weekly-off" className={`transition-all duration-200 rounded-md px-3 py-2 ${
                                  isActiveLink('/employee-weekly-off') 
                                    ? 'bg-gradient-to-r from-blue-600 to-blue-500 text-white shadow-md' 
                                    : 'text-blue-200 hover:text-white hover:bg-blue-700/50'
                                }`}>
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
                      <SidebarMenuButton className="text-blue-100 hover:text-white hover:bg-gradient-to-r hover:from-blue-700 hover:to-blue-600 transition-all duration-300 rounded-lg mx-2 px-3 py-2.5 shadow-sm hover:shadow-md">
                        <Icon icon="mdi:calendar-clock-outline" className="w-5 h-5" />
                        <span className="font-medium">Shift Management</span>
                        <Icon 
                          icon="mdi:chevron-right" 
                          className={`w-4 h-4 ml-auto transition-transform duration-300 ${openSections.leave ? 'rotate-90' : ''}`} 
                        />
                      </SidebarMenuButton>
                    </CollapsibleTrigger>
                    <CollapsibleContent>
                      <SidebarMenuSub className="ml-4 mt-2 space-y-1">
                        {/* Manage Holidays only for SUPERADMIN and MANAGER */}
                        {(isSuperAdmin || isManager) && (
                          <SidebarMenuSubItem>
                            <SidebarMenuSubButton asChild>
                              <Link href="/roster" className={`transition-all duration-200 rounded-md px-3 py-2 ${
                                isActiveLink('/roster') 
                                  ? 'bg-gradient-to-r from-blue-600 to-blue-500 text-white shadow-md' 
                                  : 'text-blue-200 hover:text-white hover:bg-blue-700/50'
                              }`}>
                                <span className="font-medium">Manage Roster</span>
                              </Link>
                            </SidebarMenuSubButton>
                          </SidebarMenuSubItem>
                        )}
                        

                        {/* <SidebarMenuSubItem>
                          <SidebarMenuSubButton asChild>
                            <Link href="/leave-applications" className={`transition-all duration-200 rounded-md px-3 py-2 ${
                              isActiveLink('/leave-applications') 
                                ? 'bg-gradient-to-r from-blue-600 to-blue-500 text-white shadow-md' 
                                : 'text-blue-200 hover:text-white hover:bg-blue-700/50'
                            }`}>
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
                      <SidebarMenuButton className="text-blue-100 hover:text-white hover:bg-gradient-to-r hover:from-blue-700 hover:to-blue-600 transition-all duration-300 rounded-lg mx-2 px-3 py-2.5 shadow-sm hover:shadow-md">
                        <Icon icon="mdi:clock-check-outline" className="w-5 h-5" />
                        <span className="font-medium">Attendance Management</span>
                        <Icon 
                          icon="mdi:chevron-right" 
                          className={`w-4 h-4 ml-auto transition-transform duration-300 ${openSections.attendance ? 'rotate-90' : ''}`} 
                        />
                      </SidebarMenuButton>
                    </CollapsibleTrigger>
                    <CollapsibleContent>
                      <SidebarMenuSub className="ml-4 mt-2 space-y-1">
                        
                        <SidebarMenuSubItem>
                          <SidebarMenuSubButton asChild>
                            <Link href="/field-attendance-schedule" className={`transition-all duration-200 rounded-md px-3 py-2 ${
                              isActiveLink('/field-attendance-schedule') 
                                ? 'bg-gradient-to-r from-blue-600 to-blue-500 text-white shadow-md' 
                                : 'text-blue-200 hover:text-white hover:bg-blue-700/50'
                            }`}>
                              <span className="font-medium">Field Attendance Schedule</span>
                            </Link>
                          </SidebarMenuSubButton>
                        </SidebarMenuSubItem>
                        <SidebarMenuSubItem>
                          <SidebarMenuSubButton asChild>
                            <Link href="/attendance-regularisation" className={`transition-all duration-200 rounded-md px-3 py-2 ${
                              isActiveLink('/attendance-regularisation') 
                                ? 'bg-gradient-to-r from-blue-600 to-blue-500 text-white shadow-md' 
                                : 'text-blue-200 hover:text-white hover:bg-blue-700/50'
                            }`}>
                              <span className="font-medium">Attendance Regularisation</span>
                            </Link>
                          </SidebarMenuSubButton>
                        </SidebarMenuSubItem>
                        <SidebarMenuSubItem>
                          <SidebarMenuSubButton asChild>
                            <Link href="/import-attendance" className={`transition-all duration-200 rounded-md px-3 py-2 ${
                              isActiveLink('/import-attendance') 
                                ? 'bg-gradient-to-r from-blue-600 to-blue-500 text-white shadow-md' 
                                : 'text-blue-200 hover:text-white hover:bg-blue-700/50'
                            }`}>
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
                      <SidebarMenuButton className="text-blue-100 hover:text-white hover:bg-gradient-to-r hover:from-blue-700 hover:to-blue-600 transition-all duration-300 rounded-lg mx-2 px-3 py-2.5 shadow-sm hover:shadow-md">
                        <Icon icon="mdi:chart-line" className="w-5 h-5" />
                        <span className="font-medium">Reports</span>
                        <Icon 
                          icon="mdi:chevron-right" 
                          className={`w-4 h-4 ml-auto transition-transform duration-300 ${openSections.reports ? 'rotate-90' : ''}`} 
                        />
                      </SidebarMenuButton>
                    </CollapsibleTrigger>
                    <CollapsibleContent>
                      <SidebarMenuSub className="ml-4 mt-2 space-y-1">
                        <SidebarMenuSubItem>
                          <SidebarMenuSubButton asChild>
                            <Link href="/attendance-reports" className={`transition-all duration-200 rounded-md px-3 py-2 ${
                              isActiveLink('/attendance-reports') 
                                ? 'bg-gradient-to-r from-blue-600 to-blue-500 text-white shadow-md' 
                                : 'text-blue-200 hover:text-white hover:bg-blue-700/50'
                            }`}>
                              <span className="font-medium">Attendance Reports</span>
                            </Link>
                          </SidebarMenuSubButton>
                        </SidebarMenuSubItem>
                        <SidebarMenuSubItem>
                          <SidebarMenuSubButton asChild>
                            <Link href="/leave-reports" className={`transition-all duration-200 rounded-md px-3 py-2 ${
                              isActiveLink('/leave-reports') 
                                ? 'bg-gradient-to-r from-blue-600 to-blue-500 text-white shadow-md' 
                                : 'text-blue-200 hover:text-white hover:bg-blue-700/50'
                            }`}>
                              <span className="font-medium">Leave Reports</span>
                            </Link>
                          </SidebarMenuSubButton>
                        </SidebarMenuSubItem>
                        <SidebarMenuSubItem>
                          <SidebarMenuSubButton asChild>
                            <Link href="/salary-statements" className={`transition-all duration-200 rounded-md px-3 py-2 ${
                              isActiveLink('/salary-statements') 
                                ? 'bg-gradient-to-r from-blue-600 to-blue-500 text-white shadow-md' 
                                : 'text-blue-200 hover:text-white hover:bg-blue-700/50'
                            }`}>
                              <span className="font-medium">Salary Statements</span>
                            </Link>
                          </SidebarMenuSubButton>
                        </SidebarMenuSubItem>
                        <SidebarMenuSubItem>
                          <SidebarMenuSubButton asChild>
                            <Link href="/canteen/reports" className={`transition-all duration-200 rounded-md px-3 py-2 ${
                              isActiveLink('/canteen/reports') 
                                ? 'bg-gradient-to-r from-blue-600 to-blue-500 text-white shadow-md' 
                                : 'text-blue-200 hover:text-white hover:bg-blue-700/50'
                            }`}>
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
                      <SidebarMenuButton className="text-blue-100 hover:text-white hover:bg-gradient-to-r hover:from-blue-700 hover:to-blue-600 transition-all duration-300 rounded-lg mx-2 px-3 py-2.5 shadow-sm hover:shadow-md">
                        <Icon icon="mdi:silverware-fork-knife" className="w-5 h-5" />
                        <span className="font-medium">Canteen Management</span>
                        <Icon 
                          icon="mdi:chevron-right" 
                          className={`w-4 h-4 ml-auto transition-transform duration-300 ${openSections.canteen ? 'rotate-90' : ''}`} 
                        />
                      </SidebarMenuButton>
                    </CollapsibleTrigger>
                    <CollapsibleContent>
                      <SidebarMenuSub className="ml-4 mt-2 space-y-1">
                        <SidebarMenuSubItem>
                          <SidebarMenuSubButton asChild>
                            <Link href="/canteen" className={`transition-all duration-200 rounded-md px-3 py-2 ${
                              isActiveLink('/canteen') 
                                ? 'bg-gradient-to-r from-blue-600 to-blue-500 text-white shadow-md' 
                                : 'text-blue-200 hover:text-white hover:bg-blue-700/50'
                            }`}>
                              <span className="font-medium">Dashboard</span>
                            </Link>
                          </SidebarMenuSubButton>
                        </SidebarMenuSubItem>
                        <SidebarMenuSubItem>
                          <SidebarMenuSubButton asChild>
                            <Link href="/canteen/setup" className={`transition-all duration-200 rounded-md px-3 py-2 ${
                              isActiveLink('/canteen/setup') 
                                ? 'bg-gradient-to-r from-blue-600 to-blue-500 text-white shadow-md' 
                                : 'text-blue-200 hover:text-white hover:bg-blue-700/50'
                            }`}>
                              <span className="font-medium">Setup</span>
                            </Link>
                          </SidebarMenuSubButton>
                        </SidebarMenuSubItem>
                        <SidebarMenuSubItem>
                          <SidebarMenuSubButton asChild>
                            <Link href="/canteen/reports" className={`transition-all duration-200 rounded-md px-3 py-2 ${
                              isActiveLink('/canteen/reports') 
                                ? 'bg-gradient-to-r from-blue-600 to-blue-500 text-white shadow-md' 
                                : 'text-blue-200 hover:text-white hover:bg-blue-700/50'
                            }`}>
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
        </Sidebar>
        <SidebarInset>
          <div className="min-h-screen bg-gray-50 overflow-x-hidden">
            <header className="bg-gradient-to-r from-blue-800 to-blue-700 border-b border-blue-600 px-3 sm:px-6 py-3 sm:py-4 shadow-lg">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-4">
                  <SidebarTrigger className="text-white hover:bg-blue-600/50 transition-colors duration-200" />
                </div>
                <div className="flex items-center gap-4">
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <button className="flex items-center gap-3 cursor-pointer focus:outline-none">
                        <Avatar className="w-8 h-8 ring-2 ring-blue-300">
                          <AvatarImage src="https://wqnmyfkavrotpmupbtou.supabase.co/storage/v1/object/public/reweb/blocks/placeholder.png" />
                          <AvatarFallback className="bg-blue-500 text-white">
                            {currentUser?.username?.[0]?.toUpperCase() || "A"}
                          </AvatarFallback>
                        </Avatar>
                        <span className="text-white font-medium">{currentUser?.username || "admin"}</span>
                        <Icon icon="mdi:chevron-down" className="w-4 h-4 text-white" />
                      </button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end" className="w-48">
                      <DropdownMenuItem
                        className="cursor-pointer text-red-600 focus:text-red-600"
                        onClick={() => {
                          localStorage.removeItem("accessToken");
                          localStorage.removeItem("user");
                          document.cookie = "accessToken=; expires=Thu, 01 Jan 1970 00:00:00 UTC; path=/;";
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
            <main className="p-3 sm:p-6 overflow-x-hidden">
              {children}
            </main>
          </div>
        </SidebarInset>
      </SidebarProvider>
    </div>
  );
}