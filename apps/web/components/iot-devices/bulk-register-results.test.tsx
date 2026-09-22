import { createIotDevice } from "@/test/factories";
import { render, screen } from "@/test/test-utils";
import { describe, expect, it } from "vitest";

import type { BulkRegisterIotDevicesResult } from "@repo/api/domains/iot/iot.schema";

import { BulkRegisterResults } from "./bulk-register-results";

function buildResult(overrides: Partial<BulkRegisterIotDevicesResult> = {}) {
  const result: BulkRegisterIotDevicesResult = {
    devices: [
      { serialNumber: "AA:BB:CC:01", device: createIotDevice(), error: null },
      { serialNumber: "AA:BB:CC:02", device: null, error: "Already registered" },
    ],
    groupId: null,
    groupError: null,
    ...overrides,
  };
  return result;
}

describe("BulkRegisterResults", () => {
  it("marks successes with a check and failures with their error", () => {
    render(<BulkRegisterResults result={buildResult()} />);

    const okRow = screen.getByText("AA:BB:CC:01").closest("li");
    expect(okRow?.querySelector("svg")).toHaveClass("text-status-active-foreground");

    const failedRow = screen.getByText("AA:BB:CC:02").closest("li");
    expect(failedRow?.querySelector("svg")).toHaveClass("text-status-stale-foreground");
    expect(screen.getByText("Already registered")).toBeInTheDocument();
  });

  it("shows the group error line when linking failed", () => {
    render(<BulkRegisterResults result={buildResult({ groupError: "Group is gone" })} />);

    expect(screen.getByText("iot.devices.bulkDialog.groupError")).toBeInTheDocument();
  });

  it("omits the group error line when linking succeeded", () => {
    render(<BulkRegisterResults result={buildResult()} />);

    expect(screen.queryByText("iot.devices.bulkDialog.groupError")).not.toBeInTheDocument();
  });
});
