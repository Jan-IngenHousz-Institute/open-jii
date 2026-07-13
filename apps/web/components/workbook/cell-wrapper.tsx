"use client";

import {
  CheckCircle2,
  ChevronDown,
  ChevronRight,
  Loader2,
  Play,
  Trash2,
  XCircle,
} from "lucide-react";
import type { ReactNode } from "react";
import { useEffect, useState } from "react";

import { Button } from "@repo/ui/components/button";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@repo/ui/components/collapsible";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@repo/ui/components/tooltip";
import { cn } from "@repo/ui/lib/utils";

type ExecutionStatus = "idle" | "running" | "completed" | "error";

function formatElapsed(ms: number): string {
  if (ms < 1000) return `${Math.round(ms / 100) * 100}ms`;
  if (ms < 10_000) return `${(ms / 1000).toFixed(1)}s`;
  return `${Math.round(ms / 1000)}s`;
}

/**
 * Live counter rendered next to the spinner while a cell is executing.
 * Resets to zero on each fresh "running" transition; unmounts when the cell
 * is no longer running so it doesn't tick when it shouldn't.
 */
function RunTimer() {
  const [elapsed, setElapsed] = useState(0);
  useEffect(() => {
    const start = Date.now();
    const id = setInterval(() => setElapsed(Date.now() - start), 100);
    return () => clearInterval(id);
  }, []);
  return (
    <span className="text-[11px] tabular-nums text-blue-500" data-testid="run-timer">
      {formatElapsed(elapsed)}
    </span>
  );
}

interface CellWrapperProps {
  icon: ReactNode;
  label: ReactNode;
  // Used as the Run button aria-label when `label` is not a string.
  labelText?: string;
  accentColor: string;
  isCollapsed?: boolean;
  onToggleCollapse?: (collapsed: boolean) => void;
  onDelete?: () => void;
  onRun?: () => void;
  headerBadges?: ReactNode;
  headerActions?: ReactNode;
  forceActionsVisible?: boolean;
  deleteIcon?: ReactNode;
  deleteLabel?: string;
  children: ReactNode;
  className?: string;
  executionStatus?: ExecutionStatus;
  executionError?: string;
  readOnly?: boolean;
}

