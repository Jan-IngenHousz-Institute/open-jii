import { z } from "zod";

// --- Protocol Association Schemas ---
export const zExperimentProtocolDetails = z.object({
  id: z.string().uuid(),
  name: z.string(),
  family: z.enum(["multispeq", "ambit"]),
  createdBy: z.string().uuid(),
});

export const zExperimentProtocol = z.object({
  experimentId: z.string().uuid(),
  order: z.number().int(),
  addedAt: z.string().datetime(),
  protocol: zExperimentProtocolDetails,
});

export const zExperimentProtocolList = z.array(zExperimentProtocol);

export const zExperimentProtocolPathParam = z.object({
  id: z.string().uuid().describe("ID of the experiment"),
  protocolId: z.string().uuid().describe("ID of the protocol association"),
});

export const zAddExperimentProtocolsBody = z.object({
  protocols: z.array(
    z.object({
      protocolId: z.string().uuid(),
      order: z.number().int().optional(),
    }),
  ),
});

// Define Zod schemas for experiment models
export const zExperimentStatus = z.enum([
  "provisioning",
  "provisioning_failed",
  "active",
  "stale",
  "archived",
  "published",
]);

export const zExperimentVisibility = z.enum(["private", "public"]);

export const zExperimentMemberRole = z.enum(["admin", "member"]);

// Data column schema
export const zDataColumn = z.object({
  name: z.string(),
  type_name: z.string(),
  type_text: z.string(),
});

// Experiment data schema
export const zExperimentData = z.object({
  columns: z.array(zDataColumn),
  rows: z.array(z.record(z.string(), z.string().nullable())),
  totalRows: z.number().int(),
  truncated: z.boolean(),
});

export const zExperiment = z.object({
  id: z.string().uuid(),
  name: z.string(),
  description: z.string().nullable(),
  status: zExperimentStatus,
  visibility: zExperimentVisibility,
  embargoIntervalDays: z.number().int(),
  flowId: z.string().uuid().nullable(),
  createdBy: z.string().uuid(),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
  data: zExperimentData.optional(),
});

export const zExperimentList = z.array(zExperiment);

export const zExperimentMember = z.object({
  user: z.object({
    id: z.string().uuid(),
    name: z.string().nullable(),
    email: z.string().email().nullable(),
  }),
  role: zExperimentMemberRole,
  joinedAt: z.string().datetime(),
});

export const zExperimentMemberList = z.array(zExperimentMember);

export const zErrorResponse = z.object({
  message: z.string(),
});

// Infer types from Zod schemas
export type ExperimentStatus = z.infer<typeof zExperimentStatus>;
export type ExperimentVisibility = z.infer<typeof zExperimentVisibility>;
export type ExperimentMemberRole = z.infer<typeof zExperimentMemberRole>;
export type DataColumn = z.infer<typeof zDataColumn>;
export type ExperimentData = z.infer<typeof zExperimentData>;
export type Experiment = z.infer<typeof zExperiment>;
export type ExperimentList = z.infer<typeof zExperimentList>;
export type ExperimentMember = z.infer<typeof zExperimentMember>;
export type ExperimentProtocol = z.infer<typeof zExperimentProtocol>;
export type ExperimentMemberList = z.infer<typeof zExperimentMemberList>;
export type ErrorResponse = z.infer<typeof zErrorResponse>;

// Define request and response types
export const zCreateExperimentBody = z.object({
  name: z.string().min(1).max(255).describe("The name of the experiment"),
  description: z.string().optional().describe("Optional description of the experiment"),
  status: zExperimentStatus.optional().describe("Initial status of the experiment"),
  visibility: zExperimentVisibility.optional().describe("Experiment visibility setting"),
  embargoIntervalDays: z.number().int().positive().optional().describe("Embargo period in days"),
  flowId: z.string().uuid().optional().describe("Optional flow to associate with the experiment"),
  members: z
    .array(
      z.object({
        userId: z.string().uuid(),
        role: zExperimentMemberRole.optional(),
      }),
    )
    .optional()
    .describe("Optional array of member objects with userId and role"),
  protocols: z
    .array(
      z.object({
        protocolId: z.string().uuid(),
        order: z.number().int().optional(),
      }),
    )
    .optional()
    .describe(
      "Optional array of protocol objects with protocolId and order to associate with the experiment",
    ),
});

export const zUpdateExperimentBody = z.object({
  name: z.string().min(1).max(255).optional().describe("Updated experiment name"),
  description: z.string().optional().describe("Updated experiment description"),
  status: zExperimentStatus.optional().describe("Updated experiment status"),
  visibility: zExperimentVisibility.optional().describe("Updated visibility setting"),
  embargoIntervalDays: z.number().int().optional().describe("Updated embargo period in days"),
  flowId: z.string().uuid().optional().describe("Updated flow association"),
});

