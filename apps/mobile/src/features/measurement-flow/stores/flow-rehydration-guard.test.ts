import AsyncStorage from "@react-native-async-storage/async-storage";
import { beforeEach, describe, expect, it, vi } from "vitest";

import type { WorkbookCell } from "@repo/api/domains/workbook/workbook-cells.schema";

import { installFlowRehydrationGuard } from "./flow-rehydration-guard";
import { useFlowAnswersStore } from "./use-flow-answers-store";
import { useMeasurementFlowStore } from "./use-measurement-flow-store";

const container: WorkbookCell = {
  id: "parallel-1",
  type: "parallel",
  name: "device_lanes",
  isCollapsed: false,
  defaultLaneId: "lane-1",
  lanes: [
    {
      id: "lane-1",
      label: "Lane 1",
      color: "#005E5E",
      conditions: [],
      body: [{ id: "inside", type: "markdown", isCollapsed: false, content: "inside" }],
    },
  ],
};

const MEASUREMENT_KEY = "measurement-flow-storage";
const ANSWERS_KEY = "flow-answers-storage";

describe("flow rehydration capability guard", () => {
  beforeEach(async () => {
    useMeasurementFlowStore.getState().resetFlow();
    useFlowAnswersStore.getState().clearHistory();
    await Promise.resolve();
    await AsyncStorage.clear();
  });

  it("rejects a real persisted container envelope before it enters live state", async () => {
    await AsyncStorage.setItem(
      MEASUREMENT_KEY,
      JSON.stringify({
        state: {
          experimentId: "experiment-1",
          workbookVersionId: "version-1",
          cells: [container],
          flowNodes: [{ id: "parallel-1", type: "parallel" }],
        },
        version: 2,
      }),
    );
    await AsyncStorage.setItem(
      ANSWERS_KEY,
      JSON.stringify({
        state: {
          answersHistory: [{ plot: "A-1" }],
          autoincrementSettings: {},
          rememberAnswerSettings: {},
        },
        version: 1,
      }),
    );

    const observedTypes: string[][] = [];
    const unsubscribeState = useMeasurementFlowStore.subscribe((state) => {
      observedTypes.push([
        ...state.cells.map((cell) => cell.type),
        ...state.flowNodes.map((node) => node.type),
      ]);
    });
    const uninstall = installFlowRehydrationGuard();
    await Promise.all([
      useMeasurementFlowStore.persist.rehydrate(),
      useFlowAnswersStore.persist.rehydrate(),
    ]);

    expect(useMeasurementFlowStore.getState()).toMatchObject({
      experimentId: undefined,
      workbookVersionId: undefined,
      cells: [],
      flowNodes: [],
    });
    expect(observedTypes.every((types) => !types.includes("parallel"))).toBe(true);
    expect(useFlowAnswersStore.getState().answersHistory).toEqual([]);

    await vi.waitFor(async () => {
      const raw = await AsyncStorage.getItem(MEASUREMENT_KEY);
      expect(raw).not.toBeNull();
      const envelope = JSON.parse(raw ?? "{}") as {
        state?: { cells?: WorkbookCell[]; flowNodes?: { type?: string }[] };
      };
      expect(envelope.state?.cells ?? []).toEqual([]);
      expect(envelope.state?.flowNodes ?? []).toEqual([]);
    });

    unsubscribeState();
    uninstall();
  });
});
