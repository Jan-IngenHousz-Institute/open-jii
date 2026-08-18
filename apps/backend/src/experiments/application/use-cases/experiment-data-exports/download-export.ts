import { Injectable, Logger } from "@nestjs/common";
import { Readable } from "stream";

import { ErrorCodes } from "../../../../common/utils/error-codes";
import { Result, AppError, failure, success } from "../../../../common/utils/fp-utils";
import { buildExportFilename } from "../../../core/export-filename";
import { ExperimentDataExportsRepository } from "../../../core/repositories/experiment-data-exports.repository";
import { ExperimentRepository } from "../../../core/repositories/experiment.repository";

/**
 * Use case for downloading a completed export by export ID
 * Retrieves the export metadata and streams the file to the user
 */
@Injectable()
export class DownloadExportUseCase {
  private readonly logger = new Logger(DownloadExportUseCase.name);

  constructor(
    private readonly experimentRepository: ExperimentRepository,
    private readonly exportsRepository: ExperimentDataExportsRepository,
  ) {}

  async execute(
    experimentId: string,
    exportId: string,
    userId: string,
  ): Promise<Result<{ stream: Readable; filename: string }>> {
    this.logger.debug({
      msg: "Starting export download",
      operation: "downloadExport",
      experimentId,
      exportId,
      userId,
    });

    // The experiment name is what makes the download recognisable on disk
    const experimentResult = await this.experimentRepository.findOne(experimentId);
    if (experimentResult.isFailure()) {
      return failure(experimentResult.error);
    }
    if (!experimentResult.value) {
      this.logger.warn({
        msg: "Attempt to download an export of a non-existent experiment",
        errorCode: ErrorCodes.EXPERIMENT_NOT_FOUND,
        operation: "downloadExport",
        experimentId,
        exportId,
        userId,
      });
      return failure(AppError.notFound("Experiment not found"));
    }

    // Download the export file
    const downloadResult = await this.exportsRepository.downloadExport({
      experimentId,
      exportId,
    });

    if (downloadResult.isFailure()) {
      return downloadResult;
    }

    const { stream, filePath, tableName, completedAt } = downloadResult.value;

    const filename = buildExportFilename({
      experimentName: experimentResult.value.name,
      experimentId,
      tableName,
      exportId,
      filePath,
      completedAt,
    });

    this.logger.log({
      msg: "Successfully prepared export download stream",
      operation: "downloadExport",
      experimentId,
      exportId,
      filePath,
      filename,
      status: "success",
    });

    return success({
      stream,
      filename,
    });
  }
}
