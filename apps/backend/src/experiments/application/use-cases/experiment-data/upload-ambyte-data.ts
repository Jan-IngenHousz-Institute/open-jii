import { Inject, Injectable, Logger } from "@nestjs/common";
import { z } from "zod";

import { AppError, Result, failure, success } from "../../../../common/utils/fp-utils";
import { streamToBuffer } from "../../../../common/utils/stream-utils";
import { ExperimentDto } from "../../../core/models/experiment.model";
import { DATABRICKS_PORT } from "../../../core/ports/databricks.port";
import type { DatabricksPort } from "../../../core/ports/databricks.port";
import { ExperimentRepository } from "../../../core/repositories/experiment.repository";

export interface UploadAmbyteFilesResponse {
  uploadId?: string;
  files: { fileName: string; filePath: string }[];
}

@Injectable()
export class UploadAmbyteDataUseCase {
  private readonly logger = new Logger(UploadAmbyteDataUseCase.name);

  static readonly MAX_FILE_SIZE = 10 * 1024 * 1024;
  static readonly MAX_FILE_COUNT = 1000;
  static readonly UPLOADS_VOLUME_NAME = "data-uploads";

  constructor(
    private readonly experimentRepository: ExperimentRepository,
    @Inject(DATABRICKS_PORT) private readonly databricksPort: DatabricksPort,
  ) {}

  /**
   * Prepares the environment for file uploads by ensuring the required volume exists
   * This method should be called before starting the file upload process
   *
   * @param experimentId - ID of the experiment
   * @param userId - ID of the user making the request
   * @returns Result indicating success or failure of the preparation
   */
  async preexecute(
    experimentId: string,
    userId: string,
  ): Promise<
    Result<{
      experiment: ExperimentDto;
      volumeName: string;
      volumeExists: boolean;
      volumeCreated: boolean;
      directoryName: string;
    }>
  > {
    this.logger.log(`Preparing upload environment for experiment ${experimentId}`);

    // Check access and get experiment
    const accessResult = await this.experimentRepository.checkAccess(experimentId, userId);

    if (accessResult.isFailure()) {
      return failure(AppError.internal("Failed to verify experiment access"));
    }

    const { experiment, hasAccess } = accessResult.value;

    if (!experiment) {
      return failure(AppError.notFound("Experiment not found"));
    }

    if (!hasAccess) {
      return failure(AppError.forbidden("Access denied to this experiment"));
    }

    if (experiment.status === "archived") {
      return failure(AppError.forbidden("Cannot upload data to archived experiments"));
    }

    if (!experiment.schemaName) {
      return failure(AppError.internal("Experiment schema not provisioned"));
    }

    // Generate unique directory name
    // Format: upload_YYYYMMDD_HHMMSS
    const now = new Date();
    const timestamp = now.toISOString().replace(/[-:]/g, "").replace("T", "_").split(".")[0];
    const directoryName = `upload_${timestamp}`;

    this.logger.log(`Generated upload directory name: ${directoryName}`);

    // Construct the volume name
    const volumeName = UploadAmbyteDataUseCase.UPLOADS_VOLUME_NAME;

    // Check if volume already exists
    const getVolumeResult = await this.databricksPort.getExperimentVolume(
      experiment.schemaName,
      volumeName,
    );

    // If volume exists, return success
    if (getVolumeResult.isSuccess()) {
      this.logger.log(`Volume "${volumeName}" already exists for schema ${experiment.schemaName}`);
      return success({
        experiment,
        volumeName,
        volumeExists: true,
        volumeCreated: false,
        directoryName,
      });
    }

    // Volume doesn't exist, create it
    this.logger.log(
      `Volume "${volumeName}" doesn't exist for schema ${experiment.schemaName}, creating it now`,
    );

    const createVolumeResult = await this.databricksPort.createExperimentVolume(
      experiment.schemaName,
      volumeName,
      `Ambyte data uploads volume for experiment ${experimentId}`,
    );

    if (createVolumeResult.isSuccess()) {
      this.logger.log(
        `Successfully created volume "${volumeName}" for schema ${experiment.schemaName}`,
      );
      return success({
        experiment,
        volumeName,
        volumeExists: false,
        volumeCreated: true,
        directoryName,
      });
    } else {
      this.logger.error(
        `Failed to create volume "${volumeName}" for schema ${experiment.schemaName}: ${createVolumeResult.error.message}`,
      );
      return failure(createVolumeResult.error);
    }
  }

