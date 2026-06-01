"use client";

import { useCallback, useEffect, useState } from "react";
import { PageLayout } from "../../components/layout/PageLayout";
import { useCurrentUser } from "../../hooks/useCurrentUser";
import { getSidebarContext } from "../../utils/sidebarContext";
import { toast } from "sonner";

const BACKEND = process.env.NEXT_PUBLIC_BACKEND_URL || "/backend";

export default function PwaSettingsPage() {
  const user = useCurrentUser();
  const [companyId, setCompanyId] = useState<number | null>(null);
  const [showLeaveBalance, setShowLeaveBalance] = useState(true);
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
        setShowLeaveBalance(company.pwaShowLeaveBalance !== false);
      } catch {
        toast.error("Could not load PWA settings");
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
    setSaving(true);
    try {
      const res = await fetch(`${BACKEND}/company/${companyId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ pwaShowLeaveBalance: showLeaveBalance }),
      });
      if (!res.ok) throw new Error(await res.text());
      toast.success("PWA settings saved");
    } catch {
      toast.error("Failed to save PWA settings");
    } finally {
      setSaving(false);
    }
  };

  if (user && user.role !== "SUPERADMIN" && user.role !== "COMPANY_ADMIN") {
    return (
      <PageLayout>
        <div className="p-8 text-center text-gray-500">Access restricted.</div>
      </PageLayout>
    );
  }

  return (
    <PageLayout>
      <div className="max-w-xl p-6 sm:p-8">
        <h1 className="text-2xl font-bold text-gray-900 mb-1">PWA app settings</h1>
        <p className="text-sm text-gray-500 mb-6">
          Controls what employees see in the mobile app for the selected company.
        </p>

        {loading ? (
          <p className="text-sm text-gray-400">Loading…</p>
        ) : !companyId ? (
          <p className="text-sm text-amber-700 bg-amber-50 border border-amber-100 rounded-lg px-4 py-3">
            Select a company in the sidebar, then return to this page.
          </p>
        ) : (
          <div className="bg-white border border-gray-200 rounded-xl p-5 space-y-4 shadow-sm">
            <label className="flex items-start gap-3 cursor-pointer">
              <input
                type="checkbox"
                className="mt-1 h-4 w-4 rounded border-gray-300"
                checked={showLeaveBalance}
                onChange={(e) => setShowLeaveBalance(e.target.checked)}
              />
              <span>
                <span className="block text-sm font-semibold text-gray-900">
                  Show leave balance in PWA
                </span>
                <span className="block text-xs text-gray-500 mt-1 leading-relaxed">
                  When enabled, all employees in this company see Sick, Casual, and Privilege
                  balance cards on the Leave screen. When disabled, balances are hidden for
                  everyone.
                </span>
              </span>
            </label>
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
    </PageLayout>
  );
}
