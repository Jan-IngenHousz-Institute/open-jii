import { ChevronRight } from "lucide-react-native";
import type { LucideIcon } from "lucide-react-native";
import React from "react";
import { Pressable, Text, View } from "react-native";

interface SessionExitOptionProps {
  Icon: LucideIcon;
  title: string;
  subtitle: string;
  color: string;
  iconBackground: string;
  className: string;
  onPress: () => void;
}

/** One choice on the session's exit sheet, drawn like the sheet's Pause and Discard rows. */
export function SessionExitOption({
  Icon,
  title,
  subtitle,
  color,
  iconBackground,
  className,
  onPress,
}: SessionExitOptionProps) {
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      className={`flex-row items-center gap-3 rounded-2xl border p-3.5 ${className}`}
    >
      <View
        className="h-10 w-10 items-center justify-center rounded-xl"
        style={{ backgroundColor: iconBackground }}
      >
        <Icon size={20} color={color} />
      </View>
      <View className="min-w-0 flex-1">
        <Text className="text-[15px] font-bold" style={{ color }}>
          {title}
        </Text>
        <Text className="text-muted-body mt-0.5 text-[12.5px]">{subtitle}</Text>
      </View>
      <ChevronRight size={20} color={color} />
    </Pressable>
  );
}
