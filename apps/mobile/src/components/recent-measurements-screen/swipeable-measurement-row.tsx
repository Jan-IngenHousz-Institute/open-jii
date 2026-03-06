import { Trash2, UploadCloud } from "lucide-react-native";
import React, { useEffect } from "react";
import { View, TouchableOpacity } from "react-native";
import { Gesture, GestureDetector } from "react-native-gesture-handler";
import Animated, { useAnimatedStyle, useSharedValue, withSpring } from "react-native-reanimated";
import { Button } from "~/components/Button";
import { MeasurementItem } from "~/components/measurement-item";
import type { MeasurementStatus } from "~/hooks/use-all-measurements";
import { useTheme } from "~/hooks/use-theme";
import { AnswerData } from "~/utils/convert-cycle-answers-to-array";

const SPRING_CONFIG = { damping: 20, stiffness: 300 };
/** Horizontal movement (px) before pan activates - avoids revealing on light touch */
const ACTIVATE_OFFSET_X = 28;
/** Dimensions for action buttons */
const ICON_BUTTON_SIZE = 38;
const COMMENT_BUTTON_WIDTH = 100;
const BUTTON_GAP = 12; // gap-3
const CONTAINER_PADDING = 16; // p-4

interface SwipeableMeasurementRowProps {
  id: string;
  timestamp: string;
  experimentName: string;
  status: MeasurementStatus;
  questions?: AnswerData[];
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
  questions,
  onPress,
  onComment,
  onSync,
  onDelete,
}: SwipeableMeasurementRowProps) {
  const { colors } = useTheme();
  const translateX = useSharedValue(0);
  const startX = useSharedValue(0);

  // Compute action width based on which buttons are actually visible
  const showComment = status === "unsynced" && !!onComment;
  const showSync = status === "unsynced" && !!onSync;
  const showDelete = !!onDelete;

  const visibleCount = [showComment, showSync, showDelete].filter(Boolean).length;
  const buttonWidthSum =
    (showComment ? COMMENT_BUTTON_WIDTH : 0) +
    (showSync ? ICON_BUTTON_SIZE : 0) +
    (showDelete ? ICON_BUTTON_SIZE : 0);
  const actionWidth =
    CONTAINER_PADDING * 2 + buttonWidthSum + Math.max(0, visibleCount - 1) * BUTTON_GAP;

  const actionWidthSV = useSharedValue(actionWidth);

  useEffect(() => {
    actionWidthSV.value = actionWidth;
  }, [actionWidth, actionWidthSV]);

  const panGesture = Gesture.Pan()
    .activeOffsetX([-ACTIVATE_OFFSET_X, ACTIVATE_OFFSET_X])
    .failOffsetY([-18, 18])
    .onStart(() => {
      startX.value = translateX.value;
    })
    .onUpdate((e) => {
      const next = startX.value + e.translationX;
      translateX.value = Math.min(0, Math.max(-actionWidthSV.value, next));
    })
    .onEnd((e) => {
      const snapOpen = translateX.value < -actionWidthSV.value / 2 || e.velocityX < -200;
      translateX.value = withSpring(snapOpen ? -actionWidthSV.value : 0, SPRING_CONFIG);
    });

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: translateX.value }],
  }));

  const handleComment = () => onComment?.(id);
  const handleSync = () => onSync?.(id);
  const handleDelete = () => onDelete?.(id);

  return (
    <View className="overflow-hidden">
      {/* Hidden actions (revealed when swiping left) */}
      <View
        className="absolute bottom-0 right-0 top-0 flex-row justify-center gap-3 overflow-hidden rounded-bl-lg rounded-tl-xl bg-[#CDD5DB] p-4"
        style={{ width: actionWidth }}
      >
        {showComment && (
          <Button
            title="Comment"
            onPress={handleComment}
            variant="tertiary"
            style={{ borderColor: "transparent", width: COMMENT_BUTTON_WIDTH }}
          />
        )}
        {showSync && (
          <View
            style={{ width: ICON_BUTTON_SIZE }}
            className="overflow-hidden rounded-lg bg-[#EDF2F6]"
          >
            <TouchableOpacity
              onPress={handleSync}
              className="flex-1 items-center justify-center"
              activeOpacity={0.7}
            >
              <UploadCloud size={16} color={colors.semantic.info} />
            </TouchableOpacity>
          </View>
        )}

        {onDelete && (
          <View
            style={{ width: ICON_BUTTON_SIZE }}
            className="overflow-hidden rounded-lg bg-[#EDF2F6]"
          >
            <TouchableOpacity
              onPress={handleDelete}
              className="flex-1 items-center justify-center"
              activeOpacity={0.7}
            >
              <Trash2 size={16} color={colors.semantic.error} />
            </TouchableOpacity>
          </View>
        )}
      </View>
      <GestureDetector gesture={panGesture}>
        <Animated.View style={animatedStyle}>
          <MeasurementItem
            id={id}
            timestamp={timestamp}
            experimentName={experimentName}
            status={status}
            questions={questions}
            onPress={onPress}
            hideActions
          />
        </Animated.View>
      </GestureDetector>
    </View>
  );
}
