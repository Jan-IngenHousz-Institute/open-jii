import { screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it } from "vitest";
import { componentOf } from "~/test/component-of";
import { renderWithTranslations } from "~/test/render-status";
import { incidentStatusDocument, operationalStatusDocument } from "~/test/status-fixtures";
import { stubViewport } from "~/test/stub-viewport";

import type { DayRecord, StatusComponent, StatusDocument } from "@repo/monitoring/status-document";

import { ComponentRow } from "../component-row";

const TODAY = "2026-11-03";

function renderRow(
  document: StatusDocument,
  id: StatusComponent["id"],
  overrides: Partial<StatusComponent> = {},
) {
  renderWithTranslations(
    <ComponentRow
      component={{ ...componentOf(document, id), ...overrides }}
      incidents={document.incidents}
      today={TODAY}
      isStale={false}
    />,
  );
}

function withoutProblems(day: DayRecord): DayRecord {
  return {
    ...day,
    state: "operational",
    downMinutes: 0,
    degradedMinutes: 0,
    maintenanceMinutes: 0,
    unknownMinutes: 0,
  };
}

function bars() {
  return within(screen.getByRole("group")).getAllByRole("img", { hidden: true });
}

describe("ComponentRow", () => {
  describe("heading and trigger", () => {
    it("names the component alone in its heading, with the chevron as the only icon", () => {
      renderRow(operationalStatusDocument, "website");

      const heading = screen.getByRole("heading", { level: 3 });
      const trigger = within(heading).getByRole("button", { name: "Website" });

      expect(heading.textContent).toBe("Website");
      expect(trigger.querySelectorAll("svg")).toHaveLength(1);
      expect(trigger.querySelector("svg.lucide-chevron-down")).not.toBeNull();
      expect(document.querySelector("svg.lucide-info")).toBeNull();
    });

    it("expands to the details", async () => {
      const user = userEvent.setup();
      renderRow(operationalStatusDocument, "website");
      expect(screen.queryByText(/Every minute we load the openJII home page/)).toBeNull();

      await user.click(screen.getByRole("button", { name: "Website" }));

      expect(screen.getByText(/Every minute we load the openJII home page/)).toBeInTheDocument();
    });
  });

  describe("state for assistive tech", () => {
    it("describes the strip by the state and the uptime line", () => {
      renderRow(operationalStatusDocument, "website");

      const group = screen.getByRole("group");

      expect(group).toHaveAccessibleName("Website, last 90 days");
      expect(group).toHaveAccessibleDescription(
        "Operational 99.97% available in the last 90 days · 27 min degraded",
      );
    });

    it("says an outage with the component", () => {
      renderRow(incidentStatusDocument, "data-intake");

      expect(screen.getByRole("group")).toHaveAccessibleDescription(/^Outage /);
    });
  });

  describe("uptime line", () => {
    it("says the figure covers the last 90 days", () => {
      renderRow(operationalStatusDocument, "website");

      expect(screen.getByText("99.97% available in the last 90 days")).toBeInTheDocument();
      expect(screen.getByText(/· 27 min degraded/)).toBeInTheDocument();
    });

    it("writes every figure with two decimals", () => {
      renderRow(operationalStatusDocument, "website", { uptimePercent: 99.9 });

      expect(screen.getByText("99.90% available in the last 90 days")).toBeInTheDocument();
    });

    it("writes exactly 100 without decimals", () => {
      renderRow(operationalStatusDocument, "website", { uptimePercent: 100 });

      expect(screen.getByText("100% available in the last 90 days")).toBeInTheDocument();
    });

    it("counts days in the degraded total", () => {
      renderRow(operationalStatusDocument, "website", { degradedMinutes: 5490 });

      expect(screen.getByText(/· 3 d 19 h degraded/)).toBeInTheDocument();
    });
  });

  describe("on a wide viewport", () => {
    it("shows 90 days from 90 days ago to today", () => {
      stubViewport(false);
      renderRow(operationalStatusDocument, "website");

      expect(bars()).toHaveLength(90);
      expect(screen.getByText("90 days ago")).toBeInTheDocument();
      expect(screen.getByText("Today")).toBeInTheDocument();
    });
  });

  describe("on a narrow viewport", () => {
    it("shows the last 30 days and says so at the start of the strip", () => {
      stubViewport(true);
      renderRow(operationalStatusDocument, "website");

      expect(bars()).toHaveLength(30);
      expect(screen.getByText("30 days ago")).toBeInTheDocument();
      expect(screen.queryByText("90 days ago")).toBeNull();
      expect(screen.getByRole("group", { name: "Website, last 30 days" })).toBeInTheDocument();
    });

    it("keeps the figure over 90 days, and says so", () => {
      stubViewport(true);
      renderRow(operationalStatusDocument, "website");

      expect(screen.getByText("99.97% available in the last 90 days")).toBeInTheDocument();
    });

    it("grows to 90 days when the viewport widens", () => {
      const viewport = stubViewport(true);
      renderRow(operationalStatusDocument, "website");

      viewport.resizeTo("wide");

      expect(bars()).toHaveLength(90);
      expect(screen.getByText("90 days ago")).toBeInTheDocument();
    });
  });

  describe("delay", () => {
    it("is shown beside the description when the document reports one", () => {
      renderRow(incidentStatusDocument, "data-delivery");

      expect(
        screen.getByText("The slowest recent measurements took about 27 minutes."),
      ).toBeInTheDocument();
    });

    it("stays hidden when the document reports none", () => {
      renderRow(operationalStatusDocument, "data-delivery");

      expect(screen.queryByText(/slowest recent measurements/)).toBeNull();
    });

    it("stays hidden when the delay is undefined on a component that had one", () => {
      renderRow(incidentStatusDocument, "data-delivery", { delayMinutes: undefined });

      expect(screen.queryByText(/slowest recent measurements/)).toBeNull();
    });
  });

  describe("days with problems", () => {
    async function expand() {
      await userEvent.setup().click(screen.getByRole("button"));
    }

    it("lists them under the details, newest first, with what happened", async () => {
      renderRow(operationalStatusDocument, "platform");

      await expand();

      const list = screen.getByRole("list");
      expect(screen.getByText("Days that were not fully operational")).toBeInTheDocument();
      expect(
        within(list)
          .getAllByRole("listitem")
          .map((item) => item.textContent),
      ).toEqual([
        "October 18, 2026: Outage for 12 min, Degraded for 20 min",
        "September 30, 2026: Maintenance for 1 h",
        "September 12, 2026: Degraded for 4 min",
        "August 21, 2026: Degraded for 1 h 35 min",
      ]);
    });

    it("says when checks could not run", async () => {
      renderRow(operationalStatusDocument, "data-intake");

      await expand();

      expect(
        screen.getByText("October 9, 2026: Outage for 25 min, checks could not run for 4 min"),
      ).toBeInTheDocument();
    });

    it("names the incidents a day relates to", async () => {
      renderRow(incidentStatusDocument, "data-intake");

      await expand();

      expect(
        screen.getByText(
          "November 3, 2026: Outage for 38 min, related incidents: Measurements are not reaching the platform",
        ),
      ).toBeInTheDocument();
    });

    it("says so when there were none in the last 90 days", async () => {
      const clean = componentOf(operationalStatusDocument, "website").days.map(withoutProblems);
      renderRow(operationalStatusDocument, "website", { days: clean });

      await expand();

      expect(screen.getByText("No outage or degraded time in the last 90 days.")).toBeVisible();
      expect(screen.queryByRole("list")).toBeNull();
    });

    it("stays folded away until the row is expanded", () => {
      renderRow(operationalStatusDocument, "platform");

      expect(screen.queryByText("Days that were not fully operational")).toBeNull();
    });
  });
});
