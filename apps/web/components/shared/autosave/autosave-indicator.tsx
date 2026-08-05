"use client";

import type { AutosaveStatus } from "@/hooks/useAutosave";
import { AlertCircle, CheckCircle2, Loader2 } from "lucide-react";

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
  status?: AutosaveStatus;
  /** `compact` swaps the label for a tooltip — sized for editor toolbars. */
  variant?: AutosaveIndicatorVariant;
  className?: string;
  onRetry?: () => void | Promise<void>;
}

export function AutosaveIndicator({
  status: statusProp,
  variant = "full",
  className,
  onRetry,
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
    if (status === "dirty" || status === "saving") {
      return {
        icon: <Loader2 className="size-4 animate-spin text-[#68737B]" />,
        label: t("autosave.saving", "Saving…"),
        labelClassName: "text-[#011111]",
      };
    }
    return {
      icon: <CheckCircle2 className="size-4 text-[#09B732]" />,
      label: t("autosave.saved", "All changes saved"),
      labelClassName: "text-[#68737B]",
    };
  })();

  if (variant === "compact") {
    const trigger =
      status === "error" && onRetry ? (
        <button
          type="button"
          className={cn("flex items-center", className)}
          aria-label={`${view.label}. ${t("tryAgain", "Try again")}`}
          onClick={() => void onRetry()}
        >
          {view.icon}
        </button>
      ) : (
        <span className={cn("flex items-center", className)} aria-label={view.label} role="status">
          {view.icon}
        </span>
      );
    return (
      <TooltipProvider delayDuration={200}>
        <Tooltip>
          <TooltipTrigger asChild>{trigger}</TooltipTrigger>
          <TooltipContent side="bottom">{view.label}</TooltipContent>
        </Tooltip>
      </TooltipProvider>
    );
  }

  return (
    <div className={cn("flex items-center gap-2 text-[15px]", className)}>
      {view.icon}
      <span className={view.labelClassName}>{view.label}</span>
      {status === "error" && onRetry ? (
        <button
          type="button"
          className="text-primary text-sm font-medium underline underline-offset-2"
          onClick={() => void onRetry()}
        >
          {t("tryAgain", "Try again")}
        </button>
      ) : null}
    </div>
  );
}
