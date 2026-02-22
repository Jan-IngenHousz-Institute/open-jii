import { initContract } from "@ts-rest/core";

import {
  zExperiment,
  zExperimentList,
  zExperimentMember,
  zExperimentMemberList,
  zErrorResponse,
  zCreateExperimentBody,
  zAddExperimentMembersBody,
  zUpdateExperimentMemberRoleBody,
  zUpdateExperimentBody,
  zExperimentFilterQuery,
  zCreateExperimentResponse,
  zIdPathParam,
  zExperimentMemberPathParam,
  zExperimentDataQuery,
  zExperimentDataResponse,
  zExperimentTablesMetadataList,
  zExperimentAccess,
  zUploadExperimentDataBody,
  zUploadExperimentDataResponse,
  zInitiateExportBody,
  zInitiateExportResponse,
  zListExportsQuery,
  zListExportsResponse,
  zExportPathParam,
  zDownloadExportResponse,
  zLocationList,
  zAddExperimentLocationsBody,
  zUpdateExperimentLocationsBody,
  zPlaceSearchQuery,
  zPlaceSearchResponse,
  zGeocodeQuery,
  zGeocodeResponse,
  zAddAnnotationBody,
  zAnnotationPathParam,
  zAddAnnotationsBulkBody,
  zUpdateAnnotationBody,
  zAnnotationDeleteBulkPathParam,
  zAnnotationDeleteBulkBody,
  zAnnotationRowsAffected,
  zCreateTransferRequestBody,
  zTransferRequest,
  zTransferRequestList,
  zExperimentMetadata,
  zUpsertExperimentMetadataBody,
} from "../schemas/experiment.schema";
import {
  // Flow schemas
  zFlow,
  zUpsertFlowBody,
  // Protocol schemas
  zExperimentProtocolList,
  zAddExperimentProtocolsBody,
  zExperimentProtocolPathParam,
  // Visualization schemas
  zExperimentVisualization,
  zExperimentVisualizationList,
  zCreateExperimentVisualizationBody,
  zUpdateExperimentVisualizationBody,
  zListExperimentVisualizationsQuery,
  zExperimentVisualizationPathParam,
  zCreateExperimentVisualizationResponse,
  zUpdateExperimentVisualizationResponse,
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
    description:
      "Returns a list of experiments based on the specified filter criteria, including search.",
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

  getExperimentAccess: {
    method: "GET",
    path: "/api/v1/experiments/:id/access",
    pathParams: zIdPathParam,
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

  getExperimentTables: {
    method: "GET",
    path: "/api/v1/experiments/:id/tables",
    pathParams: zIdPathParam,
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

  // --- Flow Endpoints ---
  getFlow: {
    method: "GET",
    path: "/api/v1/experiments/:id/flow",
    pathParams: zIdPathParam,
    responses: {
      200: zFlow,
      404: zErrorResponse,
      403: zErrorResponse,
    },
    summary: "Get experiment flow",
    description: "Returns the flow graph for the specified experiment.",
  },

  createFlow: {
    method: "POST",
    path: "/api/v1/experiments/:id/flow",
    pathParams: zIdPathParam,
    body: zUpsertFlowBody,
    responses: {
      201: zFlow,
      400: zErrorResponse,
      403: zErrorResponse,
      404: zErrorResponse,
    },
    summary: "Create experiment flow",
    description: "Creates a new flow for the experiment with the provided graph.",
  },

  updateFlow: {
    method: "PUT",
    path: "/api/v1/experiments/:id/flow",
    pathParams: zIdPathParam,
    body: zUpsertFlowBody,
    responses: {
      200: zFlow,
      400: zErrorResponse,
      403: zErrorResponse,
      404: zErrorResponse,
    },
    summary: "Update experiment flow",
    description: "Updates the existing flow for the experiment with the provided graph.",
  },

  uploadExperimentData: {
    method: "POST",
    path: "/api/v1/experiments/:id/data/upload",
    pathParams: zIdPathParam,
    contentType: "multipart/form-data",
    body: zUploadExperimentDataBody,
    responses: {
      201: zUploadExperimentDataResponse,
      400: zErrorResponse,
      403: zErrorResponse,
      404: zErrorResponse,
    },
    summary: "Upload experiment data",
    description: "Uploads experiment data files to Databricks",
  },

  initiateExport: {
    method: "POST",
    path: "/api/v1/experiments/:id/data/exports",
    pathParams: zIdPathParam,
    body: zInitiateExportBody,
    responses: {
      201: zInitiateExportResponse,
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
    pathParams: zIdPathParam,
    query: zListExportsQuery,
    responses: {
      200: zListExportsResponse,
      403: zErrorResponse,
      404: zErrorResponse,
    },
    summary: "List data exports",
    description: "Lists all export jobs for an experiment table",
  },

  downloadExport: {
    method: "GET",
    path: "/api/v1/experiments/:id/data/exports/:exportId",
    pathParams: zExportPathParam,
    responses: {
      200: zDownloadExportResponse,
      403: zErrorResponse,
      404: zErrorResponse,
    },
    summary: "Download export file",
    description: "Downloads a completed export file",
  },

  getExperimentLocations: {
    method: "GET",
    path: "/api/v1/experiments/:id/locations",
    pathParams: zIdPathParam,
    responses: {
      200: zLocationList,
      403: zErrorResponse,
      404: zErrorResponse,
    },
    summary: "Get experiment locations",
    description: "Returns all locations associated with the specified experiment.",
  },

  addExperimentLocations: {
    method: "POST",
    path: "/api/v1/experiments/:id/locations",
    pathParams: zIdPathParam,
    body: zAddExperimentLocationsBody,
    responses: {
      201: zLocationList,
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
    pathParams: zIdPathParam,
    body: zUpdateExperimentLocationsBody,
    responses: {
      200: zLocationList,
      400: zErrorResponse,
      403: zErrorResponse,
      404: zErrorResponse,
    },
    summary: "Update experiment locations",
    description: "Replaces all locations associated with an experiment.",
  },

  // --- Location Search Endpoints ---
  searchPlaces: {
    method: "GET",
    path: "/api/v1/locations/search",
    query: zPlaceSearchQuery,
    responses: {
      200: zPlaceSearchResponse,
      400: zErrorResponse,
    },
    summary: "Search for places",
    description: "Search for places using text query through AWS Location Service.",
  },

  geocodeLocation: {
    method: "GET",
    path: "/api/v1/locations/geocode",
    query: zGeocodeQuery,
    responses: {
      200: zGeocodeResponse,
      400: zErrorResponse,
    },
    summary: "Reverse geocode coordinates",
    description: "Get place information for given coordinates through AWS Location Service.",
  },
  // --- Visualization Endpoints ---
  listExperimentVisualizations: {
    method: "GET",
    path: "/api/v1/experiments/:id/visualizations",
    pathParams: zIdPathParam,
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
    pathParams: zIdPathParam,
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

  // Annotation endpoints
  addAnnotation: {
    method: "POST",
    path: "/api/v1/experiments/:id/data/annotations",
    pathParams: zIdPathParam,
    body: zAddAnnotationBody,
    responses: {
      201: zAnnotationRowsAffected,
      400: zErrorResponse,
      403: zErrorResponse,
    },
    summary: "Add annotation to experiment data",
  },

  addAnnotationsBulk: {
    method: "POST",
    path: "/api/v1/experiments/:id/data/annotations/bulk",
    pathParams: zIdPathParam,
    body: zAddAnnotationsBulkBody,
    responses: {
      201: zAnnotationRowsAffected,
      400: zErrorResponse,
      403: zErrorResponse,
    },
    summary: "Add multiple annotations to experiment data",
  },

  updateAnnotation: {
    method: "PATCH",
    path: "/api/v1/experiments/:id/data/annotations/:annotationId",
    pathParams: zAnnotationPathParam,
    body: zUpdateAnnotationBody,
    responses: {
      204: zAnnotationRowsAffected,
      404: zErrorResponse,
      403: zErrorResponse,
    },
    summary: "Update annotation",
  },

  deleteAnnotation: {
    method: "DELETE",
    path: "/api/v1/experiments/:id/data/annotations/:annotationId",
    pathParams: zAnnotationPathParam,
    responses: {
      204: zAnnotationRowsAffected,
      404: zErrorResponse,
      403: zErrorResponse,
    },
    summary: "Delete annotation",
  },

  deleteAnnotationsBulk: {
    method: "POST",
    path: "/api/v1/experiments/:id/data/annotations/bulk-delete",
    pathParams: zAnnotationDeleteBulkPathParam,
    body: zAnnotationDeleteBulkBody,
    responses: {
      204: zAnnotationRowsAffected,
      404: zErrorResponse,
      403: zErrorResponse,
    },
    summary: "Delete multiple annotations",
  },

  // Project transfer request endpoints
  createTransferRequest: {
    method: "POST",
    path: "/api/v1/transfer-requests",
    body: zCreateTransferRequestBody,
    responses: {
      201: zTransferRequest,
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
      200: zTransferRequestList,
      401: zErrorResponse,
      500: zErrorResponse,
    },
    summary: "List all transfer requests for the authenticated user",
  },

  // --- Experiment Metadata Endpoints ---
  getExperimentMetadata: {
    method: "GET",
    path: "/api/v1/experiments/:id/metadata",
    pathParams: zIdPathParam,
    responses: {
      200: zExperimentMetadata.nullable(),
      401: zErrorResponse,
      403: zErrorResponse,
      404: zErrorResponse,
    },
    summary: "Get experiment metadata",
    description: "Retrieves the metadata (custom columns and rows) for an experiment",
  },

  upsertExperimentMetadata: {
    method: "PUT",
    path: "/api/v1/experiments/:id/metadata",
    pathParams: zIdPathParam,
    body: zUpsertExperimentMetadataBody,
    responses: {
      200: zExperimentMetadata,
      400: zErrorResponse,
      401: zErrorResponse,
      403: zErrorResponse,
      404: zErrorResponse,
    },
    summary: "Create or update experiment metadata",
    description: "Creates or replaces the metadata for an experiment with the provided columns and rows",
  },

  deleteExperimentMetadata: {
    method: "DELETE",
    path: "/api/v1/experiments/:id/metadata",
    pathParams: zIdPathParam,
    responses: {
      204: null,
      401: zErrorResponse,
      403: zErrorResponse,
      404: zErrorResponse,
    },
    summary: "Delete experiment metadata",
    description: "Removes all metadata from an experiment",
  },
});
