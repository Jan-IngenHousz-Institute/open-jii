import { describe, expect, it } from "vitest";

import type { Incident, IncidentUpdate } from "@repo/monitoring/status-document";

import { renderPreview, slackPosts } from "./status-incident-preview.js";

const NOW = new Date("2026-11-04T10:00:00.000Z");

function update(change: Partial<IncidentUpdate> = {}): IncidentUpdate {
  return {
    id: "upd-1",
    stage: "investigating",
    postedAt: "2026-11-04T09:00:00.000Z",
    text: "We are looking into a problem with sign-in.",
    ...change,
  };
}

function incident(change: Partial<Incident> = {}): Incident {
  return {
    id: "inc-1",
    kind: "incident",
    title: "Sign-in is slow",
    impact: "outage",
    components: ["sign-in", "data-intake"],
    startsAt: "2026-11-04T08:30:00.000Z",
    updates: [update()],
    ...change,
  };
}

function window(change: Partial<Incident> = {}): Incident {
  return incident({
    id: "maint-1",
    kind: "maintenance",
    title: "Database upgrade",
    impact: "degraded",
    components: ["platform"],
    startsAt: "2026-11-05T09:00:00.000Z",
    endsAt: "2026-11-05T11:00:00.000Z",
    updates: [update({ id: "upd-m1", stage: "scheduled", text: "Planned work on the platform." })],
    ...change,
  });
}

function typesOf(posts: ReturnType<typeof slackPosts>): string[] {
  return posts.map((post) => post.event.type);
}

describe("slackPosts", () => {
  it("opens an incident that was never announced", () => {
    const posts = slackPosts({ before: undefined, after: incident(), told: [], now: NOW });

    expect(typesOf(posts)).toEqual(["incident.opened"]);
    expect(posts[0]?.message.text).toContain("Incident opened: Sign-in is slow");
  });

  it("updates an incident with the new update only", () => {
    const first = update();
    const second = update({ id: "upd-2", stage: "identified", text: "We know what is wrong." });
    const posts = slackPosts({
      before: incident({ updates: [first] }),
      after: incident({ updates: [first, second] }),
      told: ["upd-1"],
      now: NOW,
    });

    expect(typesOf(posts)).toEqual(["incident.updated"]);
    expect(JSON.stringify(posts[0]?.message.blocks)).toContain("We know what is wrong.");
    expect(JSON.stringify(posts[0]?.message.blocks)).not.toContain("looking into");
  });

  it("resolves an incident", () => {
    const first = update();
    const last = update({ id: "upd-2", stage: "resolved", text: "The problem is fixed." });
    const posts = slackPosts({
      before: incident({ updates: [first] }),
      after: incident({
        updates: [first, last],
        resolvedAt: "2026-11-04T09:50:00.000Z",
      }),
      told: ["upd-1"],
      now: NOW,
    });

    expect(typesOf(posts)).toEqual(["incident.resolved"]);
    expect(posts[0]?.message.text).toContain("Incident resolved: Sign-in is slow");
  });

  it("schedules maintenance that has not started", () => {
    const posts = slackPosts({ before: undefined, after: window(), told: [], now: NOW });

    expect(typesOf(posts)).toEqual(["maintenance.scheduled"]);
  });

  it("updates maintenance that is still ahead", () => {
    const first = update({ id: "upd-m1", stage: "scheduled" });
    const second = update({ id: "upd-m2", stage: "scheduled", text: "The window moved." });
    const posts = slackPosts({
      before: window({ updates: [first] }),
      after: window({ updates: [first, second] }),
      told: ["upd-m1"],
      now: NOW,
    });

    expect(typesOf(posts)).toEqual(["maintenance.updated"]);
  });

  it("completes maintenance once it is resolved", () => {
    const first = update({ id: "upd-m1", stage: "scheduled" });
    const last = update({ id: "upd-m2", stage: "completed", text: "The work is finished." });
    const started = { startsAt: "2026-11-04T08:00:00.000Z", endsAt: "2026-11-04T12:00:00.000Z" };
    const posts = slackPosts({
      before: window({ ...started, updates: [first] }),
      after: window({
        ...started,
        resolvedAt: "2026-11-04T09:55:00.000Z",
        updates: [first, last],
      }),
      told: ["upd-m1"],
      now: NOW,
    });

    expect(typesOf(posts)).toEqual(["maintenance.completed"]);
  });

  it("sends a message for each update still unannounced", () => {
    const told = update({ id: "upd-1" });
    const draftOne = update({ id: "upd-2", stage: "identified", text: "We know what is wrong." });
    const draftTwo = update({ id: "upd-3", stage: "monitoring", text: "A fix is in place." });
    const posts = slackPosts({
      before: incident({ updates: [told] }),
      after: incident({ updates: [told, draftOne, draftTwo] }),
      told: ["upd-1"],
      now: NOW,
    });

    expect(typesOf(posts)).toEqual(["incident.updated", "incident.updated"]);
  });
});

