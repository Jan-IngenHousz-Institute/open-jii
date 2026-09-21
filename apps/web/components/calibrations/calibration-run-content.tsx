"use client";

import { CalibrationWizard } from "@/components/iot-devices/calibration/wizard/calibration-wizard";
import { PanelCard } from "@/components/iot-devices/monitoring/panel-card";
import { useCalibrationDefinition } from "@/hooks/iot/useCalibrationDefinition/useCalibrationDefinition";
import { useIotDevices } from "@/hooks/iot/useIotDevices/useIotDevices";
import { useLocale } from "@/hooks/useLocale";
import { getSensorFamilyLabel } from "@/util/sensor-family";
import { useParams, useRouter } from "next/navigation";
import { useState } from "react";

import { useTranslation } from "@repo/i18n";
import { EmptyState } from "@repo/ui/components/empty-state";
import { Skeleton } from "@repo/ui/components/skeleton";

import { CalibrationDevicePicker } from "./calibration-device-picker";

/**
 * Trying a procedure out on real hardware, from the page it is being written on.
 *
 * A procedure reads plausibly and still fails at the bench: a command the firmware does
 * not answer, a sweep that saturates, a fit whose bounds were guessed. The only way to
 * know is to run it, so the author does that here rather than by finding the device.
 */
export function CalibrationRunContent() {
  const { t } = useTranslation("iot");
  const locale = useLocale();
  const router = useRouter();
  const params = useParams<{ definitionId: string }>();
  const definitionId = params.definitionId;

  const { data: definition, isLoading, isError } = useCalibrationDefinition(definitionId);
  const devices = useIotDevices();
  const [deviceId, setDeviceId] = useState<string | null>(null);

  if (isLoading) {
    return <Skeleton className="h-96 w-full" />;
  }
  if (isError || definition === undefined) {
    return <EmptyState variant="error" description={t("iot.calibration.loadError")} />;
  }

  const family = definition.family;
  const candidates = devices.data?.filter((device) => device.deviceType === family);
  // The unit that answers the port has to be the device chosen here, which the wizard
  // can only check against what the platform has that device registered as.
  const device = candidates?.find((candidate) => candidate.id === deviceId);

  function leave() {
    router.push(`/${locale}/platform/calibrations/${definitionId}`);
  }

  if (device === undefined) {
    return (
      <PanelCard title={t("iot.calibration.trial.chooseDevice")}>
        <div className="space-y-3">
          <p className="text-muted-foreground text-sm">
            {t("iot.calibration.trial.chooseHint", { family: getSensorFamilyLabel(family) })}
          </p>
          <CalibrationDevicePicker
            devices={candidates}
            isLoading={devices.isLoading}
            isError={devices.isError}
            selectedId={deviceId}
            onSelect={setDeviceId}
          />
        </div>
      </PanelCard>
    );
  }

  return (
    <CalibrationWizard
      deviceId={device.id}
      family={family}
      serialNumber={device.serialNumber}
      presetDefinitionId={definitionId}
      onClose={leave}
    />
  );
}
