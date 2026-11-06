import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { z } from "zod";

import { repositoryRoot } from "../lib/config.js";
import { ContentfulManagement } from "../lib/contentful-management.js";
import type { ContentfulConfig } from "../lib/contentful-management.js";
import { dateControl as timeZoneControl } from "../lib/editor-interface.js";
import { CmsModels, ModelFiles, execute, formatApply, formatDiff } from "./cms-models.js";

const config: ContentfulConfig = {
  space: "space1",
  environment: "staging",
  token: "secret-token-123",
};
const emptyConfig: ContentfulConfig = { space: "", environment: "", token: "" };
const base = "https://api.contentful.com/spaces/space1/environments/staging/";

function field(id: string, type: string, extra: Record<string, unknown> = {}) {
  return {
    id,
    name: id,
    type,
    localized: false,
    required: false,
    validations: [],
    disabled: false,
    omitted: false,
    ...extra,
  };
}

function model(fields: ReturnType<typeof field>[], displayField = "title") {
  return { name: "Thing", description: "", displayField, fields };
}

interface Call {
  method: string;
  path: string;
  version: string | null;
  body: unknown;
}

const typeBody = z.looseObject({ fields: z.array(z.looseObject({ id: z.string() })) });
const diffOutput = z.object({ environment: z.string(), models: z.array(z.unknown()) });
const preflightOutput = z.object({ managementToken: z.boolean() });
const interfaceBody = z.object({ controls: z.array(z.unknown()), sidebar: z.array(z.unknown()) });

type TypeBody = z.output<typeof typeBody>;

interface StoredType {
  version: number;
  publishedVersion?: number;
  body: TypeBody;
}

interface StoredInterface {
  version: number;
  controls: unknown[];
  sidebar: unknown[];
}

class FakeContentful {
  readonly calls: Call[] = [];
  readonly types = new Map<string, StoredType>();
  readonly interfaces = new Map<string, StoredInterface>();
  readonly request = vi.fn<typeof fetch>((input, init) =>
    Promise.resolve(this.respond(input, init)),
  );

  seed(
    id: string,
    body: TypeBody,
    options: { version?: number; publishedVersion?: number; controls?: unknown[] } = {},
  ): void {
    this.types.set(id, {
      version: options.version ?? 2,
      publishedVersion: "publishedVersion" in options ? options.publishedVersion : 1,
      body,
    });
    this.interfaces.set(id, {
      version: 3,
      controls: options.controls ?? body.fields.map((item) => ({ fieldId: item.id })),
      sidebar: [{ widgetId: "publication-widget", widgetNamespace: "sidebar-builtin" }],
    });
  }

  summary(): string[] {
    return this.calls.map((call) => `${call.method} ${call.path}`);
  }

  bump(id: string): void {
    const stored = this.types.get(id);
    if (stored) stored.version += 1;
  }

  respond(input: Parameters<typeof fetch>[0], init?: RequestInit): Response {
    const url = input instanceof Request ? input.url : input.toString();
    const headers = new Headers(init?.headers);
    const call: Call = {
      method: init?.method ?? "GET",
      path: url.replace(base, ""),
      version: headers.get("x-contentful-version"),
      body: typeof init?.body === "string" ? JSON.parse(init.body) : undefined,
    };
    this.calls.push(call);

    if (!url.startsWith(base) || headers.get("authorization") !== `Bearer ${config.token}`) {
      return this.failure(401, "AccessTokenInvalid");
    }

    const route = /^content_types\/([^/]+)(\/published|\/editor_interface)?$/.exec(call.path);
    if (!route) return this.failure(404, "NotFound");
    const [, id = "", suffix = ""] = route;

    if (suffix === "/editor_interface") return this.editorInterface(id, call);
    if (suffix === "/published") return this.publish(id, call);
    return this.contentType(id, call);
  }

  private contentType(id: string, call: Call): Response {
    const stored = this.types.get(id);

    if (call.method === "GET") {
      return stored ? Response.json(this.render(id, stored)) : this.failure(404, "NotFound");
    }

    const expected = stored ? String(stored.version) : null;
    if (call.version !== expected) return this.failure(409, "VersionMismatch");

    const body = typeBody.parse(call.body);
    const next: StoredType = {
      version: (stored?.version ?? 0) + 1,
      publishedVersion: stored?.publishedVersion,
      body,
    };
    this.types.set(id, next);
    if (!this.interfaces.has(id)) {
      const controls = body.fields.map((item) => ({ fieldId: item.id }));
      this.interfaces.set(id, { version: 1, controls, sidebar: [] });
    }
    return Response.json(this.render(id, next), { status: stored ? 200 : 201 });
  }

