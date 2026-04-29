import { render, screen, fireEvent, waitFor } from "@testing-library/react-native";
import React from "react";
import { TouchableOpacity, Text } from "react-native";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { MeasurementItem } from "~/hooks/use-all-measurements";

import { MeasurementsList } from "./measurements-list";

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

const {
  showAlert,
  uploadOne,
  removeMeasurement,
  updateMeasurementComment,
  useMeasurements,
  toast,
} = vi.hoisted(() => ({
  showAlert: vi.fn(),
  uploadOne: vi.fn(),
  removeMeasurement: vi.fn(),
  updateMeasurementComment: vi.fn(),
  useMeasurements: vi.fn(),
  toast: { error: vi.fn(), success: vi.fn() },
}));

vi.mock("~/components/recent-measurements-screen/comment-modal", () => ({
  CommentModal: ({ visible, onSave }: { visible: boolean; onSave: (t: string) => void }) => {
    if (!visible) return null;
    return React.createElement(
      TouchableOpacity,
      { onPress: () => onSave("test comment") },
      React.createElement(Text, null, "Save comment"),
    );
  },
}));

vi.mock("~/components/AlertDialog", () => ({
  showAlert: (...args: unknown[]) => showAlert(...args),
}));
vi.mock("~/hooks/use-measurements", () => ({
  useMeasurements: () => useMeasurements(),
}));
vi.mock("sonner-native", () => ({ toast }));

const makeMeasurement = (
  key: string,
  status: "synced" | "unsynced" = "unsynced",
  comment = "",
): MeasurementItem => ({
  key,
  timestamp: "2026-04-20T10:00:00.000Z",
  experimentName: `Experiment ${key}`,
  status,
  data: {
    topic: "test/topic",
    measurementResult: comment
      ? { annotations: [{ type: "comment", content: { text: comment } }] }
      : {},
    metadata: {
      experimentName: `Experiment ${key}`,
      protocolName: "Protocol A",
      timestamp: "2026-04-20T10:00:00.000Z",
    },
  },
});

beforeEach(() => {
  uploadOne.mockReset();
  removeMeasurement.mockReset();
  updateMeasurementComment.mockReset();
  showAlert.mockReset();
  toast.error.mockReset();
  toast.success.mockReset();
  useMeasurements.mockReturnValue({ uploadOne, removeMeasurement, updateMeasurementComment });
});

describe("MeasurementsList", () => {
  it("shows empty state when measurements is undefined", () => {
    render(<MeasurementsList measurements={undefined} filter="all" invalidate={vi.fn()} />);
    expect(screen.getByText("No measurements found")).toBeTruthy();
    expect(screen.getByText("Your measurements will appear here")).toBeTruthy();
  });

  it("shows empty state with correct hint for 'synced' filter", () => {
    render(<MeasurementsList measurements={[]} filter="synced" invalidate={vi.fn()} />);
    expect(screen.getByText("No synced measurements yet")).toBeTruthy();
  });

  it("shows empty state with correct hint for 'unsynced' filter", () => {
    render(<MeasurementsList measurements={[]} filter="unsynced" invalidate={vi.fn()} />);
    expect(screen.getByText("All measurements have been synced")).toBeTruthy();
  });

  it("renders measurement rows", () => {
    render(
      <MeasurementsList
        measurements={[makeMeasurement("m1"), makeMeasurement("m2", "synced")]}
        filter="all"
        invalidate={vi.fn()}
      />,
    );
    expect(screen.getByText("Experiment m1")).toBeTruthy();
    expect(screen.getByText("Experiment m2")).toBeTruthy();
  });

  it("shows the swipe hint when there are measurements", () => {
    render(
      <MeasurementsList measurements={[makeMeasurement("m1")]} filter="all" invalidate={vi.fn()} />,
    );
    expect(screen.getByText("Swipe")).toBeTruthy();
  });

  it("hides the swipe hint when there are no measurements", () => {
    render(<MeasurementsList measurements={[]} filter="all" invalidate={vi.fn()} />);
    expect(screen.queryByText("Swipe")).toBeNull();
  });

  it("calls uploadOne and invalidate after upload confirmation", async () => {
    const invalidate = vi.fn();
    showAlert.mockImplementation((_title, _msg, buttons) => {
      // Simulate pressing the "Upload" confirm button
      buttons?.[0]?.onPress?.();
    });
    uploadOne.mockResolvedValueOnce(undefined);

    render(
      <MeasurementsList
        measurements={[makeMeasurement("m1", "unsynced")]}
        filter="all"
        invalidate={invalidate}
      />,
    );

    // Trigger onSync by pressing "Upload" in the swipeable row action
    fireEvent.press(screen.getByText("Upload"));

    await waitFor(() => expect(uploadOne).toHaveBeenCalledWith("m1"));
    await waitFor(() => expect(invalidate).toHaveBeenCalled());
  });

  it("calls removeMeasurement and invalidate after delete confirmation", async () => {
    const invalidate = vi.fn();
    showAlert.mockImplementation((_title, _msg, buttons) => {
      buttons?.[0]?.onPress?.();
    });
    removeMeasurement.mockResolvedValueOnce(undefined);

    render(
      <MeasurementsList
        measurements={[makeMeasurement("m1", "unsynced")]}
        filter="all"
        invalidate={invalidate}
      />,
    );

    // Get all touchable elements and press the one that wraps the trash icon.
    const allByRole = screen.UNSAFE_getAllByType(TouchableOpacity);
    const trashButton = allByRole[allByRole.length - 1]; // last one is trash
    fireEvent.press(trashButton);

    await waitFor(() => expect(removeMeasurement).toHaveBeenCalledWith("m1"));
    await waitFor(() => expect(invalidate).toHaveBeenCalled());
  });

  it("calls updateMeasurementComment and invalidate after saving a comment", async () => {
    const invalidate = vi.fn();
    updateMeasurementComment.mockResolvedValueOnce(undefined);

    render(
      <MeasurementsList
        measurements={[makeMeasurement("m1", "unsynced")]}
        filter="all"
        invalidate={invalidate}
      />,
    );

    // Press Comment to open the modal
    fireEvent.press(screen.getByText("Comment"));
    // Press the stub's Save button which calls onSave("test comment")
    fireEvent.press(screen.getByText("Save comment"));

    await waitFor(() =>
      expect(updateMeasurementComment).toHaveBeenCalledWith(
        "m1",
        expect.any(Object),
        "test comment",
      ),
    );
    await waitFor(() => expect(invalidate).toHaveBeenCalled());
  });

  it("shows error toast when removeMeasurement fails", async () => {
    const invalidate = vi.fn();
    showAlert.mockImplementation((_title, _msg, buttons) => {
      buttons?.[0]?.onPress?.();
    });
    removeMeasurement.mockRejectedValueOnce(new Error("fail"));

    render(
      <MeasurementsList
        measurements={[makeMeasurement("m1", "unsynced")]}
        filter="all"
        invalidate={invalidate}
      />,
    );

    const allTouchables = screen.UNSAFE_getAllByType(TouchableOpacity);
    fireEvent.press(allTouchables[allTouchables.length - 1]);

    await waitFor(() => expect(toast.error).toHaveBeenCalledWith("Failed to remove measurement"));
    expect(invalidate).not.toHaveBeenCalled();
  });
});
