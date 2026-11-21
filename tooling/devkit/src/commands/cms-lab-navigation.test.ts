import { describe, expect, it, vi } from "vitest";

import { ContentfulManagement } from "../lib/contentful-management.js";
import type { ContentfulConfig } from "../lib/contentful-management.js";
import { LabNavigation, buttonFields, execute, labLabel, labUrl } from "./cms-lab-navigation.js";

const config: ContentfulConfig = { space: "space1", environment: "master", token: "secret-123" };
const base = "https://api.contentful.com/spaces/space1/environments/master/";
const locales = [
  { code: "en-US", default: true },
  { code: "de-DE", default: false },
  { code: "nl-NL", default: false },
];

interface Stored {
  sys: {
    id: string;
    version: number;
    publishedVersion?: number;
    archivedVersion?: number;
    contentType: { sys: { id: string } };
  };
  fields: Record<string, Record<string, unknown>>;
}

interface Call {
  method: string;
  path: string;
  version: string | null;
}

// Stored fields are typed as always present; a test reads one that may be missing.
function field(entry: Stored | undefined, id: string): unknown {
  return entry && Object.hasOwn(entry.fields, id) ? entry.fields[id]["en-US"] : undefined;
}

function link(id: string) {
  return { sys: { type: "Link", linkType: "Entry", id } };
}

class FakeContentful {
  readonly calls: Call[] = [];
  readonly entries = new Map<string, Stored>();
  private created = 0;
  readonly request = vi.fn<typeof fetch>((input, init) =>
    Promise.resolve(this.respond(input, init ?? {})),
  );

  seed(
    id: string,
    contentType: string,
    fields: Stored["fields"],
    sys: Partial<Stored["sys"]> = {},
  ): void {
    this.entries.set(id, {
      sys: {
        id,
        version: 3,
        publishedVersion: 2,
        contentType: { sys: { id: contentType } },
        ...sys,
      },
      fields,
    });
  }

  footer(navigation: unknown[] = [link("home")], menu: unknown[] = [link("about")]): void {
    this.seed("footer1", "footer", {
      internalName: { "en-US": "Footer" },
      navigationButtons: { "en-US": navigation },
      menuButtons: { "en-US": menu },
    });
  }

  labButton(id = "lab1", sys: Partial<Stored["sys"]> = {}): void {
    this.seed(id, "componentButton", buttonFields(locales), sys);
  }

  writes(): string[] {
    return this.calls.filter((call) => call.method !== "GET").map((c) => `${c.method} ${c.path}`);
  }

  private respond(input: Parameters<typeof fetch>[0], init: RequestInit): Response {
    const url = input instanceof Request ? input.url : input.toString();
    const method = init.method ?? "GET";
    const headers = new Headers(init.headers);
    const path = url.slice(base.length);
    this.calls.push({ method, path, version: headers.get("X-Contentful-Version") });
    const body =
      typeof init.body === "string"
        ? (JSON.parse(init.body) as { fields: Stored["fields"] })
        : null;

    if (path === "locales") return Response.json({ items: locales });
    if (method === "GET" && path.startsWith("entries?")) {
      const query = new URLSearchParams(path.slice("entries?".length));
      const items = [...this.entries.values()].filter(
        (entry) =>
          entry.sys.contentType.sys.id === query.get("content_type") &&
          (query.get("fields.url") === null || field(entry, "url") === query.get("fields.url")),
      );
      return Response.json({ total: items.length, items });
    }
    if (method === "POST" && path === "entries") {
      this.created += 1;
      const id = `new${this.created}`;
      this.seed(id, headers.get("X-Contentful-Content-Type") ?? "", body?.fields ?? {}, {
        version: 1,
        publishedVersion: undefined,
      });
      return Response.json(this.entries.get(id));
    }
    const [, id = "", published] = /^entries\/([^/]+)(\/published)?$/.exec(path) ?? [];
    const entry = this.entries.get(id);
    if (!entry) return Response.json({ message: "Not found" }, { status: 404 });
    if (method === "GET") return Response.json(entry);
    if (headers.get("X-Contentful-Version") !== String(entry.sys.version)) {
      return Response.json({ sys: { id: "VersionMismatch" } }, { status: 409 });
    }
    if (published) {
      entry.sys.publishedVersion = entry.sys.version;
      entry.sys.version += 1;
    } else {
      entry.fields = body?.fields ?? entry.fields;
      entry.sys.version += 1;
    }
    return Response.json(entry);
  }
}

function setup() {
  const fake = new FakeContentful();
  const navigation = new LabNavigation(new ContentfulManagement(config, fake.request));
  return { fake, navigation };
}

