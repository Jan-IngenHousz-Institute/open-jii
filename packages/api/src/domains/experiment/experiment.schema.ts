import { z } from "zod";

import { sanitizeQuestionLabel } from "../../transforms/label-sanitization";
import { zMacroLanguage } from "../macro/macro.schema";
import { zSensorFamily } from "../protocol/protocol.schema";
import { zExperimentData } from "./data/experiment-data.schema";
import type {
  zExperimentGeocodeQuery,
  zExperimentGeocodeResponse,
  zExperimentLocation,
  zExperimentPlaceSearchQuery,
  zExperimentPlaceSearchResponse,
  zExperimentPlaceSearchResult,
} from "./locations/experiment-locations.schema";
import {
  zExperimentLocationInput,
  zExperimentLocationList,
} from "./locations/experiment-locations.schema";

// Define Zod schemas for experiment models
export const zExperimentStatus = z.enum(["active", "stale", "archived", "published"]);

export const zExperimentVisibility = z.enum(["private", "public"]);

export const zExperimentMemberRole = z.enum(["admin", "member"]);

export const zExperiment = z.object({
  id: z.string().uuid(),
  name: z.string(),
  description: z.string().nullable(),
  status: zExperimentStatus,
  visibility: zExperimentVisibility,
  embargoUntil: z.string().datetime(),
  anonymizeContributors: z.boolean(),
  workbookId: z.string().uuid().nullable(),
  workbookVersionId: z.string().uuid().nullable(),
  createdBy: z.string().uuid(),
  ownerFirstName: z.string().nullable().optional(),
  ownerLastName: z.string().nullable().optional(),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
  data: zExperimentData.optional(),
  locations: zExperimentLocationList.optional(),
});

export const zExperimentList = z.array(zExperiment);

export const zExperimentAccess = z.object({
  experiment: zExperiment,
  hasAccess: z.boolean(),
  isAdmin: z.boolean(),
});

export const zExperimentFlowNodeType = z.enum([
  "question",
  "instruction",
  "measurement",
  "analysis",
  "branch",
]);

export const zExperimentQuestionKind = z.enum(["yes_no", "open_ended", "multi_choice", "number"]);

// Question content is a strict discriminated union so invalid extra keys are rejected
const zQuestionYesNo = z
  .object({
    kind: z.literal("yes_no"),
    text: z.string().max(64, "Question text must be 64 characters or less"),
    required: z.boolean().optional().default(false),
  })
  .strict();

const zQuestionOpenEnded = z
  .object({
    kind: z.literal("open_ended"),
    text: z.string().max(64, "Question text must be 64 characters or less"),
    required: z.boolean().optional().default(false),
  })
  .strict();

const zQuestionMultiChoice = z
  .object({
    kind: z.literal("multi_choice"),
    text: z.string().max(64, "Question text must be 64 characters or less"),
    options: z
      .array(
        z
          .string()
          .min(1, "Option text is required")
          .max(64, "Option text must be 64 characters or less"),
      )
      .min(1, "At least one option is required for multiple choice questions"),
    required: z.boolean().optional().default(false),
  })
  .strict();

const zQuestionNumber = z
  .object({
    kind: z.literal("number"),
    text: z.string().max(64, "Question text must be 64 characters or less"),
    required: z.boolean().optional().default(false),
  })
  .strict();

export const zExperimentQuestionContent = z.discriminatedUnion("kind", [
  zQuestionYesNo,
  zQuestionOpenEnded,
  zQuestionMultiChoice,
  zQuestionNumber,
]);

export const zExperimentInstructionContent = z.object({
  text: z.string().min(1, "Instruction text is required"),
});

export const zExperimentMeasurementContent = z.object({
  protocolId: z.string().uuid("A valid protocol must be selected for measurement nodes"),
  params: z.record(z.string(), z.unknown()).optional(),
});

export const zExperimentAnalysisContent = z.object({
  macroId: z.string().uuid("A valid macro must be selected for analysis nodes"),
  params: z.record(z.string(), z.unknown()).optional(),
});

export const zExperimentBranchPathSummary = z.object({
  id: z.string().min(1),
  label: z.string().max(64),
  color: z.string(),
});

export const zExperimentBranchContent = z.object({
  paths: z.array(zExperimentBranchPathSummary).min(1),
  defaultPathId: z.string().optional(),
});

export const zExperimentFlowNode = z.object({
  id: z.string().min(1),
  type: zExperimentFlowNodeType,
  name: z
    .string()
    .min(1, "Node label is required")
    .max(64, "Node label must be 64 characters or less"),
  content: z.union([
    zExperimentQuestionContent,
    zExperimentInstructionContent,
    zExperimentMeasurementContent,
    zExperimentAnalysisContent,
    zExperimentBranchContent,
  ]),
  // A node can be marked as a start node. Exactly one node must be the start node for any flow.
  isStart: z.boolean().optional().default(false),
  // Optional persisted layout position (added later for backwards compatibility)
  position: z
    .object({
      x: z.number(),
      y: z.number(),
    })
    .optional(),
});

