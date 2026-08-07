import { describe, expect, it } from "vitest";

import {
  addRealizedOutcome,
  addWorkbookDeviceOutcome,
  buildPendingManifest,
  deriveTerminalStatus,
} from "./workbook-run-manifest";

const expected = [{ producer_cell_id: "cell-1", device_ids: ["device-1", "device-2"] }];

describe("workbook run manifest", () => {
  it("derives complete, partial, and failed from expected membership", () => {
    expect(
      deriveTerminalStatus(expected, [
        { producer_cell_id: "cell-1", device_id: "device-1", outcome: "ok" },
        { producer_cell_id: "cell-1", device_id: "device-2", outcome: "ok" },
      ]),
    ).toBe("complete");
    expect(
      deriveTerminalStatus(expected, [
        { producer_cell_id: "cell-1", device_id: "device-1", outcome: "ok" },
        { producer_cell_id: "cell-1", device_id: "device-2", outcome: "failed" },
      ]),
    ).toBe("partial");
    expect(
      deriveTerminalStatus(expected, [
        { producer_cell_id: "cell-1", device_id: "device-1", outcome: "failed" },
      ]),
    ).toBe("failed");
  });

  it("reports unknown when no expected membership was captured", () => {
    expect(deriveTerminalStatus([], [])).toBe("unknown");
  });

  it("lets a retry replace a failed outcome with success", () => {
    const failed = addRealizedOutcome([], {
      producer_cell_id: "cell-1",
      device_id: "device-1",
      outcome: "failed",
    });
    const retried = addRealizedOutcome(failed, {
      producer_cell_id: "cell-1",
      device_id: "device-1",
      outcome: "ok",
    });
    expect(retried).toEqual([{ producer_cell_id: "cell-1", device_id: "device-1", outcome: "ok" }]);
  });

  it("replaces a retry's transport fallback with its firmware id", () => {
    const failed = addWorkbookDeviceOutcome([], [], {
      producer_cell_id: "cell-1",
      transport_device_id: "usb-42",
      device_id: "usb-42",
      outcome: "failed",
    });
    const succeeded = addWorkbookDeviceOutcome(failed.expected, failed.realized, {
      producer_cell_id: "cell-1",
      transport_device_id: "usb-42",
      device_id: "MSPx-0001",
      outcome: "ok",
    });

    expect(succeeded.expected).toEqual([{ producer_cell_id: "cell-1", device_ids: ["MSPx-0001"] }]);
    expect(succeeded.realized).toEqual([
      {
        producer_cell_id: "cell-1",
        transport_device_id: "usb-42",
        device_id: "MSPx-0001",
        outcome: "ok",
      },
    ]);
    expect(deriveTerminalStatus(succeeded.expected, succeeded.realized)).toBe("complete");
  });

  it("builds the terminal wire record with an explicit abandoned status", () => {
    const manifest = buildPendingManifest({
      attemptId: "attempt-1",
      workbookVersionId: "version-1",
      experimentId: "experiment-1",
      experimentName: "Trial",
      expected,
      realized: [],
      terminalStatus: "abandoned",
      createdAt: "2026-08-05T10:00:00.000Z",
    });
    expect(manifest?.record).toEqual({
      record_kind: "workbook_run_complete",
      workbook_attempt_id: "attempt-1",
      workbook_version_id: "version-1",
      terminal_status: "abandoned",
      expected,
      realized: [],
    });
  });

  it("strips the local transport key from the terminal wire record", () => {
    const manifest = buildPendingManifest({
      attemptId: "attempt-1",
      experimentId: "experiment-1",
      expected: [{ producer_cell_id: "cell-1", device_ids: ["MSPx-0001"] }],
      realized: [
        {
          producer_cell_id: "cell-1",
          transport_device_id: "usb-42",
          device_id: "MSPx-0001",
          outcome: "ok",
        },
      ],
    });
    expect(manifest?.record.realized).toEqual([
      { producer_cell_id: "cell-1", device_id: "MSPx-0001", outcome: "ok" },
    ]);
  });
});
