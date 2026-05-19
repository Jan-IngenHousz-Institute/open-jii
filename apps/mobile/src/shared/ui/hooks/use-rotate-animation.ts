import { useEffect, useRef } from "react";
import { Animated, Easing } from "react-native";

interface UseRotateAnimationOptions {
  /** Full-rotation duration in ms. Defaults to 1000. */
  durationMs?: number;
}

/**
 * Continuous 0→1 rotation tied to a boolean (typically a query's `isFetching`
 * flag). Returns an Animated.Value; consumers interpolate it for transforms.
 * When `active` flips false the value resets to 0 so the icon snaps back to
 * neutral instead of pausing mid-spin.
 */
export function useRotateAnimation(
  active: boolean,
  { durationMs = 1000 }: UseRotateAnimationOptions = {},
): Animated.Value {
  const value = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (!active) {
      value.setValue(0);
      return;
    }
    const loop = Animated.loop(
      Animated.timing(value, {
        toValue: 1,
        duration: durationMs,
        easing: Easing.linear,
        useNativeDriver: true,
      }),
    );
    loop.start();
    return () => loop.stop();
  }, [active, durationMs, value]);

  return value;
}
