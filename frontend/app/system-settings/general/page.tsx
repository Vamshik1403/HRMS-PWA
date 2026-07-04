"use client";

import { useCallback, useEffect, useState } from "react";
import { useCurrentUser } from "../../hooks/useCurrentUser";
import { getSidebarContext } from "../../utils/sidebarContext";
import { NoticeBanner } from "../../components/ui/notice-banner";
import { toast } from "sonner";

const BACKEND = process.env.NEXT_PUBLIC_BACKEND_URL || "/backend";

export default function GeneralSettingsPage() {
  const user = useCurrentUser();
  const [companyId, setCompanyId] = useState<number | null>(null);
  const [companyName, setCompanyName] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const resolveCompanyId = useCallback(async () => {
    const ctx = getSidebarContext();
    if (ctx?.companyID) return ctx.companyID;

    if (user?.role === "COMPANY_ADMIN" || user?.role === "ADMIN") {
      const res = await fetch(`${BACKEND}/users`, { cache: "no-store" });
      if (!res.ok) return null;
      const users = await res.json();
      const me = users.find((u: { username?: string }) => u.username === user.username);
      return me?.companyID ?? null;
    }
    return null;
  }, [user]);

  useEffect(() => {
    if (!user) return;
    if (user.role !== "SUPERADMIN" && user.role !== "COMPANY_ADMIN") {
      setLoading(false);
      return;
    }

    (async () => {
      try {
        const id = await resolveCompanyId();
        if (!id) {
          setCompanyId(null);
          return;
        }
        setCompanyId(id);
        const res = await fetch(`${BACKEND}/company/${id}`, { cache: "no-store" });
        if (!res.ok) throw new Error("Failed to load company");
        const company = await res.json();
        setCompanyName(company.companyName ?? "");
      } catch {
        toast.error("Could not load company settings");
      } finally {
        setLoading(false);
      }
    })();
  }, [user, resolveCompanyId]);

  const save = async () => {
    if (!companyId) {
      toast.error("Select a company in the sidebar first");
      return;
    }
    const trimmed = companyName.trim();
    if (!trimmed) {
      toast.error("Company name is required");
      return;
    }
    setSaving(true);
    try {
      const res = await fetch(`${BACKEND}/company/${companyId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ companyName: trimmed }),
      });
      if (!res.ok) throw new Error(await res.text());
      toast.success("Company name saved");
    } catch {
      toast.error("Failed to save company name");
    } finally {
      setSaving(false);
    }
  };

  if (user && user.role !== "SUPERADMIN" && user.role !== "COMPANY_ADMIN") {
    return (
      <div className="p-8 text-center text-gray-500">Access restricted.</div>
    );
  }

  return (
    <div className="max-w-xl p-6 sm:p-8">
        <h1 className="text-2xl font-bold text-gray-900 mb-1">General settings</h1>
        <p className="text-sm text-gray-500 mb-6">
          Company name is used in employee birthday notifications, joining forms, and other
          employee-facing messages instead of the software product name.
        </p>

        {loading ? (
          <p className="text-sm text-gray-400">Loading…</p>
        ) : !companyId ? (
          <NoticeBanner variant="warning" compact>
            Select a company in the sidebar, then return to this page.
          </NoticeBanner>
        ) : (
          <div className="bg-white border border-gray-200 rounded-xl p-5 space-y-4 shadow-sm">
            <div>
              <label htmlFor="companyName" className="block text-sm font-semibold text-gray-900 mb-1">
                Company name
              </label>
              <input
                id="companyName"
                type="text"
                value={companyName}
                onChange={(e) => setCompanyName(e.target.value)}
                placeholder="e.g. Karbonsteel Engineering Ltd."
                className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#4f46e5]/30 focus:border-[#4f46e5]"
              />
              <p className="text-xs text-gray-500 mt-2 leading-relaxed">
                Birthday message example: &quot;Wishing you a wonderful birthday from your{" "}
                <strong>{companyName.trim() || "Company"}</strong> family.&quot;
              </p>
            </div>
            <button
              type="button"
              onClick={() => void save()}
              disabled={saving}
              className="inline-flex items-center justify-center rounded-lg bg-[#4f46e5] text-white text-sm font-semibold px-4 py-2.5 disabled:opacity-60"
            >
              {saving ? "Saving…" : "Save settings"}
            </button>
          </div>
        )}
      </div>
  );
}
