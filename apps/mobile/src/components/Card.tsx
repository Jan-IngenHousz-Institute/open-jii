import React, { ReactNode } from "react";
import { View, ViewStyle } from "react-native";

interface CardProps {
  children: ReactNode;
  style?: ViewStyle | ViewStyle[];
  className?: string;
}

export function Card({ children, style, className }: CardProps) {
  return (
    <View
      className={`bg-card my-2 rounded-xl p-4 shadow-sm shadow-black/10${
        className ? ` ${className}` : ""
      }`}
      style={style}
    >
      {children}
    </View>
  );
}
