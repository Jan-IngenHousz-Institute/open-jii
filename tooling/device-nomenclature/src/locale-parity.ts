import { readdir, readFile } from "node:fs/promises";
import { join, relative, sep } from "node:path";

export interface LocaleTree {
  locale: string;
  root: string;
}

export interface LocaleParityRegistration {
  host: string;
  base: LocaleTree;
  siblings: readonly LocaleTree[];
  retiredKeys: readonly string[];
}

export type LocaleParityIssueKind = "missing" | "extra" | "retired";

export interface LocaleParityIssue {
  host: string;
  locale: string;
  namespace: string;
  key: string;
  kind: LocaleParityIssueKind;
}

async function jsonFiles(root: string, current = root): Promise<string[]> {
  const entries = await readdir(current, { withFileTypes: true });
  const nested = await Promise.all(
    entries
      .toSorted((left, right) => left.name.localeCompare(right.name))
      .map(async (entry) => {
        const path = join(current, entry.name);
        if (entry.isDirectory()) return jsonFiles(root, path);
        return entry.isFile() && entry.name.endsWith(".json") ? [path] : [];
      }),
  );
  return nested.flat();
}

function flatten(value: unknown, prefix = ""): string[] {
  if (value === null || typeof value !== "object" || Array.isArray(value)) return [prefix];
  return Object.entries(value as Record<string, unknown>)
    .toSorted(([left], [right]) => left.localeCompare(right))
    .flatMap(([key, child]) => flatten(child, prefix ? `${prefix}.${key}` : key));
}

async function readTree(tree: LocaleTree): Promise<Map<string, Set<string>>> {
  const namespaces = new Map<string, Set<string>>();
  for (const path of await jsonFiles(tree.root)) {
    const namespace = relative(tree.root, path)
      .split(sep)
      .join("/")
      .replace(/\.json$/u, "");
    let parsed: unknown;
    try {
      parsed = JSON.parse(await readFile(path, "utf8"));
    } catch (error) {
      throw new Error(`Unable to read locale ${tree.locale}/${namespace}: ${String(error)}`);
    }
    namespaces.set(namespace, new Set(flatten(parsed).filter(Boolean)));
  }
  return namespaces;
}

export async function checkLocaleParity(
  registration: LocaleParityRegistration,
): Promise<LocaleParityIssue[]> {
  const base = await readTree(registration.base);
  const trees = [registration.base, ...registration.siblings];
  const issues: LocaleParityIssue[] = [];

  for (const tree of trees) {
    const actual = tree === registration.base ? base : await readTree(tree);
    const namespaces = new Set([...base.keys(), ...actual.keys()]);
    for (const namespace of [...namespaces].sort()) {
      const expectedKeys = base.get(namespace) ?? new Set<string>();
      const actualKeys = actual.get(namespace) ?? new Set<string>();
      if (tree !== registration.base) {
        for (const key of expectedKeys) {
          if (!actualKeys.has(key)) {
            issues.push({
              host: registration.host,
              locale: tree.locale,
              namespace,
              key,
              kind: "missing",
            });
          }
        }
        for (const key of actualKeys) {
          if (!expectedKeys.has(key)) {
            issues.push({
              host: registration.host,
              locale: tree.locale,
              namespace,
              key,
              kind: "extra",
            });
          }
        }
      }
      for (const key of actualKeys) {
        const qualified = `${namespace}.${key}`;
        if (
          registration.retiredKeys.includes(key) ||
          registration.retiredKeys.includes(qualified)
        ) {
          issues.push({
            host: registration.host,
            locale: tree.locale,
            namespace,
            key,
            kind: "retired",
          });
        }
      }
    }
  }

  return issues.toSorted(
    (left, right) =>
      left.host.localeCompare(right.host) ||
      left.locale.localeCompare(right.locale) ||
      left.namespace.localeCompare(right.namespace) ||
      left.key.localeCompare(right.key) ||
      left.kind.localeCompare(right.kind),
  );
}

export function formatLocaleParityIssue(issue: LocaleParityIssue): string {
  return `${issue.host}/${issue.locale}/${issue.namespace}: ${issue.kind} key ${issue.key}`;
}
