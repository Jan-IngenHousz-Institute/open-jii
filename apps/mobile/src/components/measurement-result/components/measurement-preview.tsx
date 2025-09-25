import { Maximize2 } from "lucide-react-native";
import React from "react";
import { View, Text, StyleSheet, ScrollView, TouchableOpacity } from "react-native";
import { useTheme } from "~/hooks/use-theme";
import { formatIsoDateString } from "~/utils/format-iso-date-string";

interface Props {
  data: any;
  timestamp?: string;
  experimentName?: string;
  onExpand: () => void;
}

export function MeasurementPreview({ data, timestamp, experimentName, onExpand }: Props) {
  const theme = useTheme();
  const { colors } = theme;

  return (
    <>
      <View style={styles.header}>
        {timestamp && (
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

      <View style={styles.previewContainer}>
        <ScrollView
          style={[
            styles.dataContainer,
            {
              backgroundColor: theme.isDark ? colors.dark.background : colors.light.background,
            },
          ]}
          nestedScrollEnabled={true}
          showsVerticalScrollIndicator={true}
        >
          <Text
            style={[
              styles.dataText,
              {
                color: theme.isDark ? colors.dark.onSurface : colors.light.onSurface,
              },
            ]}
          >
            {JSON.stringify(data, null, 2)}
          </Text>
        </ScrollView>

        <TouchableOpacity
          style={[
            styles.floatingExpandButton,
            {
              backgroundColor: theme.isDark ? colors.dark.surface : colors.light.surface,
              borderColor: theme.isDark ? colors.dark.border : colors.light.border,
            },
          ]}
          onPress={onExpand}
          activeOpacity={0.7}
        >
          <Maximize2 size={14} color={colors.primary.dark} />
        </TouchableOpacity>
      </View>
    </>
  );
}

const styles = StyleSheet.create({
  header: {
    marginBottom: 8,
  },
  timestamp: {
    fontSize: 12,
    textAlign: "right",
  },
  experimentName: {
    fontSize: 14,
    fontWeight: "600",
    marginTop: 4,
  },
  previewContainer: {
    position: "relative",
    flex: 1,
  },
  dataContainer: {
    flex: 1,
    borderRadius: 8,
    padding: 12,
  },
  dataText: {
    fontFamily: "monospace",
    fontSize: 12,
  },
  floatingExpandButton: {
    position: "absolute",
    top: 8,
    right: 8,
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    shadowColor: "#000",
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.25,
    shadowRadius: 3.84,
    elevation: 5,
  },
});
