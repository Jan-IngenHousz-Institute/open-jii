import React from "react";
import { View } from "react-native";
import { vi } from "vitest";

/**
 * Native-module stubs for packages this app imports that wrap real native
 * code (and so can't run in Node). Per RNTL guidance, native modules are the
 * only legitimate mocking boundary in component tests.
 */

// expo-linear-gradient ships JSX in its build output and wraps a native view.
vi.mock("expo-linear-gradient", () => ({
  LinearGradient: ({ children, ...props }: { children?: React.ReactNode }) =>
    React.createElement(View, props, children),
}));

// react-native-reanimated uses a native worklets runtime that doesn't exist
// in Node. Stub the surface we touch in components.
vi.mock("react-native-reanimated", () => {
  const Animated = {
    View: React.forwardRef<unknown, { children?: React.ReactNode; style?: unknown }>(
      ({ children, style: _style, ...rest }, ref) =>
        React.createElement(View, { ...rest, ref }, children),
    ),
  };
  return {
    __esModule: true,
    default: Animated,
    useAnimatedKeyboard: () => ({ height: { value: 0 } }),
    useAnimatedStyle: (fn: () => unknown) => fn(),
    useSharedValue: <T,>(initial: T) => ({ value: initial }),
  };
});

// safe-area-context needs a provider at the root; zero insets work fine for
// component tests.
vi.mock("react-native-safe-area-context", () => ({
  useSafeAreaInsets: () => ({ top: 0, bottom: 0, left: 0, right: 0 }),
  useSafeAreaFrame: () => ({ x: 0, y: 0, width: 320, height: 640 }),
  SafeAreaProvider: ({ children }: { children?: React.ReactNode }) => children,
  SafeAreaView: ({ children, ...props }: { children?: React.ReactNode }) =>
    React.createElement(View, props, children),
}));
