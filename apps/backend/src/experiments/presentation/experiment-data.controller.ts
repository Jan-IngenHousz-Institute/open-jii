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

      try {
        await new Promise<void>((resolve, reject) => {
          const bb = busboy({
            headers: request.headers,
            limits: {
              files: UploadAmbyteDataUseCase.MAX_FILE_COUNT,
              fileSize: UploadAmbyteDataUseCase.MAX_FILE_SIZE,
            },
          });

          // Track ongoing file processing promises
          const processingPromises: Promise<void>[] = [];

          // Handle files
          bb.on("file", (fieldname, fileStream, info) => {
            const { filename, encoding, mimeType } = info;

            console.log(`Received file: ${filename}, fieldname: ${fieldname}`);

            if (fieldname !== "files") {
              console.log(`Skipping file with non-matching fieldname: ${fieldname}`);
              fileStream.resume(); // Skip non-matching field names
              return;
            }

            console.log(`Processing file: ${filename} (${processingPromises.length + 1})`);

            // Add each file processing promise to our tracking array
            const processPromise = this.uploadAmbyteDataUseCase
              .execute(
                {
                  filename,
                  encoding,
                  mimetype: mimeType,
                  stream: fileStream,
                },
                experimentId,
                experiment.name,
                successfulUploads,
                errors,
              )
              .then(() => {
                console.log(`Completed processing file: ${filename}`);
              })
              .catch((error) => {
                console.error(`Error processing file ${filename}:`, error);
                errors.push({
                  fileName: filename,
                  error: String(error),
                });
              });

            processingPromises.push(processPromise);
            console.log(
              `Added promise for ${filename}, total promises: ${processingPromises.length}`,
            );
          });

          // Handle regular form fields
          bb.on("field", (fieldname, value) => {
            console.log(`Received field: ${fieldname}`);
            if (fieldname === "sourceType") {
              sourceType = value;
              this.logger.log(`Source type: ${sourceType}`);
            }
          });

          // Handle errors
          bb.on("error", (err) => {
            console.error("Error during file upload:", err);
            reject(err instanceof Error ? err : new Error(String(err)));
          });

          // Handle completion
          bb.on("close", () => {
            console.log(
              "Busboy finished parsing the form, waiting for file processing to complete...",
            );

            // Set a timeout to prevent hanging indefinitely
            const timeoutId = setTimeout(() => {
              console.warn(
                "File processing timeout after 30 seconds, some files may not have completed processing",
              );
              // Log memory usage on timeout
              console.log("Memory usage on timeout:", process.memoryUsage());
              resolve();
            }, 30000); // 30 second timeout

            // Wait for all file processing to complete
            Promise.all(processingPromises)
              .then(() => {
                clearTimeout(timeoutId);
                console.log("Finished processing multipart request");
                // Log memory usage after processing
                console.log("Memory usage after processing:", process.memoryUsage());
                resolve();
              })
              .catch((err) => {
                clearTimeout(timeoutId);
                console.error("Error while waiting for file processing to complete:", err);
                // Log memory usage on error
                console.log("Memory usage on error:", process.memoryUsage());
                reject(err instanceof Error ? err : new Error(String(err)));
              });
          });

          // Pipe the request to busboy
          console.log("Piping request to busboy");
          request.pipe(bb);
        });

        this.logger.log(`Processed all files for experiment ${experimentId}`);
      } catch (error) {
        this.logger.error(
          `Error processing files for experiment ${experimentId}: ${String(error)}`,
        );
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
