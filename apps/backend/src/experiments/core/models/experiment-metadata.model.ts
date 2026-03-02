/**
 * Internal DTO for experiment metadata.
 *
 * Maps 1-to-1 to the Databricks table:
 *   metadata_id   STRING   (PK)
 *   experiment_id STRING
 *   metadata      VARIANT  (arbitrary JSON)
 *   created_by    STRING
 *   created_at    TIMESTAMP
 *   updated_at    TIMESTAMP
 */
export interface ExperimentMetadataDto {
  metadataId: string;
  experimentId: string;
  metadata: Record<string, unknown>;
  createdBy: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface CreateExperimentMetadataDto {
  metadata: Record<string, unknown>;
}

export interface UpdateExperimentMetadataDto {
  metadata: Record<string, unknown>;
}
