export enum ErrorCodes {
  // ==================== Controller Layer - HTTP Status Aligned ====================
  // Location: src/*/presentation/
  // Controllers use error codes that align with HTTP status codes they return.
  BAD_REQUEST = "BAD_REQUEST", // Invalid request data (400)
  UNAUTHORIZED = "UNAUTHORIZED", // Authentication required (401)
  FORBIDDEN = "FORBIDDEN", // Access denied (403)
  NOT_FOUND = "NOT_FOUND", // Resource not found (404)
  CONFLICT = "CONFLICT", // Resource conflict (409)
  UNPROCESSABLE_ENTITY = "UNPROCESSABLE_ENTITY", // Validation failed (422)
  INTERNAL_SERVER_ERROR = "INTERNAL_SERVER_ERROR", // Server error (500)
  SERVICE_UNAVAILABLE = "SERVICE_UNAVAILABLE", // External service unavailable (503)

  // ==================== Guards & Authentication ====================
  // Location: src/common/guards/
  HMAC_AUTHENTICATION_FAILED = "HMAC_AUTHENTICATION_FAILED", // HMAC verification failed
  API_KEY_INVALID = "API_KEY_INVALID", // API key validation failed
  AUTH_TOKEN_INVALID = "AUTH_TOKEN_INVALID", // Auth token validation failed
  MISSING_CREDENTIALS = "MISSING_CREDENTIALS", // Required auth credentials missing

  // ==================== Configuration ====================
  // Location: src/common/modules/*/services/config/
  CONFIG_INVALID = "CONFIG_INVALID", // Generic config validation failed
  DATABRICKS_CONFIG_INVALID = "DATABRICKS_CONFIG_INVALID", // Databricks config specific
  AWS_CONFIG_INVALID = "AWS_CONFIG_INVALID", // AWS config specific
  EMAIL_CONFIG_INVALID = "EMAIL_CONFIG_INVALID", // Email config specific
  ANALYTICS_CONFIG_INVALID = "ANALYTICS_CONFIG_INVALID", // Analytics config specific

  // ==================== Databricks Operations ====================
  // Location: src/common/modules/databricks/
  DATABRICKS_AUTH_FAILED = "DATABRICKS_AUTH_FAILED", // Authentication with Databricks failed
  DATABRICKS_SQL_FAILED = "DATABRICKS_SQL_FAILED", // SQL query/execution failed
  DATABRICKS_JOB_FAILED = "DATABRICKS_JOB_FAILED", // Job trigger/execution failed
  DATABRICKS_PIPELINE_FAILED = "DATABRICKS_PIPELINE_FAILED", // Pipeline operations failed
  DATABRICKS_FILE_FAILED = "DATABRICKS_FILE_FAILED", // File upload/delete/lookup failed
  DATABRICKS_VOLUME_FAILED = "DATABRICKS_VOLUME_FAILED", // Volume create/get failed
  DATABRICKS_TABLE_FAILED = "DATABRICKS_TABLE_FAILED", // Table operations failed
  DATABRICKS_WORKSPACE_FAILED = "DATABRICKS_WORKSPACE_FAILED", // Workspace operations failed
  DATABRICKS_REFRESH_FAILED = "DATABRICKS_REFRESH_FAILED", // Refresh operations failed

  // ==================== AWS Operations ====================
  // Location: src/common/modules/aws/
  AWS_LOCATION_FAILED = "AWS_LOCATION_FAILED", // AWS Location Service failed
  AWS_OPERATION_FAILED = "AWS_OPERATION_FAILED", // Other AWS operations failed

  // ==================== Email Operations ====================
  // Location: src/common/modules/email/
  EMAIL_SEND_FAILED = "EMAIL_SEND_FAILED", // Email sending failed

  // ==================== Analytics & Feature Flags ====================
  // Location: src/common/modules/analytics/
  ANALYTICS_INIT_FAILED = "ANALYTICS_INIT_FAILED", // Analytics/PostHog initialization failed
  FEATURE_FLAG_FAILED = "FEATURE_FLAG_FAILED", // Feature flag check failed

  // ==================== Domain Operations - Macros ====================
  // Location: src/macros/application/use-cases/
  MACRO_CREATE_FAILED = "MACRO_CREATE_FAILED", // Failed to create macro
  MACRO_UPDATE_FAILED = "MACRO_UPDATE_FAILED", // Failed to update macro
  MACRO_DELETE_FAILED = "MACRO_DELETE_FAILED", // Failed to delete macro
  MACRO_NOT_FOUND = "MACRO_NOT_FOUND", // Macro not found

  // ==================== Domain Operations - Protocols ====================
  // Location: src/protocols/application/use-cases/
  PROTOCOL_CREATE_FAILED = "PROTOCOL_CREATE_FAILED", // Failed to create protocol
  PROTOCOL_UPDATE_FAILED = "PROTOCOL_UPDATE_FAILED", // Failed to update protocol
  PROTOCOL_DELETE_FAILED = "PROTOCOL_DELETE_FAILED", // Failed to delete protocol
  PROTOCOL_NOT_FOUND = "PROTOCOL_NOT_FOUND", // Protocol not found
  PROTOCOL_ASSIGNED = "PROTOCOL_ASSIGNED", // Cannot modify assigned protocol

