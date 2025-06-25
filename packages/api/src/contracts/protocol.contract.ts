import { initContract } from "@ts-rest/core";

import {
  zProtocol,
  zProtocolList,
  zProtocolErrorResponse,
  zProtocolFilterQuery,
  zProtocolIdPathParam,
  zCreateProtocolRequest,
  zUpdateProtocolRequest,
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
    body: zCreateProtocolRequest,
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
    body: zUpdateProtocolRequest,
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
