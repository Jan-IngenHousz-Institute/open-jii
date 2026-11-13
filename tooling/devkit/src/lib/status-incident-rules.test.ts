import { describe, expect, it } from "vitest";

import {
  NEW_UPDATE_ID,
  checkIncident,
  draftFileSchema,
  problemsOf,
  readInput,
  requireValid,
  resolveFileSchema,
  updateFileSchema,
} from "./status-incident-rules.js";
import type { Change, RawIncident, RawUpdate } from "./status-incident-rules.js";

const NOW = new Date("2026-11-04T10:00:00.000Z");

function update(change: Partial<RawUpdate> = {}): RawUpdate {
  return {
    id: NEW_UPDATE_ID,
    stage: "investigating",
    postedAt: "2026-11-04T10:00:00.000Z",
    text: "We are looking into it.",
    ...change,
  };
}

function incident(change: Partial<RawIncident> = {}): RawIncident {
  return {
    id: "new-incident",
    title: "Sign-in is slow",
    kind: "incident",
    impact: "degraded",
    components: ["sign-in"],
    startsAt: "2026-11-04T09:00:00Z",
    updates: [update()],
    ...change,
  };
}

function maintenance(change: Partial<RawIncident> = {}): RawIncident {
  return incident({
    title: "Database upgrade",
    kind: "maintenance",
    startsAt: "2026-11-05T09:00:00Z",
    endsAt: "2026-11-05T11:00:00Z",
    updates: [update({ stage: "scheduled" })],
    ...change,
  });
}

function problems(raw: RawIncident, change?: Change): string[] {
  return problemsOf(checkIncident(raw, NOW, change));
}

