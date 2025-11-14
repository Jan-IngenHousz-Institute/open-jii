import { clsx } from "clsx";
import React from "react";
import { Text, View } from "react-native";
import { useTheme } from "~/hooks/use-theme";

interface KeyValueProps {
  name: string;
  value: string | number;
}

export function KeyValue({ name, value }: KeyValueProps) {
  const { classes, colors } = useTheme();

  return (
    <View className={clsx("mb-2 rounded-xl border px-4 py-4", classes.card, classes.border)}>
      <View className="flex-row items-center justify-between">
        <Text className={clsx("flex-1 text-base font-semibold", classes.text)}>{name}</Text>
        <Text className="text-base font-bold" style={{ color: colors.primary.dark }}>
          {value}
        </Text>
      </View>
    </View>
  );
}
