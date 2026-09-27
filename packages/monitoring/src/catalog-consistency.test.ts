import { readFileSync, readdirSync } from "node:fs";
import { join, resolve } from "node:path";
import { describe, expect, it } from "vitest";

import { parseCatalog, parsePasses } from "./catalog.js";
import { ALLOWED_NAMESPACES } from "./forwarder.js";
import type { CatalogMetric } from "./types.js";

// These tests read the real catalog, not fixtures. Their job is to make the hand checks
// that would otherwise happen at review time fail loudly at test time instead.

const repoRoot = resolve(__dirname, "../../..");
const catalogSource = readFileSync(join(repoRoot, "docs/monitoring/metrics-catalog.yaml"), "utf8");
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

const heartbeatDashboardsPath = "infrastructure/modules/grafana/dashboard/heartbeat.tf";
const heartbeatDashboards = readFileSync(join(repoRoot, heartbeatDashboardsPath), "utf8");

const errorDashboardsPath = "infrastructure/modules/grafana/dashboard/errors.tf";
const errorDashboards = readFileSync(join(repoRoot, errorDashboardsPath), "utf8");

const metrics = parseCatalog(catalogSource);
const passes = parsePasses(catalogSource);

const KNOWN_FAMILIES = ["observability", "usage"];
const KNOWN_SLOTS = ["alert", "exception", "weekly", "dashboard", "s3"];
const KNOWN_AREAS = [
  "volume",
  "latency",
  "path",
  "web",
  "api",
  "ingest",
  "lakehouse",
  "sandboxes",
  "usage",
  "platform",
  "errors",
];
const KNOWN_SOURCES = ["aws", "dbx", "pg", "posthog", "gh", "composer"];
const KNOWN_STATS = ["Sum", "Maximum", "Minimum", "Average", "SampleCount"];
const KNOWN_SEVERITIES = ["critical", "warning"];
// The report dashboards map these to Grafana unit ids; anything else charts as a bare number.
const KNOWN_UNITS = ["milliseconds", "seconds", "minutes", "bytes", "percent", "ratio"];

// Only these signal fields go through placeholder resolution on the dashboards; a
// placeholder anywhere else reaches CloudWatch as a literal and matches nothing forever.
const RESOLVED_FIELDS = ["search", "dimensions", "query"];

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

interface AlertRule {
  metricId: string;
  severity: string;
  runbook?: string;
  dashboard?: string;
  panel?: string;
}

/** Every Grafana rule that claims a catalog entry, with the severity it routes on. */
function alertRules(): AlertRule[] {
  const rules: AlertRule[] = [];

  // Annotations come right before labels in every rule, so one match sees both. The
  // runbook_url value contains a closing brace, so the annotations body is matched lazily.
  for (const [, annotations, labels] of grafanaRules.matchAll(
    /annotations = \{([\s\S]*?)\n\s*\}\s*labels = \{([^}]*)\}/g,
  )) {
    const id = /metric_id\s*=\s*"([^"]+)"/.exec(labels);
    if (id === null) {
      continue;
    }
    const severity = /severity\s*=\s*"([^"]+)"/.exec(labels);
    const runbook = /runbook_url\s*=\s*"[^"]*\/(docs\/runbooks\/[\w-]+\.md)"/.exec(annotations);
    const dashboard = /__dashboardUid__\s*=\s*(\S+)/.exec(annotations);
    const panel = /__panelId__\s*=\s*(\S+)/.exec(annotations);
    rules.push({
      metricId: id[1],
      severity: severity === null ? "" : severity[1],
      runbook: runbook === null ? undefined : runbook[1],
      dashboard: dashboard === null ? undefined : dashboard[1],
      panel: panel === null ? undefined : panel[1],
    });
  }

  return rules;
}

