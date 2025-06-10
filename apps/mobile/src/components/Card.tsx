import React, { ReactNode } from "react";
import { View, StyleSheet, ViewStyle } from "react-native";
import { useColors } from "~/hooks/useColors";

interface CardProps {
  children: ReactNode;
  style?: ViewStyle;
}

export function Card({ children, style }: CardProps) {
  const c = useColors();

  return (
    <View
      style={[
        styles.card,
        {
          backgroundColor: c.card,
        },
        style,
      ]}
    >
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    borderRadius: 12,
    padding: 16,
    marginVertical: 8,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 2,
  },
});
