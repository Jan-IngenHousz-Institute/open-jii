"use client";

import { StatusBadge } from "@/components/shared/status-badge";
import type { StatusTone } from "@/components/shared/status-badge";

import type { CalibrationRunStatus } from "@repo/api/domains/iot/calibration/iot-calibration.schema";
import { useTranslation } from "@repo/i18n";

const RUN_STATUS_TONE: Record<CalibrationRunStatus, StatusTone> = {
  running: "stale",
  computed: "published",
  compute_failed: "destructive",
  error: "destructive",
  approved: "active",
  rejected: "archived",
};

export function CalibrationRunStatusBadge({ status }: { status: CalibrationRunStatus }) {
  const { t } = useTranslation("iot");

  return (
    <StatusBadge tone={RUN_STATUS_TONE[status]}>
      {t(`iot.calibration.status.${status}`)}
    </StatusBadge>
  );
}