describe("checkIncident", () => {
  it("accepts a first incident update", () => {
    const check = checkIncident(incident(), NOW, { action: "draft" });

    expect(problemsOf(check)).toEqual([]);
    expect(check.incident?.updates).toHaveLength(1);
  });

  it("accepts planned maintenance that starts later", () => {
    expect(problems(maintenance(), { action: "draft" })).toEqual([]);
  });

  it("names an unknown component", () => {
    const found = problems(incident({ components: ["sign-in", "billing"] }));

    expect(found).toEqual([
      expect.stringContaining('incident.components[1] "billing" is not one of'),
    ]);
    expect(found[0]).toContain("data-intake");
  });

  it("requires at least one component", () => {
    expect(problems(incident({ components: [] }))).toEqual([
      "incident.components needs at least 1 entry",
    ]);
  });

  it("rejects a stage the contract does not know", () => {
    const found = problems(incident({ updates: [update({ stage: "fixing" })] }));

    expect(found).toEqual([expect.stringContaining('update.stage "fixing" is not one of')]);
  });

  it("rejects a stage that belongs to the other kind", () => {
    expect(problems(incident({ updates: [update({ stage: "scheduled" })] }))).toEqual([
      'update.stage "scheduled" does not fit kind incident. Use one of: investigating, identified, monitoring, resolved.',
    ]);
    expect(problems(maintenance({ updates: [update({ stage: "monitoring" })] }))).toEqual([
      'update.stage "monitoring" does not fit kind maintenance. Use one of: scheduled, in-progress, completed.',
    ]);
  });

  it("reports missing and empty text", () => {
    expect(problems(incident({ updates: [update({ text: undefined })] }))).toEqual([
      "update.text is missing",
    ]);
    expect(problems(incident({ updates: [update({ text: "" })] }))).toEqual([
      "update.text is empty",
    ]);
  });

  it("reports every missing required incident field", () => {
    const found = problems(
      incident({
        title: undefined,
        kind: undefined,
        impact: undefined,
        components: undefined,
        startsAt: undefined,
      }),
    );

    expect(found.sort()).toEqual(
      [
        "incident.title is missing",
        "incident.kind is missing",
        "incident.impact is missing",
        "incident.components is missing",
        "incident.startsAt is missing",
      ].sort(),
    );
  });

  it("explains a time that is not UTC", () => {
    const found = problems(incident({ startsAt: "2026-11-04T09:00:00+01:00" }));

    expect(found).toEqual([
      'incident.startsAt "2026-11-04T09:00:00+01:00" is not a UTC time such as 2026-11-04T10:00:00Z',
    ]);
  });

  it("labels a problem in an existing update by its id", () => {
    const found = problems(incident({ updates: [update({ id: "upd-7", text: "" })] }));

    expect(found).toEqual(["update upd-7.text is empty"]);
  });

  it("splits what the publisher drops from what the guide forbids", () => {
    const check = checkIncident(
      incident({ startsAt: "2026-11-04T11:00:00Z", updates: [update({ text: "" })] }),
      NOW,
    );

    expect(check.dropped).toEqual([{ scope: "update", message: "update.text is empty" }]);
    expect(check.rules).toEqual([expect.stringContaining("incident.startsAt is in the future")]);
  });

  describe("title, text and components", () => {
    it("refuses text and a title that are only whitespace", () => {
      expect(problems(incident({ updates: [update({ text: " \n\t " })] }))).toEqual([
        "update.text is only whitespace. Write what researchers need to know.",
      ]);
      expect(problems(incident({ title: "   " }))).toEqual([
        "incident.title is only whitespace. Write what researchers see.",
      ]);
    });

    it("calls an empty text empty, once", () => {
      expect(problems(incident({ updates: [update({ text: "" })] }))).toEqual([
        "update.text is empty",
      ]);
    });

    it("allows a title of 256 characters and refuses 257", () => {
      expect(problems(incident({ title: "a".repeat(256) }))).toEqual([]);
      expect(problems(incident({ title: "a".repeat(257) }))).toEqual([
        expect.stringContaining("incident.title is 257 characters. Contentful allows 256"),
      ]);
    });

    it("refuses a component named twice", () => {
      expect(
        problems(incident({ components: ["sign-in", "platform", "sign-in", "sign-in"] })),
      ).toEqual(["incident.components lists sign-in more than once."]);
    });
  });

  describe("the publisher's reach", () => {
    it("refuses an incident that began and ended over 90 days ago, and says why", () => {
      const old = incident({
        startsAt: "2026-08-01T08:00:00Z",
        resolvedAt: "2026-08-01T09:00:00Z",
      });

      expect(problems(old)).toEqual([
        "incident.startsAt and incident.resolvedAt are both more than 90 days ago. The status publisher reads incidents from the last 90 days only, so this one would never reach the page or Slack.",
      ]);
    });

    it("allows an old incident that is still open or ended recently", () => {
      expect(problems(incident({ startsAt: "2026-06-01T08:00:00Z" }))).toEqual([]);
      expect(
        problems(
          incident({ startsAt: "2026-06-01T08:00:00Z", resolvedAt: "2026-10-30T09:00:00Z" }),
        ),
      ).toEqual([]);
    });
  });

  describe("start and end times", () => {
    it("refuses an incident that starts in the future", () => {
      expect(problems(incident({ startsAt: "2026-11-04T10:00:01Z" }))).toEqual([
        expect.stringContaining("incident.startsAt is in the future"),
      ]);
    });

    it("allows an incident that starts right now", () => {
      expect(problems(incident({ startsAt: "2026-11-04T10:00:00Z" }))).toEqual([]);
    });

    it("refuses maintenance without a planned end", () => {
      expect(problems(maintenance({ endsAt: undefined }))).toEqual([
        expect.stringContaining("incident.endsAt is missing"),
      ]);
    });

    it("lets resolved maintenance go without a planned end", () => {
      const resolved = maintenance({
        endsAt: undefined,
        startsAt: "2026-11-03T09:00:00Z",
        resolvedAt: "2026-11-03T10:00:00Z",
      });

      expect(problems(resolved)).toEqual([]);
    });

    it("refuses a planned end before the start", () => {
      expect(problems(maintenance({ endsAt: "2026-11-05T08:00:00Z" }))).toEqual([
        "incident.endsAt must be after incident.startsAt.",
      ]);
    });

    it("refuses a planned end on an incident", () => {
      expect(problems(incident({ endsAt: "2026-11-04T12:00:00Z" }))).toEqual([
        "incident.endsAt is for maintenance only. Leave it out for an incident.",
      ]);
    });

    it("refuses an incident resolved before it started", () => {
      expect(problems(incident({ resolvedAt: "2026-11-04T08:00:00Z" }))).toEqual([
        "incident.resolvedAt is before incident.startsAt.",
      ]);
    });

    it("lets cancelled maintenance resolve before its start", () => {
      const cancelled = maintenance({
        resolvedAt: "2026-11-04T09:00:00Z",
        updates: [update({ stage: "completed" })],
      });

      expect(problems(cancelled)).toEqual([]);
    });
  });

  describe("the added update's own times", () => {
    const draft: Change = { action: "draft" };

    it("refuses a next update time that has passed", () => {
      const found = problems(
        incident({
          updates: [
            update({ postedAt: "2026-11-04T09:00:00Z", nextUpdateBy: "2026-11-04T09:30:00Z" }),
          ],
        }),
        draft,
      );

      expect(found).toEqual([
        "update.nextUpdateBy is in the past. Give a time you can keep, or leave it out.",
      ]);
    });

    it("refuses a post time before the incident began", () => {
      const found = problems(
        incident({ updates: [update({ postedAt: "2026-11-04T08:59:00Z" })] }),
        draft,
      );

      expect(found).toEqual([
        "update.postedAt is before incident.startsAt. An update cannot be posted before the incident began.",
      ]);
    });

    it("lets a scheduled maintenance update precede the window and no other stage", () => {
      expect(problems(maintenance(), draft)).toEqual([]);
      expect(problems(maintenance({ updates: [update({ stage: "in-progress" })] }), draft)).toEqual(
        [expect.stringContaining("update.postedAt is before incident.startsAt")],
      );
    });

    it("leaves existing updates alone", () => {
      const old = update({
        id: "upd-1",
        postedAt: "2026-11-04T08:00:00Z",
        nextUpdateBy: "2026-11-04T09:00:00Z",
      });

      expect(problems(incident({ updates: [old] }), { action: "publish" })).toEqual([]);
    });
  });

  describe("next update", () => {
    it("must come after the post", () => {
      const found = problems(
        incident({ updates: [update({ nextUpdateBy: "2026-11-04T09:59:00Z" })] }),
      );

      expect(found).toEqual(["update.nextUpdateBy must be after update.postedAt."]);
    });

    it("stays empty on the final stage", () => {
      const resolved = incident({
        resolvedAt: "2026-11-04T09:30:00Z",
        updates: [update({ stage: "resolved", nextUpdateBy: "2026-11-04T12:00:00Z" })],
      });

      expect(problems(resolved)).toEqual([
        "update.nextUpdateBy must be empty on the final stage resolved.",
      ]);
    });
  });

  describe("draft", () => {
    const draft: Change = { action: "draft" };

    it("refuses a post time in the future", () => {
      const found = problems(
        incident({ updates: [update({ postedAt: "2026-11-04T10:30:00Z" })] }),
        draft,
      );

      expect(found).toEqual(["update.postedAt is in the future. Leave it out to post now."]);
    });

    it("needs resolvedAt for a final stage", () => {
      expect(problems(incident({ updates: [update({ stage: "resolved" })] }), draft)).toEqual([
        'update.stage "resolved" needs incident.resolvedAt, which is not set.',
      ]);
    });

    it("needs a final stage once resolvedAt is set", () => {
      const found = problems(incident({ resolvedAt: "2026-11-04T09:30:00Z" }), draft);

      expect(found).toEqual([
        "incident.resolvedAt is set, so update.stage must be resolved or completed.",
      ]);
    });

    it("accepts a problem reported after it was over", () => {
      const afterwards = incident({
        resolvedAt: "2026-11-04T09:30:00Z",
        updates: [update({ stage: "resolved" })],
      });

      expect(problems(afterwards, draft)).toEqual([]);
    });

    it("refuses a resolvedAt that has not come yet", () => {
      const found = problems(
        incident({
          resolvedAt: "2026-11-04T11:00:00Z",
          updates: [update({ stage: "resolved" })],
        }),
        draft,
      );

      expect(found).toEqual([expect.stringContaining("incident.resolvedAt is in the future")]);
    });
  });

  describe("update", () => {
    it("refuses a final stage, which belongs to resolve", () => {
      const before = incident({ updates: [] });
      const after = incident({ updates: [update({ stage: "resolved" })] });

      expect(problems(after, { action: "update", before })).toEqual([
        'update.stage "resolved" ends the incident. Use the resolve action instead.',
      ]);
    });

    function linked(count: number): RawUpdate[] {
      return Array.from({ length: count }, (_, index) =>
        update({ id: `upd-${index}`, postedAt: "2026-11-04T09:00:00Z" }),
      );
    }

    it("keeps the last place for the update that resolves", () => {
      const before = incident({ updates: linked(19) });
      const after = incident({ updates: [...before.updates, update()] });

      expect(problems(after, { action: "update", before })).toEqual([
        expect.stringMatching(
          /already links 19 updates\. It links 20 at most.*Use the resolve action now.*draft a new one/,
        ),
      ]);
    });

    it("takes an update while two places are left", () => {
      const before = incident({ updates: linked(18) });
      const after = incident({ updates: [...before.updates, update()] });

      expect(problems(after, { action: "update", before })).toEqual([]);
    });

    it("warns when the update is dated before the newest existing one", () => {
      const before = incident({
        updates: [update({ id: "upd-1", postedAt: "2026-11-04T09:30:00Z" })],
      });
      const after = incident({
        updates: [...before.updates, update({ postedAt: "2026-11-04T09:10:00Z" })],
      });

      const check = checkIncident(after, NOW, { action: "update", before });

      expect(problemsOf(check)).toEqual([]);
      expect(check.warnings).toEqual([
        expect.stringContaining("2026-11-04T09:10:00Z is earlier than the newest existing update"),
      ]);
    });

    it("does not warn when the update is the newest", () => {
      const before = incident({
        updates: [update({ id: "upd-1", postedAt: "2026-11-04T09:30:00Z" })],
      });
      const after = incident({ updates: [...before.updates, update()] });

      expect(checkIncident(after, NOW, { action: "update", before }).warnings).toEqual([]);
    });
  });

  describe("resolve", () => {
    it("accepts the final stage with a resolvedAt", () => {
      const before = incident({ updates: [] });
      const after = incident({
        resolvedAt: "2026-11-04T09:45:00Z",
        updates: [update({ stage: "resolved" })],
      });

      expect(problems(after, { action: "resolve", before })).toEqual([]);
    });

    it("still has a place at nineteen links and none at twenty", () => {
      const links = (count: number) =>
        Array.from({ length: count }, (_, index) =>
          update({ id: `upd-${index}`, postedAt: "2026-11-04T09:00:00Z" }),
        );
      const resolved = (existing: RawUpdate[]) =>
        incident({
          resolvedAt: "2026-11-04T09:45:00Z",
          updates: [...existing, update({ stage: "resolved" })],
        });

      expect(
        problems(resolved(links(19)), {
          action: "resolve",
          before: incident({ updates: links(19) }),
        }),
      ).toEqual([]);
      expect(
        problems(resolved(links(20)), {
          action: "resolve",
          before: incident({ updates: links(20) }),
        }),
      ).toEqual([
        expect.stringMatching(/already links 20 updates, the most it can hold.*unlink one older/),
      ]);
    });

    it("refuses a stage that does not end it", () => {
      const before = incident({ updates: [] });
      const after = incident({
        resolvedAt: "2026-11-04T09:45:00Z",
        updates: [update({ stage: "monitoring" })],
      });

      expect(problems(after, { action: "resolve", before })).toEqual([
        'update.stage "monitoring" cannot resolve. Use resolved, or completed for maintenance.',
      ]);
    });

    it("refuses an incident that is already resolved", () => {
      const before = incident({ updates: [], resolvedAt: "2026-11-04T09:30:00Z" });
      const after = incident({
        resolvedAt: "2026-11-04T09:45:00Z",
        updates: [update({ stage: "resolved" })],
      });

      expect(problems(after, { action: "resolve", before })).toEqual([
        "The incident is already resolved at 2026-11-04T09:30:00Z. Add an update instead.",
      ]);
    });

    it("refuses a resolvedAt that has not come yet", () => {
      const before = incident({ updates: [] });
      const after = incident({
        resolvedAt: "2026-11-04T10:30:00Z",
        updates: [update({ stage: "resolved" })],
      });

      expect(problems(after, { action: "resolve", before })).toEqual([
        expect.stringContaining("incident.resolvedAt is in the future"),
      ]);
    });
  });

  describe("publish", () => {
    it("needs at least one update", () => {
      expect(problems(incident({ updates: [] }), { action: "publish" })).toEqual([
        "The incident has no updates. Link the first update before the first publish.",
      ]);
    });

    it("refuses more than twenty links, whatever was found", () => {
      expect(problems(incident(), { action: "publish", linked: 21 })).toEqual([
        expect.stringMatching(/links 21 updates, but it holds 20 at most.*unlink the 1 oldest/),
      ]);
      expect(problems(incident(), { action: "publish", linked: 20 })).toEqual([]);
    });

    it("does not hold an old update to the post-time rules", () => {
      const old = update({ id: "upd-1", postedAt: "2026-11-04T10:30:00Z" });

      expect(problems(incident({ updates: [old] }), { action: "publish" })).toEqual([]);
    });
  });
});

