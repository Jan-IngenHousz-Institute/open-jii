"use client";

import { Tabs as TabsPrimitive } from "radix-ui";
import * as React from "react";

import { cn } from "../lib/utils";

// Root
const UnderlineTabs = TabsPrimitive.Root;

// List
const UnderlineTabsList = React.forwardRef<
  React.ElementRef<typeof TabsPrimitive.List>,
  React.ComponentPropsWithoutRef<typeof TabsPrimitive.List>
>(({ className, ...props }, ref) => (
  <TabsPrimitive.List
    ref={ref}
    className={cn(
      "border-border text-muted-foreground flex h-10 w-full items-center justify-start overflow-x-auto overflow-y-hidden border-b",
      className,
    )}
    {...props}
  />
));
UnderlineTabsList.displayName = "UnderlineTabsList";

// Trigger
interface UnderlineTabsTriggerProps
  extends React.ComponentPropsWithoutRef<typeof TabsPrimitive.Trigger> {
  count?: number;
}

const UnderlineTabsTrigger = React.forwardRef<
  React.ElementRef<typeof TabsPrimitive.Trigger>,
  UnderlineTabsTriggerProps
>(({ className, children, count, ...props }, ref) => (
  <TabsPrimitive.Trigger
    ref={ref}
    className={cn(
      "group relative -mb-px inline-flex h-10 select-none items-center gap-2 border-b-2 border-transparent px-3 text-sm font-medium transition-colors",

      // inactive
      "text-muted-foreground hover:text-foreground",

      // active — branded underline + text
      "data-[state=active]:text-jii-dark-green data-[state=active]:border-jii-dark-green",

      // disabled
      "disabled:pointer-events-none disabled:opacity-50",

      className,
    )}
    {...props}
  >
    <span>{children}</span>
    {typeof count === "number" && (
      <span className="bg-muted text-muted-foreground group-data-[state=active]:bg-jii-bright-green/25 group-data-[state=active]:text-jii-dark-green inline-flex min-w-5 items-center justify-center rounded px-1.5 text-[11px] font-semibold tabular-nums">
        {count}
      </span>
    )}
  </TabsPrimitive.Trigger>
));
UnderlineTabsTrigger.displayName = "UnderlineTabsTrigger";

// Content
const UnderlineTabsContent = React.forwardRef<
  React.ElementRef<typeof TabsPrimitive.Content>,
  React.ComponentPropsWithoutRef<typeof TabsPrimitive.Content>
>(({ className, ...props }, ref) => (
  <TabsPrimitive.Content ref={ref} className={cn("mt-4", className)} {...props} />
));
UnderlineTabsContent.displayName = "UnderlineTabsContent";

export { UnderlineTabs, UnderlineTabsList, UnderlineTabsTrigger, UnderlineTabsContent };
