"use client"

import * as React from "react"
import * as LabelPrimitive from "@radix-ui/react-label"
import { cva, type VariantProps } from "class-variance-authority"

import { cn } from "@/app/utils/cn"

const labelVariants = cva(
  "text-sm font-medium leading-none text-foreground peer-disabled:cursor-not-allowed peer-disabled:opacity-70"
)

function decorateRequiredAsterisk(children: React.ReactNode): React.ReactNode {
  if (typeof children === "string") {
    const match = children.match(/^(.*?)(\s*\*)$/)
    if (match) {
      return (
        <>
          {match[1]}
          <span className="text-red-500 ml-0.5" aria-hidden="true">
            *
          </span>
        </>
      )
    }
  }
  return children
}

const Label = React.forwardRef<
  React.ElementRef<typeof LabelPrimitive.Root>,
  React.ComponentPropsWithoutRef<typeof LabelPrimitive.Root> &
    VariantProps<typeof labelVariants>
>(({ className, children, ...props }, ref) => (
  <LabelPrimitive.Root
    ref={ref}
    className={cn(labelVariants(), className)}
    {...props}
  >
    {decorateRequiredAsterisk(children)}
  </LabelPrimitive.Root>
))
Label.displayName = LabelPrimitive.Root.displayName

export { Label }
