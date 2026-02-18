import { Injectable, Logger } from "@nestjs/common";
import { Readable } from "stream";

import { Result, success } from "../../../../common/utils/fp-utils";
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
    const filename = `${tableName}-export-${exportId}${ext ? `.${ext}` : ""}`;

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
