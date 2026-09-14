"use client";

import { StatusBadge } from "@/components/shared/status-badge";
import type { StatusTone } from "@/components/shared/status-badge";
import { Archive, CheckCircle2, Clock, KeyRound, XCircle } from "lucide-react";

import type { IotDeviceRung, IotDeviceStatus } from "@repo/api/domains/iot/iot.schema";
import { useTranslation } from "@repo/i18n";

const RUNG_CONFIG: Record<IotDeviceRung, { icon: typeof Clock; tone: StatusTone }> = {
  registered: { icon: Clock, tone: "stale" },
  provisioned: { icon: KeyRound, tone: "published" },
  onboarded: { icon: CheckCircle2, tone: "active" },
  revoked: { icon: XCircle, tone: "destructive" },
  retired: { icon: Archive, tone: "stale" },
};

/** The stored status resolved against the binding count: "active" reads as Provisioned or Onboarded. */
export function deviceRung(status: IotDeviceStatus, boundExperimentCount: number): IotDeviceRung {
  if (status === "active") {
    return boundExperimentCount > 0 ? "onboarded" : "provisioned";
  }
  return status;
}

interface IotDeviceStatusBadgeProps {
  status: IotDeviceStatus;
  boundExperimentCount: number;
}

export function IotDeviceStatusBadge({ status, boundExperimentCount }: IotDeviceStatusBadgeProps) {
  const { t } = useTranslation("iot");
  const rung = deviceRung(status, boundExperimentCount);
  const config = RUNG_CONFIG[rung];
  const Icon = config.icon;

  return (
    <StatusBadge tone={config.tone}>
      <Icon className="h-3 w-3" />
      {t(`iot.devices.status.${rung}`)}
    </StatusBadge>
  );
}
