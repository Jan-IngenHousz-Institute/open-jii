import React from "react";
import { Text, View, StyleSheet } from "react-native";
import { useTheme } from "~/hooks/use-theme";

interface KeyValueProps {
  name: string;
  value: string | number;
}

export function KeyValue({ name, value }: KeyValueProps) {
  const theme = useTheme();
  const { colors } = theme;

  return (
    <View
      style={[
        styles.keyValueContainer,
        {
          backgroundColor: theme.isDark ? colors.dark.card : colors.light.card,
          borderColor: theme.isDark ? colors.dark.border : colors.light.border,
        },
      ]}
    >
      <View style={styles.keyValueRow}>
        <Text
          style={[
            styles.keyText,
            {
              color: theme.isDark ? colors.dark.onSurface : colors.light.onSurface,
            },
          ]}
        >
          {name}
        </Text>
        <Text
          style={[
            styles.valueText,
            {
              color: colors.primary.dark,
            },
          ]}
        >
          {value}
        </Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  keyValueContainer: {
    paddingVertical: 16,
    paddingHorizontal: 16,
    marginBottom: 8,
    borderRadius: 12,
    borderWidth: 1,
  },
  keyValueRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  keyText: {
    fontSize: 16,
    fontWeight: "600",
    flex: 1,
  },
  valueText: {
    fontSize: 16,
    fontWeight: "700",
    textAlign: "right",
  },
});
