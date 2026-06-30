import { initContract } from "@ts-rest/core";
import { z } from "zod";

import { zErrorResponse } from "../../shared/errors";
import { zWebhookAuthHeader, zWebhookErrorResponse } from "../user/user.schema";
import { zAttachWorkbookBody, zAttachWorkbookResponse } from "../workbook/workbook-version.schema";
import {
  zExperiment,
  zExperimentList,
  zExperimentMember,
  zExperimentMemberList,
  zCreateExperimentBody,
  zAddExperimentMembersBody,
  zUpdateExperimentMemberRoleBody,
  zTransferExperimentAdminBody,
  zTransferExperimentAdminResponse,
  zUpdateExperimentBody,
  zExperimentFilterQuery,
  zCreateExperimentResponse,
  zExperimentIdPathParam,
  zExperimentMemberPathParam,
  zExperimentDataQuery,
  zExperimentDataResponse,
  zExperimentDistinctValuesQuery,
  zExperimentDistinctValuesResponse,
  zExperimentTablesMetadataList,
  zExperimentAccess,
  zExperimentUploadDataBody,
  zExperimentUploadDataResponse,
  zExperimentListUploadsQuery,
  zExperimentListUploadsResponse,
  zExperimentInitiateExportBody,
  zExperimentInitiateExportResponse,
  zExperimentListExportsQuery,
  zExperimentListExportsResponse,
  zExperimentExportPathParam,
  zExperimentDownloadExportResponse,
  zExperimentLocationList,
  zAddExperimentLocationsBody,
  zUpdateExperimentLocationsBody,
  zExperimentPlaceSearchQuery,
  zExperimentPlaceSearchResponse,
  zExperimentGeocodeQuery,
  zExperimentGeocodeResponse,
  zExperimentAddAnnotationBody,
  zExperimentAnnotationPathParam,
  zExperimentAddAnnotationsBulkBody,
  zExperimentUpdateAnnotationBody,
  zExperimentAnnotationDeleteBulkPathParam,
  zExperimentAnnotationDeleteBulkBody,
  zExperimentAnnotationRowsAffected,
  zExperimentCreateTransferRequestBody,
  zExperimentTransferRequest,
  zExperimentTransferRequestList,
  zExperimentProjectTransferWebhookPayload,
  zExperimentProjectTransferWebhookResponse,
  zExperimentMetadata,
  zCreateExperimentMetadataBody,
  zUpdateExperimentMetadataBody,
  zExperimentMetadataPathParam,
  zExperimentCreateJoinRequestBody,
  zExperimentJoinRequest,
  zExperimentJoinRequestList,
  zExperimentJoinRequestPathParam,
} from "./experiment.schema";
import {
  zExperimentFlow,
  zExperimentUpsertFlowBody,
  // Visualization schemas
  zExperimentVisualization,
  zExperimentVisualizationList,
  zCreateExperimentVisualizationBody,
  zUpdateExperimentVisualizationBody,
  zListExperimentVisualizationsQuery,
  zExperimentVisualizationPathParam,
  zCreateExperimentVisualizationResponse,
  zUpdateExperimentVisualizationResponse,
  // Dashboard schemas
  zExperimentDashboard,
  zExperimentDashboardList,
  zCreateExperimentDashboardBody,
  zUpdateExperimentDashboardBody,
  zListExperimentDashboardsQuery,
  zExperimentDashboardPathParam,
  zCreateExperimentDashboardResponse,
  zUpdateExperimentDashboardResponse,
} from "./experiment.schema";

const c = initContract();

