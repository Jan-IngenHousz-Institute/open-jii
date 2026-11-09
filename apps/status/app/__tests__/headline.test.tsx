import { screen, within } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { NOW, renderWithProviders, stubStatusFetch } from "~/test/test-utils";

import type {
  ComponentState,
  Incident,
  StatusComponentId,
  StatusDocument,
} from "@repo/monitoring/status-document";
import {
  incidentStatusDocument,
  maintenanceInProgress,
  maintenanceStatusDocument,
  operationalStatusDocument,
  staleStatusDocument,
} from "@repo/monitoring/status-fixtures";

import Page from "../page";

type States = Partial<Record<StatusComponentId, ComponentState>>;

function withStates(document: StatusDocument, states: States): StatusDocument {
  return {
    ...document,
    components: document.components.map((component) => ({
      ...component,
      state: states[component.id] ?? component.state,
    })),
  };
}

async function renderPage(document: StatusDocument) {
  stubStatusFetch(document);
  renderWithProviders(<Page />);
  await screen.findByRole("heading", { level: 1, name: "Platform status" });
  await screen.findByText(/Last checked|Our checks last reported|We could not refresh/);
}

function headline() {
  const region = screen.getByRole("status");
  const card = region.closest("[class~='bg-card']");
  if (!(card instanceof HTMLElement)) {
    throw new Error("no headline card");
  }

  return { region, card, inCard: within(card) };
}

function rowOf(name: string) {
  const row = screen.getByRole("heading", { level: 3, name }).closest("[data-state]");
  if (row === null) {
    throw new Error(`no row for ${name}`);
  }

  return within(row instanceof HTMLElement ? row : document.body);
}

function iconOf(card: HTMLElement) {
  return card.querySelector("svg")?.getAttribute("class") ?? "";
}

beforeEach(() => {
  vi.useFakeTimers({ toFake: ["Date"], now: NOW });
});

