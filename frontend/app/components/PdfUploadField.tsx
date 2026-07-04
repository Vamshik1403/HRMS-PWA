"use client";

import { useRef, useState } from "react";
import { uploadPdfFile } from "../utils/uploadPdf";
import { normalizeUploadPath, resolveUploadUrl } from "../utils/uploadUrl";
import { FileDropzone } from "./ui/file-dropzone";
import { Button } from "./ui/button";

type Props = {
  label?: string;
  value?: string | null;
  onChange: (url: string | null) => void;
  disabled?: boolean;
};

export function PdfUploadField({ label = "PDF", value, onChange, disabled }: Props) {
  const [uploading, setUploading] = useState(false);

  const pick = async (file: File | null) => {
    if (!file) {
      onChange(null);
      return;
    }
    if (!file.name.toLowerCase().endsWith(".pdf")) {
      alert("Please select a PDF file");
      return;
    }
    setUploading(true);
    try {
      const url = await uploadPdfFile(file);
      onChange(normalizeUploadPath(url));
    } catch {
      alert("Failed to upload PDF");
    } finally {
      setUploading(false);
    }
  };

  if (value) {
    return (
      <div className="space-y-2">
        {label ? <p className="text-sm font-medium text-foreground">{label}</p> : null}
        <div className="flex items-center justify-between gap-3 rounded-xl border border-[#E2E8F0] bg-[#F8FAFC] px-4 py-3">
          <a
            href={resolveUploadUrl(value)}
            target="_blank"
            rel="noreferrer"
            className="text-sm font-medium text-primary hover:underline truncate"
          >
            View uploaded PDF
          </a>
          <Button type="button" variant="ghost" size="sm" onClick={() => onChange(null)}>
            Remove
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-2">
      <FileDropzone
        label={label}
        accept="application/pdf,.pdf"
        hint="PDF only"
        variant="document"
        disabled={disabled || uploading}
        onChange={(file) => void pick(file)}
      />
      {uploading && <p className="text-xs text-muted-foreground">Uploading…</p>}
    </div>
  );
}
