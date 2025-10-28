import { clsx } from "clsx";
import { X } from "lucide-react-native";
import React from "react";
import { ScrollView, Text, TouchableOpacity, View } from "react-native";
import { useTheme } from "~/hooks/use-theme";
import { formatIsoDateString } from "~/utils/format-iso-date-string";

export function MeasurementJsonPreview({ data, timestamp, experimentName, onClose }) {
  const { classes, colors } = useTheme();

  return (
    <View className={clsx("flex-1", classes.background)}>
      <View
        className={clsx(
          "flex-row items-center justify-between border-b px-4 py-3",
          classes.card,
          classes.border,
        )}
      >
        <View className="flex-1">
          <Text className={clsx("text-lg font-bold", classes.text)}>Measurement Result</Text>
          {timestamp && (
            <Text className={clsx("mt-0.5 text-xs", classes.textSecondary)}>
              {formatIsoDateString(timestamp)}
            </Text>
          )}
        </View>
        <TouchableOpacity
          className={clsx("h-9 w-9 items-center justify-center rounded-full", classes.card)}
          onPress={onClose}
          activeOpacity={0.7}
        >
          <X size={20} color={colors.primary.dark} />
        </TouchableOpacity>
      </View>

      <View className={clsx("m-4 flex-1 rounded-xl p-4", classes.card)}>
        {experimentName && (
          <Text className={clsx("mb-3 text-base font-semibold", classes.text)}>
            Experiment: {experimentName}
          </Text>
        )}

        <ScrollView
          className={clsx("flex-1 rounded-lg p-3", classes.background)}
          showsVerticalScrollIndicator
        >
          <Text className={clsx("font-mono text-sm leading-5", classes.text)}>
            {JSON.stringify(data, null, 2)}
          </Text>
        </ScrollView>
      </View>
    </View>
  );
}
