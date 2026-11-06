import { describe, expect, it } from "vitest";

import { STATUS_COMPONENT_IDS } from "./status-document.js";
import type { IncidentUpdate } from "./status-document.js";
import { statusEventSchema } from "./status-events.js";
import type { IncidentSummary, StatusEvent } from "./status-events.js";
import { STATUS_COMPONENT_NAMES, slackMessage } from "./status-slack.js";
import type { SlackMessage } from "./status-slack.js";

const SECTION_LIMIT = 3000;
const BLOCK_LIMIT = 50;
const EM_DASH = String.fromCharCode(0x2014);
const LONE_SURROGATE = /[\uD800-\uDBFF](?![\uDC00-\uDFFF])|(?<![\uD800-\uDBFF])[\uDC00-\uDFFF]/;

const envelope: Pick<StatusEvent, "version" | "id" | "environment" | "occurredAt" | "pageUrl"> = {
  version: 1,
  id: "event-1",
  environment: "prod",
  occurredAt: "2026-11-03T12:00:00.000Z",
  pageUrl: "https://status.example.org/",
};

const incident: IncidentSummary = {
  id: "inc-1",
  kind: "incident",
  title: "Measurements are not reaching the platform",
  impact: "outage",
  components: ["data-intake", "data-delivery"],
  startsAt: "2026-11-03T11:00:00.000Z",
};

const window: IncidentSummary = {
  id: "maint-1",
  kind: "maintenance",
  title: "Database upgrade",
  impact: "degraded",
  components: ["platform"],
  startsAt: "2026-11-05T10:00:00.000Z",
  endsAt: "2026-11-05T11:30:00.000Z",
};

const update: IncidentUpdate = {
  id: "upd-1",
  stage: "investigating",
  postedAt: "2026-11-03T11:55:00.000Z",
  text: "We are looking into it. Measurements may arrive later than usual.",
  nextUpdateBy: "2026-11-03T12:30:00.000Z",
};

interface OpenedChange {
  title?: string;
  text?: string;
  postedAt?: string;
  environment?: string;
  pageUrl?: string;
}

function opened(change: OpenedChange = {}): StatusEvent {
  return {
    ...envelope,
    environment: change.environment ?? envelope.environment,
    pageUrl: change.pageUrl ?? envelope.pageUrl,
    type: "incident.opened",
    incident: { ...incident, title: change.title ?? incident.title },
    update: {
      ...update,
      text: change.text ?? update.text,
      postedAt: change.postedAt ?? update.postedAt,
    },
  };
}

function blocksText(message: SlackMessage): string {
  return message.blocks.map((block) => JSON.stringify(block)).join("\n");
}

function sectionTexts(message: SlackMessage): string[] {
  return message.blocks.flatMap((block) => (block.type === "section" ? [block.text.text] : []));
}

