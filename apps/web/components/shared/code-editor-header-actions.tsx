"use client";

import { Check, Circle, Loader2, X } from "lucide-react";

import { Button } from "@repo/ui/components/button";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@repo/ui/components/tooltip";

interface CodeEditorHeaderActionsProps {
  syncStatus: "synced" | "unsynced" | "syncing";
  onClose: () => void;
}

export function CodeEditorHeaderActions({ syncStatus, onClose }: CodeEditorHeaderActionsProps) {
  return (
    <TooltipProvider delayDuration={200}>
      <div className="flex items-center gap-3">
        <Tooltip>
          <TooltipTrigger asChild>
            <span className="flex items-center">
              {syncStatus === "unsynced" && (
                <Circle className="h-4 w-4 fill-amber-500 text-amber-500" />
              )}
              {syncStatus === "syncing" && (
                <Loader2 className="h-4 w-4 animate-spin text-slate-400" />
              )}
              {syncStatus === "synced" && <Check className="h-4 w-4 text-green-600" />}
            </span>
          </TooltipTrigger>
          <TooltipContent side="bottom">
            {syncStatus === "unsynced" && "Unsaved changes"}
            {syncStatus === "syncing" && "Saving..."}
            {syncStatus === "synced" && "All changes saved"}
          </TooltipContent>
        </Tooltip>
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
