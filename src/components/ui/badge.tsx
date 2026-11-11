import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils";

const badgeVariants = cva(
  "inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs font-semibold transition-colors focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-2 select-none",
  {
    variants: {
      variant: {
        default:
          "bg-primary text-primary-foreground hover:bg-primary-hover",
        secondary:
          "bg-secondary text-secondary-foreground hover:bg-secondary-hover",
        accent:
          "bg-accent text-accent-foreground font-semibold hover:bg-accent-hover",
        outline:
          "border border-border text-text-primary bg-surface",
        subtle:
          "bg-primary/10 text-primary border border-primary/20",
        secondarySubtle:
          "bg-secondary/10 text-secondary border border-secondary/20",
        accentSubtle:
          "bg-amber-100 text-amber-900 border border-amber-300",
        muted:
          "bg-slate-100 text-text-secondary border border-slate-200",
        destructive:
          "bg-red-100 text-red-700 border border-red-200",
      },
      size: {
        default: "px-2.5 py-0.5 text-xs",
        sm: "px-2 py-0.2 text-[10px]",
        lg: "px-3 py-1 text-sm",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "default",
    },
  }
);

export interface BadgeProps
  extends React.HTMLAttributes<HTMLDivElement>,
    VariantProps<typeof badgeVariants> {
  dot?: boolean;
}

function Badge({ className, variant, size, dot, children, ...props }: BadgeProps) {
  return (
    <div className={cn(badgeVariants({ variant, size }), className)} {...props}>
      {dot && (
        <span
          className={cn(
            "h-1.5 w-1.5 rounded-full",
            variant === "default" && "bg-emerald-200",
            variant === "secondary" && "bg-teal-200",
            variant === "accent" && "bg-amber-900",
            variant === "subtle" && "bg-primary",
            variant === "secondarySubtle" && "bg-secondary",
            variant === "accentSubtle" && "bg-amber-600",
            variant === "destructive" && "bg-red-500",
            (!variant || variant === "outline" || variant === "muted") && "bg-text-secondary"
          )}
        />
      )}
      {children}
    </div>
  );
}

export { Badge, badgeVariants };
