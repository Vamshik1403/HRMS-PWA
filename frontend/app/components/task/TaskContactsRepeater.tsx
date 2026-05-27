"use client";

import { Plus, Trash2 } from "lucide-react";
import { Button } from "../ui/button";
import { Input } from "../ui/input";
import { Label } from "../ui/label";

export interface TaskContactRow {
  contactPerson: string;
  contactNumber: string;
  designation?: string;
  email?: string;
}

const emptyContact = (): TaskContactRow => ({ contactPerson: "", contactNumber: "", designation: "", email: "" });

interface TaskContactsRepeaterProps {
  title?: string;
  contacts: TaskContactRow[];
  onChange: (contacts: TaskContactRow[]) => void;
}

export function TaskContactsRepeater({ title = "Contacts", contacts, onChange }: TaskContactsRepeaterProps) {
  // Only show rows that were explicitly added; start empty
  const update = (index: number, patch: Partial<TaskContactRow>) =>
    onChange(contacts.map((c, i) => (i === index ? { ...c, ...patch } : c)));
  const add = () => onChange([...contacts, emptyContact()]);
  const remove = (index: number) => onChange(contacts.filter((_, i) => i !== index));

  return (
    <div className="space-y-3 pt-2">
      <div className="flex items-center justify-between">
        <Label className="text-base font-semibold">{title}</Label>
        <Button type="button" variant="outline" size="sm" onClick={add}>
          <Plus className="w-4 h-4 mr-1" /> Add Contact
        </Button>
      </div>
      {contacts.length === 0 && (
        <p className="text-[12px] text-gray-400 italic">No contacts added yet. Click &quot;Add Contact&quot; to add one.</p>
      )}
      {contacts.map((c, index) => (
        <div key={index} className="rounded-lg border border-gray-200 p-4 space-y-3 bg-gray-50/40">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-semibold uppercase tracking-wide text-gray-500">Contact {index + 1}</span>
            <Button type="button" variant="ghost" size="sm" className="text-red-600" onClick={() => remove(index)}>
              <Trash2 className="w-4 h-4 mr-1" /> Remove
            </Button>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="space-y-1.5"><Label>Contact Person *</Label><Input value={c.contactPerson} onChange={(e) => update(index, { contactPerson: e.target.value })} /></div>
            <div className="space-y-1.5"><Label>Designation</Label><Input value={c.designation || ""} onChange={(e) => update(index, { designation: e.target.value })} placeholder="Optional" /></div>
            <div className="space-y-1.5"><Label>Contact Number *</Label><Input value={c.contactNumber} onChange={(e) => update(index, { contactNumber: e.target.value })} /></div>
            <div className="space-y-1.5"><Label>Email Address</Label><Input type="email" value={c.email || ""} onChange={(e) => update(index, { email: e.target.value })} placeholder="Optional" /></div>
          </div>
        </div>
      ))}
    </div>
  );
}

export function sanitizeContacts(contacts: TaskContactRow[]): TaskContactRow[] {
  return contacts
    .filter((c) => c.contactPerson.trim() && c.contactNumber.trim())
    .map((c) => ({ contactPerson: c.contactPerson.trim(), contactNumber: c.contactNumber.trim(), designation: c.designation?.trim() || undefined, email: c.email?.trim() || undefined }));
}