describe("inspect", () => {
  it("plans a new button for both lists without writing anything", async () => {
    const { fake, navigation } = setup();
    fake.footer();

    const plan = await navigation.inspect("footer1");

    expect(plan).toMatchObject({
      environment: "master",
      footer: { id: "footer1", version: 3, publishedVersion: 2 },
      button: "create",
      add: ["navigationButtons", "menuButtons"],
      unchanged: false,
    });
    expect(fake.writes()).toEqual([]);
  });

  it("reuses a published Lab button and adds it only where it is missing", async () => {
    const { fake, navigation } = setup();
    fake.labButton();
    fake.footer([link("home"), link("lab1")]);

    expect(await navigation.inspect("footer1")).toMatchObject({
      button: { id: "lab1", published: true },
      add: ["menuButtons"],
    });
  });

  it("reports nothing to do when both lists already link the Lab button", async () => {
    const { fake, navigation } = setup();
    fake.labButton();
    fake.footer([link("lab1")], [link("lab1")]);

    expect(await navigation.inspect("footer1")).toMatchObject({ add: [], unchanged: true });
  });

  it.each([
    ["unpublished edits", { version: 5, publishedVersion: 2 }],
    ["never published", { version: 1, publishedVersion: undefined }],
    ["archived", { archivedVersion: 4 }],
  ])("refuses a footer with %s", async (_name, sys) => {
    const { fake, navigation } = setup();
    fake.seed("footer1", "footer", {}, sys);

    await expect(navigation.inspect("footer1")).rejects.toThrow(/footer1/);
  });

  it("refuses to add a seventh public header link", async () => {
    const { fake, navigation } = setup();
    fake.footer(["a", "b", "c", "d", "e", "f"].map(link));

    await expect(navigation.inspect("footer1")).rejects.toThrow("already has 6 links");
  });

  it("refuses an entry that is not a footer", async () => {
    const { fake, navigation } = setup();
    fake.seed("footer1", "componentButton", {});

    await expect(navigation.inspect("footer1")).rejects.toThrow("not a footer");
  });

  it("refuses two buttons pointing at Lab, or one with unpublished edits", async () => {
    const twice = setup();
    twice.fake.footer();
    twice.fake.labButton("lab1");
    twice.fake.labButton("lab2");
    await expect(twice.navigation.inspect("footer1")).rejects.toThrow("2 buttons");

    const draft = setup();
    draft.fake.footer();
    draft.fake.labButton("lab1", { version: 4, publishedVersion: 2 });
    await expect(draft.navigation.inspect("footer1")).rejects.toThrow("unpublished edits");
  });
});

describe("apply", () => {
  it("creates and publishes the button, then appends it to both lists and publishes the footer", async () => {
    const { fake, navigation } = setup();
    fake.footer();

    const result = await navigation.apply("footer1", 3, "master");

    expect(fake.writes()).toEqual([
      "POST entries",
      "PUT entries/new1/published",
      "PUT entries/footer1",
      "PUT entries/footer1/published",
    ]);
    const button = fake.entries.get("new1");
    expect(button?.fields).toEqual({
      internalName: { "en-US": "openJII Lab navigation" },
      label: { "en-US": labLabel, "de-DE": labLabel, "nl-NL": labLabel },
      url: { "en-US": labUrl },
    });
    const footer = fake.entries.get("footer1");
    expect(field(footer, "navigationButtons")).toEqual([link("home"), link("new1")]);
    expect(field(footer, "menuButtons")).toEqual([link("about"), link("new1")]);
    expect(footer?.fields.internalName).toEqual({ "en-US": "Footer" });
    expect(result).toMatchObject({
      applied: true,
      button: { id: "new1", published: true },
      footerVersionAfter: 5,
    });
  });

  it("publishes the footer with nothing else pending: version equals published plus one", async () => {
    const { fake, navigation } = setup();
    fake.footer();

    await navigation.apply("footer1", 3, "master");

    const footer = fake.entries.get("footer1");
    expect(footer?.sys.version).toBe((footer?.sys.publishedVersion ?? 0) + 1);
  });

  it("reuses an existing button and writes only the footer list that lacks it", async () => {
    const { fake, navigation } = setup();
    fake.labButton();
    fake.footer([link("lab1")]);

    await navigation.apply("footer1", 3, "master");

    expect(fake.writes()).toEqual(["PUT entries/footer1", "PUT entries/footer1/published"]);
    expect(field(fake.entries.get("footer1"), "navigationButtons")).toEqual([link("lab1")]);
    expect(field(fake.entries.get("footer1"), "menuButtons")).toEqual([
      link("about"),
      link("lab1"),
    ]);
  });

  it("writes nothing when the Lab button is already in both lists", async () => {
    const { fake, navigation } = setup();
    fake.labButton();
    fake.footer([link("lab1")], [link("lab1")]);

    expect(await navigation.apply("footer1", 3, "master")).toMatchObject({ applied: false });
    expect(fake.writes()).toEqual([]);
  });

  it("writes nothing unless the footer is still at the reviewed version", async () => {
    const { fake, navigation } = setup();
    fake.footer();

    await expect(navigation.apply("footer1", 2, "master")).rejects.toThrow("reviewed 2");
    expect(fake.writes()).toEqual([]);
  });

  it.each([undefined, "", "staging"])(
    "writes nothing unless the configured environment is named (%s)",
    async (environment) => {
      const { fake, navigation } = setup();
      fake.footer();

      await expect(navigation.apply("footer1", 3, environment)).rejects.toThrow(
        "nothing was written",
      );
      expect(fake.request).not.toHaveBeenCalled();
    },
  );
});

describe("execute", () => {
  it("lists footers when inspect has no footer id", async () => {
    const { fake, navigation } = setup();
    fake.footer();

    const output = JSON.parse(await execute(["inspect"], navigation)) as unknown;

    expect(output).toEqual({ footers: [{ id: "footer1", version: 3, publishedVersion: 2 }] });
  });

  it.each([
    [["apply", "--footer-id", "footer1", "--environment", "master"]],
    [["apply", "--footer-id", "footer1", "--footer-version", "x", "--environment", "master"]],
    [["publish"]],
    [["inspect", "extra"]],
  ])("refuses %j before any request", async (args) => {
    const { fake, navigation } = setup();

    await expect(execute(args, navigation)).rejects.toThrow("Usage");
    expect(fake.request).not.toHaveBeenCalled();
  });

  it("reports preflight as booleans without the token", async () => {
    const { navigation } = setup();

    const output = await execute(["preflight"], navigation);

    expect(JSON.parse(output)).toMatchObject({ managementToken: true, environment: "master" });
    expect(output).not.toContain("secret-123");
  });
});
