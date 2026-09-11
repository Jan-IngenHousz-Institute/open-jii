import * as React from "react";

import { cn, cva } from "../lib/utils";

/**
 * `Card` owns the vertical rhythm: `py-6` around the stack and `gap-6` between
 * its children, with `CardHeader`/`CardContent`/`CardFooter` contributing only
 * `px-6`. Padding written on a child therefore adds to the parent's rather than
 * replacing it, which `cn` cannot dedupe across two elements.
 *
 * `padding` exists so the two cases that need something else say so by name:
 * `none` for a card whose children reach the edge (a full-bleed footer bar, a
 * `divide-y` list, a table, a tab strip) and `sm` for a dense one. Before it,
 * those were spelled `gap-0 py-0` and `@container/card gap-2 py-3` at thirty-odd
 * call sites, in six different dialects.
 */
const cardVariants = cva("bg-card text-card-foreground flex flex-col rounded-xl border shadow-sm", {
  variants: {
    padding: {
      none: "gap-0 py-0",
      sm: "gap-2 py-3",
      md: "gap-6 py-6",
    },
    interactive: {
      true: "transition-all hover:scale-[1.02] hover:shadow-lg",
      false: "",
    },
  },
  defaultVariants: { padding: "md", interactive: false },
});

export interface CardProps extends React.HTMLAttributes<HTMLDivElement> {
  interactive?: boolean;
  padding?: "none" | "sm" | "md";
}

const Card = React.forwardRef<HTMLDivElement, CardProps>(
  ({ className, interactive = false, padding = "md", ...props }, ref) => (
    <div ref={ref} className={cn(cardVariants({ padding, interactive }), className)} {...props} />
  ),
);
Card.displayName = "Card";

const CardHeader = React.forwardRef<HTMLDivElement, React.HTMLAttributes<HTMLDivElement>>(
  ({ className, ...props }, ref) => (
    <div
      ref={ref}
      className={cn(
        "@container/card-header has-data-[slot=card-action]:grid-cols-[1fr_auto] [.border-b]:pb-6 grid auto-rows-min grid-rows-[auto_auto] items-start gap-2 px-6",
        className,
      )}
      {...props}
    />
  ),
);
CardHeader.displayName = "CardHeader";

const CardTitle = React.forwardRef<HTMLDivElement, React.HTMLAttributes<HTMLDivElement>>(
  ({ className, ...props }, ref) => (
    <div ref={ref} className={cn("font-semibold leading-none", className)} {...props} />
  ),
);
CardTitle.displayName = "CardTitle";

const CardDescription = React.forwardRef<HTMLDivElement, React.HTMLAttributes<HTMLDivElement>>(
  ({ className, ...props }, ref) => (
    <div ref={ref} className={cn("text-muted-foreground text-sm", className)} {...props} />
  ),
);
CardDescription.displayName = "CardDescription";

/**
 * Trailing control in a `CardHeader` — a button, a toggle, a menu trigger.
 * `CardHeader` looks for its `data-slot` to grow a second column, so a header
 * action belongs here rather than in a hand-rolled flex row.
 */
const CardAction = React.forwardRef<HTMLDivElement, React.HTMLAttributes<HTMLDivElement>>(
  ({ className, ...props }, ref) => (
    <div
      ref={ref}
      data-slot="card-action"
      className={cn("col-start-2 row-span-2 row-start-1 self-start justify-self-end", className)}
      {...props}
    />
  ),
);
CardAction.displayName = "CardAction";

const CardContent = React.forwardRef<HTMLDivElement, React.HTMLAttributes<HTMLDivElement>>(
  ({ className, ...props }, ref) => <div ref={ref} className={cn("px-6", className)} {...props} />,
);
CardContent.displayName = "CardContent";

const CardFooter = React.forwardRef<HTMLDivElement, React.HTMLAttributes<HTMLDivElement>>(
  ({ className, ...props }, ref) => (
    <div
      ref={ref}
      className={cn("[.border-t]:pt-6 flex items-center px-6", className)}
      {...props}
    />
  ),
);
CardFooter.displayName = "CardFooter";

export { Card, CardHeader, CardFooter, CardTitle, CardAction, CardDescription, CardContent };
