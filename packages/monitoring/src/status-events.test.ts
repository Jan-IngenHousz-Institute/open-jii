import { describe, expect, it } from "vitest";

import type {
  ComponentState,
  Incident,
  IncidentUpdate,
  Notice,
  StatusComponent,
  StatusComponentId,
  StatusDocument,
} from "./status-document.js";
import {
  SNS_BATCH_BYTES,
  SNS_BATCH_SIZE,
  STATUS_EVENTS_VERSION,
  announcedSchema,
  batchEvents,
  failedEntriesText,
  statusEventSchema,
  statusEvents,
} from "./status-events.js";
import type { Announced, StatusEvent } from "./status-events.js";

const ENVIRONMENT = "dev";
const PAGE_URL = "https://status.dev.example.org/";

const BASE = "2026-11-03T12:00:00.000Z";
const LATER = "2026-11-03T12:01:00.000Z";

function component(id: StatusComponentId, state: ComponentState = "operational"): StatusComponent {
  return { id, state, uptimePercent: 100, degradedMinutes: 0, days: [] };
}

function update(change: Partial<IncidentUpdate> = {}): IncidentUpdate {
  const filled: IncidentUpdate = {
    id: "",
    stage: "investigating",
    postedAt: "2026-11-03T11:05:00.000Z",
    text: "We are looking into it.",
    ...change,
  };

  return { ...filled, id: change.id ?? `${filled.stage}-${filled.postedAt}` };
}

function incident(change: Partial<Incident> = {}): Incident {
  return {
    id: "inc-1",
    kind: "incident",
    title: "Sign-in is slow",
    impact: "degraded",
    components: ["sign-in"],
    startsAt: "2026-11-03T11:00:00.000Z",
    updates: [],
    ...change,
  };
}

function maintenance(change: Partial<Incident> = {}): Incident {
  return incident({
    id: "maint-1",
    kind: "maintenance",
    title: "Database upgrade",
    components: ["platform"],
    startsAt: "2026-11-03T12:30:00.000Z",
    endsAt: "2026-11-03T13:30:00.000Z",
    ...change,
  });
}

function notice(change: Partial<Notice> = {}): Notice {
  return { id: "notice-1", title: "Heads up", body: "", severity: "info", ...change };
}

interface DocumentChange {
  components?: StatusComponent[];
  incidents?: Incident[];
  notices?: Notice[];
}

function statusDocument(change: DocumentChange = {}): StatusDocument {
  return {
    version: 1,
    generatedAt: BASE,
    components: change.components ?? [component("website"), component("platform")],
    incidents: change.incidents ?? [],
    notices: change.notices ?? [],
  };
}

function run(previous: Announced | undefined, document: StatusDocument, now: string = BASE) {
  return statusEvents({
    previous,
    document,
    environment: ENVIRONMENT,
    pageUrl: PAGE_URL,
    now: new Date(now),
  });
}

function baselineOf(document: StatusDocument, now: string = BASE): Announced {
  return run(undefined, document, now).announced;
}

function typesOf(events: StatusEvent[]): string[] {
  return events.map((event) => event.type);
}

describe("the first run", () => {
  const document = statusDocument({
    components: [component("website"), component("platform", "outage")],
    incidents: [
      incident({ updates: [update({ id: "upd-1" })] }),
      incident({ id: "inc-2", resolvedAt: "2026-11-03T11:30:00.000Z" }),
      maintenance(),
      maintenance({ id: "maint-2", startsAt: "2026-11-03T11:00:00.000Z" }),
    ],
    notices: [notice()],
  });
  const result = run(undefined, document);

  it("announces nothing, so a channel is not flooded with what is already open", () => {
    expect(result.events).toEqual([]);
  });

  it("records everything it saw as the baseline", () => {
    expect(result.announced).toEqual({
      at: BASE,
      incidents: [
        {
          id: "inc-1",
          kind: "incident",
          phase: "open",
          updates: ["upd-1"],
        },
        { id: "inc-2", kind: "incident", phase: "resolved", updates: [] },
        { id: "maint-1", kind: "maintenance", phase: "scheduled", updates: [] },
        { id: "maint-2", kind: "maintenance", phase: "in-progress", updates: [] },
      ],
      components: {
        website: { state: "operational", since: BASE },
        platform: { state: "outage", since: BASE },
      },
      notices: [{ id: "notice-1", title: "Heads up" }],
    });
  });

  it("produces a snapshot its schema accepts", () => {
    expect(announcedSchema.parse(result.announced)).toEqual(result.announced);
  });

  it("makes the next run on the same document silent", () => {
    expect(run(result.announced, document, LATER).events).toEqual([]);
  });
});