describe("renderPreview", () => {
  const rendered = renderPreview({
    before: undefined,
    after: incident({
      updates: [update({ nextUpdateBy: "2026-11-04T12:00:00.000Z" })],
    }),
    told: [],
    now: NOW,
  });

  it("shows the page card with the names the page uses", () => {
    expect(rendered).toContain("OUTAGE: Sign-in is slow");
    expect(rendered).toContain("Affected: Sign-in, Data intake");
    expect(rendered).toContain("Started: Nov 4, 2026, 08:30 UTC");
  });

  it("shows the newest update with its stage, time and next update", () => {
    expect(rendered).toContain("Newest update: Investigating, posted Nov 4, 2026, 09:00 UTC");
    expect(rendered).toContain("We are looking into a problem with sign-in.");
    expect(rendered).toContain("Next update by: Nov 4, 2026, 12:00 UTC");
  });

  it("shows the Slack message the publisher will send", () => {
    expect(rendered).toContain("Message 1 of 1 (incident.opened)");
    expect(rendered).toContain("Incident opened: Sign-in is slow");
    expect(rendered).toContain("Impact: outage. Affects Sign-in and Data intake.");
    expect(rendered).toContain("View the status page");
  });

  it("says Slack posts are final", () => {
    expect(rendered).toContain("Slack posts are final.");
  });

  it("picks the newest update by post time, not by position", () => {
    const older = update({ id: "upd-1", postedAt: "2026-11-04T08:40:00.000Z" });
    const newer = update({
      id: "upd-2",
      stage: "monitoring",
      postedAt: "2026-11-04T09:30:00.000Z",
      text: "A fix is in place.",
    });
    const card = renderPreview({
      before: undefined,
      after: incident({ updates: [newer, older] }),
      told: [],
      now: NOW,
    }).split("Slack (exact")[0];

    expect(card).toContain("Newest update: Monitoring");
  });

  it("shows a maintenance window instead of a start", () => {
    const card = renderPreview({ before: undefined, after: window(), told: [], now: NOW });

    expect(card).toContain("Maintenance: Database upgrade");
    expect(card).toContain("Window: Nov 5, 2026, 09:00 UTC to Nov 5, 2026, 11:00 UTC");
    expect(card).not.toContain("Started:");
  });

  it("shows when the incident was resolved", () => {
    const card = renderPreview({
      before: undefined,
      after: incident({
        resolvedAt: "2026-11-04T09:40:00.000Z",
        updates: [update({ stage: "resolved", text: "The problem is fixed." })],
      }),
      told: [],
      now: NOW,
    });

    expect(card).toContain("Resolved: Nov 4, 2026, 09:40 UTC");
    expect(card).toContain("Message 1 of 1 (incident.resolved)");
  });

  describe("the target", () => {
    const input = { before: undefined, after: incident(), told: [], now: NOW };

    it("defaults to production, whose footer has no environment line", () => {
      const text = renderPreview(input);

      expect(text).toContain("Target: prod (https://status.openjii.org)");
      expect(text).toContain("<https://status.openjii.org/|View the status page>");
      expect(text).not.toContain("Environment:");
    });

    it("uses the dev page and the environment line for dev", () => {
      const text = renderPreview({ ...input, target: "dev" });

      expect(text).toContain("Target: dev (https://status.dev.openjii.org)");
      expect(text).toContain("<https://status.dev.openjii.org/|View the status page>");
      expect(text).toContain("Environment: dev");
    });

    it("puts the target in the messages slackPosts returns", () => {
      const [post] = slackPosts({ ...input, target: "dev" });

      expect(post.event).toMatchObject({
        environment: "dev",
        pageUrl: "https://status.dev.openjii.org",
      });
    });
  });

  describe("a maintenance window at the edge of now", () => {
    function nearly(change: Partial<Incident>): string {
      return renderPreview({ before: undefined, after: window(change), told: [], now: NOW });
    }

    it("notes that the real message may be the started one", () => {
      expect(nearly({ startsAt: "2026-11-04T10:01:30.000Z" })).toContain(
        "Note: The window starts within two minutes of now. By the time the publisher reads this, the real message may be Maintenance started",
      );
      expect(nearly({ startsAt: "2026-11-04T09:58:30.000Z" })).toContain("Maintenance started");
    });

    it("notes that the real message may be the completed one", () => {
      expect(
        nearly({ startsAt: "2026-11-04T08:00:00.000Z", endsAt: "2026-11-04T10:02:00.000Z" }),
      ).toContain("the real message may be Maintenance completed");
    });

    it("says nothing about a window that is further away", () => {
      expect(nearly({ startsAt: "2026-11-04T10:02:01.000Z" })).not.toContain("Note:");
      expect(nearly({})).not.toContain("Note:");
    });

    it("says nothing about an incident", () => {
      expect(
        renderPreview({ before: undefined, after: incident(), told: [], now: NOW }),
      ).not.toContain("Note:");
    });
  });

  it("says when the publisher has nothing new to announce", () => {
    const text = renderPreview({
      before: incident(),
      after: incident(),
      told: ["upd-1"],
      now: NOW,
    });

    expect(text).toContain("No message: the publisher has nothing new to announce.");
  });
});
