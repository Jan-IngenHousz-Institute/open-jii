import React from "react";
import { View, Text, StyleSheet, ScrollView } from "react-native";
import { useTheme } from "~/hooks/use-theme";

interface MeasurementResultProps {
  data: any;
  timestamp?: string;
  experimentName?: string;
}

export function MeasurementResult({ data, timestamp }: MeasurementResultProps) {
  const theme = useTheme();
  const { colors } = theme;

  const formattedData = JSON.stringify(data, null, 2);

  return (
    <View
      style={[
        styles.container,
        {
          backgroundColor: theme.isDark ? colors.dark.card : colors.light.card,
        },
      ]}
    >
      <View style={styles.header}>
        {timestamp && (
          <Text
            style={[
              styles.timestamp,
              {
                color: theme.isDark ? colors.dark.inactive : colors.light.inactive,
              },
            ]}
          >
            {timestamp}
          </Text>
        )}
      </View>

      <ScrollView
        style={[
          styles.dataContainer,
          {
            backgroundColor: theme.isDark ? colors.dark.background : colors.light.background,
          },
        ]}
        nestedScrollEnabled={true}
        showsVerticalScrollIndicator={true}
      >
        <Text
          style={[
            styles.dataText,
            {
              color: theme.isDark ? colors.dark.onSurface : colors.light.onSurface,
            },
          ]}
        >
          {formattedData}
        </Text>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    borderRadius: 12,
    padding: 16,
  },
  header: {
    marginBottom: 8,
  },
  timestamp: {
    fontSize: 12,
    textAlign: "right",
  },
  dataContainer: {
    flex: 1,
    borderRadius: 8,
    padding: 12,
  },
  dataText: {
    fontFamily: "monospace",
    fontSize: 12,
  },
});