const events: [string, StatusEvent, string[]][] = [
  [
    "an incident opened",
    opened(),
    [
      "*Incident opened: Measurements are not reaching the platform*",
      "Impact: outage. Affects Data intake and Data delivery.",
      "Started Tuesday, November 3, 2026, 11:00 UTC.",
      "*Investigating* (posted Nov 3, 2026, 11:55 UTC)\n> We are looking into it. Measurements may arrive later than usual.\nNext update by Nov 3, 2026, 12:30 UTC.",
    ],
  ],
  [
    "an incident opened without an update",
    { ...envelope, type: "incident.opened", incident },
    ["*Incident opened: Measurements are not reaching the platform*"],
  ],
  [
    "a degraded incident",
    { ...envelope, type: "incident.opened", incident: { ...incident, impact: "degraded" } },
    ["Impact: degraded. Affects Data intake and Data delivery."],
  ],
  [
    "an incident updated",
    {
      ...envelope,
      type: "incident.updated",
      incident,
      update: { ...update, stage: "identified", text: "We know what is wrong." },
    },
    [
      "*Incident updated: Measurements are not reaching the platform*",
      "*Identified* (posted Nov 3, 2026, 11:55 UTC)\n> We know what is wrong.\nNext update by Nov 3, 2026, 12:30 UTC.",
    ],
  ],
  [
    "an incident resolved",
    {
      ...envelope,
      occurredAt: "2026-11-03T12:42:00.000Z",
      type: "incident.resolved",
      incident: { ...incident, resolvedAt: "2026-11-03T12:40:00.000Z" },
      update: {
        id: "upd-9",
        stage: "resolved",
        postedAt: "2026-11-03T12:41:00.000Z",
        text: "Fixed.",
      },
    },
    [
      "*Incident resolved: Measurements are not reaching the platform*",
      "Resolved Tuesday, November 3, 2026, 12:40 UTC.",
      "*Resolved* (posted Nov 3, 2026, 12:41 UTC)\n> Fixed.",
    ],
  ],
  [
    "maintenance scheduled",
    {
      ...envelope,
      type: "maintenance.scheduled",
      maintenance: window,
      update: { ...update, stage: "scheduled", text: "We will upgrade the database." },
    },
    [
      "*Maintenance scheduled: Database upgrade*",
      "Affects Platform.",
      "Planned window: Thursday, November 5, 2026, 10:00 to 11:30 UTC.",
      "*Scheduled* (posted Nov 3, 2026, 11:55 UTC)\n> We will upgrade the database.",
    ],
  ],
  [
    "maintenance started",
    { ...envelope, type: "maintenance.started", maintenance: window },
    ["*Maintenance started: Database upgrade*", "Planned window: Thursday, November 5, 2026"],
  ],
  [
    "maintenance updated across days",
    {
      ...envelope,
      type: "maintenance.updated",
      maintenance: { ...window, endsAt: "2026-11-06T01:00:00.000Z" },
      update: { ...update, stage: "in-progress", text: "Running late.", nextUpdateBy: undefined },
    },
    [
      "*Maintenance updated: Database upgrade*",
      "Planned window: Nov 5, 2026, 10:00 UTC to Nov 6, 2026, 01:00 UTC.",
      "*In progress* (posted Nov 3, 2026, 11:55 UTC)\n> Running late.",
    ],
  ],
  [
    "maintenance with no end",
    { ...envelope, type: "maintenance.scheduled", maintenance: { ...window, endsAt: undefined } },
    ["Planned window: from Nov 5, 2026, 10:00 UTC."],
  ],
  [
    "maintenance completed",
    {
      ...envelope,
      occurredAt: "2026-11-05T11:12:00.000Z",
      type: "maintenance.completed",
      maintenance: { ...window, resolvedAt: "2026-11-05T11:10:00.000Z" },
      update: {
        ...update,
        stage: "completed",
        text: "The work is finished.",
        nextUpdateBy: undefined,
      },
    },
    [
      "*Maintenance completed: Database upgrade*",
      "Ended Thursday, November 5, 2026, 11:10 UTC.",
      "*Completed* (posted Nov 3, 2026, 11:55 UTC)\n> The work is finished.",
    ],
  ],
  [
    "a component changed",
    {
      ...envelope,
      type: "component.changed",
      component: "sign-in",
      from: "operational",
      to: "degraded",
    },
    ["*Component changed: Sign-in is degraded*", "Sign-in changed from Operational to Degraded."],
  ],
  [
    "a component that is down",
    {
      ...envelope,
      type: "component.changed",
      component: "exports",
      from: "degraded",
      to: "outage",
    },
    ["*Component changed: Exports is down*", "Exports changed from Degraded to Outage."],
  ],
  [
    "a component that recovered",
    {
      ...envelope,
      type: "component.changed",
      component: "website",
      from: "outage",
      to: "operational",
    },
    [
      "*Component changed: Website is working normally*",
      "Website changed from Outage to Operational.",
    ],
  ],
  [
    "a notice posted",
    {
      ...envelope,
      type: "notice.posted",
      notice: {
        id: "n-1",
        title: "Old Android phones",
        body: "Update the app.\nThen sign in again.",
        severity: "warning",
      },
    },
    [
      "*Notice posted: Old Android phones*",
      "This notice is a warning.",
      "> Update the app.\n> Then sign in again.",
    ],
  ],
  [
    "a notice posted without a body",
    {
      ...envelope,
      type: "notice.posted",
      notice: { id: "n-1", title: "Heads up", body: "  ", severity: "info" },
    },
    ["*Notice posted: Heads up*", "This notice is for information."],
  ],
  [
    "a notice removed",
    { ...envelope, type: "notice.removed", notice: { id: "n-1", title: "Heads up" } },
    ["*Notice removed: Heads up*", "The notice is no longer on the status page."],
  ],
];