describe("requireValid", () => {
  it("returns the contract incident when nothing is wrong", () => {
    expect(requireValid(checkIncident(incident(), NOW)).title).toBe("Sign-in is slow");
  });

  it("lists every problem in one error", () => {
    const check = checkIncident(
      incident({ components: ["billing"], startsAt: "2026-11-04T11:00:00Z" }),
      NOW,
    );

    expect(() => requireValid(check)).toThrow(/nothing was sent[\s\S]*billing[\s\S]*future/);
  });
});

describe("file schemas", () => {
  const file = {
    incident: {
      title: "Sign-in is slow",
      kind: "incident",
      impact: "degraded",
      components: ["sign-in"],
      startsAt: "2026-11-04T09:00:00Z",
    },
    update: { stage: "investigating", text: "We are looking into it." },
  };

  it("reads a draft file", () => {
    expect(readInput(draftFileSchema, file)).toEqual(file);
  });

  it("rejects a misspelt key instead of ignoring it", () => {
    const typo = { ...file, incident: { ...file.incident, startAt: "2026-11-04T09:00:00Z" } };

    expect(() => readInput(draftFileSchema, typo)).toThrow(/incident: Unrecognized key/);
  });

  it("names a missing key", () => {
    const { text: _text, ...withoutText } = file.update;

    expect(() => readInput(draftFileSchema, { ...file, update: withoutText })).toThrow(
      /update\.text: .*string/,
    );
  });

  it("takes an optional incident block in update files", () => {
    expect(readInput(updateFileSchema, { update: file.update }).incident).toBeUndefined();
    expect(readInput(updateFileSchema, file).incident?.title).toBe("Sign-in is slow");
  });

  it("keeps resolvedAt out of the incident block and at the top of a resolve file", () => {
    const resolve = { resolvedAt: "2026-11-04T09:45:00Z", update: file.update };

    expect(readInput(resolveFileSchema, resolve).resolvedAt).toBe("2026-11-04T09:45:00Z");
    expect(() =>
      readInput(resolveFileSchema, {
        ...resolve,
        incident: { ...file.incident, resolvedAt: "2026-11-04T09:45:00Z" },
      }),
    ).toThrow(/Unrecognized key/);
  });
});
