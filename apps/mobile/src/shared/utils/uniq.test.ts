import { describe, expect, it } from "vitest";

import { uniq, uniqBy } from "./uniq";

describe("uniq", () => {
  it("dedupes primitives, preserving first-seen order", () => {
    expect(uniq([1, 2, 2, 3, 1, 4])).toEqual([1, 2, 3, 4]);
    expect(uniq(["a", "b", "a"])).toEqual(["a", "b"]);
  });

  it("returns an empty array for empty input", () => {
    expect(uniq([])).toEqual([]);
  });
});

describe("uniqBy", () => {
  it("dedupes objects by key, keeping the first occurrence", () => {
    const a1 = { id: "a", v: 1 };
    const a2 = { id: "a", v: 2 };
    const b = { id: "b", v: 3 };

    expect(uniqBy([a1, a2, b], (x) => x.id)).toEqual([a1, b]);
  });

  it("works with non-string keys", () => {
    expect(uniqBy([{ n: 1 }, { n: 2 }, { n: 1 }], (x) => x.n)).toEqual([{ n: 1 }, { n: 2 }]);
  });

  it("returns an empty array for empty input", () => {
    expect(uniqBy<{ id: string }, string>([], (x) => x.id)).toEqual([]);
  });
});
