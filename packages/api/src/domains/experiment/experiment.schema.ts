import { z } from "zod";

import { sanitizeQuestionLabel } from "../../transforms/label-sanitization";
import { zExperimentData } from "./data/experiment-data.schema";
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

// Inline command formats a command cell can carry. Defined here (rather than in
// workbook-cells.schema) so workbook-cells can import it without an import cycle,
// since workbook-cells already depends on this module.
export const zCommandFormat = z.enum(["string", "json", "yaml"]);
export type CommandFormat = z.infer<typeof zCommandFormat>;

// A measurement node may instead carry an inline device command (raw string,
// JSON, or YAML) from a command cell. Old apps' cells->flow drops this node
// (unknown content shape), degrading gracefully; protocol nodes are unaffected.
export const zExperimentMeasurementCommandContent = z.object({
  command: z.object({
    format: zCommandFormat,
    content: z.string().min(1, "Command content is required"),
  }),
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
    zExperimentMeasurementCommandContent,
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

    // Reject duplicate question-node labels (canonicalized) and any whose
    // canonical form collides with a reserved experiment-data column name: both
    // shadow/collide as column keys in `questions_data` and lose answers.
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

export const zCreateExperimentResponse = z.object({ id: z.string().uuid() });

// Infer request and response types
export type CreateExperimentBody = z.infer<typeof zCreateExperimentBody>;
export type UpdateExperimentBody = z.infer<typeof zUpdateExperimentBody>;
export type ExperimentFilterQuery = z.infer<typeof zExperimentFilterQuery>;
export type ExperimentFilter = ExperimentFilterQuery["filter"];
export type ExperimentAccess = z.infer<typeof zExperimentAccess>;
export type CreateExperimentResponse = z.infer<typeof zCreateExperimentResponse>;
export type ExperimentIdPathParam = z.infer<typeof zExperimentIdPathParam>;

export * from "./locations/experiment-locations.schema";
export * from "./exports/experiment-exports.schema";
export * from "./uploads/experiment-uploads.schema";