  // ==================== Domain Operations - Users ====================
  // Location: src/users/application/use-cases/
  USER_CREATE_FAILED = "USER_CREATE_FAILED", // Failed to create user
  USER_UPDATE_FAILED = "USER_UPDATE_FAILED", // Failed to update user
  USER_DELETE_FAILED = "USER_DELETE_FAILED", // Failed to delete user
  USER_NOT_FOUND = "USER_NOT_FOUND", // User not found
  USER_PROFILE_NOT_FOUND = "USER_PROFILE_NOT_FOUND", // User profile not found
  USER_IS_ONLY_ADMIN = "USER_IS_ONLY_ADMIN", // Cannot delete sole admin

  // ==================== Domain Operations - Experiments Core ====================
  // Location: src/experiments/application/use-cases/
  EXPERIMENT_CREATE_FAILED = "EXPERIMENT_CREATE_FAILED", // Failed to create experiment
  EXPERIMENT_UPDATE_FAILED = "EXPERIMENT_UPDATE_FAILED", // Failed to update experiment
  EXPERIMENT_DELETE_FAILED = "EXPERIMENT_DELETE_FAILED", // Failed to delete experiment
  EXPERIMENT_NOT_FOUND = "EXPERIMENT_NOT_FOUND", // Experiment not found
  EXPERIMENT_DUPLICATE_NAME = "EXPERIMENT_DUPLICATE_NAME", // Name already exists
  EXPERIMENT_INVALID_STATE = "EXPERIMENT_INVALID_STATE", // Invalid state for operation

  // ==================== Domain Operations - Experiments Data ====================
  // Location: src/experiments/application/use-cases/
  EXPERIMENT_DATA_UPLOAD_FAILED = "EXPERIMENT_DATA_UPLOAD_FAILED", // Data upload failed
  EXPERIMENT_DATA_DOWNLOAD_FAILED = "EXPERIMENT_DATA_DOWNLOAD_FAILED", // Data download failed
  EXPERIMENT_SCHEMA_NOT_READY = "EXPERIMENT_SCHEMA_NOT_READY", // Schema not provisioned

  // ==================== Domain Operations - Experiments Protocols ====================
  // Location: src/experiments/application/use-cases/
  EXPERIMENT_PROTOCOLS_ADD_FAILED = "EXPERIMENT_PROTOCOLS_ADD_FAILED", // Failed to add protocols
  EXPERIMENT_PROTOCOLS_REMOVE_FAILED = "EXPERIMENT_PROTOCOLS_REMOVE_FAILED", // Failed to remove protocol
  EXPERIMENT_PROTOCOLS_LIST_FAILED = "EXPERIMENT_PROTOCOLS_LIST_FAILED", // Failed to list protocols

  // ==================== Domain Operations - Experiments Locations ====================
  // Location: src/experiments/application/use-cases/
  EXPERIMENT_LOCATIONS_CREATE_FAILED = "EXPERIMENT_LOCATIONS_CREATE_FAILED", // Failed to create locations
  EXPERIMENT_LOCATIONS_UPDATE_FAILED = "EXPERIMENT_LOCATIONS_UPDATE_FAILED", // Failed to update locations
  EXPERIMENT_LOCATIONS_LIST_FAILED = "EXPERIMENT_LOCATIONS_LIST_FAILED", // Failed to list locations

  // ==================== Domain Operations - Experiments Members ====================
  // Location: src/experiments/application/use-cases/
  EXPERIMENT_MEMBERS_ADD_FAILED = "EXPERIMENT_MEMBERS_ADD_FAILED", // Failed to add members
  EXPERIMENT_MEMBERS_REMOVE_FAILED = "EXPERIMENT_MEMBERS_REMOVE_FAILED", // Failed to remove members
  EXPERIMENT_MEMBERS_UPDATE_FAILED = "EXPERIMENT_MEMBERS_UPDATE_FAILED", // Failed to update member role

  // ==================== Domain Operations - Experiments Visualizations ====================
  // Location: src/experiments/application/use-cases/
  EXPERIMENT_VISUALIZATIONS_CREATE_FAILED = "EXPERIMENT_VISUALIZATIONS_CREATE_FAILED", // Failed to create visualization
  EXPERIMENT_VISUALIZATIONS_UPDATE_FAILED = "EXPERIMENT_VISUALIZATIONS_UPDATE_FAILED", // Failed to update visualization
  EXPERIMENT_VISUALIZATIONS_DELETE_FAILED = "EXPERIMENT_VISUALIZATIONS_DELETE_FAILED", // Failed to delete visualization
  EXPERIMENT_VISUALIZATIONS_LIST_FAILED = "EXPERIMENT_VISUALIZATIONS_LIST_FAILED", // Failed to list visualizations

  // ==================== Domain Operations - Experiments Annotations ====================
  // Location: src/experiments/application/use-cases/
  EXPERIMENT_ANNOTATIONS_ADD_FAILED = "EXPERIMENT_ANNOTATIONS_ADD_FAILED", // Failed to add annotations
  EXPERIMENT_ANNOTATIONS_UPDATE_FAILED = "EXPERIMENT_ANNOTATIONS_UPDATE_FAILED", // Failed to update annotation
  EXPERIMENT_ANNOTATIONS_DELETE_FAILED = "EXPERIMENT_ANNOTATIONS_DELETE_FAILED", // Failed to delete annotations

  // ==================== Services ====================
  // Location: src/experiments/application/services/
  EMBARGO_PROCESSING_FAILED = "EMBARGO_PROCESSING_FAILED", // Failed to process embargoes
}
