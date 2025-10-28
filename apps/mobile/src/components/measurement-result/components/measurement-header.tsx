import { clsx } from "clsx";
import { Calendar, FlaskConical, X } from "lucide-react-native";
import React from "react";
import { Text, TouchableOpacity, View } from "react-native";
import { useTheme } from "~/hooks/use-theme";
import { formatIsoDateString } from "~/utils/format-iso-date-string";

interface MeasurementHeaderProps {
  timestamp?: string;
  experimentName?: string;
  onClose: () => void;
}

export function MeasurementHeader({ timestamp, experimentName, onClose }: MeasurementHeaderProps) {
  const { classes, colors } = useTheme();

  return (
    <View
      className={clsx(
        "flex-row items-center justify-between border-b px-4 py-3",
        classes.surface,
        classes.border,
      )}
    >
      <View className="flex-1">
        <View className="mb-1 flex-row items-center">
          <FlaskConical size={20} color={colors.primary.dark} />
          <Text className={clsx("ml-2 text-xl font-bold", classes.text)}>Measurement Results</Text>
        </View>

        {timestamp && (
          <View className="mb-1 flex-row items-center">
            <Calendar size={14} color={colors.primary.dark} />
            <Text className={clsx("ml-1 text-xs", classes.textSecondary)}>
              {formatIsoDateString(timestamp)}
            </Text>
          </View>
        )}

        {experimentName && (
          <Text className={clsx("text-sm font-medium", classes.text)}>{experimentName}</Text>
        )}
      </View>

      <TouchableOpacity
        className={clsx("ml-3 h-10 w-10 items-center justify-center rounded-full", classes.card)}
        onPress={onClose}
        activeOpacity={0.7}
      >
        <X size={20} color={colors.primary.dark} />
      </TouchableOpacity>
    </View>
  );
}