export const experimentContract = c.router({
  createExperiment: {
    method: "POST",
    path: "/api/v1/experiments",
    body: zCreateExperimentBody,
    responses: {
      201: zCreateExperimentResponse,
      400: zErrorResponse,
      409: zErrorResponse,
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
      "Returns a list of experiments based on the specified filter criteria, including search.",
  },

  getExperiment: {
    method: "GET",
    path: "/api/v1/experiments/:id",
    pathParams: zExperimentIdPathParam,
    responses: {
      200: zExperiment,
      404: zErrorResponse,
    },
    summary: "Get experiment details",
    description: "Returns detailed information about a specific experiment",
  },

  getExperimentAccess: {
    method: "GET",
    path: "/api/v1/experiments/:id/access",
    pathParams: zExperimentIdPathParam,
    responses: {
      200: zExperimentAccess,
      404: zErrorResponse,
      403: zErrorResponse,
    },
    summary: "Get experiment details with access information",
    description: "Returns experiment details along with user access and admin status",
  },

  updateExperiment: {
    method: "PATCH",
    path: "/api/v1/experiments/:id",
    pathParams: zExperimentIdPathParam,
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
    pathParams: zExperimentIdPathParam,
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
    pathParams: zExperimentIdPathParam,
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
    pathParams: zExperimentIdPathParam,
    body: zAddExperimentMembersBody,
    responses: {
      201: zExperimentMemberList,
      403: zErrorResponse,
      404: zErrorResponse,
      409: zErrorResponse,
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

  updateExperimentMemberRole: {
    method: "PATCH",
    path: "/api/v1/experiments/:id/members/:memberId",
    pathParams: zExperimentMemberPathParam,
    body: zUpdateExperimentMemberRoleBody,
    responses: {
      200: zExperimentMember,
      404: zErrorResponse,
      403: zErrorResponse,
      400: zErrorResponse,
    },
    summary: "Update experiment member role",
    description: "Updates the role of an existing experiment member",
  },

  transferExperimentAdmin: {
    method: "POST",
    path: "/api/v1/experiments/transfer-admin",
    body: zTransferExperimentAdminBody,
    responses: {
      200: zTransferExperimentAdminResponse,
      400: zErrorResponse,
      403: zErrorResponse,
      404: zErrorResponse,
    },
    summary: "Bulk-transfer experiment admin rights",
    description:
      "Promotes (or adds) the given users as admins across multiple experiments the caller administers. Used to clear account-deletion blockers in one step.",
  },

  createJoinRequest: {
    method: "POST",
    path: "/api/v1/experiments/:id/join-requests",
    pathParams: zExperimentIdPathParam,
    body: zExperimentCreateJoinRequestBody,
    responses: {
      201: zExperimentJoinRequest,
      200: zExperimentJoinRequest,
      403: zErrorResponse,
      404: zErrorResponse,
      409: zErrorResponse,
    },
    summary: "Request to join an experiment",
    description:
      "Submits a request from the signed-in user to join the experiment as a member. Returns the existing pending request if one already exists.",
  },

  listJoinRequests: {
    method: "GET",
    path: "/api/v1/experiments/:id/join-requests",
    pathParams: zExperimentIdPathParam,
    responses: {
      200: zExperimentJoinRequestList,
      403: zErrorResponse,
      404: zErrorResponse,
    },
    summary: "List pending join requests for an experiment",
    description: "Returns all pending join requests for the experiment.",
  },

  getMyJoinRequest: {
    method: "GET",
    path: "/api/v1/experiments/:id/join-requests/me",
    pathParams: zExperimentIdPathParam,
    responses: {
      200: zExperimentJoinRequest,
      404: zErrorResponse,
    },
    summary: "Get the signed-in user's pending join request for an experiment",
    description: "Returns the current user's pending join request, if any.",
  },

  approveJoinRequest: {
    method: "POST",
    path: "/api/v1/experiments/:id/join-requests/:requestId/approve",
    pathParams: zExperimentJoinRequestPathParam,
    body: z.object({}).optional(),
    responses: {
      200: zExperimentJoinRequest,
      403: zErrorResponse,
      404: zErrorResponse,
      409: zErrorResponse,
    },
    summary: "Approve a join request",
    description: "Admin-only. Approves a pending join request and adds the requester as a member.",
  },

  rejectJoinRequest: {
    method: "POST",
    path: "/api/v1/experiments/:id/join-requests/:requestId/reject",
    pathParams: zExperimentJoinRequestPathParam,
    body: z.object({}).optional(),
    responses: {
      200: zExperimentJoinRequest,
      403: zErrorResponse,
      404: zErrorResponse,
      409: zErrorResponse,
    },
    summary: "Reject a join request",
    description: "Admin-only. Marks a pending join request as rejected.",
  },

  cancelJoinRequest: {
    method: "DELETE",
    path: "/api/v1/experiments/:id/join-requests/:requestId",
    pathParams: zExperimentJoinRequestPathParam,
    responses: {
      204: null,
      403: zErrorResponse,
      404: zErrorResponse,
    },
    summary: "Cancel own pending join request",
    description: "Cancels a pending join request submitted by the signed-in user.",
  },

  getExperimentData: {
    method: "GET",
    path: "/api/v1/experiments/:id/data",
    pathParams: zExperimentIdPathParam,
    query: zExperimentDataQuery,
    responses: {
      200: zExperimentDataResponse,
      404: zErrorResponse,
      403: zErrorResponse,
      400: zErrorResponse,
    },
    summary: "Get experiment data",
    description:
      "Retrieves rows from an experiment table. Supports plain page-based reads, column projection, and structured filters/aggregation (JSON-encoded) using the same primitives as the persisted visualization config. When `aggregation` is set, page/pageSize are ignored and `limit` caps the result.",
  },

  getDistinctColumnValues: {
    method: "GET",
    path: "/api/v1/experiments/:id/data/distinct",
    pathParams: zExperimentIdPathParam,
    query: zExperimentDistinctValuesQuery,
    responses: {
      200: zExperimentDistinctValuesResponse,
      400: zErrorResponse,
      403: zErrorResponse,
      404: zErrorResponse,
    },
    summary: "Get distinct values for a column",
    description:
      "Returns the distinct (non-null) values of a single column on an experiment table, capped at `limit`. Powers the searchable categorical filter combobox and any consumer that needs a values list.",
  },

  getExperimentTables: {
    method: "GET",
    path: "/api/v1/experiments/:id/tables",
    pathParams: zExperimentIdPathParam,
    responses: {
      200: zExperimentTablesMetadataList,
      404: zErrorResponse,
      403: zErrorResponse,
      400: zErrorResponse,
    },
    summary: "Get experiment tables metadata",
    description:
      "Retrieves metadata for all tables in the experiment (names, display names, row counts)",
  },

  getFlow: {
    method: "GET",
    path: "/api/v1/experiments/:id/flow",
    pathParams: zExperimentIdPathParam,
    responses: {
      200: zExperimentFlow,
      404: zErrorResponse,
      403: zErrorResponse,
    },
    summary: "Get experiment flow",
    description: "Returns the flow graph for the specified experiment.",
  },

  createFlow: {
    method: "POST",
    path: "/api/v1/experiments/:id/flow",
    pathParams: zExperimentIdPathParam,
    body: zExperimentUpsertFlowBody,
    responses: {
      201: zExperimentFlow,
      400: zErrorResponse,
      403: zErrorResponse,
      404: zErrorResponse,
      409: zErrorResponse,
    },
    summary: "Create experiment flow",
    description: "Creates a new flow for the experiment with the provided graph.",
  },

  updateFlow: {
    method: "PUT",
    path: "/api/v1/experiments/:id/flow",
    pathParams: zExperimentIdPathParam,
    body: zExperimentUpsertFlowBody,
    responses: {
      200: zExperimentFlow,
      400: zErrorResponse,
      403: zErrorResponse,
      404: zErrorResponse,
    },
    summary: "Update experiment flow",
    description: "Updates the existing flow for the experiment with the provided graph.",
  },

  attachWorkbook: {
    method: "POST",
    path: "/api/v1/experiments/:id/workbook/attach",
    pathParams: zExperimentIdPathParam,
    body: zAttachWorkbookBody,
    responses: {
      200: zAttachWorkbookResponse,
      400: zErrorResponse,
      403: zErrorResponse,
      404: zErrorResponse,
    },
    summary: "Attach a workbook to an experiment",
    description:
      "Attaches a workbook to the experiment, publishing a new version if cells have changed since the last publish.",
  },

  detachWorkbook: {
    method: "POST",
    path: "/api/v1/experiments/:id/workbook/detach",
    pathParams: zExperimentIdPathParam,
    body: z.undefined(),
    responses: {
      200: zExperiment,
      403: zErrorResponse,
      404: zErrorResponse,
    },
    summary: "Detach the workbook from an experiment",
    description:
      "Detaches the current workbook from the experiment. The workbook version reference is kept for historical purposes.",
  },

  upgradeWorkbookVersion: {
    method: "POST",
    path: "/api/v1/experiments/:id/workbook/upgrade",
    pathParams: zExperimentIdPathParam,
    body: z.undefined(),
    responses: {
      200: zAttachWorkbookResponse,
      400: zErrorResponse,
      403: zErrorResponse,
      404: zErrorResponse,
    },
    summary: "Upgrade the experiment to the latest workbook version",
    description:
      "Publishes the latest workbook cells as a new version (or reuses the latest if unchanged) and updates the experiment to reference it.",
  },

  uploadData: {
    method: "POST",
    path: "/api/v1/experiments/:id/data/uploads",
    pathParams: zExperimentIdPathParam,
    contentType: "multipart/form-data",
    body: zExperimentUploadDataBody,
    responses: {
      201: zExperimentUploadDataResponse,
      400: zErrorResponse,
      403: zErrorResponse,
      404: zErrorResponse,
      409: zErrorResponse,
    },
    summary: "Upload generic tabular or structured data",
    description:
      "Uploads tabular or structured data (CSV, TSV, parquet, Excel, JSON, NDJSON) into a user-defined table in the experiment. Either creates a new upload table or appends to an existing one.",
  },

  listUploads: {
    method: "GET",
    path: "/api/v1/experiments/:id/data/uploads",
    pathParams: zExperimentIdPathParam,
    query: zExperimentListUploadsQuery,
    responses: {
      200: zExperimentListUploadsResponse,
      403: zErrorResponse,
      404: zErrorResponse,
    },
    summary: "List experiment uploads",
    description:
      "Returns the merged upload history for an experiment: completed uploads from the Delta history table plus active and failed runs from the Databricks job-runs API. Optionally filtered by upload table name.",
  },

  initiateExport: {
    method: "POST",
    path: "/api/v1/experiments/:id/data/exports",
    pathParams: zExperimentIdPathParam,
    body: zExperimentInitiateExportBody,
    responses: {
      201: zExperimentInitiateExportResponse,
      400: zErrorResponse,
      403: zErrorResponse,
      404: zErrorResponse,
    },
    summary: "Initiate data export",
    description: "Initiates an asynchronous export job for experiment table data",
  },

  listExports: {
    method: "GET",
    path: "/api/v1/experiments/:id/data/exports",
    pathParams: zExperimentIdPathParam,
    query: zExperimentListExportsQuery,
    responses: {
      200: zExperimentListExportsResponse,
      403: zErrorResponse,
      404: zErrorResponse,
    },
    summary: "List data exports",
    description: "Lists all export jobs for an experiment table",
  },

  downloadExport: {
    method: "GET",
    path: "/api/v1/experiments/:id/data/exports/:exportId",
    pathParams: zExperimentExportPathParam,
    responses: {
      200: zExperimentDownloadExportResponse,
      403: zErrorResponse,
      404: zErrorResponse,
    },
    summary: "Download export file",
    description: "Downloads a completed export file",
  },

  getExperimentLocations: {
    method: "GET",
    path: "/api/v1/experiments/:id/locations",
    pathParams: zExperimentIdPathParam,
    responses: {
      200: zExperimentLocationList,
      403: zErrorResponse,
      404: zErrorResponse,
    },
    summary: "Get experiment locations",
    description: "Returns all locations associated with the specified experiment.",
  },

  addExperimentLocations: {
    method: "POST",
    path: "/api/v1/experiments/:id/locations",
    pathParams: zExperimentIdPathParam,
    body: zAddExperimentLocationsBody,
    responses: {
      201: zExperimentLocationList,
      400: zErrorResponse,
      403: zErrorResponse,
      404: zErrorResponse,
    },
    summary: "Add locations to an experiment",
    description: "Associates one or more locations with an experiment.",
  },

  updateExperimentLocations: {
    method: "PUT",
    path: "/api/v1/experiments/:id/locations",
    pathParams: zExperimentIdPathParam,
    body: zUpdateExperimentLocationsBody,
    responses: {
      200: zExperimentLocationList,
      400: zErrorResponse,
      403: zErrorResponse,
      404: zErrorResponse,
    },
    summary: "Update experiment locations",
    description: "Replaces all locations associated with an experiment.",
  },

  searchPlaces: {
    method: "GET",
    path: "/api/v1/locations/search",
    query: zExperimentPlaceSearchQuery,
    responses: {
      200: zExperimentPlaceSearchResponse,
      400: zErrorResponse,
    },
    summary: "Search for places",
    description: "Search for places using text query through AWS ExperimentLocation Service.",
  },

  geocodeLocation: {
    method: "GET",
    path: "/api/v1/locations/geocode",
    query: zExperimentGeocodeQuery,
    responses: {
      200: zExperimentGeocodeResponse,
      400: zErrorResponse,
    },
    summary: "Reverse geocode coordinates",
    description:
      "Get place information for given coordinates through AWS ExperimentLocation Service.",
  },
  listExperimentVisualizations: {
    method: "GET",
    path: "/api/v1/experiments/:id/visualizations",
    pathParams: zExperimentIdPathParam,
    query: zListExperimentVisualizationsQuery,
    responses: {
      200: zExperimentVisualizationList,
      400: zErrorResponse,
      401: zErrorResponse,
      403: zErrorResponse,
      404: zErrorResponse,
    },
    summary: "List experiment visualizations",
    description: "Retrieves a list of visualizations for a specific experiment",
  },

  createExperimentVisualization: {
    method: "POST",
    path: "/api/v1/experiments/:id/visualizations",
    pathParams: zExperimentIdPathParam,
    body: zCreateExperimentVisualizationBody,
    responses: {
      201: zCreateExperimentVisualizationResponse,
      400: zErrorResponse,
      401: zErrorResponse,
      403: zErrorResponse,
      404: zErrorResponse,
    },
    summary: "Create experiment visualization",
    description: "Creates a new visualization for an experiment with the provided configuration",
  },

  getExperimentVisualization: {
    method: "GET",
    path: "/api/v1/experiments/:id/visualizations/:visualizationId",
    pathParams: zExperimentVisualizationPathParam,
    responses: {
      200: zExperimentVisualization,
      401: zErrorResponse,
      403: zErrorResponse,
      404: zErrorResponse,
    },
    summary: "Get experiment visualization",
    description: "Retrieves a specific visualization by its ID",
  },

  updateExperimentVisualization: {
    method: "PATCH",
    path: "/api/v1/experiments/:id/visualizations/:visualizationId",
    pathParams: zExperimentVisualizationPathParam,
    body: zUpdateExperimentVisualizationBody,
    responses: {
      200: zUpdateExperimentVisualizationResponse,
      400: zErrorResponse,
      401: zErrorResponse,
      403: zErrorResponse,
      404: zErrorResponse,
    },
    summary: "Update experiment visualization",
    description: "Updates an existing visualization with the provided data",
  },

  deleteExperimentVisualization: {
    method: "DELETE",
    path: "/api/v1/experiments/:id/visualizations/:visualizationId",
    pathParams: zExperimentVisualizationPathParam,
    responses: {
      204: null,
      401: zErrorResponse,
      403: zErrorResponse,
      404: zErrorResponse,
    },
    summary: "Delete experiment visualization",
    description: "Permanently deletes a visualization",
  },

  listExperimentDashboards: {
    method: "GET",
    path: "/api/v1/experiments/:id/dashboards",
    pathParams: zExperimentIdPathParam,
    query: zListExperimentDashboardsQuery,
    responses: {
      200: zExperimentDashboardList,
      400: zErrorResponse,
      401: zErrorResponse,
      403: zErrorResponse,
      404: zErrorResponse,
    },
    summary: "List experiment dashboards",
    description: "Retrieves a list of dashboards for a specific experiment",
  },

  createExperimentDashboard: {
    method: "POST",
    path: "/api/v1/experiments/:id/dashboards",
    pathParams: zExperimentIdPathParam,
    body: zCreateExperimentDashboardBody,
    responses: {
      201: zCreateExperimentDashboardResponse,
      400: zErrorResponse,
      401: zErrorResponse,
      403: zErrorResponse,
      404: zErrorResponse,
    },
    summary: "Create experiment dashboard",
    description: "Creates a new dashboard for an experiment",
  },

  getExperimentDashboard: {
    method: "GET",
    path: "/api/v1/experiments/:id/dashboards/:dashboardId",
    pathParams: zExperimentDashboardPathParam,
    responses: {
      200: zExperimentDashboard,
      401: zErrorResponse,
      403: zErrorResponse,
      404: zErrorResponse,
    },
    summary: "Get experiment dashboard",
    description: "Retrieves a specific dashboard by its ID",
  },

  updateExperimentDashboard: {
    method: "PATCH",
    path: "/api/v1/experiments/:id/dashboards/:dashboardId",
    pathParams: zExperimentDashboardPathParam,
    body: zUpdateExperimentDashboardBody,
    responses: {
      200: zUpdateExperimentDashboardResponse,
      400: zErrorResponse,
      401: zErrorResponse,
      403: zErrorResponse,
      404: zErrorResponse,
    },
    summary: "Update experiment dashboard",
    description:
      "Updates an existing dashboard. When `widgets` is supplied, the array fully replaces the existing widgets.",
  },

  deleteExperimentDashboard: {
    method: "DELETE",
    path: "/api/v1/experiments/:id/dashboards/:dashboardId",
    pathParams: zExperimentDashboardPathParam,
    responses: {
      204: null,
      401: zErrorResponse,
      403: zErrorResponse,
      404: zErrorResponse,
    },
    summary: "Delete experiment dashboard",
    description: "Permanently deletes a dashboard",
  },

  addAnnotation: {
    method: "POST",
    path: "/api/v1/experiments/:id/data/annotations",
    pathParams: zExperimentIdPathParam,
    body: zExperimentAddAnnotationBody,
    responses: {
      201: zExperimentAnnotationRowsAffected,
      400: zErrorResponse,
      403: zErrorResponse,
    },
    summary: "Add annotation to experiment data",
  },

  addAnnotationsBulk: {
    method: "POST",
    path: "/api/v1/experiments/:id/data/annotations/bulk",
    pathParams: zExperimentIdPathParam,
    body: zExperimentAddAnnotationsBulkBody,
    responses: {
      201: zExperimentAnnotationRowsAffected,
      400: zErrorResponse,
      403: zErrorResponse,
    },
    summary: "Add multiple annotations to experiment data",
  },

  updateAnnotation: {
    method: "PATCH",
    path: "/api/v1/experiments/:id/data/annotations/:annotationId",
    pathParams: zExperimentAnnotationPathParam,
    body: zExperimentUpdateAnnotationBody,
    responses: {
      204: zExperimentAnnotationRowsAffected,
      404: zErrorResponse,
      403: zErrorResponse,
    },
    summary: "Update annotation",
  },

  deleteAnnotation: {
    method: "DELETE",
    path: "/api/v1/experiments/:id/data/annotations/:annotationId",
    pathParams: zExperimentAnnotationPathParam,
    responses: {
      204: zExperimentAnnotationRowsAffected,
      404: zErrorResponse,
      403: zErrorResponse,
    },
    summary: "Delete annotation",
  },

  deleteAnnotationsBulk: {
    method: "POST",
    path: "/api/v1/experiments/:id/data/annotations/bulk-delete",
    pathParams: zExperimentAnnotationDeleteBulkPathParam,
    body: zExperimentAnnotationDeleteBulkBody,
    responses: {
      204: zExperimentAnnotationRowsAffected,
      404: zErrorResponse,
      403: zErrorResponse,
    },
    summary: "Delete multiple annotations",
  },

  // Project transfer request endpoints
  createTransferRequest: {
    method: "POST",
    path: "/api/v1/transfer-requests",
    body: zExperimentCreateTransferRequestBody,
    responses: {
      201: zExperimentTransferRequest,
      400: zErrorResponse,
      401: zErrorResponse,
      500: zErrorResponse,
    },
    summary: "Create a project transfer request",
  },

  listTransferRequests: {
    method: "GET",
    path: "/api/v1/transfer-requests",
    responses: {
      200: zExperimentTransferRequestList,
      401: zErrorResponse,
      500: zErrorResponse,
    },
    summary: "List all transfer requests for the authenticated user",
  },

  projectTransfer: {
    method: "POST",
    path: "/api/v1/webhooks/project-transfer",
    body: zExperimentProjectTransferWebhookPayload,
    headers: zWebhookAuthHeader,
    responses: {
      201: zExperimentProjectTransferWebhookResponse,
      400: zWebhookErrorResponse,
      401: zWebhookErrorResponse,
      500: zWebhookErrorResponse,
    },
    summary: "Execute project transfer from Databricks",
    description:
      "Creates experiment, protocol, macro, and optionally flow in a single atomic operation as part of a project transfer from an external platform",
  },
  listExperimentMetadata: {
    method: "GET",
    path: "/api/v1/experiments/:id/metadata",
    pathParams: zExperimentIdPathParam,
    responses: {
      200: z.array(zExperimentMetadata),
      401: zErrorResponse,
      403: zErrorResponse,
      404: zErrorResponse,
    },
    summary: "List experiment metadata",
    description: "Retrieves all metadata records for an experiment",
  },

  createExperimentMetadata: {
    method: "POST",
    path: "/api/v1/experiments/:id/metadata",
    pathParams: zExperimentIdPathParam,
    body: zCreateExperimentMetadataBody,
    responses: {
      201: zExperimentMetadata,
      400: zErrorResponse,
      401: zErrorResponse,
      403: zErrorResponse,
      404: zErrorResponse,
    },
    summary: "Create experiment metadata",
    description:
      "Creates a new metadata record for an experiment. Multiple metadata records can be attached to a single experiment.",
  },

  updateExperimentMetadata: {
    method: "PUT",
    path: "/api/v1/experiments/:id/metadata/:metadataId",
    pathParams: zExperimentMetadataPathParam,
    body: zUpdateExperimentMetadataBody,
    responses: {
      200: zExperimentMetadata,
      400: zErrorResponse,
      401: zErrorResponse,
      403: zErrorResponse,
      404: zErrorResponse,
    },
    summary: "Update experiment metadata",
    description:
      "Replaces the metadata blob on an existing metadata record. The entire metadata object is replaced.",
  },

  deleteExperimentMetadata: {
    method: "DELETE",
    path: "/api/v1/experiments/:id/metadata/:metadataId",
    pathParams: zExperimentMetadataPathParam,
    responses: {
      204: null,
      401: zErrorResponse,
      403: zErrorResponse,
      404: zErrorResponse,
    },
    summary: "Delete experiment metadata",
    description: "Removes a specific metadata record from an experiment",
  },
});
