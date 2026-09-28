import type { Query } from "@tanstack/react-query";
import { describe, expect, it } from "vitest";

import { shouldPersistQuery } from "./persist-query-filter";

function query(queryKey: readonly unknown[], status = "success", data: unknown = {}): Query {
  return { queryKey, state: { status, data } } as unknown as Query;
}

// The shape @orpc/tanstack-query's generateOperationKey produces:
// [path, { input, type }] with `path` an array of segments.
function orpcKey(path: string[], input?: unknown, type = "query"): readonly unknown[] {
  return [path, { ...(input !== undefined ? { input } : {}), type }];
}

describe("shouldPersistQuery", () => {
  it("persists the offline-critical oRPC queries once they hold data", () => {
    expect(shouldPersistQuery(query(orpcKey(["users", "getUserProfile"])))).toBe(true);
    expect(
      shouldPersistQuery(query(orpcKey(["experiments", "listExperiments"], { scope: "related" }))),
    ).toBe(true);
    expect(
      shouldPersistQuery(
        query(orpcKey(["workbooks", "getWorkbookVersion"], { id: "w1", versionId: "v1" })),
      ),
    ).toBe(true);
  });

  it("persists the offline-critical plain-key roots", () => {
    expect(shouldPersistQuery(query(["precache-experiment-data", "e1"]))).toBe(true);
    expect(shouldPersistQuery(query(["contentful", "force-update", "en-US"]))).toBe(true);
  });

  it("keeps an offline-critical query through a refetch error while it still has data", () => {
    expect(
      shouldPersistQuery(
        query(
          orpcKey(["workbooks", "getWorkbookVersion"], { id: "w1", versionId: "v1" }),
          "error",
          {
            body: {},
          },
        ),
      ),
    ).toBe(true);
  });

  it("drops an offline-critical query that has no data", () => {
    const q = {
      queryKey: orpcKey(["experiments", "listExperiments"], { scope: "related" }),
      state: { status: "pending" },
    } as unknown as Query;
    expect(shouldPersistQuery(q)).toBe(false);
  });

  it("drops oRPC siblings of the persisted operations, even with data", () => {
    // Heavy or re-fetchable; only the listed operations may persist.
    expect(
      shouldPersistQuery(query(orpcKey(["experiments", "getExperimentData"], { id: "e1" }))),
    ).toBe(false);
    expect(shouldPersistQuery(query(orpcKey(["experiments", "getFlow"], { id: "e1" })))).toBe(
      false,
    );
    expect(shouldPersistQuery(query(orpcKey(["users", "getWhatsNewSeen"])))).toBe(false);
    expect(shouldPersistQuery(query(orpcKey(["protocols", "listProtocols"])))).toBe(false);
    expect(shouldPersistQuery(query(orpcKey(["workbooks", "listWorkbooks"])))).toBe(false);
  });

  it("drops transient, device-state, and re-fetchable roots even with data", () => {
    expect(shouldPersistQuery(query(["is-online"]))).toBe(false);
    expect(shouldPersistQuery(query(["connected-device"]))).toBe(false);
    expect(shouldPersistQuery(query(["all-devices"]))).toBe(false);
    expect(shouldPersistQuery(query(["measurement-result", {}, {}]))).toBe(false);
    expect(shouldPersistQuery(query(["macro", "m1"]))).toBe(false);
  });

  describe("listExperiments is admitted by input, not by operation", () => {
    it("persists the unpaged related list the picker and Home read", () => {
      expect(
        shouldPersistQuery(
          query(orpcKey(["experiments", "listExperiments"], { scope: "related" })),
        ),
      ).toBe(true);
    });

    it("rejects a paged discovery key: maxAge and gcTime are both infinite here", () => {
      expect(
        shouldPersistQuery(
          query(
            orpcKey(["experiments", "listExperiments"], {
              scope: "all",
              page: 1,
              pageSize: 20,
              search: "canopy",
            }),
          ),
        ),
      ).toBe(false);
    });

    it("rejects a paged key whatever the shape the infinite query gives it", () => {
      expect(
        shouldPersistQuery(
          query(
            orpcKey(
              ["experiments", "listExperiments"],
              { scope: "all", page: 1, pageSize: 20, search: undefined },
              "infinite",
            ),
          ),
        ),
      ).toBe(false);
    });

    it("rejects the unpaged all-scope list too: only related is offline-critical", () => {
      expect(
        shouldPersistQuery(query(orpcKey(["experiments", "listExperiments"], { scope: "all" }))),
      ).toBe(false);
    });

    it("rejects a listExperiments key with no input at all", () => {
      expect(shouldPersistQuery(query(orpcKey(["experiments", "listExperiments"])))).toBe(false);
    });

    it("ignores an undefined sibling that oRPC leaves on the related input", () => {
      expect(
        shouldPersistQuery(
          query(
            orpcKey(["experiments", "listExperiments"], { scope: "related", search: undefined }),
          ),
        ),
      ).toBe(true);
    });
  });

  it("ignores key roots that are neither strings nor string arrays", () => {
    expect(shouldPersistQuery(query([{ scope: "experiments" }]))).toBe(false);
    expect(shouldPersistQuery(query([["experiments", 42]]))).toBe(false);
    expect(shouldPersistQuery(query([]))).toBe(false);
  });
});
