import { execFile } from "node:child_process";
import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { promisify } from "node:util";

import {
  classificationMatches,
  denylistMatches,
  findReferences,
  normalizePath,
  pathMatches,
  ruleSpecificity,
  surfaceForPath,
  toFinding,
} from "./matcher.js";
import type { InventoryReport, NomenclatureRule, RuleManifest, TrackedTextFile } from "./types.js";

const execFileAsync = promisify(execFile);

const EXCLUDED_TRACKED_PATHS = [
  ".traycer/**",
  "**/.traycer/**",
  "node_modules/**",
  "**/node_modules/**",
  "dist/**",
  "**/dist/**",
  "build/**",
  "**/build/**",
  "out/**",
  "**/out/**",
  ".next/**",
  "**/.next/**",
];

function isExcluded(path: string): boolean {
  const syntheticRule: NomenclatureRule = {
    id: "excluded",
    surface: "tooling",
    category: "fixture",
    granularity: "path",
    paths: EXCLUDED_TRACKED_PATHS,
    disposition: "fixture-only",
    target: "excluded build output",
    rationale: "Scanner boundary",
    compatibilityBoundary: null,
  };
  return pathMatches(syntheticRule, path);
}

export async function readTrackedFiles(root: string): Promise<TrackedTextFile[]> {
  let stdout: string;
  try {
    ({ stdout } = await execFileAsync("git", ["ls-files", "-z"], {
      cwd: root,
      encoding: "utf8",
      maxBuffer: 32 * 1024 * 1024,
    }));
  } catch (error) {
    throw new Error(`Unable to enumerate tracked files with git ls-files: ${String(error)}`);
  }

  const paths = stdout
    .split("\0")
    .filter(Boolean)
    .map(normalizePath)
    .filter((path) => !isExcluded(path))
    .toSorted();

  return Promise.all(
    paths.map(async (path) => {
      let buffer: Buffer;
      try {
        buffer = await readFile(join(root, path));
      } catch (error) {
        throw new Error(`Unable to read tracked file ${path}: ${String(error)}`);
      }
      return { path, content: buffer.includes(0) ? null : buffer.toString("utf8") };
    }),
  );
}

function emptyCounts(values: readonly string[]): Record<string, number> {
  return Object.fromEntries(values.map((value) => [value, 0]));
}

export function scanTrackedFiles(
  files: readonly TrackedTextFile[],
  manifest: RuleManifest,
): InventoryReport {
  const findings = files.flatMap((file) =>
    findReferences(file.path, file.content).map((reference) => {
      const forbidden = manifest.rules.filter((rule) => denylistMatches(rule, reference));
      if (forbidden.length > 0) {
        return toFinding(reference, "forbidden", forbidden, surfaceForPath(reference.path));
      }

      const candidates = manifest.rules.filter((rule) => classificationMatches(rule, reference));
      if (candidates.length === 0) return toFinding(reference, "unclassified", []);
      const scoredCandidates = candidates.map((rule) => ({
        rule,
        specificity: ruleSpecificity(rule, reference.path),
      }));
      const highestSpecificity = Math.max(
        ...scoredCandidates.map(({ specificity }) => specificity),
      );
      const winners = scoredCandidates
        .filter(({ specificity }) => specificity === highestSpecificity)
        .map(({ rule }) => rule);
      return toFinding(reference, winners.length === 1 ? "classified" : "ambiguous", winners);
    }),
  );

  findings.sort(
    (left, right) =>
      left.path.localeCompare(right.path) ||
      left.line - right.line ||
      left.column - right.column ||
      left.token.localeCompare(right.token),
  );

  const matchedRuleIds = new Set(findings.flatMap((finding) => finding.ruleIds));
  const trackedPaths = files.map((file) => file.path);
  const deadRules = manifest.rules
    .filter((rule) => {
      if (rule.category === "keep-generated-history") return false;
      if (
        (rule.kind ?? "classification") === "classification" &&
        rule.category !== "rename-neutral"
      ) {
        return false;
      }
      if (rule.kind === "denylist") {
        // A denylist remains live while its tracked path scope exists even when
        // the retired pattern is absent. Only a scope that matches no tracked
        // path is dead; scanner tests document both sides of this contract.
        return !trackedPaths.some((path) => pathMatches(rule, path));
      }
      return !matchedRuleIds.has(rule.id);
    })
    .map((rule) => ({
      ruleId: rule.id,
      reason:
        rule.kind === "denylist"
          ? "denylist scope no longer matches a tracked path"
          : "active rename rule no longer classifies a reference",
    }))
    .toSorted((left, right) => left.ruleId.localeCompare(right.ruleId));

  const countsBySurface = emptyCounts([
    "api",
    "backend",
    "database",
    "docs",
    "iot",
    "mobile",
    "other-app",
    "tooling",
    "web",
  ]);
  const countsByCategory = emptyCounts([
    "family-aware",
    "fixture",
    "keep-compatibility",
    "keep-generated-history",
    "keep-product-specific",
    "rename-neutral",
  ]);
  for (const finding of findings) {
    if (finding.surface)
      countsBySurface[finding.surface] = (countsBySurface[finding.surface] ?? 0) + 1;
    if (finding.category) {
      countsByCategory[finding.category] = (countsByCategory[finding.category] ?? 0) + 1;
    }
  }

  const count = (status: (typeof findings)[number]["status"]): number =>
    findings.filter((finding) => finding.status === status).length;
  const unclassified = count("unclassified");
  const ambiguous = count("ambiguous");
  const forbidden = count("forbidden");

  return {
    schemaVersion: 1,
    trackedFileCount: files.length,
    scannedTextFileCount: files.filter((file) => file.content !== null).length,
    summary: {
      totalReferences: findings.length,
      classified: count("classified"),
      unclassified,
      ambiguous,
      forbidden,
      deadRules: deadRules.length,
      nomenclatureIssues: unclassified + ambiguous + forbidden + deadRules.length,
    },
    countsBySurface,
    countsByCategory,
    findings,
    deadRules,
  };
}

export async function scanRepository(
  root: string,
  manifest: RuleManifest,
): Promise<InventoryReport> {
  return scanTrackedFiles(await readTrackedFiles(root), manifest);
}
