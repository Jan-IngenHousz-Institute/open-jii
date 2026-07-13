import { initContract } from "@ts-rest/core";

import {
  zCommand,
  zCommandList,
  zCommandErrorResponse,
  zCommandFilterQuery,
  zCommandIdPathParam,
  zCreateCommandRequestBody,
  zUpdateCommandRequestBody,
  zCommandMacroList,
  zAddCompatibleMacrosBody,
  zCommandMacroPathParams,
} from "../schemas/command.schema";

const c = initContract();

export const commandContract = c.router({
  listCommands: {
    method: "GET",
    path: "/api/v1/commands",
    query: zCommandFilterQuery,
    responses: {
      200: zCommandList,
      400: zCommandErrorResponse,
    },
    summary: "List commands",
    description: "Returns a list of commands based on the specified filter criteria",
  },

  getCommand: {
    method: "GET",
    path: "/api/v1/commands/:id",
    pathParams: zCommandIdPathParam,
    responses: {
      200: zCommand,
      404: zCommandErrorResponse,
    },
    summary: "Get command by ID",
    description: "Returns a command by its ID",
  },

  createCommand: {
    method: "POST",
    path: "/api/v1/commands",
    body: zCreateCommandRequestBody,
    responses: {
      201: zCommand,
      400: zCommandErrorResponse,
      409: zCommandErrorResponse,
    },
    summary: "Create a new command",
    description: "Creates a new command with the given properties",
  },

  updateCommand: {
    method: "PATCH",
    path: "/api/v1/commands/:id",
    pathParams: zCommandIdPathParam,
    body: zUpdateCommandRequestBody,
    responses: {
      200: zCommand,
      400: zCommandErrorResponse,
      404: zCommandErrorResponse,
    },
    summary: "Update a command",
    description: "Updates a command with the given properties",
  },

  deleteCommand: {
    method: "DELETE",
    path: "/api/v1/commands/:id",
    pathParams: zCommandIdPathParam,
    responses: {
      204: null,
      404: zCommandErrorResponse,
    },
    summary: "Delete a command",
    description: "Deletes a command by its ID",
  },

  listCompatibleMacros: {
    method: "GET",
    path: "/api/v1/commands/:id/macros",
    pathParams: zCommandIdPathParam,
    responses: {
      200: zCommandMacroList,
      404: zCommandErrorResponse,
    },
    summary: "List compatible macros for a command",
    description: "Returns macros that are marked as compatible with this command",
  },

  addCompatibleMacros: {
    method: "POST",
    path: "/api/v1/commands/:id/macros",
    pathParams: zCommandIdPathParam,
    body: zAddCompatibleMacrosBody,
    responses: {
      201: zCommandMacroList,
      403: zCommandErrorResponse,
      404: zCommandErrorResponse,
      500: zCommandErrorResponse,
    },
    summary: "Add compatible macros to a command",
    description: "Links macros as compatible with this command (creator only)",
  },

  removeCompatibleMacro: {
    method: "DELETE",
    path: "/api/v1/commands/:id/macros/:macroId",
    pathParams: zCommandMacroPathParams,
    body: null,
    responses: {
      204: null,
      403: zCommandErrorResponse,
      404: zCommandErrorResponse,
    },
    summary: "Remove a compatible macro from a command",
    description: "Unlinks a macro from this command's compatibility list (creator only)",
  },
});
