"use client";

import { useState, useEffect } from "react";
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
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";

interface EmpLayoutProps {
  children: React.ReactNode;
}

export default function EmpLayout({ children }: EmpLayoutProps) {
  const pathname = usePathname();
  const [openSections, setOpenSections] = useState({
    salary: false,
    leave: false,
  });

  useEffect(() => {
    const newOpen = { salary: false, leave: false };

    if (["/empSalaryAdvance", "/empReimbursement", "/empGenerateSalary"].includes(pathname)) {
      newOpen.salary = true;
    } else if (["/manage-holidays", "/empPublicHoliday", "/empLeaveApplication"].includes(pathname)) {
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
            <Link href="/empdashboard" className="flex items-center gap-3">
              <div className="w-11 h-11 rounded-full bg-[#4f46e5] flex items-center justify-center text-white text-sm font-bold shadow-[0_6px_16px_rgba(79,70,229,0.35)] shrink-0">
                HR
              </div>
              <div className="min-w-0">
                <span className="text-gray-900 font-bold text-sm tracking-tight block truncate">
                  OpenHRM
                </span>
                <p className="text-[11px] text-gray-400">Employee Portal</p>
              </div>
            </Link>
          </SidebarHeader>

          <SidebarContent className="px-2.5 py-2 flex-1 overflow-y-auto">
            <SidebarGroup>
              <SidebarMenu className="gap-1.5 flex flex-col">
                {/* Dashboard */}
                <SidebarMenuItem className="mx-0">
                  <SidebarMenuButton asChild>
                    <Link
                      href="/empdashboard"
                      className={`flex w-full items-center gap-3 rounded-md px-3 h-11 min-h-[44px] max-h-11 shrink-0 transition-colors duration-150 ${
                        isActive("/empdashboard")
                          ? "!bg-[#eef2ff] text-[#4f46e5] font-medium relative overflow-visible before:absolute before:-left-3 before:top-[20%] before:h-[60%] before:w-[3px] before:rounded-r-sm before:bg-[#4f46e5]"
                          : "text-[#6b7280] hover:bg-[#f3f4f6] hover:text-[#1a1a2e]"
                      }`}
                    >
                      <Icon icon="mdi:view-dashboard-outline" className={`w-5 h-5 shrink-0 ${isActive("/empdashboard") ? "text-[#4f46e5]" : "text-gray-400"}`} />
                      <span className="text-[13px]">Dashboard</span>
                    </Link>
                  </SidebarMenuButton>
                </SidebarMenuItem>

                {/* Salary Management */}
                <Collapsible
                  open={openSections.salary}
                  onOpenChange={(open) =>
                    setOpenSections((prev) => ({ ...prev, salary: open }))
                  }
                >
                  <SidebarMenuItem className="mx-0">
                    <CollapsibleTrigger asChild>
                      <SidebarMenuButton className={`flex w-full items-center gap-3 rounded-md px-3 h-11 min-h-[44px] max-h-11 shrink-0 transition-colors duration-150 ${
                        ["/empSalaryAdvance", "/empReimbursement", "/empGenerateSalary"].includes(pathname)
                          ? "!bg-[#eef2ff] text-[#4f46e5] font-medium"
                          : "text-[#6b7280] hover:bg-[#f3f4f6] hover:text-[#1a1a2e]"
                      }`}>
                        <Icon icon="mdi:currency-usd" className={`w-5 h-5 shrink-0 ${["/empSalaryAdvance", "/empReimbursement", "/empGenerateSalary"].includes(pathname) ? "text-[#4f46e5]" : "text-gray-400"}`} />
                        <span className="text-[13px]">Salary Management</span>
                        <Icon
                          icon="mdi:chevron-right"
                          className={`w-4 h-4 ml-auto transition-transform duration-200 text-gray-400 ${
                            openSections.salary ? "rotate-90" : ""
                          }`}
                        />
                      </SidebarMenuButton>
                    </CollapsibleTrigger>
                  </SidebarMenuItem>

                  <CollapsibleContent>
                    <SidebarMenuSub className="ml-4 mt-1 space-y-0.5">
                      {[
                        { href: "/empSalaryAdvance", label: "Salary Advance" },
                        { href: "/empReimbursement", label: "Reimbursement" },
                        { href: "/empGenerateSalary", label: "Generate Salary" },
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
                        ["/empPublicHoliday", "/empLeaveApplication"].includes(pathname)
                          ? "!bg-[#eef2ff] text-[#4f46e5] font-medium"
                          : "text-[#6b7280] hover:bg-[#f3f4f6] hover:text-[#1a1a2e]"
                      }`}>
                        <Icon icon="mdi:calendar-clock-outline" className={`w-5 h-5 shrink-0 ${["/empPublicHoliday", "/empLeaveApplication"].includes(pathname) ? "text-[#4f46e5]" : "text-gray-400"}`} />
                        <span className="text-[13px]">Leave Management</span>
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
                        { href: "/empPublicHoliday", label: "Public Holiday" },
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
                    <button className="flex items-center gap-3 cursor-pointer focus:outline-none">
                      <Avatar className="w-8 h-8 ring-2 ring-gray-200">
                        <AvatarImage src="https://wqnmyfkavrotpmupbtou.supabase.co/storage/v1/object/public/reweb/blocks/placeholder.png" />
                        <AvatarFallback className="bg-gray-900 text-white">U</AvatarFallback>
                      </Avatar>
                      <span className="text-gray-900 font-medium text-sm">User</span>
                      <Icon icon="mdi:chevron-down" className="w-4 h-4 text-gray-500" />
                    </button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end" className="w-48">
                    <DropdownMenuItem
                      className="cursor-pointer text-red-600 focus:text-red-600"
                      onClick={() => {
                        localStorage.removeItem("accessToken");
                        localStorage.removeItem("user");
                        document.cookie = "accessToken=; expires=Thu, 01 Jan 1970 00:00:00 UTC; path=/;";
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
    </div>
  );
}
