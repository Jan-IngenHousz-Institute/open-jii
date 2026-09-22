"use client";

import { PanelCard } from "@/components/iot-devices/monitoring/panel-card";
import { useActiveDeviceCalibration } from "@/hooks/iot/useActiveDeviceCalibration/useActiveDeviceCalibration";
import { useApproveCalibrationRun } from "@/hooks/iot/useApproveCalibrationRun/useApproveCalibrationRun";
import type { PhaseResult } from "@/hooks/iot/useCalibrationCapture/useCalibrationCapture";
import { useCalibrationCapture } from "@/hooks/iot/useCalibrationCapture/useCalibrationCapture";
import { useCalibrationDefinition } from "@/hooks/iot/useCalibrationDefinition/useCalibrationDefinition";
import { useCalibrationDefinitions } from "@/hooks/iot/useCalibrationDefinitions/useCalibrationDefinitions";
import { useCreateCalibrationRun } from "@/hooks/iot/useCreateCalibrationRun/useCreateCalibrationRun";
import { useRejectCalibrationRun } from "@/hooks/iot/useRejectCalibrationRun/useRejectCalibrationRun";
import { useReportDeviceCalibrationWrite } from "@/hooks/iot/useReportDeviceCalibrationWrite/useReportDeviceCalibrationWrite";
import { CheckCircle2, CircleDashed, Loader2, TriangleAlert } from "lucide-react";
import { useEffect, useRef, useState } from "react";

import type {
  CalibrationFamily,
  CalibrationRun,
  CalibrationRunPayload,
  CalibrationWriteResults,
  DeviceCalibration,
  SkippedSeriesList,
} from "@repo/api/domains/iot/calibration/iot-calibration.schema";
import { zReportedFirmwareVersion } from "@repo/api/domains/iot/calibration/iot-calibration.schema";
import { useTranslation } from "@repo/i18n";
import type { IDeviceDriver } from "@repo/iot";
import { canWriteCalibration, isSensorFamily, writeCalibrationBlocks } from "@repo/iot";
import { Alert, AlertDescription } from "@repo/ui/components/alert";
import { Button } from "@repo/ui/components/button";
import { WizardStepIndicator } from "@repo/ui/components/wizard-step-indicator";
import { useIsMobile } from "@repo/ui/hooks/use-mobile";
import { toast } from "@repo/ui/hooks/use-toast";
import { cn } from "@repo/ui/lib/utils";

import { CalibrationCaptureProgress } from "./calibration-capture-progress";
import { CalibrationConnectStep } from "./calibration-connect-step";
import { CalibrationDefinitionPicker } from "./calibration-definition-picker";
import { CalibrationDoneSummary } from "./calibration-done-summary";
import { CalibrationLiveSeries } from "./calibration-live-series";
import { CalibrationOperatorPrompt } from "./calibration-operator-prompt";
import { CalibrationReview } from "./calibration-review";
import { CalibrationSessionRail } from "./calibration-session-rail";
import { CalibrationWizardActions } from "./calibration-wizard-actions";
import { CalibrationWriteStep } from "./calibration-write-step";

type WizardStep = "choose" | "connect" | "capture" | "review" | "write" | "done";

/**
 * The three things a session actually consists of, which the six steps are phases of.
 *
 * Choosing a procedure takes a moment, a capture takes minutes at a bench, and approving is
 * a decision; six equal circles would give them the same weight. The step still names
 * itself, in the card's title.
 */
type WizardPhase = "setUp" | "measure" | "decide";

const PHASE_ORDER: readonly WizardPhase[] = ["setUp", "measure", "decide"];

const PHASE_OF: Record<WizardStep, WizardPhase> = {
  choose: "setUp",
  connect: "setUp",
  capture: "measure",
  review: "decide",
  write: "decide",
  done: "decide",
};

/** An approved calibration that has still to reach the device, and the procedure that checks it. */
export interface CalibrationWriteSession {
  calibration: DeviceCalibration;
  definitionId: string;
}

