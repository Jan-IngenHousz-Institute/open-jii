import { z } from "zod";

import { RESERVED_EXPERIMENT_COLUMN_NAMES } from "../experiment.schema";

function isAllowedMetadataColumnChar(c: string): boolean {
  return (c >= "a" && c <= "z") || (c >= "A" && c <= "Z") || (c >= "0" && c <= "9") || c === "_";
}

const zMetadataColumnName = z
  .string()
  .min(1, "Column name is required")
  .max(64, "Column name must be 64 characters or less")
  .refine(
    (s) => Array.from(s).every(isAllowedMetadataColumnChar),
    "Column names can only contain letters, digits, and underscores",
  );

const zMetadataColumn = z.object({
  id: z.string().min(1),
  name: zMetadataColumnName,
  type: z.enum(["string", "number", "date"]),
});

const zMetadataRow = z
  .object({
    _id: z.string().min(1),
  })
  .catchall(z.unknown());

/**
 * Custom metadata payload as stored on the wire and persisted to
 * `experiment_custom_metadata.metadata` (VARIANT).
 */
export const zExperimentCustomMetadataPayload = z
  .object({
    // Empty allowed: the client auto-generates "Untitled Metadata N" when blank.
    name: z.string().max(120),
    columns: z.array(zMetadataColumn).min(1, "At least one column is required"),
    rows: z.array(zMetadataRow),
    identifierColumnId: z
      .string()
      .min(1, "Identifier column is required")
      .max(64, "Identifier column must be 64 characters or less"),
    experimentQuestionId: z
      .string()
      .min(1, "Experiment question is required")
      .max(64, "Experiment question must be 64 characters or less"),
  })
  .superRefine((blob, ctx) => {
    // Reserved names: would collide with system columns once `custom_metadata`
    // is flattened to top-level by an export sink that requires unique columns.
    blob.columns.forEach((col, idx) => {
      if (RESERVED_EXPERIMENT_COLUMN_NAMES.has(col.name)) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ["columns", idx, "name"],
          message: `"${col.name}" is a reserved column name`,
        });
      }
    });

    // Duplicate column names within the same blob: at save time the FE remaps
    // row keys by name, so two columns with the same name silently overwrite
    // each other (last write wins, first column's data is lost).
    const seen = new Map<string, number>();
    blob.columns.forEach((col, idx) => {
      const prev = seen.get(col.name);
      if (prev !== undefined) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ["columns", idx, "name"],
          message: `Column name "${col.name}" is duplicated`,
        });
      } else {
        seen.set(col.name, idx);
      }
    });

    // identifierColumnId must reference a real column on this blob.
    // Compared against `column.id` so the same schema validates both shapes:
    // FE editing-time (id is `col_X`, identifierColumnId is `col_X`) and
    // on-the-wire (id and name are equal after the col-X to name remap).
    if (!blob.columns.some((c) => c.id === blob.identifierColumnId)) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["identifierColumnId"],
        message: `Identifier column "${blob.identifierColumnId}" is not in columns`,
      });
    }
  });

export const zExperimentMetadata = z.object({
  metadataId: z.string().uuid(),
  experimentId: z.string().uuid(),
  // Response stays loose: legacy records persisted before validation existed
  // may not match the structured shape.
  metadata: z.record(z.string(), z.unknown()),
  createdBy: z.string().uuid(),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
});

/**
 * Compose `zExperimentCustomMetadataPayload` with a flow-aware refinement that rejects
 * any column name that collides with a sanitized question label from the
 * experiment's flow. The collision set must be supplied by the caller (the FE
 * form, which already has the flow loaded), since zod cannot read the DB.
 *
 * The identifier column is exempt: it's the column that joins against a
 * question's answers, the pipeline filters it out of `custom_metadata` before
 * the gold tables, and naming it after the question it matches is natural.
 */
export function makeCustomMetadataFormSchema(reservedQuestionLabels: ReadonlySet<string>) {
  return zExperimentCustomMetadataPayload.superRefine((blob, ctx) => {
    blob.columns.forEach((col, idx) => {
      if (col.id === blob.identifierColumnId) return;
      if (reservedQuestionLabels.has(col.name)) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ["columns", idx, "name"],
          message: `Column "${col.name}" collides with an existing question label`,
        });
      }
    });
  });
}

export const zCreateExperimentMetadataBody = z.object({
  metadata: zExperimentCustomMetadataPayload,
});

export const zUpdateExperimentMetadataBody = z.object({
  metadata: zExperimentCustomMetadataPayload,
});

export const zExperimentMetadataPathParam = z.object({
  id: z.string().uuid().describe("ID of the experiment"),
  metadataId: z.string().uuid().describe("ID of the metadata record"),
});

export type ExperimentMetadata = z.infer<typeof zExperimentMetadata>;
export type CreateExperimentMetadataBody = z.infer<typeof zCreateExperimentMetadataBody>;
export type UpdateExperimentMetadataBody = z.infer<typeof zUpdateExperimentMetadataBody>;
export type ExperimentCustomMetadataPayload = z.infer<typeof zExperimentCustomMetadataPayload>;
