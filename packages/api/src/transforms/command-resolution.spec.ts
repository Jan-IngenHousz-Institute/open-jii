import { describe, expect, it, vi } from "vitest";

import type { CommandCell, WorkbookCell } from "../domains/workbook/workbook-cells.schema";
import { resolveCommandPayload } from "./command-payload";
import type { CommandResolutionFailureCode } from "./command-resolution";
import type { RuntimeCellOutput } from "./runtime-output";
import { runtimeOutputFromQuestionAnswer } from "./runtime-output";

const uuid = "11111111-1111-1111-1111-111111111111";
const active = { workbookVersionId: "version-1", executionEpoch: "epoch-1" };

function source(type: "protocol" | "command" | "macro" | "question", id = "source"): WorkbookCell {
  switch (type) {
    case "protocol":
      return {
        id,
        type,
        isCollapsed: false,
        payload: { protocolId: uuid, version: 1, name: "Protocol" },
      };
    case "command":
      return {
        id,
        type,
        isCollapsed: false,
        payload: { format: "string", content: "battery", name: "Prior command" },
      };
    case "macro":
      return {
        id,
        type,
        isCollapsed: false,
        payload: { macroId: uuid, language: "python", name: "Macro" },
      };
    case "question":
      return {
        id,
        type,
        isCollapsed: false,
        name: "Question",
        question: { kind: "open_ended", text: "Command?", required: false },
        isAnswered: true,
      };
  }
}

function refCommand(sourceCellId = "source", field = "value", id = "command"): CommandCell {
  return {
    id,
    type: "command",
    isCollapsed: false,
    payload: { kind: "ref", ref: { sourceCellId, field } },
  };
}

function displayOutput(id = "output", producedBy = "source", data?: unknown): WorkbookCell {
  return { id, type: "output", isCollapsed: false, producedBy, data };
}

function markdownSource(id = "source"): WorkbookCell {
  return { id, type: "markdown", isCollapsed: false, content: "note" };
}

function shared(data: unknown, provenance = active): RuntimeCellOutput {
  return { scope: "shared", provenance, data };
}

function device(
  deviceResults: Extract<RuntimeCellOutput, { scope: "device" }>["deviceResults"],
  provenance = active,
): RuntimeCellOutput {
  return { scope: "device", provenance, deviceResults };
}

function expectFailureCode(
  result: ReturnType<typeof resolveCommandPayload>,
  code: CommandResolutionFailureCode,
): void {
  expect(result.ok).toBe(false);
  if (!result.ok) expect(result.error.code).toBe(code);
}

describe("resolveCommandPayload static compatibility", () => {
  it.each([
    ["string", "  battery  ", "  battery  "],
    ["json", '[{"c":1}]', [{ c: 1 }]],
    ["yaml", "- c: 1\n- c: 2", [{ c: 1 }, { c: 2 }]],
  ] as const)("preserves %s resolution", (format, content, expected) => {
    const commandCell: CommandCell = {
      id: "command",
      type: "command",
      isCollapsed: false,
      payload: { format, content },
    };
    const provider = vi.fn(() => undefined);

    expect(
      resolveCommandPayload({
        commandCell,
        cells: [commandCell],
        activeProvenance: active,
        getRuntimeCellOutput: provider,
      }),
    ).toEqual({ ok: true, value: expected });
    expect(provider).not.toHaveBeenCalled();
  });

  it("returns malformed static JSON as a typed value failure instead of throwing", () => {
    const commandCell: CommandCell = {
      id: "command",
      type: "command",
      isCollapsed: false,
      payload: { format: "json", content: "{" },
    };
    const result = resolveCommandPayload({
      commandCell,
      cells: [commandCell],
      activeProvenance: active,
      getRuntimeCellOutput: () => undefined,
    });
    expectFailureCode(result, "STATIC_COMMAND_INVALID");
  });
});

