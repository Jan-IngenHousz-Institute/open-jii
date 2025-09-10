import { Inject, Injectable, Logger } from "@nestjs/common";
import { z } from "zod";

import { AppError, Result, failure, success } from "../../../../common/utils/fp-utils";
import { streamToBuffer } from "../../../../common/utils/stream-utils";
import { ExperimentDto } from "../../../core/models/experiment.model";
import { DATABRICKS_PORT } from "../../../core/ports/databricks.port";
import type { DatabricksPort } from "../../../core/ports/databricks.port";

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

  constructor(@Inject(DATABRICKS_PORT) private readonly databricksPort: DatabricksPort) {}

  /**
   * Prepares the environment for file uploads by ensuring the required volume exists
   * This method should be called before starting the file upload process
   *
   * @param experimentId - ID of the experiment
   * @param experimentName - Name of the experiment
   * @returns Result indicating success or failure of the preparation
   */
  async preexecute(
    experimentId: string,
    experimentName: string,
  ): Promise<
    Result<{
      volumeName: string;
      volumeExists: boolean;
      volumeCreated: boolean;
      directoryName: string;
    }>
  > {
    this.logger.log(
      `Preparing upload environment for experiment ${experimentName} (${experimentId})`,
    );

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
      experimentName,
      experimentId,
      volumeName,
    );

    // If volume exists, return success
    if (getVolumeResult.isSuccess()) {
      this.logger.log(`Volume "${volumeName}" already exists for experiment ${experimentName}`);
      return success({
        volumeName,
        volumeExists: true,
        volumeCreated: false,
        directoryName,
      });
    }

    // Volume doesn't exist, create it
    this.logger.log(
      `Volume "${volumeName}" doesn't exist for experiment ${experimentName}, creating it now`,
    );

    const createVolumeResult = await this.databricksPort.createExperimentVolume(
      experimentName,
      experimentId,
      volumeName,
      `Ambyte data uploads volume for experiment ${experimentName}`,
    );

    if (createVolumeResult.isSuccess()) {
      this.logger.log(
        `Successfully created volume "${volumeName}" for experiment ${experimentName}`,
      );
      return success({
        volumeName,
        volumeExists: false,
        volumeCreated: true,
        directoryName,
      });
    } else {
      this.logger.error(
        `Failed to create volume "${volumeName}" for experiment ${experimentName}: ${createVolumeResult.error.message}`,
      );
      return failure(createVolumeResult.error);
    }
  }

  /**
   * Process a single file upload by streaming it directly
   */
  async execute(
    file: { filename: string; encoding: string; mimetype: string; stream: NodeJS.ReadableStream },
    experimentId: string,
    experimentName: string,
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
          'Invalid Ambyte data file path. Expected file paths like: "Ambyte_N/*.txt", "Ambyte_N/1-4/*.txt", "someDir/Ambyte_N/*.txt", or "someDir/Ambyte_N/1-4/*.txt".',
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
      experimentId,
      experimentName,
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
        `Successfully uploaded Ambyte data file "${trimmedFileName}" to experiment ${experimentName} (${experimentId})`,
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
   * Complete the upload process by triggering the pipeline and returning results
   */
  async postexecute(
    successfulUploads: { fileName: string; filePath: string }[],
    errors: { fileName: string; error: string }[],
    experiment: ExperimentDto,
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

    // Trigger pipeline update after successful file upload
    this.logger.log(
      `Triggering pipeline update for experiment ${experiment.name} (${experiment.id})`,
    );

    const pipelineResult = await this.databricksPort.triggerExperimentPipeline(
      experiment.name,
      experiment.id,
    );

    if (pipelineResult.isSuccess()) {
      this.logger.log(
        `Successfully triggered pipeline update for experiment ${experiment.name} (${experiment.id}). Update ID: ${pipelineResult.value.update_id}`,
      );
    } else {
      this.logger.warn(
        `Failed to trigger pipeline update for experiment ${experiment.id}: ${pipelineResult.error.message}`,
      );
    }

    return success({
      files: successfulUploads,
    });
  }

  /**
   * Validate the Ambyte file path
   * Accepts paths like: someDir/Ambyte_N/*.txt or Ambyte_N/[1-4]/*.txt
   */
  private validateFileName(fileName: string): boolean {
    const schema = z
      .string()
      .min(1, "File name cannot be empty")
      .max(256, "File path too long")
      .refine((name) => {
        const validPattern = /^(?:[^/]+\/)*Ambyte_\d{1,3}\/(?:[1-4]\/)?[^/]+\.txt$/i;
        return validPattern.test(name);
      }, "Invalid Ambyte file path format");

    return schema.safeParse(fileName).success;
  }

  /**
   * Trims the file path to start with Ambyte_N/...
   * Removes any parent directories before the Ambyte folder
   */
  private trimFileName(fileName: string): string {
    const pattern = /Ambyte_\d{1,3}\/(?:[1-4]\/)?[^/]+\.txt$/i;
    const ambyteMatch = pattern.exec(fileName);
    return ambyteMatch ? ambyteMatch[0] : fileName;
  }
}