describe("incidents", () => {
  const open = incident();

  it("announces an incident seen for the first time while open, with its latest update", () => {
    const early = update({ stage: "investigating", postedAt: "2026-11-03T11:05:00.000Z" });
    const late = update({
      stage: "identified",
      postedAt: "2026-11-03T11:20:00.000Z",
      text: "Found it.",
    });
    const document = statusDocument({ incidents: [{ ...open, updates: [late, early] }] });

    const { events } = run(baselineOf(statusDocument()), document);

    expect(events).toMatchObject([
      { type: "incident.opened", id: `incident.opened:inc-1:${BASE}`, update: late },
    ]);
  });

  it("announces an opened incident that has no update yet", () => {
    const { events } = run(baselineOf(statusDocument()), statusDocument({ incidents: [open] }));

    expect(events).toHaveLength(1);
    expect(events[0]).toMatchObject({ type: "incident.opened" });
    expect(JSON.parse(JSON.stringify(events[0]))).not.toHaveProperty("update");
  });

  it("leaves the updates out of the incident it carries", () => {
    const document = statusDocument({ incidents: [{ ...open, updates: [update()] }] });

    const { events } = run(baselineOf(statusDocument()), document);

    expect(events[0]).toMatchObject({ incident: { id: "inc-1", title: "Sign-in is slow" } });
    expect(events[0]).not.toHaveProperty("incident.updates");
  });

  it("announces an incident first seen already resolved exactly once, as resolved", () => {
    const resolvedAt = "2026-11-03T11:45:00.000Z";
    const closing = update({ stage: "resolved", postedAt: resolvedAt, text: "Fixed." });
    const document = statusDocument({
      incidents: [{ ...open, resolvedAt, updates: [closing, update()] }],
    });

    const { events } = run(baselineOf(statusDocument()), document);

    expect(events).toMatchObject([
      {
        type: "incident.resolved",
        id: "incident.resolved:inc-1:2026-11-03T11:45:00.000Z",
        update: closing,
      },
    ]);
  });

  it("announces a new update on an incident that is already told", () => {
    const first = update();
    const next = update({
      id: "upd-2",
      stage: "identified",
      postedAt: "2026-11-03T11:20:00.000Z",
    });
    const previous = baselineOf(statusDocument({ incidents: [{ ...open, updates: [first] }] }));

    const { events } = run(
      previous,
      statusDocument({ incidents: [{ ...open, updates: [next, first] }] }),
      LATER,
    );

    expect(events).toMatchObject([
      {
        type: "incident.updated",
        id: "incident.updated:inc-1:upd-2",
        update: next,
      },
    ]);
  });

  it("announces several updates added in one run, oldest first, whatever order they come in", () => {
    const first = update({ stage: "investigating", postedAt: "2026-11-03T11:05:00.000Z" });
    const second = update({ stage: "identified", postedAt: "2026-11-03T11:20:00.000Z" });
    const third = update({ stage: "monitoring", postedAt: "2026-11-03T11:40:00.000Z" });
    const previous = baselineOf(statusDocument({ incidents: [{ ...open, updates: [first] }] }));

    const { events } = run(
      previous,
      statusDocument({ incidents: [{ ...open, updates: [third, second, first] }] }),
      LATER,
    );

    expect(events.map((event) => ("update" in event ? event.update?.stage : undefined))).toEqual([
      "identified",
      "monitoring",
    ]);
    expect(typesOf(events)).toEqual(["incident.updated", "incident.updated"]);
  });

  it.each([
    ["a time and a stage", { stage: "identified", postedAt: "2026-11-03T11:20:00.000Z" }],
    ["a time only", { stage: "monitoring", postedAt: "2026-11-03T11:20:00.000Z" }],
  ] satisfies [string, Partial<IncidentUpdate>][])(
    "announces two updates that share %s, by their ids",
    (_name, second) => {
      const first = update({
        id: "upd-1",
        stage: "identified",
        postedAt: "2026-11-03T11:20:00.000Z",
      });
      const previous = baselineOf(statusDocument({ incidents: [open] }));

      const { events } = run(
        previous,
        statusDocument({
          incidents: [{ ...open, updates: [first, update({ id: "upd-2", ...second })] }],
        }),
        LATER,
      );

      expect(events.map((event) => event.id)).toEqual([
        "incident.updated:inc-1:upd-1",
        "incident.updated:inc-1:upd-2",
      ]);
    },
  );

  it("announces a second update posted in the same minute with the same stage later on", () => {
    const first = update({ id: "upd-1", stage: "monitoring" });
    const second = update({ id: "upd-2", stage: "monitoring" });
    const previous = baselineOf(statusDocument({ incidents: [{ ...open, updates: [first] }] }));

    const { events } = run(
      previous,
      statusDocument({ incidents: [{ ...open, updates: [first, second] }] }),
      LATER,
    );

    expect(events.map((event) => event.id)).toEqual(["incident.updated:inc-1:upd-2"]);
  });

  it.each([
    ["when it was posted", { postedAt: "2026-11-03T11:03:00.000Z" }],
    ["its stage", { stage: "identified" }],
    ["its text", { text: "Reworded." }],
  ] satisfies [string, Partial<IncidentUpdate>][])(
    "does not announce an update again when %s is edited",
    (_name, edit) => {
      const told = update({ id: "upd-1" });
      const previous = baselineOf(statusDocument({ incidents: [{ ...open, updates: [told] }] }));

      const { events, announced } = run(
        previous,
        statusDocument({ incidents: [{ ...open, updates: [{ ...told, ...edit }] }] }),
        LATER,
      );

      expect(events).toEqual([]);
      expect(announced.incidents).toMatchObject([{ updates: ["upd-1"] }]);
    },
  );

  it("announces setting resolvedAt as resolved, without repeating an update it already told", () => {
    const told = update({ stage: "monitoring" });
    const previous = baselineOf(statusDocument({ incidents: [{ ...open, updates: [told] }] }));

    const { events } = run(
      previous,
      statusDocument({
        incidents: [{ ...open, updates: [told], resolvedAt: "2026-11-03T11:45:00.000Z" }],
      }),
      LATER,
    );

    expect(typesOf(events)).toEqual(["incident.resolved"]);
    expect(events[0]).not.toHaveProperty("update.stage");
  });

  it("folds the closing update into the resolved event and still announces the earlier ones", () => {
    const told = update({ stage: "investigating", postedAt: "2026-11-03T11:05:00.000Z" });
    const identified = update({ stage: "identified", postedAt: "2026-11-03T11:20:00.000Z" });
    const closing = update({ stage: "resolved", postedAt: "2026-11-03T11:45:00.000Z" });
    const previous = baselineOf(statusDocument({ incidents: [{ ...open, updates: [told] }] }));

    const { events } = run(
      previous,
      statusDocument({
        incidents: [
          {
            ...open,
            resolvedAt: "2026-11-03T11:45:00.000Z",
            updates: [closing, identified, told],
          },
        ],
      }),
      LATER,
    );

    expect(typesOf(events)).toEqual(["incident.updated", "incident.resolved"]);
    expect(events[0]).toMatchObject({ update: identified });
    expect(events[1]).toMatchObject({ update: closing });
  });

  it("announces a write-up added to a resolved incident as an update", () => {
    const resolved = { ...open, resolvedAt: "2026-11-03T11:45:00.000Z" };
    const previous = baselineOf(statusDocument({ incidents: [resolved] }));
    const writeUp = update({ stage: "resolved", postedAt: "2026-11-03T13:00:00.000Z" });

    const { events } = run(
      previous,
      statusDocument({ incidents: [{ ...resolved, updates: [writeUp] }] }),
      LATER,
    );

    expect(typesOf(events)).toEqual(["incident.updated"]);
  });

  it("announces no second opening when a resolved incident is reopened", () => {
    const previous = baselineOf(
      statusDocument({ incidents: [{ ...open, resolvedAt: "2026-11-03T11:45:00.000Z" }] }),
    );

    const { events, announced } = run(previous, statusDocument({ incidents: [open] }), LATER);

    expect(events).toEqual([]);
    expect(announced.incidents).toMatchObject([{ id: "inc-1", phase: "open" }]);
  });

  it("tells each resolution apart when an incident is reopened and resolved again", () => {
    const firstEnd = "2026-11-03T11:45:00.000Z";
    const secondEnd = "2026-11-03T12:30:00.000Z";
    const resolvedOnce = baselineOf(statusDocument({ incidents: [open] }));

    const first = run(
      resolvedOnce,
      statusDocument({ incidents: [{ ...open, resolvedAt: firstEnd }] }),
    );
    const reopened = run(first.announced, statusDocument({ incidents: [open] }), LATER);
    const second = run(
      reopened.announced,
      statusDocument({ incidents: [{ ...open, resolvedAt: secondEnd }] }),
      "2026-11-03T12:31:00.000Z",
    );

    expect(first.events.map((event) => event.id)).toEqual([`incident.resolved:inc-1:${firstEnd}`]);
    expect(second.events.map((event) => event.id)).toEqual([
      `incident.resolved:inc-1:${secondEnd}`,
    ]);
  });

  describe("resolved at a time that has not come", () => {
    const resolvedAt = "2026-11-03T13:00:00.000Z";
    const planned = { ...open, resolvedAt };
    const AFTER = "2026-11-03T13:01:00.000Z";

    it("announces an incident first seen that way as opened", () => {
      const { events } = run(
        baselineOf(statusDocument()),
        statusDocument({ incidents: [planned] }),
      );

      expect(typesOf(events)).toEqual(["incident.opened"]);
    });

    it("says nothing when resolvedAt is set ahead of time, and keeps the incident open", () => {
      const previous = baselineOf(statusDocument({ incidents: [open] }));

      const { events, announced } = run(previous, statusDocument({ incidents: [planned] }), LATER);

      expect(events).toEqual([]);
      expect(announced.incidents).toMatchObject([{ id: "inc-1", phase: "open" }]);
    });

    it("announces it as resolved in the run the time passes, and only then", () => {
      const previous = baselineOf(statusDocument({ incidents: [open] }));
      const waiting = run(previous, statusDocument({ incidents: [planned] }), LATER);

      const passed = run(waiting.announced, statusDocument({ incidents: [planned] }), AFTER);

      expect(passed.events.map((event) => event.id)).toEqual([
        `incident.resolved:inc-1:${resolvedAt}`,
      ]);
      expect(run(passed.announced, statusDocument({ incidents: [planned] }), AFTER).events).toEqual(
        [],
      );
    });
  });

  it("announces nothing for an incident that has not changed", () => {
    const document = statusDocument({ incidents: [{ ...open, updates: [update()] }] });

    expect(run(baselineOf(document), document, LATER).events).toEqual([]);
  });

  it("lets an incident that ages out of the document leave the snapshot silently", () => {
    const previous = baselineOf(statusDocument({ incidents: [open] }));

    const { events, announced } = run(previous, statusDocument(), LATER);

    expect(events).toEqual([]);
    expect(announced.incidents).toEqual([]);
  });

  it("announces each incident once, in document order", () => {
    const { events } = run(
      baselineOf(statusDocument()),
      statusDocument({
        incidents: [open, incident({ id: "inc-2", startsAt: "2026-11-03T11:10:00.000Z" })],
      }),
    );

    expect(events.map((event) => event.id)).toEqual([
      `incident.opened:inc-1:${BASE}`,
      `incident.opened:inc-2:${BASE}`,
    ]);
  });
});

