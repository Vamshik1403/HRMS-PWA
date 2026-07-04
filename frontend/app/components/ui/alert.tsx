import * as React from "react"
import { cva, type VariantProps } from "class-variance-authority"
import { cn } from "@/lib/utils"

const alertVariants = cva(
  "relative w-full rounded-lg p-4 shadow-[0_1px_2px_rgba(0,0,0,0.04)] [&>svg~*]:pl-8 [&>svg+div]:translate-y-[-3px] [&>svg]:absolute [&>svg]:left-4 [&>svg]:top-4 [&>svg]:text-foreground",
  {
    variants: {
      variant: {
        default: "bg-background text-foreground ring-1 ring-border",
        destructive:
          "bg-destructive/[0.06] text-destructive ring-1 ring-destructive/20 dark:bg-destructive/10 [&>svg]:text-destructive",
        warning:
          "bg-amber-500/[0.08] text-foreground ring-1 ring-amber-500/20 dark:bg-amber-500/10 [&>svg]:text-amber-600 dark:[&>svg]:text-amber-400",
        info:
          "bg-primary/[0.06] text-foreground ring-1 ring-primary/15 dark:bg-primary/10 [&>svg]:text-primary",
        success:
          "bg-emerald-500/[0.08] text-foreground ring-1 ring-emerald-500/20 dark:bg-emerald-500/10 [&>svg]:text-emerald-600 dark:[&>svg]:text-emerald-400",
      },
    },
    defaultVariants: {
      variant: "default",
    },
  }
)

const Alert = React.forwardRef<
  HTMLDivElement,
  React.HTMLAttributes<HTMLDivElement> & VariantProps<typeof alertVariants>
>(({ className, variant, ...props }, ref) => (
  <div
    ref={ref}
    role="alert"
    className={cn(alertVariants({ variant }), className)}
    {...props}
  />
))
Alert.displayName = "Alert"

const AlertTitle = React.forwardRef<
  HTMLParagraphElement,
  React.HTMLAttributes<HTMLHeadingElement>
>(({ className, ...props }, ref) => (
  <h5
    ref={ref}
    className={cn("mb-1 font-medium leading-none tracking-tight", className)}
    {...props}
  />
))
AlertTitle.displayName = "AlertTitle"

const AlertDescription = React.forwardRef<
  HTMLParagraphElement,
  React.HTMLAttributes<HTMLParagraphElement>
>(({ className, ...props }, ref) => (
  <div
    ref={ref}
    className={cn("text-sm [&_p]:leading-relaxed", className)}
    {...props}
  />
))
AlertDescription.displayName = "AlertDescription"

export { Alert, AlertTitle, AlertDescription }