"use client";

import { useEffect, useRef, type ReactNode } from "react";
import { Input } from "../ui/input";
import { Label } from "../ui/label";
import { useCompanyBranches } from "@/app/hooks/useCompanyBranches";

type AutocompleteBranchFieldProps = {
  label?: string;
  placeholder?: string;
  value: string;
  branchId?: number | null;
  companyID?: number | null;
  required?: boolean;
  disabled?: boolean;
  onInputChange: (display: string) => void;
  onBranchSelect: (branch: { id: number; branchName: string; item?: any }) => void;
  onFetch: (query: string) => void;
  options: Array<{ id: number; branchName?: string | null }>;
  optionsLoading?: boolean;
  hint?: ReactNode;
};

/**
 * Autocomplete branch field for payroll-style forms.
 * Auto-fills and locks when the company has exactly one branch.
 * Dedupes suggestion rows by id (avoids duplicate branch names).
 */
export function AutocompleteBranchField({
  label = "Branch *",
  placeholder = "Start typing branch…",
  value,
  branchId,
  companyID,
  required = true,
  disabled = false,
  onInputChange,
  onBranchSelect,
  onFetch,
  options,
  optionsLoading = false,
  hint,
}: AutocompleteBranchFieldProps) {
  const { isSingleBranch, singleBranch, loading, autoBranchName } =
    useCompanyBranches(companyID);
  const appliedIdRef = useRef<number | null>(null);
  const onInputChangeRef = useRef(onInputChange);
  const onBranchSelectRef = useRef(onBranchSelect);
  onInputChangeRef.current = onInputChange;
  onBranchSelectRef.current = onBranchSelect;

  useEffect(() => {
    if (!value && branchId == null) appliedIdRef.current = null;
  }, [value, branchId]);

  useEffect(() => {
    if (disabled || loading || !isSingleBranch || !singleBranch) return;
    if (appliedIdRef.current === singleBranch.id) return;
    if (branchId != null && Number(branchId) === Number(singleBranch.id)) {
      appliedIdRef.current = singleBranch.id;
      return;
    }
    appliedIdRef.current = singleBranch.id;
    const name = singleBranch.branchName || autoBranchName || "";
    onInputChangeRef.current(name);
    onBranchSelectRef.current({
      id: singleBranch.id,
      branchName: name,
      item: singleBranch,
    });
  }, [
    disabled,
    loading,
    isSingleBranch,
    singleBranch,
    autoBranchName,
    branchId,
  ]);

  if (loading || isSingleBranch) {
    return (
      <div className="space-y-2">
        <Label>{label}</Label>
        <Input
          value={value || autoBranchName || (loading ? "Loading…" : "")}
          readOnly
          disabled={disabled}
          className="bg-muted"
          required={required}
        />
        {hint}
      </div>
    );
  }

  const seen = new Set<number>();
  const seenNames = new Set<string>();
  const uniqueOptions = options.filter((br) => {
    const id = Number(br.id);
    if (!Number.isFinite(id) || seen.has(id)) return false;
    const nameKey = String(br.branchName || "").trim().toLowerCase();
    if (nameKey && seenNames.has(nameKey)) return false;
    seen.add(id);
    if (nameKey) seenNames.add(nameKey);
    return true;
  });

  return (
    <div className="space-y-2 relative">
      <Label>{label}</Label>
      <Input
        value={value}
        onChange={(e) => {
          const val = e.target.value;
          onInputChange(val);
          onFetch(val);
        }}
        onFocus={() => onFetch(value || "")}
        placeholder={placeholder}
        autoComplete="off"
        required={required}
        disabled={disabled}
      />
      {uniqueOptions.length > 0 && (
        <div className="absolute z-10 bg-white dark:bg-card border rounded w-full shadow max-h-48 overflow-y-auto">
          {optionsLoading && (
            <div className="px-3 py-2 text-sm text-muted-foreground">Loading…</div>
          )}
          {uniqueOptions.map((br) => (
            <div
              key={br.id}
              className="px-3 py-2 hover:bg-muted cursor-pointer"
              onMouseDown={(e) => e.preventDefault()}
              onClick={() => {
                onBranchSelect({
                  id: br.id,
                  branchName: br.branchName ?? "",
                  item: br,
                });
              }}
            >
              {br.branchName}
            </div>
          ))}
        </div>
      )}
      {hint}
    </div>
  );
}
