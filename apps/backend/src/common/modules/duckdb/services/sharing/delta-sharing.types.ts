/** Subset of the Delta Sharing protocol the DuckDB read engine consumes. */

export interface DeltaProtocol {
  minReaderVersion: number;
}

export interface DeltaMetadata {
  id: string;
  format: { provider: string };
  schemaString: string;
  partitionColumns: string[];
  configuration?: Record<string, string>;
}

/** One data file: pre-signed URL plus pruning stats. */
export interface DeltaFile {
  url: string;
  id: string;
  partitionValues: Record<string, string>;
  size: number;
  /** JSON blob with numRecords/minValues/maxValues, when the server sends it. */
  stats?: string;
  expirationTimestamp?: number;
}

export interface TableQueryRequest {
  predicateHints?: string[];
  limitHint?: number;
}

export interface TableQueryResponse {
  protocol: DeltaProtocol;
  metadata: DeltaMetadata;
  files: DeltaFile[];
  version: number;
}

/** Parsed min/max stats used for client-side file pruning. */
export interface DeltaFileStats {
  numRecords?: number;
  minValues?: Record<string, unknown>;
  maxValues?: Record<string, unknown>;
}

export type DeltaResponseLine =
  | { protocol: DeltaProtocol }
  | { metaData: DeltaMetadata }
  | { file: DeltaFile };