describe("maintenance", () => {
  const FUTURE = "2026-11-03T11:00:00.000Z";
  const DURING = "2026-11-03T13:00:00.000Z";
  const AFTER = "2026-11-03T14:00:00.000Z";

  interface Case {
    name: string;
    /** When and how the window was last told, absent when it is new. */
    seen?: { at: string; window: Incident };
    now: string;
    window: Incident;
    expected: string[];
  }

  const cases: Case[] = [
    {
      name: "a future window",
      now: FUTURE,
      window: maintenance(),
      expected: ["maintenance.scheduled"],
    },
    {
      name: "a window in progress, skipping scheduled",
      now: DURING,
      window: maintenance(),
      expected: ["maintenance.started"],
    },
    {
      name: "a window with no end, in progress",
      now: AFTER,
      window: maintenance({ endsAt: undefined }),
      expected: ["maintenance.started"],
    },
    {
      name: "a window already over, once",
      now: AFTER,
      window: maintenance(),
      expected: ["maintenance.completed"],
    },
    {
      name: "a window already resolved, once",
      now: DURING,
      window: maintenance({ resolvedAt: "2026-11-03T12:45:00.000Z" }),
      expected: ["maintenance.completed"],
    },
    {
      name: "a future window to be resolved later",
      now: FUTURE,
      window: maintenance({ resolvedAt: "2026-11-03T12:00:00.000Z" }),
      expected: ["maintenance.scheduled"],
    },
    {
      name: "a window cancelled before it began",
      now: FUTURE,
      window: maintenance({ resolvedAt: "2026-11-03T10:55:00.000Z" }),
      expected: ["maintenance.completed"],
    },
    {
      name: "a scheduled window that begins",
      seen: { at: FUTURE, window: maintenance() },
      now: DURING,
      window: maintenance(),
      expected: ["maintenance.started"],
    },
    {
      name: "an open window that ends",
      seen: { at: DURING, window: maintenance() },
      now: AFTER,
      window: maintenance(),
      expected: ["maintenance.completed"],
    },
    {
      name: "an open window resolved early",
      seen: { at: DURING, window: maintenance() },
      now: DURING,
      window: maintenance({ resolvedAt: "2026-11-03T12:50:00.000Z" }),
      expected: ["maintenance.completed"],
    },
    {
      name: "a scheduled window found over, skipping started",
      seen: { at: FUTURE, window: maintenance() },
      now: AFTER,
      window: maintenance(),
      expected: ["maintenance.completed"],
    },
    {
      name: "a window still scheduled",
      seen: { at: FUTURE, window: maintenance() },
      now: FUTURE,
      window: maintenance(),
      expected: [],
    },
    {
      name: "a window still in progress",
      seen: { at: DURING, window: maintenance() },
      now: DURING,
      window: maintenance(),
      expected: [],
    },
    {
      name: "a window still completed",
      seen: { at: AFTER, window: maintenance() },
      now: AFTER,
      window: maintenance(),
      expected: [],
    },
    {
      name: "a window in progress moved to a later day",
      seen: { at: DURING, window: maintenance() },
      now: DURING,
      window: maintenance({
        startsAt: "2026-11-04T12:30:00.000Z",
        endsAt: "2026-11-04T13:30:00.000Z",
      }),
      expected: [],
    },
  ];

  it.each(cases)("announces $expected for $name", ({ seen, now, window, expected }) => {
    const previous =
      seen === undefined
        ? baselineOf(statusDocument())
        : baselineOf(statusDocument({ incidents: [seen.window] }), seen.at);

    const { events } = run(previous, statusDocument({ incidents: [window] }), now);

    expect(typesOf(events)).toEqual(expected);
  });

  it("carries the window without its updates, and an id per phase", () => {
    const window = maintenance({ updates: [update({ stage: "scheduled" })] });
    const baseline = baselineOf(statusDocument());

    const scheduled = run(baseline, statusDocument({ incidents: [window] }), FUTURE);
    const started = run(scheduled.announced, statusDocument({ incidents: [window] }), DURING);
    const completed = run(started.announced, statusDocument({ incidents: [window] }), AFTER);

    expect(scheduled.events[0]).toMatchObject({
      id: "maintenance.scheduled:maint-1:2026-11-03T12:30:00.000Z",
      maintenance: { id: "maint-1", kind: "maintenance", title: "Database upgrade" },
    });
    expect(scheduled.events[0]).not.toHaveProperty("maintenance.updates");
    expect(started.events[0]).toMatchObject({
      id: "maintenance.started:maint-1:2026-11-03T12:30:00.000Z",
    });
    expect(completed.events[0]).toMatchObject({
      id: "maintenance.completed:maint-1:2026-11-03T13:30:00.000Z",
    });
  });

  it.each([
    {
      name: "the planned end when nobody resolved it",
      change: {},
      endedAt: "2026-11-03T13:30:00.000Z",
    },
    {
      name: "the resolution when it came before the planned end",
      change: { resolvedAt: "2026-11-03T12:50:00.000Z" },
      endedAt: "2026-11-03T12:50:00.000Z",
    },
    {
      name: "the planned end when the resolution came after it",
      change: { resolvedAt: "2026-11-03T13:45:00.000Z" },
      endedAt: "2026-11-03T13:30:00.000Z",
    },
  ] satisfies { name: string; change: Partial<Incident>; endedAt: string }[])(
    "ends a completed window at $name",
    ({ change, endedAt }) => {
      const { events } = run(
        baselineOf(statusDocument()),
        statusDocument({ incidents: [maintenance(change)] }),
        AFTER,
      );

      expect(events.map((event) => event.id)).toEqual([`maintenance.completed:maint-1:${endedAt}`]);
    },
  );

  it("tells each occurrence of a window apart when it is postponed and then starts", () => {
    const postponed = maintenance({
      startsAt: "2026-11-03T14:30:00.000Z",
      endsAt: "2026-11-03T15:30:00.000Z",
    });
    const first = run(
      baselineOf(statusDocument()),
      statusDocument({ incidents: [maintenance()] }),
      DURING,
    );
    const moved = run(first.announced, statusDocument({ incidents: [postponed] }), DURING);
    const second = run(
      moved.announced,
      statusDocument({ incidents: [postponed] }),
      "2026-11-03T14:31:00.000Z",
    );

    expect(first.events.map((event) => event.id)).toEqual([
      "maintenance.started:maint-1:2026-11-03T12:30:00.000Z",
    ]);
    expect(moved.events).toEqual([]);
    expect(second.events.map((event) => event.id)).toEqual([
      "maintenance.started:maint-1:2026-11-03T14:30:00.000Z",
    ]);
  });

  describe("updates", () => {
    const window = maintenance();
    const told = update({
      id: "upd-told",
      stage: "scheduled",
      postedAt: "2026-11-03T10:00:00.000Z",
    });
    const late = update({
      id: "upd-late",
      stage: "in-progress",
      postedAt: "2026-11-03T13:10:00.000Z",
      text: "Running late.",
    });
    const later = update({
      id: "upd-later",
      stage: "in-progress",
      postedAt: "2026-11-03T13:20:00.000Z",
    });

    function seenDuring() {
      return baselineOf(statusDocument({ incidents: [{ ...window, updates: [told] }] }), DURING);
    }

    it("announces a new update on a window whose phase has not changed", () => {
      const { events } = run(
        seenDuring(),
        statusDocument({ incidents: [{ ...window, updates: [late, told] }] }),
        DURING,
      );

      expect(events).toMatchObject([
        {
          type: "maintenance.updated",
          id: "maintenance.updated:maint-1:upd-late",
          maintenance: { id: "maint-1", kind: "maintenance" },
          update: late,
        },
      ]);
      expect(events[0]).not.toHaveProperty("maintenance.updates");
    });

    it("announces several new updates oldest first, whatever order they come in", () => {
      const { events } = run(
        seenDuring(),
        statusDocument({ incidents: [{ ...window, updates: [later, late, told] }] }),
        DURING,
      );

      expect(typesOf(events)).toEqual(["maintenance.updated", "maintenance.updated"]);
      expect(
        events.map((event) => ("update" in event ? event.update?.postedAt : undefined)),
      ).toEqual([late.postedAt, later.postedAt]);
    });

    it("carries the new end when a late window is extended", () => {
      const extended = { ...window, endsAt: "2026-11-03T15:00:00.000Z", updates: [late, told] };

      const { events } = run(seenDuring(), statusDocument({ incidents: [extended] }), DURING);

      expect(events).toMatchObject([
        { type: "maintenance.updated", maintenance: { endsAt: "2026-11-03T15:00:00.000Z" } },
      ]);
    });

    it("announces a scheduled update after a move with the new times", () => {
      const moved = {
        ...window,
        startsAt: "2026-11-04T12:30:00.000Z",
        endsAt: "2026-11-04T13:30:00.000Z",
      };
      const rescheduled = update({
        stage: "scheduled",
        postedAt: "2026-11-03T13:05:00.000Z",
        text: "Moved to tomorrow.",
      });

      const { events } = run(
        seenDuring(),
        statusDocument({ incidents: [{ ...moved, updates: [rescheduled, told] }] }),
        DURING,
      );

      expect(events).toMatchObject([
        {
          type: "maintenance.updated",
          maintenance: { startsAt: "2026-11-04T12:30:00.000Z", endsAt: "2026-11-04T13:30:00.000Z" },
          update: rescheduled,
        },
      ]);
    });

    it("keeps a window moved without a new update silent", () => {
      const moved = {
        ...window,
        startsAt: "2026-11-04T12:30:00.000Z",
        endsAt: "2026-11-04T13:30:00.000Z",
        updates: [told],
      };

      const { events } = run(seenDuring(), statusDocument({ incidents: [moved] }), DURING);

      expect(events).toEqual([]);
    });

    it("carries the newest new update on a phase event, and does not send it again", () => {
      const started = update({ stage: "in-progress", postedAt: "2026-11-03T12:31:00.000Z" });
      const previous = baselineOf(
        statusDocument({ incidents: [{ ...window, updates: [told] }] }),
        FUTURE,
      );

      const { events } = run(
        previous,
        statusDocument({ incidents: [{ ...window, updates: [started, told] }] }),
        DURING,
      );

      expect(events).toMatchObject([{ type: "maintenance.started", update: started }]);
    });

    it("announces the earlier new updates before the phase event that carries the last", () => {
      const first = update({ stage: "scheduled", postedAt: "2026-11-03T12:00:00.000Z" });
      const closing = update({ stage: "completed", postedAt: "2026-11-03T13:50:00.000Z" });
      const previous = seenDuring();

      const { events } = run(
        previous,
        statusDocument({
          incidents: [{ ...window, updates: [closing, later, first, told] }],
        }),
        AFTER,
      );

      expect(typesOf(events)).toEqual([
        "maintenance.updated",
        "maintenance.updated",
        "maintenance.completed",
      ]);
      expect(events.map((event) => ("update" in event ? event.update?.stage : undefined))).toEqual([
        "scheduled",
        "in-progress",
        "completed",
      ]);
    });

    it("leaves the update off a phase event when none arrived with it", () => {
      const { events } = run(
        seenDuring(),
        statusDocument({ incidents: [{ ...window, updates: [told] }] }),
        AFTER,
      );

      expect(typesOf(events)).toEqual(["maintenance.completed"]);
      expect(JSON.parse(JSON.stringify(events[0]))).not.toHaveProperty("update");
    });

    it("carries the latest update on a window first seen, and tells the earlier ones to nobody", () => {
      const { events } = run(
        baselineOf(statusDocument()),
        statusDocument({ incidents: [{ ...window, updates: [late, told] }] }),
        DURING,
      );

      expect(events).toMatchObject([{ type: "maintenance.started", update: late }]);
    });

    it("announces an update added to a completed window", () => {
      const done = { ...window, updates: [told] };
      const writeUp = update({ stage: "completed", postedAt: "2026-11-03T14:30:00.000Z" });
      const previous = baselineOf(statusDocument({ incidents: [done] }), AFTER);

      const { events } = run(
        previous,
        statusDocument({ incidents: [{ ...done, updates: [writeUp, told] }] }),
        AFTER,
      );

      expect(typesOf(events)).toEqual(["maintenance.updated"]);
    });

    it("does not announce a told update again when its time or stage is edited", () => {
      const edited: IncidentUpdate = {
        ...told,
        stage: "in-progress",
        postedAt: "2026-11-03T09:00:00.000Z",
      };

      const { events } = run(
        seenDuring(),
        statusDocument({ incidents: [{ ...window, updates: [edited] }] }),
        DURING,
      );

      expect(events).toEqual([]);
    });

    it("tells each update once", () => {
      const document = statusDocument({ incidents: [{ ...window, updates: [late, told] }] });
      const first = run(seenDuring(), document, DURING);

      expect(typesOf(first.events)).toEqual(["maintenance.updated"]);
      expect(run(first.announced, document, "2026-11-03T13:01:00.000Z").events).toEqual([]);
    });
  });
});

