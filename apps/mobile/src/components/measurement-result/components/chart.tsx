import React from "react";
import { Text, View } from "react-native";
import { CartesianChart, Line } from "victory-native";
import { colors } from "~/constants/colors";

interface ChartProps {
  name: string;
  values: number[];
}

export function Chart({ name, values }: ChartProps) {
  if (!values || values.length === 0) {
    return (
      <View className="border-border my-5 rounded-2xl border px-5 py-5">
        <Text className="text-foreground mb-5 text-center text-xl font-bold">{name}</Text>
        <Text className="text-foreground mt-5 text-center text-base">No data available</Text>
      </View>
    );
  }

  const chartData = values.map((value, index) => ({
    x: index + 1,
    y: value,
  }));

  return (
    <View className="border-border bg-card my-5 rounded-2xl border px-5 py-5">
      <Text className="text-on-surface mb-5 text-center text-xl font-bold">{name}</Text>

      <View className="bg-background h-[280px] rounded-xl p-4">
        <CartesianChart data={chartData} xKey="x" yKeys={["y"]}>
          {({ points }) => <Line points={points.y} color={colors.primary.dark} strokeWidth={2} />}
        </CartesianChart>
      </View>
    </View>
  );
}
