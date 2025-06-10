import React from "react";
import { View, StyleSheet } from "react-native";
import { colors } from "~/constants/colors";
import { useTheme } from "~/hooks/useTheme";

interface MeasurementLayoutProps {
  children: React.ReactNode;
}

export function MeasurementLayout({ children }: MeasurementLayoutProps) {
  const theme = useTheme();

  return (
    <View
      style={[
        styles.container,
        {
          backgroundColor: theme.isDark
            ? colors.dark.background
            : colors.light.background,
        },
      ]}
    >
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
});
