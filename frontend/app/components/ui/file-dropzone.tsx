"use client";

import { useRef, useState } from "react";
import { Upload, X, FileText, ImageIcon } from "lucide-react";
import { cn } from "@/app/utils/cn";
import { Button } from "./button";

interface FileDropzoneProps {
  label?: string;
  accept?: string;
  hint?: string;
  value?: File | null;
  previewUrl?: string | null;
  existingLabel?: string;
  onChange: (file: File | null) => void;
  disabled?: boolean;
  variant?: "image" | "document";
}

export function FileDropzone({
  label,
  accept,
  hint = "PNG, JPG, PDF up to 10MB",
  value,
  previewUrl,
  existingLabel,
  onChange,
  disabled,
  variant = "image",
}: FileDropzoneProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [dragOver, setDragOver] = useState(false);

  const pick = (file: File | null) => {
    if (!file) return;
    onChange(file);
  };

  const Icon = variant === "image" ? ImageIcon : FileText;
  const displayName = value?.name || existingLabel;

  return (
    <div className="space-y-2">
      {label && <p className="text-sm font-medium text-foreground">{label}</p>}
      <div
        role="button"
        tabIndex={0}
        onKeyDown={(e) => {
          if (e.key === "Enter" || e.key === " ") inputRef.current?.click();
        }}
        onDragOver={(e) => {
          e.preventDefault();
          setDragOver(true);
        }}
        onDragLeave={() => setDragOver(false)}
        onDrop={(e) => {
          e.preventDefault();
          setDragOver(false);
          if (!disabled) pick(e.dataTransfer.files?.[0] ?? null);
        }}
        onClick={() => !disabled && inputRef.current?.click()}
        className={cn(
          "flex flex-col items-center justify-center gap-3 rounded-xl border-2 border-dashed px-6 py-8 text-center transition-all duration-150 cursor-pointer",
          dragOver
            ? "border-primary bg-primary/5"
            : "border-[#E2E8F0] bg-[#F8FAFC] hover:border-[#CBD5E1] hover:bg-background",
          disabled && "pointer-events-none opacity-60",
        )}
      >
        <input
          ref={inputRef}
          type="file"
          accept={accept}
          className="hidden"
          disabled={disabled}
          onChange={(e) => {
            pick(e.target.files?.[0] ?? null);
            e.target.value = "";
          }}
        />
        {previewUrl && variant === "image" ? (
          <img src={previewUrl} alt="" className="h-16 w-16 rounded-lg object-cover border" />
        ) : (
          <span className="flex size-11 items-center justify-center rounded-xl bg-primary/10 text-primary">
            <Upload className="size-5" />
          </span>
        )}
        <div className="space-y-1">
          <p className="text-sm font-medium text-foreground">
            {displayName ? displayName : "Drop files here or browse"}
          </p>
          <p className="text-xs text-muted-foreground">{hint}</p>
        </div>
        {!displayName && (
          <Button type="button" variant="outline" size="sm" className="rounded-lg">
            <Icon className="size-4" />
            Browse
          </Button>
        )}
        {displayName && (
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className="text-muted-foreground"
            onClick={(e) => {
              e.stopPropagation();
              onChange(null);
            }}
          >
            <X className="size-4 mr-1" />
            Remove
          </Button>
        )}
      </div>
    </div>
  );
}
