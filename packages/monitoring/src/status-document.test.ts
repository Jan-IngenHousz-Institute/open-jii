import { describe, expect, it } from "vitest";

import type { StatusComponent, StatusDocument } from "./status-document.js";
import { readableStatusDocumentSchema, statusDocumentSchema } from "./status-document.js";

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
        incidentIds: [],
      },
    ],
  };
}

function statusDocument(components: unknown[]): unknown {
  const document: Omit<StatusDocument, "components"> = {
    version: 1,
    generatedAt: "2026-11-03T10:00:00.000Z",
    incidents: [],
    notices: [],
  };
  return { ...document, components };
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
