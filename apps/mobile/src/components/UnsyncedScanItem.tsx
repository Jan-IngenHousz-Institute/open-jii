import { clsx } from "clsx";
import { CloudOff, UploadCloud, Trash2 } from "lucide-react-native";
import React from "react";
import { View, Text, TouchableOpacity } from "react-native";
import { useTheme } from "~/hooks/use-theme";
import { formatTimeAgo } from "~/utils/format-time-ago";

interface UnsyncedScanItemProps {
  id: string;
  timestamp: string;
  experimentName: string;
  onSync?: (id: string) => void;
  onDelete?: (id: string) => void;
}

export function UnsyncedScanItem({
  id,
  timestamp,
  experimentName,
  onSync,
  onDelete,
}: UnsyncedScanItemProps) {
  const { colors, classes } = useTheme();

  return (
    <View className={clsx("my-2 min-h-[80px] flex-row items-center rounded-xl p-4", classes.card)}>
      <View className="mr-4 justify-center">
        <CloudOff size={24} color={colors.semantic.warning} />
      </View>

      <View className="flex-1">
        <Text className={clsx("text-base font-bold", classes.text)}>{experimentName}</Text>
        <Text className={clsx("mt-1 text-xs", classes.textMuted)}>{formatTimeAgo(timestamp)}</Text>
      </View>

      <View className="ml-3 flex-row gap-2">
        <TouchableOpacity
          onPress={() => onSync?.(id)}
          className="h-11 w-11 items-center justify-center rounded-lg"
          style={{ backgroundColor: colors.semantic.info }}
          activeOpacity={0.8}
        >
          <UploadCloud size={20} color="#fff" />
        </TouchableOpacity>
        <TouchableOpacity
          onPress={() => onDelete?.(id)}
          className="h-11 w-11 items-center justify-center rounded-lg"
          style={{ backgroundColor: colors.semantic.error }}
          activeOpacity={0.8}
        >
          <Trash2 size={20} color="#fff" />
        </TouchableOpacity>
      </View>
    </View>
  );
}
