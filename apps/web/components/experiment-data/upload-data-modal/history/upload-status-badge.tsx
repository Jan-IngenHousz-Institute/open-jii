"use client";

import { CheckCircle2, Clock, Loader2, XCircle } from "lucide-react";

import type { UploadHistoryStatus } from "@repo/api/schemas/experiment.schema";
import { useTranslation } from "@repo/i18n/client";

export interface UploadStatusBadgeProps {
  status: UploadHistoryStatus;
}

export function UploadStatusBadge({ status }: UploadStatusBadgeProps) {
  const { t } = useTranslation("experimentData");

  const config = STATUS_CONFIG[status];
  const Icon = config.icon;

  return (
    <span
      className={`inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-xs font-medium ${config.className}`}
    >
      <Icon className={`h-3 w-3 ${config.spin ? "animate-spin" : ""}`} />
      {t(config.labelKey)}
    </span>
  );
}

const STATUS_CONFIG: Record<
  UploadHistoryStatus,
  { icon: typeof Clock; className: string; labelKey: string; spin: boolean }
> = {
  pending: {
    icon: Clock,
    className:
      "bg-yellow-50 text-yellow-700 border-yellow-200 dark:bg-yellow-950/20 dark:text-yellow-400 dark:border-yellow-800",
    labelKey: "experimentData.uploadDataModal.history.status.pending",
    spin: false,
  },
  running: {
    icon: Loader2,
    className:
      "bg-blue-50 text-blue-700 border-blue-200 dark:bg-blue-950/20 dark:text-blue-400 dark:border-blue-800",
    labelKey: "experimentData.uploadDataModal.history.status.running",
    spin: true,
  },
  completed: {
    icon: CheckCircle2,
    className:
      "bg-green-50 text-green-700 border-green-200 dark:bg-green-950/20 dark:text-green-400 dark:border-green-800",
    labelKey: "experimentData.uploadDataModal.history.status.completed",
    spin: false,
  },
  failed: {
    icon: XCircle,
    className:
      "bg-red-50 text-red-700 border-red-200 dark:bg-red-950/20 dark:text-red-400 dark:border-red-800",
    labelKey: "experimentData.uploadDataModal.history.status.failed",
    spin: false,
  },
};

export const UPLOAD_STATUS_BORDER_COLOR: Record<UploadHistoryStatus, string> = {
  pending: "border-l-yellow-400",
  running: "border-l-blue-400",
  completed: "border-l-green-500",
  failed: "border-l-red-500",
};
