import React from "react";
import { View, Text, StyleSheet, ActivityIndicator } from "react-native";
import { Card } from "~/components/Card";
import { useTheme } from "~/hooks/use-theme";

export function ProcessingStep() {
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
        Processing Calibration Data
      </Text>
      <Text
        style={[
          styles.stepDescription,
          { color: theme.isDark ? colors.dark.inactive : colors.light.inactive },
        ]}
      >
        Analyzing measurement data and calculating calibration parameters...
      </Text>

      <Card style={styles.processingCard}>
        <ActivityIndicator size="large" color={colors.primary.dark} />
        <Text
          style={[
            styles.processingText,
            { color: theme.isDark ? colors.dark.onSurface : colors.light.onSurface },
          ]}
        >
          Please wait while we process your calibration data
        </Text>
      </Card>
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
  processingCard: {
    alignItems: "center",
    padding: 32,
  },
  processingText: {
    fontSize: 16,
    marginTop: 16,
    textAlign: "center",
  },
});
