"use client";

import { Plus, X } from "lucide-react";
import { Button } from "./button";
import { Input } from "./input";
import { Label } from "./label";

export function MultiValueField({
  label,
  values,
  onChange,
  placeholder,
  type = "text",
  required,
  inputMode,
  maxLength,
  transform,
}: {
  label: string;
  values: string[];
  onChange: (values: string[]) => void;
  placeholder?: string;
  type?: string;
  required?: boolean;
  inputMode?: React.HTMLAttributes<HTMLInputElement>["inputMode"];
  maxLength?: number;
  transform?: (value: string) => string;
}) {
  const rows = values.length ? values : [""];

  const updateAt = (index: number, value: string) => {
    const next = [...rows];
    next[index] = transform ? transform(value) : value;
    onChange(next);
  };

  const addRow = () => onChange([...rows, ""]);

  const removeAt = (index: number) => {
    if (rows.length <= 1) {
      onChange([""]);
      return;
    }
    onChange(rows.filter((_, i) => i !== index));
  };

  return (
    <div className="space-y-2">
      <Label>
        {label}
        {required ? <span className="text-red-500"> *</span> : null}
      </Label>
      <div className="space-y-2">
        {rows.map((val, index) => (
          <div key={index} className="flex items-center gap-2">
            <Input
              type={type}
              value={val}
              onChange={(e) => updateAt(index, e.target.value)}
              placeholder={placeholder}
              inputMode={inputMode}
              maxLength={maxLength}
              required={required && index === 0}
              className="flex-1 min-w-0"
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
