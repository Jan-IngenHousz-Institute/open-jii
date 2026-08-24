import { cva } from "class-variance-authority";
import type { VariantProps } from "class-variance-authority";
import * as React from "react";

import { cn } from "../lib/utils";

/**
 * The one empty-state system. `size` is how much room the state occupies,
 * `variant` is what kind of nothing it reports.
 *
 * Rule the component cannot enforce but every caller owes: the body names the
 * action, or the place the action lives. An empty state that ends the journey
 * is a bug.
 */
const emptyStateVariants = cva("flex flex-col items-center text-center", {
  variants: {
    size: {
      page: "bg-card rounded-xl border py-12 px-6",
      panel: "bg-card rounded-lg border border-dashed p-8",
      inline: "rounded-lg border border-dashed p-4 flex-row items-start text-left gap-2",
    },
    variant: {
      default: "",
      error: "border-solid border-destructive/40",
    },
  },
  defaultVariants: { size: "panel", variant: "default" },
});

const wellVariants = cva("flex items-center justify-center rounded-full [&_svg]:shrink-0", {
  variants: {
    size: {
      page: "size-24 mb-4 [&_svg]:size-12",
      panel: "size-10 mb-3 [&_svg]:size-5",
      inline: "hidden",
    },
    variant: {
      default: "bg-muted text-muted-foreground",
      error: "bg-destructive/10 text-destructive",
    },
  },
  defaultVariants: { size: "panel", variant: "default" },
});

interface EmptyStateProps
  extends Omit<React.HTMLAttributes<HTMLDivElement>, "title">,
    VariantProps<typeof emptyStateVariants> {
  /** Glyph for the well. Hidden at `inline` size, where there is no room. */
  icon?: React.ReactNode;
  title?: React.ReactNode;
  /** What is absent and what to do about it. The only required content. */
  description: React.ReactNode;
  /** Primary affordance: a Button, or a link styled as one. */
  action?: React.ReactNode;
}

const EmptyState = React.forwardRef<HTMLDivElement, EmptyStateProps>(
  ({ className, size, variant, icon, title, description, action, ...props }, ref) => (
    <div ref={ref} className={cn(emptyStateVariants({ size, variant }), className)} {...props}>
      {icon !== undefined && <div className={cn(wellVariants({ size, variant }))}>{icon}</div>}

      <div className={cn(size === "inline" && "flex-1")}>
        {title !== undefined && (
          <p className={cn("font-medium", size === "page" ? "text-base" : "text-sm")}>{title}</p>
        )}
        <p
          className={cn(
            "text-sm",
            variant === "error" ? "text-destructive" : "text-muted-foreground",
            title !== undefined && "mt-1",
            size === "page" && "mx-auto max-w-md",
          )}
        >
          {description}
        </p>
      </div>

      {action !== undefined && (
        <div className={cn(size === "inline" ? "shrink-0" : "mt-4")}>{action}</div>
      )}
    </div>
  ),
);
EmptyState.displayName = "EmptyState";

export { EmptyState, emptyStateVariants };
