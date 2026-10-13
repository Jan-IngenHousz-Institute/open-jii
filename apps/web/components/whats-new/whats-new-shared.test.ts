import { describe, expect, it } from "vitest";

import type { ComponentReleaseNoteFieldsFragment } from "@repo/cms";

import { countUnread, publishedDates } from "./whats-new-shared";

const makeEntry = (id: string, publishedAt: unknown): ComponentReleaseNoteFieldsFragment => ({
  __typename: "ComponentReleaseNote",
  sys: { id },
  publishedAt,
});

describe("publishedDates", () => {
  it("keeps the publication date of every note that has one", () => {
    const entries = [
      makeEntry("1", "2026-06-01T00:00:00.000Z"),
      makeEntry("no-date", null),
      makeEntry("2", "2026-06-15T00:00:00.000Z"),
    ];

    expect(publishedDates(entries)).toEqual([
      "2026-06-01T00:00:00.000Z",
      "2026-06-15T00:00:00.000Z",
    ]);
  });
});

describe("countUnread", () => {
  it("treats every note as unread when the user has never opened the panel", () => {
    const dates = ["2026-06-01T00:00:00.000Z", "2026-06-15T00:00:00.000Z"];

    expect(countUnread(dates, null)).toBe(2);
  });

  it("treats every note as unread when the last-seen timestamp is unparseable", () => {
    const dates = ["2026-06-01T00:00:00.000Z", "2026-06-15T00:00:00.000Z"];

    expect(countUnread(dates, "not-a-date")).toBe(2);
  });

  it("counts only notes published after the last-seen timestamp", () => {
    const dates = ["2026-06-01T00:00:00.000Z", "2026-06-20T00:00:00.000Z"];

    expect(countUnread(dates, "2026-06-10T00:00:00.000Z")).toBe(1);
  });

  it("does not count a note published exactly at the last-seen timestamp", () => {
    expect(countUnread(["2026-06-10T00:00:00.000Z"], "2026-06-10T00:00:00.000Z")).toBe(0);
  });

  it("ignores notes with an unparseable date", () => {
    const dates = ["not-a-date", "2026-06-20T00:00:00.000Z"];

    expect(countUnread(dates, "2026-06-10T00:00:00.000Z")).toBe(1);
  });

  it("returns 0 for an empty list", () => {
    expect(countUnread([], null)).toBe(0);
    expect(countUnread([], "2026-06-10T00:00:00.000Z")).toBe(0);
  });
});
