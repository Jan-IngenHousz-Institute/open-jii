import { initContract } from "@ts-rest/core";
import { z } from "zod";

import { zErrorResponse, zIdPathParam } from "../schemas/experiment.schema";
import {
  zFlow,
  zFlowStep,
  zFlowStepList,
  zCreateFlowStepBody,
  zUpdateFlowStepBody,
  zUpdateFlowStepPositionsBody,
  zMobileFlowExecution,
  zFlowStepPathParam,
} from "../schemas/flow.schema";

const c = initContract();

export const flowContract = c.router({
  // Flow management
  createFlow: {
    method: "POST",
    path: "/api/v1/flows",
    body: z.object({
      name: z.string().min(1).max(255),
      description: z.string().optional(),
    }),
    responses: {
      201: z.object({ id: z.string().uuid() }),
      400: zErrorResponse,
    },
    summary: "Create a new flow",
    description: "Creates a new reusable flow template",
  },

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

  getFlow: {
    method: "GET",
    path: "/api/v1/flows/:id",
    pathParams: zIdPathParam,
    responses: {
      200: zFlow,
      404: zErrorResponse,
    },
    summary: "Get flow details",
    description: "Returns detailed information about a specific flow",
  },

  updateFlow: {
    method: "PATCH",
    path: "/api/v1/flows/:id",
    pathParams: zIdPathParam,
    body: z.object({
      name: z.string().min(1).max(255).optional(),
      description: z.string().optional(),
      isActive: z.boolean().optional(),
    }),
    responses: {
      200: zFlow,
      404: zErrorResponse,
    },
    summary: "Update flow",
    description: "Updates an existing flow",
  },

  deleteFlow: {
    method: "DELETE",
    path: "/api/v1/flows/:id",
    pathParams: zIdPathParam,
    responses: {
      204: null,
      404: zErrorResponse,
    },
    summary: "Delete flow",
    description: "Deletes a flow and all its steps",
  },

  // Flow step management
  listFlowSteps: {
    method: "GET",
    path: "/api/v1/flows/:id/steps",
    pathParams: zIdPathParam,
    responses: {
      200: zFlowStepList,
      404: zErrorResponse,
    },
    summary: "List flow steps",
    description: "Returns all steps for a specific flow",
  },

  createFlowStep: {
    method: "POST",
    path: "/api/v1/flows/:id/steps",
    pathParams: zIdPathParam,
    body: zCreateFlowStepBody,
    responses: {
      201: zFlowStep,
      400: zErrorResponse,
      404: zErrorResponse,
    },
    summary: "Create flow step",
    description: "Adds a new step to the flow",
  },

  getFlowStep: {
    method: "GET",
    path: "/api/v1/flows/:id/steps/:stepId",
    pathParams: zFlowStepPathParam,
    responses: {
      200: zFlowStep,
      404: zErrorResponse,
    },
    summary: "Get flow step",
    description: "Returns a specific flow step",
  },

  updateFlowStep: {
    method: "PATCH",
    path: "/api/v1/flows/:id/steps/:stepId",
    pathParams: zFlowStepPathParam,
    body: zUpdateFlowStepBody,
    responses: {
      200: zFlowStep,
      404: zErrorResponse,
    },
    summary: "Update flow step",
    description: "Updates an existing flow step",
  },

  deleteFlowStep: {
    method: "DELETE",
    path: "/api/v1/flows/:id/steps/:stepId",
    pathParams: zFlowStepPathParam,
    responses: {
      204: null,
      404: zErrorResponse,
    },
    summary: "Delete flow step",
    description: "Removes a step from the flow",
  },

  updateFlowStepPositions: {
    method: "PATCH",
    path: "/api/v1/flows/:id/steps/positions",
    pathParams: zIdPathParam,
    body: zUpdateFlowStepPositionsBody,
    responses: {
      200: zFlowStepList,
      400: zErrorResponse,
      404: zErrorResponse,
    },
    summary: "Update flow step positions",
    description: "Updates the positions and sizes of steps in a flow",
  },

  getMobileFlow: {
    method: "GET",
    path: "/api/v1/experiments/:id/flow/mobile",
    pathParams: zIdPathParam,
    responses: {
      200: zMobileFlowExecution,
      400: zErrorResponse,
      404: zErrorResponse,
    },
    summary: "Get mobile flow execution format",
    description: "Returns the complete flow in a mobile-friendly sequential format",
  },
});
