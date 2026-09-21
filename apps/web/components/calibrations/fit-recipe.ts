/**
 * A first fit, written from what the capture records and what the blocks declare.
 *
 * The two ends of the script are already on the page: the series and their columns above
 * it, the blocks and their coefficients below. Retyping them into Python is where an
 * author spends an afternoon and introduces the misspelling that only fails at the bench.
 * What the recipe cannot decide it says so in the block, rather than guessing.
 */
import type {
  CalibrationOutputSchema,
  CoefficientSpec,
} from "@repo/api/domains/iot/calibration/iot-calibration.schema";
import { SWEEP_STIMULUS_COLUMN } from "@repo/iot";

import type { ProducedSeries } from "./produced-series";

type Coefficients = CalibrationOutputSchema["blocks"][string];

interface NumberCoefficient {
  name: string;
  spec: CoefficientSpec;
}

/** How one block is fitted, or why the recipe left it to the author. */
type BlockPlan =
  | {
      kind: "linear";
      block: string;
      series: string;
      x: string;
      y: string;
      order: string | null;
      slope: NumberCoefficient;
      intercept: NumberCoefficient;
    }
  | {
      kind: "origin";
      block: string;
      series: string;
      x: string;
      y: string;
      order: string;
      coefficient: NumberCoefficient;
    }
  | { kind: "skipped"; block: string; reason: string };

/** An open bound gates nothing, and the generated call has to say which way it is open. */
function bound(value: number | undefined, whenAbsent: string): string {
  return value === undefined ? whenAbsent : String(value);
}

function numberCoefficients(coefficients: Coefficients): NumberCoefficient[] {
  return Object.entries(coefficients)
    .filter(([, spec]) => spec.type === "number")
    .map(([name, spec]) => ({ name, spec }));
}

/**
 * Which two columns the line is drawn through.
 *
 * Two readings taken at the same point are a device against a reference, and the drive
 * only orders them. One reading is the drive against what it produced, which is how a
 * lamp or an LED is characterised.
 */
function axes(series: ProducedSeries): { x: string; y: string } | null {
  const hasStimulus = series.columns.includes(SWEEP_STIMULUS_COLUMN);
  const readings = series.columns.filter((column) => column !== SWEEP_STIMULUS_COLUMN);

  if (readings.length >= 2) {
    return { x: readings[0], y: readings[1] };
  }
  if (readings.length === 1 && hasStimulus) {
    return { x: SWEEP_STIMULUS_COLUMN, y: readings[0] };
  }

  return null;
}

function planBlock(
  block: string,
  coefficients: Coefficients,
  series: ProducedSeries | undefined,
): BlockPlan {
  if (series === undefined) {
    return { kind: "skipped", block, reason: "no capture series left to fit this block from" };
  }

  const numbers = numberCoefficients(coefficients);
  const declared = Object.keys(coefficients).length;
  if (declared === 0) {
    return { kind: "skipped", block, reason: "declares no coefficient to fit" };
  }
  if (numbers.length !== declared) {
    return {
      kind: "skipped",
      block,
      reason: "holds a per-channel coefficient, which is yours to fit",
    };
  }

  const drawn = axes(series);
  if (drawn === null) {
    return {
      kind: "skipped",
      block,
      reason: `series "${series.name}" records nothing to plot against`,
    };
  }

  // The drive is what the points are ordered by for the monotonicity gate. A series with
  // no drive of its own is ordered by the x it was fitted against.
  const stimulus = series.columns.includes(SWEEP_STIMULUS_COLUMN) ? SWEEP_STIMULUS_COLUMN : null;

  // Two coefficients read as the line they draw: the gain first, the offset after.
  if (numbers.length === 2) {
    return {
      kind: "linear",
      block,
      series: series.name,
      ...drawn,
      // Ordering by the axis the line is already drawn against would say nothing.
      order: stimulus === drawn.x ? null : stimulus,
      slope: numbers[0],
      intercept: numbers[1],
    };
  }
  if (numbers.length === 1) {
    return {
      kind: "origin",
      block,
      series: series.name,
      ...drawn,
      order: stimulus ?? drawn.x,
      coefficient: numbers[0],
    };
  }

  return {
    kind: "skipped",
    block,
    reason: `declares ${String(declared)} coefficients, which no single fit produces`,
  };
}

/** The pairs the line was drawn through, so a reviewer sees the fit and not the columns. */
function chartLines(plan: Extract<BlockPlan, { kind: "linear" | "origin" }>): string[] {
  return [
    `fit["chart"] = {`,
    `    "x": "${plan.x}",`,
    `    "y": "${plan.y}",`,
    `    "points": [[x, y] for x, y in zip(points["${plan.x}"], points["${plan.y}"])],`,
    `}`,
  ];
}

