import { beforeEach, describe, expect, it, vi } from "vitest";
import { buildPendingManifest } from "~/features/measurement-flow/domain/workbook-run-manifest";
import { useMeasurementFlowStore } from "~/features/measurement-flow/stores/use-measurement-flow-store";

import {
  reconcileWorkbookRunManifests,
  workbookRunManifestRowId,
} from "./workbook-run-manifest-reconcile";

const { saveMeasurementLatest, enqueue, isProcessing, subscribeProcessing } = vi.hoisted(() => ({
  saveMeasurementLatest: vi.fn(),
  enqueue: vi.fn(),
  isProcessing: vi.fn(),
  subscribeProcessing: vi.fn(),
}));

vi.mock("~/shared/db/measurements-storage", () => ({
  saveMeasurementLatest,
}));
vi.mock("~/shared/composition/upload", () => ({
  getOutbox: () => ({ enqueue, isProcessing, subscribeProcessing }),
}));
vi.mock("~/shared/measurements/measurement-topic", () => ({
  getMeasurementMqttTopic: ({ experimentId, protocolId }: Record<string, string>) =>
    `topic/${experimentId}/${protocolId}`,
}));

describe("workbook run manifest reconcile", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    saveMeasurementLatest.mockResolvedValue({ id: "row-id", changed: true, generation: 1 });
    isProcessing.mockReturnValue(false);
    useMeasurementFlowStore.setState({
      workbookTerminalReadyAttemptId: undefined,
      pendingWorkbookRunManifests: [],
    });
  });

  it("persists and enqueues a boot-recovered terminal-ready snapshot exactly once", async () => {
    const manifest = buildPendingManifest({
      attemptId: "attempt-1",
      workbookVersionId: "version-1",
      experimentId: "experiment-1",
      experimentName: "Trial",
      expected: [{ producer_cell_id: "cell-1", device_ids: ["device-1"] }],
      realized: [{ producer_cell_id: "cell-1", device_id: "device-1", outcome: "failed" }],
      createdAt: "2026-08-05T10:00:00.000Z",
    });
    if (!manifest) throw new Error("fixture did not build");
    useMeasurementFlowStore.setState({ pendingWorkbookRunManifests: [manifest] });

    await reconcileWorkbookRunManifests();
    await reconcileWorkbookRunManifests();

    const rowId = workbookRunManifestRowId("attempt-1");
    expect(saveMeasurementLatest).toHaveBeenCalledOnce();
    expect(saveMeasurementLatest).toHaveBeenCalledWith(
      expect.objectContaining({
        topic: "topic/experiment-1/workbook-run-complete",
        measurementResult: expect.objectContaining({
          record_kind: "workbook_run_complete",
          workbook_attempt_id: "attempt-1",
          terminal_status: "failed",
        }),
      }),
      "pending",
      rowId,
    );
    expect(enqueue).toHaveBeenCalledOnce();
    expect(enqueue).toHaveBeenCalledWith(rowId);
    expect(useMeasurementFlowStore.getState().pendingWorkbookRunManifests).toEqual([]);
  });

  it("does not infer terminality from an active attempt without a persisted snapshot", async () => {
    useMeasurementFlowStore.setState({
      experimentId: "experiment-1",
      workbookAttemptId: "attempt-in-progress",
      workbookRunExpected: [{ producer_cell_id: "cell-1", device_ids: ["MSPx-0001"] }],
      workbookRunRealized: [{ producer_cell_id: "cell-1", device_id: "MSPx-0001", outcome: "ok" }],
      pendingWorkbookRunManifests: [],
    });

    await reconcileWorkbookRunManifests();

    expect(saveMeasurementLatest).not.toHaveBeenCalled();
  });

  it("recovers a snapshot only from the explicit persisted terminal-ready marker", async () => {
    useMeasurementFlowStore.setState({
      experimentId: "experiment-1",
      workbookAttemptId: "attempt-ready",
      workbookTerminalReadyAttemptId: "attempt-ready",
      workbookRunExpected: [{ producer_cell_id: "cell-1", device_ids: ["device-1"] }],
      workbookRunRealized: [{ producer_cell_id: "cell-1", device_id: "device-1", outcome: "ok" }],
      pendingWorkbookRunManifests: [],
    });

    await reconcileWorkbookRunManifests();

    expect(saveMeasurementLatest).toHaveBeenCalledWith(
      expect.objectContaining({
        measurementResult: expect.objectContaining({
          workbook_attempt_id: "attempt-ready",
          terminal_status: "complete",
        }),
      }),
      "pending",
      workbookRunManifestRowId("attempt-ready"),
    );
  });

  it("requeues a divergent replacement after the older body finishes publishing", async () => {
    const manifest = buildPendingManifest({
      attemptId: "attempt-race",
      experimentId: "experiment-1",
      expected: [{ producer_cell_id: "cell-1", device_ids: ["device-1"] }],
      realized: [{ producer_cell_id: "cell-1", device_id: "device-1", outcome: "ok" }],
    });
    if (!manifest) throw new Error("fixture did not build");
    useMeasurementFlowStore.setState({ pendingWorkbookRunManifests: [manifest] });
    isProcessing.mockReturnValue(true);
    let onProcessingChange: () => void = vi.fn();
    subscribeProcessing.mockImplementation((_id: string, listener: () => void) => {
      onProcessingChange = listener;
      return vi.fn();
    });

    await reconcileWorkbookRunManifests();

    expect(subscribeProcessing).toHaveBeenCalled();
    expect(enqueue).not.toHaveBeenCalled();
    expect(useMeasurementFlowStore.getState().pendingWorkbookRunManifests).toEqual([]);
    isProcessing.mockReturnValue(false);
    onProcessingChange();
    expect(enqueue).toHaveBeenCalledWith("workbook-run-complete:attempt-race");
  });
});