  private publish(id: string, call: Call): Response {
    const stored = this.types.get(id);
    if (!stored) return this.failure(404, "NotFound");
    if (call.version !== String(stored.version)) return this.failure(409, "VersionMismatch");

    const next = { ...stored, publishedVersion: stored.version, version: stored.version + 1 };
    this.types.set(id, next);
    return Response.json(this.render(id, next));
  }

  private editorInterface(id: string, call: Call): Response {
    const stored = this.interfaces.get(id);
    if (!stored) return this.failure(404, "NotFound");

    if (call.method === "GET") {
      return Response.json({
        sys: { id: "default", type: "EditorInterface", version: stored.version },
        controls: stored.controls,
        sidebar: stored.sidebar,
      });
    }

    if (call.version !== String(stored.version)) return this.failure(409, "VersionMismatch");
    const body = interfaceBody.parse(call.body);
    this.interfaces.set(id, { version: stored.version + 1, ...body });
    return Response.json({ sys: { version: stored.version + 1 }, ...body });
  }

  private render(id: string, stored: StoredType) {
    return {
      sys: {
        id,
        type: "ContentType",
        version: stored.version,
        ...(stored.publishedVersion === undefined
          ? {}
          : { publishedVersion: stored.publishedVersion }),
        createdBy: { sys: { id: "user" } },
      },
      ...stored.body,
    };
  }

  private failure(status: number, id: string): Response {
    return Response.json({ sys: { type: "Error", id }, message: id }, { status });
  }
}

let dir: string;

beforeEach(async () => {
  dir = await mkdtemp(join(tmpdir(), "cms-models-"));
});

afterEach(async () => {
  await rm(dir, { recursive: true, force: true });
});

async function writeModel(id: string, body: unknown): Promise<void> {
  await writeFile(join(dir, `${id}.json`), JSON.stringify(body, null, 2));
}

async function copyRepoModel(id: string): Promise<z.output<typeof typeBody>> {
  const text = await readFile(`${repositoryRoot()}packages/cms/content-models/${id}.json`, "utf8");
  await writeFile(join(dir, `${id}.json`), text);
  return typeBody.parse(JSON.parse(text));
}

function setup(settings: ContentfulConfig = config) {
  const fake = new FakeContentful();
  const client = new ContentfulManagement(settings, fake.request);
  const models = new CmsModels(new ModelFiles(dir), client);
  return { fake, models };
}

const thing = model([field("title", "Symbol", { required: true }), field("note", "Text")]);

describe("preflight", () => {
  it("prints booleans and the environment, never a value", () => {
    const { models } = setup();
    const result = models.preflight();
    expect(result).toEqual({
      CONTENTFUL_SPACE_ID: true,
      CONTENTFUL_SPACE_ENVIRONMENT: true,
      managementToken: true,
      environment: "staging",
    });
    expect(JSON.stringify(result)).not.toContain(config.token);
    expect(JSON.stringify(result)).not.toContain(config.space);
  });

  it("reports what is missing", () => {
    const { models } = setup(emptyConfig);
    expect(models.preflight()).toEqual({
      CONTENTFUL_SPACE_ID: false,
      CONTENTFUL_SPACE_ENVIRONMENT: false,
      managementToken: false,
      environment: null,
    });
  });
});

