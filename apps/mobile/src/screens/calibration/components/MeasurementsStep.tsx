import React from "react";
import { View, Text, StyleSheet, TextInput } from "react-native";
import { Button } from "~/components/Button";
import { Card } from "~/components/Card";
import { useTheme } from "~/hooks/use-theme";

interface MeasurementsStepProps {
  currentMeasurementIndex: number;
  totalMeasurements: number;
  currentPanelNumber: string | undefined;
  prompt: string;
  currentSpadValue: string;
  isProcessing: boolean;
  progressPercentage: number;
  onSpadValueChange: (value: string) => void;
  onTakeMeasurement: (panelNumber: number) => void;
}

export function MeasurementsStep({
  currentMeasurementIndex,
  totalMeasurements,
  currentPanelNumber,
  prompt,
  currentSpadValue,
  isProcessing,
  progressPercentage,
  onSpadValueChange,
  onTakeMeasurement,
}: MeasurementsStepProps) {
  const theme = useTheme();
  const { colors } = theme;

  const handleTakeMeasurement = () => {
    if (currentPanelNumber) {
      onTakeMeasurement(parseInt(currentPanelNumber));
    }
  };

  return (
    <View style={styles.stepContainer}>
      <Text
        style={[
          styles.stepTitle,
          { color: theme.isDark ? colors.dark.onSurface : colors.light.onSurface },
        ]}
      >
        SPAD Measurements ({currentMeasurementIndex + 1}/{totalMeasurements})
      </Text>
      <Text
        style={[
          styles.stepDescription,
          { color: theme.isDark ? colors.dark.inactive : colors.light.inactive },
        ]}
      >
        {prompt}
      </Text>

      <Card style={styles.measurementCard}>
        <Text
          style={[
            styles.measurementLabel,
            { color: theme.isDark ? colors.dark.onSurface : colors.light.onSurface },
          ]}
        >
          Panel #{currentPanelNumber} SPAD Value:
        </Text>
        <TextInput
          style={[
            styles.spadInput,
            {
              backgroundColor: theme.isDark ? colors.dark.surface : colors.light.surface,
              color: theme.isDark ? colors.dark.onSurface : colors.light.onSurface,
              borderColor: theme.isDark ? colors.dark.border : colors.light.border,
            },
          ]}
          value={currentSpadValue}
          onChangeText={onSpadValueChange}
          placeholder="Enter SPAD value"
          placeholderTextColor={theme.isDark ? colors.dark.inactive : colors.light.inactive}
          keyboardType="numeric"
        />
      </Card>

      <Button
        title={isProcessing ? "Measuring..." : "Take Measurement"}
        onPress={handleTakeMeasurement}
        isLoading={isProcessing}
        isDisabled={!currentSpadValue.trim()}
        style={styles.actionButton}
      />

      <View style={styles.progressContainer}>
        <View
          style={[
            styles.progressBar,
            { backgroundColor: theme.isDark ? colors.dark.border : colors.light.border },
          ]}
        >
          <View
            style={[
              styles.progressFill,
              {
                backgroundColor: colors.primary.dark,
                width: `${progressPercentage}%`,
              },
            ]}
          />
        </View>
        <Text
          style={[
            styles.progressText,
            { color: theme.isDark ? colors.dark.inactive : colors.light.inactive },
          ]}
        >
          {currentMeasurementIndex + 1} of {totalMeasurements} measurements completed
        </Text>
      </View>
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
  measurementCard: {
    marginBottom: 24,
  },
  measurementLabel: {
    fontSize: 16,
    fontWeight: "600",
    marginBottom: 12,
  },
  spadInput: {
    borderWidth: 1,
    borderRadius: 8,
    padding: 12,
    fontSize: 16,
  },
  progressContainer: {
    marginTop: 24,
  },
  progressBar: {
    height: 8,
    borderRadius: 4,
    marginBottom: 8,
  },
  progressFill: {
    height: "100%",
    borderRadius: 4,
  },
  progressText: {
    fontSize: 14,
    textAlign: "center",
  },
  actionButton: {
    marginTop: 16,
  },
});
