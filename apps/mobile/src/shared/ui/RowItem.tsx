import { ChevronRight } from "lucide-react-native";
import React, { ReactNode } from "react";
import { Pressable, Text, View } from "react-native";
import { useThemeColors } from "~/shared/ui/hooks/use-theme-colors";
import { cn } from "~/shared/utils/cn";

interface RowItemProps {
  icon?: ReactNode;
  iconBackgroundClassName?: string;
  iconColorClassName?: string;
  title: string;
  subtitle?: string;
  right?: ReactNode;
  onPress?: () => void;
  danger?: boolean;
  isLast?: boolean;
  className?: string;
}

export function RowItem({
  icon,
  iconBackgroundClassName = "bg-muted",
  iconColorClassName = "text-on-surface",
  title,
  subtitle,
  right,
  onPress,
  danger,
  isLast,
  className,
}: RowItemProps) {
  const themeColors = useThemeColors();
  const Container: typeof View | typeof Pressable = onPress ? Pressable : View;
  const titleClass = danger ? "text-error" : "text-on-surface";

  return (
    <Container
      onPress={onPress}
      className={cn(
        "flex-row items-center gap-3 px-4 py-3",
        !isLast && "border-divider border-b",
        className,
      )}
    >
      {icon ? (
        <View
          className={cn(
            "h-9 w-9 items-center justify-center rounded-xl",
            danger ? "bg-error/15" : iconBackgroundClassName,
            iconColorClassName,
          )}
        >
          {icon}
        </View>
      ) : null}
      <View className="min-w-0 flex-1">
        <Text className={cn("text-[15px] font-semibold", titleClass)} numberOfLines={1}>
          {title}
        </Text>
        {subtitle ? (
          <Text className="text-muted-body mt-0.5 text-[12px]" numberOfLines={1}>
            {subtitle}
          </Text>
        ) : null}
      </View>
      {right ?? (onPress ? <ChevronRight size={18} color={themeColors.inactive} /> : null)}
    </Container>
  );
}
