import { initContract } from "@ts-rest/core";

import {
  zExperiment,
  zExperimentList,
  zExperimentMemberList,
  zErrorResponse,
  zCreateExperimentBody,
  zAddExperimentMembersBody,
  zUpdateExperimentBody,
  zExperimentFilterQuery,
  zCreateExperimentResponse,
  zIdPathParam,
  zExperimentMemberPathParam,
  zExperimentDataQuery,
  zExperimentDataResponse,
  zExperimentProvisioningStatusWebhookPayload,
  zExperimentWebhookAuthHeader,
  zExperimentWebhookSuccessResponse,
  zExperimentWebhookErrorResponse,
} from "../schemas/experiment.schema";
import {
  zExperimentProtocolList,
  zAddExperimentProtocolsBody,
  zExperimentProtocolPathParam,
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
    description: "Returns a list of experiments based on the specified filter criteria",
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
    description: "Returns a list of all users who are members of the specified experiment",
  },

  addExperimentMembers: {
    method: "POST",
    path: "/api/v1/experiments/:id/members/batch",
    pathParams: zIdPathParam,
    body: zAddExperimentMembersBody,
    responses: {
      201: zExperimentMemberList,
      404: zErrorResponse,
      403: zErrorResponse,
    },
    summary: "Add multiple experiment members",
    description: "Adds multiple members to the experiment with specified roles",
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

  getExperimentData: {
    method: "GET",
    path: "/api/v1/experiments/:id/data",
    pathParams: zIdPathParam,
    query: zExperimentDataQuery,
    responses: {
      200: zExperimentDataResponse,
      404: zErrorResponse,
      403: zErrorResponse,
      400: zErrorResponse,
    },
    summary: "Get experiment data",
    description: "Retrieves data tables from the experiment with pagination support",
  },

  updateProvisioningStatus: {
    method: "POST",
    path: "/api/v1/experiments/:id/provisioning-status",
    pathParams: zIdPathParam,
    body: zExperimentProvisioningStatusWebhookPayload,
    headers: zExperimentWebhookAuthHeader,
    responses: {
      200: zExperimentWebhookSuccessResponse,
      400: zExperimentWebhookErrorResponse,
      401: zExperimentWebhookErrorResponse,
    },
    summary: "Handle experiment provisioning status updates",
    description:
      "Receives status updates from Databricks workflows and updates the corresponding experiment status",
  },

  listExperimentProtocols: {
    method: "GET",
    path: "/api/v1/experiments/:id/protocols",
    pathParams: zIdPathParam,
    responses: {
      200: zExperimentProtocolList,
      400: zErrorResponse,
      401: zErrorResponse,
      403: zErrorResponse,
      404: zErrorResponse,
    },
    summary: "List protocols associated with an experiment",
    description: "Returns a list of protocol associations for the specified experiment.",
  },

  addExperimentProtocols: {
    method: "POST",
    path: "/api/v1/experiments/:id/protocols",
    pathParams: zIdPathParam,
    body: zAddExperimentProtocolsBody,
    responses: {
      201: zExperimentProtocolList,
      400: zErrorResponse,
      401: zErrorResponse,
      403: zErrorResponse,
      404: zErrorResponse,
    },
    summary: "Add protocols to an experiment",
    description: "Associates one or more protocols with an experiment.",
  },

  removeExperimentProtocol: {
    method: "DELETE",
    path: "/api/v1/experiments/:id/protocols/:protocolId",
    pathParams: zExperimentProtocolPathParam,
    responses: {
      204: null,
      400: zErrorResponse,
      401: zErrorResponse,
      403: zErrorResponse,
      404: zErrorResponse,
    },
    summary: "Remove a protocol from an experiment",
    description: "Removes the association between a protocol and an experiment.",
  },
});
