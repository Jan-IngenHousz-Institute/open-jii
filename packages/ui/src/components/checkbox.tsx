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
      [
        "peer h-4 w-4 shrink-0 rounded-sm border shadow",
        "border-muted-dark",
        "focus-visible:ring-ring focus-visible:outline-none focus-visible:ring-1",
        "disabled:cursor-not-allowed disabled:opacity-50",
        "data-[state=checked]:bg-checkbox",
        "data-[state=checked]:border-checkbox",
        "data-[state=checked]:text-checkbox-foreground",
      ].join(" "),
      className,
    )}
    {...props}
  >
    <CheckboxPrimitive.Indicator className={cn("flex items-center justify-center text-current")}>
      <CheckIcon className="h-4 w-4" />
    </CheckboxPrimitive.Indicator>
  </CheckboxPrimitive.Root>
));
Checkbox.displayName = CheckboxPrimitive.Root.displayName;

export { Checkbox };
