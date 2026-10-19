import { HttpService } from "@nestjs/axios";
import { Injectable, Logger } from "@nestjs/common";
import http from "http";
import https from "https";

import { getAxiosErrorMessage } from "../../../../utils/axios-error";
import { ErrorCodes } from "../../../../utils/error-codes";
import { Result, tryCatch, apiErrorMapper } from "../../../../utils/fp-utils";
import { DatabricksAuthService } from "../auth/auth.service";
import { DatabricksConfigService } from "../config/config.service";
import type { UploadFileResponse } from "./files.types";

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
          // An explicit transport skips both redirect-following, which keeps every body chunk
          // for a replay, and axios' wall-clock timer, which would cap a slow upload at the
          // timeout. What remains is the socket's idle timeout.
          transport: fullPath.startsWith("https:") ? https : http,
          timeout: DatabricksConfigService.DEFAULT_REQUEST_TIMEOUT,
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
}
