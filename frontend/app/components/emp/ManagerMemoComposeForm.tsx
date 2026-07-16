"use client";

import { useState } from "react";
import { toast } from "sonner";
import type { EmpManagerReportee } from "../../utils/empManagerDisplay";
import { reporteeDisplayName } from "../../utils/empManagerDisplay";
import { uploadAttachmentFile } from "../../utils/uploadFile";
import { Button } from "../ui/button";
import { Label } from "../ui/label";
import { Input } from "../ui/input";
import { Textarea } from "../ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "../ui/select";

const BACKEND = process.env.NEXT_PUBLIC_BACKEND_URL || "/backend";

function authHeaders(): Record<string, string> {
  const token =
    typeof window !== "undefined"
      ? localStorage.getItem("token") || localStorage.getItem("accessToken") || ""
      : "";
  return token ? { Authorization: `Bearer ${token}` } : {};
}

export function ManagerMemoComposeForm({
  reportees,
  managerName,
  onSent,
  onCancel,
}: {
  reportees: EmpManagerReportee[];
  managerName?: string;
  onSent: () => void;
  onCancel?: () => void;
}) {
  const [employeeId, setEmployeeId] = useState("");
  const [memoType, setMemoType] = useState("General");
  const [subject, setSubject] = useState("");
  const [description, setDescription] = useState("");
  const [sending, setSending] = useState(false);
  const [attachmentFile, setAttachmentFile] = useState<File | null>(null);

  const submit = async () => {
    if (!employeeId) {
      toast.error("Select a team member");
      return;
    }
    if (!subject.trim()) {
      toast.error("Subject is required");
      return;
    }
    setSending(true);
    try {
      let attachmentPath: string | undefined;
      if (attachmentFile) {
        attachmentPath = await uploadAttachmentFile(attachmentFile);
      }
      const res = await fetch(`${BACKEND}/employee-memo`, {
        method: "POST",
        headers: { "Content-Type": "application/json", ...authHeaders() },
        body: JSON.stringify({
          employeeID: Number(employeeId),
          memoType,
          subject: subject.trim(),
          description: description.trim() || undefined,
          issuedDate: new Date().toISOString().slice(0, 10),
          issuedBy: managerName || "Manager",
          issuedByRole: "MANAGER",
          attachmentPath,
        }),
      });
      if (!res.ok) throw new Error("Send failed");
      const data = await res.json();
      const created = Array.isArray(data) ? data[0] : data;
      if (!created?.id) throw new Error("No notice was created");
      toast.success("Notice sent");
      setSubject("");
      setDescription("");
      setEmployeeId("");
      setAttachmentFile(null);
      onSent();
      onCancel?.();
    } catch {
      toast.error("Could not send notice");
    } finally {
      setSending(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-2 sm:col-span-2">
          <Label>Team member</Label>
          <Select value={employeeId} onValueChange={setEmployeeId}>
            <SelectTrigger>
              <SelectValue placeholder="Select employee" />
            </SelectTrigger>
            <SelectContent>
              {reportees.map((r) => (
                <SelectItem key={r.id} value={String(r.id)}>
                  {reporteeDisplayName(r)}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-2">
          <Label>Type</Label>
          <Select value={memoType} onValueChange={setMemoType}>
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="General">Notice</SelectItem>
              <SelectItem value="Warning">Warning</SelectItem>
              <SelectItem value="Policy">Policy</SelectItem>
              <SelectItem value="Appreciation">Appreciation</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-2">
          <Label htmlFor="memo-subject">Subject</Label>
          <Input
            id="memo-subject"
            value={subject}
            onChange={(e) => setSubject(e.target.value)}
          />
        </div>
        <div className="space-y-2 sm:col-span-2">
          <Label htmlFor="memo-message">Message</Label>
          <Textarea
            id="memo-message"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            rows={4}
          />
        </div>
        <div className="space-y-2 sm:col-span-2">
          <Label htmlFor="memo-attachment">Attachment</Label>
          <Input
            id="memo-attachment"
            type="file"
            accept="image/*,.pdf,.doc,.docx,.xls,.xlsx,.txt"
            onChange={(e) => setAttachmentFile(e.target.files?.[0] ?? null)}
          />
        </div>
      </div>
      <div className="flex flex-wrap justify-end gap-2 border-t border-border pt-4">
        {onCancel ? (
          <Button type="button" variant="outline" onClick={onCancel} disabled={sending}>
            Cancel
          </Button>
        ) : null}
        <Button type="button" onClick={() => void submit()} disabled={sending}>
          {sending ? "Sending…" : "Send to employee"}
        </Button>
      </div>
    </div>
  );
}
