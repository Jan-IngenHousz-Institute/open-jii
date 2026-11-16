import { describe, expect, it, vi } from "vitest";

import { toStatusContent } from "./status-content.js";
import type { ComponentState, StatusDocument } from "./status-document.js";
import { SNS_BATCH_BYTES, statusEvents } from "./status-events.js";
import type { Announced, StatusEvent } from "./status-events.js";
import {
  CONTENT_READ_MINUTES,
  CONTENT_STALE_MINUTES,
  STATUS_FEED_STATE_VERSION,
  announceEvents,
  contentFailure,
  isContentDue,
  statusFeedStateSchema,
} from "./status-feed.js";
import type { SendBatch, StatusFeedState } from "./status-feed.js";

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
      pending: [],
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
      pending: [],
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

  it("reads when nothing is cached and nothing was tried", () => {
    expect(isContentDue(undefined, undefined, after(0))).toBe(true);
  });

  it.each([
    [0, false],
    [CONTENT_READ_MINUTES - 1, false],
    [CONTENT_READ_MINUTES, true],
    [CONTENT_READ_MINUTES + 3, true],
  ])("after %i minutes reads: %s", (minutes, due) => {
    expect(isContentDue(cached, undefined, after(minutes))).toBe(due);
  });

  it("counts whole minutes, so a run early in its minute is not put off to the next one", () => {
    expect(isContentDue(cached, undefined, new Date("2026-11-03T12:05:01.000Z"))).toBe(true);
  });

  it("waits an interval after a failed read, even with an old cache or none", () => {
    const failedAt = after(20);

    expect(isContentDue(cached, failedAt, after(20 + CONTENT_READ_MINUTES - 1))).toBe(false);
    expect(isContentDue(undefined, failedAt, after(20 + CONTENT_READ_MINUTES - 1))).toBe(false);
    expect(isContentDue(undefined, failedAt, after(20 + CONTENT_READ_MINUTES))).toBe(true);
  });

  it.each([
    ["every read works", true],
    ["every read fails and nothing is cached", false],
  ])("reads 288 times in a day of runs once a minute when %s", (_name, readsWork) => {
    let fetchedAt: string | undefined;
    let lastFailedAt: Date | undefined;
    let reads = 0;

    for (let minute = 0; minute < 1440; minute += 1) {
      const now = new Date(Date.parse("2026-11-03T00:00:24.000Z") + minute * 60_000);
      const cache = fetchedAt === undefined ? undefined : { ...cached, fetchedAt };
      if (isContentDue(cache, lastFailedAt, now)) {
        reads += 1;
        fetchedAt = readsWork ? now.toISOString() : fetchedAt;
        lastFailedAt = readsWork ? undefined : now;
      }
    }

    expect(reads).toBe(288);
  });
});

