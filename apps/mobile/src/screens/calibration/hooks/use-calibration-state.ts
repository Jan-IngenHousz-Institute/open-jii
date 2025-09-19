import { useState } from "react";
import { useToast } from "~/context/toast-context";

import {
  CalibrationStep,
  MeasurementData,
  ProcessedCalibrationOutput,
  getSpadSteps,
  getGainStep,
  generateAutoBlankCommands,
  generateMeasurementCommand,
  simulateDataProcessing,
} from "../utils/calibration-protocol";

export function useCalibrationState() {
  const { showToast } = useToast();

  const [currentStep, setCurrentStep] = useState<CalibrationStep>("setup");
  const [isProcessing, setIsProcessing] = useState(false);
  const [measurements, setMeasurements] = useState<MeasurementData[]>([]);
  const [currentMeasurementIndex, setCurrentMeasurementIndex] = useState(0);
  const [currentSpadValue, setCurrentSpadValue] = useState("");
  const [processedOutput, setProcessedOutput] = useState<ProcessedCalibrationOutput | null>(null);

  const spadSteps = getSpadSteps();
  const gainStep = getGainStep();

  const handleStartCalibration = () => {
    console.log("Starting calibration process...");
    setCurrentStep("gain");
    setMeasurements([]);
    setCurrentMeasurementIndex(0);
    setProcessedOutput(null);
    showToast("Calibration started. Please follow the instructions.", "info");
  };

  const handleGainCalibration = async () => {
    console.log("Starting gain calibration (auto-blanking)...");
    console.log("Auto-blank parameters:", gainStep?.auto_blank);

    // Generate auto-blank commands
    const autoBlankCommands = gainStep?.auto_blank
      ? generateAutoBlankCommands(gainStep.auto_blank)
      : [];

    console.log("Sending auto-blank commands to device:", autoBlankCommands);

    // Simulate device processing time
    setIsProcessing(true);
    await new Promise((resolve) => setTimeout(resolve, 2000));
    setIsProcessing(false);

    console.log("Gain calibration completed");
    setCurrentStep("measurements");
    showToast("Gain calibration completed. Proceeding to measurements.", "success");
  };

  const handleMeasurement = async (panelNumber: number) => {
    console.log(`Taking measurement for panel #${panelNumber}...`);
    const currentStepData = spadSteps[currentMeasurementIndex];
    console.log("SPAD parameters:", currentStepData?.spad);

    // Generate measurement command
    const measurementCommand = currentStepData?.spad
      ? generateMeasurementCommand(currentStepData.spad)
      : "";
    console.log("Sending measurement command to device:", measurementCommand);

    // Simulate device processing time
    setIsProcessing(true);
    await new Promise((resolve) => setTimeout(resolve, 1500));
    setIsProcessing(false);

    // Store measurement data
    const measurementData: MeasurementData = {
      panelNumber,
      spadValue: currentSpadValue,
      measurementData: {
        // Simulated measurement data
        absorbance: [
          [Math.random() * 1000, Math.random() * 1000],
          [Math.random() * 1000, Math.random() * 1000],
        ],
        timestamp: new Date().toISOString(),
      },
    };

    setMeasurements((prev) => [...prev, measurementData]);
    setCurrentSpadValue("");

    console.log(`Measurement completed for panel #${panelNumber}:`, measurementData);

    if (currentMeasurementIndex < spadSteps.length - 1) {
      setCurrentMeasurementIndex((prev) => prev + 1);
      const nextPanelNumber = spadSteps[currentMeasurementIndex + 1]?.prompt?.match(/#(\d+)/)?.[1];
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
      const output = await simulateDataProcessing(measurements);
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
    setCurrentSpadValue("");
    setIsProcessing(false);
    setProcessedOutput(null);
  };

  const getCurrentPanelNumber = () => {
    const currentStepData = spadSteps[currentMeasurementIndex];
    return currentStepData?.prompt?.match(/#(\d+)/)?.[1];
  };

  const getProgressPercentage = () => {
    return ((currentMeasurementIndex + 1) / spadSteps.length) * 100;
  };

  const isLastMeasurement = () => {
    return currentMeasurementIndex >= spadSteps.length - 1;
  };

  return {
    // State
    currentStep,
    isProcessing,
    measurements,
    currentMeasurementIndex,
    currentSpadValue,
    processedOutput,
    spadSteps,
    gainStep,

    // Computed values
    currentPanelNumber: getCurrentPanelNumber(),
    progressPercentage: getProgressPercentage(),
    isLastMeasurement: isLastMeasurement(),

    // Actions
    setCurrentSpadValue,
    handleStartCalibration,
    handleGainCalibration,
    handleMeasurement,
    handleReset,
  };
}
