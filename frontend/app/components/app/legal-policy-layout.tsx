"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/app/utils/cn";
import { PublicPolicyPage } from "./public-policy-page";

export const LEGAL_NAV = [
    { href: "/terms-of-use", label: "Terms of Use", type: "TERMS_OF_USE" },
  { href: "/privacy-policy", label: "Privacy Policy", type: "PRIVACY_POLICY" },
  { href: "/sla", label: "Service Level Agreement", type: "SLA" },
] as const;

export function LegalPolicyLayout({ type }: { type: string }) {
  const pathname = usePathname();

  return (
    <div className="min-h-screen bg-background">
      <div className="bg-slate-900 text-white">
        <div className="mx-auto flex max-w-5xl flex-col gap-3 px-6 py-4 sm:flex-row sm:items-center sm:justify-between">
          <p className="text-sm font-semibold tracking-wide">Security &amp; Privacy</p>
          <nav className="flex flex-wrap gap-1 text-sm">
            {LEGAL_NAV.map((item) => {
              const active = pathname === item.href;
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className={cn(
                    "rounded-md px-3 py-1.5 transition-colors",
                    active
                      ? "bg-white text-slate-900 font-medium"
                      : "text-white/80 hover:bg-white/10 hover:text-white",
                  )}
                >
                  {item.label}
                </Link>
              );
            })}
          </nav>
        </div>
      </div>
      <PublicPolicyPage type={type} />
    </div>
  );
}
