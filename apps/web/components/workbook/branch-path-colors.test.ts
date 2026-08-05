import { describe, expect, it } from "vitest";

import {
  BRANCH_PATH_COLORS,
  nextBranchPathColor,
  resolveBranchPathColor,
} from "./branch-path-colors";

describe("branch path colors", () => {
  it("chooses a distinct unassigned accent when possible", () => {
    expect(nextBranchPathColor([BRANCH_PATH_COLORS[0], BRANCH_PATH_COLORS[1]])).toBe(
      BRANCH_PATH_COLORS[2],
    );
  });

  it("cycles the accent palette once every color is assigned", () => {
    expect(nextBranchPathColor([...BRANCH_PATH_COLORS])).toBe(BRANCH_PATH_COLORS[0]);
  });

  it("renders legacy empty colors with a deterministic accent without rewriting them", () => {
    expect(resolveBranchPathColor("", 1)).toBe(BRANCH_PATH_COLORS[1]);
    expect(resolveBranchPathColor("#abcdef", 1)).toBe("#abcdef");
  });
});
