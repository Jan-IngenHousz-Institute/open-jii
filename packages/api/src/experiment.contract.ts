import { initContract } from "@ts-rest/core";
import { z } from "@repo/validator";

const c = initContract();

// Define Zod schemas based on your experiment model
const zExperimentStatus = z.enum([
  "provisioning",
  "provisioning_failed",
  "active",
  "stale",
  "archived",
  "published",
]);

const zExperimentVisibility = z.enum(["private", "public"]);

const zExperimentMemberRole = z.enum(["admin", "member"]);

const zExperiment = z.object({
  id: z.string().uuid(),
  name: z.string(),
  description: z.string().nullable(),
  status: zExperimentStatus,
  visibility: zExperimentVisibility,
  embargoIntervalDays: z.number().int(),
  createdBy: z.string().uuid(),
  createdAt: z.string().datetime(),
});

const zExperimentList = z.array(zExperiment);

const zExperimentMember = z.object({
  id: z.string().uuid(),
  userId: z.string().uuid(),
  role: zExperimentMemberRole,
  joinedAt: z.string().datetime(),
});

const zExperimentMemberList = z.array(zExperimentMember);

const zErrorResponse = z.object({
  message: z.string(),
});

// Define the experiment contract with enhanced documentation
export const experimentContract = c.router({
  createExperiment: {
    method: "POST",
    path: "/api/v1/experiments",
    query: z.object({
      userId: z.string().uuid().describe("User ID for authentication"),
    }),
    body: z.object({
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
    }),
    responses: {
      201: z.object({ id: z.string().uuid() }),
      400: zErrorResponse,
    },
    summary: "Create a new experiment",
    description: "Creates a new experiment with the provided configuration",
  },

  listExperiments: {
    method: "GET",
    path: "/api/v1/experiments",
    query: z.object({
      userId: z.string().uuid().describe("User ID for authentication"),
      filter: z
        .enum(["my", "member", "related"])
        .optional()
        .describe("Filter experiments by relationship to the user"),
    }),
    responses: {
      200: zExperimentList,
      400: zErrorResponse,
    },
    summary: "List experiments",
    description:
      "Returns a list of experiments based on the specified filter criteria",
  },

  getExperiment: {
    method: "GET",
    path: "/api/v1/experiments/:id",
    pathParams: z.object({
      id: z.string().uuid().describe("Experiment ID"),
    }),
    query: z.object({
      userId: z.string().uuid().describe("User ID for authentication"),
    }),
    responses: {
      200: zExperiment,
      404: zErrorResponse,
    },
    summary: "Get experiment details",
    description: "Returns detailed information about a specific experiment",
  },

  updateExperiment: {
    method: "PATCH",
    path: "/api/v1/experiments/:id",
    pathParams: z.object({
      id: z.string().uuid().describe("Experiment ID"),
    }),
    query: z.object({
      userId: z.string().uuid().describe("User ID for authentication"),
    }),
    body: z.object({
      name: z
        .string()
        .min(1)
        .max(100)
        .optional()
        .describe("Updated experiment name"),
      description: z
        .string()
        .optional()
        .describe("Updated experiment description"),
      status: zExperimentStatus
        .optional()
        .describe("Updated experiment status"),
      visibility: zExperimentVisibility
        .optional()
        .describe("Updated visibility setting"),
      embargoIntervalDays: z
        .number()
        .int()
        .optional()
        .describe("Updated embargo period in days"),
    }),
    responses: {
      200: zExperiment,
      404: zErrorResponse,
    },
    summary: "Update experiment",
    description: "Updates an existing experiment with the provided changes",
  },

  deleteExperiment: {
    method: "DELETE",
    path: "/api/v1/experiments/:id",
    pathParams: z.object({
      id: z.string().uuid().describe("Experiment ID"),
    }),
    query: z.object({
      userId: z.string().uuid().describe("User ID for authentication"),
    }),
    responses: {
      204: z.null(),
      404: zErrorResponse,
    },
    summary: "Delete experiment",
    description: "Deletes an experiment and all associated data",
  },

  listExperimentMembers: {
    method: "GET",
    path: "/api/v1/experiments/:id/members",
    pathParams: z.object({
      id: z.string().uuid().describe("Experiment ID"),
    }),
    query: z.object({
      userId: z.string().uuid().describe("User ID for authentication"),
    }),
    responses: {
      200: zExperimentMemberList,
      404: zErrorResponse,
      403: zErrorResponse,
    },
    summary: "List experiment members",
    description:
      "Returns a list of all users who are members of the specified experiment",
  },

  addExperimentMember: {
    method: "POST",
    path: "/api/v1/experiments/:id/members",
    pathParams: z.object({
      id: z.string().uuid().describe("Experiment ID"),
    }),
    query: z.object({
      userId: z.string().uuid().describe("User ID for authentication"),
    }),
    body: z.object({
      userId: z.string().uuid().describe("ID of the user to add as a member"),
      role: zExperimentMemberRole
        .optional()
        .default("member")
        .describe("Role to assign to the new member"),
    }),
    responses: {
      201: zExperimentMember,
      404: zErrorResponse,
      403: zErrorResponse,
    },
    summary: "Add experiment member",
    description: "Adds a new member to the experiment with the specified role",
  },

  removeExperimentMember: {
    method: "DELETE",
    path: "/api/v1/experiments/:id/members/:memberId",
    pathParams: z.object({
      id: z.string().uuid().describe("Experiment ID"),
      memberId: z.string().uuid().describe("ID of the member to remove"),
    }),
    query: z.object({
      userId: z.string().uuid().describe("User ID for authentication"),
    }),
    responses: {
      204: z.null(),
      404: zErrorResponse,
      403: zErrorResponse,
    },
    summary: "Remove experiment member",
    description: "Removes a member from the experiment",
  },
});