export const zExperimentFlowEdge = z.object({
  id: z.string().min(1),
  source: z.string().min(1),
  target: z.string().min(1),
  label: z.string().max(64, "Edge label must be 64 characters or less").optional().nullable(),
  sourceHandle: z.string().max(64).optional().nullable(),
});

/**
 * Column names that are reserved by the centrum gold tables. User-supplied
 * column keys (sanitized question labels, custom-metadata column names) must
 * not collide with these, since both questions_data and custom_metadata get
 * flattened to top-level alongside the system columns.
 *
 * Keep in sync with the gold-table column set in
 * apps/data/src/pipelines/centrum_pipeline.py.
 */
export const RESERVED_EXPERIMENT_COLUMN_NAMES: ReadonlySet<string> = new Set([
  // experiment_raw_data top-level columns
  "id",
  "experiment_id",
  "device_id",
  "device_name",
  "device_version",
  "timestamp",
  "timezone",
  "macros",
  "questions_data",
  "annotations",
  "user_id",
  "data",
  "output_data",
  "date",
  "processed_timestamp",
  "skip_macro_processing",
  "custom_metadata",
  // experiment_macro_data extras
  "raw_id",
  "macro_id",
  "macro_name",
  "macro_filename",
  "macro_output",
  "macro_error",
  // pipeline-internal
  "_id",
]);

export const zExperimentFlowGraph = z
  .object({
    nodes: z.array(zExperimentFlowNode).min(1, "At least one node is required to create a flow"),
    edges: z.array(zExperimentFlowEdge),
  })
  .superRefine((graph, ctx) => {
    // Require exactly one start node when nodes are present
    const startCount = graph.nodes.reduce((acc, n) => (n.isStart === true ? acc + 1 : acc), 0);
    if (graph.nodes.length > 0 && startCount !== 1) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Exactly one start node is required",
        path: ["nodes"],
      });
    }

    // Reject duplicate question-node labels. Only question nodes need this:
    // their labels become column keys in `questions_data`, so duplicates collide
    // and lose answers downstream. Other node types' labels are display-only.
    // Compare on the canonicalized form so labels that only differ by
    // punctuation/whitespace (and would collapse to the same column key)
    // are also caught.
    //
    // Also reject question labels whose canonical form lands on a reserved
    // experiment-data column name. Those would shadow a system column once
    // `questions_data` is flattened to top-level on read or export.
    const seen = new Map<string, number>();
    graph.nodes.forEach((node, index) => {
      if (node.type !== "question") return;
      const canonical = sanitizeQuestionLabel(node.name);
      if (RESERVED_EXPERIMENT_COLUMN_NAMES.has(canonical)) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: `Question label "${node.name}" resolves to reserved column "${canonical}"`,
          path: ["nodes", index, "name"],
        });
        return;
      }
      if (seen.has(canonical)) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: `Question node label "${node.name}" must be unique`,
          path: ["nodes", index, "name"],
        });
        return;
      }
      seen.set(canonical, index);
    });
  });

// Infer types from Zod schemas
export type ExperimentStatus = z.infer<typeof zExperimentStatus>;
export type ExperimentVisibility = z.infer<typeof zExperimentVisibility>;
export type ExperimentMemberRole = z.infer<typeof zExperimentMemberRole>;
export type Experiment = z.infer<typeof zExperiment>;
export type ExperimentList = z.infer<typeof zExperimentList>;
export type ExperimentFlowNodeType = z.infer<typeof zExperimentFlowNodeType>;
export type ExperimentFlowGraph = z.infer<typeof zExperimentFlowGraph>;
export type ExperimentLocation = z.infer<typeof zExperimentLocation>;
export type ExperimentLocationInput = z.infer<typeof zExperimentLocationInput>;
export type ExperimentLocationList = z.infer<typeof zExperimentLocationList>;
export type ExperimentPlaceSearchResult = z.infer<typeof zExperimentPlaceSearchResult>;
export type ExperimentPlaceSearchQuery = z.infer<typeof zExperimentPlaceSearchQuery>;
export type ExperimentPlaceSearchResponse = z.infer<typeof zExperimentPlaceSearchResponse>;
export type ExperimentGeocodeQuery = z.infer<typeof zExperimentGeocodeQuery>;
export type ExperimentGeocodeResponse = z.infer<typeof zExperimentGeocodeResponse>;

// Define request and response types
// Shared embargo date validation function
export const validateEmbargoDate = (
  embargoUntil: string | undefined,
  ctx: z.RefinementCtx,
  path: string[],
) => {
  if (embargoUntil) {
    const picked = new Date(embargoUntil);

    const now = new Date();
    // tomorrow at 00:00 local time
    const minDate = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1, 0, 0, 0, 0);
    // creation day + 365 days at 23:59:59.999
    const maxDate = new Date(
      now.getFullYear(),
      now.getMonth(),
      now.getDate() + 365,
      23,
      59,
      59,
      999,
    );

    if (picked.getTime() < minDate.getTime()) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path,
        message: "Embargo end date cannot be today or earlier (must be from tomorrow onwards)",
      });
    } else if (picked.getTime() > maxDate.getTime()) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path,
        message: "Embargo end date must be within 365 days from today",
      });
    }
  }
};

