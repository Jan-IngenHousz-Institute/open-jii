import { initContract } from "@ts-rest/core";
import { z } from "zod";

import {
  zWorkbookVersion,
  zWorkbookVersionList,
  zWorkbookVersionErrorResponse,
  zWorkbookVersionIdPathParam,
} from "../schemas/workbook-version.schema";
import {
  zWorkbook,
  zWorkbookList,
  zWorkbookErrorResponse,
  zWorkbookFilterQuery,
  zWorkbookIdPathParam,
  zCreateWorkbookRequestBody,
  zUpdateWorkbookRequestBody,
} from "../schemas/workbook.schema";

const c = initContract();

export const workbookContract = c.router({
  listWorkbooks: {
    method: "GET",
    path: "/api/v1/workbooks",
    query: zWorkbookFilterQuery,
    responses: {
      200: zWorkbookList,
      400: zWorkbookErrorResponse,
    },
    summary: "List workbooks",
    description: "Returns a list of workbooks based on the specified filter criteria",
  },

  getWorkbook: {
    method: "GET",
    path: "/api/v1/workbooks/:id",
    pathParams: zWorkbookIdPathParam,
    responses: {
      200: zWorkbook,
      403: zWorkbookErrorResponse,
      404: zWorkbookErrorResponse,
    },
    summary: "Get workbook by ID",
    description: "Returns a workbook by its ID",
  },

  createWorkbook: {
    method: "POST",
    path: "/api/v1/workbooks",
    body: zCreateWorkbookRequestBody,
    responses: {
      201: zWorkbook,
      400: zWorkbookErrorResponse,
    },
    summary: "Create a new workbook",
    description: "Creates a new workbook with the given properties",
  },

  updateWorkbook: {
    method: "PATCH",
    path: "/api/v1/workbooks/:id",
    pathParams: zWorkbookIdPathParam,
    body: zUpdateWorkbookRequestBody,
    responses: {
      200: zWorkbook,
      400: zWorkbookErrorResponse,
      403: zWorkbookErrorResponse,
      404: zWorkbookErrorResponse,
    },
    summary: "Update an existing workbook",
    description: "Updates an existing workbook (owner only)",
  },

  deleteWorkbook: {
    method: "DELETE",
    path: "/api/v1/workbooks/:id",
    pathParams: zWorkbookIdPathParam,
    body: z.undefined(),
    responses: {
      204: z.undefined(),
      403: zWorkbookErrorResponse,
      404: zWorkbookErrorResponse,
    },
    summary: "Delete a workbook",
    description: "Deletes a workbook by its ID (owner only)",
  },

  listWorkbookVersions: {
    method: "GET",
    path: "/api/v1/workbooks/:id/versions",
    pathParams: zWorkbookIdPathParam,
    responses: {
      200: zWorkbookVersionList,
      404: zWorkbookVersionErrorResponse,
    },
    summary: "List workbook versions",
    description: "Returns all published versions for a workbook, ordered by version descending",
  },

  getWorkbookVersion: {
    method: "GET",
    path: "/api/v1/workbooks/:id/versions/:versionId",
    pathParams: zWorkbookVersionIdPathParam,
    responses: {
      200: zWorkbookVersion,
      404: zWorkbookVersionErrorResponse,
    },
    summary: "Get a specific workbook version",
    description: "Returns a specific workbook version with its full cell data",
  },
});
