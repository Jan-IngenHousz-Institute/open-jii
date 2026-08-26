import { sql } from "@repo/database";

import { buildTsQuery, crossTableBonus, escapeLike } from "./fts";

describe("fts buildTsQuery", () => {
  it("appends :* to a single term for prefix matching", () => {
    expect(buildTsQuery("photo")).toBe("photo:*");
  });

  it("ANDs multiple terms together, each as a prefix", () => {
    expect(buildTsQuery("foo bar")).toBe("foo:* & bar:*");
  });

  it("lowercases terms", () => {
    expect(buildTsQuery("Photosynthesis STUDY")).toBe("photosynthesis:* & study:*");
  });

  it("strips tsquery operators and punctuation so the query stays safe", () => {
    expect(buildTsQuery("foo & bar | !baz:* (qux)")).toBe("foo:* & bar:* & baz:* & qux:*");
  });

  it("collapses extra whitespace", () => {
    expect(buildTsQuery("  foo    bar  ")).toBe("foo:* & bar:*");
  });

  it("keeps unicode letters and digits", () => {
    expect(buildTsQuery("café 42")).toBe("café:* & 42:*");
  });

  it("returns an empty string when nothing usable remains", () => {
    expect(buildTsQuery("   ")).toBe("");
    expect(buildTsQuery("!@#$%")).toBe("");
  });
});

describe("fts escapeLike", () => {
  it("escapes LIKE wildcards so they match literally", () => {
    expect(escapeLike("100%")).toBe("100\\%");
    expect(escapeLike("a_b")).toBe("a\\_b");
  });

  it("escapes backslashes", () => {
    expect(escapeLike("a\\b")).toBe("a\\\\b");
  });

  it("leaves ordinary text untouched", () => {
    expect(escapeLike("photosynthesis study")).toBe("photosynthesis study");
  });
});

describe("fts crossTableBonus", () => {
  const render = (expression: { getSQL: () => { queryChunks: unknown[] } }) =>
    JSON.stringify(expression.getSQL().queryChunks);

  it("caps the summed per-match steps", () => {
    const text = render(crossTableBonus(sql`a`, sql`b`, sql`c`));

    expect(text).toContain("LEAST(");
    expect(text.match(/CASE WHEN/g)).toHaveLength(3);
    expect(text).toContain("0.1");
  });

  it("yields a plain zero with no probes, not an empty LEAST", () => {
    // An empty term list would join into `LEAST(, 0.1)`, which Postgres cannot parse.
    const text = render(crossTableBonus());

    expect(text).not.toContain("LEAST(");
    expect(text).toContain("0::numeric");
  });
});
