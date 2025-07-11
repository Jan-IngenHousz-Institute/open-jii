import { initContract } from "@ts-rest/core";

import {
  zExperimentProtocolList,
  zAddExperimentProtocolsBody,
  zExperimentProtocolPathParam,
} from "../schemas/experiment.schema";
import { zIdPathParam, zErrorResponse } from "../schemas/experiment.schema";
import {
  zProtocol,
  zProtocolList,
  zProtocolErrorResponse,
  zProtocolFilterQuery,
  zProtocolIdPathParam,
  zCreateProtocolRequestBody,
  zUpdateProtocolRequestBody,
} from "../schemas/protocol.schema";

const c = initContract();

export const protocolContract = c.router({
  listProtocols: {
    method: "GET",
    path: "/api/v1/protocols",
    query: zProtocolFilterQuery,
    responses: {
      200: zProtocolList,
      400: zProtocolErrorResponse,
    },
    summary: "List protocols",
    description: "Returns a list of protocols based on the specified filter criteria",
  },

  // Experiment Protocol Association Endpoints
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

  getProtocol: {
    method: "GET",
    path: "/api/v1/protocols/:id",
    pathParams: zProtocolIdPathParam,
    responses: {
      200: zProtocol,
      404: zProtocolErrorResponse,
    },
    summary: "Get protocol by ID",
    description: "Returns a protocol by its ID",
  },

  createProtocol: {
    method: "POST",
    path: "/api/v1/protocols",
    body: zCreateProtocolRequestBody,
    responses: {
      201: zProtocol,
      400: zProtocolErrorResponse,
    },
    summary: "Create a new protocol",
    description: "Creates a new protocol with the given properties",
  },

  updateProtocol: {
    method: "PATCH",
    path: "/api/v1/protocols/:id",
    pathParams: zProtocolIdPathParam,
    body: zUpdateProtocolRequestBody,
    responses: {
      200: zProtocol,
      400: zProtocolErrorResponse,
      404: zProtocolErrorResponse,
    },
    summary: "Update a protocol",
    description: "Updates a protocol with the given properties",
  },

  deleteProtocol: {
    method: "DELETE",
    path: "/api/v1/protocols/:id",
    pathParams: zProtocolIdPathParam,
    responses: {
      204: null,
      404: zProtocolErrorResponse,
    },
    summary: "Delete a protocol",
    description: "Deletes a protocol by its ID",
  },
});
