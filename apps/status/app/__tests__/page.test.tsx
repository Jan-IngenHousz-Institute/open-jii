import { act, fireEvent, screen, within } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { NOW, renderWithProviders, stubStatusFetch } from "~/test/test-utils";

import type { StatusDocument } from "@repo/monitoring/status-document";
import {
  incidentStatusDocument,
  operationalStatusDocument,
  plannedStatusDocument,
  resolvedIncident,
  staleStatusDocument,
  upcomingMaintenance,
} from "@repo/monitoring/status-fixtures";

import Page from "../page";

const GENERATED_AT = Date.parse(operationalStatusDocument.generatedAt);

async function renderPage(document: StatusDocument) {
  const { fetchMock } = stubStatusFetch(document);
  renderWithProviders(<Page />);
  await screen.findByRole("heading", { level: 1, name: "Platform status" });
  await screen.findByText(/Last checked|Our checks last reported/);

  return fetchMock;
}

function componentNames() {
  return screen.getAllByRole("heading", { level: 3 }).map((heading) => heading.textContent);
}

function rowOf(name: string) {
  const row = screen.getByRole("heading", { level: 3, name }).closest("[data-state]");
  if (row === null) {
    throw new Error(`no row for ${name}`);
  }

  return within(row instanceof HTMLElement ? row : document.body);
}

function sectionAfter(title: string) {
  const card = screen.getByRole("heading", { level: 2, name: title }).nextElementSibling;
  if (!(card instanceof HTMLElement)) {
    throw new Error(`no card after ${title}`);
  }

  return within(card);
}

beforeEach(() => {
  vi.useFakeTimers({ toFake: ["Date"], now: NOW });
});

