import { describe, expect, it } from "vitest";

import { toStatusContent } from "./status-content.js";
import type { StatusDocument } from "./status-document.js";
import { statusEvents } from "./status-events.js";
import {
  CONTENT_STALE_MINUTES,
  STATUS_FEED_STATE_VERSION,
  contentFailure,
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