  /**
   * Process a single file upload by streaming it directly
   */
  async execute(
    file: { filename: string; encoding: string; mimetype: string; stream: NodeJS.ReadableStream },
    experiment: ExperimentDto,
    sourceType: string | undefined,
    directoryName: string,
    successfulUploads: { fileName: string; filePath: string }[],
    errors: { fileName: string; error: string }[],
  ): Promise<void> {
    this.logger.log(
      `Starting to process file stream: ${file.filename}, source type: ${sourceType}`,
    );

    // Validate the file name
    if (!this.validateFileName(file.filename)) {
      errors.push({
        fileName: file.filename,
        error:
          'Invalid file format. Expected .txt files with either full paths like "Ambyte_N/*.txt" or "Ambyte_N/1-4/*.txt", or plain .txt filenames.',
      });

      this.logger.warn(`Skipping invalid file: ${file.filename}`);
      // Consume the stream to allow busboy to continue processing the form
      file.stream.resume();
      return;
    }

    // Trim the filename to start with Ambyte_N/...
    const trimmedFileName = this.trimFileName(file.filename);
    this.logger.debug(`Trimmed filename from "${file.filename}" to "${trimmedFileName}"`);

    if (!sourceType) {
      this.logger.error(`Source type is undefined for file: ${file.filename}`);
      errors.push({
        fileName: file.filename,
        error: "Source type is required",
      });
      // Consume the stream to allow busboy to continue processing the form
      file.stream.resume();
      return;
    }

    if (!experiment.schemaName) {
      this.logger.error(`Experiment ${experiment.id} has no schema name`);
      errors.push({
        fileName: file.filename,
        error: "Experiment schema not provisioned",
      });
      file.stream.resume();
      return;
    }

    // Convert stream to buffer and upload the file to Databricks
    const buffer = await streamToBuffer(file.stream, {
      maxSize: UploadAmbyteDataUseCase.MAX_FILE_SIZE,
      timeoutMs: 30000,
      logger: this.logger,
    });

    this.logger.debug(
      `Successfully converted stream to buffer for file: ${trimmedFileName}, size: ${buffer.length} bytes`,
    );

    this.logger.log(`Uploading file to Databricks: ${trimmedFileName}`);
    const uploadResult = await this.databricksPort.uploadExperimentData(
      experiment.schemaName,
      sourceType,
      directoryName,
      trimmedFileName,
      buffer,
    );

    if (uploadResult.isSuccess()) {
      successfulUploads.push({
        fileName: trimmedFileName,
        filePath: uploadResult.value.filePath,
      });

      this.logger.log(
        `Successfully uploaded Ambyte data file "${trimmedFileName}" to experiment ${experiment.id}`,
      );
    } else {
      errors.push({
        fileName: trimmedFileName,
        error: uploadResult.error.message,
      });

      this.logger.error(
        `Failed to upload file "${trimmedFileName}": ${uploadResult.error.message}`,
      );
    }

    this.logger.debug(`Completed processing for file: ${file.filename}`);
  }

  /**
   * Complete the upload process by triggering the ambyte processing job and returning results
   */
  async postexecute(
    successfulUploads: { fileName: string; filePath: string }[],
    errors: { fileName: string; error: string }[],
    experiment: ExperimentDto,
    directoryName: string,
  ): Promise<Result<UploadAmbyteFilesResponse>> {
    this.logger.log(
      `Completing upload. ${successfulUploads.length} successful, ${errors.length} errors.`,
    );

    if (successfulUploads.length === 0) {
      return failure(
        AppError.badRequest(
          `Failed to upload Ambyte data files: ${errors
            .map((e) => `${e.fileName}: ${e.error}`)
            .join(", ")}`,
        ),
      );
    }

    // Trigger ambyte processing job after successful file upload
    this.logger.log(`Triggering ambyte processing job for experiment ${experiment.id}`);

    if (!experiment.schemaName) {
      return failure(
        AppError.internal(
          `Experiment ${experiment.id} does not have a schema name. The experiment may not be fully provisioned.`,
        ),
      );
    }

    const jobResult = await this.databricksPort.triggerAmbyteProcessingJob(experiment.schemaName, {
      EXPERIMENT_ID: experiment.id,
      EXPERIMENT_NAME: experiment.name,
      YEAR_PREFIX: "2025",
      UPLOAD_DIRECTORY: directoryName,
    });

    if (jobResult.isSuccess()) {
      this.logger.log(
        `Successfully triggered ambyte processing job for experiment ${experiment.name} (${experiment.id}). Run ID: ${jobResult.value.run_id}`,
      );
    } else {
      this.logger.warn(
        `Failed to trigger ambyte processing job for experiment ${experiment.id}: ${jobResult.error.message}`,
      );
    }

    return success({
      files: successfulUploads,
    });
  }

  /**
   * Validate the Ambyte file
   * Accepts:
   * - Full paths like: someDir/Ambyte_N/*.txt or Ambyte_N/[1-4]/*.txt
   * - Plain .txt files (will be processed with constructed paths)
   */
  private validateFileName(fileName: string): boolean {
    const schema = z
      .string()
      .min(1, "File name cannot be empty")
      .max(256, "File path too long")
      .refine((name) => {
        // Check if it's a .txt file
        if (!name.toLowerCase().endsWith(".txt")) {
          return false;
        }

        // If it contains path separators, validate the full path structure
        if (name.includes("/")) {
          const validPattern = /^(?:[^/]+\/)*Ambyte_\d{1,3}\/(?:[1-4]\/)?[^/]+\.txt$/i;
          return validPattern.test(name);
        }

        // If it's just a filename without path, it's valid if it's a .txt file
        return true;
      }, "Invalid file format - must be a .txt file");

    return schema.safeParse(fileName).success;
  }

  /**
   * Processes the file name to ensure proper path structure
   * - If path exists: trims to start with Ambyte_N/...
   * - If no path: constructs appropriate path based on filename pattern
   */
  private trimFileName(fileName: string): string {
    // If the filename contains a path and matches the Ambyte pattern, trim it
    if (fileName.includes("/")) {
      const pattern = /Ambyte_\d{1,3}\/(?:[1-4]\/)?[^/]+\.txt$/i;
      const ambyteMatch = pattern.exec(fileName);
      // This should always match because validateFileName ensures it
      return ambyteMatch![0];
    }

    // No path in filename - construct one based on the pattern
    const baseFileName = fileName;

    // Check if it matches the timestamp pattern: YYYYMMDD-HHMMSS_.txt
    const timestampPattern = /^\d{8}-\d{6}_\.txt$/;
    if (timestampPattern.test(baseFileName)) {
      // For timestamp files, use unknown_ambyte/unknown_ambit/filename structure
      return `unknown_ambyte/unknown_ambit/${baseFileName}`;
    }

    // For other files, use unknown_ambyte/filename structure
    return `unknown_ambyte/${baseFileName}`;
  }
}
