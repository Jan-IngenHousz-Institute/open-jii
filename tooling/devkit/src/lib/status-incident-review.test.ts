import { describe, expect, it } from "vitest";

import type { Entry } from "./contentful-management.js";
import { Review } from "./status-incident-review.js";

function entry(id: string, sys: { version: number; publishedVersion?: number }): Entry {
  return { sys: { id, contentType: { sys: { id: "statusUpdate" } }, ...sys }, fields: {} };
}

const incident = entry("inc-1", { version: 3 });
const first = entry("upd-1", { version: 1 });
const second = entry("upd-2", { version: 4 });
const updates = [first, second];

describe("Review", () => {
  it("lists every entry with the version it covers", () => {
    expect(Review.of(incident, updates).covers()).toEqual([
      "incident inc-1, saved version 3",
      "update upd-1, saved version 1",
      "update upd-2, saved version 4",
    ]);
  });

  it("gives a short token that is the same for the same state", () => {
    const token = Review.of(incident, updates).token;

    expect(token).toMatch(/^[0-9a-f]{12}$/);
    expect(Review.of(entry("inc-1", { version: 3 }), updates).token).toBe(token);
    expect(Review.of(incident, updates).summary()).toEqual({
      token,
      covers: Review.of(incident, updates).covers(),
    });
  });

  it("changes when the incident or any update is saved again", () => {
    const token = Review.of(incident, updates).token;

    expect(Review.of(entry("inc-1", { version: 4 }), updates).token).not.toBe(token);
    expect(Review.of(incident, [first, entry("upd-2", { version: 5 })]).token).not.toBe(token);
  });

  it("changes when an update is added, removed or reordered", () => {
    const token = Review.of(incident, updates).token;
    expect(Review.of(incident, [...updates, entry("upd-3", { version: 1 })]).token).not.toBe(token);
    expect(Review.of(incident, updates.slice(0, 1)).token).not.toBe(token);
    expect(Review.of(incident, [second, first]).token).not.toBe(token);
  });

  it("does not change when an entry is published without being edited", () => {
    const before = Review.of(incident, [entry("upd-1", { version: 4 })]);
    const after = Review.of(incident, [entry("upd-1", { version: 5, publishedVersion: 4 })]);

    expect(after.token).toBe(before.token);
  });

  it("changes when a published entry is edited afterwards", () => {
    const published = Review.of(incident, [entry("upd-1", { version: 5, publishedVersion: 4 })]);
    const edited = Review.of(incident, [entry("upd-1", { version: 6, publishedVersion: 4 })]);

    expect(edited.token).not.toBe(published.token);
  });
});
