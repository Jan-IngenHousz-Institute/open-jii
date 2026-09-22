"use client";

import { InsetPanel } from "@/components/shared/inset-panel";
import { useCalibrationCapture } from "@/hooks/iot/useCalibrationCapture/useCalibrationCapture";
import { useCreateCalibrationRun } from "@/hooks/iot/useCreateCalibrationRun/useCreateCalibrationRun";
import { useIotDevices } from "@/hooks/iot/useIotDevices/useIotDevices";
import { useState } from "react";

import type {
  CalibrationDefinitionDetail,
  CalibrationRunPayload,
  SkippedSeriesList,
} from "@repo/api/domains/iot/calibration/iot-calibration.schema";
import { zReportedFirmwareVersion } from "@repo/api/domains/iot/calibration/iot-calibration.schema";
import { useTranslation } from "@repo/i18n";
import { Alert, AlertDescription } from "@repo/ui/components/alert";
import { Button } from "@repo/ui/components/button";

import { CalibrationCaptureProgress } from "../wizard/calibration-capture-progress";
import { CalibrationConnectStep } from "../wizard/calibration-connect-step";
import { CalibrationLiveSeries } from "../wizard/calibration-live-series";
import { CalibrationOperatorPrompt } from "../wizard/calibration-operator-prompt";
import { CalibrationWizardActions } from "../wizard/calibration-wizard-actions";
import { BenchReview } from "./bench-review";
import { unitOnPort } from "./bench-session-unit";
import { unitAlreadyDone } from "./bench-unit";
import type { BenchUnit } from "./bench-unit";
import { BenchUnitTally } from "./bench-unit-tally";

interface CalibrationBenchSessionProps {
  definition: CalibrationDefinitionDetail;
  onChangeProcedure: () => void;
}