export const zCreateExperimentBodyBase = z.object({
  name: z
    .string()
    .trim()
    .min(1, "The name of the experiment is required")
    .max(255, "The name must be at most 255 characters")
    .describe("The name of the experiment"),
  description: z.string().optional().describe("Optional description of the experiment"),
  status: zExperimentStatus.optional().describe("Initial status of the experiment"),
  visibility: zExperimentVisibility.optional().describe("Experiment visibility setting"),
  embargoUntil: z
    .string()
    .datetime()
    .optional()
    .describe("Embargo end date and time (ISO datetime string, will be stored as UTC in database)"),
  members: z
    .array(
      z.object({
        userId: z.string().uuid(),
        role: zExperimentMemberRole.optional(),
        firstName: z.string().optional(),
        lastName: z.string().optional(),
        email: z.string().email().nullable().optional(),
        avatarUrl: z.string().nullable().optional(),
      }),
    )
    .optional()
    .describe("Optional array of member objects with userId and role"),
  locations: z
    .array(zExperimentLocationInput)
    .optional()
    .describe("Optional array of locations associated with the experiment"),
  workbookId: z
    .string()
    .uuid()
    .optional()
    .describe("Optional workbook ID to associate with the experiment"),
});

export const zCreateExperimentBody = zCreateExperimentBodyBase.superRefine((val, ctx) => {
  validateEmbargoDate(val.embargoUntil, ctx, ["embargoUntil"]);
});

export const zUpdateExperimentBody = z.object({
  name: z
    .string()
    .trim()
    .min(1, "The name of the experiment is required")
    .max(255, "The name must be at most 255 characters")
    .optional()
    .describe("Updated experiment name"),
  description: z.string().optional().describe("Updated experiment description"),
  status: zExperimentStatus.optional().describe("Updated experiment status"),
  visibility: zExperimentVisibility.optional().describe("Updated visibility setting"),
  embargoUntil: z
    .string()
    .datetime()
    .optional()
    .describe(
      "Updated embargo end date and time (ISO datetime string, will be stored as UTC in database)",
    ),
  anonymizeContributors: z
    .boolean()
    .optional()
    .describe(
      "When true, the API rewrites contributor name/avatar/id to deterministic pseudonyms before responding",
    ),
  locations: z
    .array(zExperimentLocationInput)
    .optional()
    .describe("Updated locations associated with the experiment"),
});

export const visibilitySchema = zUpdateExperimentBody
  .pick({
    visibility: true,
    embargoUntil: true,
  })
  .superRefine((val, ctx) => {
    validateEmbargoDate(val.embargoUntil, ctx, ["embargoUntil"]);
  });

export const zExperimentFilterQuery = z.object({
  filter: z.enum(["member"]).optional().describe("Filter experiments by relationship to the user"),
  status: zExperimentStatus.optional().describe("Filter experiments by their status"),
  search: z.string().optional().describe("Search term for experiment name"),
});

export const zExperimentIdPathParam = z.object({
  id: z.string().uuid().describe("ID of the experiment"),
});
export const zExperimentExportPathParam = z.object({
  id: z.string().uuid().describe("ID of the experiment"),
  exportId: z.string().uuid().describe("ID of the export"),
});

export const zCreateExperimentResponse = z.object({ id: z.string().uuid() });

// Infer request and response types
export type CreateExperimentBody = z.infer<typeof zCreateExperimentBody>;
export type UpdateExperimentBody = z.infer<typeof zUpdateExperimentBody>;
export type ExperimentFilterQuery = z.infer<typeof zExperimentFilterQuery>;
export type ExperimentFilter = ExperimentFilterQuery["filter"];
export type ExperimentAccess = z.infer<typeof zExperimentAccess>;
export type CreateExperimentResponse = z.infer<typeof zCreateExperimentResponse>;
export type ExperimentIdPathParam = z.infer<typeof zExperimentIdPathParam>;

// Visualization types

// Transfer request types

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

// Metadata types
export type ExperimentMetadata = z.infer<typeof zExperimentMetadata>;
export type CreateExperimentMetadataBody = z.infer<typeof zCreateExperimentMetadataBody>;
export type UpdateExperimentMetadataBody = z.infer<typeof zUpdateExperimentMetadataBody>;
export type ExperimentCustomMetadataPayload = z.infer<typeof zExperimentCustomMetadataPayload>;

export * from "./locations/experiment-locations.schema";
export * from "./exports/experiment-exports.schema";
export * from "./uploads/experiment-uploads.schema";
