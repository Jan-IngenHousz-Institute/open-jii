import { describe, expect, it } from "vitest";

import { statusDocumentSchema } from "@repo/monitoring/status-document";
import type { StatusComponent, StatusDocument } from "@repo/monitoring/status-document";
import {
  DAY_DEGRADED_MINUTES,
  dayState,
  totalDegradedMinutes,
  uptimePercent,
} from "@repo/monitoring/status-history";

import {
  incidentStatusDocument,
  maintenanceStatusDocument,
  operationalStatusDocument,
  plannedStatusDocument,
  staleStatusDocument,
} from "./status-fixtures";

const fixtures: [string, StatusDocument][] = [
  ["operational", operationalStatusDocument],
  ["incident", incidentStatusDocument],
  ["stale", staleStatusDocument],
  ["planned", plannedStatusDocument],
  ["maintenance", maintenanceStatusDocument],
];

function componentOf(document: StatusDocument, id: string): StatusComponent {
  const found = document.components.find((component) => component.id === id);
  if (found === undefined) {
    throw new Error(`no ${id} component in the fixture`);
  }
  return found;
}

describe.each(fixtures)("the %s fixture", (_name, document) => {
  it("passes the contract's schema unchanged", () => {
    expect(statusDocumentSchema.parse(document)).toEqual(document);
  });

  it("holds the five live components", () => {
    expect(document.components.map((component) => component.id)).toEqual([
      "website",
      "platform",
      "data-intake",
      "data-delivery",
      "macro-processing",
    ]);
  });

  it("holds consecutive days from the first record to the day it was generated", () => {
    for (const component of document.components) {
      const dates = component.days.map((day) => day.date);
      const firstIndex = 90 - dates.length;
      const expected = Array.from({ length: dates.length }, (_, index) =>
        new Date(Date.UTC(2026, 7, 6 + firstIndex + index)).toISOString().slice(0, 10),
      );

      expect(dates).toEqual(expected);
      expect(dates.at(-1)).toBe(document.generatedAt.slice(0, 10));
    }
  });

  it("starts the shorter history at a component's first record, with no padding", () => {
    const macro = componentOf(document, "macro-processing");

    expect(macro.days).toHaveLength(84);
    expect(macro.days[0]?.recordedMinutes).toBeGreaterThan(0);
  });

  it("states each day, uptime and degraded total as the judge would", () => {
    for (const component of document.components) {
      for (const day of component.days) {
        expect(day.state).toBe(
          dayState({
            recordedMinutes: day.recordedMinutes,
            downMinutes: day.downMinutes,
            degradedMinutes: day.degradedMinutes,
            maintenanceMinutes: day.maintenanceMinutes,
            unknownMinutes: day.unknownMinutes,
          }),
        );
      }
      expect(component.uptimePercent).toBe(uptimePercent(component.days));
      expect(component.degradedMinutes).toBe(totalDegradedMinutes(component.days));
    }
  });

  it("holds a day of short blips that does not colour its bar", () => {
    const blips = componentOf(document, "platform").days.filter(
      (day) => day.degradedMinutes > 0 && day.degradedMinutes < DAY_DEGRADED_MINUTES,
    );

    expect(blips.map((day) => [day.date, day.degradedMinutes, day.state])).toEqual([
      ["2026-09-12", DAY_DEGRADED_MINUTES - 1, "operational"],
    ]);
  });

  it("gives the bars variety", () => {
    const states = new Set(
      document.components.flatMap((component) => component.days.map((day) => day.state)),
    );

    expect([...states].sort()).toEqual(["degraded", "maintenance", "operational", "outage"]);
  });
});

describe("the operational fixture", () => {
  it("has every component operational and no incidents", () => {
    expect(
      operationalStatusDocument.components.every((component) => component.state === "operational"),
    ).toBe(true);
    expect(operationalStatusDocument.incidents).toEqual([]);
    expect(
      operationalStatusDocument.components.some((component) => "delayMinutes" in component),
    ).toBe(false);
  });
});

describe("the incident fixture", () => {
  it("has data intake down and data delivery degraded with a delay", () => {
    expect(componentOf(incidentStatusDocument, "data-intake").state).toBe("outage");
    expect(componentOf(incidentStatusDocument, "data-delivery")).toMatchObject({
      state: "degraded",
      delayMinutes: 27,
    });
  });

  it("holds one incident with two updates, naming the two components", () => {
    const { incidents } = incidentStatusDocument;

    expect(incidents).toHaveLength(1);
    expect(incidents[0]?.components).toEqual(["data-intake", "data-delivery"]);
    expect(incidents[0]?.updates).toHaveLength(2);
  });

  it("ties today's minutes on those components to the incident", () => {
    const incidentId = incidentStatusDocument.incidents[0]?.id;

    for (const id of ["data-intake", "data-delivery"]) {
      expect(componentOf(incidentStatusDocument, id).days[89]?.incidentIds).toEqual([incidentId]);
    }
  });
});

describe("the planned fixture", () => {
  it("is operational, with the upcoming window, a resolved incident and a completed window", () => {
    expect(
      plannedStatusDocument.components.every((component) => component.state === "operational"),
    ).toBe(true);
    expect(plannedStatusDocument.incidents.map((incident) => incident.id)).toEqual([
      "2026-11-07-maintenance",
      "2026-10-28-delivery-delay",
      "2026-10-03-maintenance",
    ]);
    expect(plannedStatusDocument.notices).toHaveLength(1);
  });
});

describe("the maintenance fixture", () => {
  it("has the two components named by the open window in maintenance and the rest operational", () => {
    const [maintenance] = maintenanceStatusDocument.incidents;

    expect(maintenance.kind).toBe("maintenance");
    expect(maintenance.endsAt).toBeDefined();
    expect(
      maintenanceStatusDocument.components.map((component) => [component.id, component.state]),
    ).toEqual([
      ["website", "maintenance"],
      ["platform", "maintenance"],
      ["data-intake", "operational"],
      ["data-delivery", "operational"],
      ["macro-processing", "operational"],
    ]);
  });
});

describe("the stale fixture", () => {
  it("was generated twenty minutes before the operational one", () => {
    const gap =
      Date.parse(operationalStatusDocument.generatedAt) -
      Date.parse(staleStatusDocument.generatedAt);

    expect(gap).toBe(20 * 60_000);
  });
});
