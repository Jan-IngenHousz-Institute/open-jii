import { CloudOff, UploadCloud, Trash2, ChevronLeft } from "lucide-react-native";
import React from "react";
import { View, Text, StyleSheet, TouchableOpacity } from "react-native";
import { SwipeRow as BaseSwipeRow } from "react-native-swipe-list-view";
import { useTheme } from "~/hooks/use-theme";

interface UnsyncedScanItemProps {
  id: string;
  timestamp: string;
  experimentName: string;
  onSync?: (id: string) => void;
  onDelete?: (id: string) => void;
}

// Override type until library typings are fixed
const SwipeRow = BaseSwipeRow as any;

export function UnsyncedScanItem({
  id,
  timestamp,
  experimentName,
  onSync,
  onDelete,
}: UnsyncedScanItemProps) {
  const theme = useTheme();
  const { colors } = theme;

  return (
    <SwipeRow rightOpenValue={-144} disableRightSwipe>
      {/* Hidden actions */}
      <View style={styles.hiddenRow}>
        <TouchableOpacity
          onPress={() => onSync?.(id)}
          style={[styles.actionButton, { backgroundColor: colors.semantic.info }]}
        >
          <UploadCloud size={25} color="#fff" />
        </TouchableOpacity>
        <TouchableOpacity
          onPress={() => onDelete?.(id)}
          style={[styles.actionButton, { backgroundColor: colors.semantic.error }]}
        >
          <Trash2 size={25} color="#fff" />
        </TouchableOpacity>
      </View>

      {/* Visible content */}
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
        </View>

        {/* Swipe hint icon */}
        <View style={styles.dragHint}>
          <ChevronLeft size={18} color={theme.isDark ? colors.dark.inactive : colors.light.inactive} />
        </View>
      </View>
    </SwipeRow>
  );
}

const styles = StyleSheet.create({
  container: {
    borderRadius: 12,
    padding: 16,
    marginVertical: 8,
    flexDirection: "row",
    alignItems: "center",
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
  hiddenRow: {
    flexDirection: "row",
    justifyContent: "flex-end",
    alignItems: "center",
    height: "100%",
    borderRadius: 12,
    backgroundColor: "#fff",
  },
  actionButton: {
    width: 60,
    height: "50%",
    marginHorizontal: 4,
    borderRadius: 8,
    justifyContent: "center",
    alignItems: "center",
  },
  actionText: {
    color: "#fff",
    fontSize: 12,
  },
  dragHint: {
    justifyContent: "center",
    alignItems: "center",
    paddingLeft: 12,
  },
});
