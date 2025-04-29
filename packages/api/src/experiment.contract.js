"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.experimentContract = void 0;
var core_1 = require("@ts-rest/core");
var zod_1 = require("zod");
var c = (0, core_1.initContract)();
// Define Zod schemas based on your experiment model
var zExperimentStatus = zod_1.z.enum([
    "provisioning",
    "provisioning_failed",
    "active",
    "stale",
    "archived",
    "published",
]);
var zExperimentVisibility = zod_1.z.enum(["private", "public"]);
var zExperimentMemberRole = zod_1.z.enum(["admin", "member"]);
var zExperiment = zod_1.z.object({
    id: zod_1.z.string().uuid(),
    name: zod_1.z.string(),
    description: zod_1.z.string().nullable(),
    status: zExperimentStatus,
    visibility: zExperimentVisibility,
    embargoIntervalDays: zod_1.z.number().int(),
    createdBy: zod_1.z.string().uuid(),
    createdAt: zod_1.z.string().datetime(),
});
var zExperimentList = zod_1.z.array(zExperiment);
var zExperimentMember = zod_1.z.object({
    id: zod_1.z.string().uuid(),
    userId: zod_1.z.string().uuid(),
    role: zExperimentMemberRole,
    joinedAt: zod_1.z.string().datetime(),
});
var zExperimentMemberList = zod_1.z.array(zExperimentMember);
var zErrorResponse = zod_1.z.object({
    message: zod_1.z.string(),
});
// Define the experiment contract with enhanced documentation
exports.experimentContract = c.router({
    createExperiment: {
        method: "POST",
        path: "/api/v1/experiments",
        query: zod_1.z.object({
            userId: zod_1.z.string().uuid().describe("User ID for authentication"),
        }),
        body: zod_1.z.object({
            name: zod_1.z.string().min(1).max(100).describe("The name of the experiment"),
            description: zod_1.z
                .string()
                .optional()
                .describe("Optional description of the experiment"),
            status: zExperimentStatus
                .optional()
                .describe("Initial status of the experiment"),
            visibility: zExperimentVisibility
                .optional()
                .describe("Experiment visibility setting"),
            embargoIntervalDays: zod_1.z
                .number()
                .int()
                .optional()
                .describe("Embargo period in days"),
        }),
        responses: {
            201: zod_1.z.object({ id: zod_1.z.string().uuid() }),
            400: zErrorResponse,
        },
        summary: "Create a new experiment",
        description: "Creates a new experiment with the provided configuration",
    },
    listExperiments: {
        method: "GET",
        path: "/api/v1/experiments",
        query: zod_1.z.object({
            userId: zod_1.z.string().uuid().describe("User ID for authentication"),
            filter: zod_1.z
                .enum(["my", "member", "related"])
                .optional()
                .describe("Filter experiments by relationship to the user"),
        }),
        responses: {
            200: zExperimentList,
            400: zErrorResponse,
        },
        summary: "List experiments",
        description: "Returns a list of experiments based on the specified filter criteria",
    },
    getExperiment: {
        method: "GET",
        path: "/api/v1/experiments/:id",
        pathParams: zod_1.z.object({
            id: zod_1.z.string().uuid().describe("Experiment ID"),
        }),
        query: zod_1.z.object({
            userId: zod_1.z.string().uuid().describe("User ID for authentication"),
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
        pathParams: zod_1.z.object({
            id: zod_1.z.string().uuid().describe("Experiment ID"),
        }),
        query: zod_1.z.object({
            userId: zod_1.z.string().uuid().describe("User ID for authentication"),
        }),
        body: zod_1.z.object({
            name: zod_1.z
                .string()
                .min(1)
                .max(100)
                .optional()
                .describe("Updated experiment name"),
            description: zod_1.z
                .string()
                .optional()
                .describe("Updated experiment description"),
            status: zExperimentStatus
                .optional()
                .describe("Updated experiment status"),
            visibility: zExperimentVisibility
                .optional()
                .describe("Updated visibility setting"),
            embargoIntervalDays: zod_1.z
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
        pathParams: zod_1.z.object({
            id: zod_1.z.string().uuid().describe("Experiment ID"),
        }),
        query: zod_1.z.object({
            userId: zod_1.z.string().uuid().describe("User ID for authentication"),
        }),
        responses: {
            204: zod_1.z.null(),
            404: zErrorResponse,
        },
        summary: "Delete experiment",
        description: "Deletes an experiment and all associated data",
    },
    listExperimentMembers: {
        method: "GET",
        path: "/api/v1/experiments/:id/members",
        pathParams: zod_1.z.object({
            id: zod_1.z.string().uuid().describe("Experiment ID"),
        }),
        query: zod_1.z.object({
            userId: zod_1.z.string().uuid().describe("User ID for authentication"),
        }),
        responses: {
            200: zExperimentMemberList,
            404: zErrorResponse,
            403: zErrorResponse,
        },
        summary: "List experiment members",
        description: "Returns a list of all users who are members of the specified experiment",
    },
    addExperimentMember: {
        method: "POST",
        path: "/api/v1/experiments/:id/members",
        pathParams: zod_1.z.object({
            id: zod_1.z.string().uuid().describe("Experiment ID"),
        }),
        query: zod_1.z.object({
            userId: zod_1.z.string().uuid().describe("User ID for authentication"),
        }),
        body: zod_1.z.object({
            userId: zod_1.z.string().uuid().describe("ID of the user to add as a member"),
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
        pathParams: zod_1.z.object({
            id: zod_1.z.string().uuid().describe("Experiment ID"),
            memberId: zod_1.z.string().uuid().describe("ID of the member to remove"),
        }),
        query: zod_1.z.object({
            userId: zod_1.z.string().uuid().describe("User ID for authentication"),
        }),
        responses: {
            204: zod_1.z.null(),
            404: zErrorResponse,
            403: zErrorResponse,
        },
        summary: "Remove experiment member",
        description: "Removes a member from the experiment",
    },
});
