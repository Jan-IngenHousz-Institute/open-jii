"use client";

import { CheckCircle2, Clock, XCircle } from "lucide-react";

import type { IotDeviceStatus } from "@repo/api/schemas/iot.schema";
import { useTranslation } from "@repo/i18n";

const STATUS_CONFIG: Record<IotDeviceStatus, { icon: typeof Clock; className: string }> = {
  pending: {
    icon: Clock,
    className:
      "bg-yellow-50 text-yellow-700 border-yellow-200 dark:bg-yellow-950/20 dark:text-yellow-400 dark:border-yellow-800",
  },
  active: {
    icon: CheckCircle2,
    className:
      "bg-green-50 text-green-700 border-green-200 dark:bg-green-950/20 dark:text-green-400 dark:border-green-800",
  },
  revoked: {
    icon: XCircle,
    className:
      "bg-red-50 text-red-700 border-red-200 dark:bg-red-950/20 dark:text-red-400 dark:border-red-800",
  },
};

export function IotDeviceStatusBadge({ status }: { status: IotDeviceStatus }) {
  const { t } = useTranslation("iot");
  const config = STATUS_CONFIG[status];
  const Icon = config.icon;

  return (
    <span
      className={`inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-xs font-medium ${config.className}`}
    >
      <Icon className="h-3 w-3" />
      {t(`iot.devices.status.${status}`)}
    </span>
  );
}
