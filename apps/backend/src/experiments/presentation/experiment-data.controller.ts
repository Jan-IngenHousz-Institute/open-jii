import { Controller, Logger, Req } from "@nestjs/common";
import { Session } from "@thallesp/nestjs-better-auth";
import type { UserSession } from "@thallesp/nestjs-better-auth";
import { TsRestHandler, tsRestHandler } from "@ts-rest/nest";
import busboy from "busboy";
import type { Request } from "express";
import { StatusCodes } from "http-status-codes";

import { contract } from "@repo/api";

import { AsyncQueue } from "../../common/utils/async-queue";
import { ErrorCodes } from "../../common/utils/error-codes";
import { handleFailure } from "../../common/utils/fp-utils";
import { DownloadExperimentDataUseCase } from "../application/use-cases/experiment-data/download-experiment-data";
import { GetExperimentDataUseCase } from "../application/use-cases/experiment-data/get-experiment-data";
import { GetExperimentTablesUseCase } from "../application/use-cases/experiment-data/get-experiment-tables";
import { UploadAmbyteDataUseCase } from "../application/use-cases/experiment-data/upload-ambyte-data";
import { GetExperimentAccessUseCase } from "../application/use-cases/get-experiment-access/get-experiment-access";

@Controller()
export class ExperimentDataController {
  private readonly logger = new Logger(ExperimentDataController.name);

  constructor(
    private readonly getExperimentDataUseCase: GetExperimentDataUseCase,
    private readonly getExperimentTablesUseCase: GetExperimentTablesUseCase,
    private readonly getExperimentAccessUseCase: GetExperimentAccessUseCase,
    private readonly uploadAmbyteDataUseCase: UploadAmbyteDataUseCase,
    private readonly downloadExperimentDataUseCase: DownloadExperimentDataUseCase,
  ) {}

  @TsRestHandler(contract.experiments.getExperimentTables)
  getExperimentTables(@Session() session: UserSession) {
    return tsRestHandler(contract.experiments.getExperimentTables, async ({ params }) => {
      const { id: experimentId } = params;

      this.logger.log({
        msg: "Processing tables metadata request",
        operation: "getTables",
        experimentId,
        userId: session.user.id,
      });

      const result = await this.getExperimentTablesUseCase.execute(experimentId, session.user.id);

      if (result.isSuccess()) {
        const data = result.value;

        this.logger.log({
          msg: "Successfully retrieved table metadata",
          operation: "getTables",
          experimentId,
          status: "success",
        });

        return {
          status: StatusCodes.OK,
          body: data,
        };
      }

      return handleFailure(result, this.logger);
    });
  }

  @TsRestHandler(contract.experiments.getExperimentData)
  getExperimentData(@Session() session: UserSession) {
    return tsRestHandler(contract.experiments.getExperimentData, async ({ params, query }) => {
      const { id: experimentId } = params;
      const { page, pageSize, tableName, columns, orderBy, orderDirection } = query;

      this.logger.log({
        msg: "Processing data request",
        operation: "getData",
        experimentId,
        userId: session.user.id,
      });

      const result = await this.getExperimentDataUseCase.execute(experimentId, session.user.id, {
        page,
        pageSize,
        tableName,
        columns,
        orderBy,
        orderDirection,
      });

      if (result.isSuccess()) {
        const data = result.value;

        this.logger.log({
          msg: "Successfully retrieved data",
          operation: "getData",
          experimentId,
          status: "success",
        });

        return {
          status: StatusCodes.OK,
          body: data,
        };
      }

      return handleFailure(result, this.logger);
    });
  }

