"use client";

import { TabBodyHeader } from "@/components/iot-devices/tab-body-header";
import { useActiveDeviceCalibration } from "@/hooks/iot/useActiveDeviceCalibration/useActiveDeviceCalibration";
import { useDeviceCalibrationRuns } from "@/hooks/iot/useDeviceCalibrationRuns/useDeviceCalibrationRuns";
import { useIotDevice } from "@/hooks/iot/useIotDevice/useIotDevice";
import { useLocale } from "@/hooks/useLocale";
import { SlidersHorizontal } from "lucide-react";
import { useParams, useRouter } from "next/navigation";
import { useEffect, useState } from "react";

import { zCalibrationFamily } from "@repo/api/domains/iot/calibration/iot-calibration.schema";
import { useTranslation } from "@repo/i18n";
import { Button } from "@repo/ui/components/button";

import { ActiveCalibrationCard } from "./active-calibration-card";
import { CalibrationRunsList } from "./calibration-runs-list";
import { CalibrationWizard } from "./calibration-wizard";

export default function DeviceCalibrationContent() {
  const { t } = useTranslation("iot");
  const locale = useLocale();
  const params = useParams<{ deviceId: string }>();
  const deviceId = params.deviceId;
  const router = useRouter();

  const [isWizardOpen, setIsWizardOpen] = useState(false);

  const { data: device } = useIotDevice(deviceId);
  const family = zCalibrationFamily.safeParse(device?.deviceType);
  const calibrationFamily = family.success ? family.data : undefined;

  const active = useActiveDeviceCalibration(deviceId, { enabled: calibrationFamily !== undefined });
  const runs = useDeviceCalibrationRuns(deviceId, { enabled: calibrationFamily !== undefined });

  // A phone or an edge device has no coefficients to write; a direct visit leaves.
  const detailPath = `/${locale}/platform/devices/${deviceId}`;
  const hasNoSurface = device !== undefined && calibrationFamily === undefined;

  useEffect(() => {
    if (hasNoSurface) {
      router.replace(detailPath);
    }
  }, [hasNoSurface, detailPath, router]);

  if (device === undefined || calibrationFamily === undefined) {
    return null;
  }

  function renderWizard(family: NonNullable<typeof calibrationFamily>) {
    if (device === undefined) return null;
    return (
      <CalibrationWizard device={device} family={family} onClose={() => setIsWizardOpen(false)} />
    );
  }

  function renderOverview() {
    return (
      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_360px] xl:grid-cols-[minmax(0,1fr)_400px]">
        <div className="space-y-6">
          <CalibrationRunsList runs={runs.data} isLoading={runs.isLoading} isError={runs.isError} />
        </div>
        <div className="space-y-6 lg:sticky lg:top-20 lg:self-start">
          <ActiveCalibrationCard
            calibration={active.data}
            isLoading={active.isLoading}
            isError={active.isError}
          />
        </div>
      </div>
    );
  }

  const canStartWizard = !isWizardOpen && device.capabilities.canManage;

  return (
    <div>
      <TabBodyHeader
        title={t("iot.calibration.title")}
        description={t("iot.calibration.description")}
      />
      {canStartWizard && (
        <div className="mb-6 flex justify-end">
          <Button type="button" onClick={() => setIsWizardOpen(true)}>
            <SlidersHorizontal className="mr-2 size-4" aria-hidden />
            {t("iot.calibration.cta.calibrate")}
          </Button>
        </div>
      )}
      {isWizardOpen ? renderWizard(calibrationFamily) : renderOverview()}
    </div>
  );
}
