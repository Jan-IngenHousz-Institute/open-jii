import React from "react";
import { View, Text, StyleSheet } from "react-native";
import { Button } from "~/components/Button";
import { useTheme } from "~/hooks/use-theme";

interface SetupStepProps {
  onStartCalibration: () => void;
}

export function SetupStep({ onStartCalibration }: SetupStepProps) {
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
        Device Calibration Setup
      </Text>
      <Text
        style={[
          styles.stepDescription,
          { color: theme.isDark ? colors.dark.inactive : colors.light.inactive },
        ]}
      >
        This calibration process will help ensure accurate device measurements. You'll need:
      </Text>
      <View style={styles.requirementsList}>
        <Text
          style={[
            styles.requirementItem,
            { color: theme.isDark ? colors.dark.onSurface : colors.light.onSurface },
          ]}
        >
          • MultispeQ device connected
        </Text>
        <Text
          style={[
            styles.requirementItem,
            { color: theme.isDark ? colors.dark.onSurface : colors.light.onSurface },
          ]}
        >
          • Chlorophyll calibration cards (panels #2, #3, #4, #6, #7, #8, #10, #11, #12)
        </Text>
        <Text
          style={[
            styles.requirementItem,
            { color: theme.isDark ? colors.dark.onSurface : colors.light.onSurface },
          ]}
        >
          • Known reference values for each calibration card
        </Text>
      </View>
      <Button title="Start Calibration" onPress={onStartCalibration} style={styles.actionButton} />
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
  requirementsList: {
    marginBottom: 24,
  },
  requirementItem: {
    fontSize: 16,
    marginBottom: 8,
    lineHeight: 22,
  },
  actionButton: {
    marginTop: 16,
  },
});