describe("resolveCommandPayload eligible sources and scope", () => {
  it.each([
    {
      label: "protocol / one-device",
      sourceType: "protocol" as const,
      targetDeviceId: "dev-1",
      field: "value",
      output: device([{ deviceId: "dev-1", data: { value: "protocol-command" } }]),
      expected: "protocol-command",
    },
    {
      label: "command-as-source / multi-device",
      sourceType: "command" as const,
      targetDeviceId: "dev-2",
      field: "value",
      output: device([
        { deviceId: "dev-1", data: { value: "first" } },
        { deviceId: "dev-2", data: { value: "second" } },
      ]),
      expected: "second",
    },
    {
      label: "macro / shared",
      sourceType: "macro" as const,
      targetDeviceId: "dev-any",
      field: "value",
      output: shared({ value: "shared-macro" }),
      expected: "shared-macro",
    },
    {
      label: "question / shared answer",
      sourceType: "question" as const,
      targetDeviceId: "dev-any",
      field: "answer",
      output: runtimeOutputFromQuestionAnswer("shared-answer", active),
      expected: "shared-answer",
    },
  ])("resolves $label", ({ sourceType, targetDeviceId, field, output, expected }) => {
    const producer = source(sourceType);
    const commandCell = refCommand("source", field);
    const result = resolveCommandPayload({
      commandCell,
      cells: [producer, displayOutput(), commandCell],
      targetDeviceId,
      activeProvenance: active,
      getRuntimeCellOutput: () => output,
    });
    expect(result).toEqual({ ok: true, value: expected });
  });

  it.each([
    {
      label: "macro",
      producer: source("macro"),
      commandCell: refCommand("source", "value"),
      output: shared({ value: "same" }),
    },
    {
      label: "question",
      producer: source("question"),
      commandCell: refCommand("source", "answer"),
      output: runtimeOutputFromQuestionAnswer("same", active),
    },
  ])("resolves one shared $label value identically for multiple targets", (fixture) => {
    const { producer, commandCell, output } = fixture;
    const options = {
      commandCell,
      cells: [producer, commandCell],
      activeProvenance: active,
      getRuntimeCellOutput: () => output,
    };

    expect(resolveCommandPayload({ ...options, targetDeviceId: "dev-1" })).toEqual({
      ok: true,
      value: "same",
    });
    expect(resolveCommandPayload({ ...options, targetDeviceId: "dev-2" })).toEqual({
      ok: true,
      value: "same",
    });
  });
});

describe("resolveCommandPayload structural and freshness failures", () => {
  it.each([
    {
      label: "blank source",
      cells: [refCommand("   ")],
      command: refCommand("   "),
      code: "COMMAND_SOURCE_MISSING" as const,
    },
    {
      label: "deleted source",
      cells: [refCommand("gone")],
      command: refCommand("gone"),
      code: "COMMAND_SOURCE_MISSING" as const,
    },
    {
      label: "ineligible markdown source",
      cells: [markdownSource(), refCommand()],
      command: refCommand(),
      code: "COMMAND_SOURCE_INELIGIBLE" as const,
    },
    {
      label: "later source reached first by runtime goto",
      cells: [refCommand(), source("macro")],
      command: refCommand(),
      code: "COMMAND_SOURCE_NOT_EARLIER" as const,
    },
    {
      label: "blank field",
      cells: [source("macro"), refCommand("source", "   ")],
      command: refCommand("source", "   "),
      code: "COMMAND_FIELD_EMPTY" as const,
    },
  ])("returns $code for $label", ({ cells, command, code }) => {
    const result = resolveCommandPayload({
      commandCell: command,
      cells,
      targetDeviceId: "dev-1",
      activeProvenance: active,
      getRuntimeCellOutput: () => shared({ value: "must-not-resolve" }),
    });
    expectFailureCode(result, code);
  });

  it.each([
    ["prior workbook version", { workbookVersionId: "version-0", executionEpoch: "epoch-1" }],
    ["prior execution epoch", { workbookVersionId: "version-1", executionEpoch: "epoch-0" }],
  ] as const)("rejects %s provenance", (_label, provenance) => {
    const producer = source("macro");
    const commandCell = refCommand();
    const result = resolveCommandPayload({
      commandCell,
      cells: [producer, commandCell],
      activeProvenance: active,
      getRuntimeCellOutput: () => shared({ value: "stale" }, provenance),
    });
    expectFailureCode(result, "COMMAND_SOURCE_STALE");
  });

  it("excludes output cells from authored order", () => {
    const producer = source("macro");
    const commandCell = refCommand();
    const result = resolveCommandPayload({
      commandCell,
      cells: [producer, displayOutput("out"), commandCell],
      activeProvenance: active,
      getRuntimeCellOutput: () => shared({ value: "ordered" }),
    });
    expect(result).toEqual({ ok: true, value: "ordered" });
  });

  it("returns output missing when a branch skipped the earlier source", () => {
    const producer = source("macro");
    const commandCell = refCommand();
    const result = resolveCommandPayload({
      commandCell,
      cells: [producer, commandCell],
      activeProvenance: active,
      getRuntimeCellOutput: () => undefined,
    });
    expectFailureCode(result, "COMMAND_OUTPUT_MISSING");
  });

  it("reads the latest same-epoch producer completion in a loop", () => {
    const producer = source("macro");
    const commandCell = refCommand();
    let current = shared({ value: "first" });
    const options = {
      commandCell,
      cells: [producer, commandCell],
      activeProvenance: active,
      getRuntimeCellOutput: () => current,
    };

    expect(resolveCommandPayload(options)).toEqual({ ok: true, value: "first" });
    current = shared({ value: "latest" });
    expect(resolveCommandPayload(options)).toEqual({ ok: true, value: "latest" });
  });
});

