"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { Icon } from "@iconify/react";

interface EmpMobileLayoutProps {
  children: React.ReactNode;
}

const navItems = [
  { label: "Home",       icon: "solar:home-2-bold-duotone",        outlineIcon: "solar:home-2-linear",           href: "/empdashboard" },
  { label: "Attendance", icon: "solar:map-point-bold-duotone",     outlineIcon: "solar:map-point-linear",        href: "/empAttendance" },
  { label: "History",    icon: "solar:clock-circle-bold-duotone",  outlineIcon: "solar:clock-circle-linear",     href: "/empHistory" },
  { label: "Leave",      icon: "solar:calendar-bold-duotone",      outlineIcon: "solar:calendar-linear",         href: "/empLeaveApplication" },
  { label: "Tasks",      icon: "solar:checklist-bold-duotone",     outlineIcon: "solar:checklist-linear",        href: "/empMyTasks" },
  { label: "Profile",    icon: "solar:user-bold-duotone",          outlineIcon: "solar:user-linear",             href: "/empProfile" },
];

export default function EmpMobileLayout({ children }: EmpMobileLayoutProps) {
  const pathname = usePathname();
  const router = useRouter();

  // Auth guard
  useEffect(() => {
    const token = localStorage.getItem("token") || localStorage.getItem("accessToken");
    if (!token) router.replace("/login");
  }, [router]);

  const isActive = (href: string) => pathname === href || pathname.startsWith(href + "/");

  return (
    <div className="bg-[#f2f4f7]" style={{ position: 'fixed', inset: 0, display: 'flex', flexDirection: 'column', overscrollBehavior: 'none' }}>
      {/* Top safe-area spacer — prevents content going under notch/status bar */}
      <div style={{ height: 'env(safe-area-inset-top)', background: '#f2f4f7', flexShrink: 0 }} />
      {/* Main scrollable content */}
      <main className="flex-1 overflow-y-auto overscroll-none" style={{ paddingBottom: 'calc(72px + env(safe-area-inset-bottom))', WebkitOverflowScrolling: 'touch', overscrollBehavior: 'none' }}>
        {children}
      </main>

      {/* Bottom nav bar */}
      <nav className="fixed bottom-0 inset-x-0 z-50 bg-white border-t border-gray-100 shadow-[0_-4px_24px_rgba(0,0,0,0.07)]" style={{ paddingBottom: 'env(safe-area-inset-bottom)' }}>
        <div className="flex items-center justify-around h-[60px] px-3">
          {navItems.map((item) => {
            const active = isActive(item.href);
            return (
              <Link
                key={item.href}
                href={item.href}
                className="flex flex-col items-center justify-center gap-0.5 min-w-[48px] py-1 group"
              >
                <div className={`w-8 h-8 rounded-xl flex items-center justify-center transition-all duration-200 ${
                  active ? "bg-blue-50" : ""
                }`}>
                  <Icon
                    icon={active ? item.icon : item.outlineIcon}
                    className={`w-[22px] h-[22px] transition-colors duration-200 ${
                      active ? "text-[#2563eb]" : "text-gray-400 group-hover:text-gray-600"
                    }`}
                  />
                </div>
                <span className={`text-[10px] font-semibold tracking-tight transition-colors duration-200 ${
                  active ? "text-[#2563eb]" : "text-gray-400 group-hover:text-gray-500"
                }`}>
                  {item.label}
                </span>
              </Link>
            );
          })}
        </div>
      </nav>
    </div>
  );
}