describe("components", () => {
  const healthy = statusDocument({ components: [component("website"), component("platform")] });

  it("announces a component whose state differs from the snapshot", () => {
    const { events } = run(
      baselineOf(healthy),
      statusDocument({ components: [component("website"), component("platform", "degraded")] }),
      "2026-11-03T12:05:40.000Z",
    );

    expect(events).toMatchObject([
      {
        type: "component.changed",
        id: `component.changed:platform:${BASE}:degraded`,
        component: "platform",
        from: "operational",
        to: "degraded",
      },
    ]);
  });

  describe("the id of a change", () => {
    const degraded = statusDocument({
      components: [component("website"), component("platform", "degraded")],
    });
    const outage = statusDocument({
      components: [component("website"), component("platform", "outage")],
    });

    function idsOf(result: ReturnType<typeof run>): string[] {
      return result.events.map((event) => event.id);
    }

    it("is the same when a failed send is retried, whenever the retry runs", () => {
      const previous = baselineOf(healthy);

      const first = run(previous, degraded, "2026-11-03T12:01:10.000Z");
      const retry = run(previous, degraded, "2026-11-03T12:02:10.000Z");
      const later = run(previous, degraded, "2026-11-03T12:40:00.000Z");

      expect(idsOf(retry)).toEqual(idsOf(first));
      expect(idsOf(later)).toEqual(idsOf(first));
    });

    it("differs when the component later changes to the same state again", () => {
      const at = (minute: number) => `2026-11-03T12:${String(minute).padStart(2, "0")}:10.000Z`;

      const down = run(baselineOf(healthy), degraded, at(1));
      const up = run(down.announced, healthy, at(2));
      const downAgain = run(up.announced, degraded, at(3));

      expect(new Set([...idsOf(down), ...idsOf(up), ...idsOf(downAgain)]).size).toBe(3);
      expect(idsOf(down)).toEqual([`component.changed:platform:${BASE}:degraded`]);
      expect(idsOf(downAgain)).toEqual([`component.changed:platform:${at(2)}:degraded`]);
    });

    it("differs between the two states a component moves through", () => {
      const first = run(baselineOf(healthy), degraded, LATER);
      const second = run(first.announced, outage, "2026-11-03T12:02:00.000Z");

      expect(idsOf(first)).not.toEqual(idsOf(second));
      expect(idsOf(second)).toEqual([`component.changed:platform:${LATER}:outage`]);
    });
  });

  describe("the snapshot", () => {
    it("keeps when a state was announced for as long as it lasts", () => {
      const first = run(undefined, healthy);
      const second = run(first.announced, healthy, LATER);

      expect(second.announced.components.platform).toEqual({ state: "operational", since: BASE });
    });

    it("takes the run's time when a state changes", () => {
      const { announced } = run(
        baselineOf(healthy),
        statusDocument({ components: [component("website"), component("platform", "degraded")] }),
        LATER,
      );

      expect(announced.components).toEqual({
        website: { state: "operational", since: BASE },
        platform: { state: "degraded", since: LATER },
      });
    });
  });

  it("announces each component that changed, in document order", () => {
    const { events } = run(
      baselineOf(healthy),
      statusDocument({
        components: [component("website", "outage"), component("platform", "degraded")],
      }),
      LATER,
    );

    expect(events.map((event) => ("component" in event ? event.component : undefined))).toEqual([
      "website",
      "platform",
    ]);
  });

  it("announces a recovery as it does a failure", () => {
    const down = statusDocument({
      components: [component("website"), component("platform", "outage")],
    });

    const { events } = run(baselineOf(down), healthy, LATER);

    expect(events).toMatchObject([{ from: "outage", to: "operational" }]);
  });

  it("treats a component the snapshot does not know as a baseline", () => {
    const previous = baselineOf(statusDocument({ components: [component("website")] }));

    const { events, announced } = run(previous, healthy, LATER);

    expect(events).toEqual([]);
    expect(announced.components).toEqual({
      website: { state: "operational", since: BASE },
      platform: { state: "operational", since: LATER },
    });
  });

  describe("held back while an incident or window speaks for it", () => {
    const down = statusDocument({
      components: [component("website"), component("platform", "outage")],
    });

    it.each([
      {
        name: "an open incident",
        covering: incident({ impact: "outage", components: ["platform"] }),
        expected: ["incident.opened"],
      },
      {
        name: "an open window",
        covering: maintenance({ startsAt: "2026-11-03T11:00:00.000Z" }),
        expected: ["maintenance.started"],
      },
    ])("holds back a change that $name names", ({ covering, expected }) => {
      const { events } = run(baselineOf(healthy), { ...down, incidents: [covering] }, LATER);

      expect(typesOf(events)).toEqual(expected);
    });

    it("still announces a component the open incident does not name", () => {
      const document = statusDocument({
        components: [component("website", "degraded"), component("platform", "outage")],
        incidents: [incident({ impact: "outage", components: ["platform"] })],
      });

      const { events } = run(baselineOf(healthy), document, LATER);

      expect(typesOf(events)).toEqual(["incident.opened", "component.changed"]);
      expect(events[1]).toMatchObject({ component: "website" });
    });

    it.each([
      { impact: "degraded", to: "degraded", isHeld: true },
      { impact: "degraded", to: "outage", isHeld: false },
      { impact: "outage", to: "degraded", isHeld: true },
      { impact: "outage", to: "outage", isHeld: true },
    ] satisfies { impact: Incident["impact"]; to: ComponentState; isHeld: boolean }[])(
      "holds back a change to $to under an open $impact incident: $isHeld",
      ({ impact, to, isHeld }) => {
        const document = statusDocument({
          components: [component("website"), component("platform", to)],
          incidents: [incident({ impact, components: ["platform"] })],
        });

        const { events } = run(baselineOf(healthy), document, LATER);

        expect(typesOf(events)).toEqual(
          isHeld ? ["incident.opened"] : ["incident.opened", "component.changed"],
        );
      },
    );

    it.each(["degraded", "outage", "operational"] satisfies ComponentState[])(
      "holds back a change to %s under an open window, whatever it measured",
      (to) => {
        const window = maintenance({ startsAt: "2026-11-03T11:00:00.000Z" });
        const previous = baselineOf(
          statusDocument({ components: [component("platform", "maintenance")] }),
        );

        const { events } = run(
          previous,
          statusDocument({ components: [component("platform", to)], incidents: [window] }),
          LATER,
        );

        expect(typesOf(events)).toEqual(["maintenance.started"]);
      },
    );

    it("announces the worse state once an incident that declared less is the one open", () => {
      const declared = incident({ impact: "degraded", components: ["platform"] });
      const previous = baselineOf({
        ...statusDocument({ components: [component("platform", "degraded")] }),
        incidents: [declared],
      });

      const { events } = run(
        previous,
        statusDocument({ components: [component("platform", "outage")], incidents: [declared] }),
        LATER,
      );

      expect(events).toMatchObject([
        { type: "component.changed", component: "platform", from: "degraded", to: "outage" },
      ]);
    });

    it("holds back a worse state in the run the incident that declared less is resolved", () => {
      const declared = incident({ impact: "degraded", components: ["platform"] });
      const previous = baselineOf({
        ...statusDocument({ components: [component("platform", "degraded")] }),
        incidents: [declared],
      });

      const { events } = run(
        previous,
        statusDocument({
          components: [component("platform", "outage")],
          incidents: [{ ...declared, resolvedAt: "2026-11-03T12:01:00.000Z" }],
        }),
        LATER,
      );

      expect(typesOf(events)).toEqual(["incident.resolved"]);
    });

    it.each([
      {
        name: "a window not yet open",
        other: maintenance({
          startsAt: "2026-11-03T18:00:00.000Z",
          endsAt: "2026-11-03T19:00:00.000Z",
        }),
      },
      {
        name: "an incident resolved long ago",
        other: incident({ components: ["platform"], resolvedAt: "2026-11-03T11:30:00.000Z" }),
      },
    ])("announces a change that $name names", ({ other }) => {
      const previous = baselineOf({ ...healthy, incidents: [other] });

      const { events } = run(previous, { ...down, incidents: [other] }, LATER);

      expect(typesOf(events)).toEqual(["component.changed"]);
    });

    it("never announces a held-back change later", () => {
      const during = {
        ...down,
        incidents: [incident({ impact: "outage", components: ["platform"] })],
      };

      const held = run(baselineOf(healthy), during, LATER);
      const next = run(held.announced, during, "2026-11-03T12:02:00.000Z");

      expect(held.announced.components.platform).toEqual({ state: "outage", since: LATER });
      expect(next.events).toEqual([]);
    });

    it("holds back the recovery in the run an incident is resolved, since that event says it", () => {
      const covering = incident({ impact: "outage", components: ["platform"] });
      const resolved = { ...covering, resolvedAt: "2026-11-03T12:01:00.000Z" };
      const previous = baselineOf({ ...down, incidents: [covering] });

      const { events } = run(previous, { ...healthy, incidents: [resolved] }, LATER);

      expect(typesOf(events)).toEqual(["incident.resolved"]);
    });

    it("holds back the return to service in the run a window completes", () => {
      const window = maintenance({
        startsAt: "2026-11-03T11:00:00.000Z",
        endsAt: "2026-11-03T12:30:00.000Z",
      });
      const inMaintenance = statusDocument({
        components: [component("website"), component("platform", "maintenance")],
      });
      const previous = baselineOf({ ...inMaintenance, incidents: [window] });

      const { events } = run(
        previous,
        { ...healthy, incidents: [window] },
        "2026-11-03T12:31:00.000Z",
      );

      expect(typesOf(events)).toEqual(["maintenance.completed"]);
    });

    it("announces the next change, because a resolved incident no longer speaks for it", () => {
      const resolved = incident({
        components: ["platform"],
        resolvedAt: "2026-11-03T12:01:00.000Z",
      });
      const previous = baselineOf({ ...healthy, incidents: [resolved] }, LATER);

      const { events } = run(
        previous,
        { ...down, incidents: [resolved] },
        "2026-11-03T12:02:00.000Z",
      );

      expect(typesOf(events)).toEqual(["component.changed"]);
    });
  });
});