describe("the message for each event", () => {
  it.each(events)("says what happened for %s", (_name, event, expected) => {
    const message = slackMessage(event);
    const text = sectionTexts(message).join("\n");

    for (const line of expected) {
      expect(text).toContain(line);
    }
  });

  it.each(events)("is a valid event and a valid Slack message for %s", (_name, event) => {
    const message = slackMessage(event);

    expect(statusEventSchema.safeParse(event).success).toBe(true);
    expect(message.blocks.length).toBeLessThanOrEqual(BLOCK_LIMIT);
    expect(message.text.length).toBeGreaterThan(0);

    for (const text of sectionTexts(message)) {
      expect(text.length).toBeGreaterThan(0);
      expect(text.length).toBeLessThanOrEqual(SECTION_LIMIT);
    }
  });

  it.each(events)("uses no em dash and no emoji for %s", (_name, event) => {
    const everything = `${slackMessage(event).text}\n${blocksText(slackMessage(event))}`;

    expect(everything).not.toContain(EM_DASH);
    expect(everything).not.toMatch(/\p{Extended_Pictographic}/u);
  });

  it.each(events)("falls back to the headline and the first line for %s", (_name, event) => {
    const message = slackMessage(event);
    const [headline, first] = sectionTexts(message);

    expect(message.text).toBe(`${headline.slice(1, -1)}\n${first.split("\n")[0]}`);
  });
});

describe("the impact", () => {
  it.each([
    ["an incident that is an outage", { ...envelope, type: "incident.opened", incident }, true],
    [
      "an incident that is degraded",
      { ...envelope, type: "incident.opened", incident: { ...incident, impact: "degraded" } },
      true,
    ],
    ["maintenance", { ...envelope, type: "maintenance.scheduled", maintenance: window }, false],
    [
      "a component change",
      {
        ...envelope,
        type: "component.changed",
        component: "website",
        from: "operational",
        to: "outage",
      },
      false,
    ],
  ] satisfies [string, StatusEvent, boolean][])(
    "is stated only for incidents: %s",
    (_name, event, isStated) => {
      const text = sectionTexts(slackMessage(event)).join("\n");

      expect(text.includes("Impact: ")).toBe(isStated);
    },
  );

  it("is the second line of the notification text, so a push shows how bad it is", () => {
    expect(slackMessage(opened()).text).toBe(
      "Incident opened: Measurements are not reaching the platform\nImpact: outage. Affects Data intake and Data delivery.",
    );
  });
});

describe("when something ended", () => {
  const occurredAt = envelope.occurredAt;

  it.each([
    ["before the event", "2026-11-03T11:30:00.000Z", true],
    ["at the event", occurredAt, true],
    ["a minute after the event", "2026-11-03T12:01:00.000Z", false],
    ["days after the event", "2026-11-06T10:00:00.000Z", false],
  ])(
    "an incident resolved %s prints its time only when it has passed",
    (_name, resolvedAt, isPrinted) => {
      const event: StatusEvent = {
        ...envelope,
        type: "incident.updated",
        incident: { ...incident, resolvedAt },
        update,
      };
      const text = sectionTexts(slackMessage(event)).join("\n");

      expect(text.includes("Resolved ")).toBe(isPrinted);
    },
  );

  it.each([
    ["before the event", "2026-11-05T11:10:00.000Z", "2026-11-05T12:00:00.000Z", true],
    ["at the event", "2026-11-05T12:00:00.000Z", "2026-11-05T12:00:00.000Z", true],
    ["after the event", "2026-11-05T13:00:00.000Z", "2026-11-05T12:00:00.000Z", false],
  ])(
    "a window that ended %s prints its time only when it has passed, and always its planned window",
    (_name, resolvedAt, eventAt, isPrinted) => {
      const event: StatusEvent = {
        ...envelope,
        occurredAt: eventAt,
        type: "maintenance.started",
        maintenance: { ...window, resolvedAt },
      };
      const text = sectionTexts(slackMessage(event)).join("\n");

      expect(text.includes("Ended ")).toBe(isPrinted);
      expect(text).toContain("Planned window: Thursday, November 5, 2026, 10:00 to 11:30 UTC.");
    },
  );
});

describe("the update time", () => {
  it.each([
    ["on the hour", "2026-11-03T11:00:00.000Z", "Nov 3, 2026, 11:00 UTC"],
    ["with seconds and milliseconds", "2026-11-03T11:55:42.123Z", "Nov 3, 2026, 11:55 UTC"],
    ["on another day than the event", "2026-11-01T23:59:00.000Z", "Nov 1, 2026, 23:59 UTC"],
  ])("is the update's own, shown after the stage, %s", (_name, postedAt, expected) => {
    const updateSection = sectionTexts(slackMessage(opened({ postedAt }))).at(-1) ?? "";

    expect(updateSection.split("\n")[0]).toBe(`*Investigating* (posted ${expected})`);
  });

  it("leaves the event time in the footer", () => {
    expect(slackMessage(opened()).blocks.at(-1)).toMatchObject({
      elements: [{}, { text: "Nov 3, 2026, 12:00 UTC" }],
    });
  });
});