interface CalibrationWizardProps {
  deviceId: string;
  family: CalibrationFamily;
  /** What the platform has this device registered as; the unit that answers has to be it. */
  serialNumber: string;
  /**
   * Entered from a definition rather than from a device: that procedure is fixed, and the
   * wizard opens on Connect.
   */
  presetDefinitionId?: string;
  /** Entered to finish a write, rather than to measure anything. */
  writeSession?: CalibrationWriteSession;
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

/** Whatever the phase read, whether it finished or was cut short. */
function readingsOf(result: PhaseResult): CalibrationRunPayload {
  if (result.kind === "captured") return result.payload;
  return "partial" in result ? result.partial : {};
}

function messageOf(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

/** Bench to coefficient in one sitting; the interpreter asks the operator for what it cannot do itself. */
export function CalibrationWizard({
  deviceId,
  family,
  serialNumber,
  presetDefinitionId,
  writeSession,
  onClose,
}: CalibrationWizardProps) {
  const { t } = useTranslation("iot");
  const isMobile = useIsMobile();

  const isWriteOnly = writeSession !== undefined;
  const isProcedureChosen = isWriteOnly || presetDefinitionId !== undefined;

  const [step, setStep] = useState<WizardStep>(isProcedureChosen ? "connect" : "choose");
  const [definitionId, setDefinitionId] = useState<string | null>(
    writeSession?.definitionId ?? presetDefinitionId ?? null,
  );
  const [payload, setPayload] = useState<CalibrationRunPayload | null>(null);
  const [skipped, setSkipped] = useState<SkippedSeriesList>([]);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [run, setRun] = useState<CalibrationRun | null>(null);
  const [applied, setApplied] = useState<DeviceCalibration | null>(
    writeSession?.calibration ?? null,
  );
  const [writeResults, setWriteResults] = useState<CalibrationWriteResults | null>(null);
  const [postInfo, setPostInfo] = useState<Record<string, unknown> | undefined>(undefined);
  const [writeError, setWriteError] = useState<string | null>(null);
  const [isWriting, setIsWriting] = useState(false);
  const [reportError, setReportError] = useState<string | null>(null);
  const [isReported, setIsReported] = useState(false);
  const [verification, setVerification] = useState<CalibrationRunPayload | null>(null);
  const [verifyOutcome, setVerifyOutcome] = useState<PhaseResult | null>(null);
  const [hasChecked, setHasChecked] = useState(false);

  const definitions = useCalibrationDefinitions(family);
  const definition = useCalibrationDefinition(definitionId);
  const active = useActiveDeviceCalibration(deviceId);
  const capture = useCalibrationCapture(definition.data?.captureProcedure, family, serialNumber);
  const { operator, rig } = capture;
  const createRun = useCreateCalibrationRun();
  const approveRun = useApproveCalibrationRun();
  const rejectRun = useRejectCalibrationRun();
  const reportWrite = useReportDeviceCalibrationWrite();

  const connection = capture.connection;
  const hasDefinition = definition.data !== undefined;
  // The device package drives fewer families than the platform registers, so writing back is offered only where a driver exists.
  const writableFamily = isSensorFamily(family) ? family : null;
  // A write-only session never measures anything, so its rail is the two phases it has.
  const phases = isWriteOnly ? PHASE_ORDER.filter((name) => name !== "measure") : PHASE_ORDER;
  const phaseIndex = phases.indexOf(PHASE_OF[step]);
  const phaseTitles = phases.map((name) => t(`iot.calibration.phase.${name}`));
  // The step the interpreter is on, which is also where the rail marks its place.
  const runningStep = capture.events.findLast((event) => event.kind === "step");
  const activeStep = capture.isRunning && runningStep?.kind === "step" ? runningStep.index : null;
  const isRunComputed = run?.status === "computed";
  const isDeciding = approveRun.isPending || rejectRun.isPending;
  const isWritten = writeResults !== null;
  const canWrite =
    applied !== null &&
    writableFamily !== null &&
    canWriteCalibration(writableFamily, applied.blocks);
  // Only the unit that answered its own name is named in the record; a family that reports
  // none leaves the field out rather than claiming the platform's serial as the device's.
  const reportedSerial = capture.unit?.kind === "match" ? capture.unit.serial : undefined;

  async function submitRun(readings: CalibrationRunPayload, notRun: SkippedSeriesList) {
    if (!definition.data || !connection) return;

    setIsSubmitting(true);
    setSubmitError(null);
    try {
      // A version the contract would refuse is left out rather than failing the submission.
      const reported = connection.identity.firmwareVersion;
      const version =
        reported === undefined ? undefined : zReportedFirmwareVersion.safeParse(reported);

      const created = await createRun.mutateAsync({
        deviceId,
        definitionId: definition.data.id,
        payload: readings,
        skippedSeries: notRun.length > 0 ? notRun : undefined,
        firmwareVersion: version?.success === true ? version.data : undefined,
        reportedSerial,
        preInfo: { ...connection.identity.raw },
      });
      setRun(created);
      setStep("review");
    } catch (error) {
      setSubmitError(messageOf(error));
    } finally {
      setIsSubmitting(false);
    }
  }

  // The readings are kept whichever way the submission went: a session that reached the
  // end of the bench must never be asked to run the whole sweep again over a failed POST.
  async function startCapture() {
    const result = await capture.capture();
    if (result.kind !== "captured") return;

    setPayload(result.payload);
    setSkipped(result.skipped);
    await submitRun(result.payload, result.skipped);
  }

  const startCaptureRef = useRef(startCapture);
  startCaptureRef.current = startCapture;

  // The rig object is new on every render; the effect below holds the ref instead.
  const rigRef = useRef(rig);
  rigRef.current = rig;

  // The bench has nothing left to do once the session is on record, so its ports go back
  // without waiting for the operator to close the page.
  useEffect(() => {
    if (step !== "done") return;
    void rigRef.current.shutdownAll().catch((error: unknown) => {
      console.error("The bench could not be returned to rest:", error);
    });
  }, [step]);

  // A retry stays on the step, so it starts the procedure itself; the effect would not re-fire for an unchanged step.
  const captureStartedRef = useRef(false);
  useEffect(() => {
    if (step !== "capture" || captureStartedRef.current) return;
    captureStartedRef.current = true;
    void startCaptureRef.current();
  }, [step]);

  function retryCapture() {
    void startCapture();
  }

  function retrySubmit() {
    if (!payload) return;
    void submitRun(payload, skipped);
  }

  // A run that computed nothing leaves the bench as it stands, so another pass starts at once.
  function runAgain() {
    setPayload(null);
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

  /**
   * On record separately from the write itself: the coefficients are on the hardware by the
   * time this can fail, and the operator has to be able to record that without writing again.
   */
  async function recordWrite(
    results: CalibrationWriteResults,
    state: Record<string, unknown> | undefined,
    checked?: CalibrationRunPayload,
  ): Promise<boolean> {
    if (!applied) return false;

    setReportError(null);
    try {
      await reportWrite.mutateAsync({
        calibrationId: applied.id,
        writeResults: results,
        postInfo: state,
        verification: checked,
        reportedSerial,
      });
      setIsReported(true);
      return true;
    } catch (error) {
      setReportError(messageOf(error));
      return false;
    }
  }

  async function write() {
    if (!applied || writableFamily === null) return;
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

      // Read before the check starts: a check is operator-paced and the tab may not outlive it.
      const state = await readPostWriteInfo(connection.driver);
      setPostInfo(state);
      const recorded = await recordWrite(results, state);

      const checked = await verifyOnDevice(results);
      if (checked && recorded) {
        await recordWrite(results, state, checked);
      }
    } catch (error) {
      setWriteError(messageOf(error));
    } finally {
      setIsWriting(false);
    }
  }

  /** The procedure's check once something reached the device; a stop keeps what it read, and the write stands. */
  async function verifyOnDevice(
    results: CalibrationWriteResults,
  ): Promise<CalibrationRunPayload | undefined> {
    const hasCheck = (definition.data?.captureProcedure.verify?.length ?? 0) > 0;
    const wroteSomething = Object.values(results).some((result) => result.verified);
    if (!hasCheck || !wroteSomething) return undefined;

    // Both phases report through one event stream, so the check may only show it once the
    // check is what is producing it. Without this the write step listed the capture's own
    // series under "check with the new coefficients".
    setHasChecked(true);
    const outcome = await capture.verify();
    const readings = readingsOf(outcome);
    setVerifyOutcome(outcome);
    setVerification(readings);

    return Object.keys(readings).length > 0 ? readings : undefined;
  }

  function retryReport() {
    if (!writeResults) return;
    void recordWrite(writeResults, postInfo, verification ?? undefined);
  }

  // Awaited: the teardown behind it rests the bench through the device's own driver, and a
  // close that did not wait would pull the port out from under that.
  async function closeWizard() {
    const notAtRest = await capture.leave();
    if (notAtRest !== null) {
      toast({
        title: t("iot.calibration.capture.restFailed"),
        description: notAtRest,
        variant: "destructive",
      });
    }
    onClose();
  }

  function describeFailure(): { headline: string; detail?: string } | null {
    const failure = capture.failure;
    if (failure === null) return null;
    switch (failure.kind) {
      case "stopped":
        return { headline: t("iot.calibration.capture.stopped") };
      case "disconnected":
        return { headline: t("iot.calibration.capture.disconnected") };
      case "noProcedure":
        return { headline: t("iot.calibration.loadError") };
      case "failed":
        return { headline: t("iot.calibration.capture.aborted"), detail: failure.message };
    }
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
        unit={capture.unit}
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
          <Button
            type="button"
            onClick={() => setStep(isWriteOnly ? "write" : "capture")}
            disabled={isWriteOnly ? connection === undefined : !capture.canStart}
          >
            {t("iot.calibration.cta.next")}
          </Button>
        }
      />
    );
  }

