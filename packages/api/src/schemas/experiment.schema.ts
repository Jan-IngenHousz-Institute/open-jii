import { z } from "zod";

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

export const zExperiment = z.object({
  id: z.string().uuid(),
  name: z.string(),
  description: z.string().nullable(),
  status: zExperimentStatus,
  visibility: zExperimentVisibility,
  embargoIntervalDays: z.number().int(),
  createdBy: z.string().uuid(),
  createdAt: z.string().datetime(),
});

export const zExperimentList = z.array(zExperiment);

export const zExperimentMember = z.object({
  id: z.string().uuid(),
  userId: z.string().uuid(),
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
export type Experiment = z.infer<typeof zExperiment>;
export type ExperimentList = z.infer<typeof zExperimentList>;
export type ExperimentMember = z.infer<typeof zExperimentMember>;
export type ExperimentMemberList = z.infer<typeof zExperimentMemberList>;
export type ErrorResponse = z.infer<typeof zErrorResponse>;

// Define request and response types
export const zCreateExperimentBody = z.object({
  name: z.string().min(1).max(100).describe("The name of the experiment"),
  description: z
    .string()
    .optional()
    .describe("Optional description of the experiment"),
  status: zExperimentStatus
    .optional()
    .describe("Initial status of the experiment"),
  visibility: zExperimentVisibility
    .optional()
    .describe("Experiment visibility setting"),
  embargoIntervalDays: z
    .number()
    .int()
    .optional()
    .describe("Embargo period in days"),
});

export const zUpdateExperimentBody = z.object({
  name: z
    .string()
    .min(1)
    .max(100)
    .optional()
    .describe("Updated experiment name"),
  description: z.string().optional().describe("Updated experiment description"),
  status: zExperimentStatus.optional().describe("Updated experiment status"),
  visibility: zExperimentVisibility
    .optional()
    .describe("Updated visibility setting"),
  embargoIntervalDays: z
    .number()
    .int()
    .optional()
    .describe("Updated embargo period in days"),
});

export const zAddExperimentMemberBody = z.object({
  userId: z.string().uuid().describe("ID of the user to add as a member"),
  role: zExperimentMemberRole
    .optional()
    .default("member")
    .describe("Role to assign to the new member"),
});

export const zExperimentFilterQuery = z.object({
  filter: z
    .enum(["my", "member", "related"])
    .optional()
    .describe("Filter experiments by relationship to the user"),
});

export const zCreateExperimentResponse = z.object({ id: z.string().uuid() });

// Infer request and response types
export type CreateExperimentBody = z.infer<typeof zCreateExperimentBody>;
export type UpdateExperimentBody = z.infer<typeof zUpdateExperimentBody>;
export type AddExperimentMemberBody = z.infer<typeof zAddExperimentMemberBody>;
export type ExperimentFilterQuery = z.infer<typeof zExperimentFilterQuery>;
export type ExperimentFilter = ExperimentFilterQuery["filter"];
export type CreateExperimentResponse = z.infer<
  typeof zCreateExperimentResponse
>;

export const zIdPathParam = z.object({
  id: z.string().uuid().describe("ID of the experiment"),
});
export const zExperimentMemberPathParam = z.object({
  id: z.string().uuid().describe("ID of the experiment"),
  memberId: z.string().uuid().describe("ID of the member"),
});

export type IdPathParam = z.infer<typeof zIdPathParam>;
export type ExperimentMemberPathParam = z.infer<
  typeof zExperimentMemberPathParam
>;
