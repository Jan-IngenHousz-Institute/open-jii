"use client";

import { ChevronDown } from "lucide-react";
import type { ComponentType, ReactNode } from "react";

import { Button } from "@repo/ui/components/button";
import { Popover, PopoverContent, PopoverTrigger } from "@repo/ui/components/popover";
import { cn } from "@repo/ui/lib/utils";

export interface StripPopoverControlProps {
  label: string;
  icon?: ComponentType<{ className?: string }>;
  summary?: string;
  side?: "top" | "bottom" | "left" | "right";
  align?: "start" | "center" | "end";
  contentClassName?: string;
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
  children,
}: StripPopoverControlProps) {
  return (
    <Popover>
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