describe("diff", () => {
  describe("Date field widgets", () => {
    const event = model([field("title", "Symbol"), field("startAt", "Date")]);

    it("names a Date field whose live widget apply would switch to the time zone picker", async () => {
      await writeModel("event", event);
      const { fake, models } = setup();
      fake.seed("event", event, {
        controls: [
          { fieldId: "title" },
          { fieldId: "startAt", widgetNamespace: "builtin", widgetId: "datePicker" },
        ],
      });

      const report = await models.diff(["event"]);

      expect(report.models[0]).toMatchObject({ identical: true, dateControls: ["startAt"] });
      expect(formatDiff(report)).toContain(
        "~ field startAt widget: apply sets the date and time picker with a time zone",
      );
      expect(formatDiff(report)).toContain("apply with --expected-version");
    });

    it("names none when the live widget already has the time zone picker", async () => {
      await writeModel("event", event);
      const { fake, models } = setup();
      fake.seed("event", event, { controls: [{ fieldId: "title" }, timeZoneControl("startAt")] });

      const report = await models.diff(["event"]);

      expect(report.models[0]).toMatchObject({ dateControls: [] });
      expect(formatDiff(report)).not.toContain("apply with");
    });
  });

  it("reports a type that is missing live", async () => {
    await writeModel("thing", thing);
    const { models } = setup();

    const report = await models.diff(["thing"]);

    expect(report.models).toEqual([
      expect.objectContaining({
        id: "thing",
        missing: true,
        liveVersion: 0,
        publishedVersion: null,
        state: "missing",
        identical: false,
        fields: { added: ["title", "note"], removed: [], changed: [], reordered: false },
      }),
    ]);
  });

  it("reports a changed field with the property that differs", async () => {
    await writeModel("thing", thing);
    const { fake, models } = setup();
    fake.seed("thing", model([field("title", "Symbol"), field("note", "Text")]), {
      version: 5,
      publishedVersion: 4,
    });

    const [report] = (await models.diff(["thing"])).models;

    expect(report).toMatchObject({
      missing: false,
      liveVersion: 5,
      publishedVersion: 4,
      state: "published",
      identical: false,
      fields: {
        added: [],
        removed: [],
        changed: [{ id: "title", changes: [{ property: "required", file: true, live: false }] }],
      },
    });
  });

  it("reports an added field, a live-only field and a display field difference", async () => {
    await writeModel("thing", thing);
    const { fake, models } = setup();
    fake.seed(
      "thing",
      model([field("title", "Symbol", { required: true }), field("old", "Text")], "old"),
    );

    const [report] = (await models.diff(["thing"])).models;

    expect(report.fields.added).toEqual(["note"]);
    expect(report.fields.removed).toEqual(["old"]);
    expect(report.displayField).toEqual({ file: "title", live: "old", differs: true });
  });

  it("calls an identical type identical and ignores live-only metadata", async () => {
    await writeModel("thing", thing);
    const { fake, models } = setup();
    fake.seed("thing", thing);

    const [report] = (await models.diff(["thing"])).models;

    expect(report).toMatchObject({ identical: true, state: "published", liveVersion: 2 });
  });

  it("names the published state of a draft and of a type with unpublished edits", async () => {
    await writeModel("thing", thing);
    const { fake, models } = setup();

    fake.seed("thing", thing, { version: 1, publishedVersion: undefined });
    expect((await models.diff(["thing"])).models[0]?.state).toBe("draft");

    fake.seed("thing", thing, { version: 6, publishedVersion: 3 });
    expect((await models.diff(["thing"])).models[0]?.state).toBe("changed");
  });

  it("defaults to every model file", async () => {
    await writeModel("alpha", thing);
    await writeModel("beta", thing);
    const { models } = setup();

    const report = await models.diff([]);

    expect(report.models.map((item) => item.id)).toEqual(["alpha", "beta"]);
  });

  it("prints readable text and JSON", async () => {
    await writeModel("thing", thing);
    await writeModel("gone", thing);
    const { fake, models } = setup();
    fake.seed("thing", model([field("title", "Symbol"), field("note", "Text")]), {
      version: 5,
      publishedVersion: 4,
    });

    const text = await execute(["diff"], models);
    expect(text).toContain("Environment: staging");
    expect(text).toContain("gone: missing live (apply with --expected-version 0)");
    expect(text).toContain("thing: live version 5, published version 4, differs");
    expect(text).toContain("~ field title");
    expect(text).toContain("required: file true, live false");
    expect(text).toContain("apply with --expected-version 5");

    const json = diffOutput.parse(JSON.parse(await execute(["diff", "--json", "thing"], models)));
    expect(json.environment).toBe("staging");
    expect(json.models).toHaveLength(1);
    expect(text).not.toContain(config.token);
  });
});

