import React from "react";
import { Text, View } from "react-native";
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
      <View
        className="my-5 rounded-2xl border px-5 py-5"
        style={{ borderColor: theme.isDark ? colors.dark.border : colors.light.border }}
      >
        <Text className="mb-5 text-center text-xl font-bold">{name}</Text>
        <Text className="mt-5 text-center text-base">No data available</Text>
      </View>
    );
  }

  // Transform array into chart data
  const chartData = values.map((value, index) => ({
    x: index + 1,
    y: value,
  }));

  return (
    <View
      className="my-5 rounded-2xl border px-5 py-5"
      style={{
        backgroundColor: theme.isDark ? colors.dark.card : colors.light.card,
        borderColor: theme.isDark ? colors.dark.border : colors.light.border,
      }}
    >
      <Text
        className="mb-5 text-center text-xl font-bold"
        style={{
          color: theme.isDark ? colors.dark.onSurface : colors.light.onSurface,
        }}
      >
        {name}
      </Text>

      <View
        className="h-[280px] rounded-xl p-4"
        style={{
          backgroundColor: theme.isDark ? colors.dark.background : colors.light.background,
        }}
      >
        <CartesianChart data={chartData} xKey="x" yKeys={["y"]}>
          {({ points }) => <Line points={points.y} color={colors.primary.dark} strokeWidth={2} />}
        </CartesianChart>
      </View>
    </View>
  );
}
