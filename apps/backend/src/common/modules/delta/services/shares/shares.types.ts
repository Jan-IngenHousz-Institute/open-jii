/**
 * Common types for Delta Sharing API responses
 */

/**
 * Standard error response structure
 */
export interface DeltaErrorResponse {
  errorCode: string;
  message: string;
}

/**
 * Share object from Delta Sharing protocol
 */
export interface Share {
  name: string;
  id?: string; // Optional UUID
}

/**
 * Schema object from Delta Sharing protocol
 */
export interface Schema {
  name: string;
  share: string;
}

/**
 * Table object from Delta Sharing protocol
 */
export interface Table {
  name: string;
  schema: string;
  share: string;
  shareId?: string; // Optional UUID
  id?: string; // Optional UUID
}

/**
 * Response for listing shares
 */
export interface ListSharesResponse {
  items: Share[];
  nextPageToken?: string;
}

/**
 * Response for getting a single share
 */
export interface GetShareResponse {
  share: Share;
}

/**
 * Response for listing schemas in a share
 */
export interface ListSchemasResponse {
  items: Schema[];
  nextPageToken?: string;
}

/**
 * Response for listing tables in a schema
 */
export interface ListTablesResponse {
  items: Table[];
  nextPageToken?: string;
}

/**
 * Protocol information from Delta Sharing table metadata
 */
export interface DeltaProtocol {
  minReaderVersion: number;
}

/**
 * Table metadata format information
 */
export interface DeltaFormat {
  provider: string; // Usually "parquet"
}

/**
 * Table metadata from Delta Sharing
 */
export interface DeltaMetadata {
  id: string;
  format: DeltaFormat;
  schemaString: string; // JSON string containing table schema
  partitionColumns: string[];
  configuration?: Record<string, string>;
  version?: number;
}

/**
 * File information from table query
 */
export interface DeltaFile {
  url: string;
  id: string;
  partitionValues: Record<string, string>;
  size: number;
  stats?: string; // JSON string with file statistics
  version?: number;
  timestamp?: number;
  expirationTimestamp?: number;
}

/**
 * Query parameters for table data requests
 */
export interface TableQueryRequest {
  predicateHints?: string[];
  jsonPredicateHints?: string;
  limitHint?: number;
  version?: number;
  timestamp?: string;
  startingVersion?: number;
  endingVersion?: number;
}

/**
 * Response line types for NDJSON responses
 */
export interface ProtocolLine {
  protocol: DeltaProtocol;
}

export interface MetadataLine {
  metaData: DeltaMetadata;
}

export interface FileLine {
  file: DeltaFile;
}

/**
 * Union type for all possible response lines
 */
export type DeltaResponseLine = ProtocolLine | MetadataLine | FileLine;

/**
 * Parsed table metadata response
 */
export interface TableMetadataResponse {
  protocol: DeltaProtocol;
  metadata: DeltaMetadata;
  version: number;
}

/**
 * Parsed table query response
 */
export interface TableQueryResponse {
  protocol: DeltaProtocol;
  metadata: DeltaMetadata;
  files: DeltaFile[];
  version: number;
}
