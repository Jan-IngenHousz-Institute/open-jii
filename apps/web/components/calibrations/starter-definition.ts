import type {
  CalibrationFamily,
  CreateCalibrationDefinitionBody,
} from "@repo/api/domains/iot/calibration/iot-calibration.schema";
import { familyCalibrationCapabilities, isSensorFamily } from "@repo/iot";

import { specForWritable } from "./output-schema-edits";

/** A definition needs a procedure, script and schema to exist, so a new one cannot start blank. */
export function starterDefinition(
  family: CalibrationFamily,
): Omit<CreateCalibrationDefinitionBody, "name" | "organizationId"> {
  const blocks = writableStarterBlocks(family);

  return {
    family,
    captureProcedure: {
      instruments: [{ role: "dut" }],
      steps: [
        {
          kind: "read",
          series: "reading",
          prompt: "Describe what the operator should set up before this reading is taken.",
          read: [{ instrument: "dut", command: "hello", as: "reply" }],
        },
      ],
    },
    script: starterScript(blocks),
    outputSchema: { blocks },
  };
}

function writableStarterBlocks(
  family: CalibrationFamily,
): CreateCalibrationDefinitionBody["outputSchema"]["blocks"] {
  const writable = isSensorFamily(family)
    ? familyCalibrationCapabilities(family).writableCoefficients
    : {};

  const blocks: CreateCalibrationDefinitionBody["outputSchema"]["blocks"] = {};
  for (const [block, coefficients] of Object.entries(writable)) {
    for (const coefficient of coefficients ?? []) {
      blocks[block] = { ...blocks[block], [coefficient.name]: specForWritable(coefficient) };
    }
  }

  // A family the platform cannot write is still worth a definition: the run is recorded.
  return Object.keys(blocks).length > 0 ? blocks : { result: { value: { type: "number" } } };
}

function starterScript(blocks: CreateCalibrationDefinitionBody["outputSchema"]["blocks"]): string {
  const skipped = Object.keys(blocks)
    .map((block) => `        "${block}": {"status": "skipped", "reason": "not fitted yet"},`)
    .join("\n");

  return `# The readings arrive as one DataFrame per series, named as the procedure names them.
# Call submit() exactly once, with a block for every name the output schema declares.
#
# from qc import assess_linear_fit
# points = inputs["reading"]
# fit = assess_linear_fit(points["x"], points["y"], slope_min=0.1, slope_max=10)

submit(
    {
${skipped}
    }
)
`;
}

/** Numbered rather than stamped: "Untitled calibration 2" says which unfinished one this is. */
export function untitledCalibrationName(taken: string[]): string {
  return freeName("Untitled calibration", taken);
}

/** The same, for a copy taken from a definition a run has closed to edits. */
export function copyOfName(name: string, taken: string[]): string {
  return freeName(`${name} (copy)`, taken);
}

function freeName(base: string, taken: string[]): string {
  if (!taken.includes(base)) {
    return base;
  }
  for (let suffix = 2; ; suffix++) {
    const candidate = `${base} ${suffix}`;
    if (!taken.includes(candidate)) {
      return candidate;
    }
  }
}
