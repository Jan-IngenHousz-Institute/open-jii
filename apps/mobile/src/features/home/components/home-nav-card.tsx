import { cva } from "class-variance-authority";
import { ChevronRight } from "lucide-react-native";
import React, { ReactNode } from "react";
import { Pressable, Text, View } from "react-native";
import { cn } from "~/shared/ui/cn";
import { useThemeColors } from "~/shared/ui/hooks/use-theme-colors";

interface HomeNavCardProps {
  icon: ReactNode;
  iconTileClassName?: string;
  badge?: "top-right" | "bottom-right";
  badgeClassName?: string;
  title: string;
  subtitle: string;
  onPress: () => void;
}

const badgeVariants = cva("absolute h-3.5 w-3.5 rounded-full border-2 border-white", {
  variants: {
    corner: {
      "top-right": "-right-0.5 -top-0.5",
      "bottom-right": "-bottom-0.5 -right-0.5",
    },
  },
});

export function HomeNavCard({
  icon,
  iconTileClassName = "bg-jii-mint",
  badge,
  badgeClassName,
  title,
  subtitle,
  onPress,
}: HomeNavCardProps) {
  const themeColors = useThemeColors();

  return (
    <Pressable onPress={onPress} className="mb-1 mt-3" accessibilityRole="button">
      <View className="bg-card shadow-xs rounded-2xl p-3.5 shadow-black/10">
        <View className="flex-row items-center">
          <View
            className={cn(
              "h-13 w-13 relative mr-3 items-center justify-center rounded-[14px]",
              iconTileClassName,
            )}
          >
            {icon}
            {badge ? (
              <View className={cn(badgeVariants({ corner: badge }), badgeClassName)} />
            ) : null}
          </View>

          <View className="min-w-0 flex-1">
            <Text
              className="text-on-surface text-[15px]"
              style={{ fontFamily: "Poppins-Bold" }}
              numberOfLines={1}
            >
              {title}
            </Text>
            <Text className="text-muted-body mt-0.5 text-[12px]" numberOfLines={1}>
              {subtitle}
            </Text>
          </View>

          <ChevronRight size={20} color={themeColors.inactive} />
        </View>
      </View>
    </Pressable>
  );
}
