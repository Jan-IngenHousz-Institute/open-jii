import { describe, expect, it } from "vitest";

import { CELL, HISTORY_LEGEND } from "../history-cells";

describe("CELL", () => {
  it("draws maintenance at full strength in light mode and as a 60% mix with the card in dark", () => {
    expect(CELL.maintenance.split(" ")).toEqual([
      "bg-status-published-foreground",
      "dark:bg-[color-mix(in_srgb,var(--status-published-foreground)_60%,var(--card))]",
    ]);
  });

  it("has a look for every state the legend names", () => {
    for (const state of HISTORY_LEGEND) {
      expect(CELL[state], state).not.toBe("");
    }
    expect(HISTORY_LEGEND).toEqual(["operational", "degraded", "outage", "maintenance", "none"]);
  });
});