describe("notices", () => {
  it("announces a notice that is new", () => {
    const posted = notice({ body: "Expect delays.", severity: "warning" });

    const { events } = run(baselineOf(statusDocument()), statusDocument({ notices: [posted] }));

    expect(events).toMatchObject([
      { type: "notice.posted", id: `notice.posted:notice-1:${BASE}`, notice: posted },
    ]);
  });

  it("announces a notice that vanished, by the id and title it had", () => {
    const previous = baselineOf(statusDocument({ notices: [notice({ body: "Long text." })] }));

    const { events, announced } = run(previous, statusDocument(), LATER);

    expect(events).toHaveLength(1);
    expect(events[0]).toMatchObject({
      type: "notice.removed",
      id: `notice.removed:notice-1:${BASE}`,
      notice: { id: "notice-1", title: "Heads up" },
    });
    expect(events[0]).not.toHaveProperty("notice.body");
    expect(announced.notices).toEqual([]);
  });

  it("announces posted notices before removed ones", () => {
    const previous = baselineOf(statusDocument({ notices: [notice({ id: "old" })] }));

    const { events } = run(previous, statusDocument({ notices: [notice({ id: "new" })] }), LATER);

    expect(typesOf(events)).toEqual(["notice.posted", "notice.removed"]);
  });

  it("does not announce a notice whose text was edited", () => {
    const previous = baselineOf(statusDocument({ notices: [notice()] }));

    const { events, announced } = run(
      previous,
      statusDocument({ notices: [notice({ title: "Reworded", body: "More." })] }),
      LATER,
    );

    expect(events).toEqual([]);
    expect(announced.notices).toEqual([{ id: "notice-1", title: "Reworded" }]);
  });
});