  function renderCaptureFailure() {
    const failure = describeFailure();
    if (failure === null) return null;
    return (
      <Alert variant="destructive">
        <AlertDescription>
          {failure.headline}
          {failure.detail !== undefined && (
            <span className="mt-1 block font-mono text-xs">{failure.detail}</span>
          )}
        </AlertDescription>
      </Alert>
    );
  }

  function renderRestFailure() {
    if (capture.restFailure === null) return null;
    return (
      <Alert variant="destructive">
        <AlertDescription>
          {t("iot.calibration.capture.restFailed")}
          <span className="mt-1 block font-mono text-xs">{capture.restFailure}</span>
        </AlertDescription>
      </Alert>
    );
  }

  function renderCapture() {
    const request = operator.pending;
    return (
      <div className="space-y-6">
        <CalibrationCaptureProgress
          events={capture.events}
          isRunning={capture.isRunning}
          isWaitingOnOperator={request !== null}
        />
        {capture.isRunning && (
          <CalibrationLiveSeries
            events={capture.events}
            procedure={definition.data?.captureProcedure}
          />
        )}
        {request !== null && <CalibrationOperatorPrompt request={request} />}
        {isSubmitting && (
          <p className="text-muted-foreground flex items-center gap-2 text-sm">
            <Loader2 className="size-4 animate-spin" aria-hidden />
            {t("iot.calibration.capture.submitting")}
          </p>
        )}
        {renderCaptureFailure()}
        {renderRestFailure()}
        {submitError !== null && (
          <Alert variant="destructive">
            <AlertDescription>
              {t("iot.calibration.capture.submitFailed")}
              <span className="mt-1 block font-mono text-xs">{submitError}</span>
            </AlertDescription>
          </Alert>
        )}
      </div>
    );
  }

