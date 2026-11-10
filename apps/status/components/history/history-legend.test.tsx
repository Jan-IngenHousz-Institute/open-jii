import { screen, within } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { renderWithProviders } from "~/test/test-utils";

import { CELL } from "./history-cells";
import { HistoryLegend } from "./history-legend";

function swatchOf(name: string) {
  const swatch = screen.getByText(name).firstElementChild;
  if (swatch === null) {
    throw new Error(`no swatch beside ${name}`);
  }

  return swatch;
}

describe("HistoryLegend", () => {
  it("names the five kinds of day", () => {
    renderWithProviders(<HistoryLegend />);

    const legend = screen.getByRole("list", { name: "Color key for the history bars" });

    expect(
      within(legend)
        .getAllByRole("listitem")
        .map((item) => item.textContent),
    ).toEqual(["Operational", "Degraded", "Outage", "Maintenance", "No record"]);
  });

  it("draws each swatch like the bar it stands for", () => {
    renderWithProviders(<HistoryLegend />);

    expect(swatchOf("Operational")).toHaveClass(...CELL.operational.split(" "));
    expect(swatchOf("Outage")).toHaveClass(...CELL.outage.split(" "));
    expect(swatchOf("No record")).toHaveClass(...CELL.none.split(" "));
  });

  it("draws the maintenance swatch like the maintenance bar", () => {
    renderWithProviders(<HistoryLegend />);

    expect(swatchOf("Maintenance")).toHaveClass(...CELL.maintenance.split(" "));
  });
});
