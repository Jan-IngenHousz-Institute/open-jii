import type {
  MetadataColumn,
  MetadataRow,
  ExperimentMetadata,
  UpsertExperimentMetadataBody,
} from "@repo/api";

// Re-export API types for use in backend
export type { MetadataColumn, MetadataRow };

// Internal DTO with Date objects (for repository layer)
export interface ExperimentMetadataDto {
  id: string;
  experimentId: string;
  columns: MetadataColumn[];
  rows: MetadataRow[];
  createdBy: string;
  createdByName?: string;
  createdAt: Date;
  updatedAt: Date;
}

// API response type (with string dates)
export type ExperimentMetadataResponse = ExperimentMetadata;

export type CreateExperimentMetadataDto = UpsertExperimentMetadataBody;

export type UpdateExperimentMetadataDto = Partial<CreateExperimentMetadataDto>;

// Helper to convert internal DTO to API response
export function toApiResponse(dto: ExperimentMetadataDto): ExperimentMetadataResponse {
  return {
    ...dto,
    createdAt: dto.createdAt.toISOString(),
    updatedAt: dto.updatedAt.toISOString(),
  };
}
