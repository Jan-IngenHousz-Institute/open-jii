import React from "react";
import { ScrollView, Text, View, StyleSheet } from "react-native";
import { useTheme } from "~/hooks/use-theme";
import { Chart } from "./chart";
import { KeyValue } from "./key-value";
import { MeasurementHeader } from "./measurement-header";

interface MeasurementOutputPreviewProps {
  output: any[];
  timestamp?: string;
  onClose: () => void;
  experimentName?: string;
}

export function MeasurementOutputPreview({
  output: outputs,
  timestamp,
  onClose,
  experimentName,
}: MeasurementOutputPreviewProps) {
  const theme = useTheme();
  const { colors } = theme;

  // Validate data
  if (!outputs || outputs.length === 0) {
    return (
      <View
        style={[
          styles.fullScreenContainer,
          {
            backgroundColor: theme.isDark ? colors.dark.background : colors.light.background,
          },
        ]}
      >
        <MeasurementHeader timestamp={timestamp} experimentName={experimentName} onClose={onClose} />
        <View style={styles.noDataContainer}>
          <Text style={styles.noDataText}>No Data Available</Text>
        </View>
      </View>
    );
  }

  return (
    <View
      style={[
        styles.fullScreenContainer,
        {
          backgroundColor: theme.isDark ? colors.dark.background : colors.light.background,
        },
      ]}
    >
      <MeasurementHeader timestamp={timestamp} experimentName={experimentName} onClose={onClose} />

      <ScrollView style={styles.scrollContainer} showsVerticalScrollIndicator={true}>
        <View style={styles.content}>
          {outputs.map((output, outputIndex) =>
            Object.keys(output).map((key) => {
              const value = output[key];
              if (typeof value === "string" || typeof value === "number") {
                return <KeyValue key={`${outputIndex}-${key}`} value={value} name={key} />;
              }
              if (Array.isArray(value) && typeof value[0] === "number") {
                return <Chart key={`${outputIndex}-${key}`} name={key} values={value} />;
              }
              return null;
            }),
          )}
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  fullScreenContainer: {
    flex: 1,
  },
  scrollContainer: {
    flex: 1,
  },
  content: {
    padding: 16,
  },
  noDataContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    padding: 24,
  },
  noDataText: {
    fontSize: 18,
    textAlign: "center",
    color: "#666",
  },
});