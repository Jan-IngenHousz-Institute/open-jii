import { render, screen, fireEvent } from "@testing-library/react-native";
import React from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { SwipeableMeasurementRow } from "./swipeable-measurement-row";

vi.mock("~/shared/i18n", () => ({
  useTranslation: () => ({
    t: (key: string) => {
      const map: Record<string, string> = {
        "recentMeasurements:swipe.uploadButton": "Upload",
        "recentMeasurements:swipe.commentButton": "Comment",
      };
      return map[key] ?? key;
    },
  }),
}));

// The row reads connectivity to hide the upload action when offline. Controllable
// per-test via mockUseIsOnline; defaults to online. Avoids a QueryClientProvider.
const { mockUseIsOnline } = vi.hoisted(() => ({
  mockUseIsOnline: vi.fn((): { data: boolean | undefined } => ({ data: true })),
}));
vi.mock("~/shared/ui/hooks/use-is-online", () => ({
  useIsOnline: () => mockUseIsOnline(),
}));

// react-native-gesture-handler uses native code; stub the gesture surface.
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

const defaultProps = {
  id: "m1",
  timestamp: "2026-04-20T10:00:00.000Z",
  experimentName: "Photosynthesis",
  status: "pending" as const,
};

describe("SwipeableMeasurementRow", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockUseIsOnline.mockReturnValue({ data: true });
  });

  it("renders the experiment name", () => {
    render(<SwipeableMeasurementRow {...defaultProps} />);
    expect(screen.getByText("Photosynthesis")).toBeTruthy();
  });

  it("shows the Upload button for unsynced rows when onSync is provided", () => {
    render(<SwipeableMeasurementRow {...defaultProps} status="pending" onSync={vi.fn()} />);
    expect(screen.getByLabelText("Upload")).toBeTruthy();
  });

  it("does not show the Upload button for synced rows", () => {
    render(<SwipeableMeasurementRow {...defaultProps} status="successful" onSync={vi.fn()} />);
    expect(screen.queryByLabelText("Upload")).toBeNull();
  });

  it("hides the Upload button when offline, even for an unsynced row", () => {
    mockUseIsOnline.mockReturnValue({ data: false });
    render(<SwipeableMeasurementRow {...defaultProps} status="pending" onSync={vi.fn()} />);
    expect(screen.queryByLabelText("Upload")).toBeNull();
  });

  it("shows the Comment button for unsynced rows when onComment is provided", () => {
    render(<SwipeableMeasurementRow {...defaultProps} status="pending" onComment={vi.fn()} />);
    expect(screen.getByLabelText("Comment")).toBeTruthy();
  });

  it("does not show the Comment button for synced rows", () => {
    render(<SwipeableMeasurementRow {...defaultProps} status="successful" onComment={vi.fn()} />);
    expect(screen.queryByLabelText("Comment")).toBeNull();
  });

  it("calls onDelete with the row id when the delete button is pressed", () => {
    const onDelete = vi.fn();
    render(<SwipeableMeasurementRow {...defaultProps} status="successful" onDelete={onDelete} />);
    fireEvent.press(screen.getByLabelText("Delete"));
    expect(onDelete).toHaveBeenCalledWith("m1");
  });

  it("calls onPress when the row body is pressed", () => {
    const onPress = vi.fn();
    render(<SwipeableMeasurementRow {...defaultProps} onPress={onPress} />);
    fireEvent.press(screen.getByText("Photosynthesis"));
    expect(onPress).toHaveBeenCalled();
  });

  it("calls onSync with the row id when Upload is pressed", () => {
    const onSync = vi.fn();
    render(<SwipeableMeasurementRow {...defaultProps} onSync={onSync} />);
    fireEvent.press(screen.getByLabelText("Upload"));
    expect(onSync).toHaveBeenCalledWith("m1");
  });

  it("calls onComment with the row id when Comment is pressed", () => {
    const onComment = vi.fn();
    render(<SwipeableMeasurementRow {...defaultProps} onComment={onComment} />);
    fireEvent.press(screen.getByLabelText("Comment"));
    expect(onComment).toHaveBeenCalledWith("m1");
  });

  it("shows questions answers when provided", () => {
    render(
      <SwipeableMeasurementRow
        {...defaultProps}
        questions={[
          { question_label: "q1", question_text: "What?", question_answer: "Yes" },
          { question_label: "q2", question_text: "How?", question_answer: "Fast" },
        ]}
      />,
    );
    expect(screen.getByText(/Yes/)).toBeTruthy();
    expect(screen.getByText(/Fast/)).toBeTruthy();
  });

  it("runs the peek hint without error when peekToken is set", () => {
    render(<SwipeableMeasurementRow {...defaultProps} peekToken={1} />);
    expect(screen.getByText("Photosynthesis")).toBeTruthy();
  });
});
