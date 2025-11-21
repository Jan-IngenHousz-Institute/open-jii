import React from "react";
import { View, StyleSheet } from "react-native";
import { ConnectionSetup } from "~/components/connection-setup";
import { useTheme } from "~/hooks/use-theme";

export default function HomeScreen() {
  const theme = useTheme();
  const { colors } = theme;

  return (
    <View
      style={[
        styles.container,
        {
          backgroundColor: theme.isDark ? colors.dark.background : colors.light.background,
        },
      ]}
    >
      <View style={styles.scrollContent}>
        <View style={styles.section}>
          <ConnectionSetup />
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  scrollContent: {
    padding: 16,
  },
  section: {
    marginBottom: 24,
  },
});
