"use client";

import { Collapsible as CollapsiblePrimitive } from "radix-ui";
import * as React from "react";

import { cn } from "../lib/utils";

const Collapsible = CollapsiblePrimitive.Root;

const CollapsibleTrigger = CollapsiblePrimitive.CollapsibleTrigger;

const CollapsibleContent = React.forwardRef<
  React.ElementRef<typeof CollapsiblePrimitive.CollapsibleContent>,
  React.ComponentPropsWithoutRef<typeof CollapsiblePrimitive.CollapsibleContent>
>(({ className, ...props }, ref) => {
  // Withheld until after hydration. A section that starts open is already
  // `data-state="open"` on the first paint, so without this it plays its expand
  // on every page load.
  const [mounted, setMounted] = React.useState(false);
  React.useEffect(() => setMounted(true), []);

  return (
    <CollapsiblePrimitive.CollapsibleContent
      ref={ref}
      className={cn(
        "overflow-hidden",
        mounted &&
          "data-[state=closed]:animate-collapse-up data-[state=open]:animate-collapse-down",
        className,
      )}
      {...props}
    />
  );
});
CollapsibleContent.displayName = "CollapsibleContent";

export { Collapsible, CollapsibleTrigger, CollapsibleContent };
