import React from "react";
import { Text, View, StyleSheet } from "react-native";
import { CartesianChart, Line } from "victory-native";
import { useTheme } from "~/hooks/use-theme";

interface ChartProps {
  name: string;
  values: number[];
}

export function Chart({ name, values }: ChartProps) {
  const theme = useTheme();
  const { colors } = theme;

  // Validate data
  if (!values || values.length === 0) {
    return (
      <View style={styles.chartContainer}>
        <Text style={styles.chartTitle}>{name}</Text>
        <Text style={styles.errorText}>No data available</Text>
      </View>
    );
  }

  // Transform array of numbers into Victory Native XL data format
  const chartData = values.map((value, index) => ({
    x: index + 1,
    y: value,
  }));

  return (
    <View
      style={[
        styles.chartContainer,
        {
          backgroundColor: theme.isDark ? colors.dark.card : colors.light.card,
          borderColor: theme.isDark ? colors.dark.border : colors.light.border,
        },
      ]}
    >
      <Text
        style={[
          styles.chartTitle,
          {
            color: theme.isDark ? colors.dark.onSurface : colors.light.onSurface,
          },
        ]}
      >
        {name}
      </Text>
      <View
        style={[
          styles.chartWrapper,
          {
            backgroundColor: theme.isDark ? colors.dark.background : colors.light.background,
          },
        ]}
      >
        <CartesianChart
          data={chartData}
          xKey="x"
          yKeys={["y"]}
        >
          {({ points }) => <Line points={points.y} color={colors.primary.dark} strokeWidth={2} />}
        </CartesianChart>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  chartContainer: {
    marginVertical: 20,
    paddingHorizontal: 20,
    paddingVertical: 20,
    borderRadius: 16,
    borderWidth: 1,
  },
  chartTitle: {
    fontSize: 20,
    fontWeight: "bold",
    marginBottom: 20,
    textAlign: "center",
  },
  chartWrapper: {
    height: 280,
    borderRadius: 12,
    padding: 16,
  },
  errorText: {
    textAlign: "center",
    fontSize: 16,
    color: "#666",
    marginTop: 20,
  },
});
