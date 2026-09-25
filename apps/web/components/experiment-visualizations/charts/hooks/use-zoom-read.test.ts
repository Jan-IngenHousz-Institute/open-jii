import { createExperimentDataTable } from "@/test/factories";
import type { SpyCall } from "@/test/msw/mount";
import { server } from "@/test/msw/server";
import { renderHook, waitFor } from "@/test/test-utils";
import { describe, expect, it } from "vitest";

import { contract } from "@repo/api/contract";
import { zExperimentDataAggregation } from "@repo/api/domains/experiment/data/experiment-data.schema";
import type { ExperimentDataAggregation } from "@repo/api/domains/experiment/data/experiment-data.schema";

import { useZoomRead } from "./use-zoom-read";
import type { ZoomReadInput } from "./use-zoom-read";

const DAY_START = "2026-09-25T00:00:00.000Z";
const DAY_END = "2026-09-26T00:00:00.000Z";

const INPUT: ZoomReadInput = {
  experimentId: "exp-1",
  tableName: "raw_data",
  filters: [{ column: "device_id", operator: "equals", value: "d1" }],
  xColumn: "timestamp",
  scale: "time",
  yColumns: ["fluo"],
  splitColumns: ["device_id"],
  readColumns: ["timestamp", "fluo", "device_id"],
  window: undefined,
  enabled: true,
};

function table(rows: Record<string, unknown>[]) {
  return [
    createExperimentDataTable({
      data: { columns: [], rows, totalRows: rows.length, truncated: false },
    }),
  ];
}

function aggregationOf(call: SpyCall): ExperimentDataAggregation | undefined {
  return call.query.aggregation
    ? zExperimentDataAggregation.parse(JSON.parse(call.query.aggregation))
    : undefined;
}

function answer(bucketCounts: number[]) {
  return (call: SpyCall) => {
    const aggregation = aggregationOf(call);
    if (aggregation?.groupBy) {
      return table(
        bucketCounts.map((count, i) => ({
          timestamp_bucket: String(i),
          device_id: "d1",
          x_from: `2026-09-25T0${i}:00:00.000Z`,
          x_to: `2026-09-25T0${i}:30:00.000Z`,
          y0_low: String(i),
          y0_high: String(i + 10),
          rows: String(count),
        })),
      );
    }
    if (aggregation) {
      return table([{ x_from: DAY_START, x_to: DAY_END }]);
    }
    return table([{ timestamp: "2026-09-25T01:00:00.000Z", fluo: "0.4", device_id: "d1" }]);
  };
}

describe("useZoomRead", () => {
  it("draws the whole series from buckets when it is longer than one read", async () => {
    const spy = server.mount(contract.experiments.getExperimentData, {
      body: answer([150_000, 100_000]),
    });

    const { result } = renderHook(() => useZoomRead(INPUT));

    await waitFor(() => expect(result.current.rows).toBeDefined());
    expect(result.current.isBucketed).toBe(true);
    expect(result.current.total).toBe(250_000);
    expect(result.current.rows).toEqual([
      { device_id: "d1", fluo: "0", timestamp: "2026-09-25T00:00:00.000Z" },
      { device_id: "d1", fluo: "10", timestamp: "2026-09-25T00:30:00.000Z" },
      { device_id: "d1", fluo: "1", timestamp: "2026-09-25T01:00:00.000Z" },
      { device_id: "d1", fluo: "11", timestamp: "2026-09-25T01:30:00.000Z" },
    ]);

    const bucketCall = spy.calls.find((call) => aggregationOf(call)?.groupBy !== undefined);
    if (!bucketCall) {
      throw new Error("No bucket read was made");
    }
    const bucket = aggregationOf(bucketCall)?.groupBy?.[0];
    expect(bucket?.widthBucket).toEqual({
      origin: Date.parse(DAY_START),
      width: (Date.parse(DAY_END) - Date.parse(DAY_START)) / 2_000,
      scale: "time",
    });
    expect(JSON.parse(bucketCall.query.filters)).toEqual([
      { column: "device_id", operator: "equals", value: "d1" },
      { column: "timestamp", operator: "between", value: [DAY_START, DAY_END] },
    ]);
  });

  it("reads the window's rows whole once they fit in one read", async () => {
    server.mount(contract.experiments.getExperimentData, { body: answer([300, 200]) });

    const { result } = renderHook(() =>
      useZoomRead({
        ...INPUT,
        window: [Date.parse("2026-09-25T01:00:00Z"), Date.parse("2026-09-25T02:00:00Z")],
      }),
    );

    await waitFor(() =>
      expect(result.current.rows).toEqual([
        { timestamp: "2026-09-25T01:00:00.000Z", fluo: "0.4", device_id: "d1" },
      ]),
    );
    expect(result.current.isBucketed).toBe(false);
    expect(result.current.total).toBe(500);
  });

  it("reads nothing while disabled", () => {
    const spy = server.mount(contract.experiments.getExperimentData, { body: answer([1]) });

    const { result } = renderHook(() => useZoomRead({ ...INPUT, enabled: false }));

    expect(result.current.rows).toBeUndefined();
    expect(spy.callCount).toBe(0);
  });
});
