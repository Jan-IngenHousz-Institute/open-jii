"use client";

import { PanelCard } from "@/components/iot-devices/monitoring/panel-card";
import { useActiveDeviceCalibration } from "@/hooks/iot/useActiveDeviceCalibration/useActiveDeviceCalibration";
import { useApproveCalibrationRun } from "@/hooks/iot/useApproveCalibrationRun/useApproveCalibrationRun";
import {
  toRunPayload,
  useCalibrationCapture,
} from "@/hooks/iot/useCalibrationCapture/useCalibrationCapture";
import { useCalibrationDefinition } from "@/hooks/iot/useCalibrationDefinition/useCalibrationDefinition";
import { useCalibrationDefinitions } from "@/hooks/iot/useCalibrationDefinitions/useCalibrationDefinitions";
import { useCreateCalibrationRun } from "@/hooks/iot/useCreateCalibrationRun/useCreateCalibrationRun";
import { useRejectCalibrationRun } from "@/hooks/iot/useRejectCalibrationRun/useRejectCalibrationRun";
import { useReportDeviceCalibrationWrite } from "@/hooks/iot/useReportDeviceCalibrationWrite/useReportDeviceCalibrationWrite";
import { CheckCircle2, CircleDashed, Loader2, TriangleAlert } from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";

import type {
  CalibrationDefinition,
  CalibrationFamily,
  CalibrationRun,
  CalibrationRunPayload,
  CalibrationWriteResults,
  DeviceCalibration,
} from "@repo/api/domains/iot/calibration/iot-calibration.schema";
import { zFirmwareVersion } from "@repo/api/domains/iot/calibration/iot-calibration.schema";
import { useTranslation } from "@repo/i18n";
import type { IDeviceDriver, ProcedureProgress } from "@repo/iot";
import {
  ProcedureAborted,
  canWriteCalibration,
  isSensorFamily,
  runVerificationProcedure,
  writeCalibrationBlocks,
} from "@repo/iot";
import { Alert, AlertDescription } from "@repo/ui/components/alert";
import { Button } from "@repo/ui/components/button";
import { WizardStepIndicator } from "@repo/ui/components/wizard-step-indicator";
import { useIsMobile } from "@repo/ui/hooks/use-mobile";
import { toast } from "@repo/ui/hooks/use-toast";
import { cn } from "@repo/ui/lib/utils";

import { CalibrationCaptureProgress } from "./calibration-capture-progress";
import { CalibrationConnectStep } from "./calibration-connect-step";
import { CalibrationDefinitionPicker } from "./calibration-definition-picker";
import { CalibrationOperatorPrompt } from "./calibration-operator-prompt";
import { CalibrationReview } from "./calibration-review";
import { CalibrationWizardActions } from "./calibration-wizard-actions";
import { CalibrationWriteStep } from "./calibration-write-step";

type WizardStep = "choose" | "connect" | "capture" | "review" | "write" | "done";

const STEP_ORDER: readonly WizardStep[] = [
  "choose",
  "connect",
  "capture",
  "review",
  "write",
  "done",
];

interface CalibrationWizardProps {
  deviceId: string;
  family: CalibrationFamily;
  /**
   * Entered from a definition rather than from a device: that procedure is fixed, and the
   * wizard opens on Connect.
   */
  presetDefinitionId?: string;
  onClose: () => void;
}

/** A device that does not answer leaves postInfo out rather than failing a write that succeeded. */
async function readPostWriteInfo(
  driver: IDeviceDriver,
): Promise<Record<string, unknown> | undefined> {
  if (!driver.getDeviceIdentity) return undefined;
  try {
    const identity = await driver.getDeviceIdentity();
    return { ...identity.raw };
  } catch {
    return undefined;
  }
}

