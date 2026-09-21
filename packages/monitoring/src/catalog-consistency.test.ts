import { readFileSync, readdirSync } from "node:fs";
import { join, resolve } from "node:path";
import { describe, expect, it } from "vitest";

import { activeSignals, parseCatalog, parsePasses, partitionByConfig } from "./catalog.js";
import type { CatalogMetric } from "./types.js";

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

const metrics = parseCatalog(catalogSource);
const passes = parsePasses(catalogSource);

const KNOWN_FAMILIES = ["observability", "usage"];
const KNOWN_SLOTS = ["alert", "exception", "pulse", "weekly", "dashboard", "s3"];
const KNOWN_SOURCES = ["aws", "dbx", "pg", "posthog", "gh", "composer"];

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

function placeholdersIn(metric: CatalogMetric): string[] {
  const matches = JSON.stringify(metric.signal ?? {}).matchAll(/\$\{([A-Z0-9_]+)\}/g);
  return [...matches].map(([, name]) => name);
}

function composerEnvironmentKeys(): Set<string> {
  const block = composerTerraform.split("variables = {")[1]?.split("}")[0] ?? "";
  return new Set([...block.matchAll(/^\s+([A-Z][A-Z0-9_]*)\s+=/gm)].map(([, key]) => key));
}

function digestEvaluated(metric: CatalogMetric): boolean {
  return (
    metric.family === "observability" &&
    (metric.slots.includes("exception") || metric.slots.includes("alert"))
  );
}

function seriesKey(metric: CatalogMetric): string {
  const { namespace, metric: name, search, dimensions } = metric.signal ?? {};
  return JSON.stringify([namespace, name, search, dimensions]);
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
  it("uses only known families, slots and sources", () => {
    const badFamily = metrics.filter((m) => !KNOWN_FAMILIES.includes(m.family));
    const badSlot = metrics.filter((m) => m.slots.some((s) => !KNOWN_SLOTS.includes(s)));
    const badSource = metrics.filter((m) => !KNOWN_SOURCES.includes(m.source));

    expect(badFamily.map((m) => m.id)).toEqual([]);
    expect(badSlot.map((m) => m.id)).toEqual([]);
    expect(badSource.map((m) => m.id)).toEqual([]);
  });

  it("gives every alert-slot entry a severity, since routing depends on it", () => {
    const offenders = metrics.filter((m) => m.slots.includes("alert") && !m.severity);
    expect(offenders.map((m) => m.id)).toEqual([]);
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

  it("carry a baseline rule when the daily digest will evaluate them", () => {
    const offenders = metrics.filter(
      (m) => m.active && digestEvaluated(m) && !m.baseline && m.source !== "composer",
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

  it("never query the same series from two entries", () => {
    const byKey = new Map<string, string[]>();
    for (const metric of metrics.filter((m) => m.signal)) {
      const key = seriesKey(metric);
      byKey.set(key, [...(byKey.get(key) ?? []), metric.id]);
    }
    const duplicates = [...byKey.values()].filter((ids) => ids.length > 1);
    expect(duplicates).toEqual([]);
  });

  it("use only placeholders the composer's terraform actually provides", () => {
    // A placeholder with no matching env var is a config error at runtime, which excludes
    // the metric from every digest silently until someone reads the Lambda log.
    const provided = composerEnvironmentKeys();
    expect(provided.size).toBeGreaterThan(5);

    const unprovided = metrics
      .flatMap((m) => placeholdersIn(m).map((name) => ({ id: m.id, name })))
      .filter(({ name }) => !provided.has(name));
    expect(unprovided).toEqual([]);
  });
});
