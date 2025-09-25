import { X, Maximize2 } from "lucide-react-native";
import React, { useState } from "react";
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, Modal } from "react-native";
import { useTheme } from "~/hooks/use-theme";
import { formatIsoDateString } from "~/utils/format-iso-date-string";

interface MeasurementResultProps {
  data: any;
  timestamp?: string;
  experimentName?: string;
}

export function MeasurementResult({ data, timestamp, experimentName }: MeasurementResultProps) {
  const theme = useTheme();
  const { colors } = theme;
  const [isFullScreen, setIsFullScreen] = useState(false);

  const formattedData = JSON.stringify(data, null, 2);

  const content = (
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
            {formattedData}
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
          onPress={() => setIsFullScreen(true)}
          activeOpacity={0.7}
        >
          <Maximize2 size={14} color={colors.primary.dark} />
        </TouchableOpacity>
      </View>
    </>
  );

  return (
    <>
      <View
        style={[
          styles.container,
          {
            backgroundColor: theme.isDark ? colors.dark.card : colors.light.card,
          },
        ]}
      >
        {content}
      </View>

      <Modal
        visible={isFullScreen}
        animationType="fade"
        presentationStyle="fullScreen"
        onRequestClose={() => setIsFullScreen(false)}
      >
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
              onPress={() => setIsFullScreen(false)}
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
                {formattedData}
              </Text>
            </ScrollView>
          </View>
        </View>
      </Modal>
    </>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    borderRadius: 12,
    padding: 16,
  },
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
  dataContainer: {
    flex: 1,
    borderRadius: 8,
    padding: 12,
  },
  dataText: {
    fontFamily: "monospace",
    fontSize: 12,
  },
  previewContainer: {
    position: "relative",
    flex: 1,
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
