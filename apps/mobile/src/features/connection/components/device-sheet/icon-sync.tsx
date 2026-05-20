import { RotateCw } from "lucide-react-native";
import React, { useEffect } from "react";
import Animated, {
  Easing,
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withTiming,
  cancelAnimation,
} from "react-native-reanimated";

interface IconSyncProps {
  size?: number;
  color?: string;
  spinning?: boolean;
}

export function IconSync({ size = 14, color = "#005e5e", spinning = false }: IconSyncProps) {
  const angle = useSharedValue(0);

  useEffect(() => {
    if (spinning) {
      angle.value = 0;
      angle.value = withRepeat(withTiming(360, { duration: 800, easing: Easing.linear }), -1);
    } else {
      cancelAnimation(angle);
      angle.value = 0;
    }
  }, [spinning, angle]);

  const style = useAnimatedStyle(() => ({
    transform: [{ rotate: `${angle.value}deg` }],
  }));

  return (
    <Animated.View style={style}>
      <RotateCw size={size} color={color} />
    </Animated.View>
  );
}
