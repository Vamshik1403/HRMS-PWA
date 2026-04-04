"use client";

import { useState, useEffect, useRef } from "react";
import { Input } from "./ui/input";
import { Label } from "./ui/label";

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
}: SearchSuggestInputProps) {
  const [suggestions, setSuggestions] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const timeoutRef = useRef<NodeJS.Timeout>();

  const handleInputChange = async (inputValue: string) => {
    onChange(inputValue);
    
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
    }

    if (inputValue.length < 1) {
      setSuggestions([]);
      setShowSuggestions(false);
      return;
    }

    timeoutRef.current = setTimeout(async () => {
      setIsLoading(true);
      try {
        const data = await fetchData(inputValue);
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

  const handleFocus = (e: React.FocusEvent<HTMLInputElement>) => {
    const target = e.target;
    const len = target.value.length;
    requestAnimationFrame(() => {
      target.setSelectionRange(len, len);
    });
  };

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

  return (
    <div ref={containerRef} className="space-y-2 relative">
      <Label>{label}</Label>
      <Input
        value={value}
        onChange={(e) => handleInputChange(e.target.value)}
        onFocus={handleFocus}
        placeholder={placeholder}
        required={required}
        spellCheck={false}
        autoComplete="off"
        autoCorrect="off"
      />
      
      {showSuggestions && (
        <div className="absolute z-10 bg-white border rounded-md shadow-lg w-full max-h-48 overflow-y-auto">
          {isLoading ? (
            <div className="px-3 py-2 text-sm text-gray-500">Loading...</div>
          ) : suggestions.length > 0 ? (
            suggestions.map((item, index) => (
              <div
                key={index}
                className="px-3 py-2 hover:bg-gray-100 cursor-pointer text-sm"
                onClick={() => handleSelect(item)}
              >
                {item[displayField] || ""}
              </div>
            ))
          ) : (
            <div className="px-3 py-2 text-sm text-gray-500">No results found</div>
          )}
        </div>
      )}
    </div>
  );
}