describe("a busy run", () => {
  const before = statusDocument({
    components: [component("website"), component("platform"), component("data-intake")],
    incidents: [incident({ id: "old", resolvedAt: "2026-11-03T11:30:00.000Z" })],
    notices: [notice({ id: "old-notice" })],
  });
  const after = statusDocument({
    components: [
      component("website", "degraded"),
      component("platform"),
      component("data-intake", "outage"),
    ],
    incidents: [
      incident({ id: "old", resolvedAt: "2026-11-03T11:30:00.000Z" }),
      incident({ id: "inc-2", components: ["data-intake"], impact: "outage", updates: [update()] }),
      maintenance({
        id: "maint-2",
        startsAt: "2026-11-03T18:00:00.000Z",
        endsAt: "2026-11-03T19:00:00.000Z",
      }),
    ],
    notices: [notice({ id: "new-notice" })],
  });
  const result = run(baselineOf(before), after, LATER);

  it("orders incidents and windows first, then notices, then components", () => {
    expect(typesOf(result.events)).toEqual([
      "incident.opened",
      "maintenance.scheduled",
      "notice.posted",
      "notice.removed",
      "component.changed",
    ]);
  });

  it("holds back only the component the new incident names", () => {
    expect(result.events.at(-1)).toMatchObject({ type: "component.changed", component: "website" });
  });

  it("stamps every event with the run, the environment and the page", () => {
    for (const event of result.events) {
      expect(event).toMatchObject({
        version: STATUS_EVENTS_VERSION,
        environment: ENVIRONMENT,
        occurredAt: LATER,
        pageUrl: PAGE_URL,
      });
    }
  });

  it("gives every event an id that is unique in the run and the same on a repeat", () => {
    const ids = result.events.map((event) => event.id);

    expect(new Set(ids).size).toBe(ids.length);
    expect(run(baselineOf(before), after, LATER).events.map((event) => event.id)).toEqual(ids);
  });

  it("produces events the contract accepts", () => {
    for (const event of result.events) {
      expect(statusEventSchema.parse(event)).toEqual(event);
    }
  });

  it("yields nothing when run again on the same document", () => {
    const at = "2026-11-03T12:02:00.000Z";
    const again = run(result.announced, after, at);

    expect(again.events).toEqual([]);
    expect(again.announced).toEqual({ ...result.announced, at });
  });
});

