"use client"

import * as React from "react"

import { cn } from "@/app/utils/cn"
import { formTextareaClass } from "./form-control-styles"

export interface TextareaProps
  extends React.TextareaHTMLAttributes<HTMLTextAreaElement> {
  showCount?: boolean;
  maxLength?: number;
}

const Textarea = React.forwardRef<HTMLTextAreaElement, TextareaProps>(
  ({ className, showCount, maxLength, value, onChange, ...props }, ref) => {
    const length = typeof value === "string" ? value.length : 0;

    return (
      <div className="space-y-1.5">
        <textarea
          className={cn(formTextareaClass, className)}
          ref={ref}
          value={value}
          onChange={onChange}
          maxLength={maxLength}
          {...props}
        />
        {showCount && maxLength && (
          <p className="text-right text-xs text-muted-foreground tabular-nums">
            {length} / {maxLength}
          </p>
        )}
      </div>
    )
  }
)
Textarea.displayName = "Textarea"

export { Textarea }
