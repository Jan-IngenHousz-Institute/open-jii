import { Calendar, FlaskConical, X } from "lucide-react-native";
import React from "react";
import { Text, TouchableOpacity, View, StyleSheet } from "react-native";
import { useTheme } from "~/hooks/use-theme";
import { formatIsoDateString } from "~/utils/format-iso-date-string";

interface MeasurementHeaderProps {
  timestamp?: string;
  experimentName?: string;
  onClose: () => void;
}

export function MeasurementHeader({ timestamp, experimentName, onClose }: MeasurementHeaderProps) {
  const theme = useTheme();
  const { colors } = theme;

  return (
    <View
      style={[
        styles.header,
        {
          backgroundColor: theme.isDark ? colors.dark.surface : colors.light.surface,
          borderBottomColor: theme.isDark ? colors.dark.border : colors.light.border,
        },
      ]}
    >
      <View style={styles.headerContent}>
        <View style={styles.titleContainer}>
          <FlaskConical size={20} color={colors.primary.dark} />
          <Text
            style={[
              styles.title,
              {
                color: theme.isDark ? colors.dark.onSurface : colors.light.onSurface,
              },
            ]}
          >
            Measurement Results
          </Text>
        </View>

        {timestamp && (
          <View style={styles.timestampContainer}>
            <Calendar size={14} color={theme.isDark ? colors.dark.inactive : colors.light.inactive} />
            <Text
              style={[
                styles.timestamp,
                {
                  color: theme.isDark ? colors.dark.inactive : colors.light.inactive,
                },
              ]}
            >
              {formatIsoDateString(timestamp)}
            </Text>
          </View>
        )}

        {experimentName && (
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
        )}
      </View>

      <TouchableOpacity
        style={[
          styles.closeButton,
          {
            backgroundColor: theme.isDark ? colors.dark.card : colors.light.card,
          },
        ]}
        onPress={onClose}
        activeOpacity={0.7}
      >
        <X size={20} color={theme.isDark ? colors.dark.onSurface : colors.light.onSurface} />
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
  },
  headerContent: {
    flex: 1,
  },
  titleContainer: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 4,
  },
  title: {
    fontSize: 20,
    fontWeight: "bold",
    marginLeft: 8,
  },
  timestampContainer: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 4,
  },
  timestamp: {
    fontSize: 12,
    marginLeft: 4,
  },
  experimentName: {
    fontSize: 14,
    fontWeight: "500",
  },
  closeButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: "center",
    justifyContent: "center",
    marginLeft: 12,
  },
});
