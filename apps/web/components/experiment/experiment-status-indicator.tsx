"use client";

import type { ExperimentStatus } from "@repo/api/domains/experiment/experiment.schema";
import { useTranslation } from "@repo/i18n";
import { cn } from "@repo/ui/lib/utils";

const STATUS_DOT: Record<ExperimentStatus, string> = {
  active: "bg-status-active-foreground",
  published: "bg-status-published-foreground",
  stale: "bg-status-stale-foreground",
  archived: "bg-status-archived-foreground",
};

interface ExperimentStatusIndicatorProps {
  status: ExperimentStatus;
  className?: string;
}

/** Shared by the overview table and the listing cards, so the dots cannot drift apart. */
export function ExperimentStatusIndicator({ status, className }: ExperimentStatusIndicatorProps) {
  const { t } = useTranslation("experiments");
  const label = t(`status.${status}`);

  return (
    <span title={label} className={cn("inline-flex min-w-0 items-center gap-1.5", className)}>
      <span className={cn("size-1.5 shrink-0 rounded-full", STATUS_DOT[status])} aria-hidden />
      <span className="truncate">{label}</span>
    </span>
  );
}
