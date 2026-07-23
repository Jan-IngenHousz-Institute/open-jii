import { describe, expect, it } from "vitest";

import {
  zCreateExperimentVisualizationBody,
  zExperimentChartDataConfig,
  zExperimentChartFamily,
  zExperimentChartType,
  zExperimentDataSourceConfig,
  zExperimentRole,
  zExperimentVisualization,
  zExperimentVisualizationPathParam,
  zListExperimentVisualizationsQuery,
} from "./experiment-visualizations.schema";

describe("enums", () => {
  it("zExperimentChartFamily accepts the four families", () => {
    ["basic", "scientific", "3d", "statistical"].forEach((f) =>
      expect(zExperimentChartFamily.parse(f)).toBe(f),
    );
    expect(zExperimentChartFamily.safeParse("fancy").success).toBe(false);
  });

  it("zExperimentChartType accepts a known type and rejects an unknown one", () => {
    expect(zExperimentChartType.parse("line")).toBe("line");
    expect(zExperimentChartType.parse("correlation-matrix")).toBe("correlation-matrix");
    expect(zExperimentChartType.safeParse("pie-3d").success).toBe(false);
  });

  it("zExperimentRole accepts encoding roles", () => {
    ["x", "y", "z", "color", "size", "facet", "groupBy"].forEach((r) =>
      expect(zExperimentRole.parse(r)).toBe(r),
    );
    expect(zExperimentRole.safeParse("depth").success).toBe(false);
  });
});

describe("zExperimentDataSourceConfig", () => {
  it("accepts a minimal source and defaults optional fields to undefined", () => {
    const parsed = zExperimentDataSourceConfig.parse({
      tableName: "raw_data",
      columnName: "temp",
      role: "y",
    });
    expect(parsed.traceType).toBeUndefined();
    expect(parsed.aggregate).toBeUndefined();
  });

  it("accepts per-series overrides", () => {
    const parsed = zExperimentDataSourceConfig.parse({
      tableName: "raw_data",
      columnName: "temp",
      role: "y",
      traceType: "bar",
      axis: "secondary",
      aggregate: "avg",
    });
    expect(parsed.traceType).toBe("bar");
    expect(parsed.axis).toBe("secondary");
  });

  it("rejects an invalid role", () => {
    expect(
      zExperimentDataSourceConfig.safeParse({ tableName: "t", columnName: "c", role: "nope" })
        .success,
    ).toBe(false);
  });
});

describe("zExperimentChartDataConfig", () => {
  const source = { tableName: "raw_data", columnName: "temp", role: "y" as const };

  it("requires at least one data source", () => {
    expect(
      zExperimentChartDataConfig.safeParse({ tableName: "raw_data", dataSources: [] }).success,
    ).toBe(false);
    expect(
      zExperimentChartDataConfig.safeParse({ tableName: "raw_data", dataSources: [source] })
        .success,
    ).toBe(true);
  });

  it("accepts optional filters and aggregation", () => {
    const parsed = zExperimentChartDataConfig.parse({
      tableName: "raw_data",
      dataSources: [source],
      filters: [{ column: "site", operator: "equals", value: "A" }],
      aggregation: { functions: [{ column: "temp", function: "avg" }] },
    });
    expect(parsed.filters).toHaveLength(1);
  });
});

describe("zExperimentVisualization + CRUD", () => {
  const dataConfig = {
    tableName: "raw_data",
    dataSources: [{ tableName: "raw_data", columnName: "temp", role: "y" as const }],
  };

  it("accepts a full visualization", () => {
    const viz = {
      id: "11111111-1111-1111-1111-111111111111",
      name: "Temp over time",
      description: null,
      experimentId: "22222222-2222-2222-2222-222222222222",
      chartFamily: "basic" as const,
      chartType: "line" as const,
      config: undefined,
      dataConfig,
      createdBy: "33333333-3333-3333-3333-333333333333",
      createdAt: "2024-01-01T00:00:00.000Z",
      updatedAt: "2024-01-01T00:00:00.000Z",
    };
    expect(zExperimentVisualization.parse(viz)).toMatchObject({ id: viz.id, chartType: "line" });
  });

  it("zCreateExperimentVisualizationBody requires a name", () => {
    expect(
      zCreateExperimentVisualizationBody.safeParse({
        name: "",
        chartFamily: "basic",
        chartType: "line",
        dataConfig,
      }).success,
    ).toBe(false);
  });

  it("zListExperimentVisualizationsQuery coerces and defaults paging", () => {
    const parsed = zListExperimentVisualizationsQuery.parse({});
    expect(parsed.limit).toBe(50);
    expect(parsed.offset).toBe(0);
  });

  it("zExperimentVisualizationPathParam validates both ids", () => {
    expect(() =>
      zExperimentVisualizationPathParam.parse({
        id: "11111111-1111-1111-1111-111111111111",
        visualizationId: "x",
      }),
    ).toThrow();
  });
});
