"use client";

import { ChevronDown } from "lucide-react";
import type { ComponentType, ReactNode } from "react";

import { Button } from "@repo/ui/components/button";
import { Popover, PopoverContent, PopoverTrigger } from "@repo/ui/components/popover";
import { cn } from "@repo/ui/lib/utils";

import { useIsStripShadow } from "./strip-shadow-context";

export interface StripPopoverControlProps {
  label: string;
  icon?: ComponentType<{ className?: string }>;
  summary?: string;
  side?: "top" | "bottom" | "left" | "right";
  align?: "start" | "center" | "end";
  contentClassName?: string;
  /** Controlled open state. Safe to use because the shadow row short-circuits to a bare trigger. */
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
  children: ReactNode;
}

/** Shared trigger + popover shape used by every inspector strip. */
export function StripPopoverControl({
  label,
  icon: Icon,
  summary,
  side = "top",
  align = "start",
  contentClassName,
  open,
  onOpenChange,
  children,
}: StripPopoverControlProps) {
  const isShadow = useIsStripShadow();

  // The shadow row only needs the trigger's width. Skip the full Popover so
  // controlled `open` / `defaultOpen` don't trigger duplicate content portals
  // that would compete with the live row for focus / click-outside. No
  // aria-label here so test queries (and assistive tech) don't see two
  // buttons with the same accessible name.
  if (isShadow) {
    return (
      <Button
        variant="ghost"
        size="sm"
        aria-hidden="true"
        tabIndex={-1}
        className="text-foreground hover:text-foreground hover:bg-accent h-8 gap-1.5 rounded-full px-2.5 text-xs"
      >
        {Icon && <Icon className="text-muted-foreground size-3.5" />}
        <span className="hidden font-medium md:inline">{label}</span>
        {summary && (
          <span className="text-muted-foreground hidden max-w-[10rem] truncate font-normal md:inline">
            {summary}
          </span>
        )}
        <ChevronDown className="text-muted-foreground size-3" />
      </Button>
    );
  }

  return (
    <Popover open={open} onOpenChange={onOpenChange}>
      <PopoverTrigger asChild>
        <Button
          variant="ghost"
          size="sm"
          aria-label={label}
          className="text-foreground hover:text-foreground hover:bg-accent h-8 gap-1.5 rounded-full px-2.5 text-xs"
        >
          {Icon && <Icon className="text-muted-foreground size-3.5" />}
          <span className="hidden font-medium md:inline">{label}</span>
          {summary && (
            <span className="text-muted-foreground hidden max-w-[10rem] truncate font-normal md:inline">
              {summary}
            </span>
          )}
          <ChevronDown className="text-muted-foreground size-3" />
        </Button>
      </PopoverTrigger>
      <PopoverContent
        side={side}
        align={align}
        className={cn("scrollbar-thin max-h-[70vh] w-72 overflow-y-auto p-3", contentClassName)}
      >
        {children}
      </PopoverContent>
    </Popover>
  );
}
