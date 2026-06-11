import { useState } from "react";
import { toast } from "sonner-native";
import { useTranslation } from "~/shared/i18n";
import { createLogger } from "~/shared/observability/logger";

import type { CalibrationProtocol, MeasurementData } from "../domain/calibration-protocol";
import { generateDeviceCommand, simulateDataProcessing } from "../domain/calibration-protocol";
import type { CalibrationState } from "../domain/calibration-transitions";
import {
  gainCompletedState,
  initialCalibrationState,
  measurementProgress,
  measurementRecordedState,
  panelNumberFromPrompt,
  processingFailedState,
  processingStartedState,
  processingSucceededState,
  resetCalibrationState,
  startCalibrationState,
  userInputChangedState,
} from "../domain/calibration-transitions";

const log = createLogger("calibration");

const delay = (ms: number) => new Promise<void>((resolve) => setTimeout(() => resolve(), ms));

// View-model for CalibrationFlow: owns the wizard state (pure transitions over
// useState), the simulated device/processing side effects and the result
// toasts, so the component is a pure render switch over the returned state.
export function useCalibrationFlow(protocol: CalibrationProtocol) {
  const { t } = useTranslation(["common", "calibration"]);
  const [state, setState] = useState<CalibrationState>(initialCalibrationState);

  const measurementSteps = protocol._protocol_set_.filter((step) => step.label === "spad");
  const gainStep = protocol._protocol_set_.find((step) => step.label === "gain");

  const apply = (patch: Partial<CalibrationState>) => setState((prev) => ({ ...prev, ...patch }));

  const startCalibration = () => {
    log.info("start");
    apply(startCalibrationState());
  };

  const startGainCalibration = async () => {
    if (!gainStep) return;
    log.info("gain calibration start", { auto_blank: gainStep.auto_blank });
    log.debug("auto-blank command", { deviceCommand: generateDeviceCommand(gainStep) });

    // Simulated device auto-blanking (demo mode).
    apply(processingStartedState());
    await delay(2000);
    apply(gainCompletedState());
    log.info("gain calibration done");
  };

  const processData = async (measurements: MeasurementData[]) => {
    log.info("processing", { measurement_count: measurements.length });
    apply(processingStartedState());
    try {
      const output = await simulateDataProcessing(measurements, protocol);
      log.debug("processed output", { device_commands: output.toDevice });
      await delay(1000);
      apply(processingSucceededState(output));
      toast.success(t("calibration:flow.toastComplete"));
    } catch (error) {
      log.error("processing failed", { err: (error as Error)?.message });
      apply(processingFailedState());
      toast.error(t("calibration:flow.toastProcessingError"));
    }
  };

  const takeMeasurement = async (panelNumber: number) => {
    const stepData = measurementSteps[state.currentMeasurementIndex];
    if (!stepData) return;

    log.info("measurement start", { panel: panelNumber, spad: stepData.spad });
    log.debug("measurement command", { deviceCommand: generateDeviceCommand(stepData) });

    // Simulated device measurement (demo mode).
    apply(processingStartedState());
    await delay(1500);

    const measurement: MeasurementData = {
      stepIndex: state.currentMeasurementIndex,
      userInput: state.currentUserInput,
      measurementData: {
        absorbance: [
          [Math.random() * 1000, Math.random() * 1000],
          [Math.random() * 1000, Math.random() * 1000],
        ],
        timestamp: new Date().toISOString(),
      },
      timestamp: new Date().toISOString(),
    };

    const patch = measurementRecordedState(state, measurement, measurementSteps.length);
    apply(patch);
    log.info("measurement done", { panel: panelNumber });

    if (patch.currentStep === "processing") {
      await processData(patch.measurements ?? []);
    }
  };

  // Legacy behavior: cancel only logs; the simulated measurement still completes.
  const cancelMeasurement = () => {
    log.info("measurement cancelled");
  };

  const setUserInput = (value: string) => apply(userInputChangedState(value));

  const reset = () => apply(resetCalibrationState());

  const currentMeasurementStep = measurementSteps[state.currentMeasurementIndex];

  return {
    ...state,
    gainAlertMessage: gainStep?.alert ?? "",
    totalMeasurements: measurementSteps.length,
    currentPrompt: currentMeasurementStep?.prompt ?? "",
    currentPanelNumber: panelNumberFromPrompt(currentMeasurementStep?.prompt),
    progressPercentage: measurementProgress(state, measurementSteps.length),
    startCalibration,
    startGainCalibration,
    takeMeasurement,
    cancelMeasurement,
    setUserInput,
    reset,
  };
}
