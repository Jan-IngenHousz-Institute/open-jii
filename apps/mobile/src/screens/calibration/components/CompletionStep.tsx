import React from "react";
import { View, Text, StyleSheet } from "react-native";
import { Button } from "~/components/Button";
import { Card } from "~/components/Card";
import { useTheme } from "~/hooks/use-theme";

import { ProcessedCalibrationOutput } from "../utils/calibration-protocol";

interface CompletionStepProps {
  measurements: any[];
  processedOutput: ProcessedCalibrationOutput | null;
  onStartNewCalibration: () => void;
}

export function CompletionStep({
  measurements,
  processedOutput,
  onStartNewCalibration,
}: CompletionStepProps) {
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
        Calibration Complete!
      </Text>
      <Text
        style={[
          styles.stepDescription,
          { color: theme.isDark ? colors.dark.inactive : colors.light.inactive },
        ]}
      >
        Your MultispeQ device has been successfully calibrated and is ready for measurements.
      </Text>

      <Card style={styles.resultsCard}>
        <Text
          style={[
            styles.resultsTitle,
            { color: theme.isDark ? colors.dark.onSurface : colors.light.onSurface },
          ]}
        >
          Calibration Results
        </Text>
        <View style={styles.resultsRow}>
          <Text
            style={[
              styles.resultsLabel,
              { color: theme.isDark ? colors.dark.inactive : colors.light.inactive },
            ]}
          >
            Measurements Taken:
          </Text>
          <Text
            style={[
              styles.resultsValue,
              { color: theme.isDark ? colors.dark.onSurface : colors.light.onSurface },
            ]}
          >
            {measurements.length}
          </Text>
        </View>
        <View style={styles.resultsRow}>
          <Text
            style={[
              styles.resultsLabel,
              { color: theme.isDark ? colors.dark.inactive : colors.light.inactive },
            ]}
          >
            Calibration Quality:
          </Text>
          <Text style={[styles.resultsValue, { color: colors.semantic.success }]}>
            Excellent (R² = {processedOutput?.maxR2 ?? 0.98})
          </Text>
        </View>
        {processedOutput && (
          <>
            <View style={styles.resultsRow}>
              <Text
                style={[
                  styles.resultsLabel,
                  { color: theme.isDark ? colors.dark.inactive : colors.light.inactive },
                ]}
              >
                Offset:
              </Text>
              <Text
                style={[
                  styles.resultsValue,
                  { color: theme.isDark ? colors.dark.onSurface : colors.light.onSurface },
                ]}
              >
                {processedOutput.bestOffset}
              </Text>
            </View>
            <View style={styles.resultsRow}>
              <Text
                style={[
                  styles.resultsLabel,
                  { color: theme.isDark ? colors.dark.inactive : colors.light.inactive },
                ]}
              >
                Slope:
              </Text>
              <Text
                style={[
                  styles.resultsValue,
                  { color: theme.isDark ? colors.dark.onSurface : colors.light.onSurface },
                ]}
              >
                {processedOutput.spadSlope}
              </Text>
            </View>
          </>
        )}
      </Card>

      <Button
        title="Start New Calibration"
        onPress={onStartNewCalibration}
        variant="outline"
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
  resultsCard: {
    marginBottom: 24,
  },
  resultsTitle: {
    fontSize: 18,
    fontWeight: "bold",
    marginBottom: 16,
  },
  resultsRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginBottom: 8,
  },
  resultsLabel: {
    fontSize: 16,
  },
  resultsValue: {
    fontSize: 16,
    fontWeight: "600",
  },
  actionButton: {
    marginTop: 16,
  },
});
