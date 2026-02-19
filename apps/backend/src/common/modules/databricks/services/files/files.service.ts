import { HttpService } from "@nestjs/axios";
import { Injectable, Logger } from "@nestjs/common";
import { Readable } from "stream";

import { getAxiosErrorMessage } from "../../../../utils/axios-error";
import { ErrorCodes } from "../../../../utils/error-codes";
import { Result, tryCatch, apiErrorMapper } from "../../../../utils/fp-utils";
import { DatabricksAuthService } from "../auth/auth.service";
import { DatabricksConfigService } from "../config/config.service";
import { UploadFileResponse } from "./files.types";

@Injectable()
export class DatabricksFilesService {
  private readonly logger = new Logger(DatabricksFilesService.name);

  public static readonly FILES_ENDPOINT = "/api/2.0/fs/files";

  constructor(
    private readonly httpService: HttpService,
    private readonly configService: DatabricksConfigService,
    private readonly authService: DatabricksAuthService,
  ) {}

  /**
   * Upload a file to a specified path in Databricks workspace.
   * The caller is responsible for constructing the full path.
   *
   * @param filePath - The full destination path for the file in Databricks.
   * @param fileBuffer - File contents as a buffer.
   * @returns Result containing file ID and path.
   */
  async upload(filePath: string, fileBuffer: Buffer): Promise<Result<UploadFileResponse>> {
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
          msg: "Uploading file to Databricks",
          operation: "uploadFile",
          filePath,
        });

        const fullPath = `${apiUrl}${filePath}`;

        await this.httpService.axiosRef.put(fullPath, fileBuffer, {
          headers: {
            Authorization: `Bearer ${token}`,
            "Content-Type": "application/octet-stream",
          },
          params: {
            overwrite: false,
          },
          timeout: DatabricksConfigService.DEFAULT_REQUEST_TIMEOUT,
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
   * @returns Result containing a readable stream of the file contents
   */
  async download(filePath: string): Promise<Result<Readable>> {
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
          timeout: DatabricksConfigService.DEFAULT_REQUEST_TIMEOUT,
        });

        this.logger.log({
          msg: "Successfully initiated file download from Databricks",
          operation: "downloadFile",
          filePath,
          status: "success",
        });

        return response.data as Readable;
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
