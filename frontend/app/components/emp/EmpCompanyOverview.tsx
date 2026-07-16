"use client";

import Link from "next/link";
import { Icon } from "@iconify/react";

const COMPANY_LINKS = [
  {
    label: "Holiday list",
    sub: "Company public holidays",
    href: "/empHolidays",
    icon: "solar:calendar-mark-bold-duotone",
    color: "bg-rose-50 text-rose-600",
  },
  {
    label: "Internal messages",
    sub: "Company noticeboard",
    href: "/empNoticeboard",
    icon: "solar:bell-bold-duotone",
    color: "bg-amber-50 text-amber-600",
  },
  {
    label: "Public holidays",
    sub: "Declared public holidays",
    href: "/empPublicHoliday",
    icon: "solar:calendar-date-bold-duotone",
    color: "bg-blue-50 text-blue-600",
  },
];

export function EmpCompanyOverview() {
  return (
    <div className="space-y-4">
      <div>
        <h2 className="text-lg font-bold text-gray-900">My Company</h2>
        <p className="text-sm text-gray-500 mt-0.5">Company-wide information and announcements</p>
      </div>
      <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-3">
        {COMPANY_LINKS.map((card) => (
          <Link
            key={card.href}
            href={card.href}
            className="bg-white rounded-2xl border border-gray-100 shadow-sm p-4 hover:border-[#4f46e5]/30 transition-colors"
          >
            <div className={`w-11 h-11 rounded-xl flex items-center justify-center mb-3 ${card.color}`}>
              <Icon icon={card.icon} className="w-6 h-6" />
            </div>
            <p className="font-semibold text-gray-900">{card.label}</p>
            <p className="text-xs text-gray-500 mt-0.5">{card.sub}</p>
          </Link>
        ))}
      </div>
    </div>
  );
}
