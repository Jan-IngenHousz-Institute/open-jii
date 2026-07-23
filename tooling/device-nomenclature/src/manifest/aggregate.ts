import type { NomenclatureRule, RuleManifest } from "../types.js";

export function aggregateManifest(
  shards: Readonly<Record<string, readonly NomenclatureRule[]>>,
): RuleManifest {
  const entries = Object.entries(shards).sort(([left], [right]) => left.localeCompare(right));
  const rules = entries
    .flatMap(([, shard]) => shard)
    .toSorted((left, right) => left.id.localeCompare(right.id));
  const seen = new Set<string>();
  for (const rule of rules) {
    if (seen.has(rule.id)) throw new Error(`Duplicate nomenclature rule id: ${rule.id}`);
    seen.add(rule.id);
    if (rule.paths.length === 0) throw new Error(`Rule ${rule.id} has no path scope`);
    if (!rule.rationale.trim()) throw new Error(`Rule ${rule.id} has no rationale`);
    if (!rule.target.trim()) throw new Error(`Rule ${rule.id} has no target`);
    if (rule.kind === "denylist" && !rule.pattern) {
      throw new Error(`Denylist rule ${rule.id} has no exact pattern`);
    }
  }
  return { version: 1, rules };
}
