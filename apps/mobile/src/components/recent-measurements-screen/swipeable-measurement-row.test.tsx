import { render, screen, fireEvent } from "@testing-library/react-native";
import React from "react";
import { TouchableOpacity } from "react-native";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { SwipeableMeasurementRow } from "./swipeable-measurement-row";

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
  status: "unsynced" as const,
};

describe("SwipeableMeasurementRow", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("renders the experiment name", () => {
    render(<SwipeableMeasurementRow {...defaultProps} />);
    expect(screen.getByText("Photosynthesis")).toBeTruthy();
  });

  it("shows the Upload button for unsynced rows when onSync is provided", () => {
    render(<SwipeableMeasurementRow {...defaultProps} status="unsynced" onSync={vi.fn()} />);
    expect(screen.getByText("Upload")).toBeTruthy();
  });

  it("does not show the Upload button for synced rows", () => {
    render(<SwipeableMeasurementRow {...defaultProps} status="synced" onSync={vi.fn()} />);
    expect(screen.queryByText("Upload")).toBeNull();
  });

  it("shows the Comment button for unsynced rows when onComment is provided", () => {
    render(<SwipeableMeasurementRow {...defaultProps} status="unsynced" onComment={vi.fn()} />);
    expect(screen.getByText("Comment")).toBeTruthy();
  });

  it("does not show the Comment button for synced rows", () => {
    render(<SwipeableMeasurementRow {...defaultProps} status="synced" onComment={vi.fn()} />);
    expect(screen.queryByText("Comment")).toBeNull();
  });

  it("calls onDelete with the row id when the delete button is pressed", () => {
    const onDelete = vi.fn();
    render(<SwipeableMeasurementRow {...defaultProps} status="synced" onDelete={onDelete} />);
    const touchables = screen.UNSAFE_getAllByType(TouchableOpacity);
    fireEvent.press(touchables[0]);
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
    fireEvent.press(screen.getByText("Upload"));
    expect(onSync).toHaveBeenCalledWith("m1");
  });

  it("calls onComment with the row id when Comment is pressed", () => {
    const onComment = vi.fn();
    render(<SwipeableMeasurementRow {...defaultProps} onComment={onComment} />);
    fireEvent.press(screen.getByText("Comment"));
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
});
