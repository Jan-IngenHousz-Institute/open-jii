import type {
  AppliedCalibrationBlocks,
  CalibrationBlocks,
  CalibrationOutputSchema,
  CoefficientSpec,
} from "@repo/api/domains/iot/calibration/iot-calibration.schema";

/**
 * Validate produced blocks against a definition's output schema. Only computed
 * blocks carry coefficients, so only they are checked against the specs;
 * rejected and skipped blocks are recorded outcomes, not violations.
 *
 * The TypeScript twin of the sandbox handler's gate, applied where the platform
 * cannot rely on the sandbox having run: external-bench intake and approval.
 *
 * Returns violation messages; empty means valid.
 */
export function validateCalibrationBlocks(
  blocks: CalibrationBlocks,
  outputSchema: CalibrationOutputSchema,
): string[] {
  const reasons: string[] = [];
  const specByBlock = new Map(Object.entries(outputSchema.blocks));

  for (const name of specByBlock.keys()) {
    if (!(name in blocks)) {
      reasons.push(`Block '${name}' is required by the output schema but missing`);
    }
  }
  for (const name of Object.keys(blocks)) {
    if (!specByBlock.has(name)) {
      reasons.push(`Block '${name}' is not declared in the output schema`);
    }
  }

  for (const [blockName, block] of Object.entries(blocks)) {
    const coefficientSpecs = specByBlock.get(blockName);
    if (!coefficientSpecs) {
      continue;
    }
    if (block.status !== "computed" || !block.coefficients) {
      continue;
    }

    const specByCoefficient = new Map(Object.entries(coefficientSpecs));
    const coefficients = block.coefficients;

    for (const name of specByCoefficient.keys()) {
      if (!(name in coefficients)) {
        reasons.push(`Coefficient '${blockName}.${name}' is required but missing`);
      }
    }
    for (const [name, value] of Object.entries(coefficients)) {
      const coefficientSpec = specByCoefficient.get(name);
      if (!coefficientSpec) {
        reasons.push(`Coefficient '${blockName}.${name}' is not declared in the output schema`);
        continue;
      }
      reasons.push(...checkCoefficient(`${blockName}.${name}`, value, coefficientSpec));
    }

    const quality = block.quality;
    if (quality?.passed === false) {
      const qcReasons = Array.isArray(quality.reasons) ? quality.reasons : ["no reasons reported"];
      reasons.push(
        `Block '${blockName}' computed but its QC gates failed: ${qcReasons.join("; ")}`,
      );
    }
  }

  return reasons;
}

/** The blocks approval applies: the computed ones, stripped of their status. */
export function appliedCalibrationBlocks(blocks: CalibrationBlocks): AppliedCalibrationBlocks {
  const applied: AppliedCalibrationBlocks = {};
  for (const [name, block] of Object.entries(blocks)) {
    if (block.status === "computed" && block.coefficients) {
      applied[name] = {
        coefficients: block.coefficients,
        ...(block.fit ? { fit: block.fit } : {}),
        ...(block.quality ? { quality: block.quality } : {}),
      };
    }
  }
  return applied;
}

/** Whether any block produced coefficients; a run with none is a failure. */
export function hasComputedBlock(blocks: CalibrationBlocks): boolean {
  return Object.values(blocks).some((block) => block.status === "computed");
}

function checkCoefficient(
  label: string,
  value: number | number[],
  spec: CoefficientSpec,
): string[] {
  if (spec.type === "number") {
    if (typeof value !== "number" || !Number.isFinite(value)) {
      return [`Coefficient '${label}' must be a finite number`];
    }
    const reasons: string[] = [];
    if (spec.min !== undefined && value < spec.min) {
      reasons.push(`Coefficient '${label}' is below the allowed minimum ${spec.min}`);
    }
    if (spec.max !== undefined && value > spec.max) {
      reasons.push(`Coefficient '${label}' is above the allowed maximum ${spec.max}`);
    }
    return reasons;
  }

  if (!Array.isArray(value)) {
    return [`Coefficient '${label}' must be an integer array`];
  }
  if (value.length !== spec.length) {
    return [`Coefficient '${label}' must have exactly ${spec.length} entries`];
  }
  const reasons: string[] = [];
  value.forEach((entry, index) => {
    if (!Number.isInteger(entry)) {
      reasons.push(`Coefficient '${label}[${index}]' must be an integer`);
    } else if (spec.min !== undefined && entry < spec.min) {
      reasons.push(`Coefficient '${label}[${index}]' is below the allowed minimum`);
    } else if (spec.max !== undefined && entry > spec.max) {
      reasons.push(`Coefficient '${label}[${index}]' is above the allowed maximum`);
    }
  });
  return reasons;
}
