import { describe, expect, it } from "vitest";

import {
  activeSignals,
  buildQuery,
  parseCatalog,
  partitionByConfig,
  resolvePlaceholders,
} from "./catalog.js";
import type { CatalogMetric } from "./types.js";

const env = { ENVIRONMENT: "dev", KINESIS_STREAM_NAME: "ingest-dev" };

function metric(overrides: Partial<CatalogMetric>): CatalogMetric {
  return {
    num: 1,
    id: "test-metric",
    name: "Test metric",
    family: "observability",
    source: "aws",
    phase: "P1",
    active: true,
    slots: ["exception"],
    ...overrides,
  };
}

describe("resolvePlaceholders", () => {
  it("substitutes environment values", () => {
    expect(resolvePlaceholders("stream=${KINESIS_STREAM_NAME}", env)).toBe("stream=ingest-dev");
  });

  it("throws on an unresolved placeholder rather than querying a literal", () => {
    expect(() => resolvePlaceholders("${MISSING}", env)).toThrow("Unresolved catalog placeholder");
  });

  it("treats an empty environment value as unresolved", () => {
    expect(() => resolvePlaceholders("${BLANK}", { BLANK: "" })).toThrow();
  });
});

describe("parseCatalog", () => {
  it("returns the metrics list", () => {
    const parsed = parseCatalog("version: 1\nmetrics:\n  - num: 1\n    id: a\n    active: true\n");
    expect(parsed).toHaveLength(1);
    expect(parsed[0]?.id).toBe("a");
  });

  it("tolerates a catalog with no metrics", () => {
    expect(parseCatalog("version: 1\n")).toEqual([]);
  });
});

describe("activeSignals", () => {
  it("keeps only active metrics that have a signal to query", () => {
    const metrics = [
      metric({ id: "queryable", signal: { namespace: "N", metric: "M", stat: "Sum" } }),
      metric({ id: "inactive", active: false, signal: { namespace: "N", metric: "M" } }),
      metric({ id: "documentation-only" }),
    ];

    expect(activeSignals(metrics).map((entry) => entry.id)).toEqual(["queryable"]);
  });
});

describe("buildQuery", () => {
  it("builds a metric-stat query with resolved dimensions", () => {
    const query = buildQuery(
      metric({
        signal: {
          namespace: "OpenJII/Data",
          metric: "CollectorHeartbeat",
          stat: "Maximum",
          dimensions: { Environment: "${ENVIRONMENT}" },
        },
      }),
      3,
      env,
    );

    expect(query).toMatchObject({
      Id: "m3",
      MetricStat: {
        Metric: {
          Namespace: "OpenJII/Data",
          MetricName: "CollectorHeartbeat",
          Dimensions: [{ Name: "Environment", Value: "dev" }],
        },
        Stat: "Maximum",
      },
    });
  });

  it("builds a search expression query", () => {
    const query = buildQuery(
      metric({
        signal: { search: "SEARCH('{AWS/Kinesis} ${KINESIS_STREAM_NAME}', 'Sum')", stat: "Sum" },
      }),
      0,
      env,
    );

    expect(query).toEqual({
      Id: "m0",
      Expression: "SEARCH('{AWS/Kinesis} ingest-dev', 'Sum')",
      Period: 3600,
    });
  });
});

describe("partitionByConfig", () => {
  it("drops only the misconfigured metric so the digest still renders", () => {
    const metrics = [
      metric({ id: "good", signal: { namespace: "N", metric: "M", stat: "Sum" } }),
      metric({
        id: "broken",
        signal: { namespace: "N", metric: "M", dimensions: { X: "${NOPE}" } },
      }),
    ];

    const { usable, configErrors } = partitionByConfig(metrics, env);

    expect(usable.map((entry) => entry.id)).toEqual(["good"]);
    expect(configErrors).toEqual(["broken"]);
  });
});
