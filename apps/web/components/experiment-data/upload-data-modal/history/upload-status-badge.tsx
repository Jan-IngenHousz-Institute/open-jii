"use client";

import { StatusBadge } from "@/components/shared/status-badge";
import type { StatusTone } from "@/components/shared/status-badge";
import { CheckCircle2, Clock, Loader2, XCircle } from "lucide-react";

import type { ExperimentUploadHistoryStatus } from "@repo/api/domains/experiment/experiment.schema";
import { useTranslation } from "@repo/i18n/client";

export interface UploadStatusBadgeProps {
  status: ExperimentUploadHistoryStatus;
}

export function UploadStatusBadge({ status }: UploadStatusBadgeProps) {
  const { t } = useTranslation("experimentData");

  const config = STATUS_CONFIG[status];
  const Icon = config.icon;

  return (
    <StatusBadge tone={config.tone}>
      <Icon className={`h-3 w-3 ${config.spin ? "animate-spin" : ""}`} />
      {t(config.labelKey)}
    </StatusBadge>
  );
}

const STATUS_CONFIG: Record<
  ExperimentUploadHistoryStatus,
  { icon: typeof Clock; tone: StatusTone; labelKey: string; spin: boolean }
> = {
  pending: {
    icon: Clock,
    tone: "stale",
    labelKey: "experimentData.uploadDataModal.history.status.pending",
    spin: false,
  },
  running: {
    icon: Loader2,
    tone: "published",
    labelKey: "experimentData.uploadDataModal.history.status.running",
    spin: true,
  },
  completed: {
    icon: CheckCircle2,
    tone: "active",
    labelKey: "experimentData.uploadDataModal.history.status.completed",
    spin: false,
  },
  failed: {
    icon: XCircle,
    tone: "destructive",
    labelKey: "experimentData.uploadDataModal.history.status.failed",
    spin: false,
  },
};
