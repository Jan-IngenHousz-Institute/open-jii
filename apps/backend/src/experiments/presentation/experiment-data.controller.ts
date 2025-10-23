import { Controller, Logger, Req, UseGuards } from "@nestjs/common";
import { TsRestHandler, tsRestHandler } from "@ts-rest/nest";
import busboy from "busboy";
import type { Request } from "express";
import { StatusCodes } from "http-status-codes";

import { contract } from "@repo/api";

import { CurrentUser } from "../../common/decorators/current-user.decorator";
import { AuthGuard } from "../../common/guards/auth.guard";
import { AsyncQueue } from "../../common/utils/async-queue";
import { handleFailure } from "../../common/utils/fp-utils";
import { DownloadExperimentDataUseCase } from "../application/use-cases/experiment-data/download-experiment-data";
import { GetExperimentDataUseCase } from "../application/use-cases/experiment-data/get-experiment-data";
import { UploadAmbyteDataUseCase } from "../application/use-cases/experiment-data/upload-ambyte-data";
import { GetExperimentAccessUseCase } from "../application/use-cases/get-experiment-access/get-experiment-access";

@Controller()
@UseGuards(AuthGuard)
export class ExperimentDataController {
  private readonly logger = new Logger(ExperimentDataController.name);

  constructor(
    private readonly getExperimentDataUseCase: GetExperimentDataUseCase,
    private readonly getExperimentAccessUseCase: GetExperimentAccessUseCase,
    private readonly uploadAmbyteDataUseCase: UploadAmbyteDataUseCase,
    private readonly downloadExperimentDataUseCase: DownloadExperimentDataUseCase,
  ) {}

  @TsRestHandler(contract.experiments.getExperimentData)
  getExperimentData(@CurrentUser() user: { id: string }) {
    return tsRestHandler(contract.experiments.getExperimentData, async ({ params, query }) => {
      const { id: experimentId } = params;
      const { page, pageSize, tableName, columns } = query;

      this.logger.log(`Processing data request for experiment ${experimentId} by user ${user.id}`);

      const result = await this.getExperimentDataUseCase.execute(experimentId, user.id, {
        page,
        pageSize,
        tableName,
        columns,
      });

      if (result.isSuccess()) {
        const data = result.value;

        this.logger.log(`Successfully retrieved data for experiment ${experimentId}`);

        return {
          status: StatusCodes.OK,
          body: data,
        };
      }

      return handleFailure(result, this.logger);
    });
  }

