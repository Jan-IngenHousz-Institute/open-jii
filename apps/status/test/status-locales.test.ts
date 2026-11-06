import { describe, expect, it } from "vitest";

import de from "@repo/i18n/locales/de-DE/status.json";
import en from "@repo/i18n/locales/en-US/status.json";
import nl from "@repo/i18n/locales/nl-NL/status.json";

interface Tree {
  [key: string]: string | Tree;
}

function flatten(tree: Tree, prefix = ""): Record<string, string> {
  return Object.entries(tree).reduce<Record<string, string>>((flat, [key, value]) => {
    const path = `${prefix}${key}`;

    return typeof value === "string"
      ? { ...flat, [path]: value }
      : { ...flat, ...flatten(value, `${path}.`) };
  }, {});
}

function placeholders(text: string) {
  return (text.match(/{{\w+}}/g) ?? []).sort();
}

function tags(text: string) {
  return (text.match(/<\/?\w+>/g) ?? []).sort();
}

const base = flatten(en);

describe.each([
  ["de-DE", de],
  ["nl-NL", nl],
])("the %s status translations", (_locale, tree) => {
  const translated = flatten(tree);

  it("has the same keys as en-US", () => {
    expect(Object.keys(translated).sort()).toEqual(Object.keys(base).sort());
  });

  it("keeps the placeholders of every en-US string", () => {
    for (const [key, text] of Object.entries(base)) {
      expect(placeholders(translated[key] ?? ""), key).toEqual(placeholders(text));
    }
  });

  it("keeps the link tags of every en-US string", () => {
    for (const [key, text] of Object.entries(base)) {
      expect(tags(translated[key] ?? ""), key).toEqual(tags(text));
    }
  });
});

describe.each([
  ["en-US", en],
  ["de-DE", de],
  ["nl-NL", nl],
])("the %s status translations", (_locale, tree) => {
  it("has no empty strings and no em dashes", () => {
    for (const [key, text] of Object.entries(flatten(tree))) {
      expect(text, key).not.toBe("");
      expect(text, key).not.toMatch(/\u2014/);
    }
  });
});
