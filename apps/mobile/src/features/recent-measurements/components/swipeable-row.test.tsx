import { render, screen, fireEvent } from "@testing-library/react-native";
import React from "react";
import { Text, View } from "react-native";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { SwipeableRow } from "./swipeable-row";

vi.mock("~/shared/i18n", () => ({
  useTranslation: () => ({
    t: (key: string) =>
      ({
        "swipe.uploadButton": "Upload",
        "swipe.commentButton": "Comment",
        "swipe.deleteButton": "Delete",
      })[key] ?? key,
  }),
}));

const { mockUseIsOnline } = vi.hoisted(() => ({
  mockUseIsOnline: vi.fn((): { data: boolean | undefined } => ({ data: true })),
}));
vi.mock("~/shared/ui/hooks/use-is-online", () => ({
  useIsOnline: () => mockUseIsOnline(),
}));

interface PanHandlers {
  onStart?: () => void;
  onUpdate?: (e: { translationX: number }) => void;
  onEnd?: (e: { velocityX: number }) => void;
}

// Records the pan callbacks so a test can drive them: on a device they run on
// the UI runtime, and a gesture stub that drops them leaves that logic unrun.
const { panHandlers } = vi.hoisted<{ panHandlers: PanHandlers }>(() => ({
  panHandlers: {},
}));

vi.mock("react-native-gesture-handler", () => {
  const GestureDetector = ({ children }: { children?: React.ReactNode }) =>
    React.createElement(React.Fragment, null, children);
  const builder = {
    activeOffsetX: () => builder,
    failOffsetY: () => builder,
    onStart: (fn: () => void) => {
      panHandlers.onStart = fn;
      return builder;
    },
    onUpdate: (fn: (e: { translationX: number }) => void) => {
      panHandlers.onUpdate = fn;
      return builder;
    },
    onEnd: (fn: (e: { velocityX: number }) => void) => {
      panHandlers.onEnd = fn;
      return builder;
    },
  };
  return { __esModule: true, GestureDetector, Gesture: { Pan: () => builder } };
});

// Overrides the global setup mock so the spring target (the resolved snap) is
// observable. withSpring stays an identity stub: assigning its return settles
// the shared value synchronously.
const { springSpy } = vi.hoisted(() => ({ springSpy: vi.fn() }));
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
    useAnimatedStyle: (fn: () => unknown) => fn(),
    useSharedValue: <T,>(initial: T) => ({ value: initial }),
    cancelAnimation: () => undefined,
    withSpring: (v: unknown) => {
      springSpy(v);
      return v;
    },
    withTiming: (v: unknown) => v,
    withDelay: (_delay: number, v: unknown) => v,
    withSequence: (...steps: unknown[]) => steps[0],
    Easing: {
      inOut: (e: unknown) => e,
      in: (e: unknown) => e,
      out: (e: unknown) => e,
      cubic: (t: number) => t,
    },
  };
});

function renderRow(props: Partial<React.ComponentProps<typeof SwipeableRow>> = {}) {
  return render(
    <SwipeableRow id="m1" status="pending" {...props}>
      <Text>row body</Text>
    </SwipeableRow>,
  );
}

beforeEach(() => {
  vi.clearAllMocks();
  mockUseIsOnline.mockReturnValue({ data: true });
});

describe("SwipeableRow", () => {
  it("renders whatever content it wraps", () => {
    renderRow();
    expect(screen.getByText("row body")).toBeTruthy();
  });

  it("offers upload and comment for an unsynced row, delete always", () => {
    renderRow({ onSync: vi.fn(), onComment: vi.fn(), onDelete: vi.fn() });

    expect(screen.getByLabelText("Upload")).toBeTruthy();
    expect(screen.getByLabelText("Comment")).toBeTruthy();
    expect(screen.getByLabelText("Delete")).toBeTruthy();
  });

  it("drops upload and comment once the row is synced", () => {
    renderRow({ status: "successful", onSync: vi.fn(), onComment: vi.fn(), onDelete: vi.fn() });

    expect(screen.queryByLabelText("Upload")).toBeNull();
    expect(screen.queryByLabelText("Comment")).toBeNull();
    expect(screen.getByLabelText("Delete")).toBeTruthy();
  });

  it("hides upload while offline, since it cannot sync anyway", () => {
    mockUseIsOnline.mockReturnValue({ data: false });
    renderRow({ onSync: vi.fn(), onDelete: vi.fn() });

    expect(screen.queryByLabelText("Upload")).toBeNull();
    expect(screen.getByLabelText("Delete")).toBeTruthy();
  });

  it("reports the row id to each action", () => {
    const onSync = vi.fn();
    const onComment = vi.fn();
    const onDelete = vi.fn();
    renderRow({ id: "run:2026-05-18:abc", onSync, onComment, onDelete });

    fireEvent.press(screen.getByLabelText("Upload"));
    fireEvent.press(screen.getByLabelText("Comment"));
    fireEvent.press(screen.getByLabelText("Delete"));

    expect(onSync).toHaveBeenCalledWith("run:2026-05-18:abc");
    expect(onComment).toHaveBeenCalledWith("run:2026-05-18:abc");
    expect(onDelete).toHaveBeenCalledWith("run:2026-05-18:abc");
  });

  it("omits an action entirely when no handler is given", () => {
    renderRow({ onDelete: vi.fn() });

    expect(screen.queryByLabelText("Upload")).toBeNull();
    expect(screen.queryByLabelText("Comment")).toBeNull();
  });

  it("runs the peek hint without error", () => {
    renderRow({ peekToken: 3 });
    expect(screen.getByText("row body")).toBeTruthy();
  });

  it("tints the action layer to match the row being swiped", () => {
    const cases = [
      { props: {}, tint: "bg-card" },
      { props: { indented: true }, tint: "bg-jii-mint-light" },
      { props: { expanded: true }, tint: "bg-jii-mint" },
    ] as const;
    for (const { props, tint } of cases) {
      const { unmount } = renderRow({ onDelete: vi.fn(), ...props });
      expect(screen.getByTestId("swipe-actions").props.className).toContain(tint);
      unmount();
    }
  });

  it("clamps the drag to the measured action width and snaps on release", () => {
    renderRow({ onSync: vi.fn(), onDelete: vi.fn() });

    // The action layer measures itself before a swipe can be clamped to it.
    fireEvent(screen.getByTestId("swipe-actions"), "layout", {
      nativeEvent: { layout: { width: 104 } },
    });

    panHandlers.onStart?.();
    panHandlers.onUpdate?.({ translationX: -60 });
    // Past the halfway point of a 104-wide layer, a slow release opens.
    panHandlers.onEnd?.({ velocityX: 0 });
    expect(springSpy).toHaveBeenLastCalledWith(-104);

    panHandlers.onStart?.();
    // A rightward drag past fully closed clamps at 0; the flick snaps shut.
    panHandlers.onUpdate?.({ translationX: 200 });
    panHandlers.onEnd?.({ velocityX: 800 });
    expect(springSpy).toHaveBeenLastCalledWith(0);
  });
});
