import { describe, expect, it } from "vitest";

import type { Incident } from "@repo/monitoring/status-document";

import { groupIncidents, isInProgress, maintenanceEndsAt, newestUpdatesFirst } from "./incidents";
import type { IncidentUpdateEntry } from "./incidents";

const NOW = Date.parse("2026-11-03T12:00:00.000Z");
const MINUTE_MS = 60_000;
const DAY_MS = 86_400_000;

function at(offsetMs: number) {
  return new Date(NOW + offsetMs).toISOString();
}

function incident(id: string, overrides: Partial<Incident> = {}): Incident {
  return {
    id,
    kind: "incident",
    title: id,
    impact: "outage",
    components: ["website"],
    startsAt: at(-10 * MINUTE_MS),
    updates: [],
    ...overrides,
  };
}

function maintenance(id: string, overrides: Partial<Incident> = {}): Incident {
  return incident(id, { kind: "maintenance", ...overrides });
}

function ids(incidents: Incident[]) {
  return incidents.map((entry) => entry.id);
}

describe("groupIncidents", () => {
  describe("open incidents", () => {
    it("shows an incident that has not started yet by this clock, since it cannot be in the future", () => {
      const groups = groupIncidents([incident("early", { startsAt: at(MINUTE_MS) })], NOW);

      expect(ids(groups.open)).toEqual(["early"]);
    });

    it("sorts the newest start first", () => {
      const groups = groupIncidents(
        [
          incident("middle", { startsAt: at(-30 * MINUTE_MS) }),
          incident("newest", { startsAt: at(-5 * MINUTE_MS) }),
          incident("oldest", { startsAt: at(-90 * MINUTE_MS) }),
        ],
        NOW,
      );

      expect(ids(groups.open)).toEqual(["newest", "middle", "oldest"]);
    });

    it("keeps an incident open when only a window end is set, which closes planned work alone", () => {
      const groups = groupIncidents([incident("open", { endsAt: at(-MINUTE_MS) })], NOW);

      expect(ids(groups.open)).toEqual(["open"]);
    });

    it("moves an incident to the past once it is resolved", () => {
      const groups = groupIncidents([incident("done", { resolvedAt: at(-MINUTE_MS) })], NOW);

      expect(ids(groups.open)).toEqual([]);
      expect(ids(groups.past)).toEqual(["done"]);
    });

    it("keeps an incident open while its resolution lies ahead of this clock", () => {
      const groups = groupIncidents([incident("later", { resolvedAt: at(MINUTE_MS) })], NOW);

      expect(ids(groups.open)).toEqual(["later"]);
    });
  });

  describe("maintenance windows", () => {
    it("plans a window before and after it starts, soonest first", () => {
      const groups = groupIncidents(
        [
          maintenance("later", { startsAt: at(DAY_MS), endsAt: at(DAY_MS + 60 * MINUTE_MS) }),
          maintenance("running", { startsAt: at(-MINUTE_MS), endsAt: at(60 * MINUTE_MS) }),
        ],
        NOW,
      );

      expect(ids(groups.planned)).toEqual(["running", "later"]);
    });

    it("keeps a window with no end planned", () => {
      const groups = groupIncidents([maintenance("open-ended")], NOW);

      expect(ids(groups.planned)).toEqual(["open-ended"]);
    });

    it("closes a window at its end even when nobody resolved it", () => {
      const groups = groupIncidents(
        [maintenance("over", { startsAt: at(-2 * 60 * MINUTE_MS), endsAt: at(-MINUTE_MS) })],
        NOW,
      );

      expect(ids(groups.planned)).toEqual([]);
      expect(ids(groups.past)).toEqual(["over"]);
    });

    it("moves a window that ends exactly now to the past", () => {
      const groups = groupIncidents(
        [maintenance("ending", { startsAt: at(-60 * MINUTE_MS), endsAt: at(0) })],
        NOW,
      );

      expect(ids(groups.planned)).toEqual([]);
      expect(ids(groups.past)).toEqual(["ending"]);
    });

    it("keeps a window that ends a millisecond from now planned", () => {
      const groups = groupIncidents(
        [maintenance("ending", { startsAt: at(-60 * MINUTE_MS), endsAt: at(1) })],
        NOW,
      );

      expect(ids(groups.planned)).toEqual(["ending"]);
    });

    it("ends at the earlier of its resolution and its window", () => {
      const groups = groupIncidents(
        [
          maintenance("early-finish", {
            startsAt: at(-60 * MINUTE_MS),
            endsAt: at(60 * MINUTE_MS),
            resolvedAt: at(-MINUTE_MS),
          }),
        ],
        NOW,
      );

      expect(ids(groups.past)).toEqual(["early-finish"]);
    });
  });

  describe("past incidents", () => {
    it("keeps one that ended exactly 90 days ago", () => {
      const groups = groupIncidents([incident("edge", { resolvedAt: at(-90 * DAY_MS) })], NOW);

      expect(ids(groups.past)).toEqual(["edge"]);
    });

    it("drops one that ended 90 days and a millisecond ago", () => {
      const groups = groupIncidents(
        [incident("beyond", { resolvedAt: at(-90 * DAY_MS - 1) })],
        NOW,
      );

      expect(ids(groups.past)).toEqual([]);
      expect(ids(groups.open)).toEqual([]);
    });

    it("sorts the most recently ended first", () => {
      const groups = groupIncidents(
        [
          incident("old", { resolvedAt: at(-3 * DAY_MS) }),
          incident("recent", { resolvedAt: at(-DAY_MS) }),
          maintenance("window", { endsAt: at(-2 * DAY_MS) }),
        ],
        NOW,
      );

      expect(ids(groups.past)).toEqual(["recent", "window", "old"]);
    });
  });
});

