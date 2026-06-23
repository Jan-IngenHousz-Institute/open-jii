import type {
  ExperimentChartDataConfig,
  ExperimentChartType,
  ExperimentDataColumn,
  ExperimentDataSourceConfig,
  ExperimentRole,
} from "./experiment.schema";
import type { ColumnKind } from "../../transforms/column-type-utils";
import { getColumnKind } from "../../transforms/column-type-utils";

/**
 * Registry-driven role contracts for chart `dataConfig`. The wire format
 * stays flat (`dataConfig.dataSources` is one array of role-tagged entries);
 * this contract decides per chart type which roles are required, optional,
 * and whether they accept one source or many.
 */

export interface RoleContractEntry {
  /** Whether the role must be present with at least one configured column. */
  required: boolean;
  /** "single" means at most one source for this role; "many" allows N. */
  cardinality: "single" | "many";
  /**
   * Which column kinds this role accepts in the picker UI. Omit to allow
   * any plottable kind (numeric/temporal/categorical).
   */
  acceptedKinds?: readonly ColumnKind[];
}

export type RoleContract = Partial<Record<ExperimentRole, RoleContractEntry>>;

// Default kind set for roles that don't restrict. Plotly handles numeric /
// categorical / temporal axes natively.
const ANY_PLOTTABLE: readonly ColumnKind[] = ["numeric", "temporal", "categorical"];

