import { beforeEach, describe, expect, it, vi } from "vitest";

import {
  flushMeasurementFlowForAppState,
  flushMeasurementFlowForPause,
} from "./flow-persistence-boundaries";

const flushSnapshot = vi.hoisted(() => vi.fn());
vi.mock("~/features/measurement-flow/stores/use-measurement-flow-store", () => ({
  flushRunnerMeasurementFlowSnapshot: flushSnapshot,
}));

describe("measurement flow persistence boundaries", () => {
  beforeEach(() => flushSnapshot.mockClear());

  it("flushes synchronously before Pause navigation", () => {
    flushMeasurementFlowForPause();
    expect(flushSnapshot).toHaveBeenCalledOnce();
  });

  it("flushes on inactive/background but not an active transition", () => {
    flushMeasurementFlowForAppState("active");
    expect(flushSnapshot).not.toHaveBeenCalled();
    flushMeasurementFlowForAppState("inactive");
    flushMeasurementFlowForAppState("background");
    expect(flushSnapshot).toHaveBeenCalledTimes(2);
  });
});
