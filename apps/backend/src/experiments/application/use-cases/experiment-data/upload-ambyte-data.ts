import { Inject, Injectable, Logger } from "@nestjs/common";

import { UploadFileResponse } from "../../../../common/modules/databricks/services/files/files.types";
import { AppError, Result, failure, success } from "../../../../common/utils/fp-utils";
import { DATABRICKS_PORT } from "../../../core/ports/databricks.port";
import type { DatabricksPort } from "../../../core/ports/databricks.port";
import { ExperimentRepository } from "../../../core/repositories/experiment.repository";

@Injectable()
export class UploadAmbyteDataUseCase {
  private readonly logger = new Logger(UploadAmbyteDataUseCase.name);

  constructor(
    private readonly experimentRepository: ExperimentRepository,
    @Inject(DATABRICKS_PORT) private readonly databricksPort: DatabricksPort,
  ) {}

  /**
   * Upload Ambyte data file to Databricks
   *
   * Accepts data files that follow the Ambyte folder structure:
   * - An "Ambyte_X" folder containing numbered subfolders (1, 2, 3, 4)
   * - OR one of the individual numbered subfolders (1, 2, 3, 4)
   *
   * Each numbered subfolder contains date-formatted text files with readings.
   *
   * @param experimentId - ID of the experiment
   * @param userId - ID of the user uploading the data
   * @param fileName - Name of the file
   * @param fileBuffer - File contents as a buffer
   * @returns Result containing information about the uploaded file
   */
  async execute(
    experimentId: string,
    userId: string,
    fileName: string,
    fileBuffer: Buffer,
  ): Promise<Result<UploadFileResponse>> {
    this.logger.log(
      `Uploading Ambyte data file "${fileName}" to experiment ${experimentId} by user ${userId}`,
    );

    // Check if the experiment exists
    const experimentResult = await this.experimentRepository.findOne(experimentId);
    if (experimentResult.isFailure()) {
      return experimentResult;
    }

    const experiment = experimentResult.value;
    if (!experiment) {
      return failure(AppError.notFound(`Experiment with ID ${experimentId} not found`));
    }

    // Check if the user has access to the experiment
    const accessResult = await this.experimentRepository.checkAccess(experimentId, userId);

    if (accessResult.isFailure()) {
      return accessResult;
    }

    const access = accessResult.value;
    if (!access.hasAccess) {
      return failure(
        AppError.forbidden(`User ${userId} does not have access to experiment ${experimentId}`),
      );
    }

    // Validate file name
    if (!this.validateFileName(fileName)) {
      return failure(
        AppError.badRequest(
          `Invalid Ambyte data file. Expected either an "Ambyte_X" folder or one of the numbered subfolders (1, 2, 3, 4).`,
        ),
      );
    }

    // Upload the file to Databricks - using 'ambyte' as the source type
    const uploadResult = await this.databricksPort.uploadFile(
      experimentId,
      experiment.name,
      "ambyte",
      fileName,
      fileBuffer,
    );

    if (uploadResult.isFailure()) {
      return uploadResult;
    }

    this.logger.log(
      `Successfully uploaded Ambyte data file "${fileName}" to experiment ${experiment.name} (${experimentId})`,
    );

    // Trigger pipeline update after successful file upload
    try {
      this.logger.log(
        `Triggering pipeline update for experiment ${experiment.name} (${experimentId})`,
      );
      const pipelineResult = await this.databricksPort.triggerExperimentPipeline(
        experiment.name,
        experimentId,
      );

      if (pipelineResult.isSuccess()) {
        this.logger.log(
          `Successfully triggered pipeline update for experiment ${experiment.name} (${experimentId}). Update ID: ${pipelineResult.value.update_id}`,
        );
      } else {
        this.logger.warn(
          `Failed to trigger pipeline update for experiment ${experimentId}: ${pipelineResult.error.message}`,
        );
      }
    } catch (error) {
      // Log but don't fail the file upload if pipeline update fails
      this.logger.error(
        `Error triggering pipeline update for experiment ${experimentId}: ${error instanceof Error ? error.message : String(error)}`,
      );
    }

    return success(uploadResult.value);
  }

  /**
   * Validate the Ambyte file name
   * Validates that the file is either:
   * 1. An "Ambyte_X" folder
   * 2. One of the numbered subfolders (1, 2, 3, 4)
   */
  private validateFileName(fileName: string): boolean {
    if (!fileName || fileName.trim().length === 0) {
      return false;
    }

    // Remove any file extension (like .zip if it was compressed)
    const nameWithoutExtension = fileName.split(".").shift() ?? "";

    // Check if it's an Ambyte_X folder
    if (/^Ambyte_\d+$/i.test(nameWithoutExtension)) {
      return true;
    }

    // Check if it's one of the numbered subfolders (1, 2, 3, 4)
    if (/^[1-4]$/.test(nameWithoutExtension)) {
      return true;
    }

    return false;
  }
}
