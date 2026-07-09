import { clsx } from "clsx";
import { Calendar, FlaskConical, X } from "lucide-react-native";
import React from "react";
import { Text, TouchableOpacity, View } from "react-native";
import { useTranslation } from "~/shared/i18n";
import { formatIsoDateString } from "~/shared/time/format-iso-date-string";
import { useTheme } from "~/shared/ui/hooks/use-theme";

interface MeasurementHeaderProps {
  timestamp?: string;
  experimentName?: string;
  onClose: () => void;
}

export function MeasurementHeader({ timestamp, experimentName, onClose }: MeasurementHeaderProps) {
  const { classes, colors } = useTheme();
  const { t } = useTranslation("measurementFlow");

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
          <FlaskConical size={20} color={colors.brand} />
          <Text className={clsx("ml-2 text-xl font-bold", classes.text)}>
            {t("measurementFlow:result.header.title")}
          </Text>
        </View>

        {timestamp && (
          <View className="mb-1 flex-row items-center">
            <Calendar size={14} color={colors.brand} />
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
        <X size={20} color={colors.brand} />
      </TouchableOpacity>
    </View>
  );
}
