export const SURFACES = [
  "mobile",
  "web",
  "backend",
  "docs",
  "api",
  "database",
  "iot",
  "tooling",
  "other-app",
] as const;

export type Surface = (typeof SURFACES)[number];

export const CATEGORIES = [
  "rename-neutral",
  "family-aware",
  "keep-product-specific",
  "keep-compatibility",
  "keep-generated-history",
  "fixture",
] as const;

export type Category = (typeof CATEGORIES)[number];

export type Granularity = "path" | "file" | "symbol-key" | "content-pattern";
export type Disposition =
  | "rename"
  | "make-family-aware"
  | "preserve"
  | "regenerate"
  | "fixture-only";

export interface NomenclatureRule {
  id: string;
  kind?: "classification" | "denylist";
  surface: Surface;
  category: Category;
  granularity: Granularity;
  paths: readonly string[];
  pattern?: string;
  disposition: Disposition;
  target: string;
  rationale: string;
  compatibilityBoundary: string | null;
  caseSensitive?: boolean;
  /** Path rules only: intentionally classify contents wholesale. */
  coversContents?: boolean;
}

export interface RuleManifest {
  version: 1;
  rules: readonly NomenclatureRule[];
}

export type ReferenceKind = "path" | "content";
export type FindingStatus = "classified" | "unclassified" | "ambiguous" | "forbidden";

export interface ReferenceFinding {
  path: string;
  line: number;
  column: number;
  kind: ReferenceKind;
  token: string;
  status: FindingStatus;
  ruleIds: readonly string[];
  surface: Surface | null;
  category: Category | null;
}

export interface DeadRuleFinding {
  ruleId: string;
  reason: string;
}

export interface InventoryReport {
  schemaVersion: 1;
  trackedFileCount: number;
  scannedTextFileCount: number;
  summary: {
    totalReferences: number;
    classified: number;
    unclassified: number;
    ambiguous: number;
    forbidden: number;
    deadRules: number;
    nomenclatureIssues: number;
  };
  countsBySurface: Record<string, number>;
  countsByCategory: Record<string, number>;
  findings: readonly ReferenceFinding[];
  deadRules: readonly DeadRuleFinding[];
}

export interface TrackedTextFile {
  path: string;
  content: string | null;
}