  @TsRestHandler(contract.experiments.uploadExperimentData)
  uploadExperimentData(@CurrentUser() user: { id: string }, @Req() request: Request) {
    return tsRestHandler(contract.experiments.uploadExperimentData, async ({ params }) => {
      const { id: experimentId } = params;

      const contentType = request.headers["content-type"];
      if (!contentType?.includes("multipart/form-data")) {
        this.logger.error("Request is not multipart/form-data");
        return {
          status: StatusCodes.BAD_REQUEST,
          body: { message: "Request must be multipart/form-data" },
        };
      }

      this.logger.log(`Starting data upload for experiment ${experimentId} by user ${user.id}`);

      const experimentAccessResult = await this.getExperimentAccessUseCase.execute(
        experimentId,
        user.id,
      );

      if (experimentAccessResult.isFailure()) {
        return handleFailure(experimentAccessResult, this.logger);
      }

      const { experiment } = experimentAccessResult.value;

      // Check if experiment is archived - no one can upload data to archived experiments
      if (experiment.status === "archived") {
        this.logger.warn(
          `User ${user.id} attempted to upload data to archived experiment ${experimentId}`,
        );
        return {
          status: StatusCodes.FORBIDDEN,
          body: { message: "Cannot upload data to archived experiments" },
        };
      }

      // Prepare the upload environment by ensuring the required volume exists
      this.logger.log(
        `Preparing upload environment for experiment ${experiment.name} (${experimentId})`,
      );
      const prepResult = await this.uploadAmbyteDataUseCase.preexecute(
        experimentId,
        experiment.name,
      );

      if (prepResult.isFailure()) {
        this.logger.error(`Failed to prepare upload environment: ${prepResult.error.message}`);
        return handleFailure(prepResult, this.logger);
      }

      this.logger.log(
        `Upload environment prepared successfully. Volume: ${prepResult.value.volumeName}, ` +
          `Created: ${prepResult.value.volumeCreated}, Existed: ${prepResult.value.volumeExists}, ` +
          `Directory: ${prepResult.value.directoryName}`,
      );

      // Extract the directory name for use in file uploads
      const { directoryName } = prepResult.value;

      // Initialize arrays to collect results
      const successfulUploads: { fileName: string; fileId: string; filePath: string }[] = [];
      const errors: { fileName: string; error: string }[] = [];

      // Process the multipart/form-data request directly with busboy
      let sourceType: string | undefined;

      // Create a single shared processing queue with concurrency of 1
      // This queue will be used for all files to ensure sequential processing
      const processingQueue = new AsyncQueue(1, this.logger);
      this.logger.log("Created shared file processing queue for all uploads");

      try {
        await new Promise<void>((resolve, reject) => {
          const bb = busboy({
            headers: request.headers,
            limits: {
              files: UploadAmbyteDataUseCase.MAX_FILE_COUNT,
              fileSize: UploadAmbyteDataUseCase.MAX_FILE_SIZE,
            },
            preservePath: true,
          });

          // Handle regular form fields
          bb.on("field", (fieldname, value) => {
            this.logger.debug(`Received field: ${fieldname}`);
            if (fieldname === "sourceType") {
              sourceType = value;
            }
          });

          // Handle files
          bb.on("file", (fieldname, fileStream, info) => {
            const { filename, encoding, mimeType } = info;

            this.logger.log(`Received file: ${filename}, fieldname: ${fieldname}`);

            if (fieldname !== "files") {
              this.logger.log(`Skipping file with non-matching fieldname: ${fieldname}`);
              fileStream.resume(); // Skip non-matching field names
              return;
            }

            // Check if sourceType is defined before processing any files
            if (sourceType === undefined) {
              this.logger.error(`Received file ${filename} but sourceType is not defined`);
              fileStream.resume();
              reject(new Error("sourceType field must be provided before file uploads"));
              return;
            }

            // Add the file processing task to the queue
            processingQueue.add(async () => {
              this.logger.log(`Processing file: ${filename}`);

              try {
                await this.uploadAmbyteDataUseCase.execute(
                  {
                    filename,
                    encoding,
                    mimetype: mimeType,
                    stream: fileStream,
                  },
                  experimentId,
                  experiment.name,
                  sourceType,
                  directoryName,
                  successfulUploads,
                  errors,
                );
                this.logger.log(`Completed processing file: ${filename}`);
              } catch (error) {
                this.logger.error(`Error processing file ${filename}: ${String(error)}`);
                errors.push({
                  fileName: filename,
                  error: String(error),
                });
              }
            }, filename);
          });

          // Handle errors
          bb.on("error", (err) => {
            this.logger.error(`Error during file upload: ${String(err)}`);
            reject(err instanceof Error ? err : new Error(String(err)));
          });

          // Handle completion
          bb.on("close", () => {
            this.logger.log(
              "Busboy finished parsing the form, waiting for file processing to complete...",
            );

            // Wait for all file processing to complete
            processingQueue
              .waitForCompletion()
              .then(() => {
                this.logger.log("All file processing completed successfully");
                resolve();
              })
              .catch((err) => {
                this.logger.error(
                  `Error while waiting for file processing to complete: ${String(err)}`,
                );
                reject(err instanceof Error ? err : new Error(String(err)));
              });
          });

          // Pipe the request to busboy
          this.logger.debug("Piping request to busboy");
          request.pipe(bb);
        });

        this.logger.log(`Processed all files for experiment ${experimentId}`);
      } catch (error) {
        this.logger.error(
          `Error processing files for experiment ${experimentId}: ${String(error)}`,
        );

        // Check if error is due to missing sourceType
        if (String(error).includes("sourceType field must be provided")) {
          return {
            status: StatusCodes.BAD_REQUEST,
            body: { message: "sourceType field must be provided before file uploads" },
          };
        }

        return {
          status: StatusCodes.INTERNAL_SERVER_ERROR,
          body: { message: "Error processing files" },
        };
      }

      // Complete the upload process once all files have been processed
      const result = await this.uploadAmbyteDataUseCase.postexecute(
        successfulUploads,
        errors,
        experiment,
      );

      if (result.isSuccess()) {
        return {
          status: StatusCodes.CREATED,
          body: result.value,
        };
      }

      return handleFailure(result, this.logger);
    });
  }

  @TsRestHandler(contract.experiments.downloadExperimentData)
  downloadExperimentData(@CurrentUser() user: { id: string }) {
    return tsRestHandler(contract.experiments.downloadExperimentData, async ({ params, query }) => {
      const { id: experimentId } = params;
      const { tableName } = query;

      this.logger.log(
        `Processing download request for experiment ${experimentId}, table ${tableName} by user ${user.id}`,
      );

      const result = await this.downloadExperimentDataUseCase.execute(experimentId, user.id, {
        tableName,
      });

      if (result.isSuccess()) {
        const data = result.value;

        this.logger.log(
          `Successfully prepared download links for experiment ${experimentId}, table ${tableName}. ` +
            `Total chunks: ${data.externalLinks.length}`,
        );

        return {
          status: StatusCodes.OK,
          body: data,
        };
      }

      return handleFailure(result, this.logger);
    });
  }
}
