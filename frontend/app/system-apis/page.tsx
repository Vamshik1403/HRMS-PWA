"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Plug } from "lucide-react";
import { authHeaders } from "@/lib/auth";
import { PageHeader } from "@/app/components/app/page-header";

type ApiRow = {
  id: string;
  name: string;
  provider: string;
  status: "active" | "not_configured";
  summary: string;
  href?: string;
};

export default function SystemApisPage() {
  const [rows, setRows] = useState<ApiRow[]>([]);
  const [activeCount, setActiveCount] = useState(0);
  const [error, setError] = useState("");

  useEffect(() => {
    let cancelled = false;
    fetch("/backend/external-apis", { headers: authHeaders(), cache: "no-store" })
      .then(async (res) => {
        const body = await res.json().catch(() => null);
        if (!res.ok) throw new Error(body?.message || "Could not load APIs");
        return body;
      })
      .then((body) => {
        if (cancelled) return;
        setRows(Array.isArray(body?.apis) ? body.apis : []);
        setActiveCount(Number(body?.activeCount || 0));
      })
      .catch((err: any) => {
        if (!cancelled) setError(err?.message || "Could not load APIs");
      });
    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <div className="space-y-6">
      <PageHeader
        icon={Plug}
        title="External APIs"
        description={`${activeCount} active. Open an API to see how OpenHRM uses it.`}
      />
      {error ? <p className="text-sm text-red-600">{error}</p> : null}
      <div className="grid gap-4 md:grid-cols-2">
        {rows.map((row) => {
          const body = (
            <div className="h-full rounded-2xl border border-[#E5E7EB] bg-white p-5 shadow-sm dark:border-border dark:bg-card">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <h2 className="text-base font-semibold text-[#0F172A] dark:text-foreground">{row.name}</h2>
                  <p className="text-xs text-[#64748B]">{row.provider}</p>
                </div>
                <span
                  className={`rounded-full px-2.5 py-1 text-[11px] font-semibold uppercase tracking-wide ${
                    row.status === "active"
                      ? "bg-emerald-500/10 text-emerald-700"
                      : "bg-slate-500/10 text-slate-600"
                  }`}
                >
                  {row.status === "active" ? "Active" : "Not configured"}
                </span>
              </div>
              <p className="mt-3 text-sm text-[#64748B]">{row.summary}</p>
            </div>
          );
          return row.href ? (
            <Link key={row.id} href={row.href} className="block">
              {body}
            </Link>
          ) : (
            <div key={row.id}>{body}</div>
          );
        })}
      </div>
    </div>
  );
}
