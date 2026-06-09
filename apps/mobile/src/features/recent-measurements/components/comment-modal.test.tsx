import { render, screen, fireEvent, act } from "@testing-library/react-native";
import React from "react";
import { BackHandler, Keyboard, TouchableOpacity, TextInput, View } from "react-native";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { CommentModal } from "./comment-modal";

vi.mock("~/shared/i18n", () => ({
  useTranslation: () => ({
    t: (key: string) => {
      const map: Record<string, string> = {
        "recentMeasurements:commentModal.title": "Add comment",
        "recentMeasurements:commentModal.answersLabel": "Answers: ",
        "recentMeasurements:commentModal.experimentLabel": "Experiment: ",
        "recentMeasurements:commentModal.measurementDoneLabel": "Measurement done: ",
        "recentMeasurements:commentModal.placeholder": "Enter your comment here...",
        "recentMeasurements:commentModal.saveButton": "Save comment",
        "recentMeasurements:list.noQuestionsAnswered": "No questions answered",
        "common:cancel": "Cancel",
      };
      return map[key] ?? key;
    },
  }),
}));

const bottomSheetState = vi.hoisted(() => ({
  present: vi.fn(),
  dismiss: vi.fn(),
  onDismiss: undefined as (() => void) | undefined,
}));

vi.mock("@gorhom/bottom-sheet", () => {
  const PassthroughView = ({ children, ...props }: { children?: React.ReactNode }) =>
    React.createElement(View, props, children);

  const BottomSheetModal = React.forwardRef<
    unknown,
    {
      backdropComponent?: (props: Record<string, unknown>) => React.ReactNode;
      children?: React.ReactNode;
      onDismiss?: () => void;
    }
  >(({ backdropComponent, children, onDismiss }, ref) => {
    React.useImperativeHandle(ref, () => ({
      present: bottomSheetState.present,
      dismiss: bottomSheetState.dismiss,
    }));
    bottomSheetState.onDismiss = onDismiss;

    return React.createElement(
      View,
      null,
      typeof backdropComponent === "function" ? backdropComponent({}) : null,
      children,
    );
  });

  return {
    __esModule: true,
    BottomSheetBackdrop: PassthroughView,
    BottomSheetModal,
    BottomSheetTextInput: TextInput,
    BottomSheetView: PassthroughView,
  };
});

const defaultProps = {
  visible: true,
  initialText: "Existing note",
  onSave: vi.fn(),
  onCancel: vi.fn(),
  experimentName: "Photosynthesis",
  questions: [
    { question_label: "q1", question_text: "Light?", question_answer: "Sunny" },
    { question_label: "q2", question_text: "Temp?", question_answer: "23C" },
  ],
  timestamp: "2026-04-20T10:00:00.000Z",
};

