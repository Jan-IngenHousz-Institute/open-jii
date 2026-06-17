"use client";

import type { LucideIcon } from "lucide-react";

import { Tooltip, TooltipContent, TooltipTrigger } from "@repo/ui/components/tooltip";
import { cn } from "@repo/ui/lib/utils";

interface ToolButtonProps {
  icon: LucideIcon;
  label: string;
  active?: boolean;
  disabled?: boolean;
  onClick: () => void;
  className?: string;
}

export function ToolButton({
  icon: Icon,
  label,
  active,
  disabled,
  onClick,
  className,
}: ToolButtonProps) {
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <button
          type="button"
          aria-label={label}
          aria-pressed={active}
          disabled={disabled}
          onClick={onClick}
          className={cn(
            "text-muted-foreground hover:text-foreground hover:bg-accent",
            "focus-visible:ring-primary/40 inline-flex size-9 items-center justify-center rounded-full",
            "focus-visible:outline-none focus-visible:ring-2",
            active &&
              "bg-primary text-primary-foreground hover:bg-primary hover:text-primary-foreground",
            disabled && "cursor-not-allowed opacity-40 hover:bg-transparent",
            className,
          )}
        >
          <Icon className="size-4" />
        </button>
      </TooltipTrigger>
      <TooltipContent side="top">{label}</TooltipContent>
    </Tooltip>
  );
}
