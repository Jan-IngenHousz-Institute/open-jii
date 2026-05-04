import { render } from "@testing-library/react-native";
import React from "react";
import { BackHandler } from "react-native";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { useFlowAnswersStore } from "~/stores/use-flow-answers-store";
import { useMeasurementFlowStore } from "~/stores/use-measurement-flow-store";

import { MeasurementFlowScreen } from "./measurement-flow-screen";

const mockShowAlert = vi.fn();
const mockBack = vi.fn();
const mockNavigate = vi.fn();
const mockUseIsFocused = vi.fn(() => true);

vi.mock("~/components/AlertDialog", () => ({
  showAlert: (...args: unknown[]) => mockShowAlert(...args),
}));

vi.mock("expo-router", () => ({
  useRouter: () => ({ back: mockBack, navigate: mockNavigate }),
}));

vi.mock("expo-keep-awake", () => ({
  useKeepAwake: () => undefined,
}));

vi.mock("expo-status-bar", () => ({
  StatusBar: () => null,
}));

vi.mock("@react-navigation/elements", () => ({
  useHeaderHeight: () => 0,
}));

vi.mock("@react-navigation/native", () => ({
  useIsFocused: () => mockUseIsFocused(),
}));

vi.mock("./components/end-flow-button", () => ({
  EndFlowButton: () => null,
}));

vi.mock("./components/measurement-flow-container", () => ({
  MeasurementFlowContainer: () => null,
}));

vi.mock("./components/navigation-buttons", () => ({
  NavigationButtons: () => null,
}));

beforeEach(() => {
  mockShowAlert.mockReset();
  mockBack.mockReset();
  mockNavigate.mockReset();
  mockUseIsFocused.mockReturnValue(true);
  useMeasurementFlowStore.setState({
    experimentId: undefined,
    protocolId: undefined,
    currentStep: 0,
    flowNodes: [],
    currentFlowStep: 0,
    iterationCount: 0,
    isFlowFinished: false,
    isQuestionsSubmitPending: false,
    scanResult: undefined,
    isFromOverview: false,
  });
  useFlowAnswersStore.setState({
    answersHistory: [],
    autoincrementSettings: {},
    rememberAnswerSettings: {},
  });
});

afterEach(() => {
  vi.restoreAllMocks();
});

function captureHardwareBackHandler() {
  const remove = vi.fn();
  let handler: (() => boolean) | undefined;
  vi.spyOn(BackHandler, "addEventListener").mockImplementation(((
    eventName: string,
    cb: () => boolean,
  ) => {
    if (eventName === "hardwareBackPress") handler = cb;
    return { remove } as { remove: () => void };
  }) as typeof BackHandler.addEventListener);
  return {
    remove,
    getHandler: () => handler,
  };
}

describe("MeasurementFlowScreen back handler", () => {
  it("registers a hardwareBackPress listener and removes it on unmount", () => {
    const { remove } = captureHardwareBackHandler();
    const { unmount } = render(<MeasurementFlowScreen />);
    expect(BackHandler.addEventListener).toHaveBeenCalledWith(
      "hardwareBackPress",
      expect.any(Function),
    );
    unmount();
    expect(remove).toHaveBeenCalled();
  });

  it("opens a confirmation alert when focused and returns true to swallow the back press", () => {
    const { getHandler } = captureHardwareBackHandler();
    render(<MeasurementFlowScreen />);
    const handler = getHandler();
    if (!handler) throw new Error("hardwareBackPress handler was not registered");
    expect(handler()).toBe(true);
    expect(mockShowAlert).toHaveBeenCalledTimes(1);
    const [title, message, buttons] = mockShowAlert.mock.calls[0];
    expect(title).toBe("Leave Flow");
    expect(message).toMatch(/leave/i);
    expect(buttons[0]).toMatchObject({ text: "Leave", variant: "primary" });
    expect(buttons[1]).toMatchObject({ text: "Cancel", variant: "ghost" });
  });

  it("confirming Leave navigates back via the router", () => {
    const { getHandler } = captureHardwareBackHandler();
    render(<MeasurementFlowScreen />);
    const handler = getHandler();
    if (!handler) throw new Error("hardwareBackPress handler was not registered");
    handler();
    const [, , buttons] = mockShowAlert.mock.calls[0];
    buttons[0].onPress?.();
    expect(mockBack).toHaveBeenCalled();
  });

  it("returns false and does not prompt when the screen is not focused", () => {
    mockUseIsFocused.mockReturnValue(false);
    const { getHandler } = captureHardwareBackHandler();
    render(<MeasurementFlowScreen />);
    const handler = getHandler();
    if (!handler) throw new Error("hardwareBackPress handler was not registered");
    expect(handler()).toBe(false);
    expect(mockShowAlert).not.toHaveBeenCalled();
  });
});
