"use client";

import { PanelCard } from "@/components/iot-devices/monitoring/panel-card";
import { useActiveDeviceCalibration } from "@/hooks/iot/useActiveDeviceCalibration/useActiveDeviceCalibration";
import { useApproveCalibrationRun } from "@/hooks/iot/useApproveCalibrationRun/useApproveCalibrationRun";
import { useCalibrationDefinition } from "@/hooks/iot/useCalibrationDefinition/useCalibrationDefinition";
import { useCalibrationDefinitions } from "@/hooks/iot/useCalibrationDefinitions/useCalibrationDefinitions";
import { useCalibrationOperator } from "@/hooks/iot/useCalibrationOperator/useCalibrationOperator";
import { useCalibrationRig } from "@/hooks/iot/useCalibrationRig/useCalibrationRig";
import { useCreateCalibrationRun } from "@/hooks/iot/useCreateCalibrationRun/useCreateCalibrationRun";
import { useIotConnections } from "@/hooks/iot/useIotConnections/useIotConnections";
import { useRejectCalibrationRun } from "@/hooks/iot/useRejectCalibrationRun/useRejectCalibrationRun";
import { useReportDeviceCalibrationWrite } from "@/hooks/iot/useReportDeviceCalibrationWrite/useReportDeviceCalibrationWrite";
import { Loader2 } from "lucide-react";
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
import type { IotDeviceDetail } from "@repo/api/domains/iot/iot.schema";
import { useTranslation } from "@repo/i18n";
import type { CapturePayload, IDeviceDriver, ProcedureProgress } from "@repo/iot";
import {
  ProcedureAborted,
  canWriteCalibration,
  isSensorFamily,
  runCaptureProcedure,
  runVerificationProcedure,
  writeCalibrationBlocks,
} from "@repo/iot";
import { Alert, AlertDescription } from "@repo/ui/components/alert";
import { Button } from "@repo/ui/components/button";
import { toast } from "@repo/ui/hooks/use-toast";

import { CalibrationCaptureProgress } from "./calibration-capture-progress";
import { CalibrationConnectStep } from "./calibration-connect-step";
import { CalibrationDefinitionPicker } from "./calibration-definition-picker";
import { CalibrationOperatorPrompt } from "./calibration-operator-prompt";
import { CalibrationReview } from "./calibration-review";
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
  device: IotDeviceDetail;
  family: CalibrationFamily;
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

/** The interpreter never yields null cells in practice; the contract has no room for them. */
function toRunPayload(payload: CapturePayload): CalibrationRunPayload {
  const result: CalibrationRunPayload = {};
  for (const [series, rows] of Object.entries(payload)) {
    result[series] = rows.map((row) =>
      Object.fromEntries(Object.entries(row).filter(([, cell]) => cell !== null)),
    );
  }
  return result;
}