describe("announceEvents", () => {
  const content = { fetchedAt: NOW, incidents: document.incidents, notices: document.notices };
  const accept: SendBatch = () => Promise.resolve([]);

  function websiteTo(previous: Announced, state: ComponentState, minute: number) {
    const website = { ...document.components[0], state };

    return statusEvents({
      previous,
      document: { ...document, components: [website] },
      environment: "dev",
      pageUrl: "https://status.dev.example.org/",
      now: new Date(Date.parse(NOW) + minute * 60_000),
    });
  }

  function store(failOn?: number) {
    const saved: StatusFeedState[] = [];
    const save = vi.fn((state: StatusFeedState) => {
      if (save.mock.calls.length === failOn) {
        return Promise.reject(new Error("S3 refused the write"));
      }
      saved.push(state);
      return Promise.resolve();
    });

    return { saved, save };
  }

  function lastOf(saved: StatusFeedState[]): StatusFeedState {
    const state = saved.at(-1);
    if (state === undefined) {
      throw new Error("nothing was saved");
    }
    return state;
  }

  const pendingIds = (saved: StatusFeedState[]) =>
    saved.map((state) => state.pending.map((event) => event.id));
  const sentTo = (send: ReturnType<typeof vi.fn<SendBatch>>) =>
    send.mock.calls.flatMap(([batch]) =>
      batch.map(({ event }) => ("to" in event ? event.to : event.type)),
    );

  it("saves the events as pending before sending them, and clears them once SNS takes them", async () => {
    const degraded = websiteTo(announced, "degraded", 1);
    const { saved, save } = store();
    const send = vi.fn(accept);

    const outcome = await announceEvents({ feed: undefined, ...degraded, content, send, save });

    expect(pendingIds(saved)).toEqual([degraded.events.map((event) => event.id), []]);
    expect(sentTo(send)).toEqual(["degraded"]);
    expect(outcome).toEqual({ sent: 1, tooLarge: [], failure: undefined });
  });

  it("still announces the recovery after a send whose save failed", async () => {
    const degraded = websiteTo(announced, "degraded", 1);
    const first = store(2);

    await expect(
      announceEvents({ feed: undefined, ...degraded, content, send: accept, save: first.save }),
    ).rejects.toThrow("S3 refused the write");

    const feed = lastOf(first.saved);
    const recovered = websiteTo(feed.announced, "operational", 2);
    const send = vi.fn(accept);
    await announceEvents({ feed, ...recovered, content, send, save: store().save });

    expect(sentTo(send)).toEqual(["degraded", "operational"]);
  });

  it("keeps an event SNS refused for the next run, which sends it first", async () => {
    const degraded = websiteTo(announced, "degraded", 1);
    const outage = websiteTo(degraded.announced, "outage", 2);
    const { saved, save } = store();
    const refuseFirst = vi.fn<SendBatch>(() =>
      Promise.resolve([{ Id: "0", Code: "Throttled", Message: "slow down" }]),
    );

    const outcome = await announceEvents({
      feed: undefined,
      events: [...degraded.events, ...outage.events],
      announced: outage.announced,
      content,
      send: refuseFirst,
      save,
    });

    expect(outcome.sent).toBe(1);
    expect(outcome.failure).toBe(
      `SNS rejected status events: ${degraded.events[0].id} (Throttled: slow down)`,
    );
    expect(lastOf(saved).pending).toEqual(degraded.events);

    const send = vi.fn(accept);
    await announceEvents({ feed: lastOf(saved), ...outage, events: [], content, send, save });
    expect(sentTo(send)).toEqual(["degraded"]);
  });

  it("keeps every event pending when SNS cannot be reached", async () => {
    const event = websiteTo(announced, "degraded", 1).events[0];
    const events: StatusEvent[] = Array.from({ length: 12 }, (_, index) => ({
      ...event,
      id: `event-${index}`,
    }));
    const { saved, save } = store();
    const send = vi.fn<SendBatch>(() => Promise.reject(new Error("connect ETIMEDOUT")));

    const outcome = await announceEvents({
      feed: undefined,
      events,
      announced,
      content,
      send,
      save,
    });

    expect(send).toHaveBeenCalledOnce();
    expect(outcome).toEqual({
      sent: 0,
      tooLarge: [],
      failure: "SNS could not be reached: connect ETIMEDOUT",
    });
    expect(lastOf(saved).pending).toEqual(events);
  });

  it("leaves out an event too large for SNS, so it cannot block the others", async () => {
    const degraded = websiteTo(announced, "degraded", 1);
    const huge = { ...degraded.events[0], id: "x".repeat(SNS_BATCH_BYTES) };
    const { saved, save } = store();
    const send = vi.fn(accept);

    const outcome = await announceEvents({
      feed: undefined,
      events: [huge, ...degraded.events],
      announced: degraded.announced,
      content,
      send,
      save,
    });

    expect(outcome).toEqual({ sent: 1, tooLarge: [huge], failure: undefined });
    expect(pendingIds(saved)).toEqual([degraded.events.map((event) => event.id), []]);
  });
});