describe("every event type", () => {
  const baselineAt = "2026-11-03T11:55:00.000Z";
  const before = statusDocument({
    components: [component("website"), component("platform")],
    incidents: [
      incident({ id: "open-1" }),
      incident({ id: "open-2" }),
      maintenance({ id: "window-1", startsAt: "2026-11-03T11:58:00.000Z" }),
      maintenance({
        id: "window-2",
        startsAt: "2026-11-03T11:00:00.000Z",
        endsAt: "2026-11-03T12:30:00.000Z",
      }),
      maintenance({ id: "window-4", startsAt: "2026-11-03T11:00:00.000Z" }),
    ],
    notices: [notice({ id: "gone" })],
  });
  const after = statusDocument({
    components: [component("website", "degraded"), component("platform")],
    incidents: [
      incident({ id: "open-1", updates: [update({ id: "upd-a", stage: "identified" })] }),
      incident({
        id: "open-2",
        resolvedAt: "2026-11-03T11:50:00.000Z",
        updates: [update({ id: "upd-b", stage: "resolved", postedAt: "2026-11-03T11:50:00.000Z" })],
      }),
      incident({ id: "open-3" }),
      maintenance({ id: "window-1", startsAt: "2026-11-03T11:58:00.000Z" }),
      maintenance({
        id: "window-2",
        startsAt: "2026-11-03T11:00:00.000Z",
        endsAt: "2026-11-03T12:30:00.000Z",
        resolvedAt: "2026-11-03T11:58:00.000Z",
      }),
      maintenance({
        id: "window-4",
        startsAt: "2026-11-03T11:00:00.000Z",
        updates: [
          update({ id: "upd-c", stage: "in-progress", postedAt: "2026-11-03T11:59:00.000Z" }),
        ],
      }),
      maintenance({ id: "window-3", startsAt: "2026-11-04T12:00:00.000Z" }),
    ],
    notices: [notice({ id: "fresh" })],
  });
  const { events } = run(baselineOf(before, baselineAt), after);

  it("produces each type once, in the order incidents, windows, notices, components", () => {
    expect(events.map((event) => event.id)).toEqual([
      "incident.updated:open-1:upd-a",
      "incident.resolved:open-2:2026-11-03T11:50:00.000Z",
      `incident.opened:open-3:${baselineAt}`,
      "maintenance.started:window-1:2026-11-03T11:58:00.000Z",
      "maintenance.completed:window-2:2026-11-03T11:58:00.000Z",
      "maintenance.updated:window-4:upd-c",
      "maintenance.scheduled:window-3:2026-11-04T12:00:00.000Z",
      `notice.posted:fresh:${baselineAt}`,
      `notice.removed:gone:${baselineAt}`,
      `component.changed:website:${baselineAt}:degraded`,
    ]);
  });

  it("shapes each as the contract says", () => {
    for (const event of events) {
      expect(statusEventSchema.parse(event)).toEqual(event);
    }
  });
});

