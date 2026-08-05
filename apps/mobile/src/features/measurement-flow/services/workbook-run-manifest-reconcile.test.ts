import { beforeEach, describe, expect, it, vi } from "vitest";
import { buildPendingManifest } from "~/features/measurement-flow/domain/workbook-run-manifest";
import { useMeasurementFlowStore } from "~/features/measurement-flow/stores/use-measurement-flow-store";

import {
  reconcileWorkbookRunManifests,
  workbookRunManifestRowId,
} from "./workbook-run-manifest-reconcile";

const { saveMeasurementIdempotently, enqueue } = vi.hoisted(() => ({
  saveMeasurementIdempotently: vi.fn(),
  enqueue: vi.fn(),
}));

vi.mock("~/shared/db/measurements-storage", () => ({ saveMeasurementIdempotently }));
vi.mock("~/shared/composition/upload", () => ({ getOutbox: () => ({ enqueue }) }));
vi.mock("~/shared/measurements/measurement-topic", () => ({
  getMeasurementMqttTopic: ({ experimentId, protocolId }: Record<string, string>) =>
    `topic/${experimentId}/${protocolId}`,
}));

describe("workbook run manifest reconcile", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    saveMeasurementIdempotently.mockResolvedValue("row-id");
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
    expect(saveMeasurementIdempotently).toHaveBeenCalledOnce();
    expect(saveMeasurementIdempotently).toHaveBeenCalledWith(
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
});
