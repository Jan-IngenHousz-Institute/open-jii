"use client";

import { CheckIcon } from "@radix-ui/react-icons";
import { Checkbox as CheckboxPrimitive } from "radix-ui";
import * as React from "react";

import { cn } from "../lib/utils";

const Checkbox = React.forwardRef<
  React.ElementRef<typeof CheckboxPrimitive.Root>,
  React.ComponentPropsWithoutRef<typeof CheckboxPrimitive.Root>
>(({ className, ...props }, ref) => (
  <CheckboxPrimitive.Root
    ref={ref}
    className={cn(
      "group/checkbox border-input shadow-xs focus-visible:border-ring focus-visible:ring-ring/50 aria-invalid:border-destructive aria-invalid:ring-destructive/20 data-[state=checked]:border-primary data-[state=checked]:bg-primary data-[state=checked]:text-primary-foreground dark:bg-input/30 dark:aria-invalid:ring-destructive/40 dark:data-[state=checked]:bg-primary peer inline-grid size-4 shrink-0 place-content-center rounded-[4px] border outline-none transition-shadow focus-visible:ring-[3px] disabled:cursor-not-allowed disabled:opacity-50",
      className,
    )}
    {...props}
  >
    {/* Shown by the root's state rather than through Radix's Indicator, whose presence check
        reads each indicator's computed style as it mounts: a forced style recalc per row in a
        table of checkboxes. */}
    <CheckIcon className="pointer-events-none hidden size-3.5 group-data-[state=checked]/checkbox:block group-data-[state=indeterminate]/checkbox:block" />
  </CheckboxPrimitive.Root>
));
Checkbox.displayName = CheckboxPrimitive.Root.displayName;

export { Checkbox };
