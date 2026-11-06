import { fireEvent, screen, within } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { renderWithProviders } from "~/test/test-utils";

import type { StatusDocument } from "@repo/monitoring/status-document";
import {
  incidentStatusDocument,
  operationalStatusDocument,
} from "@repo/monitoring/status-fixtures";

import { ComponentsSection } from "./components-section";

const CODE = [
  "ArrowUp",
  "ArrowUp",
  "ArrowDown",
  "ArrowDown",
  "ArrowLeft",
  "ArrowRight",
  "ArrowLeft",
  "ArrowRight",
  "b",
  "a",
];

function renderSection(
  document: StatusDocument,
  { hasExtras = true, isStale = false }: { hasExtras?: boolean; isStale?: boolean } = {},
) {
  renderWithProviders(
    <ComponentsSection
      components={document.components}
      incidents={document.incidents}
      generatedAt={document.generatedAt}
      messagesPerMinute={document.messagesPerMinute}
      hasExtras={hasExtras}
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

function enterCode() {
  for (const key of CODE) {
    fireEvent.keyDown(window, { key });
  }
}

function firstBar() {
  return within(screen.getAllByRole("group")[0] ?? document.body).getAllByRole("img", {
    hidden: true,
  })[0];
}

beforeEach(() => {
  vi.useFakeTimers();
});

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

  describe("with extras", () => {
    it("shows the leaf beside the Data intake badge", () => {
      renderSection(operationalStatusDocument);

      expect(document.querySelectorAll("svg.lucide-leaf")).toHaveLength(1);
    });

    it("topples the bars on the code", () => {
      renderSection(operationalStatusDocument);

      enterCode();

      expect(firstBar()).toHaveClass("animate-domino-fall");
    });
  });

  describe("without extras", () => {
    it("shows no leaf", () => {
      renderSection(incidentStatusDocument, { hasExtras: false });

      expect(document.querySelectorAll("svg.lucide-leaf")).toHaveLength(0);
    });

    it("leaves the bars standing when the code is entered", () => {
      renderSection(incidentStatusDocument, { hasExtras: false });

      enterCode();

      expect(firstBar()).not.toHaveClass("animate-domino-fall");
    });
  });

  describe("stale data", () => {
    it("mutes the badges", () => {
      renderSection(operationalStatusDocument, { hasExtras: false, isStale: true });

      expect(badgeOf("Website")).not.toHaveClass("bg-status-active");
    });

    it("shows the badges in their state colours when the data is fresh", () => {
      renderSection(operationalStatusDocument);

      expect(badgeOf("Website")).toHaveClass("bg-status-active");
    });
  });
});
