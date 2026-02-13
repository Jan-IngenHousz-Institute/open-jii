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

  async findByExperimentId(experimentId: string): Promise<Result<ExperimentMetadataDto | null>> {
    this.logger.debug({
      msg: "Finding metadata by experiment ID",
      experimentId,
    });

    const metadata = Array.from(this.storage.values()).find(
      (m) => m.experimentId === experimentId
    );

    return success(metadata ?? null);
  }

  async create(
    experimentId: string,
    dto: CreateExperimentMetadataDto,
    createdBy: string,
  ): Promise<Result<ExperimentMetadataDto>> {
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
      createdBy,
      createdAt: now,
      updatedAt: now,
    };

    this.storage.set(metadata.id, metadata);

    return success(metadata);
  }

  async update(
    id: string,
    dto: UpdateExperimentMetadataDto,
  ): Promise<Result<ExperimentMetadataDto | null>> {
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
      updatedAt: new Date(),
    };

    this.storage.set(id, updated);

    return success(updated);
  }

  async delete(id: string): Promise<Result<boolean>> {
    this.logger.debug({
      msg: "Deleting metadata",
      id,
    });

    const deleted = this.storage.delete(id);
    return success(deleted);
  }

  async deleteByExperimentId(experimentId: string): Promise<Result<boolean>> {
    this.logger.debug({
      msg: "Deleting metadata by experiment ID",
      experimentId,
    });

    const metadata = Array.from(this.storage.values()).find(
      (m) => m.experimentId === experimentId
    );

    if (metadata) {
      this.storage.delete(metadata.id);
      return success(true);
    }

    return success(false);
  }
}