describe("pull", () => {
  it("writes the repo format, byte for byte", async () => {
    const { fake, models } = setup();
    const text = await readFile(
      `${repositoryRoot()}packages/cms/content-models/statusIncident.json`,
      "utf8",
    );
    fake.seed("statusIncident", typeBody.parse(JSON.parse(text)), {
      version: 8,
      publishedVersion: 7,
    });

    const result = await models.pull("statusIncident", { force: false });

    expect(result).toMatchObject({ liveVersion: 8, state: "published", notExpressed: [] });
    expect(await readFile(join(dir, "statusIncident.json"), "utf8")).toBe(text);
  });

  it("refuses to overwrite a file without --force and makes no request", async () => {
    await writeModel("thing", thing);
    const { fake, models } = setup();
    fake.seed("thing", model([field("title", "Symbol")]));

    await expect(models.pull("thing", { force: false })).rejects.toThrow("--force");
    expect(fake.request).not.toHaveBeenCalled();

    await models.pull("thing", { force: true });
    const written = typeBody.parse(JSON.parse(await readFile(join(dir, "thing.json"), "utf8")));
    expect(written.fields).toHaveLength(1);
  });

  it("fails when the type does not exist live, and writes nothing", async () => {
    const { models } = setup();

    await expect(models.pull("thing", { force: false })).rejects.toThrow("does not exist live");
    await expect(readFile(join(dir, "thing.json"), "utf8")).rejects.toThrow();
  });

  it("names live keys the repo format cannot hold instead of writing them", async () => {
    const { fake, models } = setup();
    fake.seed("thing", model([field("title", "Symbol", { defaultValue: { "en-US": "x" } })]));

    const result = await models.pull("thing", { force: false });

    expect(result.notExpressed).toEqual(["fields.title.defaultValue"]);
    expect(await readFile(join(dir, "thing.json"), "utf8")).not.toContain("defaultValue");
  });

  it("rejects an id that is not a content type id", async () => {
    const { models } = setup();
    await expect(models.pull("../evil", { force: true })).rejects.toThrow(
      "Invalid content type id",
    );
  });
});