function messageOf(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

/**
 * One setup, many units.
 *
 * The rig is the session and the units pass through it: the lamp and the references are
 * bound once and stay bound, and only the port the hardware sits on is released between
 * one unit and the next. Nothing is decided here. A batch is measured at the bench and
 * reviewed afterwards in one sitting, which is the only way the operator's hands stay on
 * the hardware rather than on the keyboard.
 */
export function CalibrationBenchSession({
  definition,
  onChangeProcedure,
}: CalibrationBenchSessionProps) {
  const { t } = useTranslation("iot");

  const [units, setUnits] = useState<BenchUnit[]>([]);
  const [isReviewing, setIsReviewing] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [isRecorded, setIsRecorded] = useState(false);

  const fleet = useIotDevices();
  const createRun = useCreateCalibrationRun();
  const capture = useCalibrationCapture(definition.captureProcedure, definition.family, null);

  const reported = capture.connection?.identity.deviceId;
  const onPort = unitOnPort(reported, definition.family, fleet.data);
  const repeated = onPort.kind === "registered" ? unitAlreadyDone(units, onPort.serial) : undefined;
  const canRun = capture.canStart && onPort.kind === "registered" && !capture.isRunning;

  async function submitRun(readings: CalibrationRunPayload, notRun: SkippedSeriesList) {
    if (onPort.kind !== "registered" || !capture.connection) {
      return;
    }

    setIsSubmitting(true);
    setSubmitError(null);
    try {
      // A version the contract would refuse is left out rather than failing the submission.
      const announced = capture.connection.identity.firmwareVersion;
      const version =
        announced === undefined ? undefined : zReportedFirmwareVersion.safeParse(announced);

      const run = await createRun.mutateAsync({
        deviceId: onPort.device.id,
        definitionId: definition.id,
        payload: readings,
        skippedSeries: notRun.length > 0 ? notRun : undefined,
        firmwareVersion: version?.success === true ? version.data : undefined,
        reportedSerial: onPort.serial,
        preInfo: { ...capture.connection.identity.raw },
      });

      setUnits((done) => [
        ...done,
        {
          serial: onPort.serial,
          deviceId: onPort.device.id,
          deviceName: onPort.device.name,
          runId: run.id,
          outcome: "recorded",
        },
      ]);
      setIsRecorded(true);
    } catch (error) {
      setSubmitError(messageOf(error));
    } finally {
      setIsSubmitting(false);
    }
  }

  // The readings are kept whichever way the submission went: a unit that reached the end of
  // the bench must never be asked to run the whole sweep again over a failed POST.
  async function startCapture() {
    const result = await capture.capture();
    if (result.kind !== "captured") {
      return;
    }
    await submitRun(result.payload, result.skipped);
  }

  /** The rig stays bound; only the hardware in the operator's hands changes. */
  async function nextUnit() {
    setIsRecorded(false);
    setSubmitError(null);
    await capture.releaseUnit();
  }

  function renderUnitState() {
    if (repeated !== undefined && !isRecorded) {
      return (
        <Alert>
          <AlertDescription>
            {t("iot.calibration.bench.alreadyDone", { serial: repeated.serial })}
          </AlertDescription>
        </Alert>
      );
    }
    if (onPort.kind === "unregistered") {
      return (
        <Alert variant="destructive">
          <AlertDescription>
            {t("iot.calibration.bench.unregistered", { serial: onPort.serial })}
          </AlertDescription>
        </Alert>
      );
    }
    if (onPort.kind === "unnamed") {
      return (
        <Alert variant="destructive">
          <AlertDescription>{t("iot.calibration.bench.unnamed")}</AlertDescription>
        </Alert>
      );
    }
    return null;
  }

  /** What this sitting has done, and the one way out of it. */
  function renderSitting() {
    return (
      <div className="space-y-4">
        <BenchUnitTally units={units} />
        {units.length > 0 && (
          <p className="text-muted-foreground text-xs">
            {t("iot.calibration.bench.approvedNotWritten")}
          </p>
        )}
        <Button
          type="button"
          variant="outline"
          size="sm"
          className="w-full"
          onClick={onChangeProcedure}
        >
          {t("iot.calibration.bench.changeProcedure")}
        </Button>
      </div>
    );
  }

  function renderActions() {
    if (isRecorded) {
      return (
        <CalibrationWizardActions
          primary={
            <Button type="button" onClick={() => void nextUnit()}>
              {t("iot.calibration.bench.nextUnit")}
            </Button>
          }
          secondary={
            <Button type="button" variant="outline" onClick={() => setIsReviewing(true)}>
              {t("iot.calibration.bench.reviewNow", { count: units.length })}
            </Button>
          }
        />
      );
    }

    return (
      <CalibrationWizardActions
        primary={
          <Button type="button" onClick={() => void startCapture()} disabled={!canRun}>
            {isSubmitting
              ? t("iot.calibration.bench.recording")
              : t("iot.calibration.capture.start")}
          </Button>
        }
      />
    );
  }

  if (isReviewing) {
    return (
      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_360px] xl:grid-cols-[minmax(0,1fr)_400px]">
        <div className="min-w-0">
          <BenchReview
            units={units}
            outputSchema={definition.outputSchema}
            onDone={() => setIsReviewing(false)}
          />
        </div>
        <InsetPanel padding="lg" className="lg:sticky lg:top-20 lg:self-start">
          {renderSitting()}
        </InsetPanel>
      </div>
    );
  }

  return (
    <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_360px] xl:grid-cols-[minmax(0,1fr)_400px]">
      <div className="min-w-0 space-y-4">
        {renderUnitState()}

        <CalibrationConnectStep
          family={definition.family}
          connection={capture.connection}
          unit={capture.unit}
          isConnecting={capture.isConnecting}
          error={capture.connectError}
          rig={capture.rig}
          onConnect={capture.connect}
          onDisconnect={capture.disconnect}
        />

        {capture.operator.pending !== null && (
          <CalibrationOperatorPrompt request={capture.operator.pending} />
        )}

        <CalibrationCaptureProgress
          events={capture.events}
          isRunning={capture.isRunning}
          isWaitingOnOperator={capture.operator.pending !== null}
        />

        <CalibrationLiveSeries events={capture.events} procedure={definition.captureProcedure} />

        {submitError !== null && (
          <Alert variant="destructive">
            <AlertDescription>{submitError}</AlertDescription>
          </Alert>
        )}

        {renderActions()}
      </div>

      <InsetPanel padding="lg" className="lg:sticky lg:top-20 lg:self-start">
        {renderSitting()}
      </InsetPanel>
    </div>
  );
}
