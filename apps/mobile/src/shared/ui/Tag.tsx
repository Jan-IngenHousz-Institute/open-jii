import { cva } from "class-variance-authority";
import React, { ReactNode } from "react";
import { Text, View } from "react-native";
import { cn } from "~/shared/utils/cn";

export type TagVariant =
  | "default"
  | "sensor"
  | "questions"
  | "both"
  | "queued"
  | "synced"
  | "failed";

interface TagProps {
  children: ReactNode;
  variant?: TagVariant;
  size?: "sm" | "md";
  icon?: ReactNode;
  className?: string;
}

const tagVariants = cva("flex-row items-center rounded-md", {
  variants: {
    variant: {
      default: "bg-muted",
      sensor: "bg-jii-mint dark:bg-jii-mint/40",
      questions: "bg-badge-published dark:bg-badge-published/40",
      both: "bg-badge-featured dark:bg-badge-featured/40",
      queued: "bg-badge-stale dark:bg-badge-stale/40",
      synced: "bg-badge-active dark:bg-badge-active/40",
      failed: "bg-error/15",
    },
    size: {
      sm: "px-2 py-0.5",
      md: "px-2.5 py-1",
    },
  },
});

const tagTextVariants = cva("font-semibold", {
  variants: {
    variant: {
      default: "text-muted-foreground",
      sensor: "text-jii-darker-green dark:text-jii-primary-bright",
      questions: "text-jii-darker-green dark:text-foreground",
      both: "text-jii-darker-green dark:text-foreground",
      queued: "text-amber-800 dark:text-amber-200",
      synced: "text-success",
      failed: "text-error",
    },
    size: {
      sm: "text-[11px]",
      md: "text-[13px]",
    },
  },
});

export function Tag({ children, variant = "default", size = "sm", icon, className }: TagProps) {
  return (
    <View className={cn(tagVariants({ variant, size }), className)}>
      {icon ? <View className="mr-1">{icon}</View> : null}
      <Text className={tagTextVariants({ variant, size })}>{children}</Text>
    </View>
  );
}
