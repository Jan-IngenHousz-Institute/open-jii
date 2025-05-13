import { initContract } from "@ts-rest/core";

import {
  zExperiment,
  zExperimentList,
  zExperimentMember,
  zExperimentMemberList,
  zErrorResponse,
  zCreateExperimentBody,
  zUpdateExperimentBody,
  zAddExperimentMemberBody,
  zExperimentFilterQuery,
  zCreateExperimentResponse,
  zIdPathParam,
  zExperimentMemberPathParam,
} from "../schemas/experiment.schema";

const c = initContract();

export const experimentContract = c.router({
  createExperiment: {
    method: "POST",
    path: "/api/v1/experiments",
    body: zCreateExperimentBody,
    responses: {
      201: zCreateExperimentResponse,
      400: zErrorResponse,
    },
    summary: "Create a new experiment",
    description: "Creates a new experiment with the provided configuration",
  },

  listExperiments: {
    method: "GET",
    path: "/api/v1/experiments",
    query: zExperimentFilterQuery,
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
    pathParams: zIdPathParam,
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
    pathParams: zIdPathParam,
    body: zUpdateExperimentBody,
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
    pathParams: zIdPathParam,
    responses: {
      204: null,
      404: zErrorResponse,
    },
    summary: "Delete experiment",
    description: "Deletes an experiment and all associated data",
  },

  listExperimentMembers: {
    method: "GET",
    path: "/api/v1/experiments/:id/members",
    pathParams: zIdPathParam,
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
    pathParams: zIdPathParam,
    body: zAddExperimentMemberBody,
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
    pathParams: zExperimentMemberPathParam,
    responses: {
      204: null,
      404: zErrorResponse,
      403: zErrorResponse,
    },
    summary: "Remove experiment member",
    description: "Removes a member from the experiment",
  },
});
