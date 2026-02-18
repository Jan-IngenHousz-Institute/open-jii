import { Injectable, Logger } from "@nestjs/common";

import { Result, success } from "../../../../common/utils/fp-utils";
import type { DownloadExportDto } from "../../../core/models/experiment-data-exports.model";
import { ExperimentRepository } from "../../../core/repositories/experiment.repository";
import { ExperimentDataExportsRepository } from "../../repositories/experiment-data-exports.repository";

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
  ): Promise<Result<DownloadExportDto>> {
    this.logger.debug({
      msg: "Starting export download",
      operation: "downloadExport",
      experimentId,
      exportId,
      userId,
    });

    // Download the export file
    const downloadResult = await this.exportsRepository.downloadExport({
      experimentId,
      exportId,
    });

    if (downloadResult.isFailure()) {
      return downloadResult;
    }

    const { stream, filePath, tableName } = downloadResult.value;

    // Build a clean filename: {tableName}-export-{exportId}.{ext}
    const ext = filePath.split(".").pop();
    const prefix = tableName ? `${tableName}-export` : "export";
    const filename = `${prefix}-${exportId}${ext ? `.${ext}` : ""}`;

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
