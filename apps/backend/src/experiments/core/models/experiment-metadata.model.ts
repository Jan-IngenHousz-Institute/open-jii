import type { MetadataStoreCopy } from "@repo/api/domains/experiment/metadata/experiment-metadata.schema";

/** A metadata sheet as the API answers with it: the record, its id named `metadataId`. */
export interface ExperimentMetadataDto {
  metadataId: string;
  experimentId: string;
  metadata: Record<string, unknown>;
  createdBy: string;
  createdAt: Date;
  updatedAt: Date;
  storeCopy?: MetadataStoreCopy | null;
}

/** A metadata sheet with the id and times it gets in every place that keeps it. */
export interface MetadataSheetRecord {
  id: string;
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
