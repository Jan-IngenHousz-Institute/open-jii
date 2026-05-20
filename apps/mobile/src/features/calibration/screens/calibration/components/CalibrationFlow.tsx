import React, { useState } from "react";
import { ScrollView } from "react-native";
import { toast } from "sonner-native";
import { useTranslation } from "~/shared/i18n";
import { createLogger } from "~/shared/utils/logger";

import {
  CalibrationProtocol,
  MeasurementData,
  ProcessedCalibrationOutput,
  generateDeviceCommand,
  simulateDataProcessing,
} from "../utils/load-protocol";

const log = createLogger("calibration");
import { CompletionStep } from "./CompletionStep";
import { DemoDisclaimer } from "./DemoDisclaimer";
import { GainCalibrationStep } from "./GainCalibrationStep";
import { MeasurementsStep } from "./MeasurementsStep";
import { ProcessingStep } from "./ProcessingStep";
import { SetupStep } from "./SetupStep";

export type CalibrationStep = "setup" | "gain" | "measurements" | "processing" | "complete";

interface CalibrationFlowProps {
  protocol: CalibrationProtocol;
}

export function CalibrationFlow({ protocol }: CalibrationFlowProps) {
  const { t } = useTranslation(["common", "calibration"]);
  const [currentStep, setCurrentStep] = useState<CalibrationStep>("setup");
  const [isProcessing, setIsProcessing] = useState(false);
  const [measurements, setMeasurements] = useState<MeasurementData[]>([]);
  const [currentMeasurementIndex, setCurrentMeasurementIndex] = useState(0);
  const [currentUserInput, setCurrentUserInput] = useState("");
  const [processedOutput, setProcessedOutput] = useState<ProcessedCalibrationOutput | null>(null);

  // Extract steps from protocol
  const measurementSteps = protocol._protocol_set_.filter((step) => step.label === "spad");
  const gainStep = protocol._protocol_set_.find((step) => step.label === "gain");

  const handleStartCalibration = () => {
    log.info("start");
    setCurrentStep("gain");
    setMeasurements([]);
    setCurrentMeasurementIndex(0);
    setProcessedOutput(null);
  };

  const handleGainCalibration = async () => {
    if (!gainStep) return;

    log.info("gain calibration start", { auto_blank: gainStep.auto_blank });

    const deviceCommand = generateDeviceCommand(gainStep);
    log.debug("auto-blank command", { deviceCommand });

    setIsProcessing(true);
    await new Promise<void>((resolve) => setTimeout(() => resolve(), 2000));
    setIsProcessing(false);

    log.info("gain calibration done");
    setCurrentStep("measurements");
  };

  const handleMeasurement = async (panelNumber: number) => {
    const currentStepData = measurementSteps[currentMeasurementIndex];
    if (!currentStepData) return;

    log.info("measurement start", { panel: panelNumber, spad: currentStepData.spad });

    const deviceCommand = generateDeviceCommand(currentStepData);
    log.debug("measurement command", { deviceCommand });

    // Simulate device processing time
    setIsProcessing(true);
    await new Promise<void>((resolve) => setTimeout(() => resolve(), 1500));
    setIsProcessing(false);

    // Store measurement data
    const measurementData: MeasurementData = {
      stepIndex: currentMeasurementIndex,
      userInput: currentUserInput,
      measurementData: {
        // Simulated measurement data
        absorbance: [
          [Math.random() * 1000, Math.random() * 1000],
          [Math.random() * 1000, Math.random() * 1000],
        ],
        timestamp: new Date().toISOString(),
      },
      timestamp: new Date().toISOString(),
    };

    setMeasurements((prev) => [...prev, measurementData]);
    setCurrentUserInput("");

    log.info("measurement done", { panel: panelNumber });

    if (currentMeasurementIndex < measurementSteps.length - 1) {
      setCurrentMeasurementIndex((prev) => prev + 1);
    } else {
      setCurrentStep("processing");
      handleDataProcessing();
    }
  };

  const handleDataProcessing = async () => {
    log.info("processing", { measurement_count: measurements.length });

    setIsProcessing(true);

    try {
      const output = await simulateDataProcessing(measurements, protocol);
      setProcessedOutput(output);

      log.debug("processed output", { device_commands: output.toDevice });
      await new Promise<void>((resolve) => setTimeout(() => resolve(), 1000));

      setCurrentStep("complete");
      toast.success(t("calibration:flow.toastComplete"));
    } catch (error) {
      log.error("processing failed", { err: (error as Error)?.message });
      toast.error(t("calibration:flow.toastProcessingError"));
    } finally {
      setIsProcessing(false);
    }
  };

  const handleReset = () => {
    setCurrentStep("setup");
    setMeasurements([]);
    setCurrentMeasurementIndex(0);
    setCurrentUserInput("");
    setIsProcessing(false);
    setProcessedOutput(null);
  };

  const getCurrentPanelNumber = () => {
    const currentStepData = measurementSteps[currentMeasurementIndex];
    return currentStepData?.prompt?.match(/#(\d+)/)?.[1];
  };

  const getProgressPercentage = () => {
    return ((currentMeasurementIndex + 1) / measurementSteps.length) * 100;
  };

  const renderCurrentStep = () => {
    switch (currentStep) {
      case "setup":
        return <SetupStep onStartCalibration={handleStartCalibration} />;

      case "gain":
        return (
          <GainCalibrationStep
            alertMessage={gainStep?.alert ?? ""}
            isProcessing={isProcessing}
            onStartGainCalibration={handleGainCalibration}
          />
        );

      case "measurements":
        return (
          <MeasurementsStep
            currentMeasurementIndex={currentMeasurementIndex}
            totalMeasurements={measurementSteps.length}
            currentPanelNumber={getCurrentPanelNumber()}
            prompt={measurementSteps[currentMeasurementIndex]?.prompt ?? ""}
            currentUserInput={currentUserInput}
            isProcessing={isProcessing}
            progressPercentage={getProgressPercentage()}
            onUserInputChange={setCurrentUserInput}
            onTakeMeasurement={handleMeasurement}
            onCancelMeasurement={() => log.info("measurement cancelled")}
          />
        );

      case "processing":
        return <ProcessingStep />;

      case "complete":
        return (
          <CompletionStep
            measurements={measurements}
            processedOutput={processedOutput}
            onStartNewCalibration={handleReset}
          />
        );

      default:
        return <SetupStep onStartCalibration={handleStartCalibration} />;
    }
  };

  return (
    <ScrollView className="bg-background flex-1" contentContainerStyle={{ padding: 16 }}>
      <DemoDisclaimer />
      {renderCurrentStep()}
    </ScrollView>
  );
}