describe("CommentModal", () => {
  let backPressHandler: (() => boolean) | undefined;

  beforeEach(() => {
    vi.clearAllMocks();
    bottomSheetState.onDismiss = undefined;
    backPressHandler = undefined;

    vi.spyOn(Keyboard, "dismiss").mockImplementation(() => undefined);
    vi.spyOn(BackHandler, "addEventListener").mockImplementation((_eventName, handler) => {
      backPressHandler = handler as () => boolean;
      return { remove: vi.fn() } as never;
    });
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("presents the sheet and renders the existing comment context", () => {
    render(<CommentModal {...defaultProps} />);

    expect(bottomSheetState.present).toHaveBeenCalled();
    expect(screen.getByText("Add comment")).toBeTruthy();
    expect(screen.getByPlaceholderText("Enter your comment here...").props.defaultValue).toBe(
      "Existing note",
    );
    expect(screen.getByText("Sunny | 23C")).toBeTruthy();
    expect(screen.getByText("Photosynthesis")).toBeTruthy();
    expect(screen.getByText(/Measurement done:/)).toBeTruthy();
  });

  it("calls onSave with the edited comment", () => {
    const onSave = vi.fn();
    render(<CommentModal {...defaultProps} onSave={onSave} />);

    fireEvent.changeText(screen.getByPlaceholderText("Enter your comment here..."), "Updated note");
    fireEvent.press(screen.getByText("Save comment"));

    expect(onSave).toHaveBeenCalledWith("Updated note");
  });

  // OJD-1562: a controlled `value` made RNGH's TextInput reset the Android cursor
  // to the start on every keystroke. The field must stay uncontrolled (seeded by
  // defaultValue, read via onChangeText) so the native input owns its cursor.
  it("keeps the comment input uncontrolled so the native cursor is preserved", () => {
    render(<CommentModal {...defaultProps} initialText="Existing note" />);

    const input = screen.getByPlaceholderText("Enter your comment here...");
    expect(input.props.value).toBeUndefined();
    expect(input.props.defaultValue).toBe("Existing note");

    // Editing in place must not start driving `value` or change defaultValue
    // (which would force a remount), either of which resets the cursor.
    fireEvent.changeText(input, "Existing notes");
    const inputAfterEdit = screen.getByPlaceholderText("Enter your comment here...");
    expect(inputAfterEdit.props.value).toBeUndefined();
    expect(inputAfterEdit.props.defaultValue).toBe("Existing note");
  });

  it("saves the latest text after correcting an existing comment", () => {
    const onSave = vi.fn();
    render(<CommentModal {...defaultProps} initialText="" onSave={onSave} />);

    const input = screen.getByPlaceholderText("Enter your comment here...");
    fireEvent.changeText(input, "50% of the plot covered by another plot");
    fireEvent.changeText(input, "25% of the plot covered by another plot");
    fireEvent.press(screen.getByText("Save comment"));

    expect(onSave).toHaveBeenCalledWith("25% of the plot covered by another plot");
  });

  it("resets the input when the initial text changes while visible", () => {
    const { rerender } = render(<CommentModal {...defaultProps} initialText="First note" />);

    fireEvent.changeText(screen.getByPlaceholderText("Enter your comment here..."), "Draft");
    rerender(<CommentModal {...defaultProps} initialText="Second note" />);

    expect(screen.getByPlaceholderText("Enter your comment here...").props.defaultValue).toBe(
      "Second note",
    );
  });

  it("renders empty answers and hides optional metadata when absent", () => {
    render(<CommentModal {...defaultProps} experimentName="" questions={[]} timestamp="" />);

    expect(screen.getByText("No questions answered")).toBeTruthy();
    expect(screen.queryByText(/Experiment:/)).toBeNull();
    expect(screen.queryByText(/Measurement done:/)).toBeNull();
  });

  it("dismisses the sheet when hidden", () => {
    const { rerender } = render(<CommentModal {...defaultProps} visible />);
    bottomSheetState.dismiss.mockClear();

    rerender(<CommentModal {...defaultProps} visible={false} />);

    expect(bottomSheetState.dismiss).toHaveBeenCalled();
  });

  it("dismisses the keyboard and calls onCancel when the sheet dismisses", () => {
    const onCancel = vi.fn();
    render(<CommentModal {...defaultProps} onCancel={onCancel} />);

    act(() => {
      bottomSheetState.onDismiss?.();
    });

    expect(Keyboard.dismiss).toHaveBeenCalled();
    expect(onCancel).toHaveBeenCalled();
  });

  it("calls onCancel when the close button is pressed", () => {
    const onCancel = vi.fn();
    render(<CommentModal {...defaultProps} onCancel={onCancel} />);

    fireEvent.press(screen.UNSAFE_getAllByType(TouchableOpacity)[0]);

    expect(onCancel).toHaveBeenCalled();
  });

  it("dismisses the sheet on hardware back while visible", () => {
    render(<CommentModal {...defaultProps} visible />);

    expect(backPressHandler?.()).toBe(true);
    expect(bottomSheetState.dismiss).toHaveBeenCalled();
  });

  it("lets hardware back pass through when hidden", () => {
    render(<CommentModal {...defaultProps} visible={false} />);

    expect(backPressHandler?.()).toBe(false);
  });
});
