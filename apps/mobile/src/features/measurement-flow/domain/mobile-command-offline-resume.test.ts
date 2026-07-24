import AsyncStorage from "@react-native-async-storage/async-storage";
import { afterEach, describe, expect, it, vi } from "vitest";
import { useMeasurementFlowStore } from "~/features/measurement-flow/stores/use-measurement-flow-store";

import type { WorkbookCell } from "@repo/api/domains/workbook/workbook-cells.schema";

import { resolveMobileCommand } from "./mobile-command-resolution";

const STORAGE_KEY = "measurement-flow-storage";

const cells: WorkbookCell[] = [
  {
    id: "command-source",
    type: "command",
    isCollapsed: false,
    payload: { format: "string", content: "first" },
  },
  {
    id: "command-target",
    type: "command",
    isCollapsed: false,
    payload: {
      kind: "ref",
      ref: { sourceCellId: "command-source", field: "response" },
    },
  },
];

afterEach(async () => {
  useMeasurementFlowStore.getState().resetFlow();
  await AsyncStorage.removeItem(STORAGE_KEY);
});

describe("mobile dynamic command offline resume", () => {
  it("executes from a fresh command reply restored from the persisted active cycle", async () => {
    await AsyncStorage.setItem(
      STORAGE_KEY,
      JSON.stringify({
        version: 2,
        state: {
          experimentId: "experiment-1",
          loadedExperimentId: "experiment-1",
          workbookVersionId: "version-1",
          executionEpoch: "epoch-resumed",
          cells,
          outputsByCellId: {
            "command-source": {
              scope: "device",
              provenance: {
                workbookVersionId: "version-1",
                executionEpoch: "epoch-resumed",
              },
              deviceResults: [{ deviceId: "device-a", data: { response: "resumed-follow-up" } }],
            },
          },
        },
      }),
    );
    await useMeasurementFlowStore.persist.rehydrate();
    const state = useMeasurementFlowStore.getState();

    const resolution = resolveMobileCommand({
      commandCellId: "command-target",
      cells: state.cells,
      targetDeviceId: "device-a",
      workbookVersionId: state.workbookVersionId,
      executionEpoch: state.executionEpoch,
      getRuntimeCellOutput: state.getRuntimeCellOutput,
    });
    expect(resolution).toEqual({ ok: true, value: "resumed-follow-up" });

    const executeCommandOn = vi.fn().mockResolvedValue({ ack: true });
    if (resolution.ok) await executeCommandOn("device-a", resolution.value);
    expect(executeCommandOn).toHaveBeenCalledWith("device-a", "resumed-follow-up");
  });

  it("surfaces a recorded branch command transport error to a later reference", () => {
    useMeasurementFlowStore.setState({
      experimentId: "experiment-1",
      loadedExperimentId: "experiment-1",
      workbookVersionId: "version-1",
      executionEpoch: "epoch-1",
      cells,
      outputsByCellId: {},
    });
    const state = useMeasurementFlowStore.getState();
    state.recordDeviceProducerOutcomes("command-source", "command", [
      {
        device: { id: "device-a", name: "Device A" },
        error: "COMMAND_EXECUTION_FAILED",
      },
    ]);

    expect(
      resolveMobileCommand({
        commandCellId: "command-target",
        cells,
        targetDeviceId: "device-a",
        workbookVersionId: "version-1",
        executionEpoch: "epoch-1",
        getRuntimeCellOutput: useMeasurementFlowStore.getState().getRuntimeCellOutput,
      }),
    ).toMatchObject({
      ok: false,
      error: {
        code: "SOURCE_DEVICE_FAILED",
        commandCellId: "command-target",
        sourceCellId: "command-source",
        targetDeviceId: "device-a",
      },
    });
  });
});
