import { describe, expect, it } from "vitest";

import type { StatusComponent, StatusDocument } from "./status-document.js";
import {
  DAY_MINUTES,
  dayRecordSchema,
  readableStatusDocumentSchema,
  STATUS_DOCUMENT_CACHE_CONTROL,
  statusDocumentSchema,
} from "./status-document.js";

function component(id: StatusComponent["id"]): StatusComponent {
  return {
    id,
    state: "operational",
    uptimePercent: 100,
    degradedMinutes: 0,
    days: [
      {
        date: "2026-11-03",
        state: "operational",
        recordedMinutes: 600,
        downMinutes: 0,
        degradedMinutes: 0,
        maintenanceMinutes: 0,
        unknownMinutes: 0,
      },
    ],
  };
}

const update = {
  id: "upd-1",
  stage: "investigating",
  postedAt: "2026-11-03T09:05:00.000Z",
  text: "We are looking into it.",
};

function incident(components: unknown[], id = "inc-1", updates: unknown[] = [update]): unknown {
  return {
    id,
    kind: "incident",
    title: "Something is wrong",
    impact: "outage",
    components,
    startsAt: "2026-11-03T09:00:00.000Z",
    updates,
  };
}

function statusDocument(components: unknown[], incidents: unknown[] = []): unknown {
  const document: Omit<StatusDocument, "components" | "incidents"> = {
    version: 1,
    generatedAt: "2026-11-03T10:00:00.000Z",
    notices: [],
  };
  return { ...document, components, incidents };
}

describe("statusDocumentSchema", () => {
  it("accepts a well-formed document", () => {
    const document = statusDocument([component("website"), component("platform")]);

    expect(statusDocumentSchema.safeParse(document).success).toBe(true);
  });

  it.each(["2026-13-01", "2026-02-30", "2026-11-3"])("rejects the day %s", (date) => {
    const document = statusDocument([
      { ...component("website"), days: [{ ...component("website").days[0], date }] },
    ]);

    expect(statusDocumentSchema.safeParse(document).success).toBe(false);
  });

  it("rejects a document with no components, which would read as all operational", () => {
    expect(statusDocumentSchema.safeParse(statusDocument([])).success).toBe(false);
  });

  it("accepts an incident with an update that has an id", () => {
    const document = statusDocument([component("website")], [incident(["website"])]);

    expect(statusDocumentSchema.safeParse(document).success).toBe(true);
  });

  it.each([
    ["no id", { stage: update.stage, postedAt: update.postedAt, text: update.text }],
    ["an empty id", { ...update, id: "" }],
  ])("rejects an update with %s", (_name, badUpdate) => {
    const document = statusDocument(
      [component("website")],
      [incident(["website"], "inc-1", [badUpdate])],
    );

    expect(statusDocumentSchema.safeParse(document).success).toBe(false);
  });

  it("rejects a component id it does not know", () => {
    const document = statusDocument([
      component("website"),
      { ...component("website"), id: "mobile-app" },
    ]);

    expect(statusDocumentSchema.safeParse(document).success).toBe(false);
  });
});

describe("readableStatusDocumentSchema", () => {
  it("drops a component added after the page was built and keeps the rest", () => {
    const document = statusDocument([
      component("website"),
      { ...component("website"), id: "mobile-app" },
    ]);

    const parsed = readableStatusDocumentSchema.parse(document);

    expect(parsed.components.map((item) => item.id)).toEqual(["website"]);
  });

  describe("an incident naming a component added after the page was built", () => {
    const known = statusDocument([component("website")]);

    function parsedIncidents(...incidents: unknown[]) {
      const document = statusDocument([component("website")], incidents);
      return readableStatusDocumentSchema.parse(document).incidents;
    }

    it("drops that component and keeps the incident and the others it names", () => {
      const [kept] = parsedIncidents(incident(["website", "mobile-app", "platform"]));

      expect(kept.components).toEqual(["website", "platform"]);
      expect(kept.updates).toHaveLength(1);
    });

    it("drops an incident left naming none, and keeps the rest in order", () => {
      const incidents = parsedIncidents(
        incident(["sign-in"], "first"),
        incident(["mobile-app", "desktop-app"], "newer-only"),
        incident(["mobile-app", "exports"], "second"),
      );

      expect(incidents.map((entry) => entry.id)).toEqual(["first", "second"]);
      expect(incidents.map((entry) => entry.components)).toEqual([["sign-in"], ["exports"]]);
    });

    it("leaves an incident that names only known components as it is", () => {
      const written = incident(["website", "exports"]);

      expect(parsedIncidents(written)).toEqual(
        statusDocumentSchema.parse(statusDocument([component("website")], [written])).incidents,
      );
    });

    it.each([
      ["no components at all", incident([])],
      ["a component that is not a name", incident(["website", 7])],
      ["an update without an id", incident(["website"], "inc-1", [{ ...update, id: "" }])],
      ["no shape of an incident", "oops"],
    ])("still rejects an incident with %s", (_name, bad) => {
      expect(
        readableStatusDocumentSchema.safeParse(statusDocument([component("website")], [bad]))
          .success,
      ).toBe(false);
    });

    it("still reads a document that has none", () => {
      expect(readableStatusDocumentSchema.safeParse(known).success).toBe(true);
    });
  });

  it("still rejects a known component that is malformed", () => {
    const document = statusDocument([{ ...component("website"), uptimePercent: 120 }]);

    expect(readableStatusDocumentSchema.safeParse(document).success).toBe(false);
  });

  it("rejects a document left with no components it knows", () => {
    const document = statusDocument([{ ...component("website"), id: "mobile-app" }]);

    expect(readableStatusDocumentSchema.safeParse(document).success).toBe(false);
  });

  it("rejects a version it cannot read", () => {
    const document = {
      ...statusDocumentSchema.parse(statusDocument([component("website")])),
      version: 2,
    };

    expect(readableStatusDocumentSchema.safeParse(document).success).toBe(false);
  });
});

describe("dayRecordSchema", () => {
  const [day] = component("website").days;

  it("accepts a whole day of recorded minutes", () => {
    expect(dayRecordSchema.safeParse({ ...day, recordedMinutes: DAY_MINUTES }).success).toBe(true);
  });

  it("rejects more minutes than a day holds", () => {
    expect(dayRecordSchema.safeParse({ ...day, recordedMinutes: DAY_MINUTES + 1 }).success).toBe(
      false,
    );
  });
});

describe("STATUS_DOCUMENT_CACHE_CONTROL", () => {
  it("caches the file for no more than 30 seconds, so a change reaches the page within two minutes", () => {
    const maxAge = Number(/max-age=(\d+)/.exec(STATUS_DOCUMENT_CACHE_CONTROL)?.[1]);

    expect(maxAge).toBeGreaterThan(0);
    expect(maxAge).toBeLessThanOrEqual(30);
  });
});
