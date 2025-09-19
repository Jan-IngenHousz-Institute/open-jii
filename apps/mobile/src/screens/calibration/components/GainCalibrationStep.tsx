import React from "react";
import { View, Text, StyleSheet } from "react-native";
import { Button } from "~/components/Button";
import { Card } from "~/components/Card";
import { useTheme } from "~/hooks/use-theme";

interface GainCalibrationStepProps {
  alertMessage: string;
  isProcessing: boolean;
  onStartGainCalibration: () => void;
}

export function GainCalibrationStep({
  alertMessage,
  isProcessing,
  onStartGainCalibration,
}: GainCalibrationStepProps) {
  const theme = useTheme();
  const { colors } = theme;

  return (
    <View style={styles.stepContainer}>
      <Text
        style={[
          styles.stepTitle,
          { color: theme.isDark ? colors.dark.onSurface : colors.light.onSurface },
        ]}
      >
        Gain Calibration (Auto-blanking)
      </Text>
      <Text
        style={[
          styles.stepDescription,
          { color: theme.isDark ? colors.dark.inactive : colors.light.inactive },
        ]}
      >
        {alertMessage}
      </Text>
      <Card style={styles.instructionCard}>
        <Text
          style={[
            styles.instructionText,
            { color: theme.isDark ? colors.dark.onSurface : colors.light.onSurface },
          ]}
        >
          The device will now perform auto-blanking to establish baseline readings for each LED
          channel.
        </Text>
      </Card>
      <Button
        title={isProcessing ? "Calibrating..." : "Start Auto-blanking"}
        onPress={onStartGainCalibration}
        isLoading={isProcessing}
        style={styles.actionButton}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  stepContainer: {
    flex: 1,
  },
  stepTitle: {
    fontSize: 24,
    fontWeight: "bold",
    marginBottom: 8,
  },
  stepDescription: {
    fontSize: 16,
    marginBottom: 24,
    lineHeight: 24,
  },
  instructionCard: {
    marginBottom: 24,
  },
  instructionText: {
    fontSize: 16,
    lineHeight: 22,
  },
  actionButton: {
    marginTop: 16,
  },
});
