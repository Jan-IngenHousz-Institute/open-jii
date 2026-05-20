import { Clock } from "lucide-react-native";
import React from "react";
import { View, Text } from "react-native";
import { useFailedUploads } from "~/features/recent-measurements/hooks/use-measurements";
import { cn } from "~/shared/utils/cn";

export function RecentTabIcon({ color, size }: { color: string; size: number }) {
  const uploads = useFailedUploads();
  const count = uploads?.length ?? 0;

  return (
    <View className="relative">
      <Clock size={size} color={color} />
      {count > 0 && (
        <View
          className={cn(
            "border-surface bg-error absolute -right-2 -top-1.5 h-5 min-w-5 items-center justify-center rounded-full border-2",
            count > 9 ? "px-1" : "px-1.5",
          )}
        >
          <Text className="text-[11px] font-bold text-white">{count > 99 ? "99+" : count}</Text>
        </View>
      )}
    </View>
  );
}
