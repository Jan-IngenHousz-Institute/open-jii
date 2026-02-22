import { clsx } from "clsx";
import { MessageCircle, Trash2, UploadCloud } from "lucide-react-native";
import React from "react";
import { View, TouchableOpacity } from "react-native";
import { Gesture, GestureDetector } from "react-native-gesture-handler";
import Animated, { useAnimatedStyle, useSharedValue, withSpring } from "react-native-reanimated";
import { MeasurementItem } from "~/components/measurement-item";
import type { MeasurementStatus } from "~/hooks/use-all-measurements";
import { useTheme } from "~/hooks/use-theme";

/** Width for swipe actions: Comment + Upload (if unsynced) + Delete */
const ACTION_WIDTH = 144;
const SPRING_CONFIG = { damping: 20, stiffness: 300 };
/** Horizontal movement (px) before pan activates - avoids revealing on light touch */
const ACTIVATE_OFFSET_X = 28;

interface SwipeableMeasurementRowProps {
  id: string;
  timestamp: string;
  experimentName: string;
  status: MeasurementStatus;
  onPress?: () => void;
  onComment?: (id: string) => void;
  onSync?: (id: string) => void;
  onDelete?: (id: string) => void;
}

export function SwipeableMeasurementRow({
  id,
  timestamp,
  experimentName,
  status,
  onPress,
  onComment,
  onSync,
  onDelete,
}: SwipeableMeasurementRowProps) {
  const { colors, classes } = useTheme();
  const translateX = useSharedValue(0);
  const startX = useSharedValue(0);

  const panGesture = Gesture.Pan()
    .activeOffsetX([-ACTIVATE_OFFSET_X, ACTIVATE_OFFSET_X])
    .failOffsetY([-18, 18])
    .onStart(() => {
      startX.value = translateX.value;
    })
    .onUpdate((e) => {
      const next = startX.value + e.translationX;
      translateX.value = Math.min(0, Math.max(-ACTION_WIDTH, next));
    })
    .onEnd((e) => {
      const snapOpen = translateX.value < -ACTION_WIDTH / 2 || e.velocityX < -200;
      translateX.value = withSpring(snapOpen ? -ACTION_WIDTH : 0, SPRING_CONFIG);
    });

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: translateX.value }],
  }));

  const handleComment = () => onComment?.(id);
  const handleSync = () => onSync?.(id);
  const handleDelete = () => onDelete?.(id);

  return (
    <View className={clsx("overflow-hidden rounded-lg", classes.card)} style={{ minHeight: 60 }}>
      {/* Hidden actions (revealed when swiping left) - full height, no padding/margin except gap between */}
      <View
        style={{
          position: "absolute",
          right: 0,
          top: 0,
          bottom: 0,
          width: ACTION_WIDTH,
          flexDirection: "row",
          alignItems: "stretch",
          gap: 4,
        }}
      >
        {status === "unsynced" && onComment && (
          <TouchableOpacity
            onPress={handleComment}
            style={{
              flex: 1,
              backgroundColor: colors.surface,
              justifyContent: "center",
              alignItems: "center",
              borderRightWidth: 1,
              borderRightColor: colors.border,
            }}
            activeOpacity={0.8}
          >
            <MessageCircle size={20} color={colors.onSurface} />
          </TouchableOpacity>
        )}
        {status === "unsynced" && onSync && (
          <TouchableOpacity
            onPress={handleSync}
            style={{
              flex: 1,
              backgroundColor: colors.semantic.info,
              justifyContent: "center",
              alignItems: "center",
            }}
            activeOpacity={0.8}
          >
            <UploadCloud size={20} color="#fff" />
          </TouchableOpacity>
        )}
        {onDelete && (
          <TouchableOpacity
            onPress={handleDelete}
            style={{
              flex: 1,
              backgroundColor: colors.semantic.error,
              justifyContent: "center",
              alignItems: "center",
            }}
            activeOpacity={0.8}
          >
            <Trash2 size={20} color="#fff" />
          </TouchableOpacity>
        )}
      </View>

      <GestureDetector gesture={panGesture}>
        <Animated.View style={[{ flex: 1 }, animatedStyle]}>
          <MeasurementItem
            id={id}
            timestamp={timestamp}
            experimentName={experimentName}
            status={status}
            onPress={onPress}
            hideActions
          />
        </Animated.View>
      </GestureDetector>
    </View>
  );
}
