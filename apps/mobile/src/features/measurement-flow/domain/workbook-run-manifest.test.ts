import { describe, expect, it } from "vitest";

import {
  addRealizedOutcome,
  addRealizedLaneStatus,
  addWorkbookDeviceOutcome,
  buildPendingManifest,
  deriveTerminalStatus,
  setExpectedLaneAssignment,
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

  it("unit helper (PR-2b wiring pending): freezes canonical lane membership", () => {
    const laneExpected = setExpectedLaneAssignment([], {
      container_cell_id: "parallel-1",
      lane_id: "ambient",
      container_attempt_id: "parallel-1:1",
      devices: [
        {
          transport_device_id: "usb-1",
          handshake_device_id: "handshake-1",
          raw_measurement: { device_id: "firmware-1" },
        },
        { transport_device_id: "usb-2", handshake_device_id: "handshake-2" },
        { transport_device_id: "usb-3" },
      ],
    });

    expect(laneExpected).toEqual([
      {
        container_cell_id: "parallel-1",
        lane_id: "ambient",
        container_attempt_id: "parallel-1:1",
        device_ids: ["firmware-1", "handshake-2", "usb-3"],
        device_id_by_transport: {
          "usb-1": "firmware-1",
          "usb-2": "handshake-2",
          "usb-3": "usb-3",
        },
      },
    ]);
  });

  it("unit helper (PR-2b wiring pending): reconciles fallback identity", () => {
    const frozen = setExpectedLaneAssignment([], {
      container_cell_id: "parallel-1",
      lane_id: "ambient",
      container_attempt_id: "parallel-1:1",
      devices: [
        { transport_device_id: "usb-1", handshake_device_id: "handshake-1" },
        { transport_device_id: "usb-no-row", handshake_device_id: "handshake-no-row" },
      ],
    });
    const reconciled = addWorkbookDeviceOutcome(frozen, [], {
      producer_cell_id: "protocol-1",
      transport_device_id: "usb-1",
      device_id: "firmware-1",
      outcome: "ok",
      container_cell_id: "parallel-1",
      lane_id: "ambient",
      container_attempt_id: "parallel-1:1",
    });

    expect(reconciled.expected).toEqual([
      {
        container_cell_id: "parallel-1",
        lane_id: "ambient",
        container_attempt_id: "parallel-1:1",
        device_ids: ["firmware-1", "handshake-no-row"],
        device_id_by_transport: {
          "usb-1": "firmware-1",
          "usb-no-row": "handshake-no-row",
        },
      },
      {
        producer_cell_id: "protocol-1",
        device_ids: ["firmware-1"],
        container_cell_id: "parallel-1",
        lane_id: "ambient",
        container_attempt_id: "parallel-1:1",
      },
    ]);
    expect(
      buildPendingManifest({
        attemptId: "attempt-1",
        experimentId: "experiment-1",
        expected: reconciled.expected,
        realized: reconciled.realized,
      })?.record.expected[0],
    ).toEqual({
      container_cell_id: "parallel-1",
      lane_id: "ambient",
      container_attempt_id: "parallel-1:1",
      device_ids: ["firmware-1", "handshake-no-row"],
    });
  });

  it("unit helper (PR-2b wiring pending): preserves a zero-row failed lane", () => {
    let laneExpected = setExpectedLaneAssignment([], {
      container_cell_id: "parallel-1",
      lane_id: "ambient",
      container_attempt_id: "parallel-1:1",
      devices: [{ transport_device_id: "usb-failed", handshake_device_id: "device-failed" }],
    });
    laneExpected = setExpectedLaneAssignment(laneExpected, {
      container_cell_id: "parallel-1",
      lane_id: "control",
      container_attempt_id: "parallel-1:1",
      devices: [{ transport_device_id: "usb-ok", handshake_device_id: "device-ok" }],
    });
    let laneRealized = addRealizedLaneStatus([], {
      container_cell_id: "parallel-1",
      lane_id: "ambient",
      container_attempt_id: "parallel-1:1",
      status: "failed",
    });
    laneRealized = addRealizedLaneStatus(laneRealized, {
      container_cell_id: "parallel-1",
      lane_id: "control",
      container_attempt_id: "parallel-1:1",
      status: "done",
    });

    expect(deriveTerminalStatus(laneExpected, laneRealized)).toBe("partial");
    expect(
      buildPendingManifest({
        attemptId: "attempt-1",
        experimentId: "experiment-1",
        expected: laneExpected,
        realized: laneRealized,
      })?.record,
    ).toMatchObject({
      terminal_status: "partial",
      expected: [
        expect.objectContaining({ lane_id: "ambient", device_ids: ["device-failed"] }),
        expect.objectContaining({ lane_id: "control", device_ids: ["device-ok"] }),
      ],
      realized: [
        expect.objectContaining({ lane_id: "ambient", status: "failed" }),
        expect.objectContaining({ lane_id: "control", status: "done" }),
      ],
    });
  });

  it("unit helper (PR-2b wiring pending): distinguishes abandon from unassigned", () => {
    expect(
      addRealizedLaneStatus([], {
        container_cell_id: "parallel-1",
        lane_id: "ambient",
        container_attempt_id: "parallel-1:1",
        status: "skipped",
        abandoned: true,
      }),
    ).toEqual([
      {
        container_cell_id: "parallel-1",
        lane_id: "ambient",
        container_attempt_id: "parallel-1:1",
        status: "skipped",
        abandoned: true,
      },
    ]);
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