/** Bench to coefficient in one sitting; the interpreter asks the operator for what it cannot do itself. */
export function CalibrationWizard({
  deviceId,
  family,
  presetDefinitionId,
  onClose,
}: CalibrationWizardProps) {
  const { t } = useTranslation("iot");
  const isMobile = useIsMobile();

  const isProcedureChosen = presetDefinitionId !== undefined;
  const stepOrder = isProcedureChosen ? STEP_ORDER.filter((name) => name !== "choose") : STEP_ORDER;

  const [step, setStep] = useState<WizardStep>(isProcedureChosen ? "connect" : "choose");
  const [definitionId, setDefinitionId] = useState<string | null>(presetDefinitionId ?? null);
  const [payload, setPayload] = useState<CalibrationRunPayload | null>(null);
  const [run, setRun] = useState<CalibrationRun | null>(null);
  const [applied, setApplied] = useState<DeviceCalibration | null>(null);
  const [writeResults, setWriteResults] = useState<CalibrationWriteResults | null>(null);
  const [writeError, setWriteError] = useState<string | null>(null);
  const [isWriting, setIsWriting] = useState(false);
  const [verifyEvents, setVerifyEvents] = useState<ProcedureProgress[]>([]);
  const [isVerifying, setIsVerifying] = useState(false);
  const [verification, setVerification] = useState<CalibrationRunPayload | null>(null);
  const [verificationError, setVerificationError] = useState<string | null>(null);

  const definitions = useCalibrationDefinitions(family);
  const definition = useCalibrationDefinition(definitionId);
  const active = useActiveDeviceCalibration(deviceId);
  const capture = useCalibrationCapture(definition.data?.captureProcedure, family);
  const { operator, rig } = capture;
  const createRun = useCreateCalibrationRun();
  const approveRun = useApproveCalibrationRun();
  const rejectRun = useRejectCalibrationRun();
  const reportWrite = useReportDeviceCalibrationWrite();

  const connection = capture.connection;
  const hasDefinition = definition.data !== undefined;
  // The device package drives fewer families than the platform registers, so writing back is offered only where a driver exists.
  const writableFamily = isSensorFamily(family) ? family : null;
  const stepIndex = stepOrder.indexOf(step);
  const stepTitles = stepOrder.map((name) => t(`iot.calibration.steps.${name}`));
  const isRunComputed = run?.status === "computed";
  const isDeciding = approveRun.isPending || rejectRun.isPending;
  const isWritten = writeResults !== null;
  const canWrite =
    applied !== null &&
    writableFamily !== null &&
    canWriteCalibration(writableFamily, applied.blocks);

  // The rig object is new on every render; the dependency lists below hold the ref instead.
  const rigRef = useRef(rig);
  rigRef.current = rig;

  useEffect(() => {
    if (step === "done") {
      void rigRef.current.shutdownAll();
    }
  }, [step]);

  const runCapture = capture.capture;
  const setCaptureError = capture.setError;

  const startCapture = useCallback(async () => {
    const runPayload = await runCapture();
    if (!runPayload || !definition.data || !connection) return;
    setPayload(runPayload);

    try {
      // A version the contract would refuse is left out rather than failing the submission.
      const reported = connection.identity.firmwareVersion;
      const firmwareVersion = zFirmwareVersion.safeParse(reported).success ? reported : undefined;

      const created = await createRun.mutateAsync({
        deviceId,
        definitionId: definition.data.id,
        payload: runPayload,
        firmwareVersion,
        preInfo: { ...connection.identity.raw },
      });
      setRun(created);
      setStep("review");
    } catch (error) {
      setCaptureError(error instanceof Error ? error.message : String(error));
    }
  }, [connection, createRun, definition.data, deviceId, runCapture, setCaptureError]);

  // A retry stays on the step, so it starts the procedure itself; the effect would not re-fire for an unchanged step.
  const captureStartedRef = useRef(false);
  useEffect(() => {
    if (step !== "capture" || captureStartedRef.current) return;
    captureStartedRef.current = true;
    void startCapture();
  }, [step, startCapture]);

  function retryCapture() {
    void startCapture();
  }

  // A run that computed nothing leaves the bench as it stands, so another pass starts at once.
  function runAgain() {
    setStep("capture");
    void startCapture();
  }

  async function approve() {
    if (!run) return;
    try {
      const calibration = await approveRun.mutateAsync({ runId: run.id });
      setApplied(calibration);
      setStep("write");
    } catch {
      toast({ title: t("iot.calibration.review.approveFailed"), variant: "destructive" });
    }
  }

  async function reject() {
    if (!run) return;
    try {
      await rejectRun.mutateAsync({ runId: run.id });
      setStep("done");
    } catch {
      toast({ title: t("iot.calibration.review.rejectFailed"), variant: "destructive" });
    }
  }

  async function write() {
    if (!applied || writableFamily === null || !definition.data) return;
    // The port can be pulled between approving and writing. Returning quietly here left an
    // enabled button that did nothing at all.
    if (!connection) {
      setWriteError(t("iot.calibration.write.disconnected"));
      return;
    }
    setIsWriting(true);
    setWriteError(null);
    try {
      const results = await writeCalibrationBlocks(
        connection.driver,
        writableFamily,
        applied.blocks,
      );
      setWriteResults(results);
      // On record before the check starts: a check is operator-paced and the tab may not outlive it.
      const postInfo = await readPostWriteInfo(connection.driver);
      const report = { calibrationId: applied.id, writeResults: results, postInfo };
      await reportWrite.mutateAsync(report);
      const checked = await verifyOnDevice(definition.data.captureProcedure, results);
      if (checked) {
        await reportWrite.mutateAsync({ ...report, verification: checked });
      }
    } catch (error) {
      setWriteError(
        error instanceof Error ? error.message : t("iot.calibration.write.reportFailed"),
      );
    } finally {
      setIsWriting(false);
    }
  }

  /** The procedure's check once something reached the device; a stop keeps what it read, and the write stands. */
  async function verifyOnDevice(
    procedure: CalibrationDefinition["captureProcedure"],
    results: CalibrationWriteResults,
  ): Promise<CalibrationRunPayload | undefined> {
    const hasCheck = (procedure.verify?.length ?? 0) > 0;
    const wroteSomething = Object.values(results).some((result) => result.verified);
    if (!hasCheck || !wroteSomething) return undefined;

    setIsVerifying(true);
    setVerifyEvents([]);
    setVerificationError(null);
    try {
      const result = await runVerificationProcedure(procedure, {
        rig: rigRef.current.bindings,
        operator: operator.port,
        onProgress: (event) => setVerifyEvents((previous) => [...previous, event]),
      });
      const readings = toRunPayload(result.payload);
      setVerification(readings);
      return readings;
    } catch (error) {
      const partial = error instanceof ProcedureAborted ? toRunPayload(error.partial.payload) : {};
      setVerificationError(error instanceof Error ? error.message : String(error));
      setVerification(partial);
      return Object.keys(partial).length > 0 ? partial : undefined;
    } finally {
      await rig.rest();
      setIsVerifying(false);
    }
  }

  // Awaited: the unmount that follows destroys the device's driver, and a rest racing
  // that loses its port mid-write.
  async function closeWizard() {
    await rig.shutdownAll();
    onClose();
  }

  function stepDescription(): string | undefined {
    switch (step) {
      case "choose":
        return t("iot.calibration.choose.hint");
      case "connect":
        return t("iot.calibration.connect.hint");
      case "capture":
        return t("iot.calibration.capture.hint");
      case "review":
        return isRunComputed ? t("iot.calibration.review.hint") : undefined;
      case "write":
        return canWrite ? t("iot.calibration.write.hint") : undefined;
      case "done":
        return undefined;
    }
  }

  function renderCancel() {
    return (
      <Button type="button" variant="outline" onClick={() => void closeWizard()}>
        {t("iot.calibration.cta.cancel")}
      </Button>
    );
  }

  function renderClose() {
    return (
      <Button type="button" onClick={() => void closeWizard()}>
        {t("iot.calibration.done.close")}
      </Button>
    );
  }

  function renderChoose() {
    return (
      <CalibrationDefinitionPicker
        definitions={definitions.data}
        isLoading={definitions.isLoading}
        isError={definitions.isError}
        selectedId={definitionId}
        onSelect={setDefinitionId}
      />
    );
  }

  function renderChooseActions() {
    return (
      <CalibrationWizardActions
        secondary={renderCancel()}
        primary={
          <Button
            type="button"
            onClick={() => setStep("connect")}
            disabled={definitionId === null || !hasDefinition}
          >
            {t("iot.calibration.cta.next")}
          </Button>
        }
      />
    );
  }

  function renderConnect() {
    return (
      <CalibrationConnectStep
        family={family}
        connection={connection}
        isConnecting={capture.isConnecting}
        error={capture.connectError}
        rig={rig}
        onConnect={capture.connect}
        onDisconnect={capture.disconnect}
      />
    );
  }

  function renderConnectActions() {
    const secondary = isProcedureChosen ? (
      renderCancel()
    ) : (
      <Button type="button" variant="outline" onClick={() => setStep("choose")}>
        {t("iot.calibration.cta.back")}
      </Button>
    );

    return (
      <CalibrationWizardActions
        secondary={secondary}
        primary={
          <Button type="button" onClick={() => setStep("capture")} disabled={!capture.canStart}>
            {t("iot.calibration.cta.next")}
          </Button>
        }
      />
    );
  }

  function renderCapture() {
    const request = operator.pending;
    return (
      <div className="space-y-6">
        <CalibrationCaptureProgress
          events={capture.events}
          isRunning={capture.isCapturing}
          isWaitingOnOperator={request !== null}
        />
        {request !== null && <CalibrationOperatorPrompt request={request} />}
        {capture.isCapturing && request === null && createRun.isPending && (
          <p className="text-muted-foreground flex items-center gap-2 text-sm">
            <Loader2 className="size-4 animate-spin" aria-hidden />
            {t("iot.calibration.capture.submitting")}
          </p>
        )}
        {capture.error !== null && (
          <Alert variant="destructive">
            <AlertDescription>
              {t("iot.calibration.capture.aborted")}
              <span className="mt-1 block font-mono text-xs">{capture.error}</span>
            </AlertDescription>
          </Alert>
        )}
      </div>
    );
  }

  function renderCaptureActions() {
    if (capture.error === null) return null;
    return (
      <CalibrationWizardActions
        secondary={renderCancel()}
        primary={
          <Button type="button" onClick={retryCapture}>
            {t("iot.calibration.capture.retry")}
          </Button>
        }
      />
    );
  }

  function renderReview() {
    if (!run || !payload) return null;
    return <CalibrationReview run={run} payload={payload} active={active.data ?? null} />;
  }

  function renderReviewActions() {
    if (!run) return null;
    if (!isRunComputed) {
      return (
        <CalibrationWizardActions
          secondary={
            <Button type="button" variant="outline" onClick={() => void closeWizard()}>
              {t("iot.calibration.done.close")}
            </Button>
          }
          primary={
            <Button type="button" onClick={runAgain}>
              {t("iot.calibration.capture.retry")}
            </Button>
          }
        />
      );
    }
    return (
      <CalibrationWizardActions
        secondary={
          <Button
            type="button"
            variant="outline"
            onClick={() => void reject()}
            disabled={isDeciding}
          >
            {rejectRun.isPending && <Loader2 className="mr-2 size-4 animate-spin" aria-hidden />}
            {t("iot.calibration.review.reject")}
          </Button>
        }
        primary={
          <Button type="button" onClick={() => void approve()} disabled={isDeciding}>
            {approveRun.isPending && <Loader2 className="mr-2 size-4 animate-spin" aria-hidden />}
            {t("iot.calibration.review.approve")}
          </Button>
        }
      />
    );
  }

  function renderWrite() {
    if (!applied) return null;
    return (
      <div className="space-y-6">
        {operator.pending !== null && <CalibrationOperatorPrompt request={operator.pending} />}
        <CalibrationWriteStep
          applied={applied}
          canWrite={canWrite}
          results={writeResults}
          error={writeError}
          verifyEvents={verifyEvents}
          isVerifying={isVerifying}
          verification={verification}
          verificationError={verificationError}
        />
      </div>
    );
  }

  function renderWriteActions() {
    if (!canWrite) {
      return (
        <CalibrationWizardActions
          primary={
            <Button type="button" variant="outline" onClick={() => setStep("done")}>
              {t("iot.calibration.write.skip")}
            </Button>
          }
        />
      );
    }
    if (!isWritten) {
      return (
        <CalibrationWizardActions
          primary={
            <Button type="button" onClick={() => void write()} disabled={isWriting}>
              {isWriting && <Loader2 className="mr-2 size-4 animate-spin" aria-hidden />}
              {isWriting ? t("iot.calibration.write.writing") : t("iot.calibration.write.action")}
            </Button>
          }
        />
      );
    }
    return (
      <CalibrationWizardActions
        primary={
          <Button type="button" onClick={() => setStep("done")} disabled={isWriting}>
            {t("iot.calibration.done.close")}
          </Button>
        }
      />
    );
  }

  function renderDone() {
    const isApproved = applied !== null;
    const isConfirmed =
      writeResults !== null && Object.values(writeResults).every((result) => result.verified);
    const outcome = !isApproved ? "rejected" : isConfirmed ? "confirmed" : "unconfirmed";
    const hint = {
      rejected: t("iot.calibration.done.rejectedHint"),
      confirmed: t("iot.calibration.done.writtenHint"),
      unconfirmed: t("iot.calibration.done.notWrittenHint"),
    }[outcome];
    const Glyph = { rejected: CircleDashed, confirmed: CheckCircle2, unconfirmed: TriangleAlert }[
      outcome
    ];

    return (
      <div className="flex items-start gap-3">
        <Glyph
          className={cn(
            "mt-0.5 size-5 shrink-0",
            outcome === "confirmed" && "text-status-active",
            outcome === "unconfirmed" && "text-destructive",
            outcome === "rejected" && "text-muted-foreground",
          )}
          aria-hidden
        />
        <p className="text-sm">{hint}</p>
      </div>
    );
  }

  function renderDoneActions() {
    return <CalibrationWizardActions primary={renderClose()} />;
  }

  function renderStep() {
    switch (step) {
      case "choose":
        return renderChoose();
      case "connect":
        return renderConnect();
      case "capture":
        return renderCapture();
      case "review":
        return renderReview();
      case "write":
        return renderWrite();
      case "done":
        return renderDone();
    }
  }

  function renderActions() {
    switch (step) {
      case "choose":
        return renderChooseActions();
      case "connect":
        return renderConnectActions();
      case "capture":
        return renderCaptureActions();
      case "review":
        return renderReviewActions();
      case "write":
        return renderWriteActions();
      case "done":
        return renderDoneActions();
    }
  }

  // A bench session is a single column of instructions, readings and one decision, so it
  // is held to a reading width like the other guided flows in this area. The step names are
  // the card's title on a phone, where the rail has no room for them.
  return (
    <div className="max-w-3xl space-y-6">
      <WizardStepIndicator steps={stepTitles} currentIndex={stepIndex} showTitles={!isMobile} />
      <PanelCard title={t(`iot.calibration.steps.${step}`)} description={stepDescription()}>
        {renderStep()}
      </PanelCard>
      {renderActions()}
    </div>
  );
}