describe("resolveCommandPayload output/device/value failures", () => {
  function resolveOutput(output: RuntimeCellOutput | undefined, cells?: WorkbookCell[]) {
    const producer = source("macro");
    const commandCell = refCommand();
    return resolveCommandPayload({
      commandCell,
      cells: cells ?? [producer, commandCell],
      targetDeviceId: "dev-new",
      activeProvenance: active,
      getRuntimeCellOutput: () => output,
    });
  }

  it("rejects duplicate output cells for one producer", () => {
    expectFailureCode(
      resolveOutput(shared({ value: "x" }), [
        source("macro"),
        displayOutput("out-1"),
        displayOutput("out-2"),
        refCommand(),
      ]),
      "COMMAND_OUTPUT_DUPLICATE",
    );
  });

  it("rejects conflicting scope instead of using primary data", () => {
    const conflicting = {
      scope: "device",
      provenance: active,
      data: { value: "SENTINEL_PRIMARY" },
      deviceResults: [{ deviceId: "dev-other", data: { value: "other" } }],
    } as RuntimeCellOutput;
    const result = resolveOutput(conflicting);
    expectFailureCode(result, "COMMAND_OUTPUT_INVALID");
    expect(JSON.stringify(result)).not.toContain("SENTINEL_PRIMARY");
  });

  it("rejects duplicate device ids before selecting a value", () => {
    expectFailureCode(
      resolveOutput(
        device([
          { deviceId: "dev-new", data: { value: "first" } },
          { deviceId: "dev-new", data: { value: "second" } },
        ]),
      ),
      "DEVICE_OUTPUT_DUPLICATE",
    );
  });

  it("pre-fails a reconnected device id without other-device or display fallback", () => {
    const result = resolveOutput(device([{ deviceId: "dev-old", data: { value: "old-device" } }]), [
      source("macro"),
      displayOutput("out", "source", { value: "primary-display" }),
      refCommand(),
    ]);
    expectFailureCode(result, "DEVICE_OUTPUT_MISSING");
    expect(JSON.stringify(result)).not.toContain("old-device");
    expect(JSON.stringify(result)).not.toContain("primary-display");
  });

  it("returns a typed source-device failure without its raw error", () => {
    const result = resolveOutput(device([{ deviceId: "dev-new", error: "SENTINEL_SOURCE_ERROR" }]));
    expectFailureCode(result, "SOURCE_DEVICE_FAILED");
    expect(JSON.stringify(result)).not.toContain("SENTINEL_SOURCE_ERROR");
  });

  it.each([
    ["missing field", shared({ other: "x" }), "COMMAND_FIELD_MISSING"],
    ["non-string field", shared({ value: 42 }), "COMMAND_VALUE_NOT_STRING"],
    ["empty field", shared({ value: "  " }), "COMMAND_VALUE_EMPTY"],
    ["non-object output", shared(["x"]), "COMMAND_OUTPUT_INVALID"],
  ] as const)("returns a typed failure for %s", (_label, output, code) => {
    expectFailureCode(resolveOutput(output), code);
  });

  it("converts a throwing host adapter into an output failure", () => {
    const producer = source("macro");
    const commandCell = refCommand();
    const result = resolveCommandPayload({
      commandCell,
      cells: [producer, commandCell],
      activeProvenance: active,
      getRuntimeCellOutput: () => {
        throw new Error("SENTINEL_ADAPTER_SECRET");
      },
    });
    expectFailureCode(result, "COMMAND_OUTPUT_INVALID");
    expect(JSON.stringify(result)).not.toContain("SENTINEL_ADAPTER_SECRET");
  });
});
