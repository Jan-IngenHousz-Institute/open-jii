import type { Query } from "@tanstack/react-query";
import { describe, expect, it } from "vitest";

import { shouldPersistQuery } from "./persist-query-filter";

function query(queryKey: readonly unknown[], status = "success", data: unknown = {}): Query {
  return { queryKey, state: { status, data } } as unknown as Query;
}

describe("shouldPersistQuery", () => {
  it("persists the offline-critical roots once they hold data", () => {
    expect(shouldPersistQuery(query(["experiments"]))).toBe(true);
    expect(shouldPersistQuery(query(["userProfile", "u1"]))).toBe(true);
    expect(shouldPersistQuery(query(["workbook-version", "w1", "v1"]))).toBe(true);
    expect(shouldPersistQuery(query(["precache-experiment-data", "e1"]))).toBe(true);
    expect(shouldPersistQuery(query(["contentful", "force-update", "en-US"]))).toBe(true);
  });

  it("keeps an offline-critical query through a refetch error while it still has data", () => {
    expect(shouldPersistQuery(query(["workbook-version", "w1", "v1"], "error", { body: {} }))).toBe(
      true,
    );
  });

  it("drops an offline-critical query that has no data", () => {
    const q = { queryKey: ["experiments"], state: { status: "pending" } } as unknown as Query;
    expect(shouldPersistQuery(q)).toBe(false);
  });

  it("drops transient, device-state, and re-fetchable roots even with data", () => {
    expect(shouldPersistQuery(query(["is-online"]))).toBe(false);
    expect(shouldPersistQuery(query(["connected-device"]))).toBe(false);
    expect(shouldPersistQuery(query(["all-devices"]))).toBe(false);
    expect(shouldPersistQuery(query(["experiment-data", "e1"]))).toBe(false);
    expect(shouldPersistQuery(query(["measurement-result", {}, {}]))).toBe(false);
    expect(shouldPersistQuery(query(["protocol", "p1"]))).toBe(false);
    expect(shouldPersistQuery(query(["macro", "m1"]))).toBe(false);
    expect(shouldPersistQuery(query(["experiment-flow", "e1"]))).toBe(false);
  });

  it("ignores non-string key roots", () => {
    expect(shouldPersistQuery(query([{ scope: "experiments" }]))).toBe(false);
    expect(shouldPersistQuery(query([]))).toBe(false);
  });
});
