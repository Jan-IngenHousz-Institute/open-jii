import { readFileSync } from "node:fs";
import { join, resolve } from "node:path";
import { describe, expect, it } from "vitest";
import { z } from "zod/mini";

import {
  STATUS_CONTENTFUL_ENVIRONMENT,
  STATUS_CONTENT_LOCALE,
  STATUS_CONTENT_QUERY,
  STATUS_UPDATES_LIMIT,
  cachedStatusContentSchema,
  parseStatusContentResponse,
  statusContentResponseSchema,
  statusContentVariables,
  toStatusContent,
} from "./status-content.js";
import type { StatusContentResponse } from "./status-content.js";
import { STATUS_COMPONENT_IDS, incidentSchema, incidentStageSchema } from "./status-document.js";

type RawIncident = NonNullable<StatusContentResponse["open"]["items"][number]>;
type RawUpdate = NonNullable<NonNullable<RawIncident["updatesCollection"]>["items"][number]>;
type RawNotice = NonNullable<StatusContentResponse["notices"]["items"][number]>;

function rawUpdate(change: Partial<RawUpdate> = {}): RawUpdate {
  return {
    sys: { id: "upd-1" },
    stage: "investigating",
    postedAt: "2026-11-03T11:05:00.000Z",
    text: "We are looking into it.",
    nextUpdateBy: null,
    ...change,
  };
}

function rawIncident(change: Partial<RawIncident> = {}): RawIncident {
  return {
    sys: { id: "inc-1" },
    title: "Sign-in is slow",
    kind: "incident",
    impact: "degraded",
    components: ["sign-in"],
    startsAt: "2026-11-03T11:00:00.000Z",
    endsAt: null,
    resolvedAt: null,
    updatesCollection: { items: [rawUpdate()] },
    ...change,
  };
}

function rawNotice(change: Partial<RawNotice> = {}): RawNotice {
  return {
    sys: { id: "notice-1" },
    title: "Scheduled upgrade",
    body: null,
    severity: "info",
    ...change,
  };
}

function response(change: Partial<StatusContentResponse> = {}): StatusContentResponse {
  return {
    open: { items: [] },
    recent: { items: [] },
    upcoming: { items: [] },
    notices: { items: [] },
    ...change,
  };
}

function incidentsOf(...items: (RawIncident | null)[]): StatusContentResponse {
  return response({ open: { items } });
}

