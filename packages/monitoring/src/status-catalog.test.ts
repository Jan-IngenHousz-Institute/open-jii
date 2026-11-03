import { readFileSync } from "node:fs";
import { join, resolve } from "node:path";
import { describe, expect, it } from "vitest";

import { parseCatalog } from "./catalog.js";
import { statusSignals } from "./status-components.js";
import type { MetricDataQuery, StatusConfig, StatusRegion } from "./status-components.js";
import type { CatalogMetric } from "./types.js";

// Reads the real catalog, so a renamed metric or dimension fails here rather than reading
// no data for the status page forever.

const repoRoot = resolve(__dirname, "../../..");
const catalog = parseCatalog(
  readFileSync(join(repoRoot, "docs/monitoring/metrics-catalog.yaml"), "utf8"),
).filter((metric) => metric.active);

const HOME_REGION: StatusRegion = "eu-central-1";

const config: StatusConfig = {
  environment: "prod",
  albArnSuffix: "app/backend-alb/abc123",
  webDistributionId: "E2EXAMPLE",
  kinesisStreamName: "ingest-stream-prod",
};

const PLACEHOLDERS = new Map([
  ["ENVIRONMENT", config.environment],
  ["ALB_ARN_SUFFIX", config.albArnSuffix],
  ["CLOUDFRONT_DISTRIBUTION_ID", config.webDistributionId],
  ["KINESIS_STREAM_NAME", config.kinesisStreamName],
]);

interface Uncatalogued {
  namespace: string;
  metric: string;
  reason: string;
  /** The entry whose dimensions this one must share, when it has a sibling there. */
  dimensionsOf?: string;
}

const UNCATALOGUED: Uncatalogued[] = [
  {
    namespace: "AWS/ApplicationELB",
    metric: "HTTPCode_ELB_5XX_Count",
    reason: "The load balancer's own 5xx beside the target 5xx backend-5xx alerts on",
    dimensionsOf: "backend-5xx",
  },
  {
    namespace: "AWS/ApplicationELB",
    metric: "RequestCount",
    reason: "The requests the API's 5xx share is weighed against; no rule alerts on the count",
    dimensionsOf: "backend-5xx",
  },
  {
    namespace: "OpenJII/Backend",
    metric: "ExportsFailed",
    reason: "Not published yet; the exports component is not live and no producer emits it",
  },
];

/** What one catalogue entry reads from CloudWatch, in the terms a status query is compared in. */
interface CatalogRead {
  id: string;
  namespace: string;
  metrics: string[];
  stat: string;
  region: string;
  dimensions: Record<string, string>;
}

function resolvePlaceholders(value: string): string {
  return value.replace(
    /\$\{([A-Z0-9_]+)\}/g,
    (match, name: string) => PLACEHOLDERS.get(name) ?? match,
  );
}

function resolvedDimensions(
  dimensions: Record<string, string> | undefined,
): Record<string, string> {
  return Object.fromEntries(
    Object.entries(dimensions ?? {}).map(([name, value]) => [name, resolvePlaceholders(value)]),
  );
}

