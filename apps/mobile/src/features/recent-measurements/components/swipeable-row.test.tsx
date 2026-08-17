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

vi.mock("react-native-gesture-handler", () => {
  const GestureDetector = ({ children }: { children?: React.ReactNode }) =>
    React.createElement(React.Fragment, null, children);
  const Gesture = {
    Pan: () => ({
      activeOffsetX: () => Gesture.Pan(),
      failOffsetY: () => Gesture.Pan(),
      onStart: () => Gesture.Pan(),
      onUpdate: () => Gesture.Pan(),
      onEnd: () => Gesture.Pan(),
    }),
  };
  return { __esModule: true, GestureDetector, Gesture };
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
});