  function renderCaptureActions() {
    // Stopping is the only control while the bench is running, and it has to be there
    // throughout: a sweep with a fault in it is otherwise only escapable by leaving.
    if (capture.isRunning) {
      return (
        <CalibrationWizardActions
          primary={
            <Button type="button" variant="outline" onClick={capture.stop}>
              {t("iot.calibration.capture.stop")}
            </Button>
          }
        />
      );
    }
    if (isSubmitting) return null;

    // The readings survived; only recording them failed, so that is all a retry repeats.
    if (submitError !== null) {
      return (
        <CalibrationWizardActions
          secondary={renderCancel()}
          primary={
            <Button type="button" onClick={retrySubmit}>
              {t("iot.calibration.capture.retrySubmit")}
            </Button>
          }
        />
      );
    }
    if (capture.failure === null) return null;

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
    return (
      <CalibrationReview
        run={run}
        payload={payload}
        active={active.data ?? null}
        outputSchema={definition.data?.outputSchema}
      />
    );
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
    const isCheckFailure = verifyOutcome !== null && verifyOutcome.kind !== "captured";
    return (
      <div className="space-y-6">
        {operator.pending !== null && <CalibrationOperatorPrompt request={operator.pending} />}
        <CalibrationWriteStep
          applied={applied}
          canWrite={canWrite}
          results={writeResults}
          error={writeError}
          reportError={reportError}
          isDisconnected={connection === undefined}
          verifyEvents={hasChecked ? capture.events : []}
          isVerifying={hasChecked && capture.isRunning}
          verification={verification}
          verificationError={isCheckFailure ? (describeFailure()?.headline ?? null) : null}
        />
        {renderRestFailure()}
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
    if (capture.isRunning) {
      return (
        <CalibrationWizardActions
          primary={
            <Button type="button" variant="outline" onClick={capture.stop}>
              {t("iot.calibration.capture.stop")}
            </Button>
          }
        />
      );
    }
    // The coefficients are on the hardware and only the record is missing; writing again
    // would put them there twice to fix a failure that never involved the device.
    if (isWritten && reportError !== null) {
      return (
        <CalibrationWizardActions
          secondary={
            <Button type="button" variant="outline" onClick={() => setStep("done")}>
              {t("iot.calibration.write.finishUnrecorded")}
            </Button>
          }
          primary={
            <Button type="button" onClick={retryReport} disabled={reportWrite.isPending}>
              {reportWrite.isPending && (
                <Loader2 className="mr-2 size-4 animate-spin" aria-hidden />
              )}
              {t("iot.calibration.write.retryReport")}
            </Button>
          }
        />
      );
    }
    if (!isWritten) {
      // A pulled cable between approving and writing is recoverable here rather than by
      // starting the session again.
      if (connection === undefined) {
        return (
          <CalibrationWizardActions
            secondary={renderCancel()}
            primary={
              <Button type="button" onClick={capture.connect} disabled={capture.isConnecting}>
                {capture.isConnecting && (
                  <Loader2 className="mr-2 size-4 animate-spin" aria-hidden />
                )}
                {t("iot.calibration.write.reconnect")}
              </Button>
            }
          />
        );
      }
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

  /** What the session actually left behind, which is not always what it set out to do. */
  function outcomeOfSession() {
    if (applied === null) return "rejected";
    if (!isWritten) return canWrite ? "notWritten" : "recordOnly";
    if (!isReported) return "unrecorded";
    const isConfirmed = Object.values(writeResults).every((result) => result.verified);
    return isConfirmed ? "confirmed" : "unconfirmed";
  }

  function renderDone() {
    const outcome = outcomeOfSession();
    const hint = {
      rejected: t("iot.calibration.done.rejectedHint"),
      recordOnly: t("iot.calibration.done.recordOnlyHint"),
      notWritten: t("iot.calibration.done.notWrittenHint"),
      unrecorded: t("iot.calibration.done.notRecordedHint"),
      confirmed: t("iot.calibration.done.writtenHint"),
      unconfirmed: t("iot.calibration.done.unconfirmedHint"),
    }[outcome];
    const Glyph = {
      rejected: CircleDashed,
      recordOnly: CircleDashed,
      notWritten: CircleDashed,
      unrecorded: TriangleAlert,
      confirmed: CheckCircle2,
      unconfirmed: TriangleAlert,
    }[outcome];
    const isAlarming = outcome === "unrecorded" || outcome === "unconfirmed";

    return (
      <div className="space-y-4">
        <div className="flex items-start gap-3">
          <Glyph
            className={cn(
              "mt-0.5 size-5 shrink-0",
              outcome === "confirmed" && "text-status-active",
              isAlarming && "text-destructive",
              !isAlarming && outcome !== "confirmed" && "text-muted-foreground",
            )}
            aria-hidden
          />
          <p className="text-sm">{hint}</p>
        </div>
        <CalibrationDoneSummary
          payload={payload}
          applied={applied}
          results={writeResults}
          isReported={isReported}
        />
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

  // A bench session is not a form to fill in, it is a workspace: the step's work on the left
  // and the session itself on the right, where what is on the ports and how far the run has
  // got stay readable without stepping backwards. The grid is the platform's own detail
  // layout, the one every other device tab uses.
  return (
    <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_360px] xl:grid-cols-[minmax(0,1fr)_400px]">
      <div className="min-w-0 space-y-6">
        {/* Over the work it describes rather than over the whole page: across the rail as
            well, three circles sat at the ends of very long connectors. Three short phase
            names also fit a phone where six step names did not, and three unlabelled
            circles tell an operator nothing. */}
        <WizardStepIndicator
          steps={phaseTitles}
          currentIndex={phaseIndex}
          detail={isMobile ? undefined : t(`iot.calibration.steps.${step}`)}
        />
        <PanelCard title={t(`iot.calibration.steps.${step}`)} description={stepDescription()}>
          {renderStep()}
        </PanelCard>
        {renderActions()}
      </div>

      {/* The rail is the session, and by Done the session is over: its ports are released,
          so it would show a bench of idle circles beside a summary saying all went well.
          The column stays so the card does not jump width at the last step. */}
      <div className="lg:sticky lg:top-20 lg:self-start">
        {step !== "done" && (
          <CalibrationSessionRail
            family={family}
            procedure={definition.data?.captureProcedure}
            connection={connection}
            unit={capture.unit}
            roles={rig.roles}
            activeStep={activeStep}
            isComplete={payload !== null && !capture.isRunning}
            isRunning={capture.isRunning}
          />
        )}
      </div>
    </div>
  );
}
