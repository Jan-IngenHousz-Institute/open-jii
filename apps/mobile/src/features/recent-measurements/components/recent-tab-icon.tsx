import { Clock } from "lucide-react-native";
import React from "react";
import { View, Text } from "react-native";
import { useMeasurementCounts } from "~/features/recent-measurements/hooks/use-all-measurements";
import { cn } from "~/shared/utils/cn";

export function RecentTabIcon({ color, size }: { color: string; size: number }) {
  // SQL GROUP BY count — does NOT decompress measurement payloads. Reading
  // the full pending/failed list here was the root cause of the
  // budget-phone freeze at ~20 stored measurements: every cache invalidation
  // re-ran a gzip+JSON.parse for every row on the JS thread.
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