/** Bench to coefficient in one sitting; the interpreter asks the operator for what it cannot do itself. */
export function CalibrationWizard({ device, family, onClose }: CalibrationWizardProps) {
  const { t } = useTranslation("iot");

  const [step, setStep] = useState<WizardStep>("choose");
  const [definitionId, setDefinitionId] = useState<string | null>(null);
  const [events, setEvents] = useState<ProcedureProgress[]>([]);
  const [payload, setPayload] = useState<CalibrationRunPayload | null>(null);
  const [captureError, setCaptureError] = useState<string | null>(null);
  const [isCapturing, setIsCapturing] = useState(false);
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
  const active = useActiveDeviceCalibration(device.id);
  const connections = useIotConnections(family);
  const operator = useCalibrationOperator();
  const rig = useCalibrationRig(
    definition.data?.captureProcedure,
    connections.connections.at(0)?.driver,
  );
  const createRun = useCreateCalibrationRun();
  const approveRun = useApproveCalibrationRun();
  const rejectRun = useRejectCalibrationRun();
  const reportWrite = useReportDeviceCalibrationWrite();

  const connection = connections.connections.at(0);
  const isConnectedToFamily = connection?.family === family;
  const canLeaveConnectStep = isConnectedToFamily && rig.hasEveryRequiredRole;
  const hasDefinition = definition.data !== undefined;
  // The device package drives fewer families than the platform registers, so writing back is offered only where a driver exists.
  const writableFamily = isSensorFamily(family) ? family : null;
  const stepIndex = STEP_ORDER.indexOf(step);

  // Leaving mid-run must not leave the interpreter awaiting a prompt; the port closes with the connection hook.
  const cancelOperator = operator.cancel;
  useEffect(() => cancelOperator, [cancelOperator]);

  const isCapturingRef = useRef(false);

  // The rig object is new on every render; the dependency lists below hold the ref instead.
  const rigRef = useRef(rig);
  rigRef.current = rig;

  useEffect(() => {
    if (step === "done") {
      void rigRef.current.shutdownAll();
    }
  }, [step]);

  const startCapture = useCallback(async () => {
    // Retry is on screen while the aborted run's rig is still being rested, and a second
    // click would drive the bench from two procedures at once. A ref, because the flag is
    // read by a callback that must not be rebuilt every time capture starts or stops.
    if (!definition.data || !connection || isCapturingRef.current) return;
    isCapturingRef.current = true;
    setIsCapturing(true);
    setCaptureError(null);
    setEvents([]);

    try {
      const result = await runCaptureProcedure(definition.data.captureProcedure, {
        rig: rigRef.current.bindings,
        operator: operator.port,
        onProgress: (event) => setEvents((previous) => [...previous, event]),
      });
      const runPayload = toRunPayload(result.payload);
      setPayload(runPayload);

      // A version the contract would refuse is left out rather than failing the submission.
      const reported = connection.identity.firmwareVersion;
      const firmwareVersion = zFirmwareVersion.safeParse(reported).success ? reported : undefined;

      const created = await createRun.mutateAsync({
        deviceId: device.id,
        definitionId: definition.data.id,
        payload: runPayload,
        firmwareVersion,
        preInfo: { ...connection.identity.raw },
      });
      setRun(created);
      setStep("review");
    } catch (error) {
      setCaptureError(error instanceof Error ? error.message : String(error));
    } finally {
      // A lamp left driven after an aborted sweep is what a bench must never see.
      await rigRef.current.rest();
      isCapturingRef.current = false;
      setIsCapturing(false);
    }
  }, [connection, createRun, definition.data, device.id, operator.port]);

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

  function renderStepHeader() {
    return (
      <ol className="text-muted-foreground flex flex-wrap gap-x-4 gap-y-1 text-xs">
        {STEP_ORDER.map((name, index) => (
          <li
            key={name}
            className={index === stepIndex ? "text-foreground font-medium" : undefined}
            aria-current={index === stepIndex ? "step" : undefined}
          >
            {index + 1}. {t(`iot.calibration.steps.${name}`)}
          </li>
        ))}
      </ol>
    );
  }

  function renderChoose() {
    return (
      <div className="space-y-4">
        <p className="text-muted-foreground text-sm">{t("iot.calibration.choose.hint")}</p>
        <CalibrationDefinitionPicker
          definitions={definitions.data}
          isLoading={definitions.isLoading}
          isError={definitions.isError}
          selectedId={definitionId}
          onSelect={setDefinitionId}
        />
        <div className="flex gap-2">
          <Button
            type="button"
            onClick={() => setStep("connect")}
            disabled={definitionId === null || !hasDefinition}
          >
            {t("iot.calibration.cta.next")}
          </Button>
          <Button type="button" variant="outline" onClick={() => void closeWizard()}>
            {t("iot.calibration.cta.cancel")}
          </Button>
        </div>
      </div>
    );
  }

  function renderConnect() {
    return (
      <div className="space-y-4">
        <CalibrationConnectStep
          family={family}
          connection={connection}
          isConnecting={connections.isConnecting}
          error={connections.error}
          rig={rig}
          onConnect={() => void connections.connect("serial")}
          onDisconnect={() => void connections.disconnectAll()}
        />
        <div className="flex gap-2">
          <Button type="button" onClick={() => setStep("capture")} disabled={!canLeaveConnectStep}>
            {t("iot.calibration.cta.next")}
          </Button>
          <Button type="button" variant="outline" onClick={() => setStep("choose")}>
            {t("iot.calibration.cta.back")}
          </Button>
        </div>
      </div>
    );
  }

  function renderCapture() {
    return (
      <div className="space-y-4">
        {operator.pending !== null && <CalibrationOperatorPrompt request={operator.pending} />}
        <CalibrationCaptureProgress events={events} isRunning={isCapturing} />
        {isCapturing && operator.pending === null && createRun.isPending && (
          <p className="text-muted-foreground flex items-center gap-2 text-sm">
            <Loader2 className="size-4 animate-spin" aria-hidden />
            {t("iot.calibration.capture.submitting")}
          </p>
        )}
        {captureError !== null && (
          <div className="space-y-3">
            <Alert variant="destructive">
              <AlertDescription>
                {t("iot.calibration.capture.aborted")}
                <span className="mt-1 block font-mono text-xs">{captureError}</span>
              </AlertDescription>
            </Alert>
            <div className="flex gap-2">
              <Button type="button" onClick={retryCapture}>
                {t("iot.calibration.capture.retry")}
              </Button>
              <Button type="button" variant="outline" onClick={() => void closeWizard()}>
                {t("iot.calibration.cta.cancel")}
              </Button>
            </div>
          </div>
        )}
      </div>
    );
  }

  function renderReview() {
    if (!run || !payload) return null;
    return (
      <CalibrationReview
        run={run}
        payload={payload}
        active={active.data ?? null}
        isApproving={approveRun.isPending}
        isRejecting={rejectRun.isPending}
        onApprove={() => void approve()}
        onReject={() => void reject()}
      />
    );
  }

  function renderWrite() {
    if (!applied) return null;
    return (
      <div className="space-y-4">
        {operator.pending !== null && <CalibrationOperatorPrompt request={operator.pending} />}
        <CalibrationWriteStep
          applied={applied}
          canWrite={writableFamily !== null && canWriteCalibration(writableFamily, applied.blocks)}
          results={writeResults}
          isWriting={isWriting}
          error={writeError}
          verifyEvents={verifyEvents}
          isVerifying={isVerifying}
          verification={verification}
          verificationError={verificationError}
          onWrite={() => void write()}
          onFinish={() => setStep("done")}
        />
      </div>
    );
  }

  function renderDone() {
    const isApproved = applied !== null;
    const isWritten = writeResults !== null && Object.values(writeResults).every((r) => r.verified);
    const hint = !isApproved
      ? t("iot.calibration.done.rejectedHint")
      : isWritten
        ? t("iot.calibration.done.writtenHint")
        : t("iot.calibration.done.notWrittenHint");
    return (
      <div className="space-y-4">
        <p className="text-sm">{hint}</p>
        <Button type="button" onClick={() => void closeWizard()}>
          {t("iot.calibration.done.close")}
        </Button>
      </div>
    );
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

  return (
    <PanelCard title={t(`iot.calibration.steps.${step}`)}>
      <div className="space-y-6">
        {renderStepHeader()}
        {renderStep()}
      </div>
    </PanelCard>
  );
}
