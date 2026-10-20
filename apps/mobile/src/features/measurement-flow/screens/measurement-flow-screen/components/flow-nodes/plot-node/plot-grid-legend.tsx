import { clsx } from "clsx";
import React from "react";
import { Text, View } from "react-native";

export interface PlotGridLegendItem {
  label: string;
  swatchClassName: string;
  icon?: React.ReactNode;
}

interface PlotGridLegendProps {
  items: PlotGridLegendItem[];
}

export function PlotGridLegend({ items }: PlotGridLegendProps) {
  const renderItem = (item: PlotGridLegendItem) => (
    <View key={item.label} className="flex-row items-center gap-1.5">
      <View className={clsx("h-4 w-4 items-center justify-center rounded", item.swatchClassName)}>
        {item.icon}
      </View>
      <Text className="text-muted-foreground text-xs">{item.label}</Text>
    </View>
  );

  return <View className="flex-row flex-wrap gap-x-4 gap-y-2">{items.map(renderItem)}</View>;
}
