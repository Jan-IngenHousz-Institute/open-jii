"use client";

import { Tabs as TabsPrimitive } from "radix-ui";
import * as React from "react";

import { cn } from "../lib/utils";

// Root
const NavTabs = TabsPrimitive.Root;

// List
const NavTabsList = React.forwardRef<
  React.ElementRef<typeof TabsPrimitive.List>,
  React.ComponentPropsWithoutRef<typeof TabsPrimitive.List>
>(({ className, ...props }, ref) => (
  <TabsPrimitive.List
    ref={ref}
    className={cn(
      "bg-surface scrollbar-thin inline-flex max-w-full gap-1 overflow-x-auto rounded-md p-1",
      className,
    )}
    {...props}
  />
));
NavTabsList.displayName = "NavTabsList";

// Trigger
const NavTabsTrigger = React.forwardRef<
  React.ElementRef<typeof TabsPrimitive.Trigger>,
  React.ComponentPropsWithoutRef<typeof TabsPrimitive.Trigger>
>(({ className, ...props }, ref) => (
  <TabsPrimitive.Trigger
    ref={ref}
    className={cn(
      // pill-style buttons
      "relative flex select-none items-center gap-2 rounded-sm px-4 py-2 text-sm font-medium transition-colors",

      // active — gradient top to bottom
      "data-[state=active]:bg-gradient-to-b",
      "data-[state=active]:from-sidebar-background",
      "data-[state=active]:to-jii-dark-green",
      "data-[state=active]:text-white",

      // inactive
      "data-[state=inactive]:text-muted-foreground data-[state=inactive]:hover:text-foreground",

      // disabled
      "disabled:pointer-events-none disabled:opacity-50",

      className,
    )}
    {...props}
  />
));
NavTabsTrigger.displayName = "NavTabsTrigger";

// Content
const NavTabsContent = React.forwardRef<
  React.ElementRef<typeof TabsPrimitive.Content>,
  React.ComponentPropsWithoutRef<typeof TabsPrimitive.Content>
>(({ className, ...props }, ref) => (
  <TabsPrimitive.Content ref={ref} className={cn("mt-3", className)} {...props} />
));
NavTabsContent.displayName = "NavTabsContent";

export { NavTabs, NavTabsList, NavTabsTrigger, NavTabsContent };
