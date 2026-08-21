"use client";

import { FoldVertical, UnfoldVertical } from "lucide-react";
import type { FC } from "react";
import type { JsonFormatStyle } from "~/lib/json-format";

import { Button } from "@repo/ui/components/button";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@repo/ui/components/tooltip";

interface JsonFormatToggleProps {
  style: JsonFormatStyle;
  onToggle: () => void;
  disabled?: boolean;
  disabledLabel?: string;
}

export const JsonFormatToggle: FC<JsonFormatToggleProps> = ({
  style,
  onToggle,
  disabled = false,
  disabledLabel,
}) => {
  const isCompact = style === "compact";
  const label = disabled
    ? (disabledLabel ?? "Cannot reformat")
    : isCompact
      ? "Expand: one value per line"
      : "Compact: keep short arrays on one line";

  return (
    <TooltipProvider delayDuration={200}>
      <Tooltip>
        <TooltipTrigger asChild>
          <span>
            <Button
              variant="ghost"
              size="sm"
              aria-label={label}
              data-testid="json-format-toggle"
              disabled={disabled}
              onClick={(e) => {
                e.stopPropagation();
                onToggle();
              }}
              className="h-7 w-7 p-0"
            >
              {isCompact ? (
                <UnfoldVertical className="h-3 w-3" />
              ) : (
                <FoldVertical className="h-3 w-3" />
              )}
            </Button>
          </span>
        </TooltipTrigger>
        <TooltipContent side="bottom">{label}</TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
};
