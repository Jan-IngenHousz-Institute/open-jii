import { HttpService } from "@nestjs/axios";
import { Injectable, Logger } from "@nestjs/common";
import { Readable } from "stream";

import { getAxiosErrorMessage } from "../../../../utils/axios-error";
import { ErrorCodes } from "../../../../utils/error-codes";
import { Result, tryCatch, apiErrorMapper } from "../../../../utils/fp-utils";
import { DatabricksAuthService } from "../auth/auth.service";
import { DatabricksConfigService } from "../config/config.service";
import type { DownloadFileResponse, UploadFileResponse } from "./files.types";

@Injectable()
export class DatabricksFilesService {
  private readonly logger = new Logger(DatabricksFilesService.name);

  public static readonly FILES_ENDPOINT = "/api/2.0/fs/files";

  // Hard cap enforced by the Databricks Files API: per-file uploads max out at 5 GiB.
  // https://docs.databricks.com/api/workspace/files/upload
  public static readonly MAX_UPLOAD_BYTES = 5 * 1024 * 1024 * 1024;

  constructor(
    private readonly httpService: HttpService,
    private readonly configService: DatabricksConfigService,
    private readonly authService: DatabricksAuthService,
  ) {}

  /**
   * Upload a file to a specified path in Databricks workspace.
   * The caller is responsible for constructing the full path.
   *
   * Accepts either a Buffer (uses Content-Length) or a Readable stream
   * (uses chunked transfer encoding). Streaming avoids buffering the whole
   * file in memory and is preferred for any upload originating from an HTTP
   * request body.
   *
   * @param filePath - The full destination path for the file in Databricks.
   * @param body - File contents as a Buffer or Readable stream.
   * @returns Result containing file ID and path.
   */
  async upload(
    filePath: string,
    body: Buffer | NodeJS.ReadableStream,
  ): Promise<Result<UploadFileResponse>> {
    return await tryCatch(
      async () => {
        if (Buffer.isBuffer(body) && body.length > DatabricksFilesService.MAX_UPLOAD_BYTES) {
          throw new Error(
            `File exceeds Databricks per-file limit of ${DatabricksFilesService.MAX_UPLOAD_BYTES} bytes`,
          );
        }

        const tokenResult = await this.authService.getAccessToken();
        if (tokenResult.isFailure()) {
          throw tokenResult.error;
        }

        const token = tokenResult.value;
        const host = this.configService.getHost();
        const apiUrl = `${host}${DatabricksFilesService.FILES_ENDPOINT}`;

        this.logger.debug({
          msg: "Uploading file to Databricks",
          operation: "uploadFile",
          filePath,
          mode: Buffer.isBuffer(body) ? "buffer" : "stream",
        });

        const fullPath = `${apiUrl}${filePath}`;

        await this.httpService.axiosRef.put(fullPath, body, {
          headers: {
            Authorization: `Bearer ${token}`,
            "Content-Type": "application/octet-stream",
          },
          params: {
            overwrite: false,
          },
          // Following redirects means keeping every body chunk for a replay, and the
          // timeout then caps the whole transfer instead of an idle socket.
          maxRedirects: 0,
          timeout: DatabricksConfigService.DEFAULT_REQUEST_TIMEOUT,
          maxBodyLength: Infinity,
          maxContentLength: Infinity,
        });

        this.logger.log({
          msg: "Successfully uploaded file to Databricks",
          operation: "uploadFile",
          filePath,
          status: "success",
        });

        return {
          filePath,
        };
      },
      (error) => {
        this.logger.error({
          msg: "Failed to upload file to Databricks",
          errorCode: ErrorCodes.DATABRICKS_FILE_FAILED,
          operation: "uploadFile",
          error,
        });
        return apiErrorMapper(
          `Failed to upload file to Databricks: ${getAxiosErrorMessage(error)}`,
        );
      },
    );
  }

  /**
   * Download a file from Databricks as a stream
   * @param filePath - The full path to the file in Databricks (e.g., /Volumes/catalog/schema/volume/path/file.csv)
   * @returns Result containing a readable stream of the file contents and its size when known
   */
  async download(filePath: string): Promise<Result<DownloadFileResponse>> {
    return await tryCatch(
      async () => {
        const tokenResult = await this.authService.getAccessToken();
        if (tokenResult.isFailure()) {
          throw tokenResult.error;
        }

        const token = tokenResult.value;
        const host = this.configService.getHost();
        const apiUrl = `${host}${DatabricksFilesService.FILES_ENDPOINT}`;

        this.logger.debug({
          msg: "Downloading file from Databricks",
          operation: "downloadFile",
          filePath,
        });

        const fullPath = `${apiUrl}${filePath}`;

        // Use axios to stream the response
        const response = await this.httpService.axiosRef.get(fullPath, {
          headers: {
            Authorization: `Bearer ${token}`,
          },
          responseType: "stream",
          // The body is read at the client's pace; without redirects the timeout stops at the headers.
          maxRedirects: 0,
          timeout: DatabricksConfigService.DEFAULT_REQUEST_TIMEOUT,
        });

        this.logger.log({
          msg: "Successfully initiated file download from Databricks",
          operation: "downloadFile",
          filePath,
          status: "success",
        });

        const contentLength = Number(response.headers["content-length"] ?? Number.NaN);

        return {
          stream: response.data as Readable,
          contentLength: Number.isSafeInteger(contentLength) ? contentLength : undefined,
        };
      },
      (error) => {
        this.logger.error({
          msg: "Failed to download file from Databricks",
          errorCode: ErrorCodes.DATABRICKS_FILE_FAILED,
          operation: "downloadFile",
          filePath,
          error,
        });
        return apiErrorMapper(
          `Failed to download file from Databricks: ${getAxiosErrorMessage(error)}`,
        );
      },
    );
  }
}
