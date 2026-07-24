import { beforeEach, describe, expect, it, vi } from "vitest";

import type { WorkbookCell } from "@repo/api/domains/workbook/workbook-cells.schema";

import { commandFailureLogFields, resolveMobileCommand } from "./mobile-command-resolution";

const mocks = vi.hoisted(() => ({ resolveCommandPayload: vi.fn() }));

vi.mock("@repo/api/transforms/command-payload", () => ({
  resolveCommandPayload: mocks.resolveCommandPayload,
}));

const cells: WorkbookCell[] = [
  {
    id: "source",
    type: "macro",
    isCollapsed: false,
    payload: { macroId: "00000000-0000-0000-0000-000000000001", language: "python" },
  },
  {
    id: "command",
    type: "command",
    isCollapsed: false,
    payload: { kind: "ref", ref: { sourceCellId: "source", field: "toDevice" } },
  },
];

describe("resolveMobileCommand", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.resolveCommandPayload.mockReturnValue({ ok: true, value: "resolved" });
  });

  it("delegates exactly once per target using the raw authored cell", () => {
    const getRuntimeCellOutput = vi.fn();

    expect(
      resolveMobileCommand({
        commandCellId: "command",
        cells,
        targetDeviceId: "device-a",
        workbookVersionId: "version-1",
        executionEpoch: "epoch-1",
        getRuntimeCellOutput,
      }),
    ).toEqual({ ok: true, value: "resolved" });

    expect(mocks.resolveCommandPayload).toHaveBeenCalledOnce();
    expect(mocks.resolveCommandPayload).toHaveBeenCalledWith({
      commandCell: cells[1],
      cells,
      targetDeviceId: "device-a",
      activeProvenance: { workbookVersionId: "version-1", executionEpoch: "epoch-1" },
      getRuntimeCellOutput,
    });
  });

  it("fails before delegation when host identity is incomplete", () => {
    const result = resolveMobileCommand({
      commandCellId: "missing",
      cells,
      targetDeviceId: "device-a",
      workbookVersionId: "version-1",
      executionEpoch: "epoch-1",
      getRuntimeCellOutput: vi.fn(),
    });
    expect(result).toMatchObject({ ok: false, error: { code: "COMMAND_CELL_MISSING" } });
    expect(mocks.resolveCommandPayload).not.toHaveBeenCalled();
  });

  it("safe log fields never include resolved values or source data", () => {
    const fields = commandFailureLogFields(
      "direct",
      {
        code: "DEVICE_OUTPUT_MISSING",
        commandCellId: "command",
        sourceCellId: "source",
        field: "SENTINEL_FIELD_NOT_LOGGED",
        targetDeviceId: "device-a",
      },
      { workbookVersionId: "version-1", executionEpoch: "epoch-1" },
    );
    expect(fields).toEqual({
      operation: "direct",
      code: "DEVICE_OUTPUT_MISSING",
      commandCellId: "command",
      sourceCellId: "source",
      targetDeviceId: "device-a",
      workbookVersionId: "version-1",
      executionEpoch: "epoch-1",
    });
    expect(JSON.stringify(fields)).not.toContain("SENTINEL_FIELD_NOT_LOGGED");
  });
});
