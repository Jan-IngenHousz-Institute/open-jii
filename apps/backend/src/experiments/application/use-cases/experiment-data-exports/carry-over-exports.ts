import { Injectable, Logger } from "@nestjs/common";

import type {
  ExperimentExportCarryOverPayload,
  ExperimentExportCarryOverResponse,
} from "@repo/api/domains/experiment/export-carry-over-webhook/experiment-export-carry-over-webhook.schema";

import { Result, failure, success } from "../../../../common/utils/fp-utils";
import { ExperimentDataExportsRepository } from "../../../core/repositories/experiment-data-exports.repository";

/**
 * Records the exports the one-off carry-over copied from the old export volume, so
 * they appear in the export list until they expire like any other.
 */
@Injectable()
export class CarryOverExportsUseCase {
  private readonly logger = new Logger(CarryOverExportsUseCase.name);

  constructor(private readonly exportsRepository: ExperimentDataExportsRepository) {}

  async execute(
    payload: ExperimentExportCarryOverPayload,
  ): Promise<Result<ExperimentExportCarryOverResponse>> {
    const recorded = await this.exportsRepository.insertCarriedOver(
      payload.exports.map((record) => ({
        id: record.exportId,
        experimentId: record.experimentId,
        tableName: record.tableName,
        format: record.format,
        anonymizeContributors: record.anonymizeContributors,
        createdBy: record.createdBy,
        jobRunId: record.jobRunId,
        rowCount: record.rowCount,
        parts: record.parts,
        createdAt: new Date(record.createdAt),
        completedAt: new Date(record.completedAt),
      })),
    );

    if (recorded.isFailure()) {
      return failure(recorded.error);
    }

    this.logger.log({
      msg: "Recorded carried-over exports",
      operation: "carryOverExports",
      received: payload.exports.length,
      imported: recorded.value,
    });

    return success({ success: true, imported: recorded.value });
  }
}
