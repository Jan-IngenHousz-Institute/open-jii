import { clsx } from "clsx";
import { CloudOff, UploadCloud, Trash2, CheckCircle2 } from "lucide-react-native";
import React from "react";
import { View, Text, TouchableOpacity } from "react-native";
import type { MeasurementStatus } from "~/hooks/use-all-measurements";
import { useTheme } from "~/hooks/use-theme";
import { formatTimeAgo } from "~/utils/format-time-ago";

interface MeasurementItemProps {
  id: string;
  timestamp: string;
  experimentName: string;
  status: MeasurementStatus;
  onSync?: (id: string) => void;
  onDelete?: (id: string) => void;
}

export function MeasurementItem({
  id,
  timestamp,
  experimentName,
  status,
  onSync,
  onDelete,
}: MeasurementItemProps) {
  const { colors, classes } = useTheme();
  const isSynced = status === "synced";

  return (
    <View className={clsx("min-h-[60px] flex-row items-center rounded-lg p-2", classes.card)}>
      <View className="mr-2 justify-center">
        {isSynced ? (
          <CheckCircle2 size={24} color={colors.semantic.success} />
        ) : (
          <CloudOff size={24} color={colors.semantic.warning} />
        )}
      </View>

      <View className="flex-1">
        <Text className={clsx("text-base font-bold", classes.text)}>{experimentName}</Text>
        <Text className={clsx("mt-0 text-xs", classes.textMuted)}>{formatTimeAgo(timestamp)}</Text>
      </View>

      <View className="ml-1.5 flex-row gap-1">
        {!isSynced && (
          <TouchableOpacity
            onPress={() => onSync?.(id)}
            className="h-10 w-10 items-center justify-center rounded-lg"
            style={{ backgroundColor: colors.semantic.info }}
            activeOpacity={0.8}
          >
            <UploadCloud size={20} color="#fff" />
          </TouchableOpacity>
        )}
        {onDelete && (
          <TouchableOpacity
            onPress={() => onDelete(id)}
            className="h-10 w-10 items-center justify-center rounded-lg"
            style={{ backgroundColor: colors.semantic.error }}
            activeOpacity={0.8}
          >
            <Trash2 size={20} color="#fff" />
          </TouchableOpacity>
        )}
      </View>
    </View>
  );
}