describe("apply", () => {
  const dateControl = (fieldId: string) => ({
    fieldId,
    widgetNamespace: "builtin",
    widgetId: "datePicker",
    settings: { format: "timeZ", ampm: "24" },
  });

  it("refuses when the live version is not the expected one, before any change", async () => {
    await writeModel("thing", thing);
    const { fake, models } = setup();
    fake.seed("thing", thing, { version: 3 });

    await expect(models.apply("thing", 2, "staging")).rejects.toThrow("version 3, not 2");
    expect(fake.summary()).toEqual(["GET content_types/thing"]);
  });

  it("expects 0 for a type that does not exist", async () => {
    await writeModel("thing", thing);
    const { fake, models } = setup();

    await expect(models.apply("thing", 1, "staging")).rejects.toThrow("version 0, not 1");
    expect(fake.summary()).toEqual(["GET content_types/thing"]);
  });

  it("creates, then activates, then sets the editor interface for Date fields", async () => {
    const body = await copyRepoModel("statusUpdate");
    const { fake, models } = setup();

    const result = await models.apply("statusUpdate", 0, "staging");

    expect(fake.summary()).toEqual([
      "GET content_types/statusUpdate",
      "PUT content_types/statusUpdate",
      "PUT content_types/statusUpdate/published",
      "GET content_types/statusUpdate/editor_interface",
      "PUT content_types/statusUpdate/editor_interface",
    ]);
    expect(fake.calls[1]?.version).toBeNull();
    expect(fake.calls[1]?.body).toEqual(body);
    expect(fake.calls[2]?.version).toBe("1");
    expect(fake.calls[4]?.version).toBe("1");
    expect(fake.interfaces.get("statusUpdate")?.controls).toEqual([
      { fieldId: "stage" },
      dateControl("postedAt"),
      { fieldId: "text" },
      dateControl("nextUpdateBy"),
    ]);
    expect(result).toMatchObject({
      contentType: "created",
      liveVersion: 2,
      publishedVersion: 1,
      editorInterface: "updated",
      stillDiffers: false,
    });
  });

  it("updates with the live version, then activates the version it saved", async () => {
    await writeModel("thing", thing);
    const { fake, models } = setup();
    fake.seed("thing", model([field("title", "Symbol"), field("note", "Text")]), {
      version: 4,
      publishedVersion: 3,
    });

    const result = await models.apply("thing", 4, "staging");

    expect(fake.summary()).toEqual([
      "GET content_types/thing",
      "PUT content_types/thing",
      "PUT content_types/thing/published",
    ]);
    expect(fake.calls[1]?.version).toBe("4");
    expect(fake.calls[2]?.version).toBe("5");
    expect(result).toMatchObject({
      contentType: "updated",
      liveVersion: 6,
      publishedVersion: 5,
      editorInterface: "not needed",
    });
  });

  it("keeps other controls, the sidebar and help text when it sets a Date control", async () => {
    await writeModel(
      "event",
      model([field("title", "Symbol"), field("at", "Date"), field("end", "Date")]),
    );
    const { fake, models } = setup();
    fake.seed(
      "event",
      model([field("title", "Symbol"), field("at", "Date"), field("end", "Date")]),
      {
        controls: [
          { fieldId: "title", widgetNamespace: "builtin", widgetId: "singleLine" },
          {
            fieldId: "at",
            widgetNamespace: "builtin",
            widgetId: "datePicker",
            settings: { format: "dateonly", helpText: "UTC please" },
          },
          dateControl("end"),
        ],
      },
    );

    const result = await models.apply("event", 2, "staging");

    expect(result.editorInterface).toBe("updated");
    expect(fake.interfaces.get("event")).toEqual({
      version: 4,
      controls: [
        { fieldId: "title", widgetNamespace: "builtin", widgetId: "singleLine" },
        {
          fieldId: "at",
          widgetNamespace: "builtin",
          widgetId: "datePicker",
          settings: { helpText: "UTC please", format: "timeZ", ampm: "24" },
        },
        dateControl("end"),
      ],
      sidebar: [{ widgetId: "publication-widget", widgetNamespace: "sidebar-builtin" }],
    });
  });

  it("changes nothing when the type and its editor interface already match", async () => {
    const body = model([field("title", "Symbol"), field("at", "Date")]);
    await writeModel("event", body);
    const { fake, models } = setup();
    fake.seed("event", body, { controls: [{ fieldId: "title" }, dateControl("at")] });

    const result = await models.apply("event", 2, "staging");

    expect(fake.summary()).toEqual([
      "GET content_types/event",
      "GET content_types/event/editor_interface",
    ]);
    expect(result).toMatchObject({ contentType: "unchanged", editorInterface: "unchanged" });
  });

  it("activates a matching type that was never published, without saving it again", async () => {
    await writeModel("thing", thing);
    const { fake, models } = setup();
    fake.seed("thing", thing, { version: 1, publishedVersion: undefined });

    const result = await models.apply("thing", 1, "staging");

    expect(fake.summary()).toEqual([
      "GET content_types/thing",
      "PUT content_types/thing/published",
    ]);
    expect(result).toMatchObject({ contentType: "unchanged", publishedVersion: 1 });
  });

  it("refuses to apply statusIncident while statusUpdate does not exist live", async () => {
    await copyRepoModel("statusIncident");
    const { fake, models } = setup();

    await expect(models.apply("statusIncident", 0, "staging")).rejects.toThrow(
      /statusIncident links to statusUpdate, which does not exist live/,
    );
    expect(fake.summary()).toEqual([
      "GET content_types/statusIncident",
      "GET content_types/statusUpdate",
    ]);
  });

  it("applies statusIncident once statusUpdate exists live", async () => {
    await copyRepoModel("statusIncident");
    const update = await copyRepoModel("statusUpdate");
    const { fake, models } = setup();
    fake.seed("statusUpdate", update);

    const result = await models.apply("statusIncident", 0, "staging");

    expect(result.contentType).toBe("created");
    const controls = fake.interfaces.get("statusIncident")?.controls;
    expect(controls).toEqual(
      expect.arrayContaining([
        dateControl("startsAt"),
        dateControl("endsAt"),
        dateControl("resolvedAt"),
      ]),
    );
  });

  it("refuses to remove live fields the file lacks", async () => {
    await writeModel("thing", thing);
    const { fake, models } = setup();
    fake.seed(
      "thing",
      model([
        field("title", "Symbol", { required: true }),
        field("note", "Text"),
        field("legacy", "Text"),
      ]),
    );

    await expect(models.apply("thing", 2, "staging")).rejects.toThrow(/legacy/);
    expect(fake.summary()).toEqual(["GET content_types/thing"]);
  });

  it("stops before activating when the type changed after the version was checked", async () => {
    await writeModel("thing", thing);
    const { fake, models } = setup();
    fake.seed("thing", model([field("title", "Symbol")]), { version: 2 });
    fake.request.mockImplementationOnce((input, init) => {
      const response = fake.respond(input, init);
      fake.bump("thing");
      return Promise.resolve(response);
    });

    await expect(models.apply("thing", 2, "staging")).rejects.toThrow("409 VersionMismatch");
    expect(fake.summary()).toEqual(["GET content_types/thing", "PUT content_types/thing"]);
  });

  it("refuses to write without an environment named, before any request", async () => {
    await writeModel("thing", thing);
    const { fake, models } = setup();

    await expect(models.apply("thing", 0, undefined)).rejects.toThrow("--environment <name>");
    await expect(models.apply("thing", 0, "")).rejects.toThrow("--environment <name>");

    expect(fake.request).not.toHaveBeenCalled();
  });

  it("refuses an environment other than the configured one, before any request", async () => {
    await writeModel("thing", thing);
    const { fake, models } = setup();

    await expect(models.apply("thing", 0, "master")).rejects.toThrow(
      "--environment master is not the configured environment staging, so nothing was written",
    );

    expect(fake.request).not.toHaveBeenCalled();
  });

  describe("live keys the repo format cannot express", () => {
    const liveType = {
      ...model([
        field("title", "Symbol", { defaultValue: { "en-US": "Untitled" } }),
        field("tags", "Array", {
          items: { type: "Symbol", validations: [], maxLength: 20 },
        }),
        field("note", "Text"),
      ]),
      metadata: { annotations: { ContentType: [] }, taxonomy: [] },
    };
    const fileType = model([
      field("title", "Symbol", { required: true }),
      field("tags", "Array", { items: { type: "Symbol", validations: [] } }),
      field("note", "Text"),
    ]);
    const kept = ["metadata", "fields.title.defaultValue", "fields.tags.items.maxLength"];

    it("carries them into the saved type and says so", async () => {
      await writeModel("thing", fileType);
      const { fake, models } = setup();
      fake.seed("thing", liveType, { version: 4, publishedVersion: 3 });

      const result = await models.apply("thing", 4, "staging");

      const sent = typeBody.parse(fake.calls[1]?.body);
      expect(sent).toMatchObject({
        metadata: { annotations: { ContentType: [] }, taxonomy: [] },
        fields: [
          { id: "title", required: true, defaultValue: { "en-US": "Untitled" } },
          { id: "tags", items: { type: "Symbol", maxLength: 20 } },
          { id: "note" },
        ],
      });
      expect(result).toMatchObject({ contentType: "updated", kept, stillDiffers: false });
      expect(formatApply(result)).toContain(`kept from the live type: ${kept.join(", ")}`);
    });

    it("lists them in the diff, as text and as JSON", async () => {
      await writeModel("thing", fileType);
      const { fake, models } = setup();
      fake.seed("thing", liveType, { version: 4, publishedVersion: 3 });

      const report = await models.diff(["thing"]);

      expect(report.models[0]?.kept).toEqual(kept);
      expect(formatDiff(report)).toContain(
        `kept from the live type, which the repo format cannot express: ${kept.join(", ")}`,
      );
    });

    it("lists them in the dry run and puts them in the body it prints", async () => {
      await writeModel("thing", fileType);
      const { fake, models } = setup();
      fake.seed("thing", liveType, { version: 4, publishedVersion: 3 });

      const plan = await models.plan("thing", 4);

      expect(plan.keptFromLive).toEqual(kept);
      expect(JSON.stringify(plan.requests)).toContain('"defaultValue":{"en-US":"Untitled"}');
      expect(JSON.stringify(plan.requests)).toContain('"metadata"');
      expect(fake.summary()).toEqual(["GET content_types/thing"]);
    });

    it("keeps nothing for a type that does not exist yet", async () => {
      await writeModel("thing", fileType);
      const { models } = setup();

      expect((await models.plan("thing", 0)).keptFromLive).toEqual([]);
    });
  });

  describe("when activating the saved type fails", () => {
    function failActivation(fake: FakeContentful): void {
      const original = fake.request.getMockImplementation();
      fake.request.mockImplementation((input, init) => {
        const url = input instanceof Request ? input.url : input.toString();
        const isActivation = init?.method === "PUT" && url.endsWith("/published");
        if (isActivation) {
          return Promise.resolve(
            Response.json({ sys: { type: "Error", id: "UnprocessableEntity" } }, { status: 422 }),
          );
        }
        return original ? original(input, init) : fetch(input, init);
      });
    }

    it("names the saved version and the rerun that activates it", async () => {
      await copyRepoModel("statusUpdate");
      const { fake, models } = setup();
      failActivation(fake);

      const failure = await models.apply("statusUpdate", 0, "staging").catch((e: unknown) => e);

      const message = failure instanceof Error ? failure.message : "";
      expect(message).toContain("422");
      expect(message).toContain(
        "The statusUpdate content type was saved (live version 1) but not activated",
      );
      expect(message).toContain("apply statusUpdate --expected-version 1 --environment staging");
    });

    it("lets the advised rerun activate it without saving it again", async () => {
      await copyRepoModel("statusUpdate");
      const { fake, models } = setup();
      const restore = fake.request.getMockImplementation();
      failActivation(fake);
      await models.apply("statusUpdate", 0, "staging").catch(() => undefined);
      if (restore) fake.request.mockImplementation(restore);
      fake.calls.length = 0;

      await models.apply("statusUpdate", 1, "staging");

      expect(fake.summary()).not.toContain("PUT content_types/statusUpdate");
      expect(fake.summary()).toContain("PUT content_types/statusUpdate/published");
    });
  });

  describe("when the editor interface step fails", () => {
    function failEditorInterface(fake: FakeContentful): void {
      const original = fake.request.getMockImplementation();
      fake.request.mockImplementation((input, init) => {
        const url = input instanceof Request ? input.url : input.toString();
        const isInterface = init?.method === "PUT" && url.endsWith("/editor_interface");
        if (isInterface) {
          return Promise.resolve(
            Response.json({ sys: { type: "Error", id: "ServerError" } }, { status: 500 }),
          );
        }
        return original ? original(input, init) : fetch(input, init);
      });
    }

    it("says the type was saved and activated, and that a rerun is safe", async () => {
      await copyRepoModel("statusUpdate");
      const { fake, models } = setup();
      failEditorInterface(fake);

      const failure = await models.apply("statusUpdate", 0, "staging").catch((e: unknown) => e);

      const message = failure instanceof Error ? failure.message : "";
      expect(message).toContain("500 ServerError");
      expect(message).toContain(
        "The statusUpdate content type was saved and activated (live version 2, published version 1)",
      );
      expect(message).toContain("A rerun is safe");
      expect(message).toContain("apply statusUpdate --expected-version 2 --environment");
      expect(fake.types.get("statusUpdate")).toMatchObject({ version: 2, publishedVersion: 1 });
    });

    it("lets the advised rerun finish without saving the type again", async () => {
      await copyRepoModel("statusUpdate");
      const { fake, models } = setup();
      const restore = fake.request.getMockImplementation();
      failEditorInterface(fake);
      await models.apply("statusUpdate", 0, "staging").catch(() => undefined);
      if (restore) fake.request.mockImplementation(restore);
      fake.calls.length = 0;

      const result = await models.apply("statusUpdate", 2, "staging");

      expect(fake.summary()).toEqual([
        "GET content_types/statusUpdate",
        "GET content_types/statusUpdate/editor_interface",
        "PUT content_types/statusUpdate/editor_interface",
      ]);
      expect(result).toMatchObject({ contentType: "unchanged", editorInterface: "updated" });
    });
  });
});

