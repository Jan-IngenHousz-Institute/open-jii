// ==================== Controller Layer - HTTP Status Aligned ====================
// Location: src/*/presentation/
// Controllers use error codes that align with HTTP status codes they return.
export const BAD_REQUEST = "BAD_REQUEST"; // Invalid request data (400)
export const UNAUTHORIZED = "UNAUTHORIZED"; // Authentication required (401)
export const FORBIDDEN = "FORBIDDEN"; // Access denied (403)
export const NOT_FOUND = "NOT_FOUND"; // Resource not found (404)
export const CONFLICT = "CONFLICT"; // Resource conflict (409)
export const UNPROCESSABLE_ENTITY = "UNPROCESSABLE_ENTITY"; // Validation failed (422)
export const INTERNAL_SERVER_ERROR = "INTERNAL_SERVER_ERROR"; // Server error (500)
export const SERVICE_UNAVAILABLE = "SERVICE_UNAVAILABLE"; // External service unavailable (503)

// ==================== Guards & Authentication ====================
// Location: src/common/guards/
export const HMAC_AUTHENTICATION_FAILED = "HMAC_AUTHENTICATION_FAILED"; // HMAC verification failed
export const API_KEY_INVALID = "API_KEY_INVALID"; // API key validation failed
export const AUTH_TOKEN_INVALID = "AUTH_TOKEN_INVALID"; // Auth token validation failed
export const MISSING_CREDENTIALS = "MISSING_CREDENTIALS"; // Required auth credentials missing

// ==================== Configuration ====================
// Location: src/common/modules/*/services/config/
export const CONFIG_INVALID = "CONFIG_INVALID"; // Generic config validation failed
export const DATABRICKS_CONFIG_INVALID = "DATABRICKS_CONFIG_INVALID"; // Databricks config specific
export const AWS_CONFIG_INVALID = "AWS_CONFIG_INVALID"; // AWS config specific
export const EMAIL_CONFIG_INVALID = "EMAIL_CONFIG_INVALID"; // Email config specific
export const ANALYTICS_CONFIG_INVALID = "ANALYTICS_CONFIG_INVALID"; // Analytics config specific

// ==================== Databricks Operations ====================
// Location: src/common/modules/databricks/
export const DATABRICKS_AUTH_FAILED = "DATABRICKS_AUTH_FAILED"; // Authentication with Databricks failed
export const DATABRICKS_SQL_FAILED = "DATABRICKS_SQL_FAILED"; // SQL query/execution failed
export const DATABRICKS_JOB_FAILED = "DATABRICKS_JOB_FAILED"; // Job trigger/execution failed
export const DATABRICKS_PIPELINE_FAILED = "DATABRICKS_PIPELINE_FAILED"; // Pipeline operations failed
export const DATABRICKS_FILE_FAILED = "DATABRICKS_FILE_FAILED"; // File upload/delete/lookup failed
export const DATABRICKS_VOLUME_FAILED = "DATABRICKS_VOLUME_FAILED"; // Volume create/get failed
export const DATABRICKS_TABLE_FAILED = "DATABRICKS_TABLE_FAILED"; // Table operations failed
export const DATABRICKS_WORKSPACE_FAILED = "DATABRICKS_WORKSPACE_FAILED"; // Workspace operations failed
export const DATABRICKS_REFRESH_FAILED = "DATABRICKS_REFRESH_FAILED"; // Refresh operations failed

// ==================== AWS Operations ====================
// Location: src/common/modules/aws/
export const AWS_LOCATION_FAILED = "AWS_LOCATION_FAILED"; // AWS Location Service failed
export const AWS_OPERATION_FAILED = "AWS_OPERATION_FAILED"; // Other AWS operations failed

// ==================== Email Operations ====================
// Location: src/common/modules/email/
export const EMAIL_SEND_FAILED = "EMAIL_SEND_FAILED"; // Email sending failed

// ==================== Analytics & Feature Flags ====================
// Location: src/common/modules/analytics/
export const ANALYTICS_INIT_FAILED = "ANALYTICS_INIT_FAILED"; // Analytics/PostHog initialization failed
export const FEATURE_FLAG_FAILED = "FEATURE_FLAG_FAILED"; // Feature flag check failed

// ==================== Domain Operations - Macros ====================
// Location: src/macros/application/use-cases/
export const MACRO_CREATE_FAILED = "MACRO_CREATE_FAILED"; // Failed to create macro
export const MACRO_UPDATE_FAILED = "MACRO_UPDATE_FAILED"; // Failed to update macro
export const MACRO_DELETE_FAILED = "MACRO_DELETE_FAILED"; // Failed to delete macro
export const MACRO_NOT_FOUND = "MACRO_NOT_FOUND"; // Macro not found

// ==================== Domain Operations - Protocols ====================
// Location: src/protocols/application/use-cases/
export const PROTOCOL_CREATE_FAILED = "PROTOCOL_CREATE_FAILED"; // Failed to create protocol
export const PROTOCOL_UPDATE_FAILED = "PROTOCOL_UPDATE_FAILED"; // Failed to update protocol
export const PROTOCOL_DELETE_FAILED = "PROTOCOL_DELETE_FAILED"; // Failed to delete protocol
export const PROTOCOL_NOT_FOUND = "PROTOCOL_NOT_FOUND"; // Protocol not found
export const PROTOCOL_ASSIGNED = "PROTOCOL_ASSIGNED"; // Cannot modify assigned protocol

