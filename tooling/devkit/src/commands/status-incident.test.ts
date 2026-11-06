import { describe, expect, it, vi } from "vitest";
import { z } from "zod";

import type { ContentfulConfig } from "../lib/contentful-management.js";
import { parseCommandLine, preflight, statusIncident } from "./status-incident.js";
import type { Deps, Options, Result } from "./status-incident.js";

const NOW = new Date("2026-11-04T10:00:00.000Z");
const TOKEN = "secret-token";
const config: ContentfulConfig = { space: "space", environment: "master", token: TOKEN };

interface Stored {
  sys: {
    id: string;
    version: number;
    publishedVersion?: number | undefined;
    contentType: { sys: { id: string } };
  };
  fields: Partial<Record<string, Record<string, unknown>>>;
  metadata?: unknown;
}

const writeBodySchema = z.object({
  fields: z.record(z.string(), z.record(z.string(), z.unknown())),
});

function urlString(input: Parameters<typeof fetch>[0]): string {
  return input instanceof Request ? input.url : input.toString();
}

function inspection(result: Result) {
  if (!("incidents" in result)) {
    throw new Error("Expected an inspection");
  }
  return result;
}

function drafted(result: Result) {
  if (!("drafted" in result)) {
    throw new Error("Expected a drafted result");
  }
  return result;
}

function publishDryRun(result: Result) {
  if (!("readsContentful" in result)) {
    throw new Error("Expected a publish dry run");
  }
  return result;
}

interface Call {
  method: string;
  path: string;
  search: URLSearchParams;
  headers: Headers;
  body: unknown;
}

function stored(
  id: string,
  type: string,
  fields: Record<string, unknown>,
  sys: { version?: number; publishedVersion?: number | undefined; archivedVersion?: number } = {},
): Stored {
  return {
    sys: { id, version: 2, publishedVersion: 1, contentType: { sys: { id: type } }, ...sys },
    fields: Object.fromEntries(
      Object.entries(fields).map(([key, value]) => [key, { "en-US": value }]),
    ),
  };
}

function link(id: string) {
  return { sys: { type: "Link", linkType: "Entry", id } };
}

function liveUpdate(id = "upd-1", fields: Record<string, unknown> = {}, sys = {}): Stored {
  return stored(
    id,
    "statusUpdate",
    {
      stage: "investigating",
      postedAt: "2026-11-04T08:00:00Z",
      text: "We are looking into it.",
      nextUpdateBy: "2026-11-04T09:30:00Z",
      ...fields,
    },
    sys,
  );
}

function liveIncident(fields: Record<string, unknown> = {}, sys = {}): Stored {
  return stored(
    "inc-1",
    "statusIncident",
    {
      title: "Sign-in is slow",
      kind: "incident",
      impact: "degraded",
      components: ["sign-in"],
      startsAt: "2026-11-04T07:50:00Z",
      updates: [link("upd-1")],
      ...fields,
    },
    sys,
  );
}

function liveWindow(fields: Record<string, unknown> = {}, sys = {}): Stored {
  return liveIncident(
    {
      title: "Database upgrade",
      kind: "maintenance",
      components: ["platform"],
      startsAt: "2026-11-04T09:00:00Z",
      endsAt: "2026-11-04T12:00:00Z",
      ...fields,
    },
    sys,
  );
}

const draftState = { version: 1, publishedVersion: undefined };

function withLinkedUpdates(count: number): Stored[] {
  const updates = Array.from({ length: count }, (_, index) =>
    liveUpdate(`upd-${index}`, { postedAt: "2026-11-04T07:55:00Z" }),
  );

  return [...updates, liveIncident({ updates: updates.map((update) => link(update.sys.id)) })];
}

