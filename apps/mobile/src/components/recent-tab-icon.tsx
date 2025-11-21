import { Clock } from "lucide-react-native";
import React from "react";
import { View, Text } from "react-native";
import { useFailedUploads } from "~/hooks/use-failed-uploads";
import { useTheme } from "~/hooks/use-theme";

export function RecentTabIcon({ color, size }: { color: string; size: number }) {
  const { uploads } = useFailedUploads();
  const { colors, isDark } = useTheme();
  const count = uploads?.length ?? 0;

  return (
    <View style={{ position: "relative" }}>
      <Clock size={size} color={color} />
      {count > 0 && (
        <View
          style={{
            position: "absolute",
            top: -6,
            right: -8,
            backgroundColor: colors.semantic.error,
            borderRadius: 10,
            minWidth: 20,
            height: 20,
            paddingHorizontal: count > 9 ? 4 : 6,
            justifyContent: "center",
            alignItems: "center",
            borderWidth: 2,
            borderColor: isDark ? colors.dark.surface : colors.light.surface,
          }}
        >
          <Text
            style={{
              color: "#FFFFFF",
              fontSize: 11,
              fontWeight: "bold",
            }}
          >
            {count > 99 ? "99+" : count}
          </Text>
        </View>
      )}
    </View>
  );
}