  @TsRestHandler(contract.experiments.uploadExperimentData)
  uploadExperimentData(@Session() session: UserSession, @Req() request: Request) {
    return tsRestHandler(contract.experiments.uploadExperimentData, async ({ params }) => {
      const { id: experimentId } = params;

      const contentType = request.headers["content-type"];
      if (!contentType?.includes("multipart/form-data")) {
        this.logger.error({
          msg: "Request is not multipart/form-data",
          errorCode: ErrorCodes.BAD_REQUEST,
          operation: "uploadData",
          experimentId,
        });
        return {
          status: StatusCodes.BAD_REQUEST,
          body: { message: "Request must be multipart/form-data" },
        };
      }

      this.logger.log({
        msg: "Starting data upload",
        operation: "uploadData",
        experimentId,
        userId: session.user.id,
      });

      // Prepare the upload environment - use case handles access control and experiment lookup
      const prepResult = await this.uploadAmbyteDataUseCase.preexecute(
        experimentId,
        session.user.id,
      );

      if (prepResult.isFailure()) {
        this.logger.error({
          msg: "Failed to prepare upload environment",
          errorCode: ErrorCodes.INTERNAL_SERVER_ERROR,
          operation: "uploadData",
          experimentId,
          error: prepResult.error.message,
        });
        return handleFailure(prepResult, this.logger);
      }

      const { experiment, volumeName, volumeCreated, volumeExists, directoryName } =
        prepResult.value;

      this.logger.log({
        msg: "Upload environment prepared successfully",
        operation: "uploadData",
        experimentId,
        volumeName,
        volumeCreated,
        volumeExists,
        directoryName,
        status: "success",
      });

      // Initialize arrays to collect results
      const successfulUploads: { fileName: string; fileId: string; filePath: string }[] = [];
      const errors: { fileName: string; error: string }[] = [];

      // Process the multipart/form-data request directly with busboy
      let sourceType: string | undefined;

      // Create a single shared processing queue with concurrency of 1
      // This queue will be used for all files to ensure sequential processing
      const processingQueue = new AsyncQueue(1, this.logger);
      this.logger.log({
        msg: "Created shared file processing queue for all uploads",
        operation: "uploadData",
        experimentId,
      });

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
            this.logger.debug({
              msg: "Received field",
              operation: "uploadData",
              experimentId,
              fieldname,
            });
            if (fieldname === "sourceType") {
              sourceType = value;
            }
          });

          // Handle files
          bb.on("file", (fieldname, fileStream, info) => {
            const { filename, encoding, mimeType } = info;

            this.logger.log({
              msg: "Received file",
              operation: "uploadData",
              experimentId,
              filename,
              fieldname,
            });

            if (fieldname !== "files") {
              this.logger.log({
                msg: "Skipping file with non-matching fieldname",
                operation: "uploadData",
                experimentId,
                fieldname,
              });
              fileStream.resume(); // Skip non-matching field names
              return;
            }

            // Check if sourceType is defined before processing any files
            if (sourceType === undefined) {
              this.logger.error({
                msg: "Received file but sourceType is not defined",
                errorCode: ErrorCodes.BAD_REQUEST,
                operation: "uploadData",
                experimentId,
                filename,
              });
              fileStream.resume();
              reject(new Error("sourceType field must be provided before file uploads"));
              return;
            }

            // Add the file processing task to the queue
            processingQueue.add(async () => {
              this.logger.log({
                msg: "Processing file",
                operation: "uploadData",
                experimentId,
                filename,
              });

              try {
                await this.uploadAmbyteDataUseCase.execute(
                  {
                    filename,
                    encoding,
                    mimetype: mimeType,
                    stream: fileStream,
                  },
                  experiment,
                  sourceType,
                  directoryName,
                  successfulUploads,
                  errors,
                );
                this.logger.log({
                  msg: "Completed processing file",
                  operation: "uploadData",
                  experimentId,
                  filename,
                  status: "success",
                });
              } catch (error) {
                this.logger.error({
                  msg: "Error processing file",
                  errorCode: ErrorCodes.INTERNAL_SERVER_ERROR,
                  operation: "uploadData",
                  experimentId,
                  filename,
                  error: String(error),
                });
                errors.push({
                  fileName: filename,
                  error: String(error),
                });
              }
            }, filename);
          });

          // Handle errors
          bb.on("error", (err) => {
            this.logger.error({
              msg: "Error during file upload",
              errorCode: ErrorCodes.INTERNAL_SERVER_ERROR,
              operation: "uploadData",
              experimentId,
              error: String(err),
            });
            reject(err instanceof Error ? err : new Error(String(err)));
          });

          // Handle completion
          bb.on("close", () => {
            this.logger.log({
              msg: "Busboy finished parsing the form, waiting for file processing to complete",
              operation: "uploadData",
              experimentId,
            });

            // Wait for all file processing to complete
            processingQueue
              .waitForCompletion()
              .then(() => {
                this.logger.log({
                  msg: "All file processing completed successfully",
                  operation: "uploadData",
                  experimentId,
                  status: "success",
                });
                resolve();
              })
              .catch((err) => {
                this.logger.error({
                  msg: "Error while waiting for file processing to complete",
                  errorCode: ErrorCodes.INTERNAL_SERVER_ERROR,
                  operation: "uploadData",
                  experimentId,
                  error: String(err),
                });
                reject(err instanceof Error ? err : new Error(String(err)));
              });
          });

          // Pipe the request to busboy
          this.logger.debug({
            msg: "Piping request to busboy",
            operation: "uploadData",
            experimentId,
          });
          request.pipe(bb);
        });

        this.logger.log({
          msg: "Processed all files",
          operation: "uploadData",
          experimentId,
          status: "success",
        });
      } catch (error) {
        this.logger.error({
          msg: "Error processing files",
          errorCode: ErrorCodes.INTERNAL_SERVER_ERROR,
          operation: "uploadData",
          experimentId,
          error: String(error),
        });

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
        directoryName,
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
  downloadExperimentData(@Session() session: UserSession) {
    return tsRestHandler(contract.experiments.downloadExperimentData, async ({ params, query }) => {
      const { id: experimentId } = params;
      const { tableName } = query;

      this.logger.log({
        msg: "Processing download request",
        operation: "downloadData",
        experimentId,
        userId: session.user.id,
        tableName,
      });

      const result = await this.downloadExperimentDataUseCase.execute(
        experimentId,
        session.user.id,
        {
          tableName,
        },
      );

      if (result.isSuccess()) {
        const data = result.value;

        this.logger.log({
          msg: "Successfully prepared download links",
          operation: "downloadData",
          experimentId,
          tableName,
          totalChunks: data.externalLinks.length,
          status: "success",
        });

        return {
          status: StatusCodes.OK,
          body: data,
        };
      }

      return handleFailure(result, this.logger);
    });
  }
}
