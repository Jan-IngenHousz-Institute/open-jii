/**
 * Edits on a calibration's output schema: one document in, one document out.
 *
 * Block and coefficient names are what the script submits and what the writer registry
 * matches on, so they are records rather than lists and their order is kept: the page
 * saves on a key built from the document, and a reordered record would look like a change.
 */
import type {
  CalibrationOutputSchema,
  CoefficientSpec,
} from "@repo/api/domains/iot/calibration/iot-calibration.schema";
import type { WritableCoefficient } from "@repo/iot";

/** A placeholder the author sets to their sensor's channel count. */
export const DEFAULT_ARRAY_LENGTH = 10;

/** Block and coefficient names become python dict keys, as the contract requires. */
export const COEFFICIENT_NAME_PATTERN = /^[a-z][a-z0-9_]{0,63}$/;

export type CoefficientType = CoefficientSpec["type"];

export const COEFFICIENT_TYPES: CoefficientType[] = ["number", "number_array", "integer_array"];

type Blocks = CalibrationOutputSchema["blocks"];
type Coefficients = Blocks[string];

export function addBlock(schema: CalibrationOutputSchema, name: string): CalibrationOutputSchema {
  return { blocks: { ...schema.blocks, [name]: {} } };
}

export function removeBlock(
  schema: CalibrationOutputSchema,
  name: string,
): CalibrationOutputSchema {
  const blocks: Blocks = {};
  for (const [block, coefficients] of Object.entries(schema.blocks)) {
    if (block !== name) {
      blocks[block] = coefficients;
    }
  }

  return { blocks };
}

export function renameBlock(
  schema: CalibrationOutputSchema,
  from: string,
  to: string,
): CalibrationOutputSchema {
  const blocks: Blocks = {};
  for (const [block, coefficients] of Object.entries(schema.blocks)) {
    blocks[block === from ? to : block] = coefficients;
  }

  return { blocks };
}

export function setCoefficient(
  schema: CalibrationOutputSchema,
  block: string,
  name: string,
  spec: CoefficientSpec,
): CalibrationOutputSchema {
  return {
    blocks: { ...schema.blocks, [block]: { ...schema.blocks[block], [name]: spec } },
  };
}

export function renameCoefficient(
  schema: CalibrationOutputSchema,
  block: string,
  from: string,
  to: string,
): CalibrationOutputSchema {
  const coefficients: Coefficients = {};
  for (const [name, spec] of Object.entries(schema.blocks[block] ?? {})) {
    coefficients[name === from ? to : name] = spec;
  }

  return { blocks: { ...schema.blocks, [block]: coefficients } };
}

export function removeCoefficient(
  schema: CalibrationOutputSchema,
  block: string,
  name: string,
): CalibrationOutputSchema {
  const coefficients: Coefficients = {};
  for (const [coefficient, spec] of Object.entries(schema.blocks[block] ?? {})) {
    if (coefficient !== name) {
      coefficients[coefficient] = spec;
    }
  }

  return { blocks: { ...schema.blocks, [block]: coefficients } };
}

/**
 * How a coefficient the platform can write is declared. A per-channel one is submitted as
 * an array, so declaring it as a number makes the first real fit fail validation.
 */
export function specForWritable(coefficient: WritableCoefficient): CoefficientSpec {
  return coefficient.isArray
    ? { type: "number_array", length: DEFAULT_ARRAY_LENGTH }
    : { type: "number" };
}

/** The same coefficient with one bound set, or cleared when the value is absent. */
export function withBound(
  spec: CoefficientSpec,
  field: "min" | "max",
  value: number | undefined,
): CoefficientSpec {
  const bounds: { min?: number; max?: number } = { min: spec.min, max: spec.max };
  if (value === undefined) {
    delete bounds[field];
  } else {
    bounds[field] = value;
  }

  if (spec.type === "number") {
    return { type: spec.type, ...bounds };
  }
  if (spec.type === "number_array") {
    return { type: spec.type, length: spec.length, ...bounds };
  }

  return { type: spec.type, length: spec.length, ...bounds };
}

/** A name nothing in `taken` holds, numbered from the second. */
export function uniqueName(base: string, taken: string[]): string {
  if (!taken.includes(base)) {
    return base;
  }
  for (let suffix = 2; ; suffix++) {
    const numbered = `${base}_${String(suffix)}`;
    if (!taken.includes(numbered)) {
      return numbered;
    }
  }
}

/** How many entries a per-channel coefficient holds; a plain number has none to set. */
export function withLength(spec: CoefficientSpec, length: number): CoefficientSpec {
  return spec.type === "number" ? spec : { ...spec, length };
}

/**
 * The same coefficient under a new type, keeping the bounds where they still apply.
 * An integer array cannot carry fractional bounds, so those are dropped rather than
 * rounded into something the author did not ask for.
 */
export function retypeCoefficient(spec: CoefficientSpec, type: CoefficientType): CoefficientSpec {
  const length = spec.type === "number" ? DEFAULT_ARRAY_LENGTH : spec.length;
  const isWhole = (value: number | undefined) => value === undefined || Number.isInteger(value);
  const bounds = {
    ...(spec.min === undefined ? {} : { min: spec.min }),
    ...(spec.max === undefined ? {} : { max: spec.max }),
  };

  if (type === "number") {
    return { type, ...bounds };
  }
  if (type === "number_array") {
    return { type, length, ...bounds };
  }

  return {
    type,
    length,
    ...(isWhole(spec.min) && isWhole(spec.max) ? bounds : {}),
  };
}
