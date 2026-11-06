import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { z } from "zod";

import { repositoryRoot } from "./config.js";
import { ContentModel, publicationState } from "./content-model.js";
import type { PublishedState } from "./content-model.js";

const record = z.record(z.string(), z.unknown());
const serialized = z.object({ fields: z.array(record) });

const reversible = z.looseObject({ fields: z.array(z.unknown()) });

function repoModel(id: string): string {
  return readFileSync(`${repositoryRoot()}packages/cms/content-models/${id}.json`, "utf8");
}

function modelText(overrides: Record<string, unknown> = {}): string {
  return JSON.stringify({
    name: "Thing",
    description: "A thing",
    displayField: "title",
    fields: [{ id: "title", name: "Title", type: "Symbol", localized: false, required: true }],
    ...overrides,
  });
}

describe("ContentModel", () => {
  it.each(["componentButton", "statusIncident", "statusUpdate"])(
    "serializes %s back to the exact repo file",
    (id) => {
      const text = repoModel(id);
      expect(ContentModel.fromFile(text, id).serialize()).toBe(text);
    },
  );

  it("normalizes a field written without disabled, omitted or in another key order", () => {
    const text = ContentModel.fromFile(repoModel("footer"), "footer").serialize();
    const field = serialized.parse(JSON.parse(text)).fields.at(-1);
    if (!field) throw new Error("Expected a last field");
    expect(Object.keys(field)).toEqual([
      "id",
      "name",
      "type",
      "localized",
      "required",
      "validations",
      "disabled",
      "omitted",
      "items",
    ]);
    expect(Object.keys(record.parse(field.items))).toEqual(["type", "validations", "linkType"]);
  });

  it("escapes non-ASCII text and keeps short arrays inline", () => {
    const model = ContentModel.fromFile(
      modelText({ name: "💎 Thing", description: "café" }),
      "thing.json",
    );
    const text = model.serialize();
    expect(text).toContain('"name": "\\ud83d\\udc8e Thing"');
    expect(text).toContain('"description": "caf\\u00e9"');
    expect(text.endsWith("}\n")).toBe(true);
  });

  it("rejects a key the format does not have, so a typo cannot be dropped silently", () => {
    const text = modelText({
      fields: [{ id: "title", name: "Title", type: "Symbol", localised: true }],
    });
    expect(() => ContentModel.fromFile(text, "thing.json")).toThrow("fields.title.localised");
    expect(() => ContentModel.fromFile(modelText({ sys: {} }), "thing.json")).toThrow("sys");
  });

  it("rejects duplicate field ids, an unknown display field and invalid JSON", () => {
    const duplicate = [
      { id: "title", name: "A", type: "Symbol" },
      { id: "title", name: "B", type: "Symbol" },
    ];
    expect(() => ContentModel.fromFile(modelText({ fields: duplicate }), "thing.json")).toThrow(
      "twice",
    );
    expect(() => ContentModel.fromFile(modelText({ displayField: "nope" }), "thing.json")).toThrow(
      "display field",
    );
    expect(() => ContentModel.fromFile("{", "thing.json")).toThrow("not valid JSON");
    expect(() => ContentModel.fromFile("{}", "thing.json")).toThrow("name");
  });

  it("lists the content types a model links to, from fields and array items", () => {
    const incident = ContentModel.fromFile(repoModel("statusIncident"), "statusIncident");
    const footer = ContentModel.fromFile(repoModel("footer"), "footer");
    expect(incident.linkedTypes()).toEqual(["statusUpdate"]);
    expect(footer.linkedTypes()).toEqual(["componentButton"]);
  });

  it("lists Date fields", () => {
    const update = ContentModel.fromFile(repoModel("statusUpdate"), "statusUpdate");
    expect(update.dateFieldIds()).toEqual(["postedAt", "nextUpdateBy"]);
  });

  it("diffs by id, type, required, localized, validations, items and link validations", () => {
    const file = ContentModel.fromFile(repoModel("footer"), "footer");
    const live = ContentModel.fromFile(
      repoModel("footer").replace('"required": true', '"required": false'),
      "footer",
    );
    const diff = file.diff(live);
    expect(diff.changed).toEqual([
      {
        id: "internalName",
        changes: [{ property: "required", file: true, live: false }],
      },
    ]);
    expect(diff.identical).toBe(false);

    const items = ContentModel.fromFile(
      repoModel("footer").replaceAll(
        '"linkContentType": ["componentButton"]',
        '"linkContentType": []',
      ),
      "footer",
    );
    const itemChanges = file.diff(items).changed.flatMap((field) => field.changes);
    expect(itemChanges.map((change) => change.property)).toEqual([
      "items.validations",
      "items.validations",
      "items.validations",
    ]);
  });

  it("reports a reordered field list", () => {
    const file = ContentModel.fromFile(repoModel("statusUpdate"), "statusUpdate");
    const parsed = reversible.parse(JSON.parse(repoModel("statusUpdate")));
    const live = ContentModel.fromFile(
      JSON.stringify({ ...parsed, fields: [...parsed.fields].reverse() }),
      "statusUpdate",
    );
    expect(file.diff(live).reordered).toBe(true);
  });
});

describe("publicationState", () => {
  const cases: [string, number, number | null | undefined, PublishedState][] = [
    ["never published", 1, undefined, "draft"],
    ["never published, from the content type API", 1, null, "draft"],
    ["published as saved", 4, 3, "published"],
    ["saved again after publishing", 5, 3, "changed"],
  ];

  it.each(cases)("reads an entry %s as %s", (_name, version, publishedVersion, state) => {
    expect(publicationState(version, publishedVersion)).toBe(state);
  });
});
