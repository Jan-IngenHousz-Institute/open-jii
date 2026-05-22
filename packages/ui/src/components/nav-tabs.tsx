"use client";

import { Tabs as TabsPrimitive } from "radix-ui";
import * as React from "react";

import { cn } from "../lib/utils";

const NavTabs = TabsPrimitive.Root;

const NavTabsList = React.forwardRef<
  React.ComponentRef<typeof TabsPrimitive.List>,
  React.ComponentPropsWithoutRef<typeof TabsPrimitive.List>
>(({ className, ...props }, ref) => (
  <TabsPrimitive.List
    ref={ref}
    className={cn(
      "border-border inline-flex max-w-full flex-nowrap items-end gap-6 self-start overflow-x-auto overflow-y-hidden border-b",
      className,
    )}
    {...props}
  />
));
NavTabsList.displayName = "NavTabsList";

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
      "focus-visible:ring-ring group relative inline-flex shrink-0 select-none items-center gap-2 whitespace-nowrap border-b-2 border-transparent px-1 pb-3 pt-2 text-sm font-medium outline-none transition-colors focus-visible:ring-2 focus-visible:ring-offset-2",
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
