"use client";

import type { AutosaveStatus } from "@/hooks/useAutosave";
import { AlertCircle, CheckCircle2, Circle, Loader2 } from "lucide-react";

import { useTranslation } from "@repo/i18n";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@repo/ui/components/tooltip";
import { cn } from "@repo/ui/lib/utils";

import { useAutosaveStatus } from "./autosave-status-context";

type AutosaveIndicatorVariant = "full" | "compact";

interface AutosaveIndicatorProps {
  /**
   * Override the status read from context. Useful when the indicator is
   * co-located with the autosave hook (no provider in between).
   */
  status?: AutosaveStatus;
  /**
   * - `full` (default): icon + label, sized for a layout-level slot.
   * - `compact`: icon-only with the label moved into a tooltip, sized for
   *    inline use inside an editor toolbar.
   */
  variant?: AutosaveIndicatorVariant;
  className?: string;
}

/**
 * Visual treatment for autosave state. Reads from `AutosaveStatusContext`
 * by default; pass `status` directly to bypass the context. Renders
 * nothing when there's no status to show.
 *
 * Each state has its own glyph + colour so users can tell "your edit is
 * pending" (`dirty`) from "your edit is being sent" (`saving`) — those
 * blur into ~1.5s in practice but the visual distinction is honest.
 */
export function AutosaveIndicator({
  status: statusProp,
  variant = "full",
  className,
}: AutosaveIndicatorProps) {
  const fromContext = useAutosaveStatus();
  const status = statusProp ?? fromContext?.status ?? undefined;
  const { t } = useTranslation("common");

  if (!status) return null;

  const view = (() => {
    if (status === "error") {
      return {
        icon: <AlertCircle className="text-destructive size-4" />,
        label: t("autosave.failed", "Couldn't save your changes"),
        labelClassName: "text-destructive",
      };
    }
    if (status === "dirty") {
      return {
        icon: <Circle className="size-4 fill-amber-500 text-amber-500" />,
        label: t("autosave.dirty", "Unsaved changes"),
        labelClassName: "text-[#011111]",
      };
    }
    if (status === "saving") {
      return {
        icon: <Loader2 className="size-4 animate-spin text-[#68737B]" />,
        label: t("autosave.saving", "Saving…"),
        labelClassName: "text-[#011111]",
      };
    }
    return {
      icon: <CheckCircle2 className="size-4 text-emerald-500" />,
      label: t("autosave.saved", "All changes saved"),
      labelClassName: "text-[#68737B]",
    };
  })();

  if (variant === "compact") {
    return (
      <TooltipProvider delayDuration={200}>
        <Tooltip>
          <TooltipTrigger asChild>
            <span
              className={cn("flex items-center", className)}
              aria-label={view.label}
              role="status"
            >
              {view.icon}
            </span>
          </TooltipTrigger>
          <TooltipContent side="bottom">{view.label}</TooltipContent>
        </Tooltip>
      </TooltipProvider>
    );
  }

  return (
    <div className={cn("flex items-center gap-2 text-[15px]", className)}>
      {view.icon}
      <span className={view.labelClassName}>{view.label}</span>
    </div>
  );
}
