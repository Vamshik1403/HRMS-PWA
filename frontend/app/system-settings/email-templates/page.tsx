"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/app/components/ui/card";
import { Button } from "@/app/components/ui/button";
import { Input } from "@/app/components/ui/input";
import { Label } from "@/app/components/ui/label";
import { Textarea } from "@/app/components/ui/textarea";
import { useCurrentUser } from "@/app/hooks/useCurrentUser";
import { toast } from "sonner";

const BACKEND_URL = process.env.NEXT_PUBLIC_BACKEND_URL || "/backend";

// One unified template is used for every email type (leave, reimbursement,
// offboarding, notice board, warning). It is stored under the "ALL" event type.
const SINGLE_EVENT = "ALL";

const DEFAULT_TEMPLATE = {
  subject: "{{companyName}} – {{eventLabel}} – {{employeeName}}",
  bodyHtml:
    "<p>Dear {{employeeName}},</p>" +
    "<p>This is an update regarding your <strong>{{eventLabel}}</strong>.</p>" +
    "<p>{{subject}} {{purpose}} {{description}} {{details}}</p>" +
    "<p>{{fromDate}} {{toDate}} {{amount}}</p>" +
    "<p>Status: <strong>{{status}}</strong></p>",
};

type Template = {
  id?: number;
  companyID: number | null;
  eventType: string;
  subject: string;
  bodyHtml: string;
  enabled: boolean;
};

export default function EmailTemplatesSettingsPage() {
  const user = useCurrentUser();
  const [loading, setLoading] = useState(true);
  const [companyID, setCompanyID] = useState<number | null>(null);
  const [tpl, setTpl] = useState<Template>({
    companyID: null,
    eventType: SINGLE_EVENT,
    subject: DEFAULT_TEMPLATE.subject,
    bodyHtml: DEFAULT_TEMPLATE.bodyHtml,
    enabled: true,
  });

  const load = useCallback(async (cid: number | null) => {
    setLoading(true);
    try {
      const qs = cid != null ? `?companyID=${cid}` : "";
      const res = await fetch(`${BACKEND_URL}/email-template${qs}`, { cache: "no-store" });
      if (!res.ok) throw new Error(String(res.status));
      const data = await res.json();
      const list: Template[] = Array.isArray(data) ? data : data?.data ?? [];
      const match =
        list.find((t) => t.eventType === SINGLE_EVENT && t.companyID === cid) ??
        list.find((t) => t.eventType === SINGLE_EVENT && t.companyID == null);
      setTpl({
        id: match?.id,
        companyID: cid,
        eventType: SINGLE_EVENT,
        subject: match?.subject ?? DEFAULT_TEMPLATE.subject,
        bodyHtml: match?.bodyHtml ?? DEFAULT_TEMPLATE.bodyHtml,
        enabled: match?.enabled ?? true,
      });
    } catch {
      toast.error("Failed to load email template");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    (async () => {
      if (!user) return;
      let cid: number | null = null;
      if (user.role !== "SUPERADMIN") {
        const res = await fetch(`${BACKEND_URL}/users`, { cache: "no-store" });
        const users = await res.json();
        const me = users.find((u: { username?: string }) => u.username === user.username);
        cid = me?.companyID ?? null;
      }
      setCompanyID(cid);
      await load(cid);
    })();
  }, [user, load]);

  const resetDefaults = () => {
    setTpl((p) => ({ ...p, subject: DEFAULT_TEMPLATE.subject, bodyHtml: DEFAULT_TEMPLATE.bodyHtml }));
    toast.message("Reverted to default — click Save template to apply.");
  };

  const save = async () => {
    const res = await fetch(`${BACKEND_URL}/email-template`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        id: tpl.id,
        companyID,
        eventType: SINGLE_EVENT,
        subject: tpl.subject,
        bodyHtml: tpl.bodyHtml,
        enabled: tpl.enabled,
      }),
    });
    if (!res.ok) {
      toast.error("Save failed");
      return;
    }
    toast.success("Template saved");
    await load(companyID);
  };

  const placeholders = useMemo(
    () => [
      "companyName",
      "employeeName",
      "eventLabel",
      "status",
      "subject",
      "description",
      "purpose",
      "fromDate",
      "toDate",
      "amount",
      "details",
    ],
    [],
  );

  return (
    <div className="max-w-3xl mx-auto p-4 sm:p-6 space-y-6">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Email template</h1>
            <p className="text-sm text-gray-500 mt-1 max-w-2xl">
              This single template is used for <strong>every</strong> system email — leave
              application, reimbursement, offboarding, notice board and warning notices. Unused
              placeholders are simply left blank for events that don&apos;t have them.
            </p>
            <p className="text-xs text-gray-500 mt-2">
              Placeholders:{" "}
              {placeholders.map((p) => (
                <code key={p} className="text-xs bg-gray-100 px-1 rounded mr-1">{`{{${p}}}`}</code>
              ))}
            </p>
            <p className="text-xs text-gray-500 mt-1">
              Configure SMTP in <code className="text-xs bg-gray-100 px-1 rounded">backend/.env</code>.
            </p>
          </div>
          <Button type="button" variant="outline" onClick={resetDefaults}>
            Reset to default
          </Button>
        </div>

        {loading ? (
          <p className="text-sm text-gray-500">Loading…</p>
        ) : (
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-base flex items-center justify-between gap-2">
                <span>Email template (all types)</span>
                <label className="flex items-center gap-2 text-sm font-normal">
                  <input
                    type="checkbox"
                    checked={tpl.enabled}
                    onChange={(e) => setTpl((p) => ({ ...p, enabled: e.target.checked }))}
                  />
                  Enabled
                </label>
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="space-y-1">
                <Label>Subject</Label>
                <Input
                  value={tpl.subject}
                  onChange={(e) => setTpl((p) => ({ ...p, subject: e.target.value }))}
                />
              </div>
              <div className="space-y-1">
                <Label>Body (HTML)</Label>
                <Textarea
                  rows={9}
                  value={tpl.bodyHtml}
                  onChange={(e) => setTpl((p) => ({ ...p, bodyHtml: e.target.value }))}
                />
              </div>
              <Button type="button" size="sm" onClick={save}>
                Save template
              </Button>
            </CardContent>
          </Card>
        )}
      </div>
  );
}
