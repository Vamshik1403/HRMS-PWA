import * as React from "react"
import { cva, type VariantProps } from "class-variance-authority"

import { cn } from "@/app/utils/cn"

const badgeVariants = cva(
  "inline-flex h-6 items-center rounded-full border px-2.5 text-xs font-semibold transition-colors focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2",
  {
    variants: {
      variant: {
        default:
          "border-transparent bg-primary/10 text-primary hover:bg-primary/15",
        secondary:
          "border-transparent bg-accent text-accent-foreground hover:bg-accent/80",
        muted:
          "border-transparent bg-[#F3F4F6] text-[#4B5563] dark:bg-muted dark:text-muted-foreground",
        success:
          "border-transparent bg-[#ECFDF5] text-[#16A34A] dark:bg-emerald-950/40 dark:text-emerald-400",
        warning:
          "border-transparent bg-[#FFFBEB] text-[#D97706] dark:bg-amber-950/40 dark:text-amber-400",
        info:
          "border-transparent bg-[#EFF6FF] text-[#2563EB] dark:bg-blue-950/40 dark:text-blue-400",
        destructive:
          "border-transparent bg-[#FEF2F2] text-[#DC2626] dark:bg-rose-950/40 dark:text-rose-400",
        outline: "border-border text-foreground",
      },
    },
    defaultVariants: {
      variant: "default",
    },
  }
)

export interface BadgeProps
  extends React.HTMLAttributes<HTMLDivElement>,
    VariantProps<typeof badgeVariants> {}

function Badge({ className, variant, ...props }: BadgeProps) {
  return (
    <div className={cn(badgeVariants({ variant }), className)} {...props} />
  )
}

export { Badge, badgeVariants }
