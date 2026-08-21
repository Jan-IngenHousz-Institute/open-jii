"use client";

import { StatusBadge } from "@/components/shared/status-badge";
import type { StatusTone } from "@/components/shared/status-badge";
import { CheckCircle2, Clock, RefreshCw, XCircle } from "lucide-react";

import type { IotDeviceStatus } from "@repo/api/domains/iot/iot.schema";
import { useTranslation } from "@repo/i18n";

const STATUS_CONFIG: Record<IotDeviceStatus, { icon: typeof Clock; tone: StatusTone }> = {
  pending: { icon: Clock, tone: "stale" },
  active: { icon: CheckCircle2, tone: "active" },
  rotating: { icon: RefreshCw, tone: "published" },
  revoked: { icon: XCircle, tone: "destructive" },
};

export function IotDeviceStatusBadge({ status }: { status: IotDeviceStatus }) {
  const { t } = useTranslation("iot");
  const config = STATUS_CONFIG[status];
  const Icon = config.icon;

  return (
    <StatusBadge tone={config.tone}>
      <Icon className="h-3 w-3" />
      {t(`iot.devices.status.${status}`)}
    </StatusBadge>
  );
}