export const CHART_TYPE_ROLE_CONTRACTS: Partial<Record<ExperimentChartType, RoleContract>> = {
  line: {
    // X is optional: when omitted, the renderer synthesises a row-index
    // X axis (`0..n-1`). Useful for quick "plot Y over observation
    // order" sketches when no natural X column exists.
    x: { required: false, cardinality: "single", acceptedKinds: ANY_PLOTTABLE },
    y: { required: true, cardinality: "many", acceptedKinds: ANY_PLOTTABLE },
    // Picking a color column splits the rendered series by its unique
    // values (one line per category, e.g. one line per device_id).
    color: { required: false, cardinality: "single", acceptedKinds: ANY_PLOTTABLE },
    // Faceting: split rows into one subplot per unique value. Categorical
    // only; a continuous numeric column would generate as many panels as
    // rows.
    facet: { required: false, cardinality: "single", acceptedKinds: ["categorical"] },
  },
  scatter: {
    // X is optional: row index fallback when omitted (same as line).
    x: { required: false, cardinality: "single", acceptedKinds: ANY_PLOTTABLE },
    y: { required: true, cardinality: "many", acceptedKinds: ANY_PLOTTABLE },
    color: { required: false, cardinality: "single", acceptedKinds: ANY_PLOTTABLE },
    facet: { required: false, cardinality: "single", acceptedKinds: ["categorical"] },
  },
  bar: {
    // Y restricted to numeric: Plotly will happily render strings on a
    // category Y axis but the result (one bar of unit height per unique
    // string) is rarely useful. X optional with row-index fallback.
    x: { required: false, cardinality: "single", acceptedKinds: ANY_PLOTTABLE },
    y: { required: true, cardinality: "many", acceptedKinds: ["numeric"] },
    // Color splits each X category into one bar per unique value (the
    // seaborn `hue=` pattern). Pairs with `barmode` (group / stack).
    // Categorical only; numeric explodes into one bar per value.
    color: { required: false, cardinality: "single", acceptedKinds: ["categorical"] },
    facet: { required: false, cardinality: "single", acceptedKinds: ["categorical"] },
  },
  area: {
    // Same role shape as line; stackgroup handles stacking when configured.
    x: { required: false, cardinality: "single", acceptedKinds: ANY_PLOTTABLE },
    y: { required: true, cardinality: "many", acceptedKinds: ANY_PLOTTABLE },
    // Categorical only, same hue-pattern reason as bar.
    color: { required: false, cardinality: "single", acceptedKinds: ["categorical"] },
    facet: { required: false, cardinality: "single", acceptedKinds: ["categorical"] },
  },
  "dot-plot": {
    // Discrete-magnitude variant of bar: one dot per category per Y series.
    x: { required: true, cardinality: "single", acceptedKinds: ANY_PLOTTABLE },
    y: { required: true, cardinality: "many", acceptedKinds: ["numeric"] },
    // Categorical only, same hue-style pattern as bar.
    color: { required: false, cardinality: "single", acceptedKinds: ["categorical"] },
  },
  lollipop: {
    // Single-series variant of bar. The wrapper takes scalar
    // `categories[] / values[]` and synthesises N stem traces + one dot
    // trace, so multi-Y is not supported.
    x: { required: true, cardinality: "single", acceptedKinds: ANY_PLOTTABLE },
    y: { required: true, cardinality: "single", acceptedKinds: ["numeric"] },
  },
  bubble: {
    // Scatter with a third numeric encoding mapped to marker size. `size`
    // numeric only (Plotly maps it through `sizeref` to pixel radius).
    x: { required: true, cardinality: "single", acceptedKinds: ANY_PLOTTABLE },
    y: { required: true, cardinality: "many", acceptedKinds: ANY_PLOTTABLE },
    size: { required: true, cardinality: "single", acceptedKinds: ["numeric"] },
    color: { required: false, cardinality: "single", acceptedKinds: ANY_PLOTTABLE },
    facet: { required: false, cardinality: "single", acceptedKinds: ["categorical"] },
  },
  pie: {
    // No axes; every row contributes one slice. `values` is optional: when
    // the aggregate is `count`, slice value is the row count per label.
    labels: { required: true, cardinality: "single", acceptedKinds: ANY_PLOTTABLE },
    values: { required: false, cardinality: "single", acceptedKinds: ["numeric"] },
  },
  histogram: {
    // Bins one or more columns into a frequency distribution. No X role:
    // Plotly's `histogram` trace bins the data column itself. Numeric /
    // temporal only; categorical degenerates into a bar chart.
    y: { required: true, cardinality: "many", acceptedKinds: ["numeric", "temporal"] },
    // Categorical only: a continuous numeric column would explode into
    // one single-row histogram per unique value.
    color: { required: false, cardinality: "single", acceptedKinds: ["categorical"] },
    facet: { required: false, cardinality: "single", acceptedKinds: ["categorical"] },
  },
  "box-plot": {
    // Plotly computes the five-number summary client-side from raw Y
    // values; no SQL aggregate. X optional: groups boxes by unique X
    // values when set, collapses to single box per Y when unset.
    x: { required: false, cardinality: "single", acceptedKinds: ANY_PLOTTABLE },
    y: { required: true, cardinality: "many", acceptedKinds: ["numeric"] },
    // Categorical only; pairs with `boxmode: "group"` / "overlay".
    color: { required: false, cardinality: "single", acceptedKinds: ["categorical"] },
    facet: { required: false, cardinality: "single", acceptedKinds: ["categorical"] },
  },
  "violin-plot": {
    // KDE mirrored around the median. Same data shape as box-plot; wrapper
    // computes the KDE client-side from raw `y` arrays.
    x: { required: false, cardinality: "single", acceptedKinds: ANY_PLOTTABLE },
    y: { required: true, cardinality: "many", acceptedKinds: ["numeric"] },
    color: { required: false, cardinality: "single", acceptedKinds: ["categorical"] },
    facet: { required: false, cardinality: "single", acceptedKinds: ["categorical"] },
  },
  "density-plot": {
    // Smoothed-line cousin of histogram. No `x` role: chart synthesises
    // X values from KDE sampling. Numeric only; KDE on categorical data
    // has no meaning.
    y: { required: true, cardinality: "many", acceptedKinds: ["numeric"] },
    color: { required: false, cardinality: "single", acceptedKinds: ["categorical"] },
    facet: { required: false, cardinality: "single", acceptedKinds: ["categorical"] },
  },
  "ridge-plot": {
    // Joyplot: multiple density curves stacked vertically, one per
    // category. Color is required because without categories there's
    // nothing to stack. Y is single; multi-Y stacks of stacks are
    // unreadable.
    y: { required: true, cardinality: "single", acceptedKinds: ["numeric"] },
    color: { required: true, cardinality: "single", acceptedKinds: ["categorical"] },
  },
  "histogram-2d": {
    // Joint distribution rendered as a heatmap of bin counts. Numeric /
    // temporal on both axes; categorical doesn't bin meaningfully.
    x: { required: true, cardinality: "single", acceptedKinds: ["numeric", "temporal"] },
    y: { required: true, cardinality: "single", acceptedKinds: ["numeric", "temporal"] },
  },
  "density-plot-2d": {
    // Scatter points overlaid with density contour lines (Plotly's
    // `histogram2dcontour`). Same data shape as histogram-2d.
    x: { required: true, cardinality: "single", acceptedKinds: ["numeric", "temporal"] },
    y: { required: true, cardinality: "single", acceptedKinds: ["numeric", "temporal"] },
  },
  polar: {
    // Scatter / line in polar coordinates. X is the angular column; numeric
    // or temporal only (categorical has no natural angular position).
    x: { required: true, cardinality: "single", acceptedKinds: ["numeric", "temporal"] },
    // Y is the radial magnitude. "many" so users can overlay measurements.
    y: { required: true, cardinality: "many", acceptedKinds: ["numeric"] },
    color: { required: false, cardinality: "single", acceptedKinds: ANY_PLOTTABLE },
  },
  radar: {
    // Polar layout of N axes radiating from a centre point. Need >= 3 Y
    // picks for a proper polygon; the contract encodes "many" and lets
    // the renderer fall through to empty-state on too-few picks.
    y: { required: true, cardinality: "many", acceptedKinds: ["numeric"] },
    // Optional grouping: aggregates each Y by this column (one polygon
    // per unique value).
    color: { required: false, cardinality: "single", acceptedKinds: ANY_PLOTTABLE },
  },
  ternary: {
    // Three-component composition on the simplex. Roles reuse cartesian
    // x/y/z slots; the data panel relabels them A/B/C axis. All required,
    // single, numeric.
    x: { required: true, cardinality: "single", acceptedKinds: ["numeric"] },
    y: { required: true, cardinality: "single", acceptedKinds: ["numeric"] },
    z: { required: true, cardinality: "single", acceptedKinds: ["numeric"] },
    // Optional grouping: one trace per unique value.
    color: { required: false, cardinality: "single", acceptedKinds: ANY_PLOTTABLE },
  },
  carpet: {
    // Parametric response surface. Same (x, y, z) shape as contour /
    // heatmap. X and Y numeric only: the parametric grid only carries
    // meaning when both factor axes are continuous.
    x: { required: true, cardinality: "single", acceptedKinds: ["numeric"] },
    y: { required: true, cardinality: "single", acceptedKinds: ["numeric"] },
    z: { required: true, cardinality: "single", acceptedKinds: ["numeric"] },
  },
  alluvial: {
    // Multi-stage categorical flow (Plotly `sankey`). Stages bind to the
    // `groupBy` role with cardinality "many".
    groupBy: { required: true, cardinality: "many", acceptedKinds: ["categorical"] },
    // Optional numeric flow value: link width sums this column per
    // transition pair instead of counting rows.
    value: { required: false, cardinality: "single", acceptedKinds: ["numeric"] },
  },
  "wind-rose": {
    // Stacked angular histogram (`barpolar`). X is the direction column
    // in degrees. Numeric only; temporal has no natural angular meaning.
    x: { required: true, cardinality: "single", acceptedKinds: ["numeric"] },
    // Y is the magnitude column. Single only; stacking is the defining
    // visual.
    y: { required: true, cardinality: "single", acceptedKinds: ["numeric"] },
  },
  "parallel-coordinates": {
    // Each picked numeric column becomes a vertical axis. Numeric only:
    // polylines need a continuous position along each axis.
    y: { required: true, cardinality: "many", acceptedKinds: ["numeric"] },
    color: { required: false, cardinality: "single", acceptedKinds: ANY_PLOTTABLE },
  },
  "correlation-matrix": {
    // Pairwise Pearson / Spearman correlation rendered as a symmetric
    // matrix. Chart computes M*(M-1)/2 pairwise `corr` aggregates and
    // unpacks them into the M*M matrix.
    y: { required: true, cardinality: "many", acceptedKinds: ["numeric"] },
  },
  contour: {
    // Same (x, y, z) shape as heatmap, rendered as iso-lines. X / Y
    // restricted to numeric / temporal: iso-line interpolation between
    // categorical positions has no scientific meaning.
    x: { required: true, cardinality: "single", acceptedKinds: ["numeric", "temporal"] },
    y: { required: true, cardinality: "single", acceptedKinds: ["numeric", "temporal"] },
    z: { required: true, cardinality: "single", acceptedKinds: ["numeric"] },
  },
  heatmap: {
    // Color matrix keyed by (x, y) with numeric Z driving the colorscale.
    // Permissive x/y so the categorical "rows x columns" matrix works.
    x: { required: true, cardinality: "single", acceptedKinds: ANY_PLOTTABLE },
    y: { required: true, cardinality: "single", acceptedKinds: ANY_PLOTTABLE },
    z: { required: true, cardinality: "single", acceptedKinds: ["numeric", "temporal"] },
  },
  "spc-control-chart": {
    // SPC chart: center line + control limits computed client-side from
    // raw rows. Pre-aggregating Y or bucketing X erases the per-observation
    // signal the control logic needs. Single-Y by design. X optional with
    // row-index fallback.
    x: { required: false, cardinality: "single", acceptedKinds: ["numeric", "temporal"] },
    y: { required: true, cardinality: "single", acceptedKinds: ["numeric"] },
  },
};

