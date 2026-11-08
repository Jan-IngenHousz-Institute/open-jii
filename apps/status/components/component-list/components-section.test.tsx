import { screen, within } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { renderWithProviders } from "~/test/test-utils";

import type { StatusDocument } from "@repo/monitoring/status-document";
import { operationalStatusDocument } from "@repo/monitoring/status-fixtures";

import { ComponentsSection } from "./components-section";

function renderSection(document: StatusDocument, { isStale = false }: { isStale?: boolean } = {}) {
  renderWithProviders(
    <ComponentsSection
      components={document.components}
      incidents={document.incidents}
      today="2026-11-03"
      isStale={isStale}
    />,
  );
}

function badgeOf(name: string) {
  const row = screen.getByRole("heading", { level: 3, name }).closest("[data-state]");
  if (!(row instanceof HTMLElement)) {
    throw new Error(`no row for ${name}`);
  }

  return within(row).getByText(/^(Operational|Degraded|Outage)$/);
}

describe("ComponentsSection", () => {
  it("heads the list as Components, with the legend beside it", () => {
    renderSection(operationalStatusDocument);

    expect(screen.getByRole("heading", { level: 2, name: "Components" })).toBeInTheDocument();
    expect(screen.queryByRole("heading", { name: "Last 90 days" })).toBeNull();
    expect(
      screen.getByRole("list", { name: "Color key for the history bars" }),
    ).toBeInTheDocument();
  });

  it("lists a row for every component, each with its own strip", () => {
    renderSection(operationalStatusDocument);

    expect(
      screen.getAllByRole("heading", { level: 3 }).map((heading) => heading.textContent),
    ).toEqual(["Website", "Platform", "Data intake", "Data delivery", "Macro processing"]);
    expect(screen.getAllByRole("group")).toHaveLength(5);
  });

  describe("stale data", () => {
    it("mutes the badges", () => {
      renderSection(operationalStatusDocument, { isStale: true });

      expect(badgeOf("Website")).not.toHaveClass("bg-status-active");
    });

    it("shows the badges in their state colours when the data is fresh", () => {
      renderSection(operationalStatusDocument);

      expect(badgeOf("Website")).toHaveClass("bg-status-active");
    });
  });
});
