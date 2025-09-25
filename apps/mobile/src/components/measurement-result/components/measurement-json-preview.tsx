import { X } from "lucide-react-native";
import React from "react";
import { StyleSheet } from "react-native";
import { ScrollView, Text, TouchableOpacity, View } from "react-native";
import { useTheme } from "~/hooks/use-theme";
import { formatIsoDateString } from "~/utils/format-iso-date-string";

export function MeasurementJsonPreview({ data, timestamp, experimentName, onClose }) {
  const theme = useTheme();
  const { colors } = theme;
  return (
    <View
      style={[
        styles.fullScreenContainer,
        {
          backgroundColor: theme.isDark ? colors.dark.background : colors.light.background,
        },
      ]}
    >
      <View
        style={[
          styles.fullScreenHeader,
          {
            backgroundColor: theme.isDark ? colors.dark.surface : colors.light.surface,
            borderBottomColor: theme.isDark ? colors.dark.border : colors.light.border,
          },
        ]}
      >
        <View style={styles.headerContent}>
          <Text
            style={[
              styles.fullScreenTitle,
              {
                color: theme.isDark ? colors.dark.onSurface : colors.light.onSurface,
              },
            ]}
          >
            Measurement Result
          </Text>
          {timestamp && (
            <Text
              style={[
                styles.fullScreenTimestamp,
                {
                  color: theme.isDark ? colors.dark.inactive : colors.light.inactive,
                },
              ]}
            >
              {formatIsoDateString(timestamp)}
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

      <View
        style={[
          styles.fullScreenContent,
          {
            backgroundColor: theme.isDark ? colors.dark.card : colors.light.card,
          },
        ]}
      >
        {experimentName && (
          <Text
            style={[
              styles.fullScreenExperiment,
              {
                color: theme.isDark ? colors.dark.onSurface : colors.light.onSurface,
              },
            ]}
          >
            Experiment: {experimentName}
          </Text>
        )}

        <ScrollView
          style={[
            styles.fullScreenDataContainer,
            {
              backgroundColor: theme.isDark ? colors.dark.background : colors.light.background,
            },
          ]}
          showsVerticalScrollIndicator={true}
        >
          <Text
            style={[
              styles.fullScreenDataText,
              {
                color: theme.isDark ? colors.dark.onSurface : colors.light.onSurface,
              },
            ]}
          >
            {data}
          </Text>
        </ScrollView>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  fullScreenContainer: {
    flex: 1,
  },
  fullScreenHeader: {
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
  fullScreenTitle: {
    fontSize: 18,
    fontWeight: "bold",
  },
  fullScreenTimestamp: {
    fontSize: 12,
    marginTop: 2,
  },
  closeButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: "center",
    justifyContent: "center",
  },
  fullScreenContent: {
    flex: 1,
    margin: 16,
    borderRadius: 12,
    padding: 16,
  },
  fullScreenExperiment: {
    fontSize: 16,
    fontWeight: "600",
    marginBottom: 12,
  },
  fullScreenDataContainer: {
    flex: 1,
    borderRadius: 8,
    padding: 12,
  },
  fullScreenDataText: {
    fontFamily: "monospace",
    fontSize: 14,
    lineHeight: 20,
  },
});
