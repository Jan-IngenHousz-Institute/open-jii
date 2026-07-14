import { buildTsQuery, escapeLike } from "./fts";

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
