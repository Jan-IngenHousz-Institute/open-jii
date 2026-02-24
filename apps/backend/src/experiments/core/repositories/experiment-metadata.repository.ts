import { Injectable, Logger } from "@nestjs/common";

import { Result, success } from "../../../common/utils/fp-utils";
import type {
  ExperimentMetadataDto,
  CreateExperimentMetadataDto,
  UpdateExperimentMetadataDto,
} from "../models/experiment-metadata.model";

/**
 * Repository for experiment metadata operations.
 * Currently uses in-memory storage as a placeholder.
 * Can be swapped for Postgres, Databricks, or other storage later.
 */
@Injectable()
export class ExperimentMetadataRepository {
  private readonly logger = new Logger(ExperimentMetadataRepository.name);

  // Temporary in-memory storage - replace with actual database implementation
  private readonly storage = new Map<string, ExperimentMetadataDto>();

  findByExperimentId(experimentId: string): Result<ExperimentMetadataDto | null> {
    this.logger.debug({
      msg: "Finding metadata by experiment ID",
      experimentId,
    });

    const metadata = Array.from(this.storage.values()).find((m) => m.experimentId === experimentId);

    return success(metadata ?? null);
  }

  create(
    experimentId: string,
    dto: CreateExperimentMetadataDto,
    createdBy: string,
  ): Result<ExperimentMetadataDto> {
    this.logger.debug({
      msg: "Creating metadata for experiment",
      experimentId,
      columnCount: dto.columns.length,
      rowCount: dto.rows.length,
    });

    const now = new Date();
    const metadata: ExperimentMetadataDto = {
      id: crypto.randomUUID(),
      experimentId,
      columns: dto.columns,
      rows: dto.rows,
      identifierColumnId: dto.identifierColumnId ?? null,
      experimentQuestionId: dto.experimentQuestionId ?? null,
      createdBy,
      createdAt: now,
      updatedAt: now,
    };

    this.storage.set(metadata.id, metadata);

    return success(metadata);
  }

  update(id: string, dto: UpdateExperimentMetadataDto): Result<ExperimentMetadataDto | null> {
    this.logger.debug({
      msg: "Updating metadata",
      id,
    });

    const existing = this.storage.get(id);
    if (!existing) {
      return success(null);
    }

    const updated: ExperimentMetadataDto = {
      ...existing,
      ...(dto.columns && { columns: dto.columns }),
      ...(dto.rows && { rows: dto.rows }),
      ...(dto.identifierColumnId !== undefined && { identifierColumnId: dto.identifierColumnId }),
      ...(dto.experimentQuestionId !== undefined && {
        experimentQuestionId: dto.experimentQuestionId,
      }),
      updatedAt: new Date(),
    };

    this.storage.set(id, updated);

    return success(updated);
  }

  delete(id: string): Result<boolean> {
    this.logger.debug({
      msg: "Deleting metadata",
      id,
    });

    const deleted = this.storage.delete(id);
    return success(deleted);
  }

  deleteByExperimentId(experimentId: string): Result<boolean> {
    this.logger.debug({
      msg: "Deleting metadata by experiment ID",
      experimentId,
    });

    const metadata = Array.from(this.storage.values()).find((m) => m.experimentId === experimentId);

    if (metadata) {
      this.storage.delete(metadata.id);
      return success(true);
    }

    return success(false);
  }
}
