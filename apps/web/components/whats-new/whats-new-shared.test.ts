import { describe, expect, it } from "vitest";

import type { ComponentReleaseNoteFieldsFragment } from "@repo/cms";

import { countUnread } from "./whats-new-shared";

const makeEntry = (id: string, publishedAt: string | null) =>
  ({
    __typename: "ComponentReleaseNote",
    sys: { id },
    publishedAt,
  }) as unknown as ComponentReleaseNoteFieldsFragment;

describe("countUnread", () => {
  it("treats every entry as unread when the user has never opened the panel", () => {
    const entries = [
      makeEntry("1", "2026-06-01T00:00:00.000Z"),
      makeEntry("2", "2026-06-15T00:00:00.000Z"),
    ];

    expect(countUnread(entries, null)).toBe(2);
  });

  it("treats every entry as unread when the last-seen timestamp is unparseable", () => {
    const entries = [
      makeEntry("1", "2026-06-01T00:00:00.000Z"),
      makeEntry("2", "2026-06-15T00:00:00.000Z"),
    ];

    expect(countUnread(entries, "not-a-date")).toBe(2);
  });

  it("counts only entries published after the last-seen timestamp", () => {
    const entries = [
      makeEntry("older", "2026-06-01T00:00:00.000Z"),
      makeEntry("newer", "2026-06-20T00:00:00.000Z"),
    ];

    expect(countUnread(entries, "2026-06-10T00:00:00.000Z")).toBe(1);
  });

  it("does not count an entry published exactly at the last-seen timestamp", () => {
    const entries = [makeEntry("same", "2026-06-10T00:00:00.000Z")];

    expect(countUnread(entries, "2026-06-10T00:00:00.000Z")).toBe(0);
  });

  it("ignores entries without a publishedAt date", () => {
    const entries = [makeEntry("no-date", null), makeEntry("newer", "2026-06-20T00:00:00.000Z")];

    expect(countUnread(entries, "2026-06-10T00:00:00.000Z")).toBe(1);
  });

  it("ignores entries with an unparseable publishedAt date", () => {
    const entries = [
      makeEntry("bad-date", "not-a-date"),
      makeEntry("newer", "2026-06-20T00:00:00.000Z"),
    ];

    expect(countUnread(entries, "2026-06-10T00:00:00.000Z")).toBe(1);
  });

  it("returns 0 for an empty list", () => {
    expect(countUnread([], null)).toBe(0);
    expect(countUnread([], "2026-06-10T00:00:00.000Z")).toBe(0);
  });
});
