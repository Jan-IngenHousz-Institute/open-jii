import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

import { createInitialState } from "@repo/workbook";

import { ParallelTrackBoard } from "./parallel-track-board";

describe("ParallelTrackBoard", () => {
  it("shows every lane and routes abandon by track id", async () => {
    const state = createInitialState({ cells: [], mode: "notebook" });
    state.devices = [{ id: "dev-a", label: "Device A", family: "multispeq" }];
    state.tracks["lane-track"] = {
      ...state.tracks.main,
      id: "lane-track",
      laneId: "lane-a",
      deviceIds: ["dev-a"],
      status: "awaitingHuman",
      pendingInteraction: { kind: "question", cellId: "question-a" },
    };
    state.parallelAttempts.attempt = {
      attemptId: "attempt",
      containerCellId: "container",
      containerName: "device_lanes",
      status: "running",
      lanes: {
        "lane-a": {
          laneId: "lane-a",
          label: "Measurements",
          trackId: "lane-track",
          deviceIds: ["dev-a"],
          status: "active",
          devices: [{ deviceId: "dev-a", outcome: "ok" }],
        },
        fallback: {
          laneId: "fallback",
          label: "Fallback",
          trackId: null,
          deviceIds: [],
          status: "skipped",
          devices: [],
        },
      },
    };
    state.activeContainerAttemptId = "attempt";
    const onAbandon = vi.fn();

    render(<ParallelTrackBoard state={state} onAbandon={onAbandon} />);
    expect(screen.getByText("Measurements")).toBeInTheDocument();
    expect(screen.getByText("Fallback")).toBeInTheDocument();
    expect(screen.getByText("Device A")).toBeInTheDocument();
    await userEvent.click(screen.getByRole("button", { name: "Abandon" }));
    expect(onAbandon).toHaveBeenCalledWith("lane-track");
  });
});
