import { BottomTabBar } from "@react-navigation/bottom-tabs";
import type { BottomTabBarProps } from "@react-navigation/bottom-tabs";
import React, { useEffect, useState } from "react";
import Animated, {
  Easing,
  useAnimatedStyle,
  useDerivedValue,
  useSharedValue,
  withTiming,
} from "react-native-reanimated";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { scheduleOnRN } from "react-native-worklets";

interface AnimatedTabBarProps extends BottomTabBarProps {
  hidden: boolean;
}

const DURATION_MS = 240;
const FALLBACK_HEIGHT = 60;

/**
 * Slides the bottom tab bar off-screen when `hidden=true` instead of
 * unmounting it. Stays mounted to avoid layout reflow in the tab navigator.
 */
export function AnimatedTabBar({ hidden, ...props }: AnimatedTabBarProps) {
  const insets = useSafeAreaInsets();
  const measuredHeight = useSharedValue(FALLBACK_HEIGHT + insets.bottom);
  const progress = useSharedValue(hidden ? 1 : 0);
  const [pointerEventsValue, setPointerEventsValue] = useState<"auto" | "none">(
    hidden ? "none" : "auto",
  );

  useEffect(() => {
    progress.value = withTiming(hidden ? 1 : 0, {
      duration: DURATION_MS,
      easing: Easing.out(Easing.cubic),
    });
  }, [hidden, progress]);

  useDerivedValue(() => {
    const next = progress.value >= 0.999 ? "none" : "auto";
    scheduleOnRN(setPointerEventsValue, next);
  });

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ translateY: progress.value * measuredHeight.value }],
    opacity: 1 - progress.value,
  }));

  return (
    <Animated.View
      style={[
        {
          position: "absolute",
          left: 0,
          right: 0,
          bottom: 0,
          pointerEvents: pointerEventsValue,
        },
        animatedStyle,
      ]}
      onLayout={(e) => {
        const next = e.nativeEvent.layout.height;
        if (next > 0) measuredHeight.value = next;
      }}
    >
      <BottomTabBar {...props} />
    </Animated.View>
  );
}