// ==================== Domain Operations - Users ====================
// Location: src/users/application/use-cases/
export const USER_CREATE_FAILED = "USER_CREATE_FAILED"; // Failed to create user
export const USER_UPDATE_FAILED = "USER_UPDATE_FAILED"; // Failed to update user
export const USER_DELETE_FAILED = "USER_DELETE_FAILED"; // Failed to delete user
export const USER_NOT_FOUND = "USER_NOT_FOUND"; // User not found
export const USER_PROFILE_NOT_FOUND = "USER_PROFILE_NOT_FOUND"; // User profile not found
export const USER_IS_ONLY_ADMIN = "USER_IS_ONLY_ADMIN"; // Cannot delete sole admin

// ==================== Domain Operations - Experiments Core ====================
// Location: src/experiments/application/use-cases/
export const EXPERIMENT_CREATE_FAILED = "EXPERIMENT_CREATE_FAILED"; // Failed to create experiment
export const EXPERIMENT_UPDATE_FAILED = "EXPERIMENT_UPDATE_FAILED"; // Failed to update experiment
export const EXPERIMENT_DELETE_FAILED = "EXPERIMENT_DELETE_FAILED"; // Failed to delete experiment
export const EXPERIMENT_NOT_FOUND = "EXPERIMENT_NOT_FOUND"; // Experiment not found
export const EXPERIMENT_DUPLICATE_NAME = "EXPERIMENT_DUPLICATE_NAME"; // Name already exists
export const EXPERIMENT_INVALID_STATE = "EXPERIMENT_INVALID_STATE"; // Invalid state for operation

// ==================== Domain Operations - Experiments Data ====================
// Location: src/experiments/application/use-cases/
export const EXPERIMENT_DATA_UPLOAD_FAILED = "EXPERIMENT_DATA_UPLOAD_FAILED"; // Data upload failed
export const EXPERIMENT_DATA_DOWNLOAD_FAILED = "EXPERIMENT_DATA_DOWNLOAD_FAILED"; // Data download failed
export const EXPERIMENT_SCHEMA_NOT_READY = "EXPERIMENT_SCHEMA_NOT_READY"; // Schema not provisioned

// ==================== Domain Operations - Experiments Protocols ====================
// Location: src/experiments/application/use-cases/
export const EXPERIMENT_PROTOCOLS_ADD_FAILED = "EXPERIMENT_PROTOCOLS_ADD_FAILED"; // Failed to add protocols
export const EXPERIMENT_PROTOCOLS_REMOVE_FAILED = "EXPERIMENT_PROTOCOLS_REMOVE_FAILED"; // Failed to remove protocol
export const EXPERIMENT_PROTOCOLS_LIST_FAILED = "EXPERIMENT_PROTOCOLS_LIST_FAILED"; // Failed to list protocols

// ==================== Domain Operations - Experiments Locations ====================
// Location: src/experiments/application/use-cases/
export const EXPERIMENT_LOCATIONS_CREATE_FAILED = "EXPERIMENT_LOCATIONS_CREATE_FAILED"; // Failed to create locations
export const EXPERIMENT_LOCATIONS_UPDATE_FAILED = "EXPERIMENT_LOCATIONS_UPDATE_FAILED"; // Failed to update locations
export const EXPERIMENT_LOCATIONS_LIST_FAILED = "EXPERIMENT_LOCATIONS_LIST_FAILED"; // Failed to list locations

// ==================== Domain Operations - Experiments Members ====================
// Location: src/experiments/application/use-cases/
export const EXPERIMENT_MEMBERS_ADD_FAILED = "EXPERIMENT_MEMBERS_ADD_FAILED"; // Failed to add members
export const EXPERIMENT_MEMBERS_REMOVE_FAILED = "EXPERIMENT_MEMBERS_REMOVE_FAILED"; // Failed to remove members
export const EXPERIMENT_MEMBERS_UPDATE_FAILED = "EXPERIMENT_MEMBERS_UPDATE_FAILED"; // Failed to update member role

// ==================== Domain Operations - Experiments Visualizations ====================
// Location: src/experiments/application/use-cases/
export const EXPERIMENT_VISUALIZATIONS_CREATE_FAILED = "EXPERIMENT_VISUALIZATIONS_CREATE_FAILED"; // Failed to create visualization
export const EXPERIMENT_VISUALIZATIONS_UPDATE_FAILED = "EXPERIMENT_VISUALIZATIONS_UPDATE_FAILED"; // Failed to update visualization
export const EXPERIMENT_VISUALIZATIONS_DELETE_FAILED = "EXPERIMENT_VISUALIZATIONS_DELETE_FAILED"; // Failed to delete visualization
export const EXPERIMENT_VISUALIZATIONS_LIST_FAILED = "EXPERIMENT_VISUALIZATIONS_LIST_FAILED"; // Failed to list visualizations

// ==================== Domain Operations - Experiments Annotations ====================
// Location: src/experiments/application/use-cases/
export const EXPERIMENT_ANNOTATIONS_ADD_FAILED = "EXPERIMENT_ANNOTATIONS_ADD_FAILED"; // Failed to add annotations
export const EXPERIMENT_ANNOTATIONS_UPDATE_FAILED = "EXPERIMENT_ANNOTATIONS_UPDATE_FAILED"; // Failed to update annotation
export const EXPERIMENT_ANNOTATIONS_DELETE_FAILED = "EXPERIMENT_ANNOTATIONS_DELETE_FAILED"; // Failed to delete annotations

// ==================== Services ====================
// Location: src/experiments/application/services/
export const EMBARGO_PROCESSING_FAILED = "EMBARGO_PROCESSING_FAILED"; // Failed to process embargoes
