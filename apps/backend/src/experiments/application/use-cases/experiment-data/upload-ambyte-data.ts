import { Inject, Injectable, Logger } from "@nestjs/common";
import { z } from "zod";

import { AppError, Result, failure, success } from "../../../../common/utils/fp-utils";
import { DATABRICKS_PORT } from "../../../core/ports/databricks.port";
import type { DatabricksPort } from "../../../core/ports/databricks.port";
import { ExperimentRepository } from "../../../core/repositories/experiment.repository";

export interface UploadAmbyteFilesResponse {
  uploadId?: string;
  files: { fileName: string; fileId: string; filePath: string }[];
}

@Injectable()
export class UploadAmbyteDataUseCase {
  private readonly logger = new Logger(UploadAmbyteDataUseCase.name);

  constructor(
    private readonly experimentRepository: ExperimentRepository,
    @Inject(DATABRICKS_PORT) private readonly databricksPort: DatabricksPort,
  ) {}

  /**
   * Upload multiple Ambyte data files to Databricks
   *
   * Accepts data files that follow the Ambyte folder structure:
   * - An "Ambyte_X" folder containing numbered subfolders (1, 2, 3, 4)
   * - OR one of the individual numbered subfolders (1, 2, 3, 4)
   * - OR individual data files in the format YYYYMMDD-HHMMSS_.txt
   *
   * The expected folder structure is:
   * Ambyte_X/
   * ├── 1/
   * │   ├── YYYYMMDD-HHMMSS_.txt
   * │   └── ...
   * ├── 2/
   * │   ├── YYYYMMDD-HHMMSS_.txt
   * │   └── ...
   * ├── 3/
   * │   ├── YYYYMMDD-HHMMSS_.txt
   * │   └── ...
   * ├── 4/
   * │   ├── YYYYMMDD-HHMMSS_.txt
   * │   └── ...
   *
   * Note: Configuration files and .DS_Store files are ignored.
   *
   * @param experimentId - ID of the experiment
   * @param userId - ID of the user uploading the data
   * @param files - Array of files with name and buffer
   * @returns Result containing information about the uploaded files
   */
  async execute(
    experimentId: string,
    userId: string,
    files: { originalname: string; buffer: Buffer }[],
  ): Promise<Result<UploadAmbyteFilesResponse>> {
    this.logger.log(
      `Uploading ${files.length} Ambyte data files to experiment ${experimentId} by user ${userId}`,
    );

    if (files.length === 0) {
      return failure(AppError.badRequest("No files uploaded"));
    }

    // Check if the experiment exists
    const experimentResult = await this.experimentRepository.findOne(experimentId);
    if (experimentResult.isFailure()) {
      return experimentResult;
    }

    const experiment = experimentResult.value;
    if (!experiment) {
      return failure(AppError.badRequest(`Experiment with ID ${experimentId} not found`));
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

    // Process each file in sequence
    const results: { fileName: string; fileId: string; filePath: string }[] = [];
    const errors: { fileName: string; error: string }[] = [];

    for (const file of files) {
      // Validate file name
      if (!this.validateFileName(file.originalname)) {
        errors.push({
          fileName: file.originalname,
          error:
            'Invalid Ambyte data file. Expected either an "Ambyte_X" folder, a numbered subfolder (1, 2, 3, 4), or a data file in the format YYYYMMDD-HHMMSS_.txt.',
        });
        continue;
      }

      // Upload the file to Databricks - using 'ambyte' as the source type
      const uploadResult = await this.databricksPort.uploadFile(
        experimentId,
        experiment.name,
        "ambyte",
        file.originalname,
        file.buffer,
      );

      if (uploadResult.isSuccess()) {
        results.push({
          fileName: file.originalname,
          fileId: uploadResult.value.fileId,
          filePath: uploadResult.value.filePath,
        });

        this.logger.log(
          `Successfully uploaded Ambyte data file "${file.originalname}" to experiment ${experiment.name} (${experimentId})`,
        );
      } else {
        errors.push({
          fileName: file.originalname,
          error: uploadResult.error.message,
        });
      }
    }

    // Log the results
    this.logger.log(`Successfully processed ${results.length} files, with ${errors.length} errors`);

    // Trigger pipeline update after successful file upload
    if (results.length > 0) {
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
    }

    if (results.length > 0) {
      return success({
        files: results,
      });
    }

    // All files failed
    return failure(
      AppError.badRequest(
        `Failed to upload Ambyte data files: ${errors.map((e) => `${e.fileName}: ${e.error}`).join(", ")}`,
      ),
    );
  }

  /**
   * Validate the Ambyte file name using Zod
   * Validates that the file is either:
   * 1. An "Ambyte_X" folder (e.g., Ambyte_1, Ambyte_2)
   * 2. One of the numbered subfolders (1, 2, 3, 4)
   * 3. Individual text files with the expected date format (YYYYMMDD-HHMMSS_.txt)
   */
  private validateFileName(fileName: string): boolean {
    // Create a schema that combines all the validation rules
    const fileNameSchema = z
      .string()
      // Basic validation
      .min(1, "File name cannot be empty")
      .refine((name) => !name.includes(".DS_Store"), "DS_Store files are not allowed")
      // Pattern validation
      .refine((name) => {
        // Ambyte_X folder pattern
        const isAmbyteFolder = /^Ambyte_\d{1,3}$/i.test(name);

        // Numbered folder pattern (1, 2, 3, 4)
        const isNumberedFolder = /^[1-4]$/.test(name);

        // Data file pattern (with or without folder prefix)
        const isDataFile = /^(?:([1-4])\/)?20\d{6}-\d{6}_\.txt$/.test(name);

        return isAmbyteFolder || isNumberedFolder || isDataFile;
      }, "Invalid Ambyte file name format");

    // Perform validation and return result
    return fileNameSchema.safeParse(fileName).success;
  }
}
