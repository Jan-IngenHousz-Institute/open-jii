import { useFont } from "@shopify/react-native-skia";
import React from "react";
import { ScrollView, Text, View, StyleSheet } from "react-native";
import { CartesianChart, Line } from "victory-native";
import { useTheme } from "~/hooks/use-theme";

// eslint-disable-next-line @typescript-eslint/ban-ts-comment
// @ts-expect-error
import fontResource from "../../../../assets/fonts/Overpass-Regular.ttf";

interface KeyValueProps {
  name: string;
  value: string | number;
}

function KeyValue({ name, value }: KeyValueProps) {
  const theme = useTheme();
  const { colors } = theme;

  return (
    <View style={styles.keyValueContainer}>
      <Text
        style={[
          styles.keyValueText,
          {
            color: theme.isDark ? colors.dark.onSurface : colors.light.onSurface,
          },
        ]}
      >
        <Text style={styles.keyText}>{name}: </Text>
        <Text style={styles.valueText}>{value}</Text>
      </Text>
    </View>
  );
}

interface ChartProps {
  name: string;
  values: number[];
}

function Chart({ name, values }: ChartProps) {
  const theme = useTheme();
  const { colors } = theme;

  // Transform array of numbers into Victory Native XL data format
  const chartData = values.map((value, index) => ({
    x: index + 1,
    y: value,
  }));

  // Note: You'll need to add a font file to your assets and import it
  // For now, we'll use a fallback approach
  const font = useFont(fontResource, 12);

  return (
    <View style={styles.chartContainer}>
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
      <View style={styles.chartWrapper}>
        <CartesianChart
          data={chartData}
          xKey="x"
          yKeys={["y"]}
          axisOptions={{
            font,
          }}
        >
          {({ points }) => <Line points={points.y} color={colors.primary.dark} strokeWidth={3} />}
        </CartesianChart>
      </View>
    </View>
  );
}

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

  return (
    <ScrollView
      style={[
        styles.container,
        {
          backgroundColor: theme.isDark ? colors.dark.background : colors.light.background,
        },
      ]}
    >
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
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  keyValueContainer: {
    paddingVertical: 8,
    paddingHorizontal: 16,
    borderBottomWidth: 1,
    borderBottomColor: "#e0e0e0",
  },
  keyValueText: {
    fontSize: 16,
  },
  keyText: {
    fontWeight: "600",
  },
  valueText: {
    fontWeight: "400",
  },
  chartContainer: {
    marginVertical: 16,
    paddingHorizontal: 16,
  },
  chartTitle: {
    fontSize: 18,
    fontWeight: "bold",
    marginBottom: 12,
    textAlign: "center",
  },
  chartWrapper: {
    height: 200,
    backgroundColor: "#f5f5f5",
    borderRadius: 8,
    padding: 8,
  },
});
