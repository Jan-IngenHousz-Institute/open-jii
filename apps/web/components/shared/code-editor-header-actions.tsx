"use client";

import { AutosaveIndicator } from "@/components/shared/autosave/autosave-indicator";
import type { AutosaveStatus } from "@/hooks/useAutosave";
import { X } from "lucide-react";

import { Button } from "@repo/ui/components/button";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@repo/ui/components/tooltip";

interface CodeEditorHeaderActionsProps {
  status: AutosaveStatus;
  onClose: () => void;
}

/**
 * Inline editor toolbar: autosave status pill + close-editor button.
 * The status icon and label come from the shared `AutosaveIndicator` so
 * editor-pane and layout-level indicators stay visually in sync.
 */
export function CodeEditorHeaderActions({ status, onClose }: CodeEditorHeaderActionsProps) {
  return (
    <TooltipProvider delayDuration={200}>
      <div className="flex items-center gap-3">
        <AutosaveIndicator status={status} variant="compact" />
        <span className="h-4 w-px bg-slate-300" />
        <Tooltip>
          <TooltipTrigger asChild>
            <Button variant="ghost" size="sm" onClick={onClose} className="h-7 w-7 p-0">
              <X className="h-4 w-4" />
            </Button>
          </TooltipTrigger>
          <TooltipContent side="bottom">Close editor</TooltipContent>
        </Tooltip>
      </div>
    </TooltipProvider>
  );
}
