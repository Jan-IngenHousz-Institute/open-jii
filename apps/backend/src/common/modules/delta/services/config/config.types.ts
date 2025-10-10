/**
 * Delta Sharing Profile configuration structure
 * Based on the profile file format from Delta Sharing protocol
 */
export interface DeltaProfile {
  shareCredentialsVersion: number;
  endpoint: string;
  bearerToken: string;
  expirationTime?: string; // ISO 8601 format
}

/**
 * Configuration for Delta Sharing client
 */
export interface DeltaConfig {
  profile: DeltaProfile;
  defaultRequestTimeout: number;
  maxRetries: number;
}

/**
 * Environment variables for Delta Sharing configuration
 */
export interface DeltaEnvironmentVariables {
  DELTA_ENDPOINT?: string;
  DELTA_BEARER_TOKEN?: string;
  DELTA_PROFILE_PATH?: string; // Path to profile JSON file
  DELTA_REQUEST_TIMEOUT?: string;
  DELTA_MAX_RETRIES?: string;
}
