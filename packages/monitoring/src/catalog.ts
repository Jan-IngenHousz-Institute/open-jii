import yaml from "js-yaml";

import type { CatalogMetric } from "./types.js";

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

export function parseCatalog(source: string): CatalogMetric[] {
  const parsed = yaml.load(source) as { metrics?: CatalogMetric[] } | undefined;
  return parsed?.metrics ?? [];
}

/** Metrics the composer can actually query; everything else is documentation. */
export function activeSignals(metrics: CatalogMetric[]): CatalogMetric[] {
  return metrics.filter((metric) => metric.active && metric.signal);
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

/**
 * Drops metrics whose placeholders cannot resolve, so one misconfigured entry
 * costs its own line rather than the whole digest.
 */
export function partitionByConfig(
  metrics: CatalogMetric[],
  env: Record<string, string | undefined>,
): { usable: CatalogMetric[]; configErrors: string[] } {
  const usable: CatalogMetric[] = [];
  const configErrors: string[] = [];

  for (const metric of metrics) {
    try {
      buildQuery(metric, 0, env);
      usable.push(metric);
    } catch {
      configErrors.push(metric.id);
    }
  }

  return { usable, configErrors };
}
