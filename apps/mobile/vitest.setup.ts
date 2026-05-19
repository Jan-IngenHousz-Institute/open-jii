import React from "react";
import { View } from "react-native";
import { vi } from "vitest";

/**
 * Native-module stubs for packages this app imports that wrap real native
 * code (and so can't run in Node). Per RNTL guidance, native modules are the
 * only legitimate mocking boundary in component tests.
 */

// AsyncStorage wraps a native module that doesn't resolve under Node. Stub
// with an in-memory store so persisted Zustand slices don't reject during
// setState writes. (Stores that read on construction get an empty map.)
vi.mock("@react-native-async-storage/async-storage", () => {
  const store = new Map<string, string>();
  const api = {
    setItem: vi.fn(async (key: string, value: string) => {
      store.set(key, value);
    }),
    getItem: vi.fn(async (key: string) => store.get(key) ?? null),
    removeItem: vi.fn(async (key: string) => {
      store.delete(key);
    }),
    clear: vi.fn(async () => {
      store.clear();
    }),
    getAllKeys: vi.fn(async () => Array.from(store.keys())),
    multiGet: vi.fn(async (keys: string[]) => keys.map((k) => [k, store.get(k) ?? null])),
    multiSet: vi.fn(async (pairs: [string, string][]) => {
      for (const [k, v] of pairs) store.set(k, v);
    }),
    multiRemove: vi.fn(async (keys: string[]) => {
      for (const k of keys) store.delete(k);
    }),
  };
  return { __esModule: true, default: api };
});

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
        React.createElement(View, { ...rest, ref } as any, children),
    ),
  };
  return {
    __esModule: true,
    default: Animated,
    useAnimatedKeyboard: () => ({ height: { value: 0 } }),
    useAnimatedStyle: (fn: () => unknown) => fn(),
    useSharedValue: <T>(initial: T) => ({ value: initial }),
    withSpring: (v: unknown) => v,
  };
});

// @gorhom/bottom-sheet pulls react-native-gesture-handler -> a native
// component that doesn't resolve under Node. The component tests don't open
// modals, so stub the surface to inert views.
vi.mock("@gorhom/bottom-sheet", () => {
  const passthrough = ({ children, ...props }: { children?: React.ReactNode }) =>
    React.createElement(View, props, children);
  // Real BottomSheetModal hides children until present() is called via ref.
  // Render null so component tests that don't open the sheet don't see modal
  // contents in the tree.
  const BottomSheetModal = React.forwardRef<unknown, { children?: React.ReactNode }>(
    (_props, ref) => {
      React.useImperativeHandle(ref, () => ({
        present: () => undefined,
        dismiss: () => undefined,
      }));
      return null;
    },
  );
  return {
    __esModule: true,
    default: passthrough,
    BottomSheetModal,
    BottomSheetModalProvider: passthrough,
    BottomSheetView: passthrough,
    BottomSheetBackdrop: passthrough,
    BottomSheetTextInput: passthrough,
    BottomSheetScrollView: passthrough,
  };
});

// nativewind transitively imports react-native-css-interop's web stylesheet
// at module load, which touches `document.documentElement` and explodes in
// the Node test env. Stub the surface our code uses (useColorScheme,
// colorScheme.set, the JSX runtime preset).
vi.mock("nativewind", () => ({
  useColorScheme: () => ({
    colorScheme: "light",
    setColorScheme: () => undefined,
    toggleColorScheme: () => undefined,
  }),
  colorScheme: {
    get: () => "light",
    set: () => undefined,
  },
  vars: (input: Record<string, string>) => input,
  cssInterop: () => undefined,
  remapProps: () => undefined,
}));

// safe-area-context needs a provider at the root; zero insets work fine for
// component tests.
vi.mock("react-native-safe-area-context", () => ({
  useSafeAreaInsets: () => ({ top: 0, bottom: 0, left: 0, right: 0 }),
  useSafeAreaFrame: () => ({ x: 0, y: 0, width: 320, height: 640 }),
  SafeAreaProvider: ({ children }: { children?: React.ReactNode }) => children,
  SafeAreaView: ({ children, ...props }: { children?: React.ReactNode }) =>
    React.createElement(View, props, children),
}));
