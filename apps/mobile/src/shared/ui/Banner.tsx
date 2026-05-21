import { cva } from "class-variance-authority";
import { X } from "lucide-react-native";
import React, { ReactNode } from "react";
import { Pressable, Text, View } from "react-native";
import { Button } from "~/shared/ui/Button";
import { cn } from "~/shared/utils/cn";

export type BannerVariant = "yellow" | "mint" | "info";

interface BannerProps {
  title: string;
  body?: string;
  actionLabel?: string;
  onAction?: () => void;
  variant?: BannerVariant;
  icon?: ReactNode;
  onDismiss?: () => void;
  className?: string;
}

const bannerVariants = cva("flex-row items-start rounded-2xl border p-4", {
  variants: {
    variant: {
      yellow: "bg-jii-yellow-light border-jii-yellow/60 dark:bg-jii-yellow-light/30",
      mint: "bg-jii-mint border-jii-mint-light dark:bg-jii-mint/30",
      info: "bg-info/10 border-info/30",
    },
  },
});

const bannerTitleVariants = cva("font-bold text-[15px]", {
  variants: {
    variant: {
      yellow: "text-amber-900 dark:text-amber-200",
      mint: "text-jii-darker-green dark:text-jii-primary-bright",
      info: "text-info",
    },
  },
});

const bannerBodyVariants = cva("mt-0.5 text-[13px]", {
  variants: {
    variant: {
      yellow: "text-amber-800 dark:text-amber-200/80",
      mint: "text-muted-body",
      info: "text-info/80",
    },
  },
});

export function Banner({
  title,
  body,
  actionLabel,
  onAction,
  variant = "yellow",
  icon,
  onDismiss,
  className,
}: BannerProps) {
  return (
    <View className={cn(bannerVariants({ variant }), className)}>
      {icon ? <View className="mr-3 mt-0.5">{icon}</View> : null}
      <View className="flex-1">
        <Text className={bannerTitleVariants({ variant })}>{title}</Text>
        {body ? <Text className={bannerBodyVariants({ variant })}>{body}</Text> : null}
      </View>
      {actionLabel && onAction ? (
        <View className="ml-3">
          <Button title={actionLabel} onPress={onAction} variant="primary" size="sm" />
        </View>
      ) : null}
      {onDismiss ? (
        <Pressable onPress={onDismiss} className="ml-2 p-1" hitSlop={8}>
          <X size={16} color="#6b7280" />
        </Pressable>
      ) : null}
    </View>
  );
}
