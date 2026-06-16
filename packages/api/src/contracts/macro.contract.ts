import { initContract } from "@ts-rest/core";
import { z } from "zod";

import {
  zMacro,
  zMacroList,
  zMacroErrorResponse,
  zMacroFilterQuery,
  zMacroIdPathParam,
  zCreateMacroRequestBody,
  zUpdateMacroRequestBody,
  zMacroProtocolList,
  zAddCompatibleProtocolsBody,
  zMacroProtocolPathParams,
  zMacroExecutionRequestBody,
  zMacroExecutionResponse,
  zMacroVersionQuery,
  zMacroVersionList,
  zMacroVersionPathParam,
  zMacroUsage,
  zDuplicateMacroRequestBody,
  zMacroBatchExecutionRequestBody,
  zMacroBatchExecutionResponse,
  zMacroBatchWebhookErrorResponse,
} from "../schemas/macro.schema";
import { zWebhookAuthHeader } from "../schemas/user.schema";

const c = initContract();

export const macroContract = c.router({
  listMacros: {
    method: "GET",
    path: "/api/v1/macros",
    query: zMacroFilterQuery,
    responses: {
      200: zMacroList,
      400: zMacroErrorResponse,
    },
    summary: "List macros",
    description: "Returns a list of macros based on the specified filter criteria",
  },

  getMacro: {
    method: "GET",
    path: "/api/v1/macros/:id",
    pathParams: zMacroIdPathParam,
    query: zMacroVersionQuery,
    responses: {
      200: zMacro,
      404: zMacroErrorResponse,
    },
    summary: "Get macro by ID",
    description: "Returns a macro by its ID, optionally at a pinned ?version",
  },

  createMacro: {
    method: "POST",
    path: "/api/v1/macros",
    body: zCreateMacroRequestBody,
    responses: {
      201: zMacro,
      400: zMacroErrorResponse,
      409: zMacroErrorResponse,
    },
    summary: "Create a new macro",
    description:
      "Creates a new macro with the given properties and processes the code file through Databricks",
  },

  updateMacro: {
    method: "PUT",
    path: "/api/v1/macros/:id",
    pathParams: zMacroIdPathParam,
    body: zUpdateMacroRequestBody,
    responses: {
      200: zMacro,
      400: zMacroErrorResponse,
      404: zMacroErrorResponse,
    },
    summary: "Update an existing macro",
    description:
      "Updates an existing macro and optionally processes a new code file through Databricks",
  },

  deleteMacro: {
    method: "DELETE",
    path: "/api/v1/macros/:id",
    pathParams: zMacroIdPathParam,
    responses: {
      204: z.undefined(),
      404: zMacroErrorResponse,
    },
    summary: "Delete a macro",
    description: "Deletes a macro by its ID",
  },

  listCompatibleProtocols: {
    method: "GET",
    path: "/api/v1/macros/:id/protocols",
    pathParams: zMacroIdPathParam,
    responses: {
      200: zMacroProtocolList,
      404: zMacroErrorResponse,
    },
    summary: "List compatible protocols for a macro",
    description: "Returns protocols that are marked as compatible with this macro",
  },

  addCompatibleProtocols: {
    method: "POST",
    path: "/api/v1/macros/:id/protocols",
    pathParams: zMacroIdPathParam,
    body: zAddCompatibleProtocolsBody,
    responses: {
      201: zMacroProtocolList,
      403: zMacroErrorResponse,
      404: zMacroErrorResponse,
      500: zMacroErrorResponse,
    },
    summary: "Add compatible protocols to a macro",
    description: "Links protocols as compatible with this macro (creator only)",
  },

  removeCompatibleProtocol: {
    method: "DELETE",
    path: "/api/v1/macros/:id/protocols/:protocolId",
    pathParams: zMacroProtocolPathParams,
    body: null,
    responses: {
      204: null,
      403: zMacroErrorResponse,
      404: zMacroErrorResponse,
    },
    summary: "Remove a compatible protocol from a macro",
    description: "Unlinks a protocol from this macro's compatibility list (creator only)",
  },

  listMacroVersions: {
    method: "GET",
    path: "/api/v1/macros/:id/versions",
    pathParams: zMacroIdPathParam,
    responses: {
      200: zMacroVersionList,
      404: zMacroErrorResponse,
    },
    summary: "List macro versions",
    description: "Returns the version history of a macro, newest first",
  },

  restoreMacroVersion: {
    method: "POST",
    path: "/api/v1/macros/:id/versions/:version/restore",
    pathParams: zMacroVersionPathParam,
    body: null,
    responses: {
      200: zMacro,
      403: zMacroErrorResponse,
      404: zMacroErrorResponse,
    },
    summary: "Restore a macro version",
    description: "Mints a new version from a historical version's code (creator only)",
  },

  duplicateMacro: {
    method: "POST",
    path: "/api/v1/macros/:id/duplicate",
    pathParams: zMacroIdPathParam,
    body: zDuplicateMacroRequestBody,
    responses: {
      201: zMacro,
      404: zMacroErrorResponse,
      409: zMacroErrorResponse,
    },
    summary: "Duplicate a macro",
    description: "Creates a new macro copying the latest code of the source (fork)",
  },

  getMacroUsage: {
    method: "GET",
    path: "/api/v1/macros/:id/usage",
    pathParams: zMacroIdPathParam,
    responses: {
      200: zMacroUsage,
      404: zMacroErrorResponse,
    },
    summary: "Macro usage",
    description: "Returns the workbooks that reference this macro",
  },

  executeMacro: {
    method: "POST",
    path: "/api/v1/macros/:id/execute",
    pathParams: zMacroIdPathParam,
    body: zMacroExecutionRequestBody,
    responses: {
      200: zMacroExecutionResponse,
      400: zMacroErrorResponse,
      404: zMacroErrorResponse,
    },
    summary: "Execute a macro",
    description:
      "Executes a single macro against one measurement / data point and returns the result",
  },

  executeMacroBatch: {
    method: "POST",
    path: "/api/v1/macros/execute-batch",
    body: zMacroBatchExecutionRequestBody,
    headers: zWebhookAuthHeader,
    responses: {
      200: zMacroBatchExecutionResponse,
      400: zMacroBatchWebhookErrorResponse,
      401: zMacroBatchWebhookErrorResponse,
    },
    summary: "Execute macro batch",
    description:
      "Accepts a batch of items with macro_ids from Databricks pipelines, groups by macro, fetches scripts, invokes Lambda functions, and returns processed results",
  },
});
