"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Icon } from "@iconify/react";
import EmpMobileLayout from "../../components/layout/EmpMobileLayout";
import { EmpMobileDateField } from "../../components/emp/EmpMobileDateField";
import { useCurrentUser } from "../../hooks/useCurrentUser";

const BACKEND = process.env.NEXT_PUBLIC_BACKEND_URL || "/backend";

export default function EmpLeaveNewPage() {
  const user = useCurrentUser();
  const router = useRouter();
  const [fromDate, setFromDate] = useState("");
  const [toDate, setToDate] = useState("");
  const [purpose, setPurpose] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [creds, setCreds] = useState<any>(null);

  useEffect(() => {
    if (!user?.username) return;
    fetch(`${BACKEND}/manage-emp/credentials/${encodeURIComponent(user.username)}`)
      .then((r) => (r.ok ? r.json() : null))
      .then(setCreds)
      .catch(() => {});
  }, [user]);

  const submit = async () => {
    if (!creds?.employee?.id || !fromDate || !toDate || purpose.trim().length < 3) return;
    setSubmitting(true);
    try {
      const res = await fetch(`${BACKEND}/leave-application`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          serviceProviderID: creds.serviceProviderID,
          companyID: creds.companyID,
          branchesID: creds.branchesID,
          manageEmployeeID: creds.employee.id,
          appliedLeaveType: "",
          fromDate: new Date(fromDate),
          toDate: new Date(toDate),
          purpose: purpose.trim(),
          status: "Pending",
        }),
      });
      if (!res.ok) throw new Error("Failed");
      router.replace("/empLeaveApplication");
    } catch {
      alert("Could not submit leave request");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <EmpMobileLayout>
      <div className="px-4 pt-4 pb-8">
        <button
          type="button"
          onClick={() => router.back()}
          className="flex items-center gap-1 text-[13px] font-semibold text-[#2563eb] mb-3"
        >
          <Icon icon="solar:arrow-left-linear" className="w-5 h-5" />
          Back
        </button>
        <h1 className="text-[20px] font-bold text-gray-900 mb-1">New leave request</h1>
        <p className="text-[12px] text-gray-500 mb-5">
          Select dates and reason. Leave type is assigned by your manager on approval.
        </p>

        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-4 space-y-4">
          <EmpMobileDateField label="From date" value={fromDate} onChange={setFromDate} max={toDate || undefined} />
          <EmpMobileDateField label="To date" value={toDate} onChange={setToDate} min={fromDate || undefined} />
          <div>
            <label className="text-[11px] font-semibold text-gray-500 mb-1.5 block">Reason *</label>
            <textarea
              value={purpose}
              onChange={(e) => setPurpose(e.target.value)}
              rows={4}
              placeholder="Purpose of leave…"
              className="w-full rounded-xl border border-gray-200 px-3 py-2.5 text-[14px] resize-none focus:outline-none focus:ring-2 focus:ring-[#2563eb]/25"
            />
          </div>
          <button
            type="button"
            onClick={submit}
            disabled={submitting || !fromDate || !toDate || purpose.trim().length < 3}
            className="w-full py-3 rounded-xl bg-[#2563eb] text-white font-bold text-sm disabled:opacity-50"
          >
            {submitting ? "Submitting…" : "Submit request"}
          </button>
        </div>
      </div>
    </EmpMobileLayout>
  );
}
