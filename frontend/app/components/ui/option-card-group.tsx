"use client";

import type { LucideIcon } from "lucide-react";
import { cn } from "@/app/utils/cn";
import { Checkbox } from "./checkbox";

export interface OptionCardItem {
  value: string;
  label: string;
  description?: string;
  icon?: LucideIcon;
}

interface OptionCardGroupProps {
  options: OptionCardItem[];
  value: string[];
  onChange: (value: string[]) => void;
  multiple?: boolean;
  className?: string;
}

export function OptionCardGroup({
  options,
  value,
  onChange,
  multiple = true,
  className,
}: OptionCardGroupProps) {
  const toggle = (optionValue: string, checked: boolean) => {
    if (multiple) {
      onChange(
        checked ? [...value, optionValue] : value.filter((v) => v !== optionValue),
      );
      return;
    }
    onChange(checked ? [optionValue] : []);
  };

  return (
    <div className={cn("grid grid-cols-1 sm:grid-cols-3 gap-2.5", className)}>
      {options.map((option) => {
        const selected = value.includes(option.value);
        const Icon = option.icon;
        return (
          <label
            key={option.value}
            className={cn(
              "relative flex cursor-pointer items-start gap-2.5 rounded-lg border p-3 transition-all duration-150",
              selected
                ? "border-primary bg-primary/5"
                : "border-[#E2E8F0] bg-background hover:border-[#CBD5E1] hover:bg-[#F8FAFC]",
            )}
          >
            <Checkbox
              checked={selected}
              onCheckedChange={(checked) => toggle(option.value, checked === true)}
              className="mt-0.5"
            />
            <div className="min-w-0 flex-1 space-y-0.5">
              <div className="flex items-center gap-2">
                {Icon && (
                  <Icon
                    className={cn(
                      "size-3.5 shrink-0",
                      selected ? "text-primary" : "text-muted-foreground",
                    )}
                  />
                )}
                <p className="text-sm font-medium text-foreground">{option.label}</p>
              </div>
              {option.description && (
                <p className="text-xs text-muted-foreground leading-snug pl-5">
                  {option.description}
                </p>
              )}
            </div>
          </label>
        );
      })}
    </div>
  );
}
