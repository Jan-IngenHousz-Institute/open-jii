import { readFileSync, readdirSync } from "node:fs";
import { join, resolve } from "node:path";
import { describe, expect, it } from "vitest";

import { activeSignals, parseCatalog, parsePasses, partitionByConfig } from "./catalog.js";
import { ALLOWED_NAMESPACES } from "./forwarder.js";
import type { CatalogMetric, MetricBaseline } from "./types.js";

// These tests read the real catalog, not fixtures. Their job is to make the hand checks
// that would otherwise happen at review time fail loudly at test time instead.

const repoRoot = resolve(__dirname, "../../..");
const catalogSource = readFileSync(join(repoRoot, "docs/monitoring/metrics-catalog.yaml"), "utf8");
const composerTerraform = readFileSync(
  join(repoRoot, "infrastructure/modules/monitoring/digest-composer/main.tf"),
  "utf8",
);
const runbookFiles = readdirSync(join(repoRoot, "docs/runbooks")).filter((name) =>
  name.endsWith(".md"),
);
const heartbeatConstants = readFileSync(
  join(repoRoot, "apps/data/src/lib/openjii/openjii/heartbeat/constants.py"),
  "utf8",
);

// Named so a failure says where to look. The rules live in terraform and the entries live
// in yaml, so a mismatch is otherwise a hunt through two languages.
const grafanaRulesPath = "infrastructure/modules/grafana/dashboard/main.tf";
const grafanaRules = readFileSync(join(repoRoot, grafanaRulesPath), "utf8");

const metrics = parseCatalog(catalogSource);
const passes = parsePasses(catalogSource);

const KNOWN_FAMILIES = ["observability", "usage"];
const KNOWN_SLOTS = ["alert", "exception", "pulse", "weekly", "dashboard", "s3"];
const KNOWN_SOURCES = ["aws", "dbx", "pg", "posthog", "gh", "composer"];
const KNOWN_STATS = ["Sum", "Maximum", "Minimum", "Average", "SampleCount"];
const DIGEST_SLOTS = ["exception", "alert", "pulse", "weekly"];

// Only these signal fields are passed through placeholder resolution; a placeholder
// anywhere else is sent to CloudWatch as a literal and matches nothing forever.
const RESOLVED_FIELDS = ["search", "query", "logGroup", "dimensions"];

function numsIssuedByPasses(): Set<number> {
  const issued = new Set<number>();
  for (const pass of passes) {
    const [from, to] = pass.range;
    const gaps = new Set(pass.gaps ?? []);
    for (let num = from; num <= to; num += 1) {
      if (!gaps.has(num)) {
        issued.add(num);
      }
    }
  }
  return issued;
}

function placeholdersIn(value: unknown): string[] {
  const matches = JSON.stringify(value ?? {}).matchAll(/\$\{([A-Z0-9_]+)\}/g);
  return [...matches].map(([, name]) => name);
}

function composerEnvironmentKeys(): Set<string> {
  const blocks = composerTerraform.split("variables = {");
  expect(blocks.length, "exactly one environment block in the composer module").toBe(2);

  // The block ends at the first line that is only a closing brace, so a value
  // containing an interpolation's braces does not truncate it.
  const body = blocks[1].split(/\n\s*}\s*\n/)[0];
  return new Set([...body.matchAll(/^\s+([A-Z][A-Z0-9_]*)\s+=/gm)].map(([, key]) => key));
}

interface AlertRule {
  metricId: string;
  severity: string;
}

/** Every Grafana rule that claims a catalog entry, with the severity it routes on. */
function alertRules(): AlertRule[] {
  const rules: AlertRule[] = [];

  for (const [, body] of grafanaRules.matchAll(/labels = \{([^}]*)\}/g)) {
    const id = /metric_id\s*=\s*"([^"]+)"/.exec(body);
    if (id === null) {
      continue;
    }
    const severity = /severity\s*=\s*"([^"]+)"/.exec(body);
    rules.push({ metricId: id[1], severity: severity === null ? "" : severity[1] });
  }

  return rules;
}

function digestEvaluated(metric: CatalogMetric): boolean {
  return (
    metric.family === "observability" &&
    (metric.slots.includes("exception") || metric.slots.includes("alert"))
  );
}