export const zAddExperimentMembersBody = z.object({
  members: z.array(
    z.object({
      userId: z.string().uuid().describe("ID of the user to add as a member"),
      role: zExperimentMemberRole
        .optional()
        .default("member")
        .describe("Role to assign to the new member"),
    }),
  ),
});

export const zExperimentFilterQuery = z.object({
  filter: z
    .enum(["my", "member", "related"])
    .optional()
    .describe("Filter experiments by relationship to the user"),
  status: zExperimentStatus.optional().describe("Filter experiments by their status"),
});

export const zExperimentDataQuery = z.object({
  page: z.coerce.number().int().min(1).optional().default(1).describe("Page number for pagination"),
  pageSize: z.coerce
    .number()
    .int()
    .min(1)
    .max(100)
    .optional()
    .default(5)
    .describe("Number of rows per page"),
  tableName: z
    .string()
    .optional()
    .describe("Optional table name to filter results to a specific table"),
});

export const zExperimentDataTableInfo = z.object({
  name: z.string().describe("Name of the table"),
  catalog_name: z.string().describe("Catalog name"),
  schema_name: z.string().describe("Schema name"),
  data: zExperimentData.optional(),
  page: z.number().int(),
  pageSize: z.number().int(),
  totalPages: z.number().int(),
  totalRows: z.number().int(),
});

export const zIdPathParam = z.object({
  id: z.string().uuid().describe("ID of the experiment"),
});
export const zExperimentMemberPathParam = z.object({
  id: z.string().uuid().describe("ID of the experiment"),
  memberId: z.string().uuid().describe("ID of the member"),
});

export const zExperimentDataTableList = z.array(zExperimentDataTableInfo);

export const zExperimentDataResponse = zExperimentDataTableList;

export const zCreateExperimentResponse = z.object({ id: z.string().uuid() });

// Webhook Schemas
export const zExperimentWebhookAuthHeader = z.object({
  "x-api-key-id": z.string(),
  "x-databricks-signature": z.string(),
  "x-databricks-timestamp": z.string(),
});

export const zExperimentProvisioningStatusWebhookPayload = z.object({
  status: z.enum([
    // Terminal statuses
    "SUCCESS",
    "FAILURE",
    "CANCELED",
    "TIMEOUT",
    "FAILED",
    // Non-terminal statuses
    "RUNNING",
    "PENDING",
    "SKIPPED",
    "DEPLOYING",
    "DEPLOYED",
    "COMPLETED",
    "QUEUED",
    "TERMINATED",
    "WAITING",
    "INITIALIZING",
    "IDLE",
    "SETTING_UP",
    "RESETTING",
  ]),
  jobRunId: z.string(),
  taskRunId: z.string(),
  timestamp: z.string(),
});

export const zExperimentWebhookSuccessResponse = z.object({
  success: z.boolean(),
  message: z.string(),
});

export const zExperimentWebhookErrorResponse = z.object({
  error: z.string(),
  message: z.string(),
  statusCode: z.number(),
});

// Infer request and response types
export type CreateExperimentBody = z.infer<typeof zCreateExperimentBody>;
export type UpdateExperimentBody = z.infer<typeof zUpdateExperimentBody>;
export type AddExperimentMembersBody = z.infer<typeof zAddExperimentMembersBody>;
export type ExperimentFilterQuery = z.infer<typeof zExperimentFilterQuery>;
export type ExperimentFilter = ExperimentFilterQuery["filter"];
export type CreateExperimentResponse = z.infer<typeof zCreateExperimentResponse>;
export type ExperimentDataQuery = z.infer<typeof zExperimentDataQuery>;
export type ExperimentDataResponse = z.infer<typeof zExperimentDataResponse>;
export type IdPathParam = z.infer<typeof zIdPathParam>;
export type ExperimentMemberPathParam = z.infer<typeof zExperimentMemberPathParam>;

// Webhook types
export type ExperimentProvisioningStatusWebhookPayload = z.infer<
  typeof zExperimentProvisioningStatusWebhookPayload
>;
export type ExperimentProvisioningStatus = ExperimentProvisioningStatusWebhookPayload["status"];
export type ExperimentWebhookSuccessResponse = z.infer<typeof zExperimentWebhookSuccessResponse>;
export type ExperimentWebhookErrorResponse = z.infer<typeof zExperimentWebhookErrorResponse>;
