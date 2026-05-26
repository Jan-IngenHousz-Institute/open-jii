import React from "react";
import { View } from "react-native";
import { vi } from "vitest";

// Some modules (e.g. environment-store) call loadEnvVariables() at module
// top-level, which reads EXPO_PUBLIC_* vars and throws if any are missing.
// setupFiles run before test-file modules are imported, so seed safe dummy
// values here (||= so real env still wins) to keep module-load from throwing
// in ANY test, regardless of its import graph.
const EXPO_ENV_DEFAULTS: Record<string, string> = {
  EXPO_PUBLIC_PROD_REGION: "test-region",
  EXPO_PUBLIC_PROD_IDENTITY_POOL_ID: "test-identity-pool-id",
  EXPO_PUBLIC_PROD_IOT_ENDPOINT: "test-iot-endpoint",
  EXPO_PUBLIC_PROD_CLIENT_ID: "test-client-id",
  EXPO_PUBLIC_PROD_MQTT_TOPIC: "test-mqtt-topic",
  EXPO_PUBLIC_PROD_NEXT_AUTH_URI: "https://test-next-auth.invalid",
  EXPO_PUBLIC_PROD_BACKEND_URI: "https://test-backend.invalid",
  EXPO_PUBLIC_DEV_REGION: "test-region",
  EXPO_PUBLIC_DEV_IDENTITY_POOL_ID: "test-identity-pool-id",
  EXPO_PUBLIC_DEV_IOT_ENDPOINT: "test-iot-endpoint",
  EXPO_PUBLIC_DEV_CLIENT_ID: "test-client-id",
  EXPO_PUBLIC_DEV_MQTT_TOPIC: "test-mqtt-topic",
  EXPO_PUBLIC_DEV_NEXT_AUTH_URI: "https://test-next-auth.invalid",
  EXPO_PUBLIC_DEV_BACKEND_URI: "https://test-backend.invalid",
  EXPO_PUBLIC_POSTHOG_API_KEY: "test-posthog-api-key",
};
for (const [key, value] of Object.entries(EXPO_ENV_DEFAULTS)) {
  process.env[key] ||= value;
}

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

// expo-location ships expo-modules-core (an EventEmitter that doesn't exist
// outside the RN runtime), so importing it explodes in Node. Component tests
// that transitively pull in time-sync don't exercise geolocation; stub the
// surface our code uses. Tests that need richer behavior override per-file.
vi.mock("expo-location", () => ({
  requestForegroundPermissionsAsync: () => Promise.resolve({ status: "granted" }),
  getCurrentPositionAsync: () => Promise.resolve({ coords: { latitude: 0, longitude: 0 } }),
  Accuracy: { Lowest: 1, Low: 2, Balanced: 3, High: 4, Highest: 5 },
}));

// expo-network ships expo-modules-core (an EventEmitter that doesn't exist
// outside the RN runtime). Tests that don't care about connectivity get a
// no-op listener + always-online status.
vi.mock("expo-network", () => ({
  addNetworkStateListener: () => ({ remove: () => undefined }),
  useNetworkState: () => ({ isInternetReachable: true, isConnected: true, type: "WIFI" }),
  NetworkStateType: { WIFI: "WIFI", CELLULAR: "CELLULAR", NONE: "NONE", UNKNOWN: "UNKNOWN" },
}));

// expo-sqlite wraps a native module. Component tests that pull in the upload
// queue (transitively via useIsProcessing) shouldn't have to spin up a real
// DB. Mock the shared client to a no-op shape; storage-level tests that
// need real SQL substitute their own `~/shared/db/client` mock inside the
// test file (vi.mock is hoisted per-file and overrides this default).
vi.mock("~/shared/db/client", () => ({
  db: {
    select: () => ({
      from: () => ({ where: () => ({ get: () => null, all: () => [] }), all: () => [] }),
    }),
    insert: () => ({
      values: () => ({
        run: () => undefined,
        onConflictDoNothing: () => ({ run: () => undefined }),
      }),
    }),
    update: () => ({
      set: () => ({
        where: () => ({ run: () => undefined, returning: () => ({ all: () => [] }) }),
      }),
    }),
    delete: () => ({ where: () => ({ run: () => ({ changes: 0 }) }) }),
  },
}));

// The upload composition root (getOutbox/getTransport) is a singleton that
// eagerly wires the MQTT transport, paho session, AWS IoT auth and a chain of
// native modules — none of which run under Node. Component tests that render a
// measurement row reach it transitively via useIsProcessing/useOutboxSnapshot.
// Stub the composition root to an inert Outbox/Transport so those tests render
// without spinning up (or import-crashing on) the real upload pipeline.
// Storage/transport tests that need the real thing mock it per-file.
vi.mock("~/shared/composition/upload", () => {
  const noopUnsub = () => undefined;
  const outbox = {
    enqueue: () => undefined,
    isProcessing: () => false,
    subscribeProcessing: () => noopUnsub,
    getSnapshot: () => ({ isUploading: false, count: 0 }),
    subscribeSnapshot: () => noopUnsub,
    destroy: () => undefined,
  };
  const transport = {
    publish: () => Promise.resolve(),
    destroy: () => undefined,
  };
  return {
    getOutbox: () => outbox,
    getTransport: () => transport,
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
