import { render, screen, fireEvent } from "@testing-library/react-native";
import React from "react";
import { Text } from "react-native";
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

  it("renders the tinted variants used under an expanded run", () => {
    renderRow({ indented: true, onDelete: vi.fn() });
    expect(screen.getByText("row body")).toBeTruthy();

    renderRow({ expanded: true, onDelete: vi.fn() });
    expect(screen.getAllByText("row body").length).toBeGreaterThan(0);
  });

  it("drives a drag through the pan handlers without error", () => {
    renderRow({ onSync: vi.fn(), onDelete: vi.fn() });

    // The action layer measures itself before a swipe can be clamped to it.
    const actionLayer = screen.getByLabelText("Delete").parent;
    if (actionLayer) {
      fireEvent(actionLayer, "layout", { nativeEvent: { layout: { width: 104 } } });
    }

    expect(panHandlers.onStart).toBeDefined();
    panHandlers.onStart?.();
    panHandlers.onUpdate?.({ translationX: -60 });
    panHandlers.onUpdate?.({ translationX: 40 });
    panHandlers.onEnd?.({ velocityX: -800 });
    panHandlers.onEnd?.({ velocityX: 800 });

    expect(screen.getByText("row body")).toBeTruthy();
  });
});