function isKnownStat(stat: string | undefined): boolean {
  return stat !== undefined && (KNOWN_STATS.includes(stat) || /^p\d{1,2}(\.\d+)?$/.test(stat));
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
  it("uses only known families, slots, areas, sources and stats", () => {
    const badFamily = metrics.filter((m) => !KNOWN_FAMILIES.includes(m.family));
    const badSlot = metrics.filter((m) => m.slots.some((s) => !KNOWN_SLOTS.includes(s)));
    const badArea = metrics.filter((m) => m.area && !KNOWN_AREAS.includes(m.area));
    const badSource = metrics.filter((m) => !KNOWN_SOURCES.includes(m.source));
    // A statistic is CloudWatch's; a PostHog query returns its own number.
    const badStat = metrics.filter(
      (m) =>
        m.signal && (m.signal.kind ?? "cloudwatch") === "cloudwatch" && !isKnownStat(m.signal.stat),
    );

    expect(badFamily.map((m) => m.id)).toEqual([]);
    expect(badSlot.map((m) => m.id)).toEqual([]);
    expect(badArea.map((m) => m.id)).toEqual([]);
    expect(badSource.map((m) => m.id)).toEqual([]);
    expect(badStat.map((m) => m.id)).toEqual([]);
  });

  it("uses only severities the routing and the ordering understand", () => {
    // The notification policy branches on severity, so an unknown one routes as a
    // warning without anyone having decided that.
    const offenders = metrics.filter((m) => m.severity && !KNOWN_SEVERITIES.includes(m.severity));
    expect(offenders.map((m) => m.id)).toEqual([]);
  });

  it("uses only units the report dashboards can render", () => {
    const offenders = metrics.filter((m) => m.signal?.unit && !KNOWN_UNITS.includes(m.signal.unit));
    expect(offenders.map((m) => m.id)).toEqual([]);
  });

  it("names every entry, since the panels print the name", () => {
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
  it("carry a signal, since an active entry is charted", () => {
    const offenders = metrics.filter((m) => m.active && !m.signal && m.source !== "composer");
    expect(offenders.map((m) => m.id)).toEqual([]);
  });
});

describe("PostHog signals", () => {
  const posthog = metrics.filter((m) => m.signal?.kind === "posthog");

  it("are there, so a broken filter cannot pass silently", () => {
    expect(posthog.length).toBeGreaterThan(0);
  });

  it("read one environment over the report's time range, through the tables' own scope", () => {
    // One PostHog project serves every environment, and a tile that ignores the picker or
    // counts other issues than the table beside it would disagree with it.
    const offenders = posthog.filter((m) => !m.signal?.query?.includes("${EXCEPTIONS_SCOPE}"));
    expect(offenders.map((m) => m.id)).toEqual([]);

    const scope = /heartbeat_exception_scope = "([^"]*)"/.exec(errorDashboards)?.[1] ?? "";
    const environment =
      /heartbeat_exception_environment = \(([\s\S]*?)\n {2}\)/.exec(errorDashboards)?.[1] ?? "";
    expect(scope, errorDashboardsPath).toContain("$${__from");
    expect(scope, errorDashboardsPath).toContain("$${__to");
    expect(environment, errorDashboardsPath).toContain(
      "properties.environment = '${var.environment}'",
    );
  });

  it("carry no alert slot, since PostHog alerts on issues itself", () => {
    // A Grafana rule over PostHog's query API would share its three concurrent queries.
    expect(posthog.filter((m) => m.slots.includes("alert")).map((m) => m.id)).toEqual([]);
  });

  it("sit in the errors section, the only one that reads PostHog", () => {
    expect(posthog.filter((m) => m.area !== "errors").map((m) => m.id)).toEqual([]);
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

  it("declare a period only in whole days, since the weekly report reads two of them", () => {
    const offenders = metrics.filter(
      (m) =>
        m.signal?.period !== undefined && (m.signal.period <= 0 || m.signal.period % 86400 !== 0),
    );
    expect(offenders.map((m) => m.id)).toEqual([]);
  });

  it("give every weekly count a period, since a count's latest reading is not a week", () => {
    const offenders = metrics.filter(
      (m) => m.active && m.slots.includes("weekly") && m.signal?.stat === "Sum" && !m.signal.period,
    );
    expect(offenders.map((m) => m.id)).toEqual([]);
  });

  it("use placeholders only in the fields the dashboards resolve", () => {
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
});

describe("catalog and grafana rules cannot drift", () => {
  // The catalog is what the reports read and the runbooks cite; the rules are what wakes
  // someone. Nothing else compares them, and they are edited months apart.

  /** Each rule's literal condition, `$B > 5` or `$B < 1`, with the entry it claims. */
  function ruleConditions(): { metricId: string; operator: string; threshold: number }[] {
    const matches = grafanaRules.matchAll(
      /expression\s*=\s*"\$B\s*([<>])\s*([^"]+)"[\s\S]*?metric_id\s*=\s*"([^"]+)"/g,
    );

    return [...matches]
      .map(([, operator, threshold, metricId]) => ({
        metricId,
        operator,
        threshold: Number(threshold),
      }))
      .filter((condition) => !Number.isNaN(condition.threshold));
  }

  it("records a limit for every alert entry, since that is what colours its row on the board", () => {
    const offenders = metrics.filter(
      (m) =>
        m.active &&
        m.slots.includes("alert") &&
        m.baseline?.max === undefined &&
        m.baseline?.min === undefined &&
        m.baseline?.nodata !== "alert" &&
        m.baseline?.anomaly !== "any-nonzero",
    );
    expect(offenders.map((m) => m.id)).toEqual([]);
  });

  it("records the number its rules fire on, the loosest where several rules share an entry", () => {
    // A board row that turns red on a different number from its rule tells two stories. An
    // any-nonzero entry is stricter than its rule on purpose, and a variable threshold is
    // per environment, so neither is compared.
    const byId = new Map(metrics.map((m) => [m.id, m]));
    const loosest = new Map<string, { operator: string; threshold: number }>();
    for (const condition of ruleConditions()) {
      const current = loosest.get(condition.metricId);
      const looser =
        current === undefined ||
        (condition.operator === ">"
          ? condition.threshold > current.threshold
          : condition.threshold < current.threshold);
      if (looser) {
        loosest.set(condition.metricId, condition);
      }
    }

    const mismatched = [...loosest]
      .filter(([metricId]) => {
        const baseline = byId.get(metricId)?.baseline;
        return baseline?.anomaly !== "any-nonzero" && baseline?.nodata !== "alert";
      })
      .filter(([metricId, rule]) => {
        const baseline = byId.get(metricId)?.baseline;
        const recorded = rule.operator === ">" ? baseline?.max : baseline?.min;
        return recorded !== rule.threshold;
      })
      .map(([metricId, rule]) => ({ metricId, rule: `${rule.operator} ${rule.threshold}` }));

    expect(ruleConditions().length).toBeGreaterThan(5);
    expect(mismatched, `limits that disagree with ${grafanaRulesPath}`).toEqual([]);
  });

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

  it("carries the entry's runbook as runbook_url, which is where Alertmanager readers look", () => {
    const byId = new Map(metrics.map((m) => [m.id, m]));
    const mismatched = alertRules()
      .filter((rule) => byId.get(rule.metricId)?.runbook !== rule.runbook)
      .map((rule) => ({
        metricId: rule.metricId,
        rule: rule.runbook,
        catalog: byId.get(rule.metricId)?.runbook,
      }));

    expect(
      mismatched,
      `runbook_url disagreements between the catalog and ${grafanaRulesPath}`,
    ).toEqual([]);
  });

  it("claims an entry from every rule, so each has a tile and a chart on the daily report", () => {
    const labelBlocks = [...grafanaRules.matchAll(/labels = \{([^}]*)\}/g)].map(([, body]) => body);
    const unclaimed = labelBlocks.filter((body) => !/metric_id\s*=/.test(body));

    expect(labelBlocks.length).toBeGreaterThan(5);
    expect(unclaimed, `rules in ${grafanaRulesPath} without a metric_id`).toEqual([]);
  });

  it("finds a non-trivial number of rules, so a broken parse cannot pass silently", () => {
    // Every assertion above is vacuously true if the regex stops matching.
    expect(alertRules().length).toBeGreaterThan(5);
  });
});

describe("the report dashboards", () => {
  // Each report is generated from a filter over the catalogue. The filters are HCL, so
  // only a test can say whether they still select what the slots promise.

  interface Membership {
    family: string | null;
    slots: string[];
  }

  function membershipOf(expression: string): Membership {
    const family = /m\.family\s*==\s*"([a-z]+)"/.exec(expression);
    const slots = [...expression.matchAll(/contains\(m\.slots,\s*"([a-z]+)"/g)];

    return { family: family?.[1] ?? null, slots: slots.map((match) => match[1]).sort() };
  }

  function reportMemberships(): Record<string, Membership> {
    const blocks = [
      ...heartbeatDashboards.matchAll(/^ {2}heartbeat_(daily|weekly)\s*=\s*\[([\s\S]*?)\]$/gm),
    ];

    return Object.fromEntries(blocks.map((block) => [block[1], membershipOf(block[2])]));
  }

  function onReport(report: string): CatalogMetric[] {
    const filter = reportMemberships()[report];

    return metrics.filter(
      (m) =>
        m.active &&
        m.signal &&
        (filter.family === null || m.family === filter.family) &&
        m.slots.some((slot) => filter.slots.includes(slot)),
    );
  }

  // The data path's areas are sections of their own; the rest are rows of the board and levels.
  const dailyAreas = [
    ...(/heartbeat_path_areas = \[([^\]]*)\]/.exec(heartbeatDashboards)?.[1] ?? "").matchAll(
      /"([a-z-]+)"/g,
    ),
    ...(
      /heartbeat_daily_areas = \[([\s\S]*?)\n {2}\]/.exec(heartbeatDashboards)?.[1] ?? ""
    ).matchAll(/key = "([a-z-]+)"/g),
    ...(/heartbeat_errors_areas = \[([^\]]*)\]/.exec(heartbeatDashboards)?.[1] ?? "").matchAll(
      /"([a-z-]+)"/g,
    ),
  ].map((match) => match[1]);
  // Each weekly section names the areas it gathers.
  const weeklyAreas = [
    ...(
      /heartbeat_weekly_areas = \[([\s\S]*?)\n {2}\]/.exec(heartbeatDashboards)?.[1] ?? ""
    ).matchAll(/areas\s*=\s*\[([^\]]*)\]/g),
  ].flatMap((match) => [...match[1].matchAll(/"([a-z-]+)"/g)].map((name) => name[1]));

  it("resolves every placeholder the catalogue uses, and no invented ones", () => {
    // The panels substitute through one map. A name the catalogue uses and that map omits
    // fails the plan, but a name only the map carries is a silent extra, and the pair
    // drifting is how a panel ends up querying a literal ${SOMETHING} forever.
    const block =
      /heartbeat_placeholders = \{([\s\S]*?)\n {2}\}/.exec(heartbeatDashboards)?.[1] ?? "";
    const onReports = new Set([...block.matchAll(/^\s*([A-Z0-9_]+)\s*=/gm)].map((line) => line[1]));

    const used = new Set(metrics.flatMap((m) => placeholdersIn(m.signal)));
    const missing = [...used].filter((name) => !onReports.has(name));
    const unused = [...onReports].filter((name) => !used.has(name));

    expect(
      missing.sort(),
      `placeholders the catalog uses and ${heartbeatDashboardsPath} omits`,
    ).toEqual([]);
    expect(
      unused.sort(),
      `placeholders in ${heartbeatDashboardsPath} no catalogue entry uses`,
    ).toEqual([]);
  });

  it("selects a non-trivial set on each of the two reports, so a broken parse cannot pass silently", () => {
    expect(Object.keys(reportMemberships()).sort()).toEqual(["daily", "weekly"]);
    expect(onReport("daily").length).toBeGreaterThan(5);
    expect(onReport("weekly").length).toBeGreaterThan(3);
  });

  it("lays out only known areas", () => {
    expect(dailyAreas.length).toBeGreaterThan(0);
    expect(weeklyAreas.length).toBeGreaterThan(0);
    expect([...dailyAreas, ...weeklyAreas].filter((area) => !KNOWN_AREAS.includes(area))).toEqual(
      [],
    );
  });

  it("puts every entry in an area its report lays out, since an entry without one is dropped", () => {
    const strayDaily = onReport("daily").filter((m) => !dailyAreas.includes(m.area ?? ""));
    const strayWeekly = onReport("weekly").filter((m) => !weeklyAreas.includes(m.area ?? ""));

    expect(
      strayDaily.map((m) => m.id),
      `daily areas are ${dailyAreas.join(", ")}`,
    ).toEqual([]);
    expect(
      strayWeekly.map((m) => m.id),
      `weekly areas are ${weeklyAreas.join(", ")}`,
    ).toEqual([]);
  });

  it("links every rule on the daily report to its own entry's chart, and no other rule", () => {
    // A linked rule draws its state on the chart and gives its Slack notification a
    // link to it. A rule linked to the wrong key would put its state on another chart.
    const daily = new Set(onReport("daily").map((m) => m.id));
    const wrong = alertRules()
      .filter((rule) => {
        const linked = rule.dashboard !== undefined || rule.panel !== undefined;
        if (!daily.has(rule.metricId)) {
          return linked;
        }
        return (
          rule.dashboard !== "local.heartbeat_daily_uid" ||
          rule.panel !== `local.heartbeat_panel_ids["${rule.metricId}"]`
        );
      })
      .map((rule) => ({ metricId: rule.metricId, dashboard: rule.dashboard, panel: rule.panel }));

    expect(wrong, `rule links in ${grafanaRulesPath}`).toEqual([]);
  });

  it("gives each daily chart its entry's num as panel id, which is what the rules link to", () => {
    expect(heartbeatDashboards).toMatch(
      /heartbeat_panel_ids\s*=\s*\{\s*for m in local\.heartbeat_daily : m\.id => tostring\(m\.num\)\s*\}/,
    );
    expect(heartbeatDashboards).toMatch(/type\s*=\s*"timeseries"/);
    expect(heartbeatDashboards).toMatch(/id\s*=\s*m\.num\n\s*type\s*=\s*"timeseries"/);
    expect(heartbeatDashboards).toMatch(
      /resource "grafana_dashboard" "heartbeat_daily" \{[\s\S]*?uid\s*=\s*local\.heartbeat_daily_uid/,
    );
  });

  it("links only to skills that exist, since a renamed skill leaves every triage link dead", () => {
    const linked = new Set(
      [...heartbeatDashboards.matchAll(/\/(openjii-[a-z-]+)/g)].map(([, name]) => name),
    );
    const skills = new Set(readdirSync(join(repoRoot, ".agents/skills")));

    expect(linked.size).toBeGreaterThan(1);
    expect([...linked].filter((name) => !skills.has(name))).toEqual([]);
  });

  describe("and the flow dashboards they link to", () => {
    const flowsPath = "infrastructure/modules/grafana/dashboard/flows.tf";
    const flows = readFileSync(join(repoRoot, flowsPath), "utf8");
    const templateNames = [
      ...(/for key in \[([^\]]*)\] : key => \{\s*for section in/.exec(flows)?.[1] ?? "").matchAll(
        /"([a-z-]+)"/g,
      ),
    ].map(([, name]) => name);

    function block(source: string, name: string): string {
      return new RegExp(`${name} = \\{([\\s\\S]*?)\\n {2}\\}`).exec(source)?.[1] ?? "";
    }

    function keysOf(body: string, indent: number): string[] {
      const line = new RegExp(`^ {${indent}}"?([\\w/-]+)"?\\s*=`, "gm");
      return [...body.matchAll(line)].map(([, key]) => key);
    }

    function template(name: string): string {
      return readFileSync(
        join(repoRoot, `infrastructure/modules/grafana/dashboard/flows/${name}.json.tftpl`),
        "utf8",
      );
    }

    it("opens a flow dashboard from every daily signal", () => {
      const dashboards = keysOf(block(flows, "flow_dashboards"), 4);
      const byArea = block(flows, "flow_by_area");
      const byNamespace = block(flows, "flow_by_namespace");
      const targets = [...`${byArea}${byNamespace}`.matchAll(/=\s*"([a-z-]+)"/g)].map(
        ([, flow]) => flow,
      );

      // Errors span every service, so their tile opens PostHog's issues instead.
      const unlinked = onReport("daily").filter(
        (m) =>
          (m.signal?.kind ?? "cloudwatch") === "cloudwatch" &&
          !keysOf(byArea, 4).includes(m.area ?? "") &&
          !keysOf(byNamespace, 4).includes(m.signal?.namespace ?? ""),
      );

      expect(dashboards.length).toBeGreaterThan(1);
      expect(targets.filter((flow) => !dashboards.includes(flow))).toEqual([]);
      expect(unlinked.map((m) => m.id)).toEqual([]);
    });

    it("lays out every panel of each template, since one left out is silently dropped", () => {
      const layouts = block(flows, "flow_layouts");
      const questions = block(flows, "flow_questions");

      expect(templateNames.length).toBeGreaterThan(1);
      for (const name of templateNames) {
        const layout =
          new RegExp(`^ {4}"?${name}"? = \\[([\\s\\S]*?)^ {4}\\]`, "m").exec(layouts)?.[1] ?? "";
        const sections = template(name)
          .split(/"key": "/)
          .slice(1)
          .map((chunk) => ({
            key: /^([a-z-]+)"/.exec(chunk)?.[1] ?? "",
            ids: [...chunk.matchAll(/"id": (\d+)/g)].map(([, id]) => id),
          }));
        // A section is placed whole, or each of its panels under the question it answers.
        const missing = sections
          .filter(({ key }) => !new RegExp(`"${key}"|\\.${key}\\b`).test(layout))
          .flatMap(({ ids }) => ids)
          .filter((id) => !questions.includes(`panel = "${id}"`));

        expect(sections.length, name).toBeGreaterThan(1);
        expect(missing, `${name} panels ${flowsPath} does not lay out`).toEqual([]);
      }
    });

    it("keeps template panel ids unique across templates and clear of the entry nums charted beside them", () => {
      const ids = templateNames.flatMap((name) =>
        [...template(name).matchAll(/"id": (\d+)/g)].map(([, id]) => Number(id)),
      );

      expect(ids.filter((id) => id < 300)).toEqual([]);
      expect(new Set(ids).size).toBe(ids.length);
    });

    it("resolves every template placeholder from the dashboard variables", () => {
      const variables = keysOf(block(grafanaRules, "dashboard_vars"), 4);

      for (const name of templateNames) {
        const used = new Set(
          [...template(name).matchAll(/\$\{([a-z0-9_]+)\}/g)].map(([, variable]) => variable),
        );

        expect(
          [...used].filter((variable) => !variables.includes(variable)),
          `${name} placeholders missing from dashboard_vars in ${grafanaRulesPath}`,
        ).toEqual([]);
      }
    });
  });
});
