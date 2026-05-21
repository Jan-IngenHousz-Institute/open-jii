"use client";

import { Tabs as TabsPrimitive } from "radix-ui";
import * as React from "react";

import { cn } from "../lib/utils";

const NavTabs = TabsPrimitive.Root;

// List — shrinks to fit its tabs (the 1px bottom border only spans the actual
// tab row, not the full content area). `self-start` opts out of stretch-align
// inside flex-col parents. No `overflow-x-auto` because CSS coerces the other
// axis to auto, which clips the active trigger's `-mb-px` underline and turns
// the row into a 1-pixel vertical scroll trap.
const NavTabsList = React.forwardRef<
  React.ComponentRef<typeof TabsPrimitive.List>,
  React.ComponentPropsWithoutRef<typeof TabsPrimitive.List>
>(({ className, ...props }, ref) => (
  <TabsPrimitive.List
    ref={ref}
    className={cn(
      "border-border inline-flex max-w-full flex-wrap items-end gap-6 self-start border-b",
      className,
    )}
    {...props}
  />
));
NavTabsList.displayName = "NavTabsList";

// Trigger — underline style. `-mb-px` lifts the 2px active border so it sits on
// top of the list's 1px bottom border (single continuous line, no gap).
// `count` is optional: when provided the badge renders inside the button. When
// `asChild` is used (e.g. wrapping a Next.js Link) `count` should be omitted so
// children pass through unwrapped and asChild composition works correctly.
interface NavTabsTriggerProps extends React.ComponentPropsWithoutRef<typeof TabsPrimitive.Trigger> {
  count?: number;
}

const NavTabsTrigger = React.forwardRef<
  React.ComponentRef<typeof TabsPrimitive.Trigger>,
  NavTabsTriggerProps
>(({ className, children, count, ...props }, ref) => (
  <TabsPrimitive.Trigger
    ref={ref}
    className={cn(
      "focus-visible:ring-ring group relative -mb-px inline-flex shrink-0 select-none items-center gap-2 whitespace-nowrap border-b-2 border-transparent px-1 pb-3 pt-2 text-sm font-medium outline-none transition-colors focus-visible:ring-2 focus-visible:ring-offset-2",
      "data-[state=active]:border-primary data-[state=active]:text-primary",
      "data-[state=inactive]:text-muted-foreground data-[state=inactive]:hover:border-muted-foreground/40 data-[state=inactive]:hover:text-foreground",
      "disabled:pointer-events-none disabled:opacity-50",
      className,
    )}
    {...props}
  >
    {typeof count === "number" ? (
      <>
        <span>{children}</span>
        <span className="bg-muted text-muted-foreground group-data-[state=active]:bg-primary/20 group-data-[state=active]:text-primary inline-flex min-w-5 items-center justify-center rounded px-1.5 text-[11px] font-semibold tabular-nums">
          {count}
        </span>
      </>
    ) : (
      children
    )}
  </TabsPrimitive.Trigger>
));
NavTabsTrigger.displayName = "NavTabsTrigger";

const NavTabsContent = React.forwardRef<
  React.ComponentRef<typeof TabsPrimitive.Content>,
  React.ComponentPropsWithoutRef<typeof TabsPrimitive.Content>
>(({ className, ...props }, ref) => (
  <TabsPrimitive.Content ref={ref} className={cn("mt-3", className)} {...props} />
));
NavTabsContent.displayName = "NavTabsContent";

export { NavTabs, NavTabsList, NavTabsTrigger, NavTabsContent };
