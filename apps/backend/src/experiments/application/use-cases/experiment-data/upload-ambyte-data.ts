import { Inject, Injectable, Logger } from "@nestjs/common";
import { z } from "zod";

import { AppError, Result, failure, success } from "../../../../common/utils/fp-utils";
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
  ): Promise<Result<{ volumeName: string; volumeExists: boolean; volumeCreated: boolean }>> {
    this.logger.log(
      `Preparing upload environment for experiment ${experimentName} (${experimentId})`,
    );

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
          'Invalid Ambyte data file. Expected either an "Ambyte_X" folder, a numbered subfolder (1, 2, 3, 4), or a data file in the format YYYYMMDD-HHMMSS_.txt.',
      });

      this.logger.warn(`Skipping invalid file: ${file.filename}`);
      // Consume the stream to allow busboy to continue processing the form
      file.stream.resume();
      return;
    }

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
    const buffer = await this.streamToBuffer(file.stream);

    this.logger.debug(
      `Successfully converted stream to buffer for file: ${file.filename}, size: ${buffer.length} bytes`,
    );

    this.logger.log(`Uploading file to Databricks: ${file.filename}`);
    const uploadResult = await this.databricksPort.uploadFile(
      experimentId,
      experimentName,
      sourceType,
      file.filename,
      buffer,
    );

    if (uploadResult.isSuccess()) {
      successfulUploads.push({
        fileName: file.filename,
        filePath: uploadResult.value.filePath,
      });

      this.logger.log(
        `Successfully uploaded Ambyte data file "${file.filename}" to experiment ${experimentName} (${experimentId})`,
      );
    } else {
      errors.push({
        fileName: file.filename,
        error: uploadResult.error.message,
      });

      this.logger.error(`Failed to upload file "${file.filename}": ${uploadResult.error.message}`);
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
   * Convert a stream to a buffer
   * @param stream - The readable stream
   * @returns Promise resolving to a Buffer
   */
  private async streamToBuffer(stream: NodeJS.ReadableStream): Promise<Buffer> {
    return new Promise<Buffer>((resolve, reject) => {
      const chunks: Buffer[] = [];
      let totalSize = 0;

      // Handle data chunks
      stream.on("data", (chunk) => {
        // Ensure chunk is a Buffer
        const buffer = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk);
        totalSize += buffer.length;

        // Check if we're exceeding the size limit
        if (totalSize > UploadAmbyteDataUseCase.MAX_FILE_SIZE) {
          reject(
            new Error(
              `File exceeds maximum size of ${UploadAmbyteDataUseCase.MAX_FILE_SIZE / (1024 * 1024)}MB`,
            ),
          );
          return;
        }

        chunks.push(buffer);
      });

      // Handle errors
      stream.on("error", (err) => {
        console.error("Stream error:", err);
        reject(err instanceof Error ? err : new Error(String(err)));
      });

      // Handle completion
      stream.on("end", () => {
        try {
          this.logger.debug(`Stream ended, concatenating ${chunks.length} chunks`);
          const result = Buffer.concat(chunks);
          // Clear the chunks array to help garbage collection
          chunks.length = 0;
          this.logger.debug("Buffer created, chunks cleared");
          resolve(result);
        } catch (err) {
          this.logger.error("Error during buffer concatenation:", err);
          reject(err instanceof Error ? err : new Error(String(err)));
        }
      });

      // Set a timeout to prevent hanging
      const timeout = setTimeout(() => {
        this.logger.warn("Stream processing timeout triggered");
        reject(new Error("Stream processing timed out after 30 seconds"));
      }, 30000);

      // Clear the timeout when done
      stream.on("end", () => {
        this.logger.debug("Clearing timeout on end");
        clearTimeout(timeout);
      });

      stream.on("error", () => {
        this.logger.error("Clearing timeout on error");
        clearTimeout(timeout);
      });
    });
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
      .min(1, "File name cannot be empty")
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