describe("the id of a repeated change", () => {
  const posted = notice({ id: "notice-1" });
  const withNotice = statusDocument({ notices: [posted] });
  const without = statusDocument();

  it("differs for a notice posted again after it was removed", () => {
    const first = run(baselineOf(without), withNotice, LATER);
    const removed = run(first.announced, without, "2026-11-03T12:02:00.000Z");
    const again = run(removed.announced, withNotice, "2026-11-03T12:03:00.000Z");
    const ids = [...first.events, ...again.events]
      .filter((event) => event.type === "notice.posted")
      .map((event) => event.id);

    expect(ids).toHaveLength(2);
    expect(new Set(ids).size).toBe(2);
  });

  it("stays the same when a failed send is retried from the same snapshot", () => {
    const previous = baselineOf(without);
    const ids = (now: string) => run(previous, withNotice, now).events.map((event) => event.id);

    expect(ids("2026-11-03T12:05:00.000Z")).toEqual(ids(LATER));
  });
});

describe("statusEventSchema", () => {
  const valid = {
    version: STATUS_EVENTS_VERSION,
    id: "notice.posted:notice-1",
    type: "notice.posted",
    environment: ENVIRONMENT,
    occurredAt: BASE,
    pageUrl: PAGE_URL,
    notice: notice(),
  };

  it("accepts a well-formed event", () => {
    expect(statusEventSchema.safeParse(valid).success).toBe(true);
  });

  it.each([
    ["a type it does not know", { type: "incident.deleted" }],
    ["another version", { version: 2 }],
    ["an empty id", { id: "" }],
    ["a time that is not an instant", { occurredAt: "yesterday" }],
    ["a page that is not a URL", { pageUrl: "status page" }],
    ["no environment", { environment: "" }],
    ["no payload", { notice: undefined }],
  ])("rejects an event with %s", (_name, change) => {
    expect(statusEventSchema.safeParse({ ...valid, ...change }).success).toBe(false);
  });
});

function changed(id: string): StatusEvent {
  return {
    version: STATUS_EVENTS_VERSION,
    id,
    environment: ENVIRONMENT,
    occurredAt: BASE,
    pageUrl: PAGE_URL,
    type: "component.changed",
    component: "website",
    from: "operational",
    to: "degraded",
  };
}

describe("batchEvents", () => {
  const ids = (batches: ReturnType<typeof batchEvents>) =>
    batches.map((batch) => batch.map(({ event }) => event.id));

  it("sends nothing for no events", () => {
    expect(batchEvents([])).toEqual([]);
  });

  it("fills batches of ten in order", () => {
    const events = Array.from({ length: SNS_BATCH_SIZE + 2 }, (_, index) => changed(`e${index}`));

    expect(ids(batchEvents(events))).toEqual([
      events.slice(0, SNS_BATCH_SIZE).map(({ id }) => id),
      ["e10", "e11"],
    ]);
  });

  it("starts a new batch before the bytes would pass the limit", () => {
    const big = (name: string) => changed(name.padEnd(SNS_BATCH_BYTES / 2, "x"));
    const batches = batchEvents([big("a"), big("b"), changed("c")]);

    expect(batches.map((batch) => batch.length)).toEqual([1, 2]);
    expect(batches.flat().map(({ message, event }) => message === JSON.stringify(event))).toEqual([
      true,
      true,
      true,
    ]);
  });

  it("sends a message over the limit on its own", () => {
    const huge = changed("h".repeat(SNS_BATCH_BYTES));

    expect(ids(batchEvents([changed("a"), huge, changed("b")]))).toEqual([["a"], [huge.id], ["b"]]);
  });
});

describe("failedEntriesText", () => {
  it("names each refused entry by its event and keeps an id it cannot match", () => {
    const sent = [changed("first"), changed("second")];

    expect(
      failedEntriesText(sent, [
        { Id: "1", Code: "Throttled", Message: "slow down" },
        { Id: "7", Code: "InternalError" },
      ]),
    ).toBe("second (Throttled: slow down), 7 (InternalError: undefined)");
  });
});
