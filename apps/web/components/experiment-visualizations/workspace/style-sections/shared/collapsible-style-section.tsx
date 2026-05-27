"use client";

import { ChevronDown } from "lucide-react";
import { useState } from "react";
import type { ReactNode } from "react";

import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@repo/ui/components/collapsible";
import { cn } from "@repo/ui/lib/utils";

interface CollapsibleStyleSectionProps {
  title: string;
  defaultOpen?: boolean;
  /** Render inline with no Collapsible chrome (for popover-hosted sections). */
  flat?: boolean;
  children: ReactNode;
}

/**
 * Collapsible wrapper used by every chart-level style section so the
 * Style tab can fold sections users aren't currently editing.
 */
export function CollapsibleStyleSection({
  title,
  defaultOpen = false,
  flat = false,
  children,
}: CollapsibleStyleSectionProps) {
  const [open, setOpen] = useState(defaultOpen);

  if (flat) {
    return <div className="space-y-5">{children}</div>;
  }

  return (
    <Collapsible
      open={open}
      onOpenChange={setOpen}
      className="space-y-3"
      data-state={open ? "open" : "closed"}
    >
      <CollapsibleTrigger className="group/trigger flex w-full items-center gap-2 text-left">
        <h3 className="text-sm font-semibold">{title}</h3>
        <ChevronDown
          className={cn(
            "text-muted-foreground ml-auto h-4 w-4 transition-transform",
            open ? "rotate-0" : "-rotate-90",
          )}
        />
      </CollapsibleTrigger>
      <CollapsibleContent className="space-y-5">{children}</CollapsibleContent>
    </Collapsible>
  );
}
