import { describe, expect, it } from "vitest";

import { projectPublicErrorDetails } from "./public-error-details";

const CODE = "WORKBOOK_STRUCTURAL_VALIDATION_FAILED";

const validIssue = {
  code: "DYNAMIC_COMMAND_SOURCE_MISSING",
  commandCellId: "c1",
  sourceCellId: "gone",
  field: "toDevice",
  index: 1,
};

describe("projectPublicErrorDetails", () => {
  it("returns undefined for a non-public error code", () => {
    expect(
      projectPublicErrorDetails("DYNAMIC_COMMAND_PUBLISH_DISABLED", { issues: [validIssue] }),
    ).toBeUndefined();
    expect(projectPublicErrorDetails("BAD_REQUEST", { secret: "x" })).toBeUndefined();
  });

  it("projects a valid issue to exactly the public fields", () => {
    const out = projectPublicErrorDetails(CODE, { issues: [validIssue] });
    expect(out).toEqual({ issues: [validIssue] });
  });

  it("drops an optional sourceCellId cleanly when absent", () => {
    const issue = { code: "DYNAMIC_COMMAND_FIELD_EMPTY", commandCellId: "c1", field: "", index: 0 };
    const out = projectPublicErrorDetails(CODE, { issues: [issue] });
    expect(out).toEqual({ issues: [issue] });
    expect(out?.issues[0]).not.toHaveProperty("sourceCellId");
  });

  it("strips a top-level secret key", () => {
    const out = projectPublicErrorDetails(CODE, {
      issues: [validIssue],
      secret: "leak",
      token: 42,
    });
    expect(out).toEqual({ issues: [validIssue] });
    expect(JSON.stringify(out)).not.toContain("leak");
    expect(JSON.stringify(out)).not.toContain("token");
  });

  it("strips extra/nested keys inside an issue (only allowlisted fields survive)", () => {
    const out = projectPublicErrorDetails(CODE, {
      issues: [
        {
          ...validIssue,
          secret: "leak",
          payload: { rawOutput: "sensitive" },
          content: "battery",
        },
      ],
    });
    expect(out).toEqual({ issues: [validIssue] });
    const serialized = JSON.stringify(out);
    expect(serialized).not.toContain("leak");
    expect(serialized).not.toContain("sensitive");
    expect(serialized).not.toContain("battery");
  });

  it("drops issues with an unknown / spoofed code", () => {
    const out = projectPublicErrorDetails(CODE, {
      issues: [{ ...validIssue, code: "TOTALLY_MADE_UP" }],
    });
    expect(out).toEqual({ issues: [] });
  });

  it("drops malformed issue items (missing/wrong-typed fields)", () => {
    const out = projectPublicErrorDetails(CODE, {
      issues: [
        { code: "DYNAMIC_COMMAND_SOURCE_MISSING", commandCellId: 123, field: "f", index: 1 },
        { code: "DYNAMIC_COMMAND_SOURCE_MISSING", commandCellId: "c1", field: 5, index: 1 },
        { code: "DYNAMIC_COMMAND_SOURCE_MISSING", commandCellId: "c1", field: "f", index: "1" },
        { code: "DYNAMIC_COMMAND_SOURCE_MISSING", commandCellId: "c1", field: "f", index: 1.5 },
        null,
        "not-an-object",
        validIssue,
      ],
    });
    // Only the single well-formed issue survives.
    expect(out).toEqual({ issues: [validIssue] });
  });

  it("returns undefined when issues is not an array", () => {
    expect(projectPublicErrorDetails(CODE, { issues: "nope" })).toBeUndefined();
    expect(projectPublicErrorDetails(CODE, { issues: { code: "x" } })).toBeUndefined();
  });

  it("returns undefined for non-object / null / primitive details", () => {
    expect(projectPublicErrorDetails(CODE, null)).toBeUndefined();
    expect(projectPublicErrorDetails(CODE, undefined)).toBeUndefined();
    expect(projectPublicErrorDetails(CODE, "secret")).toBeUndefined();
    expect(projectPublicErrorDetails(CODE, [validIssue])).toBeUndefined();
  });

  it("drops a sourceCellId of the wrong type", () => {
    const out = projectPublicErrorDetails(CODE, {
      issues: [{ ...validIssue, sourceCellId: { nested: "obj" } }],
    });
    expect(out).toEqual({ issues: [] });
  });
});
