import type {
  ChartDataConfig,
  ChartType,
  DataColumn,
  DataSourceConfig,
  Role,
} from "../schemas/experiment.schema";
import type { ColumnKind } from "./column-type-utils";
import { getColumnKind } from "./column-type-utils";

/**
 * Registry-driven role contracts for chart `dataConfig`.
 *
 * The wire format stays flat — `dataConfig.dataSources` is a single array of
 * `{ tableName, columnName, role, ... }` entries. The contract here decides,
 * per chart type, which roles are required, which are optional, and whether
 * a role accepts a single source or many. This keeps the schema generic
 * while still enforcing chart-specific shape at the seam between API and UI.
 */

export interface RoleContractEntry {
  /** Whether the role must be present with at least one configured column. */
  required: boolean;
  /** "single" means at most one source for this role; "many" allows N. */
  cardinality: "single" | "many";
  /**
   * Which column kinds this role accepts in the picker UI. Omit to allow
   * any plottable kind (numeric/temporal/categorical). Use this when the
   * chart type semantically requires a narrower set — e.g. a 3D scatter's
   * `z` accepts only `numeric`, a heatmap's `z` accepts only `numeric`,
   * a pie's `labels` accepts only `categorical`.
   */
  acceptedKinds?: readonly ColumnKind[];
}

export type RoleContract = Partial<Record<Role, RoleContractEntry>>;

// Default kind set for roles that don't restrict — line and scatter today.
// Plotly handles numeric/categorical/temporal axes natively, so the picker
// should surface anything plottable and let the renderer adapt.
const ANY_PLOTTABLE: readonly ColumnKind[] = ["numeric", "temporal", "categorical"];

export const CHART_TYPE_ROLE_CONTRACTS: Partial<Record<ChartType, RoleContract>> = {
  line: {
    x: { required: true, cardinality: "single", acceptedKinds: ANY_PLOTTABLE },
    y: { required: true, cardinality: "many", acceptedKinds: ANY_PLOTTABLE },
  },
  scatter: {
    x: { required: true, cardinality: "single", acceptedKinds: ANY_PLOTTABLE },
    y: { required: true, cardinality: "many", acceptedKinds: ANY_PLOTTABLE },
    color: { required: false, cardinality: "single", acceptedKinds: ANY_PLOTTABLE },
  },
  // Bar charts in this codebase group rows by their X column and aggregate
  // a numeric Y per group, or fall back to row counts when Y is empty.
  // The bar data panel additionally surfaces the CONTRIBUTOR well-known
  // struct as an X option even though `filterColumnsForRole` strips
  // complex kinds — the role contract stays "categorical-only" so the
  // generic picker filter behaves the same as for every other chart type.
  bar: {
    x: { required: true, cardinality: "single", acceptedKinds: ["categorical"] },
    y: { required: false, cardinality: "single", acceptedKinds: ["numeric"] },
  },
};

/**
 * Return the columns a given role can accept on a given chart type. Drops
 * complex types globally and applies the role's `acceptedKinds` if any.
 * Each chart's data-panel calls this once per shelf; the workspace passes
 * a single plottable column list that the chart slices per-role.
 */
export function filterColumnsForRole(
  columns: DataColumn[],
  chartType: ChartType,
  role: Role,
): DataColumn[] {
  const entry = getRoleContract(chartType)?.[role];
  const accepted = entry?.acceptedKinds ?? ANY_PLOTTABLE;
  return columns.filter((col) => {
    const kind = getColumnKind(col.type_text);
    if (!kind || kind === "complex") return false;
    return accepted.includes(kind);
  });
}

export type ValidationIssueCode =
  | "UNKNOWN_CHART_TYPE"
  | "MISSING_ROLE"
  | "EMPTY_COLUMN"
  | "EXTRA_ROLE"
  | "BAD_CARDINALITY";

export interface ValidationIssue {
  code: ValidationIssueCode;
  role?: Role;
  message: string;
}

export type ValidationResult = { ok: true } | { ok: false; issues: ValidationIssue[] };

export function getRoleContract(chartType: ChartType): RoleContract | undefined {
  return CHART_TYPE_ROLE_CONTRACTS[chartType];
}

export function listRequiredRoles(chartType: ChartType): Role[] {
  const contract = getRoleContract(chartType);
  if (!contract) return [];
  return (Object.entries(contract) as [Role, RoleContractEntry][])
    .filter(([, entry]) => entry.required)
    .map(([role]) => role);
}

function isConfigured(source: DataSourceConfig): boolean {
  return source.columnName.length > 0;
}

/**
 * Validate a `dataConfig` against the contract for its chart type.
 *
 * Treats roles with empty `columnName` as not yet configured — a freshly
 * created visualization can persist as a draft without satisfying the
 * contract, and the canvas uses this to gate rendering.
 */
export function validateDataConfig(
  chartType: ChartType,
  dataConfig: ChartDataConfig,
): ValidationResult {
  const contract = getRoleContract(chartType);
  if (!contract) {
    return {
      ok: false,
      issues: [
        {
          code: "UNKNOWN_CHART_TYPE",
          message: `No role contract registered for chart type "${chartType}"`,
        },
      ],
    };
  }

  const issues: ValidationIssue[] = [];
  const sourcesByRole = new Map<Role, DataSourceConfig[]>();
  for (const source of dataConfig.dataSources) {
    const role = source.role;
    const list = sourcesByRole.get(role) ?? [];
    list.push(source);
    sourcesByRole.set(role, list);
  }

  for (const [roleKey, entry] of Object.entries(contract) as [Role, RoleContractEntry][]) {
    const sources = sourcesByRole.get(roleKey) ?? [];
    const configured = sources.filter(isConfigured);

    if (entry.required && configured.length === 0) {
      issues.push({
        code: sources.length === 0 ? "MISSING_ROLE" : "EMPTY_COLUMN",
        role: roleKey,
        message:
          sources.length === 0
            ? `Chart type "${chartType}" requires role "${roleKey}"`
            : `Role "${roleKey}" needs a column selected`,
      });
    }

    if (entry.cardinality === "single" && configured.length > 1) {
      issues.push({
        code: "BAD_CARDINALITY",
        role: roleKey,
        message: `Role "${roleKey}" accepts a single source but ${configured.length} were configured`,
      });
    }
  }

  for (const role of sourcesByRole.keys()) {
    if (!(role in contract)) {
      issues.push({
        code: "EXTRA_ROLE",
        role,
        message: `Chart type "${chartType}" does not accept role "${role}"`,
      });
    }
  }

  if (issues.length > 0) return { ok: false, issues };
  return { ok: true };
}

export function isDataConfigRenderable(chartType: ChartType, dataConfig: ChartDataConfig): boolean {
  return validateDataConfig(chartType, dataConfig).ok;
}
