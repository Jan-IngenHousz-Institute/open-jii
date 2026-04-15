import { Trash2 } from "lucide-react-native";
import React from "react";
import { View, TouchableOpacity } from "react-native";
import { Gesture, GestureDetector } from "react-native-gesture-handler";
import Animated, { useAnimatedStyle, useSharedValue, withSpring } from "react-native-reanimated";
import { Button } from "~/components/Button";
import { MeasurementItem } from "~/components/measurement-item";
import type { MeasurementStatus } from "~/hooks/use-all-measurements";
import { useTheme } from "~/hooks/use-theme";
import { AnswerData } from "~/utils/convert-cycle-answers-to-array";

const SPRING_CONFIG = { damping: 40, stiffness: 350 };
/** Horizontal movement (px) before pan activates - avoids revealing on light touch */
const ACTIVATE_OFFSET_X = 8;
/** Dimensions for action buttons */
const ICON_BUTTON_SIZE = 38;
const COMMENT_BUTTON_WIDTH = 100;

interface SwipeableMeasurementRowProps {
  id: string;
  timestamp: string;
  experimentName: string;
  status: MeasurementStatus;
  questions?: AnswerData[];
  onPress?: () => void;
  onComment?: (id: string) => void;
  onSync?: (id: string, close: () => void) => void;
  onDelete?: (id: string) => void;
  hasComment?: boolean;
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
  hasComment = false,
}: SwipeableMeasurementRowProps) {
  const { colors } = useTheme();
  const translateX = useSharedValue(0);
  const startX = useSharedValue(0);
  const actionWidthSV = useSharedValue(0);

  const showComment = status === "unsynced" && !!onComment;
  const showSync = status === "unsynced" && !!onSync;
  const showDelete = !!onDelete;

  const closeRow = () => {
    translateX.value = withSpring(0, SPRING_CONFIG);
  };

  const panGesture = Gesture.Pan()
    .activeOffsetX([-ACTIVATE_OFFSET_X, ACTIVATE_OFFSET_X])
    .failOffsetY([-10, 10])
    .onStart(() => {
      startX.value = translateX.value;
    })
    .onUpdate((e) => {
      const next = startX.value + e.translationX;
      translateX.value = Math.min(0, Math.max(-actionWidthSV.value, next));
    })
    .onEnd((e) => {
      // Velocity-first: a rightward flick always closes, leftward always opens
      if (e.velocityX > 150) {
        translateX.value = withSpring(0, SPRING_CONFIG);
      } else if (e.velocityX < -150) {
        translateX.value = withSpring(-actionWidthSV.value, SPRING_CONFIG);
      } else {
        // Position-based: snap open past halfway, closed before halfway
        const snapOpen = translateX.value < -actionWidthSV.value / 2;
        translateX.value = withSpring(snapOpen ? -actionWidthSV.value : 0, SPRING_CONFIG);
      }
    });

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: translateX.value }],
  }));

  const handleComment = () => onComment?.(id);
  const handleSync = () => {
    onSync?.(id, closeRow);
  };
  const handleDelete = () => onDelete?.(id);

  return (
    <View className="overflow-hidden">
      {/* Hidden actions (revealed when swiping left) */}
      <View
        onLayout={(e) => {
          const width = e.nativeEvent.layout.width;
          if (width > 0) {
            actionWidthSV.value = width;
          }
        }}
        className="absolute bottom-0 right-0 top-0 flex-row justify-center gap-3 overflow-hidden rounded-bl-lg rounded-tl-xl bg-[#CDD5DB] p-4"
      >
        {showSync && (
          <Button
            title="Upload"
            onPress={handleSync}
            variant="tertiary"
            style={{ borderColor: "transparent", width: COMMENT_BUTTON_WIDTH }}
          />
        )}

        {showComment && (
          <Button
            title="Comment"
            onPress={handleComment}
            variant="light"
            style={{ width: COMMENT_BUTTON_WIDTH }}
          />
        )}

        {showDelete && (
          <View
            style={{ width: ICON_BUTTON_SIZE }}
            className="overflow-hidden rounded-lg bg-[#EDF2F6]"
          >
            <TouchableOpacity
              onPress={handleDelete}
              className="flex-1 items-center justify-center"
              activeOpacity={0.7}
            >
              <Trash2 size={16} color={colors.neutral.black} />
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
            hasComment={hasComment}
          />
        </Animated.View>
      </GestureDetector>
    </View>
  );
}