function renderedBySomeDigest(metric: CatalogMetric): boolean {
  return metric.slots.some((slot) => DIGEST_SLOTS.includes(slot));
}

function isKnownStat(stat: string | undefined): boolean {
  return stat !== undefined && (KNOWN_STATS.includes(stat) || /^p\d{1,2}(\.\d+)?$/.test(stat));
}

// A rule the daily digest cannot act on: the entry looks configured and can never fire.
function isInertForDigest(rule: MetricBaseline): boolean {
  if (rule.nodata === "alert" || rule.anomaly === "any-nonzero") {
    return false;
  }
  if (rule.method === "threshold") {
    return rule.max === undefined;
  }
  return typeof rule.anomaly_pct !== "number";
}

function seriesKey(metric: CatalogMetric): string {
  const signal = metric.signal ?? {};
  const dimensions = Object.entries(signal.dimensions ?? {}).sort(([a], [b]) => a.localeCompare(b));
  return JSON.stringify({
    kind: signal.kind ?? "cloudwatch",
    namespace: signal.namespace,
    metric: signal.metric,
    search: signal.search,
    query: signal.query,
    logGroup: signal.logGroup,
    stat: signal.stat,
    region: signal.region,
    dimensions,
  });
}

describe("catalog numbering", () => {
  it("loads a non-trivial catalog", () => {
    expect(metrics.length).toBeGreaterThan(50);
    expect(passes.length).toBeGreaterThan(0);
  });

  it("never reuses a num or an id", () => {
    expect(new Set(metrics.map((m) => m.num)).size).toBe(metrics.length);
    expect(new Set(metrics.map((m) => m.id)).size).toBe(metrics.length);
  });

  it("issues every num through a recorded pass and every recorded num exists", () => {
    // Append-only means the passes block and the entries describe the same set. A num
    // that appears in one and not the other is either reused, skipped, or undocumented.
    const issued = numsIssuedByPasses();
    const present = new Set(metrics.map((m) => m.num));

    expect([...present].filter((n) => !issued.has(n))).toEqual([]);
    expect([...issued].filter((n) => !present.has(n))).toEqual([]);
  });

  it("records passes in ascending, non-overlapping ranges with gaps inside their own range", () => {
    // Two passes claiming the same num is the one thing the block exists to prevent,
    // and a Set-based union would silently accept it.
    for (let i = 0; i < passes.length; i += 1) {
      const [from, to] = passes[i].range;
      expect(from, `pass ${i} range order`).toBeLessThanOrEqual(to);
      for (const gap of passes[i].gaps ?? []) {
        expect(gap, `pass ${i} gap ${gap}`).toBeGreaterThanOrEqual(from);
        expect(gap, `pass ${i} gap ${gap}`).toBeLessThanOrEqual(to);
      }
      if (i > 0) {
        expect(from, `pass ${i} starts after pass ${i - 1}`).toBeGreaterThan(
          passes[i - 1].range[1],
        );
      }
    }
  });

  it("ends the newest pass at the highest num", () => {
    const newest = passes[passes.length - 1];
    expect(newest.range[1]).toBe(Math.max(...metrics.map((m) => m.num)));
  });

  it("uses kebab-case ids so they survive as Slack text and CLI arguments", () => {
    const offenders = metrics.filter((m) => !/^[a-z0-9]+(-[a-z0-9]+)*$/.test(m.id));
    expect(offenders.map((m) => m.id)).toEqual([]);
  });
});

describe("catalog vocabulary", () => {
  it("uses only known families, slots, sources and stats", () => {
    const badFamily = metrics.filter((m) => !KNOWN_FAMILIES.includes(m.family));
    const badSlot = metrics.filter((m) => m.slots.some((s) => !KNOWN_SLOTS.includes(s)));
    const badSource = metrics.filter((m) => !KNOWN_SOURCES.includes(m.source));
    const badStat = metrics.filter((m) => m.signal && !isKnownStat(m.signal.stat));

    expect(badFamily.map((m) => m.id)).toEqual([]);
    expect(badSlot.map((m) => m.id)).toEqual([]);
    expect(badSource.map((m) => m.id)).toEqual([]);
    expect(badStat.map((m) => m.id)).toEqual([]);
  });

  it("names every entry, since the digest prints the name", () => {
    expect(metrics.filter((m) => !m.name).map((m) => m.id)).toEqual([]);
  });

  it("pairs severity with the alert slot in both directions, since routing depends on it", () => {
    const alertWithout = metrics.filter((m) => m.slots.includes("alert") && !m.severity);
    const severityWithout = metrics.filter((m) => m.severity && !m.slots.includes("alert"));

    expect(alertWithout.map((m) => m.id)).toEqual([]);
    expect(severityWithout.map((m) => m.id)).toEqual([]);
  });
});

