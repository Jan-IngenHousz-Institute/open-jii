import { ChevronRight } from "lucide-react-native";
import type { LucideIcon } from "lucide-react-native";
import React from "react";
import { Pressable, Text, View } from "react-native";
import { useThemeColors } from "~/shared/ui/hooks/use-theme-colors";

export type SkipReason = "plantMissing" | "flooded" | "couldNotReach" | "other";

interface SkipReasonRowProps {
  reason: SkipReason;
  label: string;
  Icon: LucideIcon;
  onChoose: (reason: SkipReason) => void;
}

export function SkipReasonRow({ reason, label, Icon, onChoose }: SkipReasonRowProps) {
  const themeColors = useThemeColors();

  const handlePress = () => onChoose(reason);

  return (
    <Pressable
      onPress={handlePress}
      accessibilityRole="button"
      className="border-border bg-card flex-row items-center gap-3 rounded-2xl border p-3.5 active:opacity-60"
    >
      <View className="bg-gray-background h-10 w-10 items-center justify-center rounded-xl">
        <Icon size={20} color={themeColors.onSurface} />
      </View>
      <Text className="text-on-surface min-w-0 flex-1 text-[15px] font-bold">{label}</Text>
      <ChevronRight size={20} color={themeColors.inactive} />
    </Pressable>
  );
}
