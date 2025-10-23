import React, { useState } from "react";
import { ScrollView, StyleSheet } from "react-native";
import { useToast } from "~/context/toast-context";
import { useTheme } from "~/hooks/use-theme";

import {
  CalibrationProtocol,
  MeasurementData,
  ProcessedCalibrationOutput,
  generateDeviceCommand,
  simulateDataProcessing,
} from "../utils/load-protocol";
import { CompletionStep } from "./CompletionStep";
import { GainCalibrationStep } from "./GainCalibrationStep";
import { MeasurementsStep } from "./MeasurementsStep";
import { ProcessingStep } from "./ProcessingStep";
import { SetupStep } from "./SetupStep";

export type CalibrationStep = "setup" | "gain" | "measurements" | "processing" | "complete";

interface CalibrationFlowProps {
  protocol: CalibrationProtocol;
}

export function CalibrationFlow({ protocol }: CalibrationFlowProps) {
  const theme = useTheme();
  const { colors } = theme;
  const { showToast } = useToast();

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
    console.log("Starting calibration process...");
    setCurrentStep("gain");
    setMeasurements([]);
    setCurrentMeasurementIndex(0);
    setProcessedOutput(null);
    showToast("Calibration started. Please follow the instructions.", "info");
  };

  const handleGainCalibration = async () => {
    if (!gainStep) return;

    console.log("Starting gain calibration (auto-blanking)...");
    console.log("Auto-blank parameters:", gainStep.auto_blank);

    // Generate device command
    const deviceCommand = generateDeviceCommand(gainStep);
    console.log("Sending auto-blank commands to device:", deviceCommand);

    // Simulate device processing time
    setIsProcessing(true);
    await new Promise((resolve) => setTimeout(resolve, 2000));
    setIsProcessing(false);

    console.log("Gain calibration completed");
    setCurrentStep("measurements");
    showToast("Gain calibration completed. Proceeding to measurements.", "success");
  };

  const handleMeasurement = async (panelNumber: number) => {
    const currentStepData = measurementSteps[currentMeasurementIndex];
    if (!currentStepData) return;

    console.log(`Taking measurement for panel #${panelNumber}...`);
    console.log("Measurement parameters:", currentStepData.spad);

    // Generate device command
    const deviceCommand = generateDeviceCommand(currentStepData);
    console.log("Sending measurement command to device:", deviceCommand);

    // Simulate device processing time
    setIsProcessing(true);
    await new Promise((resolve) => setTimeout(resolve, 1500));
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

    console.log(`Measurement completed for panel #${panelNumber}:`, measurementData);

    if (currentMeasurementIndex < measurementSteps.length - 1) {
      setCurrentMeasurementIndex((prev) => prev + 1);
      const nextPanelNumber =
        measurementSteps[currentMeasurementIndex + 1]?.prompt?.match(/#(\d+)/)?.[1];
      showToast(`Panel #${panelNumber} measured. Next: Panel #${nextPanelNumber}`, "info");
    } else {
      setCurrentStep("processing");
      handleDataProcessing();
    }
  };

  const handleDataProcessing = async () => {
    console.log("Processing calibration data...");
    console.log("Measurements collected:", measurements);

    setIsProcessing(true);

    try {
      const output = await simulateDataProcessing(measurements, protocol);
      setProcessedOutput(output);

      console.log("Processed calibration output:", output);

      // Simulate sending configuration commands to device
      console.log("Sending device configuration commands:", output.toDevice);
      await new Promise((resolve) => setTimeout(resolve, 1000));

      setCurrentStep("complete");
      showToast("Calibration completed successfully!", "success");
    } catch (error) {
      console.error("Error processing calibration data:", error);
      showToast("Error processing calibration data. Please try again.", "error");
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
            onCancelMeasurement={console.log}
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
    <ScrollView
      style={[
        styles.container,
        { backgroundColor: theme.isDark ? colors.dark.background : colors.light.background },
      ]}
      contentContainerStyle={styles.contentContainer}
    >
      {renderCurrentStep()}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  contentContainer: {
    padding: 16,
  },
});
