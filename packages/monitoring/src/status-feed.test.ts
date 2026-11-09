import { describe, expect, it } from "vitest";

import { toStatusContent } from "./status-content.js";
import type { StatusDocument } from "./status-document.js";
import { statusEvents } from "./status-events.js";
import {
  CONTENT_READ_MINUTES,
  CONTENT_STALE_MINUTES,
  STATUS_FEED_STATE_VERSION,
  contentFailure,
  isContentDue,
  statusFeedStateSchema,
} from "./status-feed.js";

const NOW = "2026-11-03T12:00:00.000Z";

const document: StatusDocument = {
  version: 1,
  generatedAt: NOW,
  components: [
    { id: "website", state: "operational", uptimePercent: 100, degradedMinutes: 0, days: [] },
  ],
  incidents: [
    {
      id: "inc-1",
      kind: "incident",
      title: "Sign-in is slow",
      impact: "degraded",
      components: ["sign-in"],
      startsAt: "2026-11-03T11:00:00.000Z",
      updates: [],
    },
  ],
  notices: [{ id: "notice-1", title: "Heads up", body: "", severity: "info" }],
};

const { announced } = statusEvents({
  previous: undefined,
  document,
  environment: "dev",
  pageUrl: "https://status.dev.example.org/",
  now: new Date(NOW),
});

describe("statusFeedStateSchema", () => {
  it("refuses a snapshot without the content it was sent beside", () => {
    const state = { version: STATUS_FEED_STATE_VERSION, announced };

    expect(statusFeedStateSchema.safeParse(state).success).toBe(false);
  });

  it("carries the last good read of Contentful beside it", () => {
    const state = {
      version: STATUS_FEED_STATE_VERSION,
      announced,
      content: { fetchedAt: NOW, incidents: document.incidents, notices: document.notices },
    };

    expect(statusFeedStateSchema.parse(JSON.parse(JSON.stringify(state)))).toEqual(state);
  });

  it("accepts the content the mapping produces", () => {
    const content = toStatusContent({
      open: { items: [] },
      recent: { items: [] },
      upcoming: { items: [] },
      notices: { items: [] },
    });

    const state = {
      version: STATUS_FEED_STATE_VERSION,
      announced,
      content: { fetchedAt: NOW, ...content },
    };

    expect(statusFeedStateSchema.safeParse(state).success).toBe(true);
  });

  it.each([
    ["another version", { version: 2, announced }],
    ["no snapshot", { version: STATUS_FEED_STATE_VERSION }],
    ["a snapshot that is not one", { version: STATUS_FEED_STATE_VERSION, announced: {} }],
    [
      "a component kept as a bare state",
      {
        version: STATUS_FEED_STATE_VERSION,
        announced: { ...announced, components: { website: "operational" } },
      },
    ],
    [
      "cached content with a bad entry",
      {
        version: STATUS_FEED_STATE_VERSION,
        announced,
        content: { fetchedAt: NOW, incidents: [{ id: "x" }], notices: [] },
      },
    ],
  ])("rejects %s", (_name, state) => {
    expect(statusFeedStateSchema.safeParse(state).success).toBe(false);
  });
});

describe("contentFailure", () => {
  const cached = { fetchedAt: "2026-11-03T12:00:00.000Z", incidents: [], notices: [] };
  const after = (minutes: number, seconds = 0) =>
    new Date(Date.parse(cached.fetchedAt) + (minutes * 60 + seconds) * 1000);

  it("owes nothing for a read that worked", () => {
    expect(contentFailure(undefined, cached, after(60))).toBeUndefined();
  });

  it("covers a failed read with the cache up to the limit", () => {
    expect(contentFailure("timed out", cached, after(CONTENT_STALE_MINUTES))).toBeUndefined();
  });

  it("names how long and since when once the cache is past the limit", () => {
    expect(contentFailure("timed out", cached, after(CONTENT_STALE_MINUTES, 1))).toBe(
      `Contentful has been unreadable for 15 minutes, since ${cached.fetchedAt}: timed out`,
    );
    expect(contentFailure("timed out", cached, after(16))).toContain("for 16 minutes");
  });

  it("fails the first read with nothing to fall back on", () => {
    expect(contentFailure("timed out", undefined, after(0))).toBe(
      "Contentful is unreadable and no earlier read is kept: timed out",
    );
  });
});

describe("isContentDue", () => {
  const cached = { fetchedAt: "2026-11-03T12:00:24.000Z", incidents: [], notices: [] };
  const after = (minutes: number, seconds = 0) =>
    new Date(Date.parse(cached.fetchedAt) + (minutes * 60 + seconds) * 1000);

  it("reads when nothing is cached", () => {
    expect(isContentDue(undefined, after(0))).toBe(true);
  });

  it.each([
    [0, false],
    [CONTENT_READ_MINUTES - 1, false],
    [CONTENT_READ_MINUTES, true],
    [CONTENT_READ_MINUTES + 3, true],
  ])("after %i minutes reads: %s", (minutes, due) => {
    expect(isContentDue(cached, after(minutes))).toBe(due);
  });

  it("counts whole minutes, so a run early in its minute is not put off to the next one", () => {
    expect(isContentDue(cached, new Date("2026-11-03T12:05:01.000Z"))).toBe(true);
  });

  it("reads 288 times in a day of runs once a minute while every read works", () => {
    let fetchedAt: string | undefined;
    let reads = 0;

    for (let minute = 0; minute < 1440; minute += 1) {
      const now = new Date(Date.parse("2026-11-03T00:00:24.000Z") + minute * 60_000);
      const cache = fetchedAt === undefined ? undefined : { ...cached, fetchedAt };
      if (isContentDue(cache, now)) {
        reads += 1;
        fetchedAt = now.toISOString();
      }
    }

    expect(reads).toBe(288);
  });
});
