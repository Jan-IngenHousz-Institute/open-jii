import { fireEvent, render, screen } from "@testing-library/react-native";
import React from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { CommandNode } from "./command-node";

const { flowState, capture, nextStep, continueTrack } = vi.hoisted(() => {
  const current: Record<string, unknown> = {};
  return {
    flowState: { current },
    capture: vi.fn(),
    nextStep: vi.fn(),
    continueTrack: vi.fn(),
  };
});

vi.mock("~/features/measurement-flow/hooks/use-measurement-capture", () => ({
  useMeasurementCapture: () => capture(),
}));
vi.mock("~/features/measurement-flow/stores/use-measurement-flow-store", () => ({
  useMeasurementFlowStore: (selector: (state: Record<string, unknown>) => unknown) =>
    selector(flowState.current),
}));
vi.mock("~/shared/i18n", () => ({
  useTranslation: () => ({ t: (key: string) => key }),
}));
vi.mock("~/shared/ui/hooks/use-theme", () => ({
  useTheme: () => ({ classes: { text: "", textMuted: "" } }),
}));

const content = { command: { format: "string" as const, content: "status --raw" } };

describe("runner-backed inline command screen", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    capture.mockReturnValue({
      startScan: vi.fn(),
      cancelScan: vi.fn(),
      isScanning: false,
    });
    flowState.current = {
      runnerState: { cellRuns: {}, outputs: {} },
      nextStep,
      continueRunnerTrackInteraction: continueTrack,
    };
  });

  it("shows the raw command and the runner result before explicit Continue", () => {
    flowState.current.runnerState = {
      cellRuns: { "command-1": { status: "completed" } },
      outputs: { "command-1": { v: { ready: true } } },
    };
    render(<CommandNode content={content} nodeId="command-1" />);

    expect(screen.getByText("status --raw")).toBeTruthy();
    expect(screen.getByText(/"ready": true/)).toBeTruthy();
    fireEvent.press(screen.getByText("measurementFlow:commandNode.continue"));
    expect(nextStep).toHaveBeenCalledOnce();
  });

  it("surfaces the raw error and scopes lane Continue to its track", () => {
    flowState.current.runnerState = {
      cellRuns: { "command-1": { status: "error", error: "device rejected command" } },
      outputs: {},
    };
    const { rerender } = render(
      <CommandNode content={content} nodeId="command-1" trackId="lane-a" />,
    );
    expect(screen.getByText("device rejected command")).toBeTruthy();

    flowState.current.runnerState = {
      cellRuns: { "command-1": { status: "completed" } },
      outputs: { "command-1": { v: "READY" } },
    };
    rerender(<CommandNode content={content} nodeId="command-1" trackId="lane-a" />);
    fireEvent.press(screen.getByText("measurementFlow:commandNode.continue"));
    expect(continueTrack).toHaveBeenCalledWith("lane-a", "command-1");
    expect(nextStep).not.toHaveBeenCalled();
  });
});