function submitLines(block: string, fitted: string, coefficients: string): string[] {
  return [
    `if ${fitted} and fit["passed"]:`,
    `    blocks["${block}"] = {`,
    `        "status": "computed",`,
    `        "coefficients": {${coefficients}},`,
    `        "quality": fit,`,
    `    }`,
    `else:`,
    `    blocks["${block}"] = {"status": "rejected", "reason": "; ".join(fit["reasons"]), "quality": fit}`,
  ];
}

/** Named once so the same sentence covers every open gate in the drafted script. */
function openBoundNote(name: string, spec: CoefficientSpec): string[] {
  const isOpen = spec.min === undefined || spec.max === undefined;
  return isOpen
    ? [`# ${name} is ungated: give it a min and a max below and this call gates it too.`]
    : [];
}

function linearLines(plan: Extract<BlockPlan, { kind: "linear" }>): string[] {
  const { slope, intercept } = plan;
  const interceptBounds = [
    ...(intercept.spec.min === undefined
      ? []
      : [`    intercept_min=${String(intercept.spec.min)},`]),
    ...(intercept.spec.max === undefined
      ? []
      : [`    intercept_max=${String(intercept.spec.max)},`]),
  ];

  return [
    `# ${plan.block}: ${plan.y} against ${plan.x}, as ${slope.name} * x + ${intercept.name}.`,
    ...openBoundNote(slope.name, slope.spec),
    `points = inputs["${plan.series}"]`,
    `fit = assess_linear_fit(`,
    `    points["${plan.x}"],`,
    `    points["${plan.y}"],`,
    ...(plan.order === null ? [] : [`    points["${plan.order}"],`]),
    `    slope_min=${bound(slope.spec.min, "-math.inf")},`,
    `    slope_max=${bound(slope.spec.max, "math.inf")},`,
    ...interceptBounds,
    `)`,
    ...chartLines(plan),
    `fitted = math.isfinite(fit["slope"]) and math.isfinite(fit["intercept"])`,
    ...submitLines(
      plan.block,
      "fitted",
      `"${slope.name}": fit["slope"], "${intercept.name}": fit["intercept"]`,
    ),
  ];
}

function originLines(plan: Extract<BlockPlan, { kind: "origin" }>): string[] {
  const { coefficient } = plan;

  return [
    `# ${plan.block}: ${plan.y} against ${plan.x}, through the origin.`,
    ...openBoundNote(coefficient.name, coefficient.spec),
    `points = inputs["${plan.series}"]`,
    `fit = assess_origin_fit(`,
    `    points["${plan.x}"],`,
    `    points["${plan.y}"],`,
    `    points["${plan.order}"],`,
    `    coefficient_min=${bound(coefficient.spec.min, "-math.inf")},`,
    `    coefficient_max=${bound(coefficient.spec.max, "math.inf")},`,
    `)`,
    ...chartLines(plan),
    `fitted = math.isfinite(fit["coefficient"])`,
    ...submitLines(plan.block, "fitted", `"${coefficient.name}": fit["coefficient"]`),
  ];
}

function blockLines(plan: BlockPlan): string[] {
  if (plan.kind === "linear") {
    return linearLines(plan);
  }
  if (plan.kind === "origin") {
    return originLines(plan);
  }

  return [
    `# ${plan.block}: ${plan.reason}.`,
    `blocks["${plan.block}"] = {"status": "skipped", "reason": "${plan.reason}"}`,
  ];
}

function importLines(plans: BlockPlan[]): string[] {
  const helpers = [
    ...(plans.some((plan) => plan.kind === "linear") ? ["assess_linear_fit"] : []),
    ...(plans.some((plan) => plan.kind === "origin") ? ["assess_origin_fit"] : []),
  ];
  if (helpers.length === 0) {
    return [];
  }

  return ["import math", "", `from qc import ${helpers.join(", ")}`, ""];
}

/**
 * A runnable draft of the fit for the blocks this definition declares, taking each block
 * in turn from the series recorded in the same order.
 */
export function fitRecipe(series: ProducedSeries[], outputSchema: CalibrationOutputSchema): string {
  const plans = Object.entries(outputSchema.blocks).map(([block, coefficients], index) =>
    planBlock(block, coefficients, series.at(index)),
  );

  const body = plans.flatMap((plan) => [...blockLines(plan), ""]);

  return [
    "# Drafted from the steps above and the blocks below. Read it before a bench run:",
    "# which column is fitted against which is a guess made from the order they are recorded in.",
    "",
    ...importLines(plans),
    "blocks = {}",
    "",
    ...body,
    "submit(blocks)",
    "",
  ].join("\n");
}
