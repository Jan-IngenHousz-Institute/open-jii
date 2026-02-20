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
  zMacroExecutionRequestBody,
  zMacroExecutionResponse,
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
    responses: {
      200: zMacro,
      404: zMacroErrorResponse,
    },
    summary: "Get macro by ID",
    description: "Returns a macro by its ID",
  },

  createMacro: {
    method: "POST",
    path: "/api/v1/macros",
    body: zCreateMacroRequestBody,
    responses: {
      201: zMacro,
      400: zMacroErrorResponse,
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