function createContentful(initial: Stored[]) {
  const entries = new Map(initial.map((entry) => [entry.sys.id, structuredClone(entry)]));
  const calls: Call[] = [];
  let created = 0;

  function reply(body: unknown, status = 200): Response {
    return Response.json(body, { status });
  }

  function refuse(status: number, id: string, message: string): Response {
    return reply({ sys: { type: "Error", id }, message }, status);
  }

  function list(search: URLSearchParams): Response {
    const ids = search.get("sys.id[in]")?.split(",");
    const since = search.get("fields.resolvedAt[gte]");
    const isOpenOnly = search.get("fields.resolvedAt[exists]") === "false";

    const items = [...entries.values()].filter((entry) => {
      const resolvedAt = entry.fields.resolvedAt?.["en-US"];
      const typeMatches = entry.sys.contentType.sys.id === search.get("content_type");
      const idMatches = ids === undefined || ids.includes(entry.sys.id);
      const openMatches = !isOpenOnly || resolvedAt === undefined;
      const sinceMatches =
        since === null || (typeof resolvedAt === "string" && resolvedAt >= since);
      return typeMatches && idMatches && openMatches && sinceMatches;
    });

    return reply({ total: items.length, items });
  }

  function respond(call: Call): Response {
    const segments = call.path.split("/");
    const collection = segments.at(0);
    const id = segments.at(1);
    const action = segments.at(2);

    if (call.method === "GET") {
      if (id === undefined) {
        return list(call.search);
      }
      const found = entries.get(id);
      return found ? reply(found) : refuse(404, "NotFound", "The resource could not be found.");
    }
    if (call.method === "POST" && collection === "entries") {
      created += 1;
      const type = call.headers.get("X-Contentful-Content-Type") ?? "";
      const entry: Stored = {
        sys: { id: `new-${created}`, version: 1, contentType: { sys: { id: type } } },
        fields: writeBodySchema.parse(call.body).fields,
      };
      entries.set(entry.sys.id, entry);
      return reply(entry, 201);
    }

    const entry = id === undefined ? undefined : entries.get(id);
    if (!entry) {
      return refuse(404, "NotFound", "The resource could not be found.");
    }
    if (call.headers.get("X-Contentful-Version") !== String(entry.sys.version)) {
      return refuse(409, "VersionMismatch", "Version mismatch error.");
    }
    if (action === "published") {
      entry.sys.publishedVersion = entry.sys.version;
      entry.sys.version += 1;
      return reply(entry);
    }

    entry.fields = writeBodySchema.parse(call.body).fields;
    entry.sys.version += 1;
    return reply(entry);
  }

  const request = vi.fn<typeof fetch>((input, init) => {
    const url = new URL(urlString(input));
    const call: Call = {
      method: init?.method ?? "GET",
      path: url.pathname.replace(/^\/spaces\/space\/environments\/[^/]+\//, ""),
      search: url.searchParams,
      headers: new Headers(init?.headers),
      body: typeof init?.body === "string" ? JSON.parse(init.body) : undefined,
    };
    calls.push(call);
    return Promise.resolve(respond(call));
  });

  return {
    request,
    calls,
    call: (index: number): Call => {
      const found = calls.at(index);
      if (!found) {
        throw new Error(`No request ${index}`);
      }
      return found;
    },
    entries,
    summary: () => calls.map((call) => `${call.method} ${call.path}`),
    writes: () => calls.filter((call) => call.method !== "GET"),
  };
}

function setup(initial: Stored[] = [], settings: ContentfulConfig = config) {
  const cms = createContentful(initial);
  const chunks: string[] = [];
  const deps: Deps = {
    request: cms.request,
    write: (text) => void chunks.push(text),
    now: () => NOW,
  };
  const run = (options: Options): Promise<Result> => statusIncident(options, settings, deps);

  async function reviewOf(entryId: string): Promise<string> {
    const result = await run({ action: "publish", entryId, dryRun: true });
    return publishDryRun(result).review.token;
  }

  return { cms, deps, run, reviewOf, printed: () => chunks.join("") };
}

const draftFile = {
  incident: {
    title: "Uploads from the field app are delayed",
    kind: "incident",
    impact: "degraded",
    components: ["data-intake"],
    startsAt: "2026-11-04T09:00:00Z",
  },
  update: {
    stage: "investigating",
    text: "We are looking into a problem with uploads from the field app.",
    nextUpdateBy: "2026-11-04T12:00:00Z",
  },
};

const maintenanceFile = {
  incident: {
    title: "Database upgrade",
    kind: "maintenance",
    impact: "degraded",
    components: ["platform"],
    startsAt: "2026-11-05T09:00:00Z",
    endsAt: "2026-11-05T11:00:00Z",
  },
  update: { stage: "scheduled", text: "Planned work on the platform." },
};

const updateFile = {
  update: { stage: "identified", text: "We know what is wrong.", postedAt: "2026-11-04T09:45:00Z" },
};

const resolveFile = {
  resolvedAt: "2026-11-04T09:50:00Z",
  update: { stage: "resolved", text: "The problem is fixed." },
};

describe("preflight", () => {
  it("prints booleans and the environment name only", () => {
    const result = preflight(config);

    expect(result).toEqual({
      CONTENTFUL_SPACE_ID: true,
      CONTENTFUL_SPACE_ENVIRONMENT: true,
      managementToken: true,
      environment: "master",
      warnings: [],
    });
    expect(JSON.stringify(result)).not.toContain(TOKEN);
  });

  it("shows what is missing without a name", () => {
    expect(preflight({ space: "", environment: "", token: "" })).toMatchObject({
      CONTENTFUL_SPACE_ID: false,
      CONTENTFUL_SPACE_ENVIRONMENT: false,
      managementToken: false,
      environment: null,
    });
  });

  it("warns when the environment is not the one the publisher reads", () => {
    expect(preflight({ ...config, environment: "staging" }).warnings).toEqual([
      expect.stringContaining('"staging" is not "master"'),
    ]);
  });

  it("makes no request", async () => {
    const { cms, run } = setup();

    await run({ action: "preflight" });

    expect(cms.request).not.toHaveBeenCalled();
  });
});

describe("inspect", () => {
  it("lists open and recently resolved incidents with their updates and state", async () => {
    const { cms, run } = setup([
      liveUpdate(),
      liveUpdate("upd-2", {
        stage: "resolved",
        postedAt: "2026-11-02T10:00:00Z",
        nextUpdateBy: undefined,
      }),
      liveIncident(),
      stored("inc-2", "statusIncident", {
        title: "Exports failed",
        kind: "incident",
        impact: "outage",
        components: ["exports"],
        startsAt: "2026-11-02T08:00:00Z",
        resolvedAt: "2026-11-02T10:00:00Z",
        updates: [link("upd-2")],
      }),
    ]);

    const result = await run({ action: "inspect" });

    expect(cms.writes()).toEqual([]);
    expect(result).toMatchObject({
      environment: "master",
      warnings: [],
      incidents: [
        {
          id: "inc-1",
          title: "Sign-in is slow",
          kind: "incident",
          impact: "degraded",
          components: ["sign-in"],
          startsAt: "2026-11-04T07:50:00.000Z",
          state: "published",
          version: 2,
          updates: [
            {
              id: "upd-1",
              stage: "investigating",
              postedAt: "2026-11-04T08:00:00.000Z",
              state: "published",
              version: 2,
            },
          ],
          flags: [],
        },
        { id: "inc-2", resolvedAt: "2026-11-02T10:00:00.000Z", flags: [] },
      ],
    });
  });

  it.each([
    ["a draft", draftState, "The incident is a draft."],
    [
      "an archived",
      { version: 4, publishedVersion: undefined, archivedVersion: 3 },
      "The incident is archived.",
    ],
    ["a changed", { version: 4, publishedVersion: 2 }, "The incident has unpublished changes."],
  ])(
    "flags %s incident, which the page leaves out or shows as last published",
    async (_name, sys, flag) => {
      const { run } = setup([liveUpdate(), liveIncident({}, sys)]);

      const result = await run({ action: "inspect" });

      expect(result).toMatchObject({ incidents: [{ flags: [expect.stringContaining(flag)] }] });
    },
  );

  it("asks for open incidents and those resolved in the last 90 days", async () => {
    const { cms, run } = setup();

    await run({ action: "inspect" });

    const open = cms.call(0);
    const recent = cms.call(1);
    expect(open.search.get("fields.resolvedAt[exists]")).toBe("false");
    expect(recent.search.get("fields.resolvedAt[gte]")).toBe("2026-08-06T10:00:00.000Z");
    expect(open.search.get("content_type")).toBe("statusIncident");
  });

  describe("the order", () => {
    function incidentAt(id: string, startsAt: string | undefined): Stored {
      const entry = liveIncident({ startsAt });
      return { ...entry, sys: { ...entry.sys, id } };
    }

    const oldest = incidentAt("oldest", "2026-11-01T08:00:00Z");
    const middle = incidentAt("middle", "2026-11-02T08:00:00Z");
    const newest = incidentAt("newest", "2026-11-03T08:00:00Z");
    const unstarted = incidentAt("unstarted", undefined);

    it.each([
      ["missing start first", [unstarted, oldest, newest, middle]],
      ["missing start between", [oldest, unstarted, newest, middle]],
    ])(
      "lists newest first and an incident with no start last, given %s",
      async (_name, entries) => {
        const { run } = setup([liveUpdate(), ...entries]);

        const result = await run({ action: "inspect" });

        expect(result).toMatchObject({
          incidents: [{ id: "newest" }, { id: "middle" }, { id: "oldest" }, { id: "unstarted" }],
        });
      },
    );
  });

  it("reports draft, published and changed states", async () => {
    const { run } = setup([
      liveUpdate("upd-draft", {}, draftState),
      liveUpdate("upd-changed", {}, { version: 5, publishedVersion: 3 }),
      liveIncident(
        { updates: [link("upd-draft"), link("upd-changed")] },
        { version: 4, publishedVersion: 2 },
      ),
    ]);

    const result = await run({ action: "inspect" });

    expect(result).toMatchObject({
      incidents: [
        {
          state: "changed",
          updates: [
            { id: "upd-draft", state: "draft" },
            { id: "upd-changed", state: "changed" },
          ],
        },
      ],
    });
  });

  it("flags a linked update that is unpublished", async () => {
    const { run } = setup([
      liveUpdate("upd-draft", {}, draftState),
      liveUpdate("upd-changed", {}, { version: 5, publishedVersion: 3 }),
      liveIncident({ updates: [link("upd-draft"), link("upd-changed")] }),
    ]);

    const result = await run({ action: "inspect" });

    expect(result).toMatchObject({
      incidents: [
        {
          flags: [
            "update upd-draft is a draft. The publisher cannot read it, so the page leaves it out.",
            "update upd-changed has unpublished changes. The page shows its last published text.",
          ],
        },
      ],
    });
  });

  it("flags a linked update that cannot be found", async () => {
    const { run } = setup([liveIncident({ updates: [link("upd-gone")] })]);

    const result = await run({ action: "inspect" });

    expect(result).toMatchObject({
      incidents: [
        {
          flags: ["update upd-gone is linked but was not found, so the publisher cannot read it."],
        },
      ],
    });
  });

  it("flags what the publisher would drop", async () => {
    const { run } = setup([
      liveUpdate("upd-empty", { text: "" }),
      liveIncident({
        title: undefined,
        components: ["sign-in", "billing"],
        updates: [link("upd-empty")],
      }),
    ]);

    const result = await run({ action: "inspect" });

    const flags = inspection(result).incidents.flatMap((incident) => incident.flags);
    expect(flags).toContain("The publisher drops this incident: incident.title is missing");
    expect(flags).toContain("The publisher drops this update: update upd-empty.text is empty");
    expect(flags.join("\n")).toContain(
      'The publisher drops this incident: incident.components[1] "billing"',
    );
  });

  it("flags a missing required field", async () => {
    const { run } = setup([liveUpdate(), liveIncident({ impact: undefined, startsAt: undefined })]);

    const result = await run({ action: "inspect" });

    const flags = inspection(result).incidents.flatMap((incident) => incident.flags);
    expect(flags).toContain("The publisher drops this incident: incident.impact is missing");
    expect(flags).toContain("The publisher drops this incident: incident.startsAt is missing");
  });

  it("flags an incident that starts in the future", async () => {
    const { run } = setup([liveUpdate(), liveIncident({ startsAt: "2026-11-04T11:00:00Z" })]);

    const result = await run({ action: "inspect" });

    expect(result).toMatchObject({
      incidents: [{ flags: [expect.stringContaining("incident.startsAt is in the future")] }],
    });
  });

  it("lets planned maintenance start in the future", async () => {
    const { run } = setup([
      liveUpdate("upd-1", { stage: "scheduled" }),
      liveWindow({ startsAt: "2026-11-05T09:00:00Z", endsAt: "2026-11-05T11:00:00Z" }),
    ]);

    const result = await run({ action: "inspect" });

    expect(result).toMatchObject({ incidents: [{ flags: [] }] });
  });

  it("warns when the environment is not master", async () => {
    const { run } = setup([], { ...config, environment: "staging" });

    const result = await run({ action: "inspect" });

    expect(result).toMatchObject({
      environment: "staging",
      warnings: [expect.stringContaining("status publisher reads master only")],
    });
  });

  it("refuses to run without credentials and makes no request", async () => {
    const { cms, run } = setup([], { ...config, token: "" });

    await expect(run({ action: "inspect" })).rejects.toThrow("CONTENTFUL_MANAGEMENT_TOKEN or CMA");
    expect(cms.request).not.toHaveBeenCalled();
  });
});

describe("draft", () => {
  it("makes zero requests on a dry run, even without credentials", async () => {
    const { cms, run } = setup([], { space: "", environment: "", token: "" });

    const result = await run({ action: "draft", input: draftFile, dryRun: true });

    expect(result).toEqual({ dryRun: true, networkRequests: 0, action: "draft", warnings: [] });
    expect(cms.request).not.toHaveBeenCalled();
  });

  it("prints the page card and the exact Slack message before anything is sent", async () => {
    const { run, printed } = setup();

    await run({ action: "draft", input: draftFile, dryRun: true });

    expect(printed()).toContain("DEGRADED: Uploads from the field app are delayed");
    expect(printed()).toContain("Affected: Data intake");
    expect(printed()).toContain("Message 1 of 1 (incident.opened)");
    expect(printed()).toContain("Incident opened: Uploads from the field app are delayed");
    expect(printed()).toContain("Slack posts are final.");
  });

  it("previews planned maintenance as scheduled", async () => {
    const { run, printed } = setup();

    await run({ action: "draft", input: maintenanceFile, dryRun: true });

    expect(printed()).toContain("Message 1 of 1 (maintenance.scheduled)");
    expect(printed()).toContain("Planned window:");
  });

  it("previews an incident posted after it was over as resolved", async () => {
    const { run, printed } = setup();
    const afterwards = {
      incident: { ...draftFile.incident, resolvedAt: "2026-11-04T09:30:00Z" },
      update: { stage: "resolved", text: "The problem was fixed." },
    };

    await run({ action: "draft", input: afterwards, dryRun: true });

    expect(printed()).toContain("Message 1 of 1 (incident.resolved)");
  });

  it("creates the update draft first and the incident draft second, and publishes nothing", async () => {
    const { cms, run } = setup();

    const result = await run({ action: "draft", input: draftFile, dryRun: false });

    expect(cms.summary()).toEqual(["POST entries", "POST entries"]);
    expect(cms.calls.map((call) => call.headers.get("X-Contentful-Content-Type"))).toEqual([
      "statusUpdate",
      "statusIncident",
    ]);
    expect(cms.summary().some((line) => line.endsWith("/published"))).toBe(false);
    expect(result).toMatchObject({
      drafted: true,
      incident: { id: "new-2", version: 1, state: "draft" },
      update: { id: "new-1", version: 1 },
    });
    expect(drafted(result).next).toContain(
      `publish --entry-id new-2 --review ${drafted(result).review.token} --environment <environment>`,
    );
  });

  it("ends with a review token beside the list of what it covers", async () => {
    const { run } = setup();

    const result = drafted(await run({ action: "draft", input: draftFile, dryRun: false }));

    expect(result.review.token).toMatch(/^[0-9a-f]{12}$/);
    expect(result.review.covers).toEqual([
      "incident new-2, saved version 1",
      "update new-1, saved version 1",
    ]);
  });

  it("says that running draft again creates a second incident", async () => {
    const { run } = setup();

    const result = drafted(await run({ action: "draft", input: draftFile, dryRun: false }));

    expect(result.note).toBe(
      "Running draft again creates a second incident. Run inspect to see what exists.",
    );
  });

  it("writes en-US fields, defaults the post time to now and links the update", async () => {
    const { cms, run } = setup();

    await run({ action: "draft", input: draftFile, dryRun: false });

    const updateCall = cms.call(0);
    const incidentCall = cms.call(1);
    expect(updateCall.body).toEqual({
      fields: {
        stage: { "en-US": "investigating" },
        postedAt: { "en-US": "2026-11-04T10:00:00.000Z" },
        text: { "en-US": "We are looking into a problem with uploads from the field app." },
        nextUpdateBy: { "en-US": "2026-11-04T12:00:00Z" },
      },
    });
    expect(incidentCall.body).toEqual({
      fields: {
        title: { "en-US": "Uploads from the field app are delayed" },
        kind: { "en-US": "incident" },
        impact: { "en-US": "degraded" },
        components: { "en-US": ["data-intake"] },
        startsAt: { "en-US": "2026-11-04T09:00:00Z" },
        updates: { "en-US": [link("new-1")] },
      },
    });
  });

  it("sends the management token as a bearer header to the CMA of the chosen environment", async () => {
    const { cms, run } = setup();

    await run({ action: "draft", input: draftFile, dryRun: false });

    expect(cms.request.mock.calls[0]?.[0]).toBe(
      "https://api.contentful.com/spaces/space/environments/master/entries",
    );
    expect(cms.call(0).headers.get("Authorization")).toBe(`Bearer ${TOKEN}`);
  });

  it("names the unlinked update draft when the incident cannot be created", async () => {
    const { cms, run } = setup();
    cms.request
      .mockResolvedValueOnce(
        Response.json(
          {
            sys: { id: "upd-9", version: 1, contentType: { sys: { id: "statusUpdate" } } },
            fields: {},
          },
          { status: 201 },
        ),
      )
      .mockResolvedValueOnce(
        Response.json(
          { sys: { type: "Error", id: "ValidationFailed" }, message: `Bad field ${TOKEN}` },
          { status: 422 },
        ),
      );

    const failure = await run({ action: "draft", input: draftFile, dryRun: false }).catch(
      (error: unknown) => error,
    );

    expect(failure).toBeInstanceOf(Error);
    expect(String(failure)).toContain("returned 422 ValidationFailed");
    expect(String(failure)).toContain("update draft upd-9 is not linked, so delete it");
    expect(String(failure)).not.toContain(TOKEN);
  });

  describe("after the incident write fails", () => {
    function timeoutAfterApplying(cms: ReturnType<typeof createContentful>, apply: boolean) {
      const original = cms.request.getMockImplementation();
      let sent = 0;
      cms.request.mockImplementation(async (input, init) => {
        sent += 1;
        const isIncidentWrite = sent === 2 && init?.method === "POST";
        if (isIncidentWrite && original) {
          if (apply) await original(input, init);
          throw new Error(`timeout ${TOKEN}`);
        }
        return original ? original(input, init) : fetch(input, init);
      });
    }

    it("reads back and does not tell anyone to delete an update the incident links", async () => {
      const { cms, run } = setup();
      timeoutAfterApplying(cms, true);

      const failure = await run({ action: "draft", input: draftFile, dryRun: false }).catch(
        (error: unknown) => String(error),
      );

      expect(failure).toContain("The write went through anyway: incident new-2");
      expect(failure).toContain("links update new-1, so do not delete that update");
      expect(failure).toContain("publish --entry-id new-2 --dry-run");
      expect(failure).not.toContain("delete it in Contentful");
      expect(failure).not.toContain(TOKEN);
    });

    it("advises deleting only after a read shows the update is not linked", async () => {
      const { cms, run } = setup();
      timeoutAfterApplying(cms, false);

      const failure = await run({ action: "draft", input: draftFile, dryRun: false }).catch(
        (error: unknown) => String(error),
      );

      expect(failure).toContain("update draft new-1 is not linked, so delete it in Contentful");
      expect(failure).toContain("After a timeout, wait a minute and run inspect first");
    });

    it("says to check with inspect when the read back fails too", async () => {
      const { cms, run } = setup();
      const original = cms.request.getMockImplementation();
      let sent = 0;
      cms.request.mockImplementation((input, init) => {
        sent += 1;
        if (sent >= 2) return Promise.reject(new Error("offline"));
        return original ? original(input, init) : fetch(input, init);
      });

      const failure = await run({ action: "draft", input: draftFile, dryRun: false }).catch(
        (error: unknown) => String(error),
      );

      expect(failure).toContain("Do not delete that update draft yet: run inspect");
      expect(failure).not.toContain("delete it in Contentful");
    });
  });

  it("refuses to send without credentials", async () => {
    const { cms, run } = setup([], { ...config, environment: "" });

    await expect(run({ action: "draft", input: draftFile, dryRun: false })).rejects.toThrow(
      "Missing: CONTENTFUL_SPACE_ENVIRONMENT",
    );
    expect(cms.request).not.toHaveBeenCalled();
  });

  it("warns in the preview and the result when the environment is not master", async () => {
    const { run, printed } = setup([], { ...config, environment: "staging" });

    const result = await run({ action: "draft", input: draftFile, dryRun: true });

    expect(printed()).toContain('Warning: Environment "staging" is not "master".');
    expect(result).toMatchObject({ warnings: [expect.stringContaining("staging")] });
  });

  describe("validation sends nothing", () => {
    const base = draftFile.incident;
    const text = draftFile.update;

    it.each([
      [
        "an unknown component",
        { incident: { ...base, components: ["billing"] }, update: text },
        '"billing" is not one of',
      ],
      [
        "a future incident start",
        { incident: { ...base, startsAt: "2026-11-04T10:30:00Z" }, update: text },
        "incident.startsAt is in the future",
      ],
      [
        "maintenance without an end",
        {
          incident: { ...maintenanceFile.incident, endsAt: undefined },
          update: maintenanceFile.update,
        },
        "incident.endsAt is missing",
      ],
      [
        "a bad stage",
        { incident: base, update: { ...text, stage: "fixing" } },
        'update.stage "fixing" is not one of',
      ],
      [
        "a stage of the other kind",
        { incident: base, update: { ...text, stage: "scheduled" } },
        "does not fit kind incident",
      ],
      ["missing text", { incident: base, update: { stage: "investigating" } }, "update.text: "],
      ["empty text", { incident: base, update: { ...text, text: "" } }, "update.text is empty"],
      [
        "a misspelt key",
        { incident: { ...base, startAt: "2026-11-04T09:00:00Z" }, update: text },
        "Unrecognized key",
      ],
      [
        "a time that is not UTC",
        { incident: { ...base, startsAt: "2026-11-04T09:00:00+01:00" }, update: text },
        "is not a UTC time",
      ],
      [
        "text that is only whitespace",
        { incident: base, update: { ...text, text: "   \n " } },
        "update.text is only whitespace",
      ],
      [
        "a title that is only whitespace",
        { incident: { ...base, title: "  " }, update: text },
        "incident.title is only whitespace",
      ],
      [
        "a title over 256 characters",
        { incident: { ...base, title: "a".repeat(257) }, update: text },
        "incident.title is 257 characters",
      ],
      [
        "a repeated component",
        { incident: { ...base, components: ["data-intake", "data-intake"] }, update: text },
        "incident.components lists data-intake more than once",
      ],
      [
        "an incident that began and ended over 90 days ago",
        {
          incident: {
            ...base,
            startsAt: "2026-06-01T08:00:00Z",
            resolvedAt: "2026-06-01T09:00:00Z",
          },
          update: { stage: "resolved", text: "It was fixed." },
        },
        "The status publisher reads incidents from the last 90 days only",
      ],
      [
        "a next update time in the past",
        { incident: base, update: { ...text, nextUpdateBy: "2026-11-04T09:30:00Z" } },
        "update.nextUpdateBy is in the past",
      ],
      [
        "a post time before the incident began",
        { incident: base, update: { ...text, postedAt: "2026-11-04T08:00:00Z" } },
        "update.postedAt is before incident.startsAt",
      ],
    ])("refuses %s", async (_name, input, message) => {
      for (const dryRun of [true, false]) {
        const { cms, run, printed } = setup();

        await expect(run({ action: "draft", input, dryRun })).rejects.toThrow(message);

        expect(cms.request).not.toHaveBeenCalled();
        expect(printed()).toBe("");
      }
    });

    it("accepts a title of exactly 256 characters", async () => {
      const { run } = setup();
      const input = {
        incident: { ...draftFile.incident, title: "a".repeat(256) },
        update: draftFile.update,
      };

      await expect(run({ action: "draft", input, dryRun: true })).resolves.toMatchObject({
        dryRun: true,
      });
    });

    it("lets a scheduled maintenance update precede the window", async () => {
      const { run } = setup();

      await expect(
        run({ action: "draft", input: maintenanceFile, dryRun: true }),
      ).resolves.toMatchObject({ dryRun: true });
    });

    it("refuses a later maintenance stage posted before the window", async () => {
      const { run } = setup();
      const input = {
        incident: maintenanceFile.incident,
        update: { stage: "in-progress", text: "It has started." },
      };

      await expect(run({ action: "draft", input, dryRun: true })).rejects.toThrow(
        "update.postedAt is before incident.startsAt",
      );
    });

    it("lists every problem at once", async () => {
      const { run } = setup();
      const input = {
        incident: { ...base, components: ["billing"], startsAt: "2026-11-04T10:30:00Z" },
        update: { ...text, text: "" },
      };

      await expect(run({ action: "draft", input, dryRun: true })).rejects.toThrow(
        /billing[\s\S]*empty[\s\S]*future/,
      );
    });
  });
});

describe("update", () => {
  const options: Extract<Options, { action: "update" | "resolve" }> = {
    action: "update",
    entryId: "inc-1",
    input: updateFile,
    dryRun: false,
  };

  it("reads the incident, creates the update draft, then adds it to the incident", async () => {
    const { cms, run } = setup([liveUpdate(), liveIncident()]);

    const result = await run(options);

    expect(cms.summary()).toEqual([
      "GET entries/inc-1",
      "GET entries",
      "POST entries",
      "PUT entries/inc-1",
    ]);
    expect(cms.call(2).headers.get("X-Contentful-Content-Type")).toBe("statusUpdate");
    expect(result).toMatchObject({
      drafted: true,
      incident: { id: "inc-1", version: 3, state: "changed" },
      update: { id: "new-1" },
    });
    expect(drafted(result).next).toContain(
      `publish --entry-id inc-1 --review ${drafted(result).review.token} --environment <environment>`,
    );
    expect(drafted(result).review.covers).toEqual([
      "incident inc-1, saved version 3",
      "update upd-1, saved version 1",
      "update new-1, saved version 1",
    ]);
    expect(drafted(result)).not.toHaveProperty("note");
  });

  it("keeps the other fields and links, and sends the version it read", async () => {
    const { cms, run } = setup([liveUpdate(), liveIncident()]);
    const entry = cms.entries.get("inc-1");
    if (entry) entry.metadata = { tags: [] };

    await run(options);

    const put = cms.call(3);
    expect(put.headers.get("X-Contentful-Version")).toBe("2");
    expect(put.body).toEqual({
      fields: {
        title: { "en-US": "Sign-in is slow" },
        kind: { "en-US": "incident" },
        impact: { "en-US": "degraded" },
        components: { "en-US": ["sign-in"] },
        startsAt: { "en-US": "2026-11-04T07:50:00Z" },
        updates: { "en-US": [link("upd-1"), link("new-1")] },
      },
      metadata: { tags: [] },
    });
  });

  it("previews the incident.updated message from the live incident", async () => {
    const { run, printed } = setup([liveUpdate(), liveIncident()]);

    await run(options);

    expect(printed()).toContain("Message 1 of 1 (incident.updated)");
    expect(printed()).toContain("Incident updated: Sign-in is slow");
    expect(printed()).toContain("We know what is wrong.");
  });

  it("previews maintenance.updated for a maintenance window", async () => {
    const { run, printed } = setup([liveUpdate("upd-1", { stage: "scheduled" }), liveWindow()]);

    await run({
      ...options,
      input: { update: { stage: "in-progress", text: "The work has started." } },
    });

    expect(printed()).toContain("Message 1 of 1 (maintenance.updated)");
  });

  it("previews an incident that was never published as opened", async () => {
    const { run, printed } = setup([
      liveUpdate("upd-1", {}, draftState),
      liveIncident({}, draftState),
    ]);

    await run(options);

    expect(printed()).toContain("(incident.opened)");
  });

  it("refuses an update that ends the incident and writes nothing", async () => {
    const { cms, run } = setup([liveUpdate(), liveIncident()]);

    await expect(
      run({ ...options, input: { update: { stage: "resolved", text: "Fixed." } } }),
    ).rejects.toThrow("Use the resolve action instead");

    expect(cms.writes()).toEqual([]);
  });

  it("refuses a stage that does not fit a maintenance window", async () => {
    const { cms, run } = setup([liveUpdate("upd-1", { stage: "scheduled" }), liveWindow()]);

    await expect(run(options)).rejects.toThrow("does not fit kind maintenance");

    expect(cms.writes()).toEqual([]);
  });

  it("refuses an entry that is not a status incident", async () => {
    const { cms, run } = setup([liveUpdate()]);

    await expect(run({ ...options, entryId: "upd-1" })).rejects.toThrow(
      "Entry upd-1 is a statusUpdate, not a statusIncident",
    );

    expect(cms.writes()).toEqual([]);
  });

  it("refuses an invalid entry id before any request", async () => {
    const { cms, run } = setup();

    await expect(run({ ...options, entryId: "../spaces" })).rejects.toThrow("Invalid entry ID");

    expect(cms.request).not.toHaveBeenCalled();
  });

  it("names the update draft when the incident changed in the meantime", async () => {
    const { cms, run } = setup([liveUpdate(), liveIncident()]);
    const original = cms.request.getMockImplementation();
    cms.request.mockImplementation((input, init) => {
      const isPut = init?.method === "PUT";
      const entry = cms.entries.get("inc-1");
      if (isPut && entry) entry.sys.version += 1;
      return original ? original(input, init) : fetch(input, init);
    });

    await expect(run(options)).rejects.toThrow(
      /VersionMismatch.*update draft new-1 is not linked, so delete it/,
    );
  });

  it("reads the incident back after a timed-out write and keeps a linked update", async () => {
    const { cms, run } = setup([liveUpdate(), liveIncident()]);
    const original = cms.request.getMockImplementation();
    cms.request.mockImplementation(async (input, init) => {
      if (init?.method === "PUT" && original) {
        await original(input, init);
        throw new Error("timeout");
      }
      return original ? original(input, init) : fetch(input, init);
    });

    const failure = await run(options).catch((error: unknown) => String(error));

    expect(failure).toContain("links update new-1, so do not delete that update");
    expect(failure).not.toContain("delete it in Contentful");
  });

  it("warns when the new update is dated before the newest existing one", async () => {
    const { run, printed } = setup([liveUpdate(), liveIncident()]);
    const input = {
      update: { stage: "identified", text: "Earlier.", postedAt: "2026-11-04T07:55:00Z" },
    };

    const result = await run({ ...options, input });

    expect(printed()).toContain("Warning: update.postedAt 2026-11-04T07:55:00Z is earlier");
    expect(drafted(result).warnings).toEqual([
      expect.stringContaining("will not show as the newest"),
    ]);
  });

  it("does not warn when the new update is the newest", async () => {
    const { run } = setup([liveUpdate(), liveIncident()]);

    expect(drafted(await run(options)).warnings).toEqual([]);
  });

  it("refuses the update that would take the last place, and writes nothing", async () => {
    const { cms, run } = setup(withLinkedUpdates(19));

    await expect(run(options)).rejects.toThrow(
      /already links 19 updates.*last place is kept for the update that resolves it.*resolve action/,
    );

    expect(cms.writes()).toEqual([]);
  });

  it("takes the twentieth update from an incident with eighteen", async () => {
    const { cms, run } = setup(withLinkedUpdates(18));

    await run(options);

    expect(cms.writes()).toHaveLength(2);
  });

  it("previews the dev page and environment line for --target dev", async () => {
    const { run, printed } = setup([liveUpdate(), liveIncident()]);

    await run({ ...options, target: "dev" });

    expect(printed()).toContain("Target: dev (https://status.dev.openjii.org)");
    expect(printed()).toContain("<https://status.dev.openjii.org/|View the status page>");
    expect(printed()).toContain("Environment: dev");
  });

  it("previews the production page without an environment line by default", async () => {
    const { run, printed } = setup([liveUpdate(), liveIncident()]);

    await run(options);

    expect(printed()).toContain("<https://status.openjii.org/|View the status page>");
    expect(printed()).not.toContain("Environment:");
  });

  it("makes zero requests on a dry run using the incident block in the file", async () => {
    const { cms, run, printed } = setup();
    const input = {
      incident: draftFile.incident,
      update: updateFile.update,
    };

    const result = await run({ ...options, input, dryRun: true });

    expect(result).toEqual({ dryRun: true, networkRequests: 0, action: "update", warnings: [] });
    expect(cms.request).not.toHaveBeenCalled();
    expect(printed()).toContain("Message 1 of 1 (incident.updated)");
    expect(printed()).toContain("Incident updated: Uploads from the field app are delayed");
  });

  it("explains that a dry run needs the incident block", async () => {
    const { cms, run } = setup();

    await expect(run({ ...options, dryRun: true })).rejects.toThrow("Add an incident block");

    expect(cms.request).not.toHaveBeenCalled();
  });

  it("validates a dry run against the incident block", async () => {
    const { cms, run } = setup();
    const input = {
      incident: { ...draftFile.incident, components: ["billing"] },
      update: updateFile.update,
    };

    await expect(run({ ...options, input, dryRun: true })).rejects.toThrow(
      '"billing" is not one of',
    );

    expect(cms.request).not.toHaveBeenCalled();
  });

  it("says when the incident block of a real run is ignored", async () => {
    const { run, printed } = setup([liveUpdate(), liveIncident()]);

    await run({ ...options, input: { incident: draftFile.incident, update: updateFile.update } });

    expect(printed()).toContain("the incident block in the file is ignored");
    expect(printed()).toContain("Incident updated: Sign-in is slow");
  });
});

describe("resolve", () => {
  const options: Extract<Options, { action: "update" | "resolve" }> = {
    action: "resolve",
    entryId: "inc-1",
    input: resolveFile,
    dryRun: false,
  };

  it("sets resolvedAt on the incident along with the new link", async () => {
    const { cms, run } = setup([liveUpdate(), liveIncident()]);

    const result = await run(options);

    expect(cms.summary()).toEqual([
      "GET entries/inc-1",
      "GET entries",
      "POST entries",
      "PUT entries/inc-1",
    ]);
    expect(cms.call(3).body).toMatchObject({
      fields: {
        resolvedAt: { "en-US": "2026-11-04T09:50:00Z" },
        updates: { "en-US": [link("upd-1"), link("new-1")] },
      },
    });
    expect(result).toMatchObject({ drafted: true, incident: { version: 3 } });
  });

  it("previews incident.resolved", async () => {
    const { run, printed } = setup([liveUpdate(), liveIncident()]);

    await run(options);

    expect(printed()).toContain("Message 1 of 1 (incident.resolved)");
    expect(printed()).toContain("Incident resolved: Sign-in is slow");
    expect(printed()).toContain("Resolved: Nov 4, 2026, 09:50 UTC");
  });

  it("previews maintenance.completed for a window", async () => {
    const { run, printed } = setup([liveUpdate("upd-1", { stage: "scheduled" }), liveWindow()]);

    await run({
      ...options,
      input: {
        resolvedAt: "2026-11-04T09:55:00Z",
        update: { stage: "completed", text: "The work is finished." },
      },
    });

    expect(printed()).toContain("Message 1 of 1 (maintenance.completed)");
  });

  it("refuses a stage that does not end the incident", async () => {
    const { cms, run } = setup([liveUpdate(), liveIncident()]);
    const input = {
      resolvedAt: "2026-11-04T09:50:00Z",
      update: { stage: "monitoring", text: "Watching." },
    };

    await expect(run({ ...options, input })).rejects.toThrow("cannot resolve");

    expect(cms.writes()).toEqual([]);
  });

  it("refuses an incident that is already resolved", async () => {
    const { cms, run } = setup([
      liveUpdate(),
      liveIncident({ resolvedAt: "2026-11-04T09:30:00Z" }),
    ]);

    await expect(run(options)).rejects.toThrow("already resolved");

    expect(cms.writes()).toEqual([]);
  });

  it("refuses a resolvedAt in the future", async () => {
    const { cms, run } = setup([liveUpdate(), liveIncident()]);
    const input = { ...resolveFile, resolvedAt: "2026-11-04T12:00:00Z" };

    await expect(run({ ...options, input })).rejects.toThrow(
      "incident.resolvedAt is in the future",
    );

    expect(cms.writes()).toEqual([]);
  });

  it("refuses a file without resolvedAt", async () => {
    const { cms, run } = setup([liveUpdate(), liveIncident()]);

    await expect(run({ ...options, input: { update: resolveFile.update } })).rejects.toThrow(
      "resolvedAt",
    );

    expect(cms.request).not.toHaveBeenCalled();
  });

  it("takes the resolving update at nineteen links and refuses at twenty", async () => {
    const full = setup(withLinkedUpdates(20));
    const nearlyFull = setup(withLinkedUpdates(19));

    await expect(full.run(options)).rejects.toThrow(
      /already links 20 updates, the most it can hold.*unlink one older update/,
    );
    await nearlyFull.run(options);

    expect(full.cms.writes()).toEqual([]);
    expect(nearlyFull.cms.writes()).toHaveLength(2);
  });

  it("refuses an incident that began and ended over 90 days ago", async () => {
    const { cms, run } = setup([liveUpdate(), liveIncident({ startsAt: "2026-06-01T08:00:00Z" })]);
    const input = { ...resolveFile, resolvedAt: "2026-06-01T09:00:00Z" };

    await expect(run({ ...options, input })).rejects.toThrow("last 90 days only");

    expect(cms.writes()).toEqual([]);
  });

  it("makes zero requests on a dry run", async () => {
    const { cms, run, printed } = setup();
    const input = { ...resolveFile, incident: draftFile.incident };

    const result = await run({ ...options, input, dryRun: true });

    expect(result).toMatchObject({ dryRun: true, networkRequests: 0, action: "resolve" });
    expect(cms.request).not.toHaveBeenCalled();
    expect(printed()).toContain("Message 1 of 1 (incident.resolved)");
  });
});

describe("publish", () => {
  function options(review: string): Extract<Options, { action: "publish" }> {
    return { action: "publish", entryId: "inc-1", dryRun: false, review, environment: "master" };
  }

  function drafts() {
    return [
      liveUpdate("upd-1", {}, draftState),
      liveUpdate("upd-2", { stage: "identified", postedAt: "2026-11-04T09:00:00Z" }, draftState),
      liveIncident({ updates: [link("upd-1"), link("upd-2")] }, draftState),
    ];
  }

  function failPublishOf(cms: ReturnType<typeof createContentful>, id: string): void {
    const original = cms.request.getMockImplementation();
    cms.request.mockImplementation((input, init) => {
      const isTarget = init?.method === "PUT" && urlString(input).endsWith(`${id}/published`);
      if (isTarget) {
        return Promise.resolve(
          Response.json(
            { sys: { type: "Error", id: "ValidationFailed" }, message: "Invalid." },
            { status: 422 },
          ),
        );
      }
      return original ? original(input, init) : fetch(input, init);
    });
  }

  describe("dry run", () => {
    it("reads the incident, writes nothing and prints the preview and the token", async () => {
      const { cms, run, printed } = setup(drafts());

      const result = publishDryRun(
        await run({ action: "publish", entryId: "inc-1", dryRun: true }),
      );

      expect(cms.summary()).toEqual(["GET entries/inc-1", "GET entries"]);
      expect(cms.writes()).toEqual([]);
      expect(result).toMatchObject({ dryRun: true, readsContentful: true, writes: 0 });
      expect(result.review.token).toMatch(/^[0-9a-f]{12}$/);
      expect(result.review.covers).toEqual([
        "incident inc-1, saved version 1",
        "update upd-1, saved version 1",
        "update upd-2, saved version 1",
      ]);
      expect(printed()).toContain(
        "This dry run reads Contentful, unlike the dry runs of draft, update and resolve, which read nothing.",
      );
      expect(printed()).toContain("Message 1 of 1 (incident.opened)");
    });

    it("needs neither a token nor an environment name", async () => {
      const { run } = setup(drafts());

      await expect(
        run({ action: "publish", entryId: "inc-1", dryRun: true }),
      ).resolves.toMatchObject({ dryRun: true });
    });

    it("previews the messages for an incident that was announced before", async () => {
      const { run, printed } = setup([
        liveUpdate(),
        liveUpdate("upd-2", { stage: "identified", postedAt: "2026-11-04T09:00:00Z" }, draftState),
        liveIncident(
          { updates: [link("upd-1"), link("upd-2")] },
          { version: 3, publishedVersion: 2 },
        ),
      ]);

      await run({ action: "publish", entryId: "inc-1", dryRun: true });

      expect(printed()).toContain("Message 1 of 1 (incident.updated)");
      expect(printed()).toContain("*Identified*");
    });

    it("previews the resolution when the pending update ends the incident", async () => {
      const { run, printed } = setup([
        liveUpdate(),
        liveUpdate("upd-2", { stage: "resolved", nextUpdateBy: undefined }, draftState),
        liveIncident(
          { updates: [link("upd-1"), link("upd-2")], resolvedAt: "2026-11-04T09:30:00Z" },
          { version: 3, publishedVersion: 2 },
        ),
      ]);

      await run({ action: "publish", entryId: "inc-1", dryRun: true });

      expect(printed()).toContain("Message 1 of 1 (incident.resolved)");
    });

    it("says so when the publisher has nothing new to announce", async () => {
      const { run, printed } = setup([
        liveUpdate("upd-1", { text: "Reworded." }, { version: 5, publishedVersion: 3 }),
        liveIncident({}, { version: 3, publishedVersion: 2 }),
      ]);

      await run({ action: "publish", entryId: "inc-1", dryRun: true });

      expect(printed()).toContain("No message: the publisher has nothing new to announce.");
    });

    it("uses the dev page and environment line for --target dev", async () => {
      const { run, printed } = setup(drafts());

      await run({ action: "publish", entryId: "inc-1", dryRun: true, target: "dev" });

      expect(printed()).toContain("Environment: dev");
      expect(printed()).toContain("https://status.dev.openjii.org");
    });
  });

  describe("the review token", () => {
    it("lets the reviewed state through, and writes it out", async () => {
      const { cms, run, reviewOf } = setup(drafts());
      const token = await reviewOf("inc-1");

      await run(options(token));

      expect(cms.writes()).toHaveLength(3);
    });

    it("refuses a text edit made after the review, and publishes nothing", async () => {
      const { cms, run, reviewOf, printed } = setup(drafts());
      const token = await reviewOf("inc-1");
      const edited = cms.entries.get("upd-2");
      if (edited) {
        edited.fields.text = { "en-US": "Edited after the review." };
        edited.sys.version += 1;
      }
      const reviewPrinted = printed();

      const failure = await run(options(token)).catch((error: unknown) => String(error));

      expect(failure).toContain("changed since the review, so nothing was published");
      expect(failure).toContain(`The review token was ${token}`);
      expect(failure).toContain("- update upd-2, saved version 2");
      expect(failure).toContain("ask before publishing with --review");
      expect(printed().slice(reviewPrinted.length)).toContain("Edited after the review.");
      expect(cms.writes()).toEqual([]);
    });

    it("refuses when an update was added after the review", async () => {
      const { cms, run, reviewOf } = setup(drafts());
      const token = await reviewOf("inc-1");
      cms.entries.set("upd-3", liveUpdate("upd-3", {}, draftState));
      const incident = cms.entries.get("inc-1");
      if (incident) {
        incident.fields.updates = { "en-US": [link("upd-1"), link("upd-2"), link("upd-3")] };
        incident.sys.version += 1;
      }

      await expect(run(options(token))).rejects.toThrow("changed since the review");

      expect(cms.writes()).toEqual([]);
    });

    it("refuses a token that was never printed", async () => {
      const { cms, run } = setup(drafts());

      await expect(run(options("000000000000"))).rejects.toThrow("changed since the review");

      expect(cms.writes()).toEqual([]);
    });

    it("follows the token from the draft result", async () => {
      const { cms, run } = setup();
      const result = drafted(await run({ action: "draft", input: draftFile, dryRun: false }));

      await run({ ...options(result.review.token), entryId: result.incident.id });

      expect(cms.summary().filter((line) => line.startsWith("PUT"))).toEqual([
        "PUT entries/new-1/published",
        "PUT entries/new-2/published",
      ]);
    });

    it("follows the token from an update result on an announced incident", async () => {
      const { cms, run } = setup([liveUpdate(), liveIncident()]);
      const result = drafted(
        await run({
          action: "update",
          entryId: "inc-1",
          input: updateFile,
          dryRun: false,
        }),
      );
      const writesBefore = cms.writes().length;

      await run(options(result.review.token));

      expect(
        cms
          .writes()
          .slice(writesBefore)
          .map((call) => call.path),
      ).toEqual(["entries/new-1/published", "entries/inc-1/published"]);
    });

    it("stays valid after a publish that stopped half way", async () => {
      const { cms, run, reviewOf } = setup(drafts());
      const token = await reviewOf("inc-1");
      const original = cms.request.getMockImplementation();
      failPublishOf(cms, "upd-2");
      await run(options(token)).catch(() => undefined);
      if (original) cms.request.mockImplementation(original);

      const result = await run(options(token));

      expect(result).toMatchObject({ published: true, updates: [{ id: "upd-2" }] });
      expect(cms.entries.get("upd-1")?.sys.version).toBe(2);
    });
  });

  describe("the environment", () => {
    it("must be named, before any request", async () => {
      const { cms, run } = setup(drafts());

      await expect(
        run({ action: "publish", entryId: "inc-1", dryRun: false, review: "abc" }),
      ).rejects.toThrow("name the environment with --environment <name>");

      expect(cms.request).not.toHaveBeenCalled();
    });

    it("must be the configured one, before any request", async () => {
      const { cms, run } = setup(drafts());

      await expect(run({ ...options("abc"), environment: "staging" })).rejects.toThrow(
        "--environment staging is not the configured environment master, so nothing was written",
      );

      expect(cms.request).not.toHaveBeenCalled();
    });

    it("warns in the result when it is not master", async () => {
      const { run } = setup(drafts(), { ...config, environment: "staging" });
      const token = publishDryRun(await run({ action: "publish", entryId: "inc-1", dryRun: true }))
        .review.token;

      await expect(run({ ...options(token), environment: "staging" })).resolves.toMatchObject({
        warnings: [expect.stringContaining('"staging" is not "master"')],
      });
    });
  });

  it("publishes every unpublished update first and the incident last", async () => {
    const { cms, run, reviewOf } = setup(drafts());
    const token = await reviewOf("inc-1");

    const result = await run(options(token));

    expect(cms.summary().slice(-3)).toEqual([
      "PUT entries/upd-1/published",
      "PUT entries/upd-2/published",
      "PUT entries/inc-1/published",
    ]);
    expect(cms.writes().map((call) => call.headers.get("X-Contentful-Version"))).toEqual([
      "1",
      "1",
      "1",
    ]);
    expect(result).toMatchObject({
      published: true,
      updates: [
        { id: "upd-1", stage: "investigating", version: 1 },
        { id: "upd-2", stage: "identified", version: 1 },
      ],
      incident: { id: "inc-1", version: 1 },
    });
  });

  it("publishes updates that have changes, and leaves published ones alone", async () => {
    const { cms, run, reviewOf } = setup([
      liveUpdate("upd-1"),
      liveUpdate("upd-2", { stage: "identified" }, { version: 5, publishedVersion: 3 }),
      liveIncident(
        { updates: [link("upd-1"), link("upd-2")] },
        { version: 3, publishedVersion: 1 },
      ),
    ]);
    const token = await reviewOf("inc-1");

    await run(options(token));

    expect(cms.summary().filter((line) => line.startsWith("PUT"))).toEqual([
      "PUT entries/upd-2/published",
      "PUT entries/inc-1/published",
    ]);
    expect(cms.writes()[0]?.headers.get("X-Contentful-Version")).toBe("5");
  });

  it("refuses an incident the publisher would drop, and publishes nothing", async () => {
    const { cms, run } = setup([
      liveUpdate("upd-1", { text: "" }, draftState),
      liveIncident({ components: ["billing"] }, draftState),
    ]);

    await expect(run(options("abc"))).rejects.toThrow(
      /nothing was published[\s\S]*billing[\s\S]*upd-1\.text is empty/,
    );

    expect(cms.writes()).toEqual([]);
  });

  it("refuses an incident that starts in the future", async () => {
    const { cms, run } = setup([
      liveUpdate("upd-1", {}, draftState),
      liveIncident({ startsAt: "2026-11-04T12:00:00Z" }, draftState),
    ]);

    await expect(run(options("abc"))).rejects.toThrow("incident.startsAt is in the future");

    expect(cms.writes()).toEqual([]);
  });

  it("refuses an incident with no updates", async () => {
    const { cms, run } = setup([liveIncident({ updates: [] }, draftState)]);

    await expect(run(options("abc"))).rejects.toThrow("The incident has no updates");

    expect(cms.writes()).toEqual([]);
  });

  it("refuses when a linked update is gone", async () => {
    const { cms, run } = setup([
      liveUpdate("upd-1", {}, draftState),
      liveIncident({ updates: [link("upd-1"), link("upd-gone")] }, draftState),
    ]);

    await expect(run(options("abc"))).rejects.toThrow(
      "update upd-gone is linked but was not found",
    );

    expect(cms.writes()).toEqual([]);
  });

  it("counts the links before it publishes anything", async () => {
    const stored = withLinkedUpdates(21).map((entry) =>
      entry.sys.contentType.sys.id === "statusUpdate"
        ? { ...entry, sys: { ...entry.sys, ...draftState } }
        : entry,
    );
    const { cms, run } = setup(stored);

    await expect(run(options("abc"))).rejects.toThrow(
      /links 21 updates, but it holds 20 at most.*unlink the 1 oldest/,
    );

    expect(cms.writes()).toEqual([]);
  });

  it("publishes an incident with exactly twenty links", async () => {
    const stored = withLinkedUpdates(20).map((entry) =>
      entry.sys.contentType.sys.id === "statusUpdate"
        ? { ...entry, sys: { ...entry.sys, ...draftState } }
        : entry,
    );
    const { cms, run, reviewOf } = setup(stored);
    const token = await reviewOf("inc-1");

    await run(options(token));

    expect(cms.writes()).toHaveLength(21);
  });

  it("refuses when there is nothing left to publish", async () => {
    const { cms, run } = setup([liveUpdate(), liveIncident()]);

    await expect(run(options("abc"))).rejects.toThrow("Nothing to publish");

    expect(cms.writes()).toEqual([]);
  });

  it("lists the updates already published and says a rerun is safe when an update fails", async () => {
    const { cms, run, reviewOf } = setup(drafts());
    const token = await reviewOf("inc-1");
    failPublishOf(cms, "upd-2");

    const failure = await run(options(token)).catch((error: unknown) => String(error));

    expect(failure).toMatch(
      /ValidationFailed.*Publishing update upd-2 failed\. Updates published so far: upd-1\. A rerun is safe/,
    );
    expect(cms.entries.get("inc-1")?.sys.publishedVersion).toBeUndefined();
  });

  it("says which updates went out when the incident fails to publish", async () => {
    const { cms, run, reviewOf } = setup(drafts());
    const token = await reviewOf("inc-1");
    failPublishOf(cms, "inc-1");

    await expect(run(options(token))).rejects.toThrow(
      /ValidationFailed.*Publishing incident inc-1 failed\. Updates published so far: upd-1, upd-2\. A rerun is safe/,
    );
  });

  it("verifies that Contentful published the version it was asked to", async () => {
    const { cms, run, reviewOf } = setup(drafts());
    const token = await reviewOf("inc-1");
    const original = cms.request.getMockImplementation();
    cms.request.mockImplementation((input, init) => {
      const isUpdate = init?.method === "PUT" && urlString(input).endsWith("upd-1/published");
      if (isUpdate) {
        const stale = {
          sys: {
            id: "upd-1",
            version: 2,
            publishedVersion: 7,
            contentType: { sys: { id: "statusUpdate" } },
          },
          fields: {},
        };
        return Promise.resolve(Response.json(stale));
      }
      return original ? original(input, init) : fetch(input, init);
    });

    await expect(run(options(token))).rejects.toThrow("Published version of upd-1 differs");
  });

  it("needs a review token and a valid id, before any request", async () => {
    const { cms, run } = setup(drafts());

    await expect(run({ ...options("abc"), review: undefined })).rejects.toThrow(
      "publish requires --review <token>",
    );
    await expect(run({ ...options("abc"), review: "" })).rejects.toThrow(
      "publish requires --review <token>",
    );
    await expect(run({ ...options("abc"), entryId: "a/b" })).rejects.toThrow("Invalid entry ID");

    expect(cms.request).not.toHaveBeenCalled();
  });
});

describe("the management token", () => {
  const attempts: [string, Options][] = [
    ["preflight", { action: "preflight" }],
    ["inspect", { action: "inspect" }],
    ["draft", { action: "draft", input: draftFile, dryRun: false }],
    ["draft dry run", { action: "draft", input: draftFile, dryRun: true }],
    ["update", { action: "update", entryId: "inc-1", input: updateFile, dryRun: false }],
    ["resolve", { action: "resolve", entryId: "inc-1", input: resolveFile, dryRun: false }],
    [
      "publish",
      { action: "publish", entryId: "inc-1", dryRun: false, review: "abc", environment: "master" },
    ],
    ["publish dry run", { action: "publish", entryId: "inc-1", dryRun: true }],
  ];

  it.each(attempts)("never appears in the output of %s", async (_name, options) => {
    const { run, printed } = setup([
      liveUpdate("upd-1", {}, draftState),
      liveIncident({}, draftState),
    ]);

    const result = await run(options).catch((error: unknown) => String(error));

    expect(printed() + JSON.stringify(result)).not.toContain(TOKEN);
  });

  it.each([401, 403, 422, 500])("never appears in the error for a %s answer", async (status) => {
    const { cms, run } = setup();
    cms.request.mockResolvedValue(
      Response.json(
        { sys: { type: "Error", id: "Failure" }, message: `Rejected ${TOKEN}` },
        { status },
      ),
    );

    const failure = await run({ action: "inspect" }).catch((error: unknown) => String(error));

    expect(failure).toContain(`returned ${status}`);
    expect(failure).not.toContain(TOKEN);
  });

  it("never appears in the error for a network failure", async () => {
    const { cms, run } = setup();
    cms.request.mockRejectedValue(new Error(`connect failed with ${TOKEN}`));

    const failure = await run({ action: "inspect" }).catch((error: unknown) => String(error));

    expect(failure).toContain("failed before a response; check what was saved before retrying");
    expect(failure).not.toContain(TOKEN);
  });

  it("is reported as an unexpected shape rather than echoed when the answer is not an entry", async () => {
    const { cms, run } = setup();
    cms.request.mockResolvedValue(Response.json({ token: TOKEN }));

    const failure = await run({ action: "inspect" }).catch((error: unknown) => String(error));

    expect(failure).toContain("answered with an unexpected shape");
    expect(failure).not.toContain(TOKEN);
  });
});

describe("parseCommandLine", () => {
  it("parses each action's options", () => {
    expect(parseCommandLine(["preflight"])).toEqual({ action: "preflight", dryRun: false });
    expect(parseCommandLine(["draft", "--file", "/a.json", "--dry-run"])).toEqual({
      action: "draft",
      file: "/a.json",
      dryRun: true,
    });
    expect(parseCommandLine(["update", "--entry-id", "inc-1", "--file", "/a.json"])).toEqual({
      action: "update",
      entryId: "inc-1",
      file: "/a.json",
      dryRun: false,
    });
    expect(
      parseCommandLine([
        "publish",
        "--entry-id",
        "inc-1",
        "--review",
        "abc123",
        "--environment",
        "master",
      ]),
    ).toEqual({
      action: "publish",
      entryId: "inc-1",
      review: "abc123",
      environment: "master",
      dryRun: false,
    });
  });

  it("takes a target for the actions that print a preview", () => {
    expect(parseCommandLine(["draft", "--file", "/a.json", "--target", "dev"])).toMatchObject({
      target: "dev",
    });
    expect(
      parseCommandLine(["publish", "--entry-id", "inc-1", "--dry-run", "--target", "prod"]),
    ).toMatchObject({ target: "prod" });
  });

  it("lets a publish dry run go without a token or an environment", () => {
    expect(parseCommandLine(["publish", "--entry-id", "inc-1", "--dry-run"])).toEqual({
      action: "publish",
      entryId: "inc-1",
      dryRun: true,
    });
  });

  it("drops the separator the root alias passes through", () => {
    expect(parseCommandLine(["--", "inspect"])).toEqual({ action: "inspect", dryRun: false });
  });

  it.each([
    [[], "Usage:"],
    [["post"], "Usage:"],
    [["constructor"], "Usage:"],
    [["toString"], "Usage:"],
    [["draft"], "draft requires --file"],
    [["update", "--file", "/a.json"], "update requires --entry-id"],
    [["resolve", "--entry-id", "inc-1"], "resolve requires --file"],
    [["publish", "--entry-id", "inc-1"], "publish requires --review"],
    [["publish", "--entry-id", "inc-1", "--review", "abc"], "publish requires --environment"],
    [["publish", "--review", "abc", "--environment", "master"], "publish requires --entry-id"],
    [
      ["publish", "--entry-id", "inc-1", "--version", "1", "--review", "abc"],
      "Unknown option '--version'",
    ],
    [["inspect", "--file", "/a.json"], "inspect does not accept --file"],
    [["draft", "--file", "/a.json", "--entry-id", "inc-1"], "draft does not accept --entry-id"],
    [
      ["draft", "--file", "/a.json", "--environment", "master"],
      "draft does not accept --environment",
    ],
    [["draft", "--file", "/a.json", "--review", "abc"], "draft does not accept --review"],
    [["draft", "--file", "/a.json", "--target", "staging"], "--target must be dev or prod"],
    [["inspect", "--target", "dev"], "inspect does not accept --target"],
  ])("refuses %j", (argv, message) => {
    expect(() => parseCommandLine(argv)).toThrow(message);
  });
});
