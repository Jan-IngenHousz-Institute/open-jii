import { z } from "zod";

/**
 * Command-source contract shared by workbook-cell schemas, experiment-flow
 * schemas, the workbook <-> flow converters, and both runner hosts. Kept in a
 * neutral module (no dependency on workbook-cells or experiment schemas) so
 * every consumer imports one definition without an import cycle. See the
 * technical plan, section 1.
 *
 * A command cell carries one of two source variants:
 *
 *   - static: enter the command directly (existing string / JSON / YAML). The
 *     `kind` discriminator is absent in every workbook saved before dynamic
 *     commands existed, so it stays optional and no data migration is needed.
 *   - ref: resolve the command on every run from an earlier cell's output. Only
 *     the reference (and an optional author name) is stored; there is NO hidden
 *     static fallback.
 *
 * Both variants are strict, so a mixed static/ref shape is rejected. Structural
 * validity of a ref (source exists, is earlier, is eligible, field non-empty)
 * is NOT enforced here. A damaged draft must still load and be repairable, so
 * those checks live in `validateDynamicCommandReferences` and run at publish.
 */

// Inline command formats a static command can carry.
export const zCommandFormat = z.enum(["string", "json", "yaml"]);
export type CommandFormat = z.infer<typeof zCommandFormat>;

// Reference to a top-level field of an earlier producing cell's output. Neither
// field is length-constrained here: an empty source id or field is a repairable
// draft state that the structural validator reports, not a parse error.
export const zCommandRef = z
  .object({
    sourceCellId: z.string(),
    field: z.string(),
  })
  .strict();
export type CommandRef = z.infer<typeof zCommandRef>;

const staticSourceShape = {
  kind: z.literal("static").optional(),
  format: zCommandFormat,
  content: z.string().min(1, "Command content is required"),
};

const referencedSourceShape = {
  kind: z.literal("ref"),
  ref: zCommandRef,
};

/** Static command source as carried on a flow node (no author name). */
export const zStaticCommandSource = z.object(staticSourceShape).strict();
/** Referenced command source as carried on a flow node (no author name). */
export const zReferencedCommandSource = z.object(referencedSourceShape).strict();
/** Command source variants as serialized onto a flow-node's `command` carrier. */
export const zCommandSource = z.union([zStaticCommandSource, zReferencedCommandSource]);

/** Static command payload on a workbook `command` cell (adds optional author name). */
export const zStaticCommandPayload = z
  .object({ ...staticSourceShape, name: z.string().optional() })
  .strict();
/** Referenced command payload on a workbook `command` cell (adds optional author name). */
export const zReferencedCommandPayload = z
  .object({ ...referencedSourceShape, name: z.string().optional() })
  .strict();
/** The `command` cell payload: a strict static OR ref variant. */
export const zCommandPayload = z.union([zStaticCommandPayload, zReferencedCommandPayload]);

export type StaticCommandSource = z.infer<typeof zStaticCommandSource>;
export type ReferencedCommandSource = z.infer<typeof zReferencedCommandSource>;
export type CommandSource = z.infer<typeof zCommandSource>;
export type StaticCommandPayload = z.infer<typeof zStaticCommandPayload>;
export type ReferencedCommandPayload = z.infer<typeof zReferencedCommandPayload>;
export type CommandPayload = z.infer<typeof zCommandPayload>;

/**
 * Flow-node content carrier for a command node. A measurement node carries a
 * protocol reference OR this inline command; the ref carrier is recognized
 * before the static carrier when reconstructing a cell.
 */
export const zExperimentMeasurementCommandContent = z
  .object({
    command: zCommandSource,
  })
  .strict();

/** True when a flow-node command carrier is the referenced (dynamic) variant. */
export function isReferencedCommand(
  value: CommandSource | null | undefined,
): value is ReferencedCommandSource {
  return value?.kind === "ref";
}

/** True when a `command` cell payload is the referenced (dynamic) variant. */
export function isReferencedCommandPayload(
  payload: CommandPayload,
): payload is ReferencedCommandPayload {
  return payload.kind === "ref";
}
