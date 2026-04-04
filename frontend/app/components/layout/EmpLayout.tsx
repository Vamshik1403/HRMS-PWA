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
    <div className="min-h-screen bg-background">
      <SidebarProvider>
        {/* Sidebar */}
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
                {/* Dashboard */}
                <SidebarMenuItem>
                  <SidebarMenuButton asChild>
                    <Link
                      href="/empdashboard"
                      className={`text-blue-100 hover:text-white hover:bg-gradient-to-r hover:from-blue-700 hover:to-blue-600 transition-all duration-300 rounded-lg mx-2 px-3 py-2.5 shadow-sm hover:shadow-md flex items-center gap-3 ${
                        isActive("/empdashboard")
                          ? "bg-gradient-to-r from-blue-600 to-blue-500 text-white shadow-md"
                          : ""
                      }`}
                    >
                      <Icon icon="mdi:view-dashboard" className="w-5 h-5" />
                      <span className="font-medium">Dashboard</span>
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
                  <CollapsibleTrigger asChild>
                    <SidebarMenuButton className="text-blue-100 hover:text-white hover:bg-gradient-to-r hover:from-blue-700 hover:to-blue-600 transition-all duration-300 rounded-lg mx-2 px-3 py-2.5 shadow-sm hover:shadow-md">
                      <Icon icon="mdi:currency-usd" className="w-5 h-5" />
                      <span className="font-medium">Salary Management</span>
                      <Icon
                        icon="mdi:chevron-right"
                        className={`w-4 h-4 ml-auto transition-transform duration-300 ${
                          openSections.salary ? "rotate-90" : ""
                        }`}
                      />
                    </SidebarMenuButton>
                  </CollapsibleTrigger>

                  <CollapsibleContent>
                    <SidebarMenuSub className="ml-4 mt-2 space-y-1">
                      {[
                        { href: "/empSalaryAdvance", label: "Salary Advance" },
                        { href: "/empReimbursement", label: "Reimbursement" },
                        { href: "/empGenerateSalary", label: "Generate Salary" },
                      ].map((item) => (
                        <SidebarMenuSubItem key={item.href}>
                          <SidebarMenuSubButton asChild>
                            <Link
                              href={item.href}
                              className={`transition-all duration-200 rounded-md px-3 py-2 ${
                                isActive(item.href)
                                  ? "bg-gradient-to-r from-blue-600 to-blue-500 text-white shadow-md"
                                  : "text-blue-200 hover:text-white hover:bg-blue-700/50"
                              }`}
                            >
                              <span className="font-medium">{item.label}</span>
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
                  <CollapsibleTrigger asChild>
                    <SidebarMenuButton className="text-blue-100 hover:text-white hover:bg-gradient-to-r hover:from-blue-700 hover:to-blue-600 transition-all duration-300 rounded-lg mx-2 px-3 py-2.5 shadow-sm hover:shadow-md">
                      <Icon icon="mdi:calendar-clock-outline" className="w-5 h-5" />
                      <span className="font-medium">Leave Management</span>
                      <Icon
                        icon="mdi:chevron-right"
                        className={`w-4 h-4 ml-auto transition-transform duration-300 ${
                          openSections.leave ? "rotate-90" : ""
                        }`}
                      />
                    </SidebarMenuButton>
                  </CollapsibleTrigger>

                  <CollapsibleContent>
                    <SidebarMenuSub className="ml-4 mt-2 space-y-1">
                      {[
                        { href: "/empPublicHoliday", label: "Public Holiday" },
                        { href: "/empLeaveApplication", label: "Leave Applications" },
                      ].map((item) => (
                        <SidebarMenuSubItem key={item.href}>
                          <SidebarMenuSubButton asChild>
                            <Link
                              href={item.href}
                              className={`transition-all duration-200 rounded-md px-3 py-2 ${
                                isActive(item.href)
                                  ? "bg-gradient-to-r from-blue-600 to-blue-500 text-white shadow-md"
                                  : "text-blue-200 hover:text-white hover:bg-blue-700/50"
                              }`}
                            >
                              <span className="font-medium">{item.label}</span>
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
          <div className="min-h-screen bg-gray-50 overflow-x-hidden">
            <header className="bg-gradient-to-r from-blue-800 to-blue-700 border-b border-blue-600 px-3 sm:px-6 py-3 sm:py-4 shadow-lg flex justify-between items-center">
              <SidebarTrigger className="text-white hover:bg-blue-600/50 transition-colors duration-200" />
              <div className="flex items-center gap-4">
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <button className="flex items-center gap-3 cursor-pointer focus:outline-none">
                      <Avatar className="w-8 h-8 ring-2 ring-blue-300">
                        <AvatarImage src="https://wqnmyfkavrotpmupbtou.supabase.co/storage/v1/object/public/reweb/blocks/placeholder.png" />
                        <AvatarFallback className="bg-blue-500 text-white">U</AvatarFallback>
                      </Avatar>
                      <span className="text-white font-medium">User</span>
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
