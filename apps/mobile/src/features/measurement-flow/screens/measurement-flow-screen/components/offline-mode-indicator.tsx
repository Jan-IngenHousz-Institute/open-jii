import { CheckCircle2 } from "lucide-react-native";
import React from "react";
import { View, Text } from "react-native";
import { useTheme } from "~/hooks/use-theme";

interface OfflineModeIndicatorProps {
  isVisible: boolean;
}

export function OfflineModeIndicator({ isVisible }: OfflineModeIndicatorProps) {
  const { colors } = useTheme();

  if (!isVisible) {
    return null;
  }

  return (
    <View
      className="flex-row items-center gap-1 rounded border px-2 py-0.5"
      style={{
        backgroundColor: colors.semantic.success + "15",
        borderColor: colors.semantic.success + "40",
      }}
    >
      <CheckCircle2 size={12} color={colors.semantic.success} />
      <Text className="text-[10px] font-medium" style={{ color: colors.semantic.success }}>
        Offline ready
      </Text>
    </View>
  );
}
