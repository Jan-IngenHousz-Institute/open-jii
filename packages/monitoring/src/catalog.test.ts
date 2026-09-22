import { describe, expect, it } from "vitest";

import {
  activeSignals,
  buildQuery,
  parseCatalog,
  partitionByConfig,
  resolvePlaceholders,
  resolveForEnvironment,
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

  it("keeps a signal kind this composer cannot fetch, rather than calling it misconfigured", () => {
    // buildQuery only knows the CloudWatch shapes. Probing with it would mark every
    // logs_insights entry as a config error instead of merely unfetchable here.
    const metrics = [
      metric({
        id: "route-latency",
        signal: {
          kind: "logs_insights",
          logGroup: "/aws/ecs/${ENVIRONMENT}-backend",
          query: "stats pct(duration, 95) by procedure",
          resultField: "pct_duration_95",
        },
      }),
    ];

    const { usable, configErrors } = partitionByConfig(metrics, env);

    expect(usable.map((entry) => entry.id)).toEqual(["route-latency"]);
    expect(configErrors).toEqual([]);
  });

  it("still flags an unresolved placeholder inside a non-CloudWatch signal", () => {
    const metrics = [
      metric({ id: "bad-logs", signal: { kind: "logs_insights", logGroup: "${NOPE}" } }),
    ];

    expect(partitionByConfig(metrics, env).configErrors).toEqual(["bad-logs"]);
  });
});

describe("resolveForEnvironment", () => {
  const entry: CatalogMetric = {
    num: 8,
    id: "ingest-lag",
    name: "Ingest lag",
    family: "observability",
    source: "aws",
    phase: "P1",
    active: true,
    slots: ["alert"],
    baseline: {
      method: "threshold",
      max: 600000,
      per_environment: { dev: { method: "threshold", max: 7200000 } },
    },
  };

  it("swaps in the named environment's rule", () => {
    const [resolved] = resolveForEnvironment([entry], "dev");

    expect(resolved.baseline).toEqual({ method: "threshold", max: 7200000 });
  });

  it("leaves an environment with no override on the shared rule", () => {
    const [resolved] = resolveForEnvironment([entry], "prod");

    expect(resolved.baseline?.max).toBe(600000);
  });

  it("drops per_environment so nothing downstream can read the wrong number", () => {
    const [resolved] = resolveForEnvironment([entry], "dev");

    expect(resolved.baseline?.per_environment).toBeUndefined();
  });

  it("does not mutate the entry it was given", () => {
    resolveForEnvironment([entry], "dev");

    expect(entry.baseline?.max).toBe(600000);
  });

  it("passes through an entry with no baseline at all", () => {
    const bare: CatalogMetric = { ...entry, baseline: undefined };

    expect(resolveForEnvironment([bare], "dev")[0].baseline).toBeUndefined();
  });
});