describe("the headline", () => {
  describe("when every component is operational", () => {
    it("ticks green and says no component is degraded or down", async () => {
      await renderPage(operationalStatusDocument);

      const { card, region } = headline();

      expect(region).toHaveTextContent(
        "All systems operationalNo component is degraded or down right now.",
      );
      expect(iconOf(card)).toContain("text-status-active-foreground");
      expect(iconOf(card)).toContain("lucide-circle-check");
    });

    it("tells a visitor who still has trouble where to report it, outside the live region", async () => {
      await renderPage(operationalStatusDocument);

      const { card, region, inCard } = headline();
      const link = inCard.getByRole("link", { name: "report the problem" });

      expect(card).toHaveTextContent(
        "If something still does not work for you, check your connection first and then",
      );
      expect(link).toHaveAttribute("href", "https://docs.openjii.org/guide/reference/getting-help");
      expect(region).not.toContainElement(link);
    });
  });

  describe("when components are degraded or down", () => {
    it("leaves the contact line out, since the page already says something is wrong", async () => {
      await renderPage(incidentStatusDocument);

      expect(screen.queryByRole("link", { name: "report the problem" })).not.toBeInTheDocument();
    });

    it("is red when any component is down, even with another degraded", async () => {
      await renderPage(incidentStatusDocument);

      const { card, region } = headline();

      expect(region).toHaveTextContent("Data intake is down. Data delivery is degraded.");
      expect(iconOf(card)).toContain("text-destructive");
      expect(iconOf(card)).not.toContain("text-status-stale-foreground");
      expect(iconOf(card)).toContain("lucide-octagon-x");
    });

    it("is amber when components are only degraded", async () => {
      await renderPage(withStates(incidentStatusDocument, { "data-intake": "degraded" }));

      const { card, region } = headline();

      expect(region).toHaveTextContent("Data intake and Data delivery are degraded.");
      expect(iconOf(card)).toContain("text-status-stale-foreground");
      expect(iconOf(card)).toContain("lucide-triangle-alert");
    });

    it("names the components working normally beneath", async () => {
      await renderPage(incidentStatusDocument);

      expect(
        headline().inCard.getByText(
          "Website, Platform, and Macro processing are working normally.",
        ),
      ).toBeInTheDocument();
    });

    it("leaves out the description when nothing is working", async () => {
      await renderPage(
        withStates(operationalStatusDocument, {
          website: "outage",
          platform: "outage",
          "data-intake": "outage",
          "data-delivery": "outage",
          "macro-processing": "outage",
        }),
      );

      const paragraphs = headline().region.querySelectorAll("p");

      expect(paragraphs).toHaveLength(1);
      expect(paragraphs[0]).toHaveTextContent(
        "Website, Platform, Data intake, Data delivery, and Macro processing are down.",
      );
    });
  });

  describe("during planned maintenance", () => {
    it("names the components under maintenance until the window ends, in the maintenance colour", async () => {
      await renderPage(maintenanceStatusDocument);

      const { card, region } = headline();

      expect(region).toHaveTextContent(
        "Website and Platform are under planned maintenance until 13:00 UTC.",
      );
      expect(region).toHaveTextContent(
        "Data intake, Data delivery, and Macro processing are working normally.",
      );
      expect(iconOf(card)).toContain("text-status-published-foreground");
      expect(iconOf(card)).not.toContain("text-destructive");
      expect(iconOf(card)).toContain("lucide-wrench");
    });

    it("gives the date as well when the window ends on a later day", async () => {
      const overnight: Incident = { ...maintenanceInProgress, endsAt: "2026-11-04T02:00:00.000Z" };

      await renderPage({ ...maintenanceStatusDocument, incidents: [overnight] });

      expect(headline().region).toHaveTextContent(
        "Website and Platform are under planned maintenance until Nov 4, 2026, 02:00 UTC.",
      );
    });

    it("gives no end when the window has none", async () => {
      const openEnded: Incident = { ...maintenanceInProgress };
      delete openEnded.endsAt;

      await renderPage({ ...maintenanceStatusDocument, incidents: [openEnded] });

      expect(headline().region).toHaveTextContent(
        /^Website and Platform are under planned maintenance\.Data intake/,
      );
    });

    it("lets a component that is down speak first, naming only the ones that are down", async () => {
      await renderPage(withStates(maintenanceStatusDocument, { "data-intake": "outage" }));

      const { card, region } = headline();

      expect(region).toHaveTextContent(
        /^Data intake is down\.Data delivery and Macro processing are working normally\.$/,
      );
      expect(iconOf(card)).toContain("text-destructive");
    });

    it("shows the maintenance badge on the components under maintenance, not an outage", async () => {
      await renderPage(maintenanceStatusDocument);

      for (const name of ["Website", "Platform"]) {
        expect(rowOf(name).getByText("Maintenance")).toBeInTheDocument();
        expect(rowOf(name).queryByText("Outage")).not.toBeInTheDocument();
      }
      expect(rowOf("Data intake").getByText("Operational")).toBeInTheDocument();
    });

    it("puts the open window above the components", async () => {
      await renderPage(maintenanceStatusDocument);

      const window = screen.getByRole("heading", { level: 2, name: maintenanceInProgress.title });
      const [firstComponent] = screen.getAllByRole("heading", { level: 3 });

      expect(screen.getByText("In progress")).toBeInTheDocument();
      expect(window.compareDocumentPosition(firstComponent)).toBe(Node.DOCUMENT_POSITION_FOLLOWING);
    });
  });

  describe("when the data is stale", () => {
    it("says the status may be out of date instead of claiming green", async () => {
      await renderPage(staleStatusDocument);

      const { card, region } = headline();

      expect(region).toHaveTextContent(
        "Status may be out of dateThe components below show the last status our checks reported.",
      );
      expect(screen.queryByText("All systems operational")).not.toBeInTheDocument();
      expect(iconOf(card)).toContain("text-status-archived-foreground");
      expect(iconOf(card)).toContain("lucide-circle-help");
      expect(iconOf(card)).not.toContain("circle-check");
    });

    it("stays neutral even when the last known state was bad", async () => {
      await renderPage({
        ...incidentStatusDocument,
        generatedAt: staleStatusDocument.generatedAt,
      });

      expect(headline().region).toHaveTextContent("Status may be out of date");
      expect(iconOf(headline().card)).not.toContain("text-destructive");
    });

    it("keeps the last known state on the badges, muted", async () => {
      await renderPage({
        ...incidentStatusDocument,
        generatedAt: staleStatusDocument.generatedAt,
      });

      const outage = rowOf("Data intake").getByText("Outage");

      expect(outage).toHaveClass("bg-status-archived");
      expect(outage).not.toHaveClass("bg-destructive");
    });
  });

  describe("as a live region", () => {
    it("holds the title and description and nothing else", async () => {
      await renderPage(operationalStatusDocument);

      const { region } = headline();

      expect(region).toHaveAttribute("aria-atomic", "true");
      expect(region).not.toHaveTextContent(/Last checked/);
      expect(region.querySelectorAll("p")).toHaveLength(2);
    });

    it("leaves the freshness line outside, so its ticking is never announced", async () => {
      await renderPage(operationalStatusDocument);

      const freshness = screen.getByText(/Last checked/);

      expect(freshness.closest("[role='status']")).toBeNull();
    });
  });
});