describe("apply dry run", () => {
  it("reads only the live type, writes nothing and prints the exact bodies", async () => {
    const body = await copyRepoModel("statusUpdate");
    const { fake, models } = setup();

    const result = await models.plan("statusUpdate", 0);

    expect(fake.summary()).toEqual(["GET content_types/statusUpdate"]);
    expect(result).toMatchObject({
      dryRun: true,
      readsContentful: true,
      writes: 0,
      expectedVersion: 0,
      environment: "staging",
    });
    const output = JSON.stringify(result);
    expect(output).toContain('"path":"content_types/statusUpdate/published"');
    expect(output).toContain('"fieldId":"postedAt"');
    expect(output).toContain('"format":"timeZ"');
    expect(JSON.stringify(body.fields)).toContain("postedAt");
  });

  it("needs credentials, because it reads", async () => {
    await copyRepoModel("statusUpdate");
    const { fake, models } = setup(emptyConfig);

    await expect(models.plan("statusUpdate", 0)).rejects.toThrow("Missing: CONTENTFUL_SPACE_ID");
    expect(fake.request).not.toHaveBeenCalled();
  });

  it("refuses when the live version is not the expected one", async () => {
    await writeModel("thing", thing);
    const { fake, models } = setup();
    fake.seed("thing", thing, { version: 3 });

    await expect(models.plan("thing", 2)).rejects.toThrow("version 3, not 2");
  });

  it("lists the dependency check for statusIncident", async () => {
    await copyRepoModel("statusIncident");
    const { fake, models } = setup();

    const result = await models.plan("statusIncident", 0);

    expect(fake.summary()).toEqual(["GET content_types/statusIncident"]);
    expect(JSON.stringify(result)).toContain("statusUpdate exists live");
  });

  it("goes through the command line parser, needs no environment and keeps the token out", async () => {
    await copyRepoModel("statusUpdate");
    const { fake, models } = setup();

    const text = await execute(
      ["apply", "statusUpdate", "--expected-version", "0", "--dry-run"],
      models,
    );

    expect(JSON.parse(text)).toMatchObject({ dryRun: true, writes: 0 });
    expect(text).not.toContain(config.token);
    expect(fake.summary()).toEqual(["GET content_types/statusUpdate"]);
  });
});