/**
 * Return the columns a given role can accept on a given chart type. Drops
 * complex types globally and applies the role's `acceptedKinds` if any.
 * Each chart's data-panel calls this once per shelf; the workspace passes
 * a single plottable column list that the chart slices per-role.
 */
export function filterColumnsForRole(
  columns: ExperimentDataColumn[],
  chartType: ExperimentChartType,
  role: ExperimentRole,
): ExperimentDataColumn[] {
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
  role?: ExperimentRole;
  message: string;
}

export type ValidationResult = { ok: true } | { ok: false; issues: ValidationIssue[] };

export function getRoleContract(chartType: ExperimentChartType): RoleContract | undefined {
  return CHART_TYPE_ROLE_CONTRACTS[chartType];
}

export function listRequiredRoles(chartType: ExperimentChartType): ExperimentRole[] {
  const contract = getRoleContract(chartType);
  if (!contract) return [];
  return (Object.entries(contract) as [ExperimentRole, RoleContractEntry][])
    .filter(([, entry]) => entry.required)
    .map(([role]) => role);
}

function isConfigured(source: ExperimentDataSourceConfig): boolean {
  return source.columnName.length > 0;
}

/**
 * Validate a `dataConfig` against the contract for its chart type. Roles
 * with empty `columnName` are treated as not yet configured so drafts can
 * persist; the canvas uses this to gate rendering.
 */
