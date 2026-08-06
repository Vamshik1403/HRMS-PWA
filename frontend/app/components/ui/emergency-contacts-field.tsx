"use client";

import { Plus, X } from "lucide-react";
import { Button } from "./button";
import { Input } from "./input";
import { Label } from "./label";

export interface EmergencyContactEntry {
  name: string;
  relation: string;
  contactNo: string;
}

export const EMPTY_EMERGENCY_CONTACT: EmergencyContactEntry = {
  name: "",
  relation: "",
  contactNo: "",
};

export function EmergencyContactsField({
  label = "Emergency Contact",
  values,
  onChange,
}: {
  label?: string;
  values: EmergencyContactEntry[];
  onChange: (values: EmergencyContactEntry[]) => void;
}) {
  const rows = values.length ? values : [{ ...EMPTY_EMERGENCY_CONTACT }];

  const updateAt = (index: number, field: keyof EmergencyContactEntry, value: string) => {
    const next = rows.map((row, i) => (i === index ? { ...row, [field]: value } : row));
    onChange(next);
  };

  const addRow = () => onChange([...rows, { ...EMPTY_EMERGENCY_CONTACT }]);

  const removeAt = (index: number) => {
    if (rows.length <= 1) {
      onChange([{ ...EMPTY_EMERGENCY_CONTACT }]);
      return;
    }
    onChange(rows.filter((_, i) => i !== index));
  };

  return (
    <div className="space-y-2">
      <Label>{label}</Label>
      <div className="space-y-3">
        {rows.map((row, index) => (
          <div key={index} className="flex flex-col gap-2 sm:flex-row sm:items-center">
            <Input
              value={row.name}
              onChange={(e) => updateAt(index, "name", e.target.value)}
              placeholder="Name"
              className="sm:flex-1 min-w-0"
            />
            <Input
              value={row.relation}
              onChange={(e) => updateAt(index, "relation", e.target.value)}
              placeholder="Relation"
              className="sm:flex-1 min-w-0"
            />
            <Input
              value={row.contactNo}
              onChange={(e) => updateAt(index, "contactNo", e.target.value)}
              placeholder="Contact No."
              inputMode="tel"
              className="sm:flex-1 min-w-0"
            />
            <div className="flex shrink-0 items-center gap-1">
              {index === rows.length - 1 && (
                <Button
                  type="button"
                  variant="outline"
                  size="icon"
                  className="h-9 w-9"
                  onClick={addRow}
                  aria-label={`Add ${label}`}
                  title="Add another"
                >
                  <Plus className="h-4 w-4" />
                </Button>
              )}
              {rows.length > 1 && (
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  className="h-9 w-9 text-red-600 hover:bg-red-50"
                  onClick={() => removeAt(index)}
                  aria-label="Remove"
                >
                  <X className="h-4 w-4" />
                </Button>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
