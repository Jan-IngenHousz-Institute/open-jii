import { beforeEach, describe, expect, it, vi } from "vitest";
import { buildPendingManifest } from "~/features/measurement-flow/domain/workbook-run-manifest";
import { useMeasurementFlowStore } from "~/features/measurement-flow/stores/use-measurement-flow-store";

import {
  reconcileWorkbookRunManifests,
  workbookRunManifestRowId,
} from "./workbook-run-manifest-reconcile";

const {
  saveMeasurementLatest,
  getWorkbookAttemptIdsMissingTerminal,
  markAsPending,
  enqueue,
  isProcessing,
  subscribeProcessing,
} = vi.hoisted(() => ({
  saveMeasurementLatest: vi.fn(),
  getWorkbookAttemptIdsMissingTerminal: vi.fn(),
  markAsPending: vi.fn(),
  enqueue: vi.fn(),
  isProcessing: vi.fn(),
  subscribeProcessing: vi.fn(),
}));

vi.mock("~/shared/db/measurements-storage", () => ({
  saveMeasurementLatest,
  getWorkbookAttemptIdsMissingTerminal,
  markAsPending,
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
    saveMeasurementLatest.mockResolvedValue({ id: "row-id", changed: true });
    getWorkbookAttemptIdsMissingTerminal.mockResolvedValue([]);
    markAsPending.mockResolvedValue(undefined);
    isProcessing.mockReturnValue(false);
    useMeasurementFlowStore.setState({ pendingWorkbookRunManifests: [] });
  });

  it("persists and enqueues a boot-recovered manifest exactly once", async () => {
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

  it("derives a terminal record when boot finds saved rows for the active attempt", async () => {
    getWorkbookAttemptIdsMissingTerminal.mockResolvedValue(["attempt-crashed"]);
    useMeasurementFlowStore.setState({
      experimentId: "experiment-1",
      experimentLabel: "Trial",
      workbookVersionId: "version-1",
      workbookAttemptId: "attempt-crashed",
      workbookRunExpected: [{ producer_cell_id: "cell-1", device_ids: ["MSPx-0001"] }],
      workbookRunRealized: [{ producer_cell_id: "cell-1", device_id: "MSPx-0001", outcome: "ok" }],
      pendingWorkbookRunManifests: [],
    });

    await reconcileWorkbookRunManifests();

    expect(saveMeasurementLatest).toHaveBeenCalledWith(
      expect.objectContaining({
        measurementResult: expect.objectContaining({
          workbook_attempt_id: "attempt-crashed",
          terminal_status: "complete",
        }),
      }),
      "pending",
      workbookRunManifestRowId("attempt-crashed"),
    );
    expect(enqueue).toHaveBeenCalledWith(workbookRunManifestRowId("attempt-crashed"));
  });

  it("does not terminalize a resumable active attempt that has no saved rows", async () => {
    useMeasurementFlowStore.setState({
      workbookAttemptId: "attempt-paused",
      pendingWorkbookRunManifests: [],
    });

    await reconcileWorkbookRunManifests();

    expect(saveMeasurementLatest).not.toHaveBeenCalled();
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

    const reconciliation = reconcileWorkbookRunManifests();

    await vi.waitFor(() => expect(subscribeProcessing).toHaveBeenCalled());
    expect(enqueue).not.toHaveBeenCalled();
    isProcessing.mockReturnValue(false);
    onProcessingChange();
    await reconciliation;
    expect(markAsPending).toHaveBeenCalledWith("workbook-run-complete:attempt-race");
    expect(enqueue).toHaveBeenCalledWith("workbook-run-complete:attempt-race");
  });
});
