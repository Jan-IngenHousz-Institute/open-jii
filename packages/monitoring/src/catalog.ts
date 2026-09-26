import yaml from "js-yaml";

import type { CatalogMetric, CatalogPass } from "./types.js";

/** Placeholders let one catalog serve every environment; values come from the Lambda env. */
export function resolvePlaceholders(
  value: string,
  env: Record<string, string | undefined>,
): string {
  return value.replace(/\$\{([A-Z0-9_]+)\}/g, (match, name: string) => {
    const resolved = env[name];
    if (resolved === undefined || resolved === "") {
      throw new Error(`Unresolved catalog placeholder ${match}`);
    }
    return resolved;
  });
}

interface CatalogDocument {
  passes?: CatalogPass[];
  metrics?: CatalogMetric[];
}

/**
 * The catalog is an in-repo file whose shape the consistency tests enforce, which is why
 * yaml's unknown is narrowed here by one assertion rather than by a runtime schema that
 * would ship in every Lambda bundle.
 */
function loadDocument(source: string): CatalogDocument {
  return (yaml.load(source) as CatalogDocument | undefined) ?? {};
}

export function parseCatalog(source: string): CatalogMetric[] {
  return loadDocument(source).metrics ?? [];
}

export function parsePasses(source: string): CatalogPass[] {
  return loadDocument(source).passes ?? [];
}

/** Metrics the composer can actually query; everything else is documentation. */
export function activeSignals(metrics: CatalogMetric[]): CatalogMetric[] {
  return metrics.filter((metric) => metric.active && metric.signal);
}

/**
 * Folds an entry's per-environment baseline down to the one this digest should evaluate,
 * so nothing downstream has to know which environment it is running in.
 *
 * Measured in dev: the ingest consumer runs on a schedule, so its iterator age sits near
 * 2.8M ms and the shared 600000 threshold was above the reading in 315 of 316 hours. An
 * alert or a digest line that is always on is one nobody reads.
 */
export function resolveForEnvironment(
  metrics: CatalogMetric[],
  environment: string,
): CatalogMetric[] {
  return metrics.map((metric) => {
    const override = metric.baseline?.per_environment?.[environment];
    if (override === undefined) {
      return metric;
    }
    return { ...metric, baseline: override };
  });
}

export function buildQuery(
  metric: CatalogMetric,
  index: number,
  env: Record<string, string | undefined>,
) {
  const id = `m${index}`;
  const signal = metric.signal;

  if (!signal) {
    throw new Error(`Metric ${metric.id} has no signal`);
  }

  if (signal.search) {
    return { Id: id, Expression: resolvePlaceholders(signal.search, env), Period: 3600 };
  }

  return {
    Id: id,
    MetricStat: {
      Metric: {
        Namespace: signal.namespace,
        MetricName: signal.metric,
        Dimensions: Object.entries(signal.dimensions ?? {}).map(([name, value]) => ({
          Name: name,
          Value: resolvePlaceholders(String(value), env),
        })),
      },
      Period: 3600,
      Stat: signal.stat,
    },
  };
}

/** Every signal string that may carry a placeholder, whatever the signal kind. */
function placeholderBearingStrings(metric: CatalogMetric): string[] {
  const signal = metric.signal;
  if (!signal) {
    return [];
  }

  return [
    signal.search,
    signal.query,
    signal.logGroup,
    ...Object.values(signal.dimensions ?? {}).map(String),
  ].filter((value): value is string => typeof value === "string");
}

/**
 * Drops metrics whose placeholders cannot resolve, so one misconfigured entry
 * costs its own line rather than the whole digest.
 *
 * The probe is placeholder resolution, deliberately not buildQuery: buildQuery only
 * knows the CloudWatch shapes, so using it here would mark every entry of a newer
 * signal kind as misconfigured rather than simply unfetchable by this composer.
 */
export function partitionByConfig(
  metrics: CatalogMetric[],
  env: Record<string, string | undefined>,
): { usable: CatalogMetric[]; configErrors: string[] } {
  const usable: CatalogMetric[] = [];
  const configErrors: string[] = [];

  for (const metric of metrics) {
    try {
      placeholderBearingStrings(metric).forEach((value) => resolvePlaceholders(value, env));
      usable.push(metric);
    } catch {
      configErrors.push(metric.id);
    }
  }

  return { usable, configErrors };
}
