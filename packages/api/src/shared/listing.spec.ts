import { describe, expect, it } from "vitest";
import { z } from "zod";

import { resolveListScope, zPaginated, zPaginationQuery } from "./listing";

describe("resolveListScope", () => {
  it("defaults to the whole accessible set when neither param is sent", () => {
    expect(resolveListScope({})).toBe("all");
  });

  it("maps the deprecated per-entity filter aliases to related", () => {
    expect(resolveListScope({ filter: "member" })).toBe("related");
    expect(resolveListScope({ filter: "my" })).toBe("related");
  });

  it("passes an explicit scope through", () => {
    expect(resolveListScope({ scope: "related" })).toBe("related");
    expect(resolveListScope({ scope: "all" })).toBe("all");
  });

  it("lets scope win when both are sent, including the widening direction", () => {
    expect(resolveListScope({ scope: "all", filter: "my" })).toBe("all");
    expect(resolveListScope({ scope: "related", filter: "member" })).toBe("related");
  });
});

describe("zPaginationQuery", () => {
  it("defaults to the first page of 20", () => {
    expect(zPaginationQuery.parse({})).toEqual({ page: 1, pageSize: 20 });
  });

  it("coerces the query-string values a GET route actually receives", () => {
    expect(zPaginationQuery.parse({ page: "3", pageSize: "50" })).toEqual({
      page: 3,
      pageSize: 50,
    });
  });

  it("rejects a non-positive page and an oversized page", () => {
    expect(() => zPaginationQuery.parse({ page: 0 })).toThrow();
    expect(() => zPaginationQuery.parse({ pageSize: 101 })).toThrow();
  });
});

describe("zPaginated", () => {
  it("wraps items alongside the totals the client pages on", () => {
    const schema = zPaginated(z.object({ id: z.string() }));

    expect(
      schema.parse({
        items: [{ id: "a" }],
        page: 2,
        pageSize: 20,
        totalPages: 3,
        totalCount: 41,
      }),
    ).toEqual({ items: [{ id: "a" }], page: 2, pageSize: 20, totalPages: 3, totalCount: 41 });
  });
});
