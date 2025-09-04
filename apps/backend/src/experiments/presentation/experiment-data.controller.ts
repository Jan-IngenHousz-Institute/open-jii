import { Controller, Logger, Req, UseGuards } from "@nestjs/common";
import { TsRestHandler, tsRestHandler } from "@ts-rest/nest";
import busboy from "busboy";
import type { Request } from "express";
import { StatusCodes } from "http-status-codes";

import { contract } from "@repo/api";

import { CurrentUser } from "../../common/decorators/current-user.decorator";
import { AuthGuard } from "../../common/guards/auth.guard";
import { handleFailure } from "../../common/utils/fp-utils";
import { GetExperimentDataUseCase } from "../application/use-cases/experiment-data/get-experiment-data";
import { UploadAmbyteDataUseCase } from "../application/use-cases/experiment-data/upload-ambyte-data";
import { GetExperimentAccessUseCase } from "../application/use-cases/get-experiment-access/get-experiment-access";

/**
 * A queue implementation for controlled file processing
 * Helps prevent memory issues and token race conditions
 */
class FileProcessingQueue {
  private queue: (() => Promise<void>)[] = [];
  private running = 0;
  private readonly concurrency: number;
  private readonly logger: Logger;
  private readonly id: string;

  constructor(concurrency = 1, logger: Logger) {
    this.concurrency = concurrency;
    this.logger = logger;
    this.id = `queue-${Math.random().toString(36).substring(2, 10)}`;
    this.logger.debug(`Created new FileProcessingQueue ${this.id} with concurrency ${concurrency}`);
  }

  add(task: () => Promise<void>, filename: string): void {
    this.queue.push(task);
    const queueLength = this.queue.length;
    this.logger.debug(
      `[Queue ${this.id}] Queued file: ${filename}. Queue length: ${queueLength}, running: ${this.running}/${this.concurrency}`,
    );
    // Using void to explicitly mark promise as handled elsewhere
    void this.processNext();
  }

  private async processNext(): Promise<void> {
    if (this.queue.length === 0) {
      this.logger.debug(`[Queue ${this.id}] Queue empty, nothing to process`);
      return;
    }

    if (this.running >= this.concurrency) {
      this.logger.debug(
        `[Queue ${this.id}] Max concurrency reached (${this.running}/${this.concurrency}), waiting for completion`,
      );
      return;
    }

    const item = this.queue.shift();
    if (!item) return;

    this.running++;
    this.logger.debug(
      `[Queue ${this.id}] Processing file: ${this.running} running, ${this.queue.length} in queue`,
    );

    try {
      await item();
      this.logger.debug(
        `[Queue ${this.id}] File processed successfully, ${this.queue.length} remaining in queue`,
      );
    } catch (error: unknown) {
      this.logger.error(
        `[Queue ${this.id}] Error processing file: ${error instanceof Error ? error.message : String(error)}`,
      );
    } finally {
      this.running--;
      this.logger.debug(
        `[Queue ${this.id}] Completed processing, now ${this.running} running, ${this.queue.length} in queue`,
      );
      // Using void to explicitly mark promise as handled elsewhere
      void this.processNext();
    }
  }

  async waitForCompletion(): Promise<void> {
    if (this.queue.length === 0 && this.running === 0) {
      this.logger.debug(
        `[Queue ${this.id}] No files in queue or processing, completing immediately`,
      );
      return;
    }

    this.logger.debug(
      `[Queue ${this.id}] Waiting for completion: ${this.queue.length} files in queue, ${this.running} running`,
    );

    return new Promise<void>((resolve) => {
      const checkInterval = setInterval(() => {
        if (this.queue.length === 0 && this.running === 0) {
          this.logger.debug(`[Queue ${this.id}] All files processed, queue empty`);
          clearInterval(checkInterval);
          resolve();
        } else {
          this.logger.debug(
            `[Queue ${this.id}] Still waiting: ${this.queue.length} in queue, ${this.running} running`,
          );
        }
      }, 100);
    });
  }
}

@Controller()
@UseGuards(AuthGuard)
export class ExperimentDataController {
  private readonly logger = new Logger(ExperimentDataController.name);

  constructor(
    private readonly getExperimentDataUseCase: GetExperimentDataUseCase,
    private readonly getExperimentAccessUseCase: GetExperimentAccessUseCase,
    private readonly uploadAmbyteDataUseCase: UploadAmbyteDataUseCase,
  ) {}

  @TsRestHandler(contract.experiments.getExperimentData)
  getExperimentData(@CurrentUser() user: { id: string }) {
    return tsRestHandler(contract.experiments.getExperimentData, async ({ params, query }) => {
      const { id: experimentId } = params;
      const { page, pageSize, tableName } = query;

      this.logger.log(`Processing data request for experiment ${experimentId} by user ${user.id}`);

      const result = await this.getExperimentDataUseCase.execute(experimentId, user.id, {
        page,
        pageSize,
        tableName,
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

      // Initialize arrays to collect results
      const successfulUploads: { fileName: string; fileId: string; filePath: string }[] = [];
      const errors: { fileName: string; error: string }[] = [];

      // Process the multipart/form-data request directly with busboy
      let sourceType: string | undefined;

      // Create a single shared processing queue with concurrency of 1
      // This queue will be used for all files to ensure sequential processing
      const processingQueue = new FileProcessingQueue(1, this.logger);
      this.logger.log("Created shared file processing queue for all uploads");

      try {
        await new Promise<void>((resolve, reject) => {
          const bb = busboy({
            headers: request.headers,
            limits: {
              files: UploadAmbyteDataUseCase.MAX_FILE_COUNT,
              fileSize: UploadAmbyteDataUseCase.MAX_FILE_SIZE,
            },
          });

          // Handle regular form fields
          bb.on("field", (fieldname, value) => {
            this.logger.debug(`Received field: ${fieldname}`);
            if (fieldname === "sourceType") {
              sourceType = value;
              this.logger.log(`Source type: ${sourceType}`);

              // // Create directory in Databricks for this experiment and source type
              // if (sourceType) {
              //   this.logger.log(
              //     `Creating directory for experiment ${experimentId} and source type ${sourceType}`,
              //   );

              //   this.uploadAmbyteDataUseCase
              //     .createDirectory(experimentId, experiment.name, sourceType)
              //     .then((result) => {
              //       if (result.isSuccess()) {
              //         this.logger.log(
              //           `Successfully created directory at: ${result.value.directoryPath}`,
              //         );
              //       } else {
              //         this.logger.warn(`Failed to create directory: ${result.error.message}`);
              //         // We'll continue with uploads even if directory creation fails
              //         // Databricks will create parent directories as needed during file upload
              //       }
              //     })
              //     .catch((error) => {
              //       this.logger.error(`Error creating directory: ${String(error)}`);
              //     });
              // }
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
              fileStream.resume(); // Skip this file
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
            processingQueue.waitForCompletion().catch((err) => {
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
}