export function CellWrapper({
  icon,
  label,
  labelText,
  accentColor,
  isCollapsed = false,
  onToggleCollapse,
  onDelete,
  onRun,
  headerBadges,
  headerActions,
  forceActionsVisible = false,
  deleteIcon,
  deleteLabel,
  children,
  className,
  executionStatus,
  executionError,
  readOnly = false,
}: CellWrapperProps) {
  const [localCollapsed, setLocalCollapsed] = useState(isCollapsed);
  // Non-creators cannot persist collapse state (the update is rejected by the
  // backend), so the expand/collapse control is hidden and the cell stays open.
  const collapsed = readOnly ? false : onToggleCollapse ? isCollapsed : localCollapsed;

  const handleToggle = () => {
    if (readOnly) return;
    if (onToggleCollapse) {
      onToggleCollapse(!collapsed);
    } else {
      setLocalCollapsed(!localCollapsed);
    }
  };

  return (
    <Collapsible open={!collapsed} onOpenChange={() => handleToggle()}>
      <div
        className={cn(
          "text-card-foreground group relative z-10 overflow-hidden rounded-[10px]",
          className,
        )}
        style={{
          background: "#FFFFFF",
          boxShadow:
            "inset 0px 2px 16px rgba(0, 94, 94, 0.08), 0px 4px 8px -2px rgba(0, 0, 0, 0.06)",
        }}
      >
        <div
          className="absolute left-0 top-0 h-full"
          style={{ width: 4, background: accentColor }}
        />

        <div
          className={`flex items-center gap-2 border-r border-t px-4 py-2 ${collapsed ? "rounded-lg border-b" : "rounded-t-lg"}`}
          style={{
            backgroundColor: `color-mix(in srgb, ${accentColor} 4%, transparent)`,
            borderColor: "#EDF2F6",
          }}
        >
          {!readOnly && (
            <CollapsibleTrigger asChild>
              <Button variant="ghost" size="sm" className="h-6 w-6 p-0">
                {collapsed ? (
                  <ChevronRight className="h-4 w-4" />
                ) : (
                  <ChevronDown className="h-4 w-4" />
                )}
              </Button>
            </CollapsibleTrigger>
          )}

          <div
            className="flex min-w-0 items-center gap-2 rounded px-1 py-0.5"
            style={{
              backgroundColor: `color-mix(in srgb, ${accentColor} 10%, transparent)`,
              border: `1px solid color-mix(in srgb, ${accentColor} 25%, transparent)`,
            }}
          >
            <span className="shrink-0" style={{ color: accentColor }}>
              {icon}
            </span>
            {label && (
              <span
                className="min-w-0 truncate font-bold"
                style={{ color: accentColor, fontSize: "15px" }}
                title={typeof label === "string" ? label : labelText}
              >
                {label}
              </span>
            )}
          </div>

          {headerBadges && <div className="flex shrink-0 items-center">{headerBadges}</div>}

          <div className="ml-auto flex shrink-0 items-center gap-1">
            <div
              className={
                forceActionsVisible
                  ? "flex items-center gap-1 opacity-100"
                  : "flex items-center gap-1 opacity-0 transition-opacity group-hover:opacity-100"
              }
            >
              {!readOnly && headerActions}

              {!readOnly && onDelete && (
                <TooltipProvider delayDuration={200}>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <Button
                        variant="ghost"
                        size="sm"
                        className="text-muted-foreground hover:text-destructive h-7 w-7 p-0"
                        onClick={onDelete}
                      >
                        {deleteIcon ?? <Trash2 className="h-3.5 w-3.5" />}
                      </Button>
                    </TooltipTrigger>
                    <TooltipContent>{deleteLabel ?? "Delete cell"}</TooltipContent>
                  </Tooltip>
                </TooltipProvider>
              )}
            </div>

            {executionStatus === "running" && (
              <div className="flex items-center gap-1.5">
                <Loader2 className="h-3.5 w-3.5 animate-spin text-blue-500" />
                <RunTimer />
              </div>
            )}
            {executionStatus === "completed" && (
              <div className="flex w-5 items-center justify-center">
                <CheckCircle2 className="h-3.5 w-3.5 text-emerald-500" />
              </div>
            )}
            {executionStatus === "error" && (
              <div className="flex w-5 items-center justify-center">
                <TooltipProvider delayDuration={200}>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <XCircle className="text-destructive h-3.5 w-3.5" />
                    </TooltipTrigger>
                    {executionError && (
                      <TooltipContent className="max-w-64 text-xs">{executionError}</TooltipContent>
                    )}
                  </Tooltip>
                </TooltipProvider>
              </div>
            )}

            {!readOnly && onRun && (
              <Button
                variant="ghost"
                size="sm"
                className="h-7 w-7 p-0"
                style={{ color: accentColor }}
                onClick={onRun}
                aria-label={`Run ${labelText ?? (typeof label === "string" ? label : "")}`}
              >
                <Play className="h-3.5 w-3.5" />
              </Button>
            )}
          </div>
        </div>

        <CollapsibleContent>
          <div className="px-4">
            <div className="h-px w-full rounded" style={{ backgroundColor: "#EDF2F6" }} />
          </div>
          <div
            className="rounded-b-lg border-b border-r px-4 py-2"
            style={{
              backgroundColor: `color-mix(in srgb, ${accentColor} 2.5%, transparent)`,
              borderColor: "#EDF2F6",
            }}
          >
            {children}
          </div>
        </CollapsibleContent>
      </div>
    </Collapsible>
  );
}
