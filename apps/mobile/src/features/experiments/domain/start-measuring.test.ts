import { describe, expect, it } from "vitest";
import { canStartMeasuring } from "~/features/experiments/domain/start-measuring";

const READY = { status: "active" as const, workbookVersionId: "wv-1" };

describe("canStartMeasuring", () => {
  it("allows a member to start when the experiment is live and workbook-backed", () => {
    expect(canStartMeasuring(READY, undefined)).toEqual({ ok: true });
  });

  it("refuses an archived experiment", () => {
    expect(canStartMeasuring({ ...READY, status: "archived" }, undefined)).toEqual({
      ok: false,
      reason: "archived",
    });
  });

  it("refuses an experiment with no pinned workbook version", () => {
    expect(canStartMeasuring({ ...READY, workbookVersionId: null }, undefined)).toEqual({
      ok: false,
      reason: "no-workbook",
    });
  });

  it("reports the flow already in progress, naming the experiment it holds", () => {
    expect(canStartMeasuring(READY, "exp-other")).toEqual({
      ok: false,
      reason: "flow-in-progress",
      experimentId: "exp-other",
    });
  });

  it("reports the flow in progress even when it holds this same experiment", () => {
    expect(canStartMeasuring(READY, "exp-1")).toEqual({
      ok: false,
      reason: "flow-in-progress",
      experimentId: "exp-1",
    });
  });

  it("puts archived ahead of a missing workbook", () => {
    expect(canStartMeasuring({ status: "archived", workbookVersionId: null }, "exp-other")).toEqual(
      { ok: false, reason: "archived" },
    );
  });

  it("puts a missing workbook ahead of a flow in progress", () => {
    expect(canStartMeasuring({ ...READY, workbookVersionId: null }, "exp-other")).toEqual({
      ok: false,
      reason: "no-workbook",
    });
  });

  it.each(["active", "stale", "published"] as const)("allows a %s experiment", (status) => {
    expect(canStartMeasuring({ ...READY, status }, undefined)).toEqual({ ok: true });
  });
});