describe("STATUS_CONTENT_QUERY", () => {
  const limits = [
    ...STATUS_CONTENT_QUERY.matchAll(
      /^ {2}\w+: \w+Collection\(\n\s+locale: \$locale\n\s+limit: (\d+)/gm,
    ),
  ].map((match) => Number(match[1]));

  it("fetches the three incident sets and the notices, in that order", () => {
    expect(limits).toHaveLength(4);
    expect(STATUS_CONTENT_QUERY).toMatch(/open: statusIncidentCollection/);
    expect(STATUS_CONTENT_QUERY).toMatch(/recent: statusIncidentCollection/);
    expect(STATUS_CONTENT_QUERY).toMatch(/upcoming: statusIncidentCollection/);
    expect(STATUS_CONTENT_QUERY).toMatch(/notices: componentAlertCollection/);
  });

  it("stays within Contentful's query complexity limit", () => {
    const [open = 0, recent = 0, upcoming = 0, notices = 0] = limits;
    const linkedUpdates = 20;
    const complexity = (open + recent + upcoming) * (1 + linkedUpdates) + notices;

    expect(complexity).toBeLessThanOrEqual(11_000);
  });

  it("filters notices like the site's alerts, for the status audience", () => {
    expect(STATUS_CONTENT_QUERY).toContain('audience: "status"');
    expect(STATUS_CONTENT_QUERY).toContain("active: true");
    expect(STATUS_CONTENT_QUERY).toContain("startAt_lte: $now");
    expect(STATUS_CONTENT_QUERY).toContain("OR: [{ endAt_gt: $now }, { endAt_exists: false }]");
  });

  it("asks for each update's id, which keeps it apart from its siblings", () => {
    expect(STATUS_CONTENT_QUERY).toMatch(
      /updatesCollection\(limit: 20, locale: \$locale\) \{\n\s+items \{\n\s+sys \{\n\s+id\n/,
    );
  });

  it("declares the variables it uses", () => {
    expect(STATUS_CONTENT_QUERY).toContain(
      "query statusContent($now: DateTime!, $since: DateTime!, $locale: String!)",
    );
  });
});

describe("statusContentVariables", () => {
  it("asks for the history the page keeps, in English", () => {
    expect(statusContentVariables(new Date("2026-11-03T12:00:30.000Z"))).toEqual({
      now: "2026-11-03T12:00:30.000Z",
      since: "2026-08-05T12:00:30.000Z",
      locale: STATUS_CONTENT_LOCALE,
    });
  });
});

describe("parseStatusContentResponse", () => {
  it("returns the data of a clean answer", () => {
    const data = incidentsOf(rawIncident());

    expect(parseStatusContentResponse({ data })).toEqual(data);
  });

  it("accepts an empty errors list", () => {
    expect(parseStatusContentResponse({ data: response(), errors: [] })).toEqual(response());
  });

  it("throws on an errors array, even beside data", () => {
    const body = {
      data: response(),
      errors: [{ message: "Query cannot be executed. Maximum allowed complexity: 11000" }, {}],
    };

    expect(() => parseStatusContentResponse(body)).toThrow(/Maximum allowed complexity/);
  });

  describe("an unresolvable link", () => {
    const unresolvable = {
      message: "Query execution error. Link to entry 'upd-2' on field 'updates' cannot be resolved",
      extensions: { contentful: { code: "UNRESOLVABLE_LINK", requestId: "r-1" } },
    };
    const complexity = {
      message: "Query cannot be executed. Maximum allowed complexity: 11000",
      extensions: { contentful: { code: "TOO_COMPLEX_QUERY" } },
    };
    const data = incidentsOf(rawIncident({ updatesCollection: { items: [null, rawUpdate()] } }));

    it("is ignored, since the linked update is a draft the editor has not published", () => {
      expect(parseStatusContentResponse({ data, errors: [unresolvable, unresolvable] })).toEqual(
        data,
      );
    });

    it("leaves the unpublished update off the incident and keeps the published one", () => {
      const body = { data, errors: [unresolvable] };

      const { incidents } = toStatusContent(parseStatusContentResponse(body));

      expect(incidents.map((incident) => incident.updates.map((update) => update.id))).toEqual([
        ["upd-1"],
      ]);
    });

    it.each([
      ["another code beside it", [unresolvable, complexity], /Maximum allowed complexity/],
      ["no code", [{ message: "Something broke" }], /Something broke/],
      ["no extensions", [{ message: "No extensions", extensions: null }], /No extensions/],
      [
        "no contentful extension",
        [{ message: "Plain GraphQL", extensions: { code: "UNRESOLVABLE_LINK" } }],
        /Plain GraphQL/,
      ],
      ["an unnamed error", [{ extensions: { contentful: { code: "OTHER" } } }], /unknown error/],
    ])("still throws with %s", (_name, errors, message) => {
      expect(() => parseStatusContentResponse({ data, errors })).toThrow(message);
    });

    it("names only the errors that failed the read", () => {
      expect(() =>
        parseStatusContentResponse({ data, errors: [unresolvable, complexity] }),
      ).toThrow(
        /^Contentful answered with errors: Query cannot be executed. Maximum allowed complexity: 11000$/,
      );
    });
  });

  it.each([
    ["no data", {}],
    ["null data", { data: null }],
    ["a missing collection", { data: { ...response(), recent: undefined } }],
    ["a null collection", { data: { ...response(), notices: null } }],
    ["an entry without an id", { data: { ...response(), open: { items: [{ title: "x" }] } } }],
    [
      "an update without an id",
      {
        data: {
          ...response(),
          open: {
            items: [{ ...rawIncident(), updatesCollection: { items: [{ stage: "monitoring" }] } }],
          },
        },
      },
    ],
    ["a body that is not an object", "oops"],
  ])("throws on %s", (_name, body) => {
    expect(() => parseStatusContentResponse(body)).toThrow();
  });

  it("tolerates the nulls Contentful returns for empty fields and unresolvable links", () => {
    const data = response({
      open: {
        items: [
          null,
          rawIncident({
            title: null,
            components: null,
            startsAt: null,
            updatesCollection: null,
          }),
          rawIncident({ updatesCollection: { items: [null, rawUpdate({ text: null })] } }),
        ],
      },
      notices: { items: [null, rawNotice({ title: null, body: null, severity: null })] },
    });

    expect(statusContentResponseSchema.safeParse(data).success).toBe(true);
  });
});

describe("toStatusContent incidents", () => {
  it("maps an incident field for field, with its update", () => {
    const content = toStatusContent(
      incidentsOf(
        rawIncident({
          impact: "outage",
          components: ["sign-in", "platform"],
          resolvedAt: "2026-11-03T12:00:00.000Z",
          updatesCollection: {
            items: [rawUpdate({ nextUpdateBy: "2026-11-03T11:35:00.000Z" })],
          },
        }),
      ),
    );

    expect(content.incidents).toEqual([
      {
        id: "inc-1",
        kind: "incident",
        title: "Sign-in is slow",
        impact: "outage",
        components: ["sign-in", "platform"],
        startsAt: "2026-11-03T11:00:00.000Z",
        resolvedAt: "2026-11-03T12:00:00.000Z",
        updates: [
          {
            id: "upd-1",
            stage: "investigating",
            postedAt: "2026-11-03T11:05:00.000Z",
            text: "We are looking into it.",
            nextUpdateBy: "2026-11-03T11:35:00.000Z",
          },
        ],
      },
    ]);
  });

  it("leaves out the optional fields an editor left empty", () => {
    const { incidents } = toStatusContent(incidentsOf(rawIncident()));

    expect(incidents).toHaveLength(1);
    expect(Object.keys(incidents[0])).not.toContain("endsAt");
    expect(Object.keys(incidents[0])).not.toContain("resolvedAt");
    expect(Object.keys(incidents[0].updates[0])).not.toContain("nextUpdateBy");
  });

  it("maps planned maintenance with its end", () => {
    const content = toStatusContent(
      response({
        upcoming: {
          items: [
            rawIncident({
              sys: { id: "maint-1" },
              kind: "maintenance",
              startsAt: "2026-11-05T22:00:00.000Z",
              endsAt: "2026-11-05T23:00:00.000Z",
              updatesCollection: null,
            }),
          ],
        },
      }),
    );

    expect(content.incidents).toMatchObject([
      { id: "maint-1", kind: "maintenance", endsAt: "2026-11-05T23:00:00.000Z", updates: [] },
    ]);
  });

  it.each([
    ["an offset", "2026-11-03T13:00:00+01:00", "2026-11-03T12:00:00.000Z"],
    ["no seconds", "2026-11-03T12:00Z", "2026-11-03T12:00:00.000Z"],
    ["no zone designator", "2026-11-03T12:00:00", new Date("2026-11-03T12:00:00").toISOString()],
    ["milliseconds", "2026-11-03T12:00:00.5Z", "2026-11-03T12:00:00.500Z"],
    ["a plain date", "2026-11-03", "2026-11-03T00:00:00.000Z"],
  ])("writes a date with %s as a full ISO instant", (_name, value, expected) => {
    const content = toStatusContent(
      incidentsOf(
        rawIncident({
          startsAt: value,
          endsAt: value,
          resolvedAt: value,
          updatesCollection: {
            items: [rawUpdate({ postedAt: value, nextUpdateBy: value })],
          },
        }),
      ),
    );

    expect(content.incidents[0]).toMatchObject({
      startsAt: expected,
      endsAt: expected,
      resolvedAt: expected,
      updates: [{ postedAt: expected, nextUpdateBy: expected }],
    });
  });

  it.each([
    ["no title", { title: null }],
    ["an empty title", { title: "" }],
    ["no kind", { kind: null }],
    ["a kind it does not know", { kind: "outage" }],
    ["no impact", { impact: null }],
    ["an impact it does not know", { impact: "major" }],
    ["no components", { components: null }],
    ["an empty component list", { components: [] }],
    ["a component the contract does not know", { components: ["platform", "mobile-app"] }],
    ["no start", { startsAt: null }],
    ["a start that is not a date", { startsAt: "tomorrow" }],
    ["an end that is not a date", { endsAt: "later" }],
    ["a resolution that is not a date", { resolvedAt: "soon" }],
  ] satisfies [string, Partial<RawIncident>][])("drops an incident with %s", (_name, change) => {
    const content = toStatusContent(
      incidentsOf(rawIncident({ sys: { id: "draft" }, ...change }), rawIncident()),
    );

    expect(content.incidents.map((incident) => incident.id)).toEqual(["inc-1"]);
  });

  it.each(STATUS_COMPONENT_IDS)("accepts the contract's component %s", (id) => {
    const content = toStatusContent(incidentsOf(rawIncident({ components: [id] })));

    expect(content.incidents[0]?.components).toEqual([id]);
  });

  it("skips a null entry and keeps the rest", () => {
    const content = toStatusContent(incidentsOf(null, rawIncident(), null));

    expect(content.incidents).toHaveLength(1);
  });

  it("lists an incident once however many sets it falls in", () => {
    const content = toStatusContent(
      response({
        open: { items: [rawIncident()] },
        recent: { items: [rawIncident(), rawIncident({ sys: { id: "inc-2" } })] },
        upcoming: { items: [rawIncident({ sys: { id: "inc-2" } })] },
      }),
    );

    expect(content.incidents.map((incident) => incident.id)).toEqual(["inc-1", "inc-2"]);
  });

  it("orders incidents by start, oldest first, then by id", () => {
    const content = toStatusContent(
      response({
        open: {
          items: [
            rawIncident({ sys: { id: "b" }, startsAt: "2026-11-03T10:00:00.000Z" }),
            rawIncident({ sys: { id: "c" }, startsAt: "2026-11-01T10:00:00.000Z" }),
            rawIncident({ sys: { id: "a" }, startsAt: "2026-11-03T10:00:00.000Z" }),
          ],
        },
      }),
    );

    expect(content.incidents.map((incident) => incident.id)).toEqual(["c", "a", "b"]);
  });
});

describe("toStatusContent updates", () => {
  function updatesOf(...items: (RawUpdate | null)[]) {
    const content = toStatusContent(incidentsOf(rawIncident({ updatesCollection: { items } })));
    return content.incidents[0]?.updates ?? [];
  }

  it("orders updates newest first, as the page shows them", () => {
    const updates = updatesOf(
      rawUpdate({ stage: "investigating", postedAt: "2026-11-03T11:05:00.000Z" }),
      rawUpdate({ stage: "resolved", postedAt: "2026-11-03T12:00:00.000Z" }),
      rawUpdate({ stage: "identified", postedAt: "2026-11-03T11:30:00.000Z" }),
    );

    expect(updates.map((update) => update.stage)).toEqual([
      "resolved",
      "identified",
      "investigating",
    ]);
  });

  it("orders by instant, not by the text of the date", () => {
    const updates = updatesOf(
      rawUpdate({ stage: "investigating", postedAt: "2026-11-03T12:30:00+02:00" }),
      rawUpdate({ stage: "identified", postedAt: "2026-11-03T10:45:00Z" }),
    );

    expect(updates.map((update) => update.stage)).toEqual(["identified", "investigating"]);
  });

  it("keeps the id Contentful gave each update", () => {
    const updates = updatesOf(
      rawUpdate({ sys: { id: "upd-a" }, stage: "investigating" }),
      rawUpdate({ sys: { id: "upd-b" }, stage: "investigating" }),
    );

    expect(updates.map((update) => update.id).sort()).toEqual(["upd-a", "upd-b"]);
  });

  it("drops a dangling update and keeps the incident and its other updates", () => {
    const updates = updatesOf(null, rawUpdate());

    expect(updates).toHaveLength(1);
  });

  it.each([
    ["an empty id", { sys: { id: "" } }],
    ["no stage", { stage: null }],
    ["a stage it does not know", { stage: "closed" }],
    ["no post time", { postedAt: null }],
    ["no text", { text: null }],
    ["empty text", { text: "" }],
    ["a next-update time that is not a date", { nextUpdateBy: "tonight" }],
  ] satisfies [string, Partial<RawUpdate>][])("drops an update with %s", (_name, change) => {
    const updates = updatesOf(rawUpdate(change), rawUpdate({ stage: "monitoring" }));

    expect(updates.map((update) => update.stage)).toEqual(["monitoring"]);
  });

  it("keeps an incident whose updates are all unusable", () => {
    expect(updatesOf(null, rawUpdate({ text: null }))).toEqual([]);
  });
});

function textNode(value: string) {
  return { nodeType: "text", value, marks: [], data: {} };
}

function block(nodeType: string, ...content: unknown[]) {
  return { nodeType, content, data: {} };
}

function paragraph(...content: unknown[]) {
  return block("paragraph", ...content);
}

function link(value: string) {
  return block("hyperlink", textNode(value));
}

function richDocument(...content: unknown[]) {
  return block("document", ...content);
}

function bodyOf(json: unknown): string | undefined {
  const content = toStatusContent(
    response({ notices: { items: [rawNotice({ body: { json } })] } }),
  );
  return content.notices[0]?.body;
}

describe("toStatusContent notices", () => {
  it("maps a notice with its id, title, body and severity", () => {
    const content = toStatusContent(
      response({
        notices: {
          items: [
            rawNotice({
              body: { json: richDocument(paragraph(textNode("Expect a short outage."))) },
              severity: "warning",
            }),
          ],
        },
      }),
    );

    expect(content.notices).toEqual([
      {
        id: "notice-1",
        title: "Scheduled upgrade",
        body: "Expect a short outage.",
        severity: "warning",
      },
    ]);
  });

  it.each([
    ["one run of text", richDocument(paragraph(textNode("Hello."))), "Hello."],
    [
      "several text nodes in a paragraph, joined as they are",
      richDocument(paragraph(textNode("Hello, "), textNode("world"), textNode("!"))),
      "Hello, world!",
    ],
    [
      "paragraphs, separated by a blank line",
      richDocument(
        paragraph(textNode("One.")),
        paragraph(textNode("Two.")),
        paragraph(textNode("Three.")),
      ),
      "One.\n\nTwo.\n\nThree.",
    ],
    [
      "a hyperlink, which keeps its text",
      richDocument(paragraph(textNode("See "), link("the runbook"), textNode(" for more."))),
      "See the runbook for more.",
    ],
    [
      "a link between empty text nodes",
      richDocument(paragraph(textNode(""), link("Docs"), textNode(""))),
      "Docs",
    ],
    [
      "an entry hyperlink",
      richDocument(paragraph(block("entry-hyperlink", textNode("Status"), textNode(" page")))),
      "Status page",
    ],
    [
      "empty paragraphs, which leave no extra blank line",
      richDocument(
        paragraph(textNode("One.")),
        paragraph(textNode("")),
        paragraph(textNode("  ")),
        paragraph(textNode("Two.")),
        paragraph(textNode("")),
      ),
      "One.\n\nTwo.",
    ],
    [
      "a heading and a paragraph",
      richDocument(block("heading-2", textNode("Planned work")), paragraph(textNode("At night."))),
      "Planned work\n\nAt night.",
    ],
    [
      "a list, one item to a paragraph",
      richDocument(
        block(
          "unordered-list",
          block("list-item", paragraph(textNode("First"))),
          block("list-item", paragraph(textNode("Second"))),
        ),
      ),
      "First\n\nSecond",
    ],
    [
      "a line break inside a paragraph",
      richDocument(paragraph(textNode("Line one\nLine two"))),
      "Line one\nLine two",
    ],
    [
      "an embedded block, which has no text",
      richDocument(
        paragraph(textNode("Before.")),
        block("embedded-asset-block"),
        paragraph(textNode("After.")),
      ),
      "Before.\n\nAfter.",
    ],
    ["a document with nothing in it", richDocument(), ""],
    ["no document", null, ""],
    ["something that is not a document", "plain string", ""],
    ["a node without a type", { content: [] }, ""],
  ])("flattens %s", (_name, json, expected) => {
    expect(bodyOf(json)).toBe(expected);
  });

  it("keeps a notice with no body, as an empty one", () => {
    const content = toStatusContent(response({ notices: { items: [rawNotice({ body: null })] } }));

    expect(content.notices).toMatchObject([{ body: "" }]);
  });

  it.each([
    ["info", "info"],
    ["warning", "warning"],
    ["critical", "critical"],
    ["fatal", "info"],
    ["Critical", "info"],
    ["toString", "info"],
    ["", "info"],
    [null, "info"],
  ])("reads the severity %s as %s", (severity, expected) => {
    const content = toStatusContent(response({ notices: { items: [rawNotice({ severity })] } }));

    expect(content.notices[0]?.severity).toBe(expected);
  });

  it.each([
    ["no title", { title: null }],
    ["an empty title", { title: "" }],
  ] satisfies [string, Partial<RawNotice>][])("drops a notice with %s", (_name, change) => {
    const content = toStatusContent(
      response({
        notices: { items: [rawNotice({ sys: { id: "draft" }, ...change }), rawNotice(), null] },
      }),
    );

    expect(content.notices.map((notice) => notice.id)).toEqual(["notice-1"]);
  });

  it("orders notices most severe first, then by id", () => {
    const content = toStatusContent(
      response({
        notices: {
          items: [
            rawNotice({ sys: { id: "d" }, severity: "info" }),
            rawNotice({ sys: { id: "c" }, severity: "critical" }),
            rawNotice({ sys: { id: "b" }, severity: "warning" }),
            rawNotice({ sys: { id: "a" }, severity: "info" }),
          ],
        },
      }),
    );

    expect(content.notices.map((notice) => notice.id)).toEqual(["c", "b", "a", "d"]);
  });
});

describe("toStatusContent as a whole", () => {
  it("returns nothing for an answer with nothing in it", () => {
    expect(toStatusContent(response())).toEqual({
      incidents: [],
      notices: [],
      dropped: { incidents: [], notices: [] },
    });
  });

  it("produces content the cached form and the document contract accept", () => {
    const { dropped: _dropped, ...content } = toStatusContent(
      response({
        open: { items: [rawIncident({ endsAt: "2026-11-03T13:00:00+01:00" })] },
        notices: {
          items: [rawNotice({ body: { json: richDocument(paragraph(textNode("Body."))) } })],
        },
      }),
    );
    const cached = { fetchedAt: "2026-11-03T12:00:00.000Z", ...content };

    expect(cachedStatusContentSchema.parse(cached)).toEqual(cached);
  });
});

describe("toStatusContent dropped entries", () => {
  it("names by id an incident and a notice the contract rejects, and keeps the rest", () => {
    const content = toStatusContent(
      response({
        open: { items: [rawIncident({ sys: { id: "no-start" }, startsAt: null }), rawIncident()] },
        notices: { items: [rawNotice({ sys: { id: "no-title" }, title: null }), null] },
      }),
    );

    expect(content.dropped).toEqual({ incidents: ["no-start"], notices: ["no-title"] });
    expect(content.incidents).toHaveLength(1);
  });
});

describe("the content models and the publisher", () => {
  const repoRoot = resolve(__dirname, "../../..");
  const validationsSchema = z.optional(
    z.array(
      z.object({
        in: z.optional(z.array(z.string())),
        size: z.optional(z.object({ max: z.optional(z.number()) })),
      }),
    ),
  );
  const modelSchema = z.object({
    fields: z.array(
      z.object({
        id: z.string(),
        validations: validationsSchema,
        items: z.optional(z.object({ validations: validationsSchema })),
      }),
    ),
  });

  function fieldOf(model: string, id: string) {
    const source = readFileSync(
      join(repoRoot, `packages/cms/content-models/${model}.json`),
      "utf8",
    );
    const field = modelSchema.parse(JSON.parse(source)).fields.find((entry) => entry.id === id);
    if (field === undefined) {
      throw new Error(`${model} has no ${id} field`);
    }
    return field;
  }

  function allowedIn(validations: z.infer<typeof validationsSchema>) {
    return validations?.find((validation) => validation.in !== undefined)?.in;
  }

  it("lets editors pick only the kinds, impacts, components and stages the contract knows", () => {
    expect(allowedIn(fieldOf("statusIncident", "kind").validations)).toEqual(
      incidentSchema.shape.kind.options,
    );
    expect(allowedIn(fieldOf("statusIncident", "impact").validations)).toEqual(
      incidentSchema.shape.impact.options,
    );
    expect(allowedIn(fieldOf("statusIncident", "components").items?.validations)).toEqual([
      ...STATUS_COMPONENT_IDS,
    ]);
    expect(allowedIn(fieldOf("statusUpdate", "stage").validations)).toEqual(
      incidentStageSchema.options,
    );
  });

  it("caps an incident's updates at what the query fetches", () => {
    const sizes = fieldOf("statusIncident", "updates").validations ?? [];

    expect(sizes.find((validation) => validation.size !== undefined)?.size?.max).toBe(
      STATUS_UPDATES_LIMIT,
    );
    expect(STATUS_CONTENT_QUERY).toContain(`updatesCollection(limit: ${STATUS_UPDATES_LIMIT},`);
  });

  it("reads the same Contentful environment in the publisher", () => {
    const handler = readFileSync(
      join(repoRoot, "infrastructure/modules/monitoring/status-publisher/lambda/index.js"),
      "utf8",
    );

    expect(STATUS_CONTENTFUL_ENVIRONMENT).toBe("master");
    expect(handler).toContain("/environments/${STATUS_CONTENTFUL_ENVIRONMENT}`");
    expect(handler).not.toContain("/environments/master");
  });
});
