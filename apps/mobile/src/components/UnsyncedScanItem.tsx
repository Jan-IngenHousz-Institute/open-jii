import { CloudOff } from "lucide-react-native";
import React from "react";
import { View, Text, StyleSheet } from "react-native";
import { useTheme } from "~/hooks/useTheme";

interface UnsyncedScanItemProps {
  id: string;
  timestamp: string;
  experimentName: string;
}

export function UnsyncedScanItem({ timestamp, experimentName }: UnsyncedScanItemProps) {
  const theme = useTheme();
  const { colors } = theme;

  return (
    <View
      style={[
        styles.container,
        {
          backgroundColor: theme.isDark ? colors.dark.card : colors.light.card,
        },
      ]}
    >
      <View style={styles.iconContainer}>
        <CloudOff size={24} color={colors.semantic.warning} />
      </View>

      <View style={styles.contentContainer}>
        <Text
          style={[
            styles.experimentName,
            {
              color: theme.isDark ? colors.dark.onSurface : colors.light.onSurface,
            },
          ]}
        >
          {experimentName}
        </Text>
        <Text
          style={[
            styles.timestamp,
            {
              color: theme.isDark ? colors.dark.inactive : colors.light.inactive,
            },
          ]}
        >
          {timestamp}
        </Text>

        <View style={styles.footer}>
          <Text style={[styles.pendingText, { color: colors.semantic.warning }]}>Pending Sync</Text>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    borderRadius: 12,
    padding: 16,
    marginVertical: 8,
    flexDirection: "row",
  },
  iconContainer: {
    marginRight: 16,
    justifyContent: "center",
  },
  contentContainer: {
    flex: 1,
  },
  experimentName: {
    fontSize: 16,
    fontWeight: "bold",
  },
  timestamp: {
    fontSize: 12,
    marginTop: 4,
  },
  footer: {
    marginTop: 12,
  },
  pendingText: {
    fontSize: 14,
  },
});
