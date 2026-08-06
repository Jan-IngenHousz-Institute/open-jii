import AsyncStorage from "@react-native-async-storage/async-storage";
import { beforeEach, describe, expect, it } from "vitest";

import type { WorkbookCell } from "@repo/api/domains/workbook/workbook-cells.schema";
import { createInitialState, hashCells } from "@repo/workbook";

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

describe("flow rehydration capability guard", () => {
  beforeEach(async () => {
    await AsyncStorage.clear();
    useMeasurementFlowStore.getState().resetFlow();
    useFlowAnswersStore.getState().clearHistory();
    await Promise.all([
      useMeasurementFlowStore.persist.rehydrate(),
      useFlowAnswersStore.persist.rehydrate(),
    ]);
  });

  it("preserves a persisted container flow and its answers for runner resume", () => {
    useMeasurementFlowStore.setState({
      experimentId: "experiment-1",
      workbookVersionId: "version-1",
      cells: [container],
    });
    useFlowAnswersStore.getState().setAnswer(0, "plot", "A-1");

    const uninstall = installFlowRehydrationGuard();

    expect(useMeasurementFlowStore.getState()).toMatchObject({
      experimentId: "experiment-1",
      workbookVersionId: "version-1",
      cells: [container],
    });
    expect(useFlowAnswersStore.getState().getAnswer(0, "plot")).toBe("A-1");
    uninstall();
  });

  it("rejects an unsupported real v3 envelope before it becomes live and clears answers", async () => {
    const futureCells = [{ id: "future-1", type: "future-cell" }] as unknown as Parameters<
      typeof createInitialState
    >[0]["cells"];
    const runnerState = createInitialState({ cells: futureCells, mode: "flow" });
    await AsyncStorage.setItem(
      "measurement-flow-storage",
      JSON.stringify({
        state: {
          experimentId: "experiment-unsupported",
          workbookVersionId: "version-unsupported",
          cells: futureCells,
          flowNodes: [
            {
              id: "future-1",
              type: "future-cell",
              name: "Future",
              content: {},
              isStart: true,
            },
          ],
          snapshot: {
            schemaVersion: 2,
            savedAt: 1,
            cellsHash: hashCells(futureCells),
            state: runnerState,
          },
        },
        version: 3,
      }),
    );
    await AsyncStorage.setItem(
      "flow-answers-storage",
      JSON.stringify({
        state: {
          answersHistory: [{ plot: "orphan" }],
          autoincrementSettings: {},
          rememberAnswerSettings: {},
        },
        version: 1,
      }),
    );
    const observedTypes: string[][] = [];
    const unsubscribe = useMeasurementFlowStore.subscribe((state) => {
      observedTypes.push(state.flowNodes.map((node) => node.type));
    });
    const uninstall = installFlowRehydrationGuard();

    await Promise.all([
      useMeasurementFlowStore.persist.rehydrate(),
      useFlowAnswersStore.persist.rehydrate(),
    ]);

    expect(useMeasurementFlowStore.getState()).toMatchObject({
      experimentId: undefined,
      cells: [],
      flowNodes: [],
    });
    expect(observedTypes.every((types) => !types.includes("future-cell"))).toBe(true);
    expect(useFlowAnswersStore.getState().answersHistory).toEqual([]);
    unsubscribe();
    uninstall();
  });
});