describe("runbooks", () => {
  it("resolves every runbook path to a file", () => {
    const missing = metrics
      .filter((m) => m.runbook)
      .filter((m) => !runbookFiles.includes(m.runbook?.replace("docs/runbooks/", "") ?? ""));
    expect(missing.map((m) => m.runbook)).toEqual([]);
  });

  it("references every runbook file from exactly one entry", () => {
    // A runbook shared by two entries answers neither question well; a runbook nothing
    // references is dead weight the next editor will trust anyway.
    const referenced = metrics.flatMap((m) => (m.runbook ? [m.runbook] : []));
    const counts = new Map<string, number>();
    for (const path of referenced) {
      counts.set(path, (counts.get(path) ?? 0) + 1);
    }

    const shared = [...counts].filter(([, n]) => n > 1).map(([path]) => path);
    const orphans = runbookFiles.filter((f) => !counts.has(`docs/runbooks/${f}`));

    expect(shared).toEqual([]);
    expect(orphans).toEqual([]);
  });

  it("attaches runbooks to observability entries only", () => {
    const offenders = metrics.filter((m) => m.runbook && m.family !== "observability");
    expect(offenders.map((m) => m.id)).toEqual([]);
  });
});

describe("active entries", () => {
  it("carry a signal unless the composer itself produces them", () => {
    const offenders = metrics.filter((m) => m.active && !m.signal && m.source !== "composer");
    expect(offenders.map((m) => m.id)).toEqual([]);
  });

  it("are rendered by at least one digest", () => {
    // Active with a signal but only dashboard or s3 slots is fetched by the composer
    // and shown nowhere. Dashboard-only entries are inactive by convention.
    const offenders = metrics.filter((m) => m.active && m.signal && !renderedBySomeDigest(m));
    expect(offenders.map((m) => m.id)).toEqual([]);
  });

  it("only put usage entries in the pulse, which the composer filters by family", () => {
    const offenders = metrics.filter(
      (m) => m.active && m.slots.includes("pulse") && m.family !== "usage",
    );
    expect(offenders.map((m) => m.id)).toEqual([]);
  });

  it("carry a baseline rule the daily digest can act on when it will evaluate them", () => {
    // A bare method with no threshold or percentage passes a presence check and
    // returns "ok" from evaluate() unconditionally.
    const offenders = metrics.filter(
      (m) =>
        m.active &&
        digestEvaluated(m) &&
        m.source !== "composer" &&
        (!m.baseline || isInertForDigest(m.baseline)),
    );
    expect(offenders.map((m) => m.id)).toEqual([]);
  });

  it("are all queryable once the composer's environment is fully populated", () => {
    const fullEnvironment = Object.fromEntries(
      [...composerEnvironmentKeys()].map((key) => [key, `value-for-${key}`]),
    );
    const { configErrors } = partitionByConfig(activeSignals(metrics), fullEnvironment);
    expect(configErrors).toEqual([]);
  });
});

