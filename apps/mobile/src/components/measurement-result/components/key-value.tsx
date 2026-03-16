import { clsx } from "clsx";
import React from "react";
import { Text, View } from "react-native";
import { useTheme } from "~/hooks/use-theme";

interface KeyValueProps {
  name: string;
  value: string | number;
}

export function KeyValue({ name, value }: KeyValueProps) {
  const { classes } = useTheme();

  return (
    <View
      className={clsx("w-full flex-row items-center justify-between border-b py-3", classes.border)}
    >
      <Text numberOfLines={1} className={clsx("flex-1 text-base font-medium", classes.text)}>
        {name}
      </Text>

      <Text className={clsx("text-sm font-normal", classes.textMuted)}>{value}</Text>
    </View>
  );
}
