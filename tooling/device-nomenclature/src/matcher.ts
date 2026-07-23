import type { NomenclatureRule, ReferenceFinding, ReferenceKind, Surface } from "./types.js";

const NOMENCLATURE_PATTERN = /[A-Za-z0-9_$@.:-]*multispeq[A-Za-z0-9_$@.:-]*/giu;

export function normalizePath(path: string): string {
  return path.replaceAll("\\", "/").replace(/^\.\//u, "");
}

export function surfaceForPath(path: string): Surface {
  const normalized = normalizePath(path);
  if (normalized.startsWith("apps/mobile/")) return "mobile";
  if (normalized.startsWith("apps/web/") || normalized.startsWith("packages/i18n/")) {
    return "web";
  }
  if (normalized.startsWith("apps/backend/")) return "backend";
  if (
    normalized === "README.md" ||
    normalized.startsWith("apps/docs/") ||
    normalized.startsWith("docs/")
  ) {
    return "docs";
  }
  if (normalized.startsWith("packages/api/")) return "api";
  if (normalized.startsWith("packages/database/")) return "database";
  if (normalized.startsWith("packages/iot/")) return "iot";
  if (normalized.startsWith("apps/")) return "other-app";
  return "tooling";
}

function escapeRegex(value: string): string {
  return value.replace(/[|\\{}()[\]^$+?.]/gu, "\\$&");
}

export function globToRegex(glob: string): RegExp {
  const normalized = normalizePath(glob);
  let source = "";
  for (let index = 0; index < normalized.length; index += 1) {
    const character = normalized[index];
    if (character === "*" && normalized[index + 1] === "*") {
      if (normalized[index + 2] === "/") {
        source += "(?:.*/)?";
        index += 2;
      } else {
        source += ".*";
        index += 1;
      }
    } else if (character === "*") {
      source += "[^/]*";
    } else if (character === "?") {
      source += "[^/]";
    } else {
      source += escapeRegex(character);
    }
  }
  return new RegExp(`^${source}$`, "u");
}

export function pathMatches(rule: NomenclatureRule, path: string): boolean {
  const normalized = normalizePath(path);
  return rule.paths.some((candidate) => globToRegex(candidate).test(normalized));
}

export interface RawReference {
  path: string;
  line: number;
  column: number;
  kind: ReferenceKind;
  token: string;
  lineText: string;
}

export function findReferences(path: string, content: string | null): RawReference[] {
  const normalized = normalizePath(path);
  const references: RawReference[] = [];
  const pathMatch = NOMENCLATURE_PATTERN.exec(normalized);
  NOMENCLATURE_PATTERN.lastIndex = 0;
  if (pathMatch) {
    references.push({
      path: normalized,
      line: 0,
      column: pathMatch.index + 1,
      kind: "path",
      token: pathMatch[0],
      lineText: normalized,
    });
  }

  if (content === null) return references;
  for (const [lineIndex, lineText] of content.split(/\r?\n/u).entries()) {
    for (const match of lineText.matchAll(NOMENCLATURE_PATTERN)) {
      references.push({
        path: normalized,
        line: lineIndex + 1,
        column: match.index + 1,
        kind: "content",
        token: match[0],
        lineText,
      });
    }
  }
  return references;
}

function rulePatternMatches(rule: NomenclatureRule, reference: RawReference): boolean {
  if (!rule.pattern) return true;
  const flags = rule.caseSensitive ? "u" : "iu";
  if (rule.granularity === "symbol-key") {
    return new RegExp(rule.pattern, flags).test(reference.token);
  }
  if (rule.granularity === "path") return new RegExp(rule.pattern, flags).test(reference.path);
  if (rule.granularity === "content-pattern") {
    const start = reference.column - 1;
    const end = start + reference.token.length;
    const expression = new RegExp(rule.pattern, `${flags}g`);
    return [...reference.lineText.matchAll(expression)].some((match) => {
      const matchStart = match.index;
      const matchEnd = matchStart + match[0].length;
      return matchStart < end && matchEnd > start;
    });
  }
  return new RegExp(rule.pattern, flags).test(reference.lineText);
}

export function ruleSpecificity(rule: NomenclatureRule, referencePath: string): number {
  if (rule.category === "keep-generated-history" && rule.granularity === "path") return 100;
  const normalized = normalizePath(referencePath);
  const matchingPaths = rule.paths.filter((path) => globToRegex(path).test(normalized));
  const scopeSpecificity =
    Math.max(
      0,
      ...matchingPaths.map((path) => path.replaceAll("*", "").replaceAll("?", "").length),
    ) / 1000;
  const patternSpecificity = (rule.pattern?.length ?? 0) / 1_000_000;
  if (rule.granularity === "file") return 50 + scopeSpecificity + patternSpecificity;
  if (rule.granularity === "symbol-key") return 40 + scopeSpecificity + patternSpecificity;
  if (rule.granularity === "content-pattern") return 30 + scopeSpecificity + patternSpecificity;
  return 10 + scopeSpecificity + patternSpecificity;
}

export function classificationMatches(rule: NomenclatureRule, reference: RawReference): boolean {
  if ((rule.kind ?? "classification") !== "classification") return false;
  if (!pathMatches(rule, reference.path)) return false;
  if (reference.kind === "path") {
    return (
      (rule.granularity === "path" || rule.granularity === "file") &&
      rulePatternMatches(rule, reference)
    );
  }
  if (rule.granularity === "path" && !rule.coversContents) return false;
  return rulePatternMatches(rule, reference);
}

export function denylistMatches(rule: NomenclatureRule, reference: RawReference): boolean {
  if (rule.kind !== "denylist" || !rule.pattern || !pathMatches(rule, reference.path)) return false;
  if (rule.granularity === "path") {
    return (
      reference.kind === "path" &&
      (reference.path === rule.pattern || reference.path.startsWith(`${rule.pattern}/`))
    );
  }
  if (reference.kind !== "content") return false;

  // The reference tokenizer intentionally keeps dotted qualifiers so reports
  // retain useful context (for example, `this.retiredIdentifier`). Exact
  // symbol-key denylists match the complete key or that key after a dotted
  // qualifier, and remain case-insensitive unless explicitly configured.
  const token = rule.caseSensitive ? reference.token : reference.token.toLocaleLowerCase("en-US");
  const pattern = rule.caseSensitive ? rule.pattern : rule.pattern.toLocaleLowerCase("en-US");
  return token === pattern || token.endsWith(`.${pattern}`);
}

export function toFinding(
  reference: RawReference,
  status: ReferenceFinding["status"],
  rules: readonly NomenclatureRule[],
  surfaceOverride?: Surface,
): ReferenceFinding {
  const surface = rules.length > 0 ? rules[0].surface : null;
  const category = rules.length > 0 ? rules[0].category : null;
  return {
    path: reference.path,
    line: reference.line,
    column: reference.column,
    kind: reference.kind,
    token: reference.token,
    status,
    ruleIds: rules.map((rule) => rule.id).sort(),
    surface: surfaceOverride ?? surface,
    category,
  };
}
