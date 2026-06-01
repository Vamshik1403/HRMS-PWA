"use client";

import { useRef, useState } from "react";
import { Button } from "./ui/button";
import { uploadPdfFile } from "../utils/uploadPdf";
import { normalizeUploadPath, resolveUploadUrl } from "../utils/uploadUrl";

type Props = {
  label?: string;
  value?: string | null;
  onChange: (url: string | null) => void;
  disabled?: boolean;
};

export function PdfUploadField({ label = "PDF", value, onChange, disabled }: Props) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);

  const pick = async (file: File | null) => {
    if (!file) return;
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

  return (
    <div className="space-y-1">
      {label ? <span className="text-xs text-gray-500">{label}</span> : null}
      <div className="flex flex-wrap items-center gap-2">
        <input
          ref={inputRef}
          type="file"
          accept="application/pdf,.pdf"
          className="hidden"
          disabled={disabled || uploading}
          onChange={(e) => {
            const f = e.target.files?.[0] ?? null;
            void pick(f);
            e.target.value = "";
          }}
        />
        <Button
          type="button"
          variant="outline"
          size="sm"
          disabled={disabled || uploading}
          onClick={() => inputRef.current?.click()}
        >
          {uploading ? "Uploading…" : "Upload PDF"}
        </Button>
        {value ? (
          <>
            <a
              href={resolveUploadUrl(value)}
              target="_blank"
              rel="noreferrer"
              className="text-xs text-blue-600 underline"
            >
              View PDF
            </a>
            <Button type="button" variant="ghost" size="sm" onClick={() => onChange(null)}>
              Remove
            </Button>
          </>
        ) : (
          <span className="text-xs text-gray-400">No file</span>
        )}
      </div>
    </div>
  );
}
