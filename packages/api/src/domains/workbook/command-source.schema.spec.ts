import { describe, it, expect } from "vitest";

import {
  isReferencedCommand,
  isReferencedCommandPayload,
  zCommandPayload,
  zCommandSource,
} from "./command-source.schema";
import type { CommandPayload } from "./command-source.schema";
import { zCommandCell } from "./workbook-cells.schema";

describe("zCommandPayload (static)", () => {
  it("parses a legacy static payload with no `kind`", () => {
    const parsed = zCommandPayload.safeParse({ format: "string", content: "battery" });
    expect(parsed.success).toBe(true);
  });

  it("parses a static payload with explicit kind and optional name", () => {
    const parsed = zCommandPayload.safeParse({
      kind: "static",
      format: "json",
      content: "{}",
      name: "My command",
    });
    expect(parsed.success).toBe(true);
  });

  it("rejects an empty static content", () => {
    expect(zCommandPayload.safeParse({ format: "string", content: "" }).success).toBe(false);
  });
});

describe("zCommandPayload (ref)", () => {
  it("parses a strict ref payload", () => {
    const parsed = zCommandPayload.safeParse({
      kind: "ref",
      ref: { sourceCellId: "macro1", field: "toDevice" },
    });
    expect(parsed.success).toBe(true);
  });

  it("tolerates a blank field and source id (repairable draft)", () => {
    const parsed = zCommandPayload.safeParse({
      kind: "ref",
      ref: { sourceCellId: "", field: "" },
    });
    expect(parsed.success).toBe(true);
  });

  it("rejects a mixed static/ref shape", () => {
    const mixed = zCommandPayload.safeParse({
      kind: "ref",
      ref: { sourceCellId: "m1", field: "f" },
      format: "string",
      content: "battery",
    });
    expect(mixed.success).toBe(false);
  });

  it("rejects a ref payload missing the ref object", () => {
    expect(zCommandPayload.safeParse({ kind: "ref" }).success).toBe(false);
  });
});

describe("zCommandSource (flow carrier, no author name)", () => {
  it("rejects an author name on the flow carrier", () => {
    expect(
      zCommandSource.safeParse({ format: "string", content: "battery", name: "x" }).success,
    ).toBe(false);
  });
});

describe("command cell integration", () => {
  it("accepts a static command cell", () => {
    const parsed = zCommandCell.safeParse({
      id: "c1",
      type: "command",
      isCollapsed: false,
      payload: { format: "string", content: "battery" },
    });
    expect(parsed.success).toBe(true);
  });

  it("accepts a dynamic (ref) command cell", () => {
    const parsed = zCommandCell.safeParse({
      id: "c1",
      type: "command",
      isCollapsed: false,
      payload: { kind: "ref", ref: { sourceCellId: "m1", field: "toDevice" } },
    });
    expect(parsed.success).toBe(true);
  });
});

describe("detection guards", () => {
  it("isReferencedCommandPayload distinguishes the variants", () => {
    const staticPayload: CommandPayload = { format: "string", content: "battery" };
    const refPayload: CommandPayload = { kind: "ref", ref: { sourceCellId: "m1", field: "f" } };
    expect(isReferencedCommandPayload(staticPayload)).toBe(false);
    expect(isReferencedCommandPayload(refPayload)).toBe(true);
  });

  it("isReferencedCommand handles the flow carrier and nullish", () => {
    expect(isReferencedCommand({ kind: "ref", ref: { sourceCellId: "m1", field: "f" } })).toBe(
      true,
    );
    expect(isReferencedCommand({ format: "string", content: "x" })).toBe(false);
    expect(isReferencedCommand(undefined)).toBe(false);
  });
});