/** The dimension names a SEARCH schema fixes, such as `{AWS/IoT,ActionType,RuleName}`. */
function schemaOf(search: string): { namespace: string; dimensions: string[] } | undefined {
  const match = /^SEARCH\('\{([^}]+)\}/.exec(search);
  if (match === null) {
    return undefined;
  }
  const [namespace = "", ...dimensions] = match[1].split(",");
  return { namespace, dimensions };
}

function metricNamesIn(search: string): string[] {
  return [...search.matchAll(/MetricName="([^"]+)"/g)].map((match) => match[1]);
}

function readsOf(entry: CatalogMetric): CatalogRead[] {
  const { signal } = entry;
  if (signal?.stat === undefined) {
    return [];
  }

  const region = signal.region ?? HOME_REGION;
  const { stat } = signal;

  if (signal.search !== undefined) {
    const schema = schemaOf(signal.search);
    if (schema === undefined) {
      return [];
    }
    return [
      {
        id: entry.id,
        namespace: schema.namespace,
        metrics: metricNamesIn(signal.search),
        stat,
        region,
        dimensions: Object.fromEntries(schema.dimensions.map((name) => [name, "*"])),
      },
    ];
  }
  if (signal.namespace === undefined || signal.metric === undefined) {
    return [];
  }

  const dimensions = resolvedDimensions(signal.dimensions);
  const reads: CatalogRead[] = [
    {
      id: entry.id,
      namespace: signal.namespace,
      metrics: [signal.metric],
      stat,
      region,
      dimensions,
    },
  ];
  if (signal.request_count !== undefined) {
    reads.push({
      id: entry.id,
      namespace: signal.namespace,
      metrics: [signal.request_count.metric],
      stat: signal.request_count.stat,
      region,
      dimensions,
    });
  }
  return reads;
}

const catalogReads = catalog.flatMap(readsOf);

/** A status query in the same terms; `*` stands for a dimension a SEARCH leaves unfixed. */
interface StatusRead {
  signal: string;
  namespace: string;
  metrics: string[];
  stat: string;
  region: StatusRegion;
  dimensions: Record<string, string>;
  isSearch: boolean;
}

function statusReadOf(signal: string, region: StatusRegion, query: MetricDataQuery): StatusRead[] {
  if (query.MetricStat !== undefined) {
    const { Metric, Stat } = query.MetricStat;
    return [
      {
        signal,
        namespace: Metric.Namespace,
        metrics: [Metric.MetricName],
        stat: Stat,
        region,
        dimensions: Object.fromEntries(Metric.Dimensions.map((d) => [d.Name, d.Value])),
        isSearch: false,
      },
    ];
  }

  const search = /SEARCH\('(.*)', '(\w+)', \d+\)/.exec(query.Expression ?? "");
  if (search === null) {
    return [];
  }

  const text = `SEARCH('${search[1]}'`;
  const schema = schemaOf(text);
  if (schema === undefined) {
    throw new Error(`${signal} searches without a metric schema`);
  }
  return [
    {
      signal,
      namespace: schema.namespace,
      metrics: metricNamesIn(text),
      stat: search[2],
      region,
      dimensions: Object.fromEntries(schema.dimensions.map((name) => [name, "*"])),
      isSearch: true,
    },
  ];
}

const statusReads = statusSignals(config).flatMap((signal) =>
  [...signal.inputs, signal.query].flatMap((query) => statusReadOf(query.Id, signal.region, query)),
);

function isUncatalogued(read: StatusRead): boolean {
  return UNCATALOGUED.some(
    (entry) => entry.namespace === read.namespace && read.metrics.includes(entry.metric),
  );
}

function sorted(names: string[]): string[] {
  return [...names].sort();
}

/** An entry covers a read when it names the same metric, statistic, region and dimensions. */
function covers(entry: CatalogRead, read: StatusRead): boolean {
  const isSameDimensions =
    JSON.stringify(sorted(Object.keys(entry.dimensions))) ===
    JSON.stringify(sorted(Object.keys(read.dimensions)));
  const hasSameFixedValues = Object.entries(entry.dimensions).every(
    ([name, value]) => value === "*" || read.dimensions[name] === value,
  );

  return (
    entry.namespace === read.namespace &&
    read.metrics.every((metric) => entry.metrics.includes(metric)) &&
    entry.stat === read.stat &&
    entry.region === read.region &&
    isSameDimensions &&
    hasSameFixedValues
  );
}

describe("the status queries against the catalogue", () => {
  it("reads something, so a parser that found nothing cannot pass", () => {
    expect(catalogReads.length).toBeGreaterThan(50);
    expect(statusReads.length).toBeGreaterThan(15);
  });

  it("reads only metrics an active catalogue entry has, with its statistic, region and dimensions", () => {
    const uncovered = statusReads
      .filter((read) => !isUncatalogued(read))
      .filter((read) => !catalogReads.some((entry) => covers(entry, read)))
      .map((read) => `${read.signal}: ${read.namespace} ${read.metrics.join("|")} ${read.stat}`);

    expect(uncovered).toEqual([]);
  });

  it("reads the catalogue's own search for the same IoT metrics", () => {
    const iotSearches = statusReads.filter((read) => read.isSearch);

    expect(iotSearches.map((read) => read.signal).sort()).toEqual([
      "ingestForwardingFailures",
      "ingestPublished",
      "ingestRefusedPublishes",
    ]);
    expect(iotSearches.every((read) => read.namespace === "AWS/IoT")).toBe(true);
  });
});

describe("the uncatalogued reads", () => {
  it.each(UNCATALOGUED)("lists $namespace $metric because: $reason", (entry) => {
    const isRead = statusReads.some(
      (read) => read.namespace === entry.namespace && read.metrics.includes(entry.metric),
    );
    const isCatalogued = catalogReads.some(
      (read) => read.namespace === entry.namespace && read.metrics.includes(entry.metric),
    );

    expect(isRead).toBe(true);
    expect(isCatalogued).toBe(false);
  });

  it("shares each sibling entry's dimensions where it names one", () => {
    for (const entry of UNCATALOGUED) {
      if (entry.dimensionsOf === undefined) {
        continue;
      }

      const sibling = catalogReads.find((read) => read.id === entry.dimensionsOf);
      const reads = statusReads.filter(
        (read) => read.namespace === entry.namespace && read.metrics.includes(entry.metric),
      );

      expect(sibling).toBeDefined();
      for (const read of reads) {
        expect(read.dimensions).toEqual(sibling?.dimensions);
      }
    }
  });
});
