import { describe, expect, it } from "vitest";

import { foldObservedExperiments } from "./observed-experiments";

const EXPERIMENT_A = "11111111-1111-4111-8111-111111111111";
const EXPERIMENT_B = "22222222-2222-4222-8222-222222222222";

describe("foldObservedExperiments", () => {
  it("totals per experiment, keeps the newest bucket, and orders busiest first", () => {
    const folded = foldObservedExperiments([
      { bucketStart: "2026-08-20T00:00:00.000Z", experimentId: EXPERIMENT_A, count: 5 },
      { bucketStart: "2026-08-22T00:00:00.000Z", experimentId: EXPERIMENT_A, count: 2 },
      { bucketStart: "2026-08-21T00:00:00.000Z", experimentId: EXPERIMENT_B, count: 9 },
    ]);

    expect(folded).toEqual([
      { experimentId: EXPERIMENT_B, count: 9, lastAt: "2026-08-21T00:00:00.000Z" },
      { experimentId: EXPERIMENT_A, count: 7, lastAt: "2026-08-22T00:00:00.000Z" },
    ]);
  });

  it("keeps unattributed rows as their own honest bucket", () => {
    const folded = foldObservedExperiments([
      { bucketStart: "2026-08-19T00:00:00.000Z", experimentId: null, count: 3 },
    ]);

    expect(folded).toEqual([{ experimentId: null, count: 3, lastAt: "2026-08-19T00:00:00.000Z" }]);
  });

  it("survives rows without a bucket timestamp", () => {
    const folded = foldObservedExperiments([
      { bucketStart: null, experimentId: EXPERIMENT_A, count: 4 },
    ]);

    expect(folded).toEqual([{ experimentId: EXPERIMENT_A, count: 4, lastAt: null }]);
  });
});
