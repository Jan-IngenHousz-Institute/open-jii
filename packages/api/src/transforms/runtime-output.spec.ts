import { describe, expect, it } from "vitest";

import {
  hasMatchingProvenance,
  isRuntimeCellOutput,
  runtimeOutputFromQuestionAnswer,
} from "./runtime-output";

const provenance = { workbookVersionId: "version-1", executionEpoch: "epoch-1" };

describe("RuntimeCellOutput", () => {
  it("accepts strict shared and device-scoped envelopes with arbitrary data", () => {
    expect(isRuntimeCellOutput({ scope: "shared", provenance, data: { nested: [1, null] } })).toBe(
      true,
    );
    expect(
      isRuntimeCellOutput({
        scope: "device",
        provenance,
        deviceResults: [
          { deviceId: "dev-1", data: { value: "one" } },
          { deviceId: "dev-2", error: "failed" },
        ],
      }),
    ).toBe(true);
  });

  it.each([
    {
      scope: "shared",
      provenance,
      data: {},
      deviceResults: [],
    },
    {
      scope: "device",
      provenance,
      deviceResults: [],
      data: { value: "primary must not coexist" },
    },
    { scope: "other", provenance, data: {} },
    { scope: "shared", provenance: { workbookVersionId: "", executionEpoch: "e" }, data: {} },
  ])("rejects malformed or conflicting scope envelopes", (output) => {
    expect(isRuntimeCellOutput(output)).toBe(false);
  });

  it("adapts a current-cycle question answer as shared { answer } data", () => {
    expect(runtimeOutputFromQuestionAnswer("yes", provenance)).toEqual({
      scope: "shared",
      provenance,
      data: { answer: "yes" },
    });
  });

  it("requires both workbook version and execution epoch to match", () => {
    expect(hasMatchingProvenance(provenance, { ...provenance })).toBe(true);
    expect(
      hasMatchingProvenance(provenance, { ...provenance, workbookVersionId: "version-2" }),
    ).toBe(false);
    expect(hasMatchingProvenance(provenance, { ...provenance, executionEpoch: "epoch-2" })).toBe(
      false,
    );
  });
});
