import { beforeEach, describe, expect, it, vi } from "vitest";

import { areFlowStoresConsistent, installFlowRehydrationGuard } from "./flow-rehydration-guard";
import { useFlowAnswersStore } from "./use-flow-answers-store";
import { useMeasurementFlowStore } from "./use-measurement-flow-store";

function resetStores() {
  useMeasurementFlowStore.getState().resetFlow();
  useMeasurementFlowStore.setState({ resumeResetReason: undefined });
  useFlowAnswersStore.getState().clearHistory();
}

function setValidActiveCycle() {
  useMeasurementFlowStore.setState({
    experimentId: "exp-1",
    loadedExperimentId: "exp-1",
    workbookVersionId: "version-1",
    executionEpoch: "epoch-1",
    outputsByCellId: {
      p1: {
        scope: "device",
        provenance: { workbookVersionId: "version-1", executionEpoch: "epoch-1" },
        deviceResults: [{ deviceId: "device-1", data: { phi2: 0.8 } }],
      },
    },
  });
  useFlowAnswersStore.getState().setAnswer(0, "q1", "yes");
}

describe("flow rehydration guard", () => {
  beforeEach(resetStores);

  it("accepts a consistent active v2 cycle", () => {
    setValidActiveCycle();
    expect(
      areFlowStoresConsistent(useMeasurementFlowStore.getState(), useFlowAnswersStore.getState()),
    ).toBe(true);
  });

  it("rejects stale provenance and duplicate device ids", () => {
    setValidActiveCycle();
    useMeasurementFlowStore.setState({
      outputsByCellId: {
        p1: {
          scope: "device",
          provenance: { workbookVersionId: "version-1", executionEpoch: "stale" },
          deviceResults: [
            { deviceId: "device-1", data: 1 },
            { deviceId: "device-1", data: 2 },
          ],
        },
      },
    });
    expect(
      areFlowStoresConsistent(useMeasurementFlowStore.getState(), useFlowAnswersStore.getState()),
    ).toBe(false);
  });

  it("resets both stores after malformed cross-store rehydration", () => {
    setValidActiveCycle();
    useFlowAnswersStore.setState({ answersHistory: [{ q1: 42 }] as never });
    vi.spyOn(useMeasurementFlowStore.persist, "hasHydrated").mockReturnValue(true);
    vi.spyOn(useFlowAnswersStore.persist, "hasHydrated").mockReturnValue(true);

    const uninstall = installFlowRehydrationGuard();

    expect(useMeasurementFlowStore.getState()).toMatchObject({
      experimentId: undefined,
      workbookVersionId: undefined,
      executionEpoch: undefined,
      outputsByCellId: {},
      resumeResetReason: "FLOW_RESUME_STATE_INVALID",
    });
    expect(useFlowAnswersStore.getState().answersHistory).toEqual([]);
    uninstall();
  });

  it("coordinates orphan-answer cleanup through the same full reset", () => {
    useFlowAnswersStore.getState().setAnswer(0, "q1", "orphan");
    vi.spyOn(useMeasurementFlowStore.persist, "hasHydrated").mockReturnValue(true);
    vi.spyOn(useFlowAnswersStore.persist, "hasHydrated").mockReturnValue(true);

    const uninstall = installFlowRehydrationGuard();

    expect(useMeasurementFlowStore.getState().resumeResetReason).toBe("FLOW_RESUME_STATE_INVALID");
    expect(useFlowAnswersStore.getState().answersHistory).toEqual([]);
    uninstall();
  });
});