describe("errors and secrets", () => {
  it("redacts the token from a Contentful error that echoes it", async () => {
    await writeModel("thing", thing);
    const request = vi.fn<typeof fetch>(() =>
      Promise.resolve(
        Response.json(
          {
            sys: { id: "ValidationFailed" },
            message: `Bad request from ${config.token}`,
            details: { errors: [{ name: "invalid", details: `field ${config.token}` }] },
          },
          { status: 422 },
        ),
      ),
    );
    const models = new CmsModels(new ModelFiles(dir), new ContentfulManagement(config, request));

    const failure = await models.diff(["thing"]).catch((error: unknown) => error);

    expect(failure).toBeInstanceOf(Error);
    const message = failure instanceof Error ? failure.message : "";
    expect(message).toContain("422 ValidationFailed");
    expect(message).toContain("[redacted]");
    expect(message).not.toContain(config.token);
  });

  it("does not repeat a network error, which could carry the token", async () => {
    await writeModel("thing", thing);
    const request = vi.fn<typeof fetch>(() => Promise.reject(new Error(`fail ${config.token}`)));
    const models = new CmsModels(new ModelFiles(dir), new ContentfulManagement(config, request));

    const failure = await models.diff(["thing"]).catch((error: unknown) => error);

    const message = failure instanceof Error ? failure.message : "";
    expect(message).toContain("failed before a response");
    expect(message).not.toContain(config.token);
  });

  it("names every missing setting and makes no request", async () => {
    await writeModel("thing", thing);
    const { fake, models } = setup(emptyConfig);

    await expect(models.apply("thing", 0, "staging")).rejects.toThrow(
      "Missing: CONTENTFUL_SPACE_ID, CONTENTFUL_SPACE_ENVIRONMENT, CONTENTFUL_MANAGEMENT_TOKEN or CMA",
    );
    expect(fake.request).not.toHaveBeenCalled();
  });

  it("does not turn a server error into a missing type", async () => {
    await writeModel("thing", thing);
    const request = vi.fn<typeof fetch>(() =>
      Promise.resolve(Response.json({ sys: { id: "ServerError" } }, { status: 500 })),
    );
    const models = new CmsModels(new ModelFiles(dir), new ContentfulManagement(config, request));

    await expect(models.diff(["thing"])).rejects.toThrow("500 ServerError");
  });

  it("keeps the token out of diff and apply text", async () => {
    await writeModel("thing", thing);
    const { models } = setup();

    const diff = formatDiff(await models.diff(["thing"]));
    const result = await models.apply("thing", 0, "staging");

    expect(diff + formatApply(result)).not.toContain(config.token);
  });
});