describe("the footer", () => {
  it("links to the page and gives the event time in UTC", () => {
    const footer = slackMessage(opened()).blocks.at(-1);

    expect(footer).toEqual({
      type: "context",
      elements: [
        { type: "mrkdwn", text: "<https://status.example.org/|View the status page>" },
        { type: "mrkdwn", text: "Nov 3, 2026, 12:00 UTC" },
      ],
    });
  });

  it("names the environment unless it is production", () => {
    const footer = slackMessage(opened({ environment: "dev" })).blocks.at(-1);

    expect(footer).toMatchObject({
      elements: [{}, {}, { type: "mrkdwn", text: "Environment: dev" }],
    });
  });

  it("keeps a pipe in the address from splitting the link", () => {
    const footer = slackMessage(opened({ pageUrl: "https://status.example.org/a|b" })).blocks.at(
      -1,
    );

    expect(footer).toMatchObject({
      elements: [{ text: "<https://status.example.org/a%7Cb|View the status page>" }, {}],
    });
  });
});

describe("user text", () => {
  it.each([
    ["an ampersand", "Fish & chips", "Fish &amp; chips"],
    ["angle brackets", "x < y > z", "x &lt; y &gt; z"],
    ["a mention", "Ping <!channel> now", "Ping &lt;!channel&gt; now"],
    ["a link", "See <https://evil.example|here>", "See &lt;https://evil.example|here&gt;"],
    ["an entity", "Already &amp; escaped", "Already &amp;amp; escaped"],
  ])("escapes %s in the title and the update", (_name, raw, escaped) => {
    const message = slackMessage(opened({ title: raw, text: raw }));
    const text = sectionTexts(message).join("\n");

    expect(text).toContain(`*Incident opened: ${escaped}*`);
    expect(text).toContain(`> ${escaped}`);
    expect(text).not.toContain("<!channel>");
  });

  it("puts a quote marker on every line of an update", () => {
    const message = slackMessage(opened({ text: "One.\r\nTwo.\n\nThree." }));

    expect(sectionTexts(message).join("\n")).toContain("> One.\n> Two.\n> \n> Three.");
  });

  it("keeps a long title on one line", () => {
    const message = slackMessage(opened({ title: `${"a".repeat(400)}\nsecond line` }));
    const [headline] = sectionTexts(message);

    expect(headline).not.toContain("\n");
    expect(headline.length).toBeLessThan(400);
    expect(headline.endsWith("...*")).toBe(true);
  });
});

describe("a long update", () => {
  it.each([
    ["plain text", "a".repeat(10_000)],
    ["text that grows when escaped", "&".repeat(10_000)],
    ["text of many short lines", "x\n".repeat(10_000)],
    ["text of surrogate pairs", "\u{1D11E}".repeat(10_000)],
  ])("fits the section limit for %s", (_name, text) => {
    const message = slackMessage(opened({ text }));
    const texts = sectionTexts(message);
    const updateSection = texts.at(-1) ?? "";

    expect(updateSection.length).toBeLessThanOrEqual(SECTION_LIMIT);
    expect(updateSection).toContain("...\nNext update by Nov 3, 2026, 12:30 UTC.");
  });

  it("never cuts an escaped character in half or splits a surrogate pair", () => {
    const ampersands = slackMessage(opened({ text: "&".repeat(10_000) }));
    const pairs = slackMessage(opened({ text: "\u{1D11E}".repeat(10_000) }));

    const kept = (sectionTexts(ampersands).at(-1) ?? "").split("\n")[1];
    expect(kept.slice(2, -3).replaceAll("&amp;", "")).toBe("");
    expect(sectionTexts(pairs).at(-1)).not.toMatch(LONE_SURROGATE);
  });

  it("leaves a text that fits as it is", () => {
    const message = slackMessage(opened({ text: "Short." }));

    expect(sectionTexts(message).at(-1)).toContain("> Short.\n");
    expect(sectionTexts(message).join("")).not.toContain("...");
  });

  it("also cuts a long notice body", () => {
    const message = slackMessage({
      ...envelope,
      type: "notice.posted",
      notice: { id: "n-1", title: "Long", body: "b".repeat(10_000), severity: "info" },
    });

    for (const text of sectionTexts(message)) {
      expect(text.length).toBeLessThanOrEqual(SECTION_LIMIT);
    }
  });
});

describe("the component names", () => {
  it("name every component the page has", () => {
    expect(Object.keys(STATUS_COMPONENT_NAMES).sort()).toEqual([...STATUS_COMPONENT_IDS].sort());
  });
});
