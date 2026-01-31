"use client";

import React from "react";

import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@repo/ui/components";

interface ExperimentDataTableTextCellProps {
  text: string;
  maxLength?: number;
}

const DEFAULT_MAX_LENGTH = 150;

function truncateText(text: string, maxLength: number): string {
  if (text.length <= maxLength) return text;
  return text.substring(0, maxLength) + "...";
}

export function ExperimentDataTableTextCell({
  text,
  maxLength = DEFAULT_MAX_LENGTH,
}: ExperimentDataTableTextCellProps) {
  // Handle null/undefined values
  if (!text || text === "") {
    return <span className="text-muted-foreground">—</span>;
  }

  if (text.length <= maxLength) {
    return <span>{text}</span>;
  }

  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild>
          <span className="cursor-help">{truncateText(text, maxLength)}</span>
        </TooltipTrigger>
        <TooltipContent className="max-w-md break-words">
          <p className="whitespace-pre-wrap">{text}</p>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}
