import React from "react";
import { Text, View } from "react-native";
import { CartesianChart, Line } from "victory-native";
import { useTranslation } from "~/shared/i18n";
import { useThemeColors } from "~/shared/ui/hooks/use-theme-colors";

interface ChartProps {
  name: string;
  values: number[];
}

export function Chart({ name, values }: ChartProps) {
  const { brand } = useThemeColors();
  const { t } = useTranslation("measurementFlow");
  if (!values || values.length === 0) {
    return (
      <View className="border-border my-5 rounded-2xl border px-5 py-5">
        <Text className="text-foreground mb-5 text-center text-xl font-bold">{name}</Text>
        <Text className="text-foreground mt-5 text-center text-base">
          {t("measurementFlow:result.chart.noData")}
        </Text>
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
          {({ points }) => <Line points={points.y} color={brand} strokeWidth={2} />}
        </CartesianChart>
      </View>
    </View>
  );
}
