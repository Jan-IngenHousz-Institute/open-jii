"use client";

import { cva } from "class-variance-authority";
import type { VariantProps } from "class-variance-authority";
import { Label as LabelPrimitive } from "radix-ui";
import * as React from "react";

import { cn } from "../lib/utils";

const labelVariants = cva(
  "flex select-none items-center gap-2 text-sm font-medium leading-none group-data-[disabled=true]:pointer-events-none group-data-[disabled=true]:opacity-50 peer-disabled:cursor-not-allowed peer-disabled:opacity-50",
);

const Label = React.forwardRef<
  React.ElementRef<typeof LabelPrimitive.Root>,
  React.ComponentPropsWithoutRef<typeof LabelPrimitive.Root> & VariantProps<typeof labelVariants>
>(({ className, ...props }, ref) => (
  <LabelPrimitive.Root ref={ref} className={cn(labelVariants(), className)} {...props} />
));
Label.displayName = LabelPrimitive.Root.displayName;

export { Label };