describe("isInProgress", () => {
  it("is true from the moment the window starts", () => {
    expect(isInProgress(maintenance("m", { startsAt: at(0) }), NOW)).toBe(true);
  });

  it("is false a millisecond before it starts", () => {
    expect(isInProgress(maintenance("m", { startsAt: at(1) }), NOW)).toBe(false);
  });
});

describe("maintenanceEndsAt", () => {
  const soon = maintenance("soon", { components: ["website"], endsAt: at(30 * MINUTE_MS) });
  const later = maintenance("later", { components: ["platform"], endsAt: at(90 * MINUTE_MS) });

  it("gives the latest end of the windows naming the components", () => {
    expect(maintenanceEndsAt([soon, later], ["website", "platform"])).toBe(at(90 * MINUTE_MS));
  });

  it("leaves out windows that name none of the components", () => {
    expect(maintenanceEndsAt([soon, later], ["website"])).toBe(at(30 * MINUTE_MS));
  });

  it("gives no end when a window naming them has none", () => {
    const openEnded = maintenance("open-ended", { components: ["platform"] });

    expect(maintenanceEndsAt([soon, openEnded], ["website", "platform"])).toBeUndefined();
  });

  it("gives no end when no window names them", () => {
    expect(maintenanceEndsAt([soon], ["data-intake"])).toBeUndefined();
  });
});

describe("newestUpdatesFirst", () => {
  it("sorts by when each update was posted, without changing the incident", () => {
    const first: IncidentUpdateEntry = {
      id: "upd-first",
      stage: "investigating",
      postedAt: at(-30 * MINUTE_MS),
      text: "a",
    };
    const second: IncidentUpdateEntry = {
      id: "upd-second",
      stage: "identified",
      postedAt: at(-10 * MINUTE_MS),
      text: "b",
    };
    const original = incident("i", { updates: [first, second] });

    expect(newestUpdatesFirst(original).map((update) => update.text)).toEqual(["b", "a"]);
    expect(original.updates.map((update) => update.text)).toEqual(["a", "b"]);
  });
});
