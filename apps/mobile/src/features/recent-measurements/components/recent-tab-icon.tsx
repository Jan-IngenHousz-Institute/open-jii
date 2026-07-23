import { Clock } from "lucide-react-native";
import React from "react";
import { View, Text, type ColorValue } from "react-native";
import { useMeasurementCounts } from "~/features/recent-measurements/hooks/use-all-measurements";
import { cn } from "~/shared/ui/cn";

export function RecentTabIcon({ color, size }: { color: ColorValue; size: number }) {
  const { unsyncedCount } = useMeasurementCounts();

  return (
    <View className="relative">
      <Clock size={size} color={color} />
      {unsyncedCount > 0 && (
        <View
          className={cn(
            "border-surface bg-error absolute -right-2 -top-1.5 h-5 min-w-5 items-center justify-center rounded-full border-2",
            unsyncedCount > 9 ? "px-1" : "px-1.5",
          )}
        >
          <Text className="text-[11px] font-bold text-white">
            {unsyncedCount > 99 ? "99+" : unsyncedCount}
          </Text>
        </View>
      )}
    </View>
  );
}
