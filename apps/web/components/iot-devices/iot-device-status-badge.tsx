"use client";

import { StatusBadge } from "@/components/shared/status-badge";
import type { StatusTone } from "@/components/shared/status-badge";
import { Archive, CheckCircle2, Clock, KeyRound, XCircle } from "lucide-react";

import type { IotDevice, IotDeviceRung } from "@repo/api/domains/iot/iot.schema";
import { useTranslation } from "@repo/i18n";

import { deviceRung } from "./device-rung";

const RUNG_CONFIG: Record<IotDeviceRung, { icon: typeof Clock; tone: StatusTone }> = {
  registered: { icon: Clock, tone: "stale" },
  provisioned: { icon: KeyRound, tone: "published" },
  onboarded: { icon: CheckCircle2, tone: "active" },
  revoked: { icon: XCircle, tone: "destructive" },
  retired: { icon: Archive, tone: "stale" },
};

interface IotDeviceStatusBadgeProps {
  status: IotDevice["status"];
  deviceType: IotDevice["deviceType"];
  boundExperimentCount: number;
}

/**
 * A phone has no certificate and picks its experiment in the app, so it has no
 * ladder to climb: it shows nothing here unless it was retired.
 */
export function IotDeviceStatusBadge({
  status,
  deviceType,
  boundExperimentCount,
}: IotDeviceStatusBadgeProps) {
  const { t } = useTranslation("iot");

  if (deviceType === "mobile" && status !== "retired") {
    return null;
  }

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
