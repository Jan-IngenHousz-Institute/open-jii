"use client";

import { CalibrationWizard } from "@/components/iot-devices/calibration/wizard/calibration-wizard";
import { useCalibrationDefinition } from "@/hooks/iot/useCalibrationDefinition/useCalibrationDefinition";
import { useLocale } from "@/hooks/useLocale";
import { useParams, useRouter } from "next/navigation";

import { useTranslation } from "@repo/i18n";
import { EmptyState } from "@repo/ui/components/empty-state";
import { Skeleton } from "@repo/ui/components/skeleton";

/**
 * Running a procedure against whatever hardware is on the bench.
 *
 * An author tries a procedure out here, because one that reads plausibly still fails at
 * the bench: a command the firmware does not answer, a sweep that saturates, a fit whose
 * bounds were guessed. An operator works through a tray of units here for the same reason
 * the author is here, which is that this is where the rig is.
 *
 * Nothing asks which device it is. The unit announces itself when the port opens, and
 * being asked to name it first is both a step and a way to record a run against the wrong
 * hardware.
 */
export function CalibrationRunContent() {
  const { t } = useTranslation("iot");
  const locale = useLocale();
  const router = useRouter();
  const params = useParams<{ definitionId: string }>();
  const definitionId = params.definitionId;

  const { data: definition, isLoading, isError } = useCalibrationDefinition(definitionId);

  if (isLoading) {
    return <Skeleton className="h-96 w-full" />;
  }
  if (isError || definition === undefined) {
    return <EmptyState variant="error" description={t("iot.calibration.loadError")} />;
  }

  function leave() {
    router.push(`/${locale}/platform/calibrations/${definitionId}`);
  }

  return (
    <CalibrationWizard
      family={definition.family}
      presetDefinitionId={definitionId}
      onClose={leave}
    />
  );
}
