import { cva } from "class-variance-authority";
import React, { ReactNode } from "react";
import { View, ViewStyle } from "react-native";
import { cn } from "~/shared/utils/cn";

export type CardTone = "white" | "mint" | "yellow" | "teal";

interface CardProps {
  children: ReactNode;
  style?: ViewStyle | ViewStyle[];
  className?: string;
  tone?: CardTone;
  padded?: boolean;
  flat?: boolean;
}

const cardVariants = cva("my-2 rounded-xl", {
  variants: {
    tone: {
      white: "bg-card",
      mint: "bg-jii-mint dark:bg-jii-mint/40",
      yellow: "bg-jii-yellow-light dark:bg-jii-yellow-light/40",
      teal: "bg-jii-primary",
    },
    padded: { true: "p-4", false: "p-0" },
    flat: { true: "", false: "shadow-sm shadow-black/10" },
  },
});

export function Card({
  children,
  style,
  className,
  tone = "white",
  padded = true,
  flat = false,
}: CardProps) {
  return (
    <View className={cn(cardVariants({ tone, padded, flat }), className)} style={style}>
      {children}
    </View>
  );
}
