import { act, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { NOW, renderWithProviders, stubStatusFetch } from "~/test/test-utils";

import type { StatusDocument } from "@repo/monitoring/status-document";
import {
  incidentStatusDocument,
  operationalStatusDocument,
  plannedStatusDocument,
  staleStatusDocument,
  upcomingMaintenance,
} from "@repo/monitoring/status-fixtures";

import Page from "../page";

const HOUR_MS = 3_600_000;
const SERVER_NOW = new Date(NOW).toUTCString();

async function advance(ms: number) {
  await act(async () => {
    await vi.advanceTimersByTimeAsync(ms);
  });
}

async function renderPage(document: StatusDocument, serverDate?: string) {
  const stub = stubStatusFetch(document, serverDate);
  renderWithProviders(<Page />);
  await advance(0);

  return stub;
}

beforeEach(() => {
  vi.useFakeTimers({ now: NOW });
});

describe("the page's clock", () => {
  describe("when the device clock is wrong", () => {
    it("does not invent staleness when the clock runs ahead", async () => {
      vi.setSystemTime(NOW + 3 * HOUR_MS);

      await renderPage(operationalStatusDocument, SERVER_NOW);

      expect(screen.getByText("Last checked at 12:00 UTC, 2 min ago.")).toBeInTheDocument();
      expect(screen.getByText("All systems operational")).toBeInTheDocument();
    });

    it("does not hide staleness when the clock runs behind", async () => {
      vi.setSystemTime(NOW - 3 * HOUR_MS);

      await renderPage(staleStatusDocument, SERVER_NOW);

      expect(
        screen.getByText("Our checks last reported at 11:40 UTC, 22 min ago."),
      ).toBeInTheDocument();
      expect(screen.getByText("Status may be out of date")).toBeInTheDocument();
    });

    it("counts a fresh document's age on the server's clock", async () => {
      vi.setSystemTime(NOW - 3 * HOUR_MS);

      await renderPage(operationalStatusDocument, SERVER_NOW);

      expect(screen.getByText(/Last checked at 12:00 UTC, 2 min ago/)).toBeInTheDocument();
    });

    it("falls back to the device clock when the response has no Date header", async () => {
      vi.setSystemTime(NOW + 3 * HOUR_MS);

      await renderPage(operationalStatusDocument);

      expect(
        screen.getByText(/Our checks last reported at 12:00 UTC, 3 h 2 min ago/),
      ).toBeInTheDocument();
    });

    it("decides whether maintenance is in progress on the server's clock", async () => {
      vi.setSystemTime(NOW - 3 * HOUR_MS);

      await renderPage(
        {
          ...plannedStatusDocument,
          incidents: [{ ...upcomingMaintenance, startsAt: "2026-11-03T11:00:00.000Z" }],
        },
        SERVER_NOW,
      );

      expect(screen.getByText("In progress")).toBeInTheDocument();
      expect(screen.queryByText("Scheduled")).not.toBeInTheDocument();
    });

    it("still shows an incident the device clock says has not started", async () => {
      vi.setSystemTime(NOW - 3 * HOUR_MS);

      await renderPage(incidentStatusDocument);

      expect(
        screen.getByRole("heading", {
          level: 2,
          name: "Measurements are not reaching the platform",
        }),
      ).toBeInTheDocument();
    });
  });

  describe("as time passes", () => {
    it("ages the last check every quarter of a minute", async () => {
      await renderPage(operationalStatusDocument);
      expect(screen.getByText(/Last checked at 12:00 UTC, 2 min ago/)).toBeInTheDocument();

      await advance(45_000);
      expect(screen.getByText(/Last checked at 12:00 UTC, 2 min ago/)).toBeInTheDocument();

      await advance(15_000);
      expect(screen.getByText(/Last checked at 12:00 UTC, 3 min ago/)).toBeInTheDocument();
    });

    it("turns stale once the document passes five minutes, without a new fetch", async () => {
      vi.setSystemTime(NOW + 2.5 * 60_000);
      await renderPage(operationalStatusDocument, new Date(NOW + 2.5 * 60_000).toUTCString());
      expect(screen.getByText("All systems operational")).toBeInTheDocument();

      await advance(45_000);

      expect(screen.getByText("Status may be out of date")).toBeInTheDocument();
      expect(screen.getByText(/Our checks last reported at 12:00 UTC/)).toBeInTheDocument();
    });

    it("moves a window from scheduled to in progress when it starts", async () => {
      await renderPage({
        ...plannedStatusDocument,
        incidents: [{ ...upcomingMaintenance, startsAt: new Date(NOW + 20_000).toISOString() }],
      });
      expect(screen.getByText("Scheduled")).toBeInTheDocument();

      await advance(30_000);

      expect(screen.getByText("In progress")).toBeInTheDocument();
    });

    it("moves a window to the past when it ends", async () => {
      await renderPage({
        ...plannedStatusDocument,
        incidents: [
          {
            ...upcomingMaintenance,
            startsAt: new Date(NOW - 60_000).toISOString(),
            endsAt: new Date(NOW + 20_000).toISOString(),
          },
        ],
      });
      expect(screen.getByText("In progress")).toBeInTheDocument();

      await advance(30_000);

      expect(screen.queryByText("In progress")).not.toBeInTheDocument();
      expect(screen.getByText("Completed")).toBeInTheDocument();
    });
  });

  describe("when a refresh fails", () => {
    const REFRESH_FAILED =
      "We could not refresh this page and will keep trying every minute. Until then it shows the status from 12:00 UTC.";

    it.each(["fails", "http-error", "garbage"] as const)(
      "says so, rather than blaming our checks, when it %s",
      async (failure) => {
        const { respondWith } = await renderPage(operationalStatusDocument);

        respondWith(failure);
        await advance(60_000);

        expect(screen.getByText(REFRESH_FAILED)).toBeInTheDocument();
        expect(screen.queryByText(/Our checks last reported/)).not.toBeInTheDocument();
        expect(screen.queryByText(/Last checked/)).not.toBeInTheDocument();
      },
    );

    it("goes back to the usual line once a refresh works again", async () => {
      const { respondWith } = await renderPage(operationalStatusDocument);
      respondWith("fails");
      await advance(60_000);

      respondWith(operationalStatusDocument);
      await advance(60_000);

      expect(screen.queryByText(REFRESH_FAILED)).not.toBeInTheDocument();
      expect(screen.getByText(/Last checked at 12:00 UTC/)).toBeInTheDocument();
    });

    it("keeps the headline honest about how old the data has become", async () => {
      const { respondWith } = await renderPage(operationalStatusDocument);

      respondWith("fails");
      await advance(4 * 60_000);

      expect(screen.getByText(REFRESH_FAILED)).toBeInTheDocument();
      expect(screen.getByText("Status may be out of date")).toBeInTheDocument();
    });

    it("keeps the checks wording for an old document that did load", async () => {
      await renderPage(staleStatusDocument);

      expect(screen.getByText(/Our checks last reported at 11:40 UTC/)).toBeInTheDocument();
      expect(screen.queryByText(/We could not refresh/)).not.toBeInTheDocument();
    });
  });
});
