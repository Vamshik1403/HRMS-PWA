"use client";

import { useState, useEffect, useRef } from "react";
import { Input } from "./ui/input";
import { Label } from "./ui/label";
import { formDropdownClass, formDropdownItemClass } from "./ui/form-control-styles";
import { cn } from "@/app/utils/cn";
import { Search } from "lucide-react";

interface SearchSuggestInputProps {
  label: string;
  placeholder: string;
  value: string;
  onChange: (value: string) => void;
  onSelect: (selected: { display: string; value: number; item: any }) => void;
  fetchData: (query: string) => Promise<any[]>;
  displayField: string;
  valueField: string;
  required?: boolean;
  disabled?: boolean;
  /** When true, auto-selects if fetchData("") returns exactly one unique row. */
  autoSelectIfSingle?: boolean;
}

export function SearchSuggestInput({
  label,
  placeholder,
  value,
  onChange,
  onSelect,
  fetchData,
  displayField,
  valueField,
  required = false,
  disabled = false,
  autoSelectIfSingle = false,
}: SearchSuggestInputProps) {
  const [suggestions, setSuggestions] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const timeoutRef = useRef<NodeJS.Timeout>();
  const autoSelectedRef = useRef(false);

  const dedupe = (data: any[]) => {
    const seen = new Set<string>();
    return (Array.isArray(data) ? data : []).filter((item) => {
      const key = String(item?.[valueField] ?? "");
      if (!key || seen.has(key)) return false;
      seen.add(key);
      return true;
    });
  };

  const handleSelect = (item: any) => {
    const displayValue = item[displayField] || "";
    const selectedValue = item[valueField];
    
    onChange(displayValue);
    onSelect({
      display: displayValue,
      value: selectedValue,
      item: item,
    });
    
    setShowSuggestions(false);
    setSuggestions([]);
  };

  const handleInputChange = async (inputValue: string) => {
    onChange(inputValue);
    
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
    }

    timeoutRef.current = setTimeout(async () => {
      setIsLoading(true);
      try {
        const data = dedupe(await fetchData(inputValue));
        setSuggestions(data.slice(0, 10));
        setShowSuggestions(true);
      } catch (error) {
        console.error("Error fetching suggestions:", error);
        setSuggestions([]);
      } finally {
        setIsLoading(false);
      }
    }, 300);
  };

  const handleFocus = async (e: React.FocusEvent<HTMLInputElement>) => {
    const target = e.target;
    const len = target.value.length;
    requestAnimationFrame(() => {
      target.setSelectionRange(len, len);
    });
    if (!showSuggestions) {
      setIsLoading(true);
      try {
        const data = dedupe(await fetchData(value));
        setSuggestions(data.slice(0, 10));
        setShowSuggestions(true);
      } catch (error) {
        console.error("Error fetching suggestions:", error);
        setSuggestions([]);
      } finally {
        setIsLoading(false);
      }
    }
  };

  useEffect(() => {
    if (!value) autoSelectedRef.current = false;
  }, [value]);

  useEffect(() => {
    if (!autoSelectIfSingle || disabled || autoSelectedRef.current || value) return;
    let cancelled = false;
    (async () => {
      try {
        const data = dedupe(await fetchData(""));
        if (cancelled || data.length !== 1) return;
        autoSelectedRef.current = true;
        handleSelect(data[0]);
      } catch {
        /* ignore */
      }
    })();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [autoSelectIfSingle, disabled, value]);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setShowSuggestions(false);
      }
    };

    document.addEventListener("mousedown", handleClickOutside);
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }
    };
  }, []);

  const showRequiredMark = required && !/\*\s*$/.test(label);

  return (
    <div ref={containerRef} className="space-y-2.5 relative">
      <Label>
        {label}
        {showRequiredMark && (
          <span className="text-red-500 ml-0.5" aria-hidden="true">
            *
          </span>
        )}
      </Label>
      <div className="relative">
        <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 size-4 text-muted-foreground pointer-events-none" />
        <Input
          value={value}
          onChange={(e) => handleInputChange(e.target.value)}
          onFocus={handleFocus}
          placeholder={placeholder}
          required={required}
          disabled={disabled}
          spellCheck={false}
          autoComplete="off"
          autoCorrect="off"
          className="pl-10"
        />
      </div>

      {showSuggestions && (
        <div className={cn(formDropdownClass, "absolute z-50 w-full max-h-52 overflow-y-auto mt-1 p-1.5")}>
          {isLoading ? (
            <div className="px-3 py-2.5 text-sm text-muted-foreground">Searching…</div>
          ) : suggestions.length > 0 ? (
            suggestions.map((item) => (
              <div
                key={String(item[valueField])}
                className={formDropdownItemClass}
                onMouseDown={(e) => {
                  e.preventDefault();
                  handleSelect(item);
                }}
              >
                {item[displayField] || ""}
              </div>
            ))
          ) : (
            <div className="px-3 py-2.5 text-sm text-muted-foreground">No results found</div>
          )}
        </div>
      )}
    </div>
  );
}
