import React from "react";
import { ScrollView } from "react-native";

import type { CalibrationProtocol } from "../../../domain/calibration-protocol";
import { useCalibrationFlow } from "../../../hooks/use-calibration-flow";
import { CompletionStep } from "./CompletionStep";
import { DemoDisclaimer } from "./DemoDisclaimer";
import { GainCalibrationStep } from "./GainCalibrationStep";
import { MeasurementsStep } from "./MeasurementsStep";
import { ProcessingStep } from "./ProcessingStep";
import { SetupStep } from "./SetupStep";

interface CalibrationFlowProps {
  protocol: CalibrationProtocol;
}

// Pure render switch over the calibration view-model; state, side effects
// and toasts live in useCalibrationFlow.
export function CalibrationFlow({ protocol }: CalibrationFlowProps) {
  const flow = useCalibrationFlow(protocol);

  const renderCurrentStep = () => {
    switch (flow.currentStep) {
      case "setup":
        return <SetupStep onStartCalibration={flow.startCalibration} />;

      case "gain":
        return (
          <GainCalibrationStep
            alertMessage={flow.gainAlertMessage}
            isProcessing={flow.isProcessing}
            onStartGainCalibration={flow.startGainCalibration}
          />
        );

      case "measurements":
        return (
          <MeasurementsStep
            currentMeasurementIndex={flow.currentMeasurementIndex}
            totalMeasurements={flow.totalMeasurements}
            currentPanelNumber={flow.currentPanelNumber}
            prompt={flow.currentPrompt}
            currentUserInput={flow.currentUserInput}
            isProcessing={flow.isProcessing}
            progressPercentage={flow.progressPercentage}
            onUserInputChange={flow.setUserInput}
            onTakeMeasurement={flow.takeMeasurement}
            onCancelMeasurement={flow.cancelMeasurement}
          />
        );

      case "processing":
        return <ProcessingStep />;

      case "complete":
        return (
          <CompletionStep
            measurements={flow.measurements}
            processedOutput={flow.processedOutput}
            onStartNewCalibration={flow.reset}
          />
        );

      default:
        return <SetupStep onStartCalibration={flow.startCalibration} />;
    }
  };

  return (
    <ScrollView className="bg-background flex-1" contentContainerStyle={{ padding: 16 }}>
      <DemoDisclaimer />
      {renderCurrentStep()}
    </ScrollView>
  );
}
