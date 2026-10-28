"use client";

import { StatusBadge } from "@/components/shared/status-badge";
import type { StatusTone } from "@/components/shared/status-badge";
import { CheckCircle2, Clock, Loader2, TimerOff, XCircle } from "lucide-react";
import type { LucideIcon } from "lucide-react";

import type { ExperimentExportStatus } from "@repo/api/domains/experiment/exports/experiment-exports.schema";
import { useTranslation } from "@repo/i18n/client";

const STATUS_STYLES: Record<ExperimentExportStatus, { icon: LucideIcon; tone: StatusTone }> = {
  queued: { icon: Clock, tone: "archived" },
  pending: { icon: Clock, tone: "stale" },
  running: { icon: Loader2, tone: "published" },
  completed: { icon: CheckCircle2, tone: "active" },
  failed: { icon: XCircle, tone: "destructive" },
  expired: { icon: TimerOff, tone: "archived" },
};

export function ExportStatusBadge({ status }: { status: ExperimentExportStatus }) {
  const { t } = useTranslation("experimentData");
  const { icon: Icon, tone } = STATUS_STYLES[status];
  const isRunning = status === "running";

  return (
    <StatusBadge tone={tone}>
      <Icon className={`h-3 w-3 ${isRunning ? "animate-spin" : ""}`} />
      {t(`experimentData.exportModal.status.${status}`)}
    </StatusBadge>
  );
}
