"use client";

import { TabBodyHeader } from "@/components/iot-devices/tab-body-header";
import { useActiveDeviceCalibration } from "@/hooks/iot/useActiveDeviceCalibration/useActiveDeviceCalibration";
import { useCalibrationDefinitions } from "@/hooks/iot/useCalibrationDefinitions/useCalibrationDefinitions";
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
import { CalibrationRunDetail } from "./run/calibration-run-detail";
import { CalibrationRunsList } from "./run/calibration-runs-list";
import { CalibrationWizard } from "./wizard/calibration-wizard";

export default function DeviceCalibrationContent() {
  const { t } = useTranslation("iot");
  const locale = useLocale();
  const params = useParams<{ deviceId: string }>();
  const deviceId = params.deviceId;
  const router = useRouter();

  const [isWizardOpen, setIsWizardOpen] = useState(false);
  const [selectedRunId, setSelectedRunId] = useState<string | null>(null);

  const { data: device } = useIotDevice(deviceId);
  const family = zCalibrationFamily.safeParse(device?.deviceType);
  const calibrationFamily = family.success ? family.data : undefined;
  const isCalibrationFamily = calibrationFamily !== undefined;

  const active = useActiveDeviceCalibration(deviceId, { enabled: isCalibrationFamily });
  const runs = useDeviceCalibrationRuns(deviceId, { enabled: isCalibrationFamily });
  // A session names its procedure by id; the family's published list is where the names are.
  const definitions = useCalibrationDefinitions(calibrationFamily);
  const definitionNames = new Map(
    (definitions.data ?? []).map((definition) => [definition.id, definition.name]),
  );

  // A phone or an edge device has no coefficients to write; a direct visit leaves.
  const detailPath = `/${locale}/platform/devices/${deviceId}`;
  const hasNoSurface = device !== undefined && !isCalibrationFamily;

  useEffect(() => {
    if (hasNoSurface) {
      router.replace(detailPath);
    }
  }, [hasNoSurface, detailPath, router]);

  if (device === undefined || calibrationFamily === undefined) {
    return null;
  }

  const canManage = device.capabilities.canManage;

  function renderWizard(family: NonNullable<typeof calibrationFamily>) {
    return (
      <CalibrationWizard
        deviceId={deviceId}
        family={family}
        onClose={() => setIsWizardOpen(false)}
      />
    );
  }

  function renderRunDetail(runId: string) {
    return (
      <CalibrationRunDetail
        runId={runId}
        deviceId={deviceId}
        onBack={() => setSelectedRunId(null)}
      />
    );
  }

  function renderCalibrateAction() {
    return (
      <Button type="button" size="sm" onClick={() => setIsWizardOpen(true)}>
        <SlidersHorizontal className="mr-2 size-4" aria-hidden />
        {t("iot.calibration.cta.calibrate")}
      </Button>
    );
  }

  function renderOverview() {
    return (
      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_360px] xl:grid-cols-[minmax(0,1fr)_400px]">
        <div className="space-y-6">
          <CalibrationRunsList
            runs={runs.data}
            definitionNames={definitionNames}
            isLoading={runs.isLoading}
            isError={runs.isError}
            action={canManage ? renderCalibrateAction() : undefined}
            onSelectRun={setSelectedRunId}
          />
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

  return (
    <div>
      <TabBodyHeader
        title={t("iot.calibration.title")}
        description={t("iot.calibration.description")}
      />
      {isWizardOpen
        ? renderWizard(calibrationFamily)
        : selectedRunId !== null
          ? renderRunDetail(selectedRunId)
          : renderOverview()}
    </div>
  );
}
