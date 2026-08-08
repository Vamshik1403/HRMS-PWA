"use client";

import { useEffect, useRef } from "react";
import { Input } from "../ui/input";
import { Label } from "../ui/label";
import { SearchSuggestInput } from "../SearchSuggestInput";
import { useCompanyBranches } from "@/app/hooks/useCompanyBranches";

type BranchSelectPayload = {
  display: string;
  value: number;
  item: any;
};

type CompanyBranchFieldProps = {
  label?: string;
  placeholder?: string;
  /** Display text (branch name). */
  value: string;
  onChange: (value: string) => void;
  onSelect: (selected: BranchSelectPayload) => void;
  /** Used when more than one branch exists. */
  fetchData: (query: string) => Promise<any[]>;
  displayField?: string;
  valueField?: string;
  required?: boolean;
  disabled?: boolean;
  /** Optional company scope for the single-branch hook. */
  companyID?: number | null;
  className?: string;
  /**
   * When true (default), a lone company branch is pre-selected and shown read-only.
   */
  autoSelectSingle?: boolean;
};

/**
 * Branch picker that auto-fills (and hides the dropdown) when the company
 * has exactly one branch — shared across admin form modals.
 */
export function CompanyBranchField({
  label = "Branch Name",
  placeholder = "Start typing branch name...",
  value,
  onChange,
  onSelect,
  fetchData,
  displayField = "branchName",
  valueField = "id",
  required = false,
  disabled = false,
  companyID,
  className,
  autoSelectSingle = true,
}: CompanyBranchFieldProps) {
  const { isSingleBranch, singleBranch, loading, autoBranchName } =
    useCompanyBranches(companyID);
  const appliedIdRef = useRef<number | null>(null);
  const onChangeRef = useRef(onChange);
  const onSelectRef = useRef(onSelect);
  onChangeRef.current = onChange;
  onSelectRef.current = onSelect;

  // Allow re-apply after form reset clears the value.
  useEffect(() => {
    if (!value) appliedIdRef.current = null;
  }, [value]);

  useEffect(() => {
    if (!autoSelectSingle || disabled || loading || !isSingleBranch || !singleBranch) {
      return;
    }
    if (appliedIdRef.current === singleBranch.id) return;
    appliedIdRef.current = singleBranch.id;

    const name = singleBranch.branchName || autoBranchName || "";
    onChangeRef.current(name);
    onSelectRef.current({
      display: name,
      value: singleBranch.id,
      item: singleBranch,
    });
  }, [
    autoSelectSingle,
    disabled,
    loading,
    isSingleBranch,
    singleBranch,
    autoBranchName,
  ]);

  if (autoSelectSingle && (loading || isSingleBranch)) {
    return (
      <div className={className ?? "space-y-2"}>
        <Label>
          {label}
          {required && !/\*\s*$/.test(label) ? " *" : ""}
        </Label>
        <Input
          value={value || autoBranchName || (loading ? "Loading…" : "")}
          readOnly
          disabled={disabled}
          className="bg-muted"
        />
      </div>
    );
  }

  return (
    <div className={className}>
      <SearchSuggestInput
        label={label}
        placeholder={placeholder}
        value={value}
        onChange={onChange}
        onSelect={onSelect}
        fetchData={async (q) => {
          const rows = await fetchData(q);
          const seen = new Set<string>();
          return (Array.isArray(rows) ? rows : []).filter((row) => {
            const id = String(row?.[valueField] ?? "");
            if (!id || seen.has(id)) return false;
            seen.add(id);
            return true;
          });
        }}
        displayField={displayField}
        valueField={valueField}
        required={required}
        disabled={disabled}
      />
    </div>
  );
}

/** Apply single-branch defaults into form open / reset handlers. */
export function singleBranchDefaults(
  isSingleBranch: boolean,
  autoBranchId: number | null,
  autoBranchName: string | null,
): { branchesID?: number; branchName?: string; brAutocomplete?: string } {
  if (!isSingleBranch || !autoBranchId) return {};
  const name = autoBranchName || "";
  return {
    branchesID: autoBranchId,
    branchName: name,
    brAutocomplete: name,
  };
}
