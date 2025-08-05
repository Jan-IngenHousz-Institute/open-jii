import { initContract } from "@ts-rest/core";
import { z } from "zod";

import { zErrorResponse, zIdPathParam } from "../schemas/experiment.schema";
import {
  zFlow,
  zCreateFlowWithStepsBody,
  zUpdateFlowWithStepsBody,
  zFlowWithGraph,
} from "../schemas/flow.schema";

const c = initContract();

export const flowContract = c.router({
  // List all flows
  listFlows: {
    method: "GET",
    path: "/api/v1/flows",
    responses: {
      200: z.array(zFlow),
      400: zErrorResponse,
    },
    summary: "List all flows",
    description: "Returns a list of all available flows",
  },

  // Get flow by experiment ID
  getFlowByExperiment: {
    method: "GET",
    path: "/api/v1/experiments/:id/flow",
    pathParams: zIdPathParam,
    responses: {
      200: zFlowWithGraph,
      400: zErrorResponse,
      404: zErrorResponse,
    },
    summary: "Get flow by experiment ID",
    description: "Returns the complete flow with steps and connections for a specific experiment",
  },

  // Bulk operations for React Flow frontend
  createFlowWithSteps: {
    method: "POST",
    path: "/api/v1/flows/bulk",
    body: zCreateFlowWithStepsBody,
    responses: {
      201: zFlowWithGraph,
      400: zErrorResponse,
    },
    summary: "Create flow with steps and connections",
    description:
      "Creates a complete flow with all its steps and connections in a single operation. Designed for React Flow frontend integration.",
  },

  updateFlowWithSteps: {
    method: "PATCH",
    path: "/api/v1/flows/:id/bulk",
    pathParams: zIdPathParam,
    body: zUpdateFlowWithStepsBody,
    responses: {
      200: zFlowWithGraph,
      400: zErrorResponse,
      404: zErrorResponse,
    },
    summary: "Update flow with bulk step operations",
    description:
      "Performs bulk operations (create, update, delete) on flow steps and connections in a single transaction. Designed for React Flow frontend integration.",
  },
});
