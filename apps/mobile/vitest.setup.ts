import React from "react";
import { View } from "react-native";
import { vi } from "vitest";

/**
 * Native-module stubs — these wrap actual native code that can't run in Node.
 * Per RNTL guidance, native modules are the legitimate mocking boundary.
 */

// expo-linear-gradient ships JSX in its build output (not pre-compiled down
// to React.createElement) and wraps a native view.
vi.mock("expo-linear-gradient", () => ({
  LinearGradient: ({ children, ...props }: { children?: React.ReactNode }) =>
    React.createElement(View, props, children),
}));

// Safe-area context needs a provider at the root; the library ships a sane
// zero-inset stub that works for testing.
vi.mock("react-native-safe-area-context", () => ({
  useSafeAreaInsets: () => ({ top: 0, bottom: 0, left: 0, right: 0 }),
  useSafeAreaFrame: () => ({ x: 0, y: 0, width: 320, height: 640 }),
  SafeAreaProvider: ({ children }: { children?: React.ReactNode }) => children,
  SafeAreaView: ({ children, ...props }: { children?: React.ReactNode }) =>
    React.createElement(View, props, children),
}));

// react-native-reanimated uses a native worklets runtime that doesn't exist
// in Node. Stub the surface we actually touch in components.
vi.mock("react-native-reanimated", async () => {
  const ReactModule = await import("react");
  const rn = await import("react-native");
  const Animated = {
    View: ReactModule.forwardRef<any, any>(({ children, style: _style, ...rest }, ref) =>
      ReactModule.createElement(rn.View, { ...rest, ref }, children),
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
