import { MessageSquare, Trash2, UploadCloud } from "lucide-react-native";
import React, { memo, useEffect } from "react";
import { View, TouchableOpacity } from "react-native";
import { Gesture, GestureDetector } from "react-native-gesture-handler";
import Animated, {
  Easing,
  useAnimatedStyle,
  useSharedValue,
  withDelay,
  withSequence,
  withSpring,
  withTiming,
} from "react-native-reanimated";
import { MeasurementItem } from "~/features/recent-measurements/components/measurement-item";
import type { MeasurementStatus } from "~/features/recent-measurements/hooks/use-all-measurements";
import { useIsOnline } from "~/shared/ui/hooks/use-is-online";
import { useTheme } from "~/shared/ui/hooks/use-theme";
import { AnswerData } from "~/shared/utils/convert-cycle-answers-to-array";

const SPRING_CONFIG = { damping: 40, stiffness: 350 };
/** Horizontal movement (px) before pan activates - avoids revealing on light touch */
const ACTIVATE_OFFSET_X = 8;
/** Width of each full-height swipe action segment (icon-only, so narrow). */
const SEGMENT_WIDTH = 52;

interface SwipeableMeasurementRowProps {
  id: string;
  timestamp: string;
  experimentName: string;
  status: MeasurementStatus;
  questions?: AnswerData[];
  onPress?: (id: string) => void;
  onComment?: (id: string) => void;
  onSync?: (id: string) => void;
  onDelete?: (id: string) => void;
  hasComment?: boolean;
  peekToken?: number;
}

export const SwipeableMeasurementRow = memo(function SwipeableMeasurementRow({
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
  peekToken = 0,
}: SwipeableMeasurementRowProps) {
  const { colors } = useTheme();
  const { data: online } = useIsOnline();
  const translateX = useSharedValue(0);
  const startX = useSharedValue(0);
  const actionWidthSV = useSharedValue(0);

  const canFlag = status === "pending" || status === "failed";
  const showComment = canFlag && !!onComment;
  // Hide the upload action when offline — it can't sync anyway.
  const showSync = canFlag && !!onSync && online !== false;
  const showDelete = !!onDelete;

  // Reset swipe offset when status changes AND on recycle (id change) — FlashList
  // reuses the same cell view for a different row, so leftover translateX would
  // make the new row appear pre-opened. Set it instantly (no spring) so a row
  // that was scrolled away open doesn't animate-closed in the recycled cell.
  useEffect(() => {
    translateX.value = 0;
  }, [id, status, translateX]);

  // Discoverability nudge: about a second after the list renders, slowly crack
  // the row open just a bit, hold, then ease it shut. The parent bumps
  // `peekToken` on each focus, so this re-fires on every visit.
  useEffect(() => {
    if (!peekToken) return;
    translateX.value = withDelay(
      1000,
      withSequence(
        withTiming(-36, { duration: 650, easing: Easing.out(Easing.cubic) }),
        withDelay(650, withTiming(0, { duration: 450, easing: Easing.inOut(Easing.cubic) })),
      ),
    );
  }, [peekToken, translateX]);

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
      // Velocity-first: a rightward flick always closes, leftward always opens.
      if (e.velocityX > 150) {
        translateX.value = withSpring(0, SPRING_CONFIG);
      } else if (e.velocityX < -150) {
        translateX.value = withSpring(-actionWidthSV.value, SPRING_CONFIG);
      } else {
        const snapOpen = translateX.value < -actionWidthSV.value / 2;
        translateX.value = withSpring(snapOpen ? -actionWidthSV.value : 0, SPRING_CONFIG);
      }
    });

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: translateX.value }],
  }));

  // Keep the action layer fully transparent at rest so a mount/layout race can
  // never flash the buttons open; ramp it in over the first few px of the swipe.
  const actionsStyle = useAnimatedStyle(() => ({
    opacity: Math.min(1, Math.max(0, translateX.value / -6)),
  }));

  const handleComment = () => onComment?.(id);
  const handleSync = () => onSync?.(id);
  const handleDelete = () => onDelete?.(id);

  return (
    <View className="overflow-hidden">
      {/* Hidden actions (revealed when swiping left) */}
      <Animated.View
        onLayout={(e) => {
          const width = e.nativeEvent.layout.width;
          if (width > 0) {
            actionWidthSV.value = width;
          }
        }}
        style={actionsStyle}
        className="border-divider bg-card absolute bottom-0 right-0 top-0 flex-row border-t"
      >
        {showSync && (
          <TouchableOpacity
            onPress={handleSync}
            activeOpacity={0.7}
            className="items-center justify-center"
            style={{ width: SEGMENT_WIDTH }}
            accessibilityRole="button"
            accessibilityLabel="Upload"
          >
            <UploadCloud size={22} color={colors.semantic.info} strokeWidth={1.8} />
          </TouchableOpacity>
        )}

        {showComment && (
          <TouchableOpacity
            onPress={handleComment}
            activeOpacity={0.7}
            className="items-center justify-center"
            style={{ width: SEGMENT_WIDTH }}
            accessibilityRole="button"
            accessibilityLabel="Comment"
          >
            <MessageSquare size={22} color={colors.onSurface} strokeWidth={1.8} />
          </TouchableOpacity>
        )}

        {showDelete && (
          <TouchableOpacity
            onPress={handleDelete}
            activeOpacity={0.7}
            className="items-center justify-center"
            style={{ width: SEGMENT_WIDTH }}
            accessibilityRole="button"
            accessibilityLabel="Delete"
          >
            <Trash2 size={22} color={colors.semantic.error} strokeWidth={1.8} />
          </TouchableOpacity>
        )}
      </Animated.View>

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
});
