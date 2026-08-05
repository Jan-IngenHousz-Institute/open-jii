import { describe, expect, it } from "vitest";

import {
  BRANCH_PATH_COLORS,
  nextBranchPathColor,
  resolveBranchPathColor,
} from "./branch-path-colors";

describe("branch path colors", () => {
  it("chooses a distinct unassigned accent when possible", () => {
    expect(
      nextBranchPathColor([
        { id: "a", color: BRANCH_PATH_COLORS[0] },
        { id: "b", color: BRANCH_PATH_COLORS[1] },
      ]),
    ).toBe(BRANCH_PATH_COLORS[2]);
  });

  it("cycles the accent palette once every color is assigned", () => {
    expect(
      nextBranchPathColor(BRANCH_PATH_COLORS.map((color, index) => ({ id: `${index}`, color }))),
    ).toBe(BRANCH_PATH_COLORS[0]);
  });

  it("keeps a legacy path's fallback color stable across reordering", () => {
    const color = resolveBranchPathColor("", "legacy-path");
    expect(color).toBe(resolveBranchPathColor("", "legacy-path"));
    expect(resolveBranchPathColor("#abcdef", "legacy-path")).toBe("#abcdef");
  });

  it("does not reuse a legacy path's effective fallback when adding a path", () => {
    const legacyPath = { id: "legacy-path", color: "" };
    expect(nextBranchPathColor([legacyPath])).not.toBe(
      resolveBranchPathColor(legacyPath.color, legacyPath.id),
    );
  });
});
