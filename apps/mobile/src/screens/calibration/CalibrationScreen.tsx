import React from "react";
import { ScrollView, StyleSheet } from "react-native";
import { useTheme } from "~/hooks/use-theme";

import { CompletionStep } from "./components/CompletionStep";
import { GainCalibrationStep } from "./components/GainCalibrationStep";
import { MeasurementsStep } from "./components/MeasurementsStep";
import { ProcessingStep } from "./components/ProcessingStep";
import { SetupStep } from "./components/SetupStep";
import { useCalibrationState } from "./hooks/use-calibration-state";

export function CalibrationScreen() {
  const theme = useTheme();
  const { colors } = theme;

  const {
    currentStep,
    isProcessing,
    measurements,
    currentMeasurementIndex,
    currentSpadValue,
    processedOutput,
    spadSteps,
    gainStep,
    currentPanelNumber,
    progressPercentage,
    setCurrentSpadValue,
    handleStartCalibration,
    handleGainCalibration,
    handleMeasurement,
    handleReset,
  } = useCalibrationState();

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
            totalMeasurements={spadSteps.length}
            currentPanelNumber={currentPanelNumber}
            prompt={spadSteps[currentMeasurementIndex]?.prompt ?? ""}
            currentSpadValue={currentSpadValue}
            isProcessing={isProcessing}
            progressPercentage={progressPercentage}
            onSpadValueChange={setCurrentSpadValue}
            onTakeMeasurement={handleMeasurement}
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