describe("command line", () => {
  it("rejects an unknown action and flags that do not belong to the action", async () => {
    const { models } = setup();

    await expect(execute([], models)).rejects.toThrow("Usage");
    await expect(execute(["toString"], models)).rejects.toThrow("Usage");
    await expect(execute(["pull", "thing", "--dry-run"], models)).rejects.toThrow(
      "--dry-run does not apply to pull",
    );
    await expect(execute(["diff", "--force"], models)).rejects.toThrow("--force does not apply");
  });

  it("requires a reviewed version for apply", async () => {
    await writeModel("thing", thing);
    const { fake, models } = setup();

    await expect(execute(["apply", "thing"], models)).rejects.toThrow("--expected-version");
    await expect(execute(["apply", "thing", "--expected-version", "x"], models)).rejects.toThrow(
      "--expected-version",
    );
    expect(fake.request).not.toHaveBeenCalled();
  });

  it("makes apply without --dry-run name the environment it writes to", async () => {
    await writeModel("thing", thing);
    const { fake, models } = setup();

    await expect(execute(["apply", "thing", "--expected-version", "0"], models)).rejects.toThrow(
      "--environment <name>",
    );
    await expect(
      execute(["apply", "thing", "--expected-version", "0", "--environment", "master"], models),
    ).rejects.toThrow("not the configured environment staging");
    expect(fake.request).not.toHaveBeenCalled();

    const text = await execute(
      ["apply", "thing", "--expected-version", "0", "--environment", "staging"],
      models,
    );
    expect(text).toContain("Applied thing to the staging environment.");
  });

  it("does not accept --environment on the actions that never write", async () => {
    const { models } = setup();

    await expect(execute(["diff", "--environment", "staging"], models)).rejects.toThrow(
      "--environment does not apply to diff",
    );
  });

  it("prints what pull wrote", async () => {
    const { fake, models } = setup();
    fake.seed("thing", thing);

    const text = await execute(["pull", "thing"], models);

    expect(text).toContain(join(dir, "thing.json"));
    expect(text).toContain("from live version 2 (published)");
  });

  it("prints preflight as JSON booleans", async () => {
    const { models } = setup();
    const output = await execute(["preflight"], models);
    expect(preflightOutput.parse(JSON.parse(output)).managementToken).toBe(true);
    expect(output).not.toContain(config.token);
  });
});