describe("signals", () => {
  it("put a nodata rule only on a Maximum stat", () => {
    // An absent Sum is normalized to zero before evaluation, so a nodata rule on a Sum
    // can never fire. The catalog would look right and the dead-man would be inert.
    const offenders = metrics.filter(
      (m) => m.baseline?.nodata === "alert" && m.signal?.stat !== "Maximum",
    );
    expect(offenders.map((m) => m.id)).toEqual([]);
  });

  it("declare either a search expression or a metric name, never both", () => {
    // buildQuery returns on search first and silently discards the metric.
    const offenders = metrics.filter((m) => m.signal?.search && m.signal.metric);
    expect(offenders.map((m) => m.id)).toEqual([]);
  });

  it("never query the same series from two entries", () => {
    const byKey = new Map<string, string[]>();
    for (const metric of metrics.filter((m) => m.signal)) {
      const key = seriesKey(metric);
      byKey.set(key, [...(byKey.get(key) ?? []), metric.id]);
    }
    const duplicates = [...byKey.values()].filter((ids) => ids.length > 1);
    expect(duplicates).toEqual([]);
  });

  it("use placeholders only in the fields the composer resolves", () => {
    const offenders = metrics.flatMap((m) => {
      const signal: Record<string, unknown> = { ...(m.signal ?? {}) };
      for (const field of RESOLVED_FIELDS) {
        delete signal[field];
      }
      return placeholdersIn(signal).map((name) => ({ id: m.id, name }));
    });
    expect(offenders).toEqual([]);
  });

  it("name the same series the heartbeat exporter emits, in both directions", () => {
    // The exporter and the catalog hard-code these names independently, so a rename on
    // either side leaves both test suites green while the series the rules watch goes
    // dark. Nothing else in either language compares the two.
    const emitted = new Set(
      [...heartbeatConstants.matchAll(/^[A-Z0-9_]+_METRIC = "([^"]+)"/gm)].map(([, name]) => name),
    );
    expect(emitted.size).toBeGreaterThan(5);

    // Scoped by the forwarder's own allowlist, which is the set of namespaces the
    // exporter can reach; OpenJII/UserRegistrations has a different producer.
    const catalogued = metrics.filter(
      (m) => m.signal?.namespace && ALLOWED_NAMESPACES.has(m.signal.namespace),
    );

    expect(catalogued.filter((m) => !emitted.has(m.signal?.metric ?? "")).map((m) => m.id)).toEqual(
      [],
    );
    expect(
      [...emitted].filter((name) => !catalogued.some((m) => m.signal?.metric === name)),
    ).toEqual([]);
  });

  it("use only placeholders the composer's terraform actually provides", () => {
    // A placeholder with no matching env var is a config error at runtime, which excludes
    // the metric from every digest silently until someone reads the Lambda log.
    const provided = composerEnvironmentKeys();
    expect(provided.size).toBeGreaterThan(5);

    const unprovided = metrics
      .flatMap((m) => placeholdersIn(m.signal).map((name) => ({ id: m.id, name })))
      .filter(({ name }) => !provided.has(name));
    expect(unprovided).toEqual([]);
  });
});

describe("catalog and grafana rules cannot drift", () => {
  // The catalog is what the digest reads and the runbooks cite; the rules are what wakes
  // someone. Nothing else compares them, and they are edited months apart.

  it("gives every active alert entry a rule that claims it", () => {
    const claimed = new Set(alertRules().map((rule) => rule.metricId));
    const unwatched = metrics
      .filter((m) => m.active && m.slots.includes("alert"))
      .filter((m) => !claimed.has(m.id));

    expect(
      unwatched.map((m) => m.id),
      `active alert entries with no rule in ${grafanaRulesPath}`,
    ).toEqual([]);
  });

  it("points every rule at an entry that actually carries an alert slot", () => {
    // A metric_id that resolves to nothing, or to a dashboard-only entry, means the rule
    // links to a runbook and a severity the catalog never agreed to.
    const byId = new Map(metrics.map((m) => [m.id, m]));
    const orphans = alertRules().filter(
      (rule) => !byId.get(rule.metricId)?.slots.includes("alert"),
    );

    expect(
      orphans.map((rule) => rule.metricId),
      `metric_id labels in ${grafanaRulesPath} with no alert-slot entry`,
    ).toEqual([]);
  });

  it("agrees on severity, since that is what decides the destination", () => {
    const byId = new Map(metrics.map((m) => [m.id, m]));
    const mismatched = alertRules()
      .filter((rule) => byId.has(rule.metricId))
      .filter((rule) => rule.severity !== byId.get(rule.metricId)?.severity)
      .map((rule) => ({
        metricId: rule.metricId,
        rule: rule.severity,
        catalog: byId.get(rule.metricId)?.severity,
      }));

    expect(
      mismatched,
      `severity disagreements between the catalog and ${grafanaRulesPath}`,
    ).toEqual([]);
  });

  it("finds a non-trivial number of rules, so a broken parse cannot pass silently", () => {
    // Every assertion above is vacuously true if the regex stops matching.
    expect(alertRules().length).toBeGreaterThan(5);
  });
});