describe("Page", () => {
  it("shows a skeleton while the first document loads", () => {
    stubStatusFetch("pending");
    renderWithProviders(<Page />);

    expect(screen.getByRole("status")).toHaveTextContent("Loading the current status");
    expect(screen.getByRole("heading", { level: 1, name: "Platform status" })).toBeInTheDocument();
  });

  it("shows the status unavailable when no document could be loaded", async () => {
    stubStatusFetch("fails");
    renderWithProviders(<Page />);

    expect(await screen.findByRole("heading", { name: "Status unavailable" })).toBeInTheDocument();
    expect(screen.queryByRole("status")).not.toBeInTheDocument();
    expect(screen.getByRole("link", { name: "report the problem" })).toHaveAttribute(
      "href",
      "https://docs.openjii.org/guide/reference/getting-help",
    );
  });

  it("ends in the unavailable state when the first fetch hangs, rather than staying a skeleton", async () => {
    vi.useFakeTimers({ now: NOW });
    stubStatusFetch("pending");
    renderWithProviders(<Page />);
    expect(screen.getByRole("status")).toHaveTextContent("Loading the current status");

    await act(async () => {
      await vi.advanceTimersByTimeAsync(10_000);
    });

    expect(screen.getByRole("heading", { name: "Status unavailable" })).toBeInTheDocument();
    expect(screen.queryByRole("status")).not.toBeInTheDocument();
  });

  it("links the logo to the website and keeps the theme toggle", async () => {
    await renderPage(operationalStatusDocument);

    expect(screen.getByRole("link", { name: "openJII home page" })).toHaveAttribute(
      "href",
      "https://openjii.org",
    );
    expect(screen.getByRole("button", { name: "Switch to dark mode" })).toBeInTheDocument();
  });

  describe("with every component operational", () => {
    it("says so, reads the document without the cache and names when it was checked", async () => {
      const fetchMock = await renderPage(operationalStatusDocument);

      expect(fetchMock).toHaveBeenCalledWith(
        "/data/status.json",
        expect.objectContaining({ cache: "no-store" }),
      );
      expect(screen.getByText("All systems operational")).toBeInTheDocument();
      expect(screen.getByText("No component is degraded or down right now.")).toBeInTheDocument();
      expect(screen.getByText("Last checked at 12:00 UTC, 2 min ago.")).toBeInTheDocument();
    });

    it("lists the live components in contract order with their uptime", async () => {
      await renderPage(operationalStatusDocument);

      expect(componentNames()).toEqual([
        "Website",
        "Platform",
        "Data intake",
        "Data delivery",
        "Macro processing",
      ]);
      expect(rowOf("Website").getByText("Operational")).toBeInTheDocument();
      expect(
        rowOf("Website").getByText("99.97% available in the last 90 days"),
      ).toBeInTheDocument();
      expect(rowOf("Website").getByText(/· 27 min degraded/)).toBeInTheDocument();
      expect(rowOf("Website").getByText("90 days ago")).toBeInTheDocument();
      expect(rowOf("Website").getByText("Today")).toBeInTheDocument();
    });

    it("shows the legend, how we measure, the footer and no past incidents", async () => {
      await renderPage(operationalStatusDocument);

      const legend = screen.getByRole("list", { name: "Color key for the history bars" });
      expect(within(legend).getAllByRole("listitem")).toHaveLength(5);
      expect(screen.getByRole("heading", { name: "How we measure" })).toBeInTheDocument();
      expect(
        screen.getByText(
          "Degraded means a component is slow or only partly working. Outage, also called down, means it is not working.",
        ),
      ).toBeInTheDocument();
      expect(screen.getByText("No incidents in the last 90 days.")).toBeInTheDocument();
      expect(
        screen.getByText(
          /runs separately from openJII, so it should stay reachable when the platform is down/,
        ),
      ).toBeInTheDocument();
    });
  });

  describe("component rows", () => {
    it("lists components in contract order whatever order the document holds them in", async () => {
      await renderPage({
        ...operationalStatusDocument,
        components: [...operationalStatusDocument.components].reverse(),
      });

      expect(componentNames()).toEqual([
        "Website",
        "Platform",
        "Data intake",
        "Data delivery",
        "Macro processing",
      ]);
    });

    it("leaves out the components the document does not hold", async () => {
      await renderPage(operationalStatusDocument);

      expect(screen.queryByRole("heading", { name: "Sign-in" })).not.toBeInTheDocument();
      expect(screen.queryByRole("heading", { name: "Exports" })).not.toBeInTheDocument();
    });

    it("shows a component the document does hold, in its place in the order", async () => {
      const website = operationalStatusDocument.components[0];
      const platform = operationalStatusDocument.components[1];

      await renderPage({
        ...operationalStatusDocument,
        components: [
          ...operationalStatusDocument.components,
          { ...website, id: "exports" },
          { ...platform, id: "sign-in" },
        ],
      });

      expect(componentNames()).toEqual([
        "Website",
        "Sign-in",
        "Platform",
        "Data intake",
        "Data delivery",
        "Macro processing",
        "Exports",
      ]);
    });

    it("keeps the details closed until the name is pressed", async () => {
      await renderPage(operationalStatusDocument);

      expect(screen.queryByText(/has not reported for 75 minutes/)).not.toBeInTheDocument();

      fireEvent.click(rowOf("Data delivery").getByRole("button", { name: "Data delivery" }));

      expect(screen.getByText(/has not reported for 75 minutes/)).toBeInTheDocument();
    });
  });

  describe("with an incident open", () => {
    it("names the degraded and down components, and the ones working normally", async () => {
      await renderPage(incidentStatusDocument);

      expect(
        screen.getByText("Data intake is down. Data delivery is degraded."),
      ).toBeInTheDocument();
      expect(
        screen.getByText("Website, Platform, and Macro processing are working normally."),
      ).toBeInTheDocument();
      expect(rowOf("Data intake").getByText("Outage")).toBeInTheDocument();
      expect(rowOf("Data delivery").getByText("Degraded")).toBeInTheDocument();
      expect(
        rowOf("Data delivery").getByText("The slowest recent measurements took about 27 minutes."),
      ).toBeInTheDocument();
    });

    it("shows the incident with its updates newest first", async () => {
      await renderPage(incidentStatusDocument);

      const card = screen
        .getByRole("heading", { level: 2, name: "Measurements are not reaching the platform" })
        .closest("[class~='bg-card']");
      if (!(card instanceof HTMLElement)) {
        throw new Error("no incident card");
      }
      const inCard = within(card);

      expect(inCard.getByText("Outage")).toBeInTheDocument();
      expect(
        inCard.getByText(
          "Affects Data intake and Data delivery. Started Tuesday, November 3, 2026, 11:22 UTC.",
        ),
      ).toBeInTheDocument();
      expect(
        inCard.getAllByText(/^(Investigating|Identified)$/).map((el) => el.textContent),
      ).toEqual(["Identified", "Investigating"]);
      expect(inCard.getByText("Nov 3, 11:48 UTC")).toBeInTheDocument();
      expect(inCard.getAllByText(/^Next update by/)).toHaveLength(1);
      expect(inCard.getByText("Next update by 12:20 UTC.")).toBeInTheDocument();
    });

    it("does not show the open incident among the past ones", async () => {
      await renderPage(incidentStatusDocument);

      expect(
        sectionAfter("Past incidents").getByText("No incidents in the last 90 days."),
      ).toBeInTheDocument();
    });
  });

  describe("with planned work", () => {
    it("shows the upcoming maintenance with its window and what it affects", async () => {
      await renderPage(plannedStatusDocument);

      const card = screen
        .getByRole("heading", { level: 2, name: upcomingMaintenance.title })
        .closest("[class~='bg-card']");
      if (!(card instanceof HTMLElement)) {
        throw new Error("no maintenance card");
      }
      const inCard = within(card);

      expect(inCard.getByText("Scheduled")).toBeInTheDocument();
      expect(
        inCard.getByText("Saturday, November 7, 2026, 07:00 to 09:00 UTC"),
      ).toBeInTheDocument();
      expect(
        inCard.getByText(/If you need to export data, do it before 07:00 UTC/),
      ).toBeInTheDocument();
      expect(inCard.getByText("Affects Website and Platform.")).toBeInTheDocument();
    });

    it("marks maintenance that has started as in progress", async () => {
      await renderPage({
        ...plannedStatusDocument,
        incidents: [{ ...upcomingMaintenance, startsAt: "2026-11-03T11:00:00.000Z" }],
      });

      expect(screen.getByText("In progress")).toBeInTheDocument();
      expect(screen.queryByText("Scheduled")).not.toBeInTheDocument();
    });

    it("shows a maintenance window spanning days with both ends", async () => {
      await renderPage({
        ...plannedStatusDocument,
        incidents: [{ ...upcomingMaintenance, endsAt: "2026-11-08T09:00:00.000Z" }],
      });

      expect(screen.getByText("Nov 7, 2026, 07:00 to Nov 8, 2026, 09:00 UTC")).toBeInTheDocument();
    });

    it("shows a notice from the document without interrupting a screen reader", async () => {
      await renderPage(plannedStatusDocument);

      const notice = screen.getByText("Field app update available").closest("[data-slot='alert']");

      expect(notice).toHaveAttribute("role", "status");
      expect(screen.queryByRole("alert")).not.toBeInTheDocument();
    });
  });

  describe("past incidents", () => {
    it("lists the resolved ones within 90 days, newest first, each with its closing text", async () => {
      await renderPage(plannedStatusDocument);

      const past = sectionAfter("Past incidents");

      expect(
        past.getAllByRole("heading", { level: 3 }).map((heading) => heading.textContent),
      ).toEqual([resolvedIncident.title, "Planned maintenance"]);
      expect(past.getByText("Oct 28, 2026")).toBeInTheDocument();
      expect(past.getByText("Oct 3, 2026")).toBeInTheDocument();
      expect(past.getByText("Resolved")).toBeInTheDocument();
      expect(past.getByText("Completed")).toBeInTheDocument();
      expect(
        past.getByText(/new measurements took up to 25 minutes to appear/),
      ).toBeInTheDocument();
    });

    it("leaves out incidents resolved more than 90 days ago", async () => {
      await renderPage({
        ...plannedStatusDocument,
        incidents: [
          {
            ...resolvedIncident,
            startsAt: "2026-07-01T09:10:00.000Z",
            resolvedAt: "2026-07-01T09:52:00.000Z",
          },
        ],
      });

      expect(screen.getByText("No incidents in the last 90 days.")).toBeInTheDocument();
    });
  });

  describe("freshness", () => {
    it("says the checks are delayed once the document is more than five minutes old", async () => {
      await renderPage(staleStatusDocument);

      expect(
        screen.getByText("Our checks last reported at 11:40 UTC, 22 min ago."),
      ).toBeInTheDocument();
      expect(screen.queryByText(/Last checked/)).not.toBeInTheDocument();
    });

    it("is still current at five minutes and delayed just after", async () => {
      vi.setSystemTime(GENERATED_AT + 5 * 60_000);
      await renderPage(operationalStatusDocument);
      expect(screen.getByText(/Last checked at 12:00 UTC, 5 min ago/)).toBeInTheDocument();
    });

    it("is delayed just after five minutes", async () => {
      vi.setSystemTime(GENERATED_AT + 5 * 60_000 + 1000);
      await renderPage(operationalStatusDocument);
      expect(screen.getByText(/Our checks last reported at 12:00 UTC/)).toBeInTheDocument();
    });

    it("says just now for a document written this minute", async () => {
      vi.setSystemTime(GENERATED_AT + 20_000);
      await renderPage(operationalStatusDocument);
      expect(screen.getByText(/Last checked at 12:00 UTC, just now/)).toBeInTheDocument();
    });
  });
});