export function validateDataConfig(
  chartType: ExperimentChartType,
  dataConfig: ExperimentChartDataConfig,
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
  const sourcesByRole = new Map<ExperimentRole, ExperimentDataSourceConfig[]>();
  for (const source of dataConfig.dataSources) {
    const role = source.role;
    const list = sourcesByRole.get(role) ?? [];
    list.push(source);
    sourcesByRole.set(role, list);
  }

  for (const [roleKey, entry] of Object.entries(contract) as [ExperimentRole, RoleContractEntry][]) {
    const sources = sourcesByRole.get(roleKey) ?? [];
    const configured = sources.filter(isConfigured);

    if (entry.required && configured.length === 0) {
      issues.push({
        code: sources.length === 0 ? "MISSING_ROLE" : "EMPTY_COLUMN",
        role: roleKey,
        message:
          sources.length === 0
            ? `Chart type "${chartType}" requires role "${roleKey}"`
            : `ExperimentRole "${roleKey}" needs a column selected`,
      });
    }

    if (entry.cardinality === "single" && configured.length > 1) {
      issues.push({
        code: "BAD_CARDINALITY",
        role: roleKey,
        message: `ExperimentRole "${roleKey}" accepts a single source but ${configured.length} were configured`,
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

export function isDataConfigRenderable(chartType: ExperimentChartType, dataConfig: ExperimentChartDataConfig): boolean {
  return validateDataConfig(chartType, dataConfig).ok;
}
